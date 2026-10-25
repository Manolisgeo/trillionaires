# NOTES ui-recruiter
- Redraft: no in-place redraft endpoint exists, so Redraft POSTs /api/roles with the same title/company/JD and navigates to the new role. The old role stays in the catalog. An in-place `POST /api/roles/[id]/redraft` would be cleaner.
- Ledger shows "Prepare interview" (POST /api/interviews) for candidates with research done and no interview, since nothing else in the recruiter flow creates one. If the apply/review module creates the interview, this is harmless.
- Ledger candidate names link only once an interview exists (report if done, else /interviews/[id]).
- Interview page links to /room/[id]?preview=1 and /reports/[id]; those routes belong to other modules.
