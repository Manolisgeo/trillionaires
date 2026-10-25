# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Delegated by the user ("just build it all over, outsource everything"); recorded choice: Next.js 15 (App Router,
TypeScript, Tailwind 4) for the web app and a Python LiveKit Agents worker for the voice interviewer. Full spec:
[SPEC.md](SPEC.md).

## Users

- **Recruiters and hiring managers** set up a role once (paste a job description, approve the AI-drafted rubric), send
  candidates a link, and later read an evidence-backed report to decide who advances. They work at a desk, between
  calls, scanning many candidates.
- **Candidates** of any role open a link, upload their CV and links, and take a ~40–45 minute live interview with an
  AI. They are often nervous, on a laptop at home, and wary of AI judging them.

## Product Purpose

Kimma.ai is an AI interviewer. Before the call it researches the candidate's background (CV, LinkedIn export, GitHub,
own site) against the role's requirements and drafts a personalized interview plan. During the call it talks naturally
and shows its own screen: it opens the CV and highlights the line it's asking about, opens their GitHub, and shares a
whiteboard where both sides write and draw. Afterward it produces a structured report where every rating cites a
verbatim quote, a timestamp, and the recording. A human always makes the decision.

Success: a recruiter trusts the report enough to act on it, and a candidate leaves feeling they were asked about *their*
work fairly.

## Positioning

Competitors interview from a generic script and return a score. Kimma.ai interviews **about this candidate's actual
background against this role's actual bar**: it points at the exact CV line or repo it's asking about, and every
judgment links back to the moment in the recording that supports it. Same core questions for every candidate (fair,
comparable), with personalized probes. The AI suggests "Advance" or "Needs human review", never "Reject".

## Operating Context

- Interview runs in Kimma.ai's own browser call (LiveKit) or inside the candidate's Google Meet/Zoom via a meeting bot
  (Recall.ai) that screen-shares the agent's view.
- Phases: intro and consent → behavioral (STAR questions, follow-ups) → CV/background deep-dive → technical/niche
  questions on a shared whiteboard (no code execution) → candidate questions and close.
- Inputs: job description; candidate CV PDF, optional LinkedIn PDF export, GitHub handle, personal links. Only data the
  candidate supplies plus public APIs; no scraping.

## Capabilities and Constraints

- Voice AI participant (cascaded speech-to-text → LLM → text-to-speech), always disclosed as AI, no human persona, no
  avatar at launch.
- Agent screen: a cloud browser (CV in a PDF viewer with live highlights, GitHub pages), plus a shared whiteboard and
  text pad.
- Evidence-first scoring per competency (BARS anchors); "insufficient evidence" is a valid outcome; ratings of 4 are
  human-only.
- Demo deadline: 2 days from 2026-10-25. No auth in the demo build.
- Undecided: brand assets (logo, colors, fonts) — none exist yet.

## Brand Commitments

- Name: **Kimma.ai**. No logo, palette, or typeface committed.
- Voice: plain, calm, precise; the AI speaks in short plain sentences and never pretends to be human.

## Evidence on Hand

- `research/` folder: 51 reverse-engineered competitors, HireVue dossier, community/papers findings (behavioral method:
  structured STAR + BARS; candidate distrust of AI interviews; evidence-linked scorecards as the strongest buyer demand).
- No customers, testimonials, metrics, or pricing exist. Do not fabricate them; demo data must be labeled synthetic.

## Product Principles

1. **Evidence over verdicts:** every claim the product makes about a person points at a quote and a moment.
2. **Fair by structure:** same core questions and rubric per role; personalization changes what is asked, never what is graded.
3. **AI reads as AI:** the agent is always identifiable as an AI and never makes the decision.
4. **Show, don't tell:** the agent points at the exact thing it's asking about.
5. **Calm for the candidate:** the call should lower anxiety, not add to it.

## Accessibility & Inclusion

Live captions throughout; a visible "I'm finished answering" control and extra think-time for candidates who need it;
an always-available "request a human interviewer" path; keyboard-operable controls; WCAG AA contrast.
