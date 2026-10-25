# NOTES ui-candidate

- "I'd prefer a human interviewer" is UI-only (confirmation panel). Needs an endpoint, e.g. `POST /api/candidates/[id]/request-human`, persisting a flag on Candidate and surfacing it to the recruiter.
- Failed research has no retry endpoint; the UI tells the candidate to re-upload via /apply/[roleId]. A `POST /api/candidates/[id]/retry` would be better.
- Claim category (kicker) is derived client-side from source kind + keywords since `Claim` has no category field; line numbers ("L.14") are not in `Source`, so only page is shown.
- CV filename is not stored, so "What we read" says "the PDF you uploaded".
- Consent retention copy ("kept only for this hiring decision, delete on request") needs product/legal confirmation.
- Header step ticks use a ✓ glyph as in the comp; swap for an SVG if the glyph rule is enforced.
