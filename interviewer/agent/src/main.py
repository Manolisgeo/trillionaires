"""Kimma interviewer voice agent (livekit-agents 1.8)."""
from __future__ import annotations

import asyncio
import json
import logging
import sys
import time
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))

from config import (load_env, load_settings, missing_keys, session_kwargs, silero)  # noqa: E402

load_env()

from livekit import rtc  # noqa: E402
from livekit.agents import Agent, AgentServer, AgentSession, JobContext, JobProcess, cli  # noqa: E402
from livekit.agents.voice import room_io  # noqa: E402

from backend import BackendClient, Recorder, parse_iso  # noqa: E402
from browser import AgentBrowser  # noqa: E402
from prompts import base_instructions, build_phase_instructions, opening_line  # noqa: E402
from state import InterviewState  # noqa: E402
from tools import Desk, Runtime, build_tools, link_domains  # noqa: E402

log = logging.getLogger("kimma.agent")
SETTINGS = load_settings()
LATE_JOIN_DELAY_S = 1.0
server = AgentServer(setup_fnc=lambda proc: proc.userdata.__setitem__("vad", silero.VAD.load()))


def interview_id_of(ctx: JobContext) -> str:
    for raw in (getattr(ctx.job, "metadata", None), getattr(ctx.room, "metadata", None)):
        if raw:
            try:
                iid = json.loads(raw).get("interviewId")
                if iid:
                    return str(iid)
            except (json.JSONDecodeError, AttributeError):
                pass
    name = ctx.room.name
    return name.removeprefix("interview-")


@server.rtc_session(agent_name=SETTINGS.agent_name)
async def interview(ctx: JobContext) -> None:
    s = load_settings()
    iid = interview_id_of(ctx)
    ctx.log_context_fields = {"interviewId": iid, "room": ctx.room.name}

    try:
        missing = missing_keys(s)
    except ValueError as e:
        log.error("agent not starting: %s", e)
        ctx.shutdown("bad config")
        return
    if missing:
        log.error("agent not starting for interview %s: missing env keys for selected providers: %s "
                  "(VOICE_MODE=%s INTERVIEWER_LLM=%s TTS_PROVIDER=%s)", iid, ", ".join(missing),
                  s.voice_mode, s.llm, s.tts_provider)
        ctx.shutdown("missing keys")
        return

    backend = BackendClient(s.base_url, s.internal_secret, iid)
    try:
        ictx = await backend.context()
    except Exception:
        log.exception("cannot load interview context for %s", iid)
        await backend.aclose()
        ctx.shutdown("no context")
        return

    interview_d, candidate = ictx["interview"], ictx["candidate"]
    ictx.setdefault("publicBaseUrl", s.base_url)
    state = InterviewState.from_plan(interview_d.get("plan") or {})
    browser = AgentBrowser(s.keys.get("BROWSERBASE_API_KEY", ""), s.keys.get("BROWSERBASE_PROJECT_ID", ""))
    prewarm_task = asyncio.create_task(browser.prewarm())  # warm start

    await ctx.connect()
    started = await backend.start()
    started_epoch = parse_iso(started.get("startedAt"))
    rec = Recorder(backend, started_epoch)
    rec.start()
    desk = Desk(ctx.room, rec)

    ended = False
    lock = asyncio.Lock()
    session = AgentSession(**session_kwargs(s, ctx.proc.userdata.get("vad")))

    async def phase_msg() -> None:
        await desk.send({"type": "phase", "phase": state.current.phase, "index": state.index,
                         "total": state.total, "endsAt": state.ends_at_ms()})

    async def refresh_instructions() -> None:
        await agent.update_instructions(build_phase_instructions(state, ictx, time.time()))

    async def advance(speak: bool = False) -> None:
        async with lock:
            if ended or not state.advance(time.time()):
                return
            await desk.send({"type": "cv.clear"})
            await desk.send({"type": "screen", "view": "idle"})
            await refresh_instructions()
            await phase_msg()
            if speak:
                session.generate_reply(instructions="Transition naturally in one sentence to the next part, then ask its first question.")

    async def end(reason: str) -> None:
        nonlocal ended
        if ended:
            return
        ended = True
        state.ended = True
        try:
            sp = session.current_speech
            if sp is not None and reason == "agent_completed":
                await asyncio.wait_for(sp.wait_for_playout(), 20)
            await asyncio.sleep(1.5 if reason == "agent_completed" else 0)
        except Exception:
            pass
        await rec.close()
        try:
            await backend.end(reason)
        except Exception:
            log.exception("end call failed")
        await desk.send({"type": "ended", "reportUrl": f"{s.base_url}/reports/{iid}"})
        prewarm_task.cancel()
        await browser.close()
        await backend.aclose()
        ctx.shutdown(reason)

    rt = Runtime(state=state, ctx=ictx, desk=desk, backend=backend, rec=rec, browser=browser,
                 on_advance=lambda: advance(False), on_end=end, domains=link_domains(candidate))
    if candidate.get("githubHandle"):
        rt.domains.add("github.com")
    agent = Agent(instructions=base_instructions(ictx), tools=build_tools(rt))

    # --- transcript capture ---
    marks = {"user_start": time.time(), "agent_start": time.time(), "last_user_end": started_epoch}

    @session.on("user_state_changed")
    def _u(ev) -> None:
        if ev.new_state == "speaking":
            marks["user_start"] = ev.created_at

    @session.on("agent_state_changed")
    def _a(ev) -> None:
        if ev.new_state == "speaking":
            marks["agent_start"] = ev.created_at

    @session.on("user_input_transcribed")
    def _t(ev) -> None:
        if ev.is_final and ev.transcript.strip():
            start = max(marks["user_start"], marks["last_user_end"])
            marks["last_user_end"] = ev.created_at
            rec.segment("candidate", ev.transcript, start, ev.created_at)

    @session.on("conversation_item_added")
    def _c(ev) -> None:
        item = ev.item
        if getattr(item, "type", "") == "message" and item.role == "assistant":
            text = item.text_content
            if text and text.strip():
                rec.segment("agent", text, marks["agent_start"], item.created_at)

    @session.on("close")
    def _close(ev) -> None:
        asyncio.create_task(end("session_closed"))

    # --- candidate controls ---
    async def handle_control(reader: rtc.TextStreamReader) -> None:
        try:
            msg = json.loads(await reader.read_all())
        except Exception:
            return
        kind = msg.get("type")
        rec.event("control", msg)
        if kind == "finished_answering":
            state.finished_answering = True
            try:
                session.commit_user_turn()
            except Exception:
                log.warning("commit_user_turn failed", exc_info=True)
        elif kind == "request_human":
            rec.note(None, "Candidate asked for a human to take over / review.")
            session.say("Of course. I've noted that you'd like a person involved, and a human will follow up. "
                        "Would you like to stop here, or continue for now?")
        elif kind == "integrity":
            pass  # logged as an event above; the web client also posts it to the API

    def on_control(reader: rtc.TextStreamReader, participant_identity: str) -> None:
        asyncio.create_task(handle_control(reader))

    ctx.room.register_text_stream_handler("control", on_control)

    # --- late join: re-send the latest desk state to whoever connects after it was sent ---
    async def resend_desk(identity: str) -> None:
        await asyncio.sleep(LATE_JOIN_DELAY_S)  # let the client register its "desk" handler first
        await desk.resend_to(identity)

    @ctx.room.on("participant_connected")
    def _joined(participant: rtc.RemoteParticipant) -> None:
        if participant.kind == rtc.ParticipantKind.PARTICIPANT_KIND_AGENT:
            return
        asyncio.create_task(resend_desk(participant.identity))

    # --- start ---
    room_opts = room_io.RoomOptions(
        participant_identity=(f"bridge-{iid}" if interview_d.get("mode") == "meet" else f"candidate-{iid}"))
    await session.start(agent=agent, room=ctx.room, room_options=room_opts)
    state.start(time.time())
    await refresh_instructions()
    await phase_msg()
    await desk.send({"type": "screen", "view": "idle"})

    async def announce_browser_when_ready() -> None:
        await prewarm_task
        await rt.announce_browser()

    asyncio.create_task(announce_browser_when_ready())

    session.say(opening_line(candidate.get("name", ""), ictx["role"].get("title", "this role"),
                             ictx["role"].get("company", "the company")), allow_interruptions=False)

    # --- phase clock ---
    wrap_sent = False
    while not ended:
        await asyncio.sleep(2)
        now = time.time()
        idle = session.agent_state in ("listening", "idle") and session.user_state != "speaking"
        if state.should_advance(now) and idle:
            await advance(speak=True)
        elif state.is_last and state.deadline and now >= state.deadline and idle and not wrap_sent:
            wrap_sent = True
            session.generate_reply(instructions="Time is up. Thank the candidate, explain a human will review, and call end_interview.")
        elif state.is_last and state.deadline and now >= state.deadline + 90:
            await end("time_limit")


if __name__ == "__main__":
    cli.run_app(server)
