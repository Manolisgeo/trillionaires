# Kimma.ai Interviewer

An AI voice interviewer demo. A recruiter drafts a role rubric from a job description, a candidate applies and reviews
what was gathered about them, then has a live voice interview (in the browser or inside Google Meet). The agent shows
each question on a catalog card, highlights the CV line it's asking about with a violet slip, opens the candidate's own
links in a cloud browser, and works through problems on a shared worksheet. After the call, Claude scores the transcript
against the rubric with verbatim, timecoded evidence. Humans make every decision. See `PRODUCT.md`, `SPEC.md`,
`DESIGN.md` (visual system: "The Reading Room"), and the Claude Design comps in `design/`.

All commands below run from this `interviewer/` folder (it is its own pnpm workspace, separate from the repo root).

## Setup
```bash
pnpm --dir web install
(cd agent && uv sync)
scripts/setup-keys.sh        # interactive; writes interviewer/.env, never echoes secrets
```

## Demo in 5 minutes
```bash
pnpm --dir web seed:demo     # resets data/ to a curated demo set (backs up the old db first); prints the URLs to open
pnpm --dir web dev           # http://localhost:3000
```
Open the printed URLs: the catalog (`/`), a finished report (`/reports/<id>`), and the room preview
(`/room/<id>?preview=1`, which runs offline with no voice). For a **live** interview, also start voice:
```bash
docker compose up livekit                                  # local LiveKit (devkey/secret, ws://localhost:7880), or use LiveKit Cloud
cd agent && uv run python src/main.py download-files       # once: turn-detector and VAD weights
cd agent && uv run python src/main.py dev                  # the voice agent
```
then open the scheduled interview's `/room/<id>` and join. Set `DEMO_SHORT_INTERVIEW=1` for a ~12-minute interview.

## Routes
| Who | Route | What |
|---|---|---|
| Recruiter | `/` | Catalog: roles as collections, ledger of candidates |
| Recruiter | `/roles/new`, `/roles/[id]` | Job description → AI-drafted rubric → edit → approve → application link |
| Recruiter | `/interviews/[id]` | Brief (matched / unverified / gaps / flags), plan, room link, "Send to Google Meet" |
| Candidate | `/apply/[roleId]` | Application + consent |
| Candidate | `/apply/review/[candidateId]` | Review your record (remove/correct items), then join |
| Candidate | `/room/[id]` | Live interview (`?preview=1` offline preview, `?view=board` worksheet-only for Meet mode) |
| Recall bot | `/bot/[id]` | 1280×720 bridge page the Meet bot streams as its camera |
| Recruiter | `/reports/[id]` | Finding aid: suggestion, per-criterion ratings, ▶ timecoded evidence, recording |

## Google Meet mode
The Recall bot loads `${PUBLIC_BASE_URL}/bot/<id>` as its camera, and that page joins the LiveKit room as a bridge. The
candidate gets a worksheet link in the Meet chat. Needs `RECALL_API_KEY` (+ `RECALL_REGION`), **LiveKit Cloud** (the bot's
browser must reach LiveKit), and a public HTTPS `PUBLIC_BASE_URL` (deploy, or a tunnel). Optionally point a Recall webhook
at `${PUBLIC_BASE_URL}/api/recall/webhook` to fetch the recording automatically.

## Degradation (missing keys)
| Missing | Behaviour |
|---|---|
| `ANTHROPIC_API_KEY` | role draft, research, plan and scoring return labeled demo fixtures |
| LiveKit keys | room shows "voice unavailable" with a link to the preview; or run local LiveKit |
| STT / LLM / TTS keys | the agent logs the missing key and refuses to start the session |
| `BROWSERBASE_*` | the agent's browser view becomes a link card |
| `EXA_API_KEY` | web research skipped |
| `RECALL_API_KEY` | "Send to Google Meet" explains it is unavailable |

## Checks
`pnpm --dir web exec tsc --noEmit` · `pnpm --dir web build` · `pnpm --dir web exec tsx scripts/smoke-prep.ts` (mock prep and
scoring) · `cd agent && uv run pytest -q` · `node ~/.claude/skills/impeccable/scripts/detect.mjs --json web/src`.

## Known gaps
- **Live paths are untested end to end** (no keys yet): LiveKit dispatch, real STT/LLM/TTS and turn-taking, Browserbase,
  Recall, live Claude calls, GitHub, Exa. Mock mode and the UI are fully exercised.
- Client-side recording is lost if the tab closes mid-call (the Meet mode uses Recall's recording instead).
- Late joiners get the current desk state replayed after ~1 s (`LATE_JOIN_DELAY_S` in the agent); raise it if a joiner misses it.
- "Request a human interviewer", "Record my decision" and "Redraft" are UI-only or create new records; they need API endpoints.
- Recall webhook is not signature-verified. No auth anywhere; `data/` is a local JSON store (demo only).
- The PDF.js worker is served from a copied file (`app/room/pdfjs-worker`); re-copy it when upgrading react-pdf.
- Excalidraw loads its fonts from its CDN; offline it falls back to system fonts.
