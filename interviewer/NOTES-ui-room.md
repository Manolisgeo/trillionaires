# NOTES ui-room

Owns `web/src/app/room/**`, `web/src/app/bot/**`, `web/src/components/room/**`. Touched nothing else.

## Routes
- `/room/[id]`: lobby (mic check with a real level meter, consent recap, Join) then the live room. `?view=board` = Meet board-only participant (token `board`, no mic, no audio). `?preview=1` = offline scripted run, no LiveKit (add `&scene=board` or `&scene=browser` to land on that tab, `&view=board` for the board-only layout). The preview uses the interview's real CV, plan and role.
- `/bot/[id]`: fixed 1280x720 bridge for the Recall bot. `?preview=1` renders the same layout offline for design review.

## Things other modules should know
- **PDF.js worker** is served by `app/room/pdfjs-worker/route.ts` from `pdf.worker.min.mjs.txt` (copy of pdfjs-dist 6.3.289, the version react-pdf 11 pins). Reason: pnpm does not hoist `pdfjs-dist`, and bundling the worker through Next's SWC breaks it ("Failed to resolve @swc/helpers"). The `.txt` suffix keeps ESLint off the minified file. If react-pdf is upgraded, re-copy the worker from the matching pdfjs-dist. Alternative: add `public-hoist-pattern[]=pdfjs-dist` to `.npmrc` and use the README's `new URL(...)` form.
- **Desk screen handling**: `screen` cv/browser switch the tab; `board.add` switches to Worksheet; `idle`/`question` leave the tab alone. A candidate can still click tabs; the next agent message wins.
- **Question tags** (Q2.3) are resolved by matching the `question` text against the plan, then by the id of the preceding `cv.highlight` (the agent sends the planned question id there). Unmatched questions get `Q<phase>.<n>` by arrival order. The slip uses the highlight id.
- **Agent shapes** (`board.add`) are drawn by the candidate client and by the Meet board participant only, in violet, with deterministic element ids (`aperture-<n>-<i>`) so a replay never duplicates. The bot's mirror is read-only.
- **Board sync**: topics `board` ({elements}, only changed elements, 400 ms throttle, merged with Excalidraw `reconcileElements`) and `pad` ({text}). A client that joins late gets the whole scene from existing clients about 1.2 s after it connects. POST `/board` runs every 2 s while content changes (summary: shapes, labels, `A -> B` arrows resolved by binding or by endpoint proximity, free text; PNG only when the scene changed).
- **Recording**: MediaRecorder on a WebAudio mix of the candidate's mic and the agent's voice, started when the first audio track attaches, uploaded on Leave or on desk `ended` with `recordingStartedAt` (epoch ms) so the server computes `offsetSec`. If the tab is closed mid-call the recording is lost (browser beforeunload prompt is the only guard). Header shows red RECORDING only while the recorder runs; otherwise a dashed chip says why not.
- **Integrity**: `tab_hidden` (visibilitychange), `paste` (pad or board, detail has the length only, never content) and `rejoin` (LiveKit Reconnected) go to POST `/integrity` with `t` = seconds since `interview.startedAt` (polled from GET `/api/interviews/[id]`, falls back to join time).
- **Late joiners miss desk state**: the agent does not re-send `phase`/`question`/`cv.highlight`. The board participant and a bot that joins mid-interview show "waiting" until the next message. Suggest the agent re-send phase + current question when a participant connects.
- "Extra think time: on" is a status chip (the agent always waits through pauses); it sends nothing.
- Not exercised end to end (no LiveKit server in this environment, and none pulled): LiveKitRoom connect, text-stream handlers, MediaRecorder upload, StartAudio. Everything else was run in the browser via the preview routes, the lobby (mic check with a synthetic stream, 503 path) and `next build`.
