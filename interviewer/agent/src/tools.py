"""Function tools for the interviewer + the Runtime they operate on."""
from __future__ import annotations

import asyncio
import base64
import json
import logging
import os
import time
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable
from urllib.parse import urlparse

from livekit.agents import RunContext, function_tool

from backend import BackendClient, Recorder
from browser import AgentBrowser
from deskcache import DeskCache
from state import InterviewState

log = logging.getLogger("aperture.tools")
SHAPE_KINDS = {"rect", "ellipse", "text", "arrow"}
ALWAYS_ALLOWED = ("github.com", "gist.github.com")


def host_allowed(url: str, extra_domains: set[str]) -> bool:
    """https/http only; github.com, gist.github.com and the candidate's own link domains (and subdomains)."""
    try:
        u = urlparse(url)
    except ValueError:
        return False
    if u.scheme not in ("http", "https") or not u.hostname:
        return False
    h = u.hostname.lower().removeprefix("www.")
    allowed = set(ALWAYS_ALLOWED) | {d.lower().removeprefix("www.") for d in extra_domains}
    return any(h == d or h.endswith("." + d) for d in allowed)


def link_domains(candidate: dict[str, Any]) -> set[str]:
    out: set[str] = set()
    for link in candidate.get("links") or []:
        try:
            host = urlparse(link if "://" in link else f"https://{link}").hostname
        except ValueError:
            host = None
        if host:
            out.add(host.lower().removeprefix("www."))
    return out


class Desk:
    """Sends DeskMsg JSON on topic 'desk', records each as an event and caches the latest state for late joiners."""

    def __init__(self, room, recorder: Recorder) -> None:
        self.room, self.rec = room, recorder
        self.cache = DeskCache()

    async def send(self, msg: dict[str, Any]) -> None:
        self.cache.update(msg)
        self.rec.event(msg["type"], {k: v for k, v in msg.items() if k != "type"})
        try:
            await self.room.local_participant.send_text(json.dumps(msg), topic="desk")
        except Exception:
            log.warning("desk send failed: %s", msg.get("type"), exc_info=True)

    async def resend_to(self, identity: str) -> None:
        """Bring one participant (who joined after these were sent) up to date. Not recorded as events."""
        for payload in self.cache.payloads():
            try:
                await self.room.local_participant.send_text(payload, topic="desk", destination_identities=[identity])
            except Exception:
                log.warning("desk resend to %s failed", identity, exc_info=True)
                return


@dataclass
class Runtime:
    state: InterviewState
    ctx: dict[str, Any]
    desk: Desk
    backend: BackendClient
    rec: Recorder
    browser: AgentBrowser
    on_advance: Callable[[], Awaitable[None]]
    on_end: Callable[[str], Awaitable[None]]
    domains: set[str] = field(default_factory=set)
    browser_announced: bool = False

    async def announce_browser(self) -> None:
        if not self.browser_announced:
            self.browser_announced = True
            await self.desk.send({"type": "browser.session", "liveViewUrl": self.browser.live_view_url})

    async def navigate(self, url: str) -> str:
        if self.browser.available:
            await self.browser.prewarm()
        await self.announce_browser()
        final, title = await self.browser.open(url)
        await self.desk.send({"type": "screen", "view": "browser"})
        await self.desk.send({"type": "browser.navigated", "url": final, "title": title})
        return title

    async def highlight_cv(self, quote: str, note: str | None, page: int | None = None, qid: str | None = None) -> None:
        await self.desk.send({"type": "screen", "view": "cv"})
        msg: dict[str, Any] = {"type": "cv.highlight", "id": qid or f"h{int(time.time() * 1000)}", "quote": quote}
        if page:
            msg["page"] = page
        if note:
            msg["note"] = note
        await self.desk.send(msg)


async def _describe_png(rt: Runtime, png_url: str) -> str | None:
    if not os.environ.get("ANTHROPIC_API_KEY"):
        return None
    full = png_url if png_url.startswith("http") else rt.ctx.get("publicBaseUrl", "").rstrip("/") + png_url
    data = await rt.backend.get_bytes(full)
    if not data:
        return None
    try:
        from anthropic import AsyncAnthropic  # no temperature/top_p: rejected by current models

        r = await AsyncAnthropic().messages.create(
            model=os.environ.get("PREP_MODEL", "claude-sonnet-5-5"), max_tokens=500,
            messages=[{"role": "user", "content": [
                {"type": "image", "source": {"type": "base64", "media_type": "image/png",
                                             "data": base64.b64encode(data).decode()}},
                {"type": "text", "text": "Describe this whiteboard drawing factually in under 120 words: boxes, labels, arrows and how they connect."}]}])
        return "".join(b.text for b in r.content if getattr(b, "type", "") == "text") or None
    except Exception:
        log.warning("board vision call failed", exc_info=True)
        return None


def build_tools(rt: Runtime) -> list:
    @function_tool
    async def show_question(context: RunContext, text: str, kind: str = "core", question_id: str | None = None) -> str:
        """Show the question on the candidate's screen. Call right before asking it aloud.
        kind is 'core' or 'probe'. Pass question_id for a planned question; its CV/page source is highlighted first."""
        q = rt.state.find_question(question_id)
        if q and q.get("source"):
            src = q["source"]
            if src.get("kind") == "cv" or (src.get("kind") in ("linkedin",) and not src.get("url")):
                await rt.highlight_cv(src.get("quote", ""), q.get("text"), src.get("page"), q["id"])
            elif src.get("url") and host_allowed(src["url"], rt.domains):
                await rt.navigate(src["url"])
                if src.get("quote"):
                    await rt.browser.highlight(src["quote"])
        rt.state.mark_asked(question_id)
        await rt.desk.send({"type": "question", "text": text, "kind": "probe" if kind == "probe" else "core"})
        return "Question shown. Now ask it aloud and wait."

    @function_tool
    async def open_cv(context: RunContext) -> str:
        """Show the candidate's CV on the agent screen."""
        await rt.desk.send({"type": "screen", "view": "cv"})
        return "CV is on screen."

    @function_tool
    async def highlight_cv(context: RunContext, quote: str, note: str = "") -> str:
        """Highlight an exact line of the CV (verbatim quote) before asking about it."""
        await rt.highlight_cv(quote, note or None)
        return "Highlighted. Ask your question now."

    @function_tool
    async def clear_cv(context: RunContext) -> str:
        """Remove CV highlights."""
        await rt.desk.send({"type": "cv.clear"})
        return "Cleared."

    @function_tool
    async def open_url(context: RunContext, url: str) -> str:
        """Open a page in the agent browser. Only github.com, gist.github.com and the candidate's own links are allowed."""
        if not host_allowed(url, rt.domains):
            return "Refused: that site is not on the allowlist (GitHub or the candidate's own links only)."
        title = await rt.navigate(url)
        return f"Opened {url}" + (f" ({title})" if title else "") + ("" if rt.browser.ready else " (shown as a link card; no live browser)")

    @function_tool
    async def highlight_on_page(context: RunContext, text: str) -> str:
        """Highlight text on the page currently open in the agent browser, then ask about it."""
        ok = await rt.browser.highlight(text)
        return "Highlighted." if ok else "Could not highlight (no live browser or text not found)."

    @function_tool
    async def scroll_page(context: RunContext, direction: str = "down") -> str:
        """Scroll the agent browser: down, up, top or bottom."""
        return "Scrolled." if await rt.browser.scroll(direction) else "No live browser to scroll."

    @function_tool
    async def read_board(context: RunContext) -> dict[str, Any]:
        """Read the shared whiteboard summary, the text pad, and a description of freehand drawings."""
        try:
            b = await rt.backend.board()
        except Exception:
            return {"error": "board unavailable"}
        out: dict[str, Any] = {"summary": b.get("summary", ""), "padText": b.get("padText", "")}
        if b.get("pngUrl"):
            desc = await _describe_png(rt, b["pngUrl"])
            if desc:
                out["drawingDescription"] = desc
        return out

    @function_tool
    async def draw_on_board(context: RunContext, shapes: list[dict[str, Any]]) -> str:
        """Draw simple shapes on the whiteboard. Each: kind (rect|ellipse|text|arrow), x, y, optional w, h, label, toX, toY. Canvas about 1000x600."""
        clean: list[dict[str, Any]] = []
        for s in shapes[:20]:
            if s.get("kind") not in SHAPE_KINDS:
                continue
            try:
                item = {"kind": s["kind"], "x": float(s["x"]), "y": float(s["y"])}
                for k in ("w", "h", "toX", "toY"):
                    if s.get(k) is not None:
                        item[k] = float(s[k])
            except (KeyError, TypeError, ValueError):
                continue
            if s.get("label"):
                item["label"] = str(s["label"])[:80]
            clean.append(item)
        if not clean:
            return "No valid shapes."
        await rt.desk.send({"type": "board.add", "shapes": clean})
        return f"Drew {len(clean)} shape(s)."

    @function_tool
    async def note_evidence(context: RunContext, criterion_id: str, note: str) -> str:
        """Record a short factual evidence note for a competency or skill id, from what the candidate just said."""
        rt.state.note_evidence(criterion_id)
        rt.rec.note(criterion_id, note)
        return "Noted."

    @function_tool
    async def next_phase(context: RunContext) -> str:
        """Move to the next interview phase when the current one is covered or time is up."""
        if not rt.state.is_last:
            asyncio.create_task(rt.on_advance())  # run after this tool returns so instructions refresh cleanly
            return "Moving on. Transition naturally in one sentence."
        return "Already in the final phase."

    @function_tool
    async def end_interview(context: RunContext) -> str:
        """End the interview after the closing words have been said."""
        asyncio.create_task(rt.on_end("agent_completed"))
        return "Ending. Say a brief goodbye."

    return [show_question, open_cv, highlight_cv, clear_cv, open_url, highlight_on_page,
            scroll_page, read_board, draw_on_board, note_evidence, next_phase, end_interview]
