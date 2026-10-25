# Kimma.ai — AI Interviewer Stack Decision

**Scope:** the AI interviewer only (lower scope than lantern.md). The agent joins a live
call, talks, and has its "own computer" that it screen-shares — opening the candidate's CV,
highlighting parts, and asking about them.
**Date:** 2026-10-24 · **Grounded in:** `research/competitors-51-rea/STACK.md` (51 RE'd
competitors) + a fresh 2026 vendor scan.

Confidence tags: **[V]** vendor-verified in the scan · **[E]** estimate/arithmetic ·
**[verify]** plausible but needs a 5-min check on the vendor's current pricing/SKU page
(the scan produced some version numbers that must not be quoted externally).

---

## 0. The one idea that makes this tractable: the **Agent Desk**

"The agent has its own virtual computer and shares its screen" sounds like it needs a VM.
It doesn't — and a VM would actually make the *CV* part worse. Instead:

> Build **one renderer** — a web page ("Agent Desk") that shows the CV and paints highlights
> from stable `block_id`s — and present it **two ways**:
>
> - **S0 — co-browse canvas (the system of record).** The candidate's own browser renders
>   the Agent Desk. The agent drives it with structured events (`highlight`, `scroll_to`,
>   `clear`) over the LiveKit **data channel / RPC** that's already open. Pixel-exact,
>   evidence-linkable, ~2–4 days, ~$0 marginal cost.
> - **Mode B — real screen-share (the "it has a computer" story).** A headless-Chromium
>   **sidecar** loads the *same* Agent Desk URL and publishes it as a **screen-share video
>   track** into the call (Playwright `page.screencast` → LiveKit `VideoSource`). The
>   candidate literally sees "the AI's screen." Week-2 work, same renderer.

A real desktop VM (E2B Desktop etc.) is only worth it if the agent must operate **arbitrary
software** (IDE, terminal, the candidate's live portfolio). For a CV, a DOM we control gives
exact, loggable highlights; pixel-level computer-use costs *seconds per action* against a
~700 ms turn budget. **Start without a VM.**

### Co-browse canvas vs. real VM broadcast

| | **S0 co-browse canvas** (recommended default) | **Real VM / screen broadcast** |
|---|---|---|
| Candidate sees | CV rendered in their client, annotations painted locally | Video of a remote screen (track or iframe) |
| Transport | LiveKit RPC / data (already connected) | Video track + ingress, or vendor iframe |
| Highlight precision | Pixel-exact via `block_id` + PDF.js text layer | Exact only if we control the DOM; mouse-driven is fuzzy |
| Cost / effort | ~2–4 days, ~$0/min | Frame pump + sandbox lifecycle + bitrate; 1–2 wks+ |
| Recording | Re-render from the logged event stream | Egress records the track directly |
| "Agent has a computer" wow | Medium (it's driving your screen) | High (its own screen in the call) |

**Decision:** S0 is the product and the system of record; Mode B is a second presentation of
the same page for the demo wow-factor. Ship S0 first; add Mode B in week 2.

---

## 1. Data flow

```
 CANDIDATE BROWSER (Next.js + livekit-client + PDF.js "Agent Desk")
        |  mic/cam            ^ agent audio       ^ (Mode B) desk screen-share track
        v                     |                   |
 +--------------------------------------------------------------+
 |                       LIVEKIT CLOUD ROOM                      |
 |   candidate  <->  agent (voice)    desk-sidecar (video only)  |
 +--------------------------------------------------------------+
        |  audio in/out             ^ RPC: desk.highlight / scroll / clear
        v                           | RPC: desk.ack {seq, rendered_at}
 AGENT WORKER (Python, LiveKit Agents)
   STT -> LLM(+tools) -> TTS,  LiveKit turn detector + adaptive interruption
        |  tools: highlight(block_id|quote, style), scroll_to(page), note(), clear()
        |  LLM context: CV JSON with stable block_ids (DOM/state, NOT screenshots)
        v
   EVENT LOG (Postgres): transcript spans + desk events (seq, block_id, ts)
        -> evidence links; replay page re-renders from events

 UPLOAD TIME (async, pre-call):
   CV PDF -> Reducto/LlamaParse -> blocks {id, page, bbox, text}
          -> merge with PDF.js word index (exact-phrase fallback)
          -> CV JSON for the LLM + overlay anchors for the viewer

 MODE B (week 2): desk-sidecar container
   Chromium loads the Agent Desk URL (same RPC) -> page.screencast (5–15 fps)
   -> rtc.VideoSource(is_screencast=True) -> published as a screen-share track
```

Two sync rules so the highlight never lags the voice: the agent **highlights before it
speaks** the question, and **waits for `desk.ack`** (render-done) before talking.

---

## 2. Three variants

| | **A. Fast demo** (3–5 days) | **B. Balanced** ← recommended (2–3 wks) | **C. Owned** (5–8 wks) |
|---|---|---|---|
| Transport | LiveKit Cloud | LiveKit Cloud | LiveKit Cloud (self-host later) |
| Voice core | LiveKit Agents + one realtime model (OpenAI Realtime / Gemini Live) [verify SKU] | LiveKit Agents **cascade**: Deepgram STT + fast tool-calling LLM + Cartesia TTS + LiveKit turn detector | Same cascade + per-stage failover, tuned endpointing, optional premium full-duplex mode |
| Screen | S0 only | S0 (wk1) → sidecar screencast track (wk2) | Real VM: E2B Desktop + ffmpeg/WHIP → LiveKit Ingress |
| CV parse+annotate | PDF.js text index only; LLM quotes, fuzzy-match | **Reducto or LlamaParse** blocks+bbox + PDF.js fallback | Docling (OSS) or Reducto + OCR path for scans |
| Avatar | No | No (Simli/Anam behind a plugin, phase 2) | Optional (Anam/Tavus, with AI-disclosure) |
| Hosting | Vercel + LiveKit agent hosting | + desk sidecar container (Modal/Fly/Render) | Own containers for agents, sidecar, parser |
| ~Cost / 30-min | ~$1 [E] | **~$2–3 [E]** | ~$2–3 no face; ~$5–7 with a face [E] |
| Effort | 3–5 days, 1 eng | 2–3 wks, 1–2 eng | 5–8 wks, 2 eng (VM→LiveKit bridge is the risk) |

---

## 3. Recommended stack (Variant B)

| Layer | Pick | Why |
|---|---|---|
| Transport + agent host | **LiveKit Cloud + LiveKit Agents (Python)** | Most common transport across the 51 competitors; turn detector + interruption model included on Cloud. **You already have this plumbing** (token mint, room, agent dispatch, S3 egress). |
| STT | **Deepgram** (streaming, native endpointing) | Word-level timestamps → evidence spans. AssemblyAI is the swap. [verify price] |
| LLM | **A fast tool-calling model** (GPT-5-mini / Gemini-Flash / Claude-Haiku class) | Cheap, low-latency, good tool calls. Keep it swappable behind one interface. [verify SKU] |
| TTS | **Cartesia Sonic** | Low-latency; ElevenLabs Flash is the premium swap. [verify price] |
| Turn-taking | **LiveKit turn detector + adaptive interruption** | Leaders run cascades at ~700 ms median (Mercor, from STACK.md). |
| CV parse | **Reducto** (LlamaParse alt; Docling if OSS) | Page + bbox + source text per block, cents per CV. [verify bbox schema] |
| CV viewer + highlights | **PDF.js overlay driven by LiveKit RPC** | Deterministic, free, fully loggable. |
| Screen share | **S0 first, then Playwright screencast → `VideoSource` sidecar** | Same renderer both ways; real in-call share + egress recording, no desktop stack. |
| Avatar | **None at launch** | The CV pane *is* the differentiator; give it the screen space. |
| Not used | **Vapi / Retell** | Neither documents a video / screen-share track in the call — they'd block Mode B. |

**Why not just the existing repo?** Per your note we're designing from the research, not the
current code. The honest finding: the repo's **transport layer** (LiveKit token/room/dispatch/
egress) matches the recommendation exactly, so it's a legitimate starting point *or* a clean
reference. What changes vs. the current `apps/agent`: move off **OpenAI Realtime speech-to-
speech** to a **cascade** (research shows every disclosed leader runs cascades; cascades give
you the word-timestamps evidence-linking needs), and add the **Agent Desk** (the repo has none).

---

## 4. Build plan to a working demo

**Week 1 — voice + co-browse.** *Target: agent talks, opens the CV, highlights a bullet, asks about it.*
- D1–2: LiveKit Cloud project, Next.js room, Python cascade agent → **M1: sub-1s turns**.
- D2: run **Experiment 1** (screen-share source) in parallel — it decides Mode B's shape.
- D3–4: CV upload → Reducto parse → stored `blocks` JSON with stable `block_id`s; PDF.js viewer + overlay (box / underline / circle).
- D5: agent tools `highlight` / `scroll_to` / `note` / `clear` over RPC + `desk.ack` handshake + event log → **M2: agent highlights a bullet and asks about it; events linked to transcript spans**.

**Week 2 — real shared screen + turn tuning.**
- D6–8: Agent Desk **sidecar** (Chromium + Playwright screencast + `VideoSource`, 5–15 fps, `is_screencast=True`); pre-launch while candidate is in the lobby.
- D9: candidate layout (agent screen tile + audio + captions) → **M3: candidate sees the agent's own screen; egress records it**.
- D10: tune endpointing (min/max delay), echo guard, short-ack handling (STACK.md #3); scripted consent + AI-disclosure line.

**Week 3 — hardening + bake-offs.** Pre-warm workers (STACK.md #4); event-replay page; load-test 5–10 concurrent; voice bake-off (Exp 4) + CV accuracy test (Exp 5) → **M4: repeatable demo with a replay link**. *If week 2 slips, it still demos on S0 from end of week 1.*

---

## 5. "Try different things" — riskiest spikes first

1. **Can a server participant publish a *screen-share-source* track?** (gates Mode B; docs only show cam/mic sources.) ~50 lines: publish a 720p test pattern at 5 fps with `is_screencast=True`; join from JS, check `track.source`. **Pass:** renders as screen-share in <2s, text legible. **Fallback:** publish as a camera track tagged via participant metadata.
2. **Highlight→pixels latency.** Stamp a frame counter; measure S0 (RPC) vs Mode B (video). **Pass:** S0 p50 <200 ms; Mode B p50 <500 ms.
3. **Frame-pump impact on voice.** Sidecar as separate process vs in-process. **Pass:** turn-latency delta <50 ms, sidecar <~1 vCPU.
4. **Cascade vs realtime feel.** 20 scripted turns through cascade vs a realtime model behind the same `AgentSession`. **Pass:** cascade median ≤900 ms; realtime only wins if its transcript timing is good enough for evidence spans.
5. **CV anchor accuracy.** 20 real CVs (incl. two-column + scanned) through Reducto / LlamaParse / PDF.js-only. **Pass:** ≥95% of highlights land on the intended bullet on text PDFs; parse <~30s; confirm DPA/retention.
6. **Keep or kill the full VM.** Time E2B `Sandbox.create()` + stream + noVNC→LiveKit (or ffmpeg→WHIP). **Pass:** desktop ready <10s (pre-warmed pool), stream <1s latency — else stay on Mode B.

---

## 6. Open risks / unverified

- **Screen-share-from-agent** is the #1 unknown — Experiment 1 gates Mode B.
- **It's not a literal "computer."** Market it as "live CV co-view + agent screen share," not "agent operates a computer," until Exp 6 says otherwise.
- **S0 isn't captured by egress** → need the event-replay page (or rely on Mode B egress for recordings).
- **CV edge cases:** scanned PDFs, two-column layouts, ligatures/hyphenation break exact-string matching; PDF.js coordinate flips are a known bug source; OCR is a later add.
- **PII:** CVs go to a third-party parser → need DPA + retention terms. Keep parser/avatar/sandbox behind interfaces (vendor churn is real: Hedra sunset its realtime avatar; Scrapybara appears to have pivoted).
- **Session caps** on free tiers (Steel/Browserbase ~15 min; E2B Hobby 1 hr).
- **Compliance:** spoken AI-disclosure + consent from day one.
- **Do not quote externally:** exact LiveKit plan minutes/rates, all glass-to-glass latency numbers, GA status of specific realtime SKUs, parser bbox schemas, and the per-interview cost — all are list-price arithmetic or secondary-sourced. Re-measure from real session logs in week 3.

---

## 7. Addendum (verified 2026-10-24): meeting-bots, provider matrix, against-points

A second verification pass (live vendor docs + our research) settled the specific vendors you raised.

### 7a. Recall.ai & meetstream.ai — right tool, different job

- **Recall's "Output Media" is real** [V]: you *can* stream a web page (e.g. the virtual
  computer's screen hosted as a noVNC/WebRTC page) into a meeting as the bot's **camera or
  screenshare**. So your instinct about its capability is correct.
- **But Recall is for joining EXTERNAL Zoom/Meet/Teams/Webex** — its docs do **not** list custom
  WebRTC rooms. For *our own LiveKit room* it's an unnecessary bot hop: we publish the screen
  track directly. Routing our own interview through a bot adds latency, a **1280×720 @ 15 fps**
  cap, **$0.50/hr base + $0.10–$1.00/hr output + $0.15/hr transcription**, generic (non-Kimma.ai)
  bot branding, and platform/ToS risk (bots get kicked).
- **Our research agrees:** across the 51 competitors, Recall.ai is used for **meeting *capture*
  (notetakers)** — Paraform (recruiter calls), Carv (notetaker), ModernLoop (notetaker only; its
  actual interviewer runs on **LiveKit + Retell + Twilio**) — **never to run the candidate AI
  interview.**
- **meetstream.ai** is an *emerging* cheaper Recall alternative ($0.35/hr, a "voice infra" angle).
  Its "200 ms ultra-low latency" is for **input** stream access, not agent response time, and
  **screen-share output is undocumented**. No competitor uses it. Worth a hands-on trial *as an
  external-meeting joiner*, not for our own room.
- **Verdict:** keep both behind a `MeetingProvider` interface for the **later** "join their
  Zoom/Meet/Teams" mode — which is exactly Kimma.ai's deferred Zoom/Meet/Teams integration and the
  "Meeting" conversation type (that's the *Meeting Intelligence* surface lantern.md sells). For the
  **candidate interview MVP, publish the screen directly into our LiveKit room.** Recall is the
  standard — for the meeting-intelligence product, not this one.

### 7b. Sandbox — E2B is a good pick; keep it out of the CV path

- **E2B Desktop = the 2026 modern standard** for a visible agent desktop. Good first pick. **Its
  stream is VNC/noVNC, not WebRTC**, so to show it you either (a) embed its stream URL
  (`requireAuth`, `view_only`) as an iframe pane beside the call — simplest — or (b) capture frames
  into a LiveKit track (one stream at a time).
- **Alternatives, ranked:** **Daytona** (emerging; same noVNC pattern; computer-use maybe alpha;
  possibly went closed-source) → second adapter. **Modal** (great for the voice worker / pre-warm
  pools — Mercor uses it; desktop is DIY). **Browserbase / Steel** (browser-only; *modern standard
  for browsers* — only if the agent must browse the candidate's live GitHub/LinkedIn). **AVOID:**
  Cloudflare Sandboxes (they *removed* the desktop API), **Scrapybara (shut down Oct 2025)**,
  Anchor/Hyperbrowser (browser-only noise).
- **Against-point you asked for:** **do not put CV highlighting on pixel computer-use.** Each
  computer-use step is a screenshot (~1,000–1,800 tokens) + a model round-trip = *seconds per
  highlight* mid-conversation; highlights can land on the wrong line (**breaks evidence-linking**);
  and a candidate's CV is **untrusted content** — Anthropic warns the model may follow instructions
  embedded in a page/image (**prompt-injection**). The **Agent Desk (DOM we control)** gives exact
  spans, no injection surface, deterministic results. Use E2B for the *"agent has a real computer"*
  showcase + future arbitrary-software mode, not for the CV.
- **"Claude 3.5 Sonnet computer use" is stale** [V]: current is **`computer_toolset_20260801`**
  (GA) with **claude-sonnet-5-5 / haiku-5-5**; `computer_20250124` now errors on Claude 5.5+.

### 7c. Provider matrix — what goes in `.env` (curated, no noise)

Each layer sits behind one interface; the **default** ships, the rest are hand-testable by flipping
one env var. "Baseline only" = include for comparison, not expected to win.

| Layer | Interface | Shortlist (default **bold**) | `.env` keys |
|---|---|---|---|
| Transport | `MeetingProvider` | **LiveKit (own room)** · Recall.ai *(external join, later)* · meetstream *(try)* | `LIVEKIT_URL/API_KEY/API_SECRET` · `RECALL_API_KEY` · `MEETSTREAM_API_KEY` |
| Realtime voice | `RealtimeVoiceProvider` | **Cascade (Deepgram+LLM+Cartesia+LiveKit turn)** · OpenAI Realtime *(fast-demo)* · Gemini Live *(sees screen)* · GPT-Live *(watch)* · Vapi/Retell *(baseline only)* | `DEEPGRAM_API_KEY` · `CARTESIA_API_KEY` · `OPENAI_API_KEY` · `GOOGLE_API_KEY` · `ELEVENLABS_API_KEY` · `ANTHROPIC_API_KEY` · `VAPI_API_KEY`/`RETELL_API_KEY` *(opt)* |
| LLM (in cascade) | `LLMProvider` | **fast tool-caller (GPT-4.1-mini / Gemini-Flash-Lite / Haiku-class)** | reuses `OPENAI`/`GOOGLE`/`ANTHROPIC` keys |
| Sandbox / computer | `SandboxProvider` | **E2B Desktop** · Daytona *(2nd)* · Browserbase/Steel *(web-only, if needed)* | `E2B_API_KEY` · `DAYTONA_API_KEY` · `BROWSERBASE_API_KEY`/`STEEL_API_KEY` |
| CV parse | `CVParserProvider` | **Reducto** · LlamaParse *(alt)* · Docling *(OSS)* | `REDUCTO_API_KEY` · `LLAMA_CLOUD_API_KEY` |
| Avatar *(phase 2)* | `AvatarProvider` | none at launch · Simli/Anam/Tavus later | `SIMLI_API_KEY` · `ANAM_API_KEY` · `TAVUS_API_KEY` |

### 7d. Verified 2026-10-24: browser sandbox, shared board, candidate data (inputs for grilling round 2)

The virtual desktop was **dropped** in favour of a cloud **browser**, plus a shared whiteboard.

**Browser sandbox** (the candidate watches the agent's browser for 45–60 min):
- **Browserbase + Stagehand v3**: managed default. Paid plans allow sessions up to 6 hr (docs; the pricing page lists no per-plan
  cap, so confirm). The free tier caps sessions at 15 min. Developer plan: $20/mo for 100 hr, then $0.12/hr. Every session is
  recorded by default (HLS/MP4, kept 30 days). Weak point: "view-only" live view is just a CSS trick, so read-only must also be
  enforced on the server.
- **Kernel**: best live-view embed, with a real `readOnly=true` flag and player events. About $0.48/hr headful, billed only for
  active time (a 45-min session ≈ $0.36). No session cap documented.
- **Steel**: open-source alternative (self-hosting removes the caps). Hosted plans cap sessions at 15 min (Launch) or 1 hr on
  Scale ($250/mo). Its `debugUrl` is unauthenticated, so it must sit behind our own auth.
- **Playwright 1.59** adds `page.screencast.start({onFrame})` for real-time frames, which is the path to publishing the browser
  view as a LiveKit track ourselves.
- **PDFs:** Chrome's built-in viewer exposes no highlight API, so we serve CVs through **our own PDF.js viewer page**.
- No vendor publishes cold-start times, so we measure them and pre-warm sessions.

**Shared board** (the candidate and the agent both draw and write):
- **tldraw**: best fit. The agent reads the board as structured shape JSON plus a screenshot, writes through server-side
  `updateStore`, and there is an official **agent starter kit** (Anthropic recommended). ⚠️ **SDK 4.0 needs a commercial
  license key in production, priced by quote only. Without a key, the editor stops rendering after ~5 s.** There is no hosted
  production sync, so we self-host on Cloudflare Durable Objects.
- **Excalidraw** (MIT): free open-source alternative. Collaboration is do-it-yourself (Yjs or excalidraw-room) and the agent
  tooling is thin.
- **Text/code pad:** **CodeMirror 6 + Yjs** (y-codemirror.next). It is far lighter than Monaco (~50–200 KB vs ~2.4 MB) and
  mobile-friendly. Liveblocks is the managed option for hosting the Yjs doc.

**Candidate background data** (lowest legal risk):
- **Only data the candidate supplies**: CV upload, optional LinkedIn **PDF export**, and their own GitHub/site/portfolio URLs.
  Because it is collected from the candidate, GDPR Art. 13 notice at upload applies, not the heavier Art. 14.
- **GitHub official API** (5,000 req/hr authenticated, and one interview needs only a handful of calls). Never scrape GitHub's
  HTML.
- **One web-research API** (Exa or Parallel; Tavily is the simplest), restricted to **candidate-supplied domains**, with a
  source log. Open-web name searches attach the wrong person's data.
- **Avoid:** LinkedIn scraping. LinkedIn sued Proxycurl in Jan 2025 and it shut down on 4 Jul 2025; earlier, hiQ ended in a
  permanent injunction plus $500K. Avoid people-data brokers too: People Data Labs reached a $6.36M Colorado settlement (2026).
  "Sign In with LinkedIn" returns only name, email and photo.
- **Good practice:** show the candidate a summary of what was gathered before the interview, and let them correct or remove items.
- **Law** (get counsel): EU AI Act treats recruitment as high-risk (Annex III obligations reportedly delayed to Dec 2027;
  unverified). NYC LL144 requires a bias audit and 10 business days' notice to NYC candidates if the tool "substantially
  assists" decisions.

**Voice fit, in one line each:** only the **cascade** lets us own the room + publish the screen
track + get word-timestamps for evidence; **OpenAI Realtime / Gemini Live** work via the LiveKit
realtime plugin but give late/no interim transcripts → run a **parallel Deepgram STT tap** for
evidence spans; **Gemini Live** alone can natively *see* the shared screen (~1 fps); **Vapi/Retell
own the room and expose no screen-share track** → they can't carry this product, baseline-only.
