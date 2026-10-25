# Kimma.ai

Conversation intelligence. A realtime AI participant that joins human conversations and turns them into structured evidence.

The first wedge is AI-powered interviews. The core abstraction is a generic **Conversation** — interviews, sales calls, research, meetings, and future telephony all share the same infrastructure.

See [docs/product.md](docs/product.md) and [docs/architecture.md](docs/architecture.md).

## Stack

| Layer | Choice |
| --- | --- |
| Web | Next.js, TypeScript, Tailwind, LiveKit React |
| Data | PostgreSQL (Prisma), Redis, S3-compatible storage |
| Realtime | LiveKit + Python LiveKit Agents |
| Voice AI | OpenAI Realtime API (swappable) |
| Analysis | Separate high-reasoning model (swappable) |

## Local development

### Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io) 9
- [uv](https://docs.astral.sh/uv/) (Python agent)
- Docker

### 1. Start infrastructure

```bash
cp .env.example .env
# fill OPENAI_API_KEY and AUTH_SECRET / AGENT_INTERNAL_SECRET
pnpm infra:up
```

This starts Postgres (port **5433**, to avoid colliding with other local databases), Redis, and a LiveKit server in `--dev` mode (`devkey` / `secret`).

Object storage is optional for local development (transcripts still persist). To run MinIO:

```bash
docker compose -f infrastructure/docker-compose.yml --profile storage up -d
```

The MinIO image is pulled from `quay.io` because Docker Hub no longer hosts `minio/minio`.

### 2. Install and migrate

```bash
pnpm install
pnpm db:generate
pnpm db:push
pnpm db:seed
```

### 3. Run the web app and the agent

```bash
# terminal 1
pnpm dev:web

# terminal 2
cd apps/agent
uv sync
cp ../../.env .env
uv run python src/agent.py dev
```

Open [http://localhost:3001](http://localhost:3001).

Seeded local login:

- email: `founder@kimma.local`
- password: `kimma-dev`

### 4. Create a conversation and start a call

Allow microphone (and camera if you want video). The AI participant joins the LiveKit room. End the call to enqueue post-conversation analysis.

Recording files require LiveKit Egress + S3. Local `--dev` LiveKit still captures transcript, events, and conversation state. Configure LiveKit Cloud + a real bucket when you need media files.

## Environment

All keys stay on the server or the agent host. See `.env.example`. Never put `OPENAI_API_KEY`, LiveKit secrets, or S3 credentials in client code.

## Tests and evals

```bash
pnpm test
pnpm --filter @kimma/conversation test
```

Conversation-behavior evals live in `/evals` (verbose participant, barge-in, contradictions, pauses, etc.). They score turn-taking, memory, follow-ups, objective completion, hallucinations, and latency — without requiring a live microphone.

## Deployment

- **Web:** Vercel. Set the same env vars. Point `DATABASE_URL`, `REDIS_URL`, `LIVEKIT_URL` at managed services.
- **Agent:** Deploy independently (LiveKit Cloud Agents, Fly.io, or a container). It only needs LiveKit credentials, `OPENAI_API_KEY`, `APP_URL`, and `AGENT_INTERNAL_SECRET`.
- **Postgres / Redis / S3:** any managed providers. Object storage must be S3-compatible.

## What is not in v1

Photoreal avatars, PSTN, Zoom/Meet/Teams (interfaces exist; LiveKit is the only implementation), and organization-wide search at scale. Conversation-level search ships in the MVP.
