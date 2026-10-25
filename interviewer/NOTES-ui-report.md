# NOTES: ui-report

- API gap: no endpoint records the human decision (Advance / Hold / Decline + note). The demo saves it to localStorage key `kimma:decision:<interviewId>` (per browser). Needs `POST /api/interviews/[id]/decision` and a `decision` field on Interview.
- Weights are looked up from `role.profile` (competencies / skills) by `criterionId`; hidden if not found.
- Question citation ("Asked as Q2.3 · probe on CV p.1") is derived by matching the latest `question` desk event (payload.text, t <= evidence t) to `plan.phases[].questions[].text`. If the agent does not log `question` events into `interview.events`, the citation line is omitted. Needs the agent to persist `question` events.
- "Reports" nav item has no index page; it links to the current report. Nav hrefs `/` and `/roles/new` are assumed from ui-shell.
- Worksheet snapshot line from the comp is not rendered (no per-criterion board snapshot in the data).
- Print: `window.print()` with an inline @media print block hiding the header, player and buttons; transcript expands in print only if opened.
