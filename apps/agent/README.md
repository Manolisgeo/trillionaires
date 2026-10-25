# Kimma.ai realtime agent

Python LiveKit Agent. Joins a conversation room, speaks through OpenAI Realtime, and calls typed backend tools. It has no database credentials.

```bash
cd apps/agent
uv sync
cp ../../.env .env
uv run python src/agent.py dev
```

The worker registers as `kimma-conversation-agent` (override with `LIVEKIT_AGENT_NAME`). The Next.js app dispatches that name when a call starts.

Turn-taking uses OpenAI semantic VAD with `interrupt_response=true` so barge-in stops agent audio immediately.
