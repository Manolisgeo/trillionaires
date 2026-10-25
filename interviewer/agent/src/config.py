"""Env-driven settings and provider construction.

Plugin modules are imported at module top level on purpose: livekit plugins must be
registered on the main thread before job processes are spawned.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

from livekit.plugins import cartesia, deepgram, elevenlabs, openai, silero  # noqa: F401
from livekit.plugins import anthropic as anthropic_plugin
from livekit.plugins.turn_detector.multilingual import MultilingualModel

ROOT_ENV = Path(__file__).resolve().parents[2] / ".env"


def load_env() -> None:
    load_dotenv(ROOT_ENV)


@dataclass(frozen=True)
class Settings:
    voice_mode: str = "cascade"
    llm: str = "openai:gpt-4.1-mini"
    tts_provider: str = "cartesia"
    deepgram_model: str = "nova-3"
    realtime_model: str = "gpt-realtime"
    agent_name: str = "kimma-interviewer"
    base_url: str = "http://localhost:3000"
    internal_secret: str = ""
    cartesia_voice_id: str = ""
    keys: dict[str, str] = field(default_factory=dict)

    @property
    def llm_provider(self) -> str:
        return self.llm.split(":", 1)[0] if ":" in self.llm else "openai"

    @property
    def llm_model(self) -> str:
        return self.llm.split(":", 1)[1] if ":" in self.llm else self.llm

    def has(self, key: str) -> bool:
        return bool(self.keys.get(key))


_KEYS = [
    "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "DEEPGRAM_API_KEY", "CARTESIA_API_KEY",
    "ELEVENLABS_API_KEY", "BROWSERBASE_API_KEY", "BROWSERBASE_PROJECT_ID",
]


def load_settings(env: dict[str, str] | None = None) -> Settings:
    e = dict(os.environ) if env is None else env
    g = lambda k, d="": (e.get(k) or d).strip()  # noqa: E731
    return Settings(
        voice_mode=g("VOICE_MODE", "cascade").lower(),
        llm=g("INTERVIEWER_LLM", "openai:gpt-4.1-mini"),
        tts_provider=g("TTS_PROVIDER", "cartesia").lower(),
        deepgram_model=g("DEEPGRAM_MODEL", "nova-3"),
        realtime_model=g("OPENAI_REALTIME_MODEL", "gpt-realtime"),
        agent_name=g("LIVEKIT_AGENT_NAME", "kimma-interviewer"),
        base_url=g("PUBLIC_BASE_URL", "http://localhost:3000").rstrip("/"),
        internal_secret=g("AGENT_INTERNAL_SECRET"),
        cartesia_voice_id=g("CARTESIA_VOICE_ID"),
        keys={k: g(k) for k in _KEYS},
    )


def missing_keys(s: Settings) -> list[str]:
    """Env keys required by the selected providers that are not set."""
    need: list[str] = []
    if s.voice_mode == "openai_realtime":
        need.append("OPENAI_API_KEY")
    elif s.voice_mode == "cascade":
        need.append("DEEPGRAM_API_KEY")
        need.append("ANTHROPIC_API_KEY" if s.llm_provider == "anthropic" else "OPENAI_API_KEY")
        need.append({
            "cartesia": "CARTESIA_API_KEY",
            "elevenlabs": "ELEVENLABS_API_KEY",
            "openai": "OPENAI_API_KEY",
        }.get(s.tts_provider, "CARTESIA_API_KEY"))
    else:
        raise ValueError(f"unknown VOICE_MODE {s.voice_mode!r} (cascade|openai_realtime)")
    if s.tts_provider not in ("cartesia", "elevenlabs", "openai") and s.voice_mode == "cascade":
        raise ValueError(f"unknown TTS_PROVIDER {s.tts_provider!r}")
    missing = sorted({k for k in need if not s.keys.get(k)})
    if not s.internal_secret:
        missing.append("AGENT_INTERNAL_SECRET")
    return missing


# Mercor-style endpointing: answer fast, but tolerate thinking pauses.
TURN_HANDLING = {
    "endpointing": {"mode": "fixed", "min_delay": 0.5, "max_delay": 1.6},
    "interruption": {
        "enabled": True,
        "min_duration": 0.6,
        "resume_false_interruption": True,
        "false_interruption_timeout": 1.5,
    },
    "preemptive_generation": {"enabled": True},
}


def build_llm(s: Settings):
    if s.llm_provider == "anthropic":
        # Never pass temperature to Anthropic models.
        return anthropic_plugin.LLM(model=s.llm_model)
    return openai.LLM(model=s.llm_model)


def build_tts(s: Settings):
    if s.tts_provider == "elevenlabs":
        return elevenlabs.TTS(api_key=s.keys["ELEVENLABS_API_KEY"])
    if s.tts_provider == "openai":
        return openai.TTS(voice="ash")
    kw = {"voice": s.cartesia_voice_id} if s.cartesia_voice_id else {}
    return cartesia.TTS(**kw)


def session_kwargs(s: Settings, vad) -> dict:
    """Keyword args for AgentSession for the selected VOICE_MODE."""
    if s.voice_mode == "openai_realtime":
        return {
            "llm": openai.realtime.RealtimeModel(model=s.realtime_model, voice="marin"),
            "turn_handling": {k: v for k, v in TURN_HANDLING.items() if k != "preemptive_generation"},
        }
    return {
        "stt": deepgram.STT(model=s.deepgram_model, language="en-US"),
        "llm": build_llm(s),
        "tts": build_tts(s),
        "vad": vad,
        "turn_handling": {**TURN_HANDLING, "turn_detection": MultilingualModel()},
    }
