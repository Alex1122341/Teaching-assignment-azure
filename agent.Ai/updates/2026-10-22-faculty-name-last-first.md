# PAWS Beta faculty-name presentation-only promotion — 2026-10-22

- Repository: `Alex1122341/Teaching-assignment-azure`
- Base: `main` at `924cc6761a3b2dfba4f19c2df912436cbd965b43`.
- Branch: `feature/faculty-display-last-first-20261022`
- Accepted candidate Product Commit: `5948db79e8bccb4170c15a79bbbc127cfe37e155`.
- Feature: display faculty person names as `Last, First` on every identified PAWS Beta screen, including Faculty Dashboard, AFC, DOE, Timetable, SWAP, CCC, HICC/VISC assignments, Teaching Assignments, availability, Trainees, Tasks, account UI. Use shared `faculty-name.js` and small render-time wrappers; preserve raw names, identifiers, matching, requests, exports, SQL tables, role/write gates, and API.
- Static runtime changes: exactly 18 files; all existed in the 85-file protected manifest. No new asset, removed asset, SQL or API runtime change. Prior product trust anchor: `5b135dfc91332a6fad29376d1d88d9acd33fd62a`. Recompute all 18 canonical SHA-256 entries and reanchor the *separate governance commit* to the candidate Product Commit. Confirm through GitHub CI.
- Risk/limitation: when data offers only an unstructured name such as `John van der Meer`, the default final-token fallback cannot reliably infer the complete family name. Structured `preferredLastName` takes precedence and retains compound surname spelling. Format only display text, not canonical records.
- Tests: new `tests/faculty-name-display.test.js`, updated AFC display expectation, new governance invariants. These tests have been authored but **not yet reported as executed**; await current PR GitHub CI and explicit acceptance. A failed freeze, UI, or API test is not a pass.
- Live operations: **NONE** (no merge, SQL, API cutover, Firebase Hosting deploy). PR #125 untouched.
- Next: run focused and full PR CI, review any rendering and record-linkage failures, accept product/governance change only with zero unexpected drift; merge/deploy by authorized separate release operation.
- Never redo prior SQL migrations or update DB/UI storage just to reorder faculty display text.
