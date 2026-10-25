# Aperture AI Interviewer — Final Plan (start here)

Simple, self-contained. If you read only one doc, read this. Deeper detail + sources are in
[interviewer-stack-decision.md](./interviewer-stack-decision.md). Decisions still open are listed
in §12 — defaults shown are the recommendations.

---

## 1. What we're building

An **AI interviewer** that runs a full first-round interview in our own branded call:

1. **Behavioral** — structured questions about past experience, with follow-ups.
2. **CV deep-dive** — opens the CV on its screen, **highlights** parts, asks about them.
3. **Coding** — opens a coding problem, watches the candidate's code, asks about their approach.

Afterward it produces a **report where every score links to a quote in the transcript**. A human
makes the decision; the AI never rejects anyone.

Lower scope than lantern.md — just the interviewer.

---

## 2. The interview flow

A server-side **state machine** runs the phases. The AI talks freely *inside* a phase; code (not
the AI) decides when to move on, based on time and "do we have enough evidence yet?"

| # | Phase | ~Time | What the AI does | What's on the screen |
|---|---|---|---|---|
| 0 | **Intro + consent** | 2 min | Says it's an AI, that it records, how it works. Can't be skipped or interrupted. | Welcome + consent |
| 1 | **Behavioral** | 10–12 min | 3–4 structured questions (STAR), follows up on thin answers | The current question as text |
| 2 | **CV deep-dive** | 8–10 min | Highlights CV lines, asks "what did *you* do here?", probes gaps | **CV** with live highlights |
| 3 | **Coding** | 15–20 min | Presents a problem, watches the code, asks about approach, changes a constraint | **Problem + code editor + test runner** |
| 4 | **Candidate questions + close** | 3 min | Answers questions about the process, explains next steps | Wrap-up |

Total ~40–45 min. Each phase has a time cap; if the candidate runs long, the machine moves on and
marks the rest "insufficient evidence" (not a fail).

---

## 3. The one idea that makes it fast: the **Agent Desk**

There are **two different jobs** people mix together. Split them and the hard problems disappear:

| Job | Wrong way (slow) | Right way (what we do) |
|---|---|---|
| **Show + highlight things** (CV lines, problem text, candidate's code) — constant | AI screenshots the screen → vision model finds words → mouse coordinates → drag. **3–6 s of silence.** | We render everything ourselves in one web page, the **Agent Desk**. "Highlight the Google job" or "highlight line 12" is an **instant command by ID** — like clicking a link. **<200 ms.** |
| **Operate a real computer** (rare "wow": open their GitHub, run their project) | — | **E2B + Claude Computer Use.** Really 3–6 s, which is **fine** because it's occasional and the AI narrates it. |

The Agent Desk has **tabs**: `CV` · `Problem` · `Code editor` · `Test output`. The agent drives it
with simple messages over the call's data channel (`highlight(cv_block_7)`, `open_tab(problem)`,
`highlight_code(lines 10–14)`), and it **reads** things as text, never as pixels:

- The **CV** is parsed once at upload into blocks with IDs.
- The **candidate's code** streams to the agent as plain text from the editor.
- **Test results** come back from the code runner as text.

> Because we render everything, a highlight is a *message*, not a *computer-vision problem*.
> No GPUs, no wrong-line errors, no prompt-injection from a malicious CV.

---

## 4. How we run the behavioral part (the research method)

Yes — the research has a **clear, evidence-backed method**, and it's the best-supported thing in
the whole `research/` folder. **Structured interviews are the #1 ranked hiring method** in the
largest meta-analysis (Sackett et al., 2022). HireVue's published science and its new AI
Interviewer both use this exact recipe:

1. **Pick 4–6 competencies for the role** (e.g. ownership, collaboration, handling ambiguity,
   learning from failure). Map them to a standard taxonomy (O\*NET / "Great Eight") so they're
   defensible.
2. **Write STAR questions** for each — *"Tell me about a time when…"* — answered as
   **S**ituation, **T**ask, **A**ction, **R**esult.
3. **Write a BARS rubric** (Behaviorally Anchored Rating Scale): for each competency, a concrete
   description of what a weak, OK, and strong answer sounds like.
4. **A human approves and freezes** the questions + rubric before interviews run. Same questions,
   same order, every candidate — that's what makes it fair and comparable.
5. **Follow up on thin answers**, always mapped back to the rubric: *"What did **you**
   specifically do?"*, *"What was the result, in numbers?"* — this also beats cheating tools better
   than proctoring does.
6. **Score after the call, separately**, on the locked transcript:
   - every score cites a **verbatim quote + timestamp**;
   - **"insufficient evidence"** is a valid answer (never guess);
   - the AI suggests 2 / 3 / blank — a **4 is human-only**, and humans can override;
   - the scoring model is from a **different family** than the interviewer model (reduces bias);
   - run it twice and check the scores agree (LLM scoring is known to be inconsistent).

HireVue splits this into **4 sub-agents**, and we mirror it:
`JD → script` (drafts questions + rubric) · `Conversation` (runs the interview) ·
`Scorer` (BARS + evidence) · `Guardrail` (rules, logging, no illegal questions).

---

## 5. How we run the coding part

- **Our own problem bank, LeetCode-*style* — not leetcode.com itself.** Three reasons:
  LeetCode's content is copyrighted and its terms ban automated access (plus bot-blocking walls);
  and verbatim LeetCode problems are exactly what cheating tools like *Interview Coder* and
  *Cluely* are built to solve instantly. Original problems or our own variants avoid all three.
- **The Agent Desk shows the problem + a code editor** (Monaco — the editor inside VS Code) **+ a
  "Run tests" button.** Code runs in a sandbox (E2B code sandbox, or open-source Judge0/Piston).
- **The agent watches the code as text**, so it can say "on line 12, why a nested loop?" and
  highlight those lines instantly.
- **It probes understanding, not just the answer**: asks them to explain their approach, then
  **changes a constraint** ("now the input doesn't fit in memory — what changes?"). The research
  says this kind of probing is the most reliable signal *and* the best defense against cheating.
- **Scored like behavioral**: a rubric (problem-solving, code quality, communication, testing),
  evidence = transcript quotes **and** code snapshots with timestamps.
- Cheating signals (paste events, long silences then perfect code) are **logged for the human**,
  never an automatic verdict.

---

## 6. Is it low-latency? (the short answer)

- **Voice loop:** ~500–800 ms. Fast. ✅
- **Highlights (CV / problem / code):** instant via Agent Desk (<200 ms). ✅
- **"Real computer" moments (E2B + Computer Use):** 3–6 s — acceptable because they're rare and
  narrated ("let me pull up your GitHub…"). ✅

**Self-hosting open-source** saves only ~100–200 ms but costs 24/7 GPUs. The real fix was
architectural (render it ourselves), which saves *seconds*. We still try open-source for cost and
control (§9), not for speed.

---

## 7. The stack

| Layer | Pick | Why |
|---|---|---|
| **Call** (our branded room) | **LiveKit** (Cloud now, self-host later — same code) | Most common transport across 51 competitors; we own the room, screen, and evidence. |
| **Voice** | **Cascade on LiveKit Agents**: Deepgram (speech→text) + fast LLM + Cartesia (text→speech) + LiveKit turn-taking | What the leaders run; **word-level timestamps** for evidence; every stage swappable. |
| **Interview brain** | **Server-side state machine** + LLM inside each phase | Reliable phase order, time caps, evidence gates (research recommendation). |
| **CV parsing** | **Reducto / LlamaParse** or **Docling** (open-source) | PDF → blocks with IDs, once at upload. |
| **Agent Desk** | Our web page: PDF.js (CV) + **Monaco** (code editor) | Instant, exact, safe, loggable. The core of the product. |
| **Code runner** | **E2B code sandbox** (or Judge0/Piston, open-source) | Runs candidate code safely; results come back as text. |
| **Scoring** | Separate post-call pass, **different model family** than the interviewer | Evidence-cited BARS scores; reduces bias; reliability checks. |
| **"Real computer" showcase** | **E2B Desktop + Claude Computer Use** (current Claude — 3.5 is retired) | The "agent has its own computer" wow; occasional, narrated. |
| **Screen into the call** | Agent Desk as a synced pane first → headless-Chromium sidecar publishes it as a real screen-share track | Same page shown two ways; real screen-share without a meeting bot. |
| **Face/avatar** | **None at launch** | The Desk is the differentiator; add a face later if needed. |
| **Join Zoom/Meet/Teams** | **Recall.ai** (later) | For joining *their* meetings — a later product, not this interview. |

**Not used for the interview:** Recall.ai as transport (extra hop, 720p/15 fps cap, bot fees,
generic branding — competitors use it only for notetaking) and Vapi/Retell as the core (they own
the room and give **no screen-share track**; kept as comparison baselines only).

---

## 8. Claude Computer Use — kept, on the current model

Claude 3.5 Sonnet is **retired**, so the pasted "3.5" plan can't run as written. Same approach,
current model: the 2026 computer-use toolset (`computer_toolset_20260801`) on **Claude Sonnet 5.5
/ Haiku 5.5**. Used only for the "real computer" moments, never for highlights.

---

## 9. "Try both" — managed vs open-source

Every layer sits behind a small interface with keys in `.env`; flip one variable to A/B.

| Layer | Managed (default, ship fast) | Open-source / self-host (we also try) |
|---|---|---|
| Call transport | LiveKit Cloud | **LiveKit self-hosted** |
| Speech→text | Deepgram | **faster-whisper** |
| LLM (interviewer) | GPT-4.1-mini / Gemini-Flash / Claude-Haiku class | **Llama / Qwen** (local) |
| Text→speech | Cartesia / ElevenLabs | **Kokoro / Piper** |
| All-in-one voice (alt) | OpenAI Realtime, Gemini Live | **Kyutai Moshi** (experiment) |
| CV parsing | Reducto / LlamaParse | **Docling** |
| Code runner | E2B code sandbox | **Judge0 / Piston** |
| Real-computer vision | Claude Computer Use (Sonnet 5.5) | **Qwen2-VL / OmniParser** (showcase only) |
| Sandbox desktop | E2B Desktop | **Docker + Xvfb** |
| Meeting-join (later) | Recall.ai / meetstream | **headless Chrome bot** |

Open-source is worth it for **transport, parsing, STT, code runner, our own sandbox**. Not worth
chasing for highlights (problem deleted) or voice at the start (managed is already fast).

---

## 10. Build plan

**Week 1 — the interview works end-to-end on the Agent Desk.**
Call + cascade voice (<1 s turns) · state machine with phases 0–4 · one frozen SWE template
(behavioral STAR questions + BARS rubric) · CV parse + highlights · problem + Monaco editor +
runner · agent reads code as text.

**Week 2 — real screen-share + scoring + showcase.**
Headless-Chromium sidecar publishes the Desk as a true screen-share track · post-call scorer
(evidence-cited, different model family, "insufficient evidence") · report page · E2B + Claude
Computer Use "real computer" moment.

**Week 3 — harden + bake-offs.**
Turn-taking tuning · managed-vs-open-source tests · problem bank (5–10 problems with variants) ·
JD → draft questions/rubric → human approve · load test. *If week 2 slips, it still demos from week 1.*

---

## 11. Prove these first (cheap experiments)

1. **Agent publishes a screen-share track into LiveKit** (~50 lines). Gates the real screen-share.
2. **Highlight speed** on the Agent Desk: <200 ms (validates §3).
3. **Agent reads live code** from the editor and comments on a specific line correctly.
4. **CV accuracy**: on 20 real CVs, ≥95% of highlights land on the right line.
5. **Voice feel**: cascade vs OpenAI Realtime vs Gemini Live, same harness.
6. **Scoring consistency**: score 10 transcripts twice with two model families — do they agree?

---

## 12. Open decisions (being settled in the grilling session)

1. Target role + interview format (default: software engineers, ~40–45 min first round)
2. First audience + deadline (default: internal/investor demo in ~3 weeks, then a pilot)
3. Coding problems source (default: our own LeetCode-style bank, not leetcode.com)
4. AI tools during coding (default: not allowed for MVP; signals logged, no auto-reject)
5. Who writes questions + rubric (default: one hand-built frozen template first; JD-generation later)
6. Interview control (default: server-side state machine; LLM inside each phase)
7. E2B "real computer" placement (default: week-2 showcase, not on the critical path)

---

## 13. Honest risks

- The agent's real screen-share track is the one technical unknown (Experiment 1).
- **LLM scoring is the weakest link** (inconsistent, biased) — that's why scoring is separate,
  evidence-cited, double-run, and human-signed.
- Candidates distrust AI interviews (research: Reddit/HN are hostile) — clear disclosure, no
  auto-reject, and an opt-out to a human interviewer help.
- Hiring law (NYC LL144, Colorado, EU AI Act) needs disclosure, bias audits, and human review
  before a real pilot.
- 2026 prices/versions move fast; re-check vendor pages before quoting.
