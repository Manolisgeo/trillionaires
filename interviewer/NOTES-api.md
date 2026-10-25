# NOTES-api

- types.ts: `Role` has no error field, so a failed role draft ends as `status: "draft"`, `profile: null` (UI should show "drafting failed, retry"). Suggest `Role.draftError?: string`. Interview scoring failure sets `status: "failed"` and appends an event `{type:"scoring.error", payload:{message}}`.
- File paths: `Candidate.cvPath` / `linkedinPdfPath` are stored relative to DATA_DIR (`uploads/<id>/cv.pdf`); serve at `/api/files/<path>`. `/api/files` only serves `uploads/`, `recordings/`, `boards/` (never db.json) and supports Range.
- Recording route: multipart field `audio` (webm), optional `recordingStartedAt` (epoch ms/ISO) or `offsetSec`. Recall mp4 is downloaded to `recordings/<id>.mp4` by the webhook (events `bot.done`, `recording.done`; configure the webhook URL `${PUBLIC_BASE_URL}/api/recall/webhook` in the Recall dashboard). Webhook payload is not signature-verified; it only triggers a re-fetch from Recall with our key.
- Meet mode: the join message (AI + recording notice + board link `/room/<id>?view=board`) is sent via `chat.on_bot_join` (pinned on Meet), since the bot is not in the call at create time.
- Other routes added: `GET /api/roles`, `GET /api/candidates?roleId=`, `GET /api/interviews` (lists). `PATCH /api/candidates/[id]` body: `{removeClaimIds?, restoreClaimIds?, corrections?:[{claimId,text}], reviewed?}`.
- Internal routes return 503 if AGENT_INTERNAL_SECRET is unset. Dev data from verification was left in interviewer/data (gitignored).
