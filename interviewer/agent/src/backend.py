"""httpx client for the internal API + batched transcript/event uploader."""
from __future__ import annotations

import asyncio
import logging
import secrets
import time
from datetime import datetime
from typing import Any

import httpx

log = logging.getLogger("aperture.backend")


def new_id() -> str:
    return secrets.token_urlsafe(6)


def parse_iso(ts: str | None) -> float:
    if not ts:
        return time.time()
    return datetime.fromisoformat(ts.replace("Z", "+00:00")).timestamp()


class BackendClient:
    def __init__(self, base_url: str, secret: str, interview_id: str) -> None:
        self.base = f"{base_url.rstrip('/')}/api/internal/interviews/{interview_id}"
        self.interview_id = interview_id
        self._http = httpx.AsyncClient(timeout=20.0, headers={"Authorization": f"Bearer {secret}"})

    async def _req(self, method: str, path: str, json: Any = None, retries: int = 3) -> Any:
        err: Exception | None = None
        for i in range(retries):
            try:
                r = await self._http.request(method, f"{self.base}{path}", json=json)
                r.raise_for_status()
                return r.json() if r.content else {}
            except httpx.HTTPError as e:
                err = e
                await asyncio.sleep(0.4 * (i + 1))
        assert err is not None
        raise err

    async def context(self) -> dict[str, Any]:
        return await self._req("GET", "/context")

    async def start(self) -> dict[str, Any]:
        return await self._req("POST", "/start", {})

    async def post_transcript(self, segments: list[dict[str, Any]]) -> None:
        await self._req("POST", "/transcript", {"segments": segments})

    async def post_events(self, events: list[dict[str, Any]]) -> None:
        await self._req("POST", "/events", {"events": events})

    async def post_evidence(self, notes: list[dict[str, Any]]) -> None:
        await self._req("POST", "/evidence", {"notes": notes})

    async def board(self) -> dict[str, Any]:
        return await self._req("GET", "/board")

    async def end(self, reason: str) -> None:
        await self._req("POST", "/end", {"reason": reason})

    async def get_bytes(self, url: str) -> bytes | None:
        try:
            r = await self._http.get(url)
            r.raise_for_status()
            return r.content
        except httpx.HTTPError:
            return None

    async def aclose(self) -> None:
        await self._http.aclose()


class Batcher:
    """Collects items and flushes them every `interval` seconds (and on close)."""

    def __init__(self, name: str, send, interval: float = 2.0) -> None:
        self.name, self._send, self.interval = name, send, interval
        self._buf: list[dict[str, Any]] = []
        self._task: asyncio.Task | None = None

    def add(self, item: dict[str, Any]) -> None:
        self._buf.append(item)

    def start(self) -> None:
        self._task = asyncio.create_task(self._loop())

    async def _loop(self) -> None:
        while True:
            await asyncio.sleep(self.interval)
            await self.flush()

    async def flush(self) -> None:
        if not self._buf:
            return
        batch, self._buf = self._buf, []
        try:
            await self._send(batch)
        except Exception:
            log.warning("%s flush failed, will retry %d items", self.name, len(batch))
            self._buf = batch + self._buf

    async def close(self) -> None:
        if self._task:
            self._task.cancel()
        await self.flush()


class Recorder:
    """Transcript segments + desk events, with times relative to startedAt (seconds)."""

    def __init__(self, backend: BackendClient, started_at_epoch: float) -> None:
        self.t0 = started_at_epoch
        self.segments = Batcher("transcript", backend.post_transcript)
        self.events = Batcher("events", backend.post_events)
        self.evidence = Batcher("evidence", backend.post_evidence)
        self._seq = 0
        self.last_candidate_segment: str | None = None

    def rel(self, epoch: float | None = None) -> float:
        return round((epoch if epoch is not None else time.time()) - self.t0, 2)

    def start(self) -> None:
        for b in (self.segments, self.events, self.evidence):
            b.start()

    def segment(self, speaker: str, text: str, start_epoch: float, end_epoch: float) -> str:
        sid = new_id()
        start = max(0.0, self.rel(start_epoch))
        self.segments.add({"id": sid, "speaker": speaker, "text": text.strip(),
                           "start": start, "end": max(start, self.rel(end_epoch))})
        if speaker == "candidate":
            self.last_candidate_segment = sid
        return sid

    def event(self, type_: str, payload: Any) -> None:
        self._seq += 1
        self.events.add({"seq": self._seq, "t": self.rel(), "type": type_, "payload": payload})

    def note(self, criterion_id: str | None, note: str) -> None:
        self.evidence.add({"id": new_id(), "t": self.rel(), "competencyId": criterion_id,
                           "skillId": None, "note": note, "segmentId": self.last_candidate_segment})

    async def close(self) -> None:
        for b in (self.segments, self.events, self.evidence):
            await b.close()
