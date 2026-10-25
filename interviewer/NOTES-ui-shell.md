# NOTES ui-shell

- Import shared UI from `@/components/ui` (barrel). Client helpers: `api` in `@/lib/client`, formatters in `@/lib/format` (`mmss`, `callNo.*`, `roman`, `formatDate`).
- Tokens are Tailwind 4 `@theme` colors (`bg-hollinger`, `text-stamp`, `border-rule`, ...), plus `.ruled`, `.slip-highlight`, `.stamp-press`, `.slip-in`, `.tick-dots`.
- Next 15 injects its own empty `<div hidden>` (metadata slot) before the layout's contract comment div in served HTML; the contract is the first child in source.
- Artboards use a 3px violet left rule on quotes/competency cards; kept for EvidenceQuote (contract), not used elsewhere by shell.
- Loading text uses `Cataloguing` (ticking dots); `DemoLabel` renders the dashed synthetic-data stamp for `demoData` records.
- Backend: `Role.draftError` added and set in roles POST failure path; `demoData: true` set on Role and Candidate creation when `isMockMode()`.
