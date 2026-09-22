from __future__ import annotations

import asyncio
import os
import uuid
from typing import Any

import httpx


class BackendClient:
    def __init__(self, conversation_id: str) -> None:
        self.conversation_id = conversation_id
        self.base_url = os.getenv("APP_URL", "http://localhost:3001").rstrip("/")
        self.secret = os.getenv("AGENT_INTERNAL_SECRET", "")

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.secret}",
            "Content-Type": "application/json",
        }

    async def tool(self, name: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
        url = f"{self.base_url}/api/internal/conversations/{self.conversation_id}"
        key = str(uuid.uuid4())
        headers = {**self._headers(), "Idempotency-Key": key}
        last_error: Exception | None = None
        for attempt in range(3):
            try:
                async with httpx.AsyncClient(timeout=20.0) as client:
                    response = await client.post(
                        url,
                        headers=headers,
                        json={"tool": name, "payload": payload or {}},
                    )
                    response.raise_for_status()
                    return response.json()
            except httpx.HTTPError as exc:
                last_error = exc
                await asyncio.sleep(0.4 * (attempt + 1))
        assert last_error is not None
        raise last_error

    async def snapshot(self) -> dict[str, Any]:
        url = f"{self.base_url}/api/internal/conversations/{self.conversation_id}"
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.get(url, headers=self._headers())
            response.raise_for_status()
            return response.json()
