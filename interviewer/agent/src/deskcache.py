"""Last desk state, kept so a participant who joins late can be brought up to date."""
from __future__ import annotations

import json
from typing import Any

# Order matters: the client needs the phase before the question, and the screen after what it shows.
_ORDER = ("phase", "question", "cv", "browser.session", "browser.navigated", "screen")


def _slot(msg_type: str) -> str | None:
    if msg_type in ("cv.highlight", "cv.clear"):
        return "cv"  # the latest of the two wins
    return msg_type if msg_type in _ORDER else None


class DeskCache:
    """Remembers the latest message per slot: phase, screen, question, cv (highlight or clear), browser.*."""

    def __init__(self) -> None:
        self._last: dict[str, dict[str, Any]] = {}

    def update(self, msg: dict[str, Any]) -> None:
        slot = _slot(str(msg.get("type", "")))
        if slot:
            self._last[slot] = dict(msg)

    def messages(self) -> list[dict[str, Any]]:
        """Cached messages in replay order. A new question replaces the old one but keeps the CV state it came with."""
        return [dict(self._last[k]) for k in _ORDER if k in self._last]

    def payloads(self) -> list[str]:
        return [json.dumps(m) for m in self.messages()]
