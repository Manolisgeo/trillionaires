# Conversation evals

These tests do not require a microphone. They score the reasoning layer against the failure modes that make realtime conversations feel broken.

| Scenario | What we measure |
| --- | --- |
| Cooperative participant | Objective completion, relevance |
| Extremely verbose | Follow-up quality, not stalling the plan |
| Extremely short answers | Clarification instead of moving on |
| Participant interrupts AI | Interruption is recorded; agent does not require finishing the sentence |
| Topic change | Strategy can abandon planned questions |
| Unexpected question | Agent answers before interviewing further |
| Contradictory answers | Follow-up to reconcile |
| Long pause | Wait / do not treat as end-of-turn in the strategy layer (VAD is tested live) |
| Noisy / filler | Low-value ranking, not deleted |
| Multiple speakers | Speaker identity preserved on segments |

Run:

```bash
pnpm --filter @kimma/evals test
pnpm --filter @kimma/conversation test
```
