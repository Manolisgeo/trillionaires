"""Agent browser: Browserbase cloud session driven by Playwright over CDP.

Without BROWSERBASE_* keys everything degrades to "navigated only" (client shows a link card).
"""
from __future__ import annotations

import logging
from urllib.parse import urlencode, urlparse, urlunparse, parse_qsl

import httpx

log = logging.getLogger("aperture.browser")
API = "https://api.browserbase.com/v1"

_HIGHLIGHT_JS = r"""
(needle) => {
  document.querySelectorAll('mark[data-aperture]').forEach(m => {
    const p = m.parentNode; p.replaceChild(document.createTextNode(m.textContent), m); p.normalize();
  });
  const norm = s => s.replace(/\s+/g, ' ').trim().toLowerCase();
  const target = norm(needle);
  if (!target) return false;
  const style = 'background:#ffd54a;color:#111;outline:3px solid #ff9800;border-radius:3px;padding:0 2px;';
  const tryFind = (t) => {
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      const p = n.parentElement;
      if (!p || /^(SCRIPT|STYLE|NOSCRIPT)$/.test(p.tagName)) continue;
      const idx = n.textContent.toLowerCase().indexOf(t);
      if (idx >= 0) {
        const r = document.createRange(); r.setStart(n, idx); r.setEnd(n, idx + t.length);
        const mk = document.createElement('mark'); mk.setAttribute('data-aperture', '1'); mk.style.cssText = style;
        r.surroundContents(mk); mk.scrollIntoView({block: 'center', behavior: 'smooth'}); return true;
      }
    }
    return false;
  };
  if (tryFind(target)) return true;
  const words = target.split(' ');
  if (words.length > 4 && tryFind(words.slice(0, 4).join(' '))) return true;
  // fallback: smallest element whose text contains the phrase
  let best = null;
  for (const el of document.body.querySelectorAll('*')) {
    if (norm(el.textContent || '').includes(target) && (!best || el.textContent.length < best.textContent.length)) best = el;
  }
  if (best) { best.style.cssText += ';' + style; best.scrollIntoView({block: 'center', behavior: 'smooth'}); return true; }
  return false;
}
"""


def with_query(url: str, **params: str) -> str:
    p = urlparse(url)
    q = dict(parse_qsl(p.query))
    q.update(params)
    return urlunparse(p._replace(query=urlencode(q)))


class AgentBrowser:
    def __init__(self, api_key: str = "", project_id: str = "") -> None:
        self.api_key, self.project_id = api_key, project_id
        self.session_id: str | None = None
        self.live_view_url: str | None = None
        self._pw = None
        self._browser = None
        self._page = None

    @property
    def available(self) -> bool:
        return bool(self.api_key and self.project_id)

    @property
    def ready(self) -> bool:
        return self._page is not None

    async def prewarm(self) -> str | None:
        """Create the session, connect Playwright, return the live view URL (None on failure/no keys)."""
        if not self.available or self.ready:
            return self.live_view_url
        try:
            h = {"X-BB-API-Key": self.api_key}
            async with httpx.AsyncClient(timeout=30.0, headers=h) as c:
                r = await c.post(f"{API}/sessions", json={
                    "projectId": self.project_id,
                    "browserSettings": {"viewport": {"width": 1280, "height": 720}}})
                r.raise_for_status()
                s = r.json()
                self.session_id = s["id"]
                d = await c.get(f"{API}/sessions/{self.session_id}/debug")
                d.raise_for_status()
                self.live_view_url = with_query(d.json()["debuggerFullscreenUrl"], navbar="false")
            from playwright.async_api import async_playwright

            self._pw = await async_playwright().start()
            self._browser = await self._pw.chromium.connect_over_cdp(s["connectUrl"])
            ctx = self._browser.contexts[0] if self._browser.contexts else await self._browser.new_context()
            self._page = ctx.pages[0] if ctx.pages else await ctx.new_page()
            return self.live_view_url
        except Exception:
            log.exception("Browserbase prewarm failed; falling back to link cards")
            await self.close()
            self.live_view_url = None
            self.api_key = ""  # stop retrying
            return None

    async def open(self, url: str) -> tuple[str, str]:
        """Navigate. Returns (final_url, title); title is '' when no live browser."""
        if not self.ready:
            await self.prewarm()
        if not self.ready:
            return url, ""
        try:
            await self._page.goto(url, wait_until="domcontentloaded", timeout=20000)
            return self._page.url, await self._page.title()
        except Exception as e:
            log.warning("goto failed: %s", e)
            return url, ""

    async def highlight(self, text: str) -> bool:
        if not self.ready:
            return False
        try:
            return bool(await self._page.evaluate(_HIGHLIGHT_JS, text))
        except Exception as e:
            log.warning("highlight failed: %s", e)
            return False

    async def scroll(self, direction: str) -> bool:
        if not self.ready:
            return False
        dy = {"down": 500, "up": -500, "top": -100000, "bottom": 100000}.get(direction, 500)
        try:
            await self._page.evaluate("dy => window.scrollBy({top: dy, behavior: 'smooth'})", dy)
            return True
        except Exception:
            return False

    async def close(self) -> None:
        try:
            if self._browser:
                await self._browser.close()
            if self._pw:
                await self._pw.stop()
        except Exception:
            pass
        self._browser = self._pw = self._page = None
        if self.session_id and self.project_id:
            try:
                async with httpx.AsyncClient(timeout=10.0, headers={"X-BB-API-Key": self.api_key}) as c:
                    await c.post(f"{API}/sessions/{self.session_id}",
                                 json={"projectId": self.project_id, "status": "REQUEST_RELEASE"})
            except Exception:
                pass
        self.session_id = None
