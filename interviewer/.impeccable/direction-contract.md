# Direction contract — The Reading Room (seed 0358a816)

Emit this verbatim as an HTML comment at the top of the root layout's `<body>` (see SPEC-UI).

THESIS: Kimma.ai treats a candidate's background the way an archive treats a record: every claim catalogued with its provenance, every judgment cross-referenced to the moment it was said. It refuses the category default of an AI dashboard with a glowing orb.

OWN-WORLD: Hollinger blue-grey chrome #2F3B45, cool acid-free board #F4F5F2 (never cream), white catalog cards with a red top rule #C23B2E (red also and only = recording), violet stamp ink #5A4AA8 for everything the AI marks. Type: Public Sans, plus Courier Prime for call numbers and timecodes. Materials: stamps, slip markers, folder tabs, finding-aid outlines.

STORY: The candidate sees exactly what is being asked about and why. The recruiter sees every rating traced to a quote and a timecode. Both know a person decides.

FIRST VIEWPORT: The interview room. The question sits on a catalog card above the CV at page scale, with a violet slip on the line being asked about. The right column holds the AI stamp, the finding-aid phases and the typed transcript. The bottom bar's primary action is "I'm finished answering".

FORM: archival reading room and finding aid; #6 on the grounded list; seed key 0358a816.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Raises (from declined challengers)
- Crouwel: the card-rule unit (24px) is the layout armature; spacing is in 12/24 steps.
- Saville: every role, candidate, interview, claim, quote and rating carries a call number (R-014, C-0388, KM-2026.0142, C-01, Q2.3, T-118).
- Timetable: dense surfaces (transcript, report series, ledger, catalog) use ONE text size (14px); rank comes from weight, case, reversal and rule.
- Feed: exactly one document owns the desk at a time; folder tabs hard-swap it, never tile.
- Specimen: live typewriter readouts (timecode, phase clock, page:line) are the only chrome that moves.

## Signature interaction
The slip marker. When the agent asks about a CV line, repo line or JD line, a violet slip (call tag like "Q2.3") lands in the margin and the line gets a violet wash with a 2px underline. The SAME call tag reappears in the report as that evidence's citation.

## Motion grammar
Stamp-press: state changes land like a rubber stamp (scale 1.04 → 1, 120ms, ease-out, no bounce). The slip slides in from the margin (180ms). Readouts tick. Nothing else moves. Honor `prefers-reduced-motion`: no motion, instant state.
