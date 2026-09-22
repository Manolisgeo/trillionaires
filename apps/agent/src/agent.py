from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
import time
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    JobContext,
    RunContext,
    cli,
    function_tool,
)
from livekit.plugins import openai

sys.path.insert(0, str(Path(__file__).parent))
from backend import BackendClient
from instructions import build_instructions

logger = logging.getLogger("aperture-agent")
load_dotenv(".env")
load_dotenv("../../.env")

try:
    from openai.types.beta.realtime.session import TurnDetection
except Exception:  # pragma: no cover
    TurnDetection = None


def _conversation_id(ctx: JobContext) -> str:
    for raw in (getattr(ctx.job, "metadata", None), getattr(ctx.room, "metadata", None)):
        if not raw:
            continue
        try:
            data = json.loads(raw)
            if data.get("conversationId"):
                return str(data["conversationId"])
        except json.JSONDecodeError:
            continue
    return ctx.room.name


class ConversationAgent(Agent):
    def __init__(self, backend: BackendClient, instructions: str) -> None:
        super().__init__(instructions=instructions)
        self.backend = backend
        self.started_at = time.time()

    def elapsed(self) -> float:
        return time.time() - self.started_at

    @function_tool
    async def get_conversation_objectives(self, context: RunContext) -> dict[str, Any]:
        """Load the conversation objectives. Use this before planning what to ask."""
        return await self.backend.tool("get_conversation_objectives")

    @function_tool
    async def get_conversation_state(self, context: RunContext) -> dict[str, Any]:
        """Load structured conversation state: known, unknown, contradictions, recent turns."""
        return await self.backend.tool("get_conversation_state")

    @function_tool
    async def get_next_action(self, context: RunContext) -> dict[str, Any]:
        """Ask the reasoning layer what to do next. Prefer this over reading a script."""
        return await self.backend.tool("get_next_action")

    @function_tool
    async def save_fact(
        self,
        context: RunContext,
        text: str,
        kind: str = "FACT",
        confidence: float = 0.7,
    ) -> dict[str, Any]:
        """Save an established fact, inference, or uncertainty.

        kind must be FACT, INFERENCE, or UNCERTAINTY.
        """
        return await self.backend.tool(
            "save_fact",
            {
                "text": text,
                "kind": kind,
                "confidence": confidence,
                "evidenceSegmentIds": [],
                "objectiveIds": [],
            },
        )

    @function_tool
    async def mark_objective_complete(
        self,
        context: RunContext,
        objective_id: str,
        status: str = "COVERED",
    ) -> dict[str, Any]:
        """Mark an objective COVERED, PARTIAL, UNCOVERED, or ABANDONED."""
        return await self.backend.tool(
            "mark_objective_complete",
            {"objectiveId": objective_id, "status": status},
        )

    @function_tool
    async def mark_follow_up(self, context: RunContext, note: str) -> dict[str, Any]:
        """Remember something worth asking later without derailing the current turn."""
        return await self.backend.tool("mark_follow_up", {"note": note})

    @function_tool
    async def create_action_item(
        self,
        context: RunContext,
        text: str,
        owner: str | None = None,
    ) -> dict[str, Any]:
        """Capture an action the humans agreed to. Do not invent owners."""
        return await self.backend.tool("create_action_item", {"text": text, "owner": owner})

    @function_tool
    async def end_conversation(self, context: RunContext) -> dict[str, Any]:
        """End only when the participant is done or objectives are covered and they agree to close."""
        return await self.backend.tool("end_conversation")


server = AgentServer()


@server.rtc_session(agent_name=os.getenv("LIVEKIT_AGENT_NAME", "aperture-conversation-agent"))
async def aperture_conversation_agent(ctx: JobContext) -> None:
    conversation_id = _conversation_id(ctx)
    ctx.log_context_fields = {"conversationId": conversation_id, "room": ctx.room.name}
    backend = BackendClient(conversation_id)

    try:
        snapshot = await backend.snapshot()
    except Exception:
        logger.exception("Failed to load conversation snapshot")
        snapshot = {
            "state": {"purpose": "Have a useful conversation.", "objectives": []},
            "nextAction": {},
            "controllerAction": "ASK",
        }

    instructions = build_instructions(snapshot)
    turn_detection = None
    if TurnDetection is not None:
        turn_detection = TurnDetection(
            type="semantic_vad",
            eagerness="medium",
            create_response=True,
            interrupt_response=True,
        )

    session = AgentSession(
        llm=openai.realtime.RealtimeModel(
            voice="marin",
            model=os.getenv("OPENAI_REALTIME_MODEL", "gpt-realtime"),
            turn_detection=turn_detection,
        )
    )
    agent = ConversationAgent(backend, instructions)

    def persist(coro) -> None:
        asyncio.create_task(coro)

    @session.on("user_input_transcribed")
    def on_user_transcript(ev) -> None:
        text = getattr(ev, "transcript", None) or getattr(ev, "text", "")
        is_final = bool(getattr(ev, "is_final", getattr(ev, "final", True)))
        persist(
            backend.tool(
                "save_transcript_segment",
                {
                    "id": str(getattr(ev, "id", f"seg-{time.time()}")),
                    "speakerId": "human",
                    "speakerName": "Participant",
                    "text": text,
                    "startTime": agent.elapsed(),
                    "endTime": agent.elapsed(),
                    "confidence": 1,
                    "isFinal": is_final,
                },
            )
        )

    @session.on("agent_state_changed")
    def on_agent_state(ev) -> None:
        mapping = {
            "listening": "LISTENING",
            "thinking": "THINKING",
            "speaking": "SPEAKING",
        }
        mode = mapping.get(str(getattr(ev, "new_state", "")), "LISTENING")
        persist(
            backend.tool(
                "record_event",
                {"eventType": "TURN_STARTED", "mode": mode, "type": "AGENT_MODE"},
            )
        )

    @session.on("overlapping_speech")
    def on_overlap(ev) -> None:
        persist(
            backend.tool(
                "record_event",
                {
                    "eventType": "INTERRUPTION"
                    if getattr(ev, "is_interruption", True)
                    else "FALSE_INTERRUPTION",
                    "isInterruption": bool(getattr(ev, "is_interruption", True)),
                },
            )
        )

    @session.on("close")
    def on_close(ev) -> None:
        persist(backend.tool("record_event", {"eventType": "AGENT_LEFT", "reason": str(ev)}))

    await session.start(agent=agent, room=ctx.room)
    await ctx.connect()
    await session.generate_reply(
        instructions=(
            "Greet briefly, say you are an AI participant, mention the conversation is recorded, "
            "then start from the recommended next action."
        )
    )


if __name__ == "__main__":
    cli.run_app(server)
