# Agent notes
- Run once: `cd agent && uv run python src/main.py download-files` (turn-detector + silero weights). Then `uv run python src/main.py dev`.
- Agent links audio to participant `candidate-<id>` (mode room) or `bridge-<id>` (mode meet), from `interview.mode` in the internal context.
- Internal API contract the agent relies on: context returns `{interview, role, candidate, cvUrl, publicBaseUrl}`; `/start` returns `{startedAt}` ISO;
  `/board` returns `{summary, padText, pngUrl}` (pngUrl may be relative to publicBaseUrl); `/transcript`, `/events`, `/evidence` take `{segments|events|notes}` arrays.
- Evidence note shape sent: `{id, t, competencyId, skillId:null, note, segmentId}` (criterion id goes in competencyId; web may resolve skill ids).
- Desk msgs `cv.highlight` carry `id` = planned question id when available; client should treat repeated ids as replace.
- Integrity signals: agent only logs the `control` integrity msg as a desk event; the client is expected to POST to /integrity itself.
- Agent sends `ended` with reportUrl `${PUBLIC_BASE_URL}/reports/<id>` after /end.
