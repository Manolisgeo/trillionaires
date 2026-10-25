# NOTES ui-fix1 (fix round 1)

F1 one tag: `tagForHighlight` now returns the tag of the planned question on screen, so slip, question card ("Q3.1", no more "Q 3.1"), outline row and report citation share one value. The offline preview script now sends phase, highlight and question for the same planned probe in one moment. CV viewer has a line-number gutter (`lineRows` in `cv-match.ts`, same numbering as "line N" on the card) and reserves an 80px left margin for the slip.
F2 report: each quote is a slip row (violet Q-tag from the question event, timecode, `T-nnn` transcript line); criteria are `C-01...`; "SERIES n" removed. Citations need `question` desk events (the seed writes them; the live agent already does).
F3 eyebrows removed on catalog, role, interview, new role, apply, review and report; call numbers sit beside the H1 (`PageTitle tag`) or in the header chrome (`CandidateHeader tag`).
F4 no coloured side stripes: quotes use a 1px neutral rule plus wash, phase sublist 1px rule, transcript line wash only.
F5 `fixtureReport` (src/lib/prep/fixtures.ts, not a UI file) now snaps quotes to whole sentences, uses distinct segments and one "[Demo data]" label.
F6 `web/scripts/seed-demo.ts` resets `data/db.json` (backup at `data/db.json.before-seed`): 2 roles (distinct titles), 3 synthetic candidates in different states, one finished interview with a coherent plan, transcript, events and hand-written report. Run from web/: `pnpm exec tsx scripts/seed-demo.ts`. Phones show the ledger as stacked slips.
F7 room mobile: slip in the margin, CV at 600px page width scrolling sideways, footer sticky with the primary action first and the rest under "More".
F8 `.ruled` cards are on the 24px grid (kicker, text and source rows are 24px multiples).
F9 catalog card title box and competency panel flattened; one page-level synthetic stamp; ledger cells align middle.
F10 one recruiter nav (`RecruiterHeader`), preview disclosure only in the banner (header chip says NOTHING RECORDED), link panel neutral, `danger` buttons are ink (red = recording only).

Not done: the report player has no audio for the seeded interview (recording null), so quotes show timecodes but do not play.
