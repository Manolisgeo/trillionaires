# Architecture

Kimma.ai is the intelligence layer for human conversations. A conversation is still the live session, but the durable object is a person: conversations produce claims, claims point at evidence and counterevidence, and a controller decides the next move. The realtime model proposes. It does not own that decision.

Interviews, sales calls, research sessions, meetings, and later phone or third-party meeting joins are conversation types on that shared engine.

## Principles

1. **Realtime quality > visual effects.** Turn-taking, barge-in, and latency matter more than avatars.
2. **Reliability > number of features.** A working native call with evidence-backed reports beats a wide surface area.
3. **Evidence > generic summarization.** Reports distinguish FACT, INFERENCE, and UNCERTAINTY.
4. **Conversational intelligence > scripted questions.** The agent operates from objectives and live state.
5. **Replaceable providers.** AI, avatar, telephony, storage, and meeting backends sit behind interfaces.

## Repository

```text
apps/web          Next.js app (UI + API + server actions)
apps/agent        Python LiveKit agent (realtime participant)

packages/types         Shared TypeScript contracts
packages/database      Prisma schema and client
packages/config        Environment parsing
packages/ai            Provider abstractions + OpenAI adapters
packages/conversation  State, question strategy, importance, evidence linking
packages/intelligence Conversation controller, claims, contradictions, memory layers
packages/ui            Shared presentational primitives

infrastructure/   Local docker-compose (Postgres, Redis, MinIO, LiveKit)
evals/            Conversation behavior evals
```

`apps/web` deploys to Vercel. `apps/agent` deploys independently (LiveKit Cloud Agents, Fly, or a VM). Local development runs both plus Docker dependencies.

## System context

```text
Browser ──LiveKit media──► LiveKit Server ◄──media── Python Agent
   │                            │                         │
   │ REST / RSC                 │                         │ typed HTTP tools
   ▼                            ▼                         ▼
Next.js  ──────── Prisma ──── PostgreSQL          Redis (ephemeral ConversationState)
   │
   ├── S3-compatible object storage (recordings)
   ├── OpenAI Realtime (via agent)
   └── OpenAI (or other) high-reasoning model (post-call analysis)
```

The browser never receives provider API keys. LiveKit tokens are minted server-side after authz. The agent never receives a database connection; it calls typed internal APIs with `AGENT_INTERNAL_SECRET`.

## Core domain

A **Conversation** has a type, purpose, objectives, participants, sessions, transcript, events, insights, recordings, and a report.

Conversation types are an extensible enum (`INTERVIEW`, `SALES`, `RESEARCH`, `MEETING`, `EXPERT_INTERVIEW`, `CUSTOM`). Product logic branches on objectives and templates, not on a hard-coded interview workflow.

### ConversationState

Realtime intelligence lives in `ConversationState` (see `packages/types` and `packages/conversation`):

- purpose, objectives, covered/uncovered objectives
- rolling transcript window (not the full history on every turn)
- established facts with evidence
- unresolved questions, hypotheses, contradictions, important moments
- agent mode: `LISTENING | THINKING | SPEAKING | WAITING | CLARIFYING | FOLLOW_UP`

The agent posts transcript and turn events. The backend updates structured state in Redis (hot) and persists durable events to Postgres. The next conversational action is computed from this state by `QuestionStrategy`, not from a static script.

### Question strategy

Each candidate question has an objective, topic, expected evidence, importance, difficulty, prerequisites, and follow-ups. Selection considers:

1. what the conversation is trying to establish
2. what is already known
3. what remains unknown
4. what was just said
5. value of the next question
6. conversational naturalness

Planned questions are abandoned when the participant already supplied the evidence. Unexpected important claims are investigated even if they were not in the original plan.

### Intelligence layers

During and after a conversation the system maintains:

| Layer        | Meaning                                              |
| ------------ | ---------------------------------------------------- |
| Known        | Facts with transcript evidence                       |
| Unknown      | Objective-relevant information not yet established   |
| Uncertain    | Weak or conflicting evidence                         |
| Important    | Material to the purpose                              |
| Low-value    | Not material; retained, deprioritized in the UI      |
| Follow-up    | Worth asking later                                   |

Humans make irreversible decisions (hire, buy, conclude). The AI produces evidence and assessment only.

## Realtime engine

LiveKit is the native meeting provider for the MVP.

1. User creates a conversation (type, purpose, objectives, participants).
2. Starting the call creates a `ConversationSession`, a LiveKit room named by conversation id, and dispatches the agent.
3. The browser joins with a short-lived token (`roomJoin`, publish, subscribe, data).
4. The Python agent joins as a named AI participant using OpenAI Realtime (`semantic_vad`, `interrupt_response=true`).
5. Barge-in: if a human speaks while the agent is talking, generation stops immediately, an interruption event is stored, human speech is captured, state updates, and the agent decides whether to respond.
6. Transcript segments stream to the room (captions) and to the backend (persistence + state).
7. Ending the call stops egress (if configured), marks the conversation `PROCESSING`, and enqueues post-call analysis.

Turn-taking must distinguish short pauses, thinking pauses, completed answers, hesitation, interruption, another speaker, noise, and clarification requests. OpenAI semantic VAD is the first implementation of that detector; the `TurnDetector` interface allows swapping it.

Latency telemetry (speech-to-text, turn detection, TTFT, TTS time-to-first-audio, end-to-end, interruption) is recorded as `ConversationEvent`s of type `TELEMETRY`.

## Agent ↔ backend contract

Internal routes under `/api/internal/*` require `Authorization: Bearer $AGENT_INTERNAL_SECRET`.

Typed tools (no raw SQL):

- `get_conversation_objectives`
- `get_conversation_state`
- `save_fact`
- `mark_objective_complete`
- `mark_follow_up`
- `create_action_item`
- `get_next_action`
- `save_transcript_segment`
- `record_event`
- `end_conversation`

Future tools (`search_previous_conversations`, `search_knowledge_base`, `schedule_follow_up`, `get_candidate_profile`) use the same pattern.

## Post-call analysis

Analysis is asynchronous. The UI is never blocked.

```text
Transcript + events
  → segmentation
  → topic detection
  → fact extraction
  → Q/A extraction
  → important moments
  → contradictions
  → action items
  → objective evaluation
  → executive summary
  → structured report
  → embeddings for conversation-level search
```

A separate high-reasoning model (not the realtime voice model) performs this pipeline through `AnalysisProvider`.

## Storage

| Data                         | Store                                      |
| ---------------------------- | ------------------------------------------ |
| Users, orgs, conversations   | PostgreSQL via Prisma                      |
| Transcripts, reports, events | PostgreSQL                                 |
| Hot ConversationState        | Redis                                      |
| Recordings                   | S3-compatible object storage, signed URLs  |
| Secrets                      | Environment / hosting secret store         |

Binary media is never stored in Postgres. Retention is an organization setting; deletion is an explicit organization-scoped operation.

## Provider interfaces (replaceable)

Defined in `packages/types` and implemented in `packages/ai` / server adapters:

- `RealtimeVoiceProvider` — OpenAI Realtime first
- `AnalysisProvider` / `EmbeddingProvider` — OpenAI first
- `AvatarProvider` — interface only in MVP (Hedra/Anam later)
- `MeetingProvider` — LiveKit first; Zoom / Meet / Teams later via official APIs
- `TelephonyProvider` — LiveKit SIP later
- `ObjectStorageProvider` — S3-compatible
- `TurnDetector` — OpenAI semantic VAD first

Do not reverse-engineer meeting platforms. Use official APIs when those integrations are built.

## Security and privacy

- Authentication via Auth.js (credentials for MVP).
- Every database query is scoped to `organizationId` from the session.
- Recordings use short-lived signed URLs.
- Provider keys stay server-side (web) or on the agent host.
- Audit log for sensitive actions (start/end, export, delete, consent).
- Rate limiting on auth and token minting.
- Explicit recording indicator, AI-participant disclosure, and consent before join.
- No secret recording features.

## Observability

Every model call, tool call, transcript event, turn, interruption, error, token usage, and estimated cost is a `ConversationEvent` (and structured logs with `conversationId` + `agentSessionId`). `/observability` is an internal debug surface so a bad conversation can be reconstructed.

## Deployment

| Component | Local                         | Production                    |
| --------- | ----------------------------- | ----------------------------- |
| Web       | `pnpm --filter web dev`       | Vercel                        |
| Agent     | `uv run python src/agent.py dev` | LiveKit Cloud / container  |
| Postgres  | Docker                        | Neon / RDS / similar          |
| Redis     | Docker                        | Upstash / ElastiCache         |
| S3        | MinIO                         | S3 / R2 / GCS                 |
| LiveKit   | Docker `--dev` or Cloud       | LiveKit Cloud                 |

## What ships in the first vertical slice

Auth, create conversation, objectives, native LiveKit call, realtime AI participant, live transcript, recording metadata, conversation state, dynamic follow-ups, end call, async analysis, structured report, timeline, searchable transcript.

Explicitly deferred: photoreal avatars, telephony, Zoom/Meet/Teams, org-wide search at scale, rich template editors, advanced analytics.
