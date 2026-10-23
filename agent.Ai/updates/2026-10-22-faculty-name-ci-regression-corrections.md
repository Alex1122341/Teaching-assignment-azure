# Faculty display name PR #131 — CI regression corrections

Date: 2026-10-22
Repository: Alex1122341/Teaching-assignment-azure
Branch: feature/faculty-display-last-first-20261022
Base main: 924cc6761a3b2dfba4f19c2df912436cbd965b43
Previous product candidate: 5948db79e8bccb4170c15a79bbbc127cfe37e155
Corrected product candidate: ba915e99ca06677d58e129f6fb671bd40d21600e

## Verified failure evidence
First GitHub Beta Build (run 39811060720) completed `npm test` with 941 pass, 40 fail, 52 skip. Root failures caused by a handful of presentation-only changes executing in headless/Node tests without `window`, a grouped LAB closure mismatch, four legacy explicit display-name assertions, and a frozen historical CCC release assertion incorrectly tied to the newest anchor. The newly added formatter list test also found lost spaces after semicolons.

## Corrections
- Keep display formatting optional in environment-neutral controllers and fall back to original visible value in tests without a browser global: AFC workflow/approved activity/CCC replacement and CCC viewer.
- Fix LAB detail rendering to pass a locally scope-safe formatting callback.
- Preserve separator whitespace and non-person placeholder labels.
- Update the four legacy actual UI expectations to `One, Ada` / `Two, Bo` / `Three, Cy`, but never rewrite raw fixture names or persistence assertions.
- Keep the 83→85 historical CCC freeze promotion pinned to its **historical product commit**, while the current frozen anchor is the new 18-file presentation-only Product Commit.
- Recompute six affected SHA-256 protected static file hashes after code corrections. New separate governance commit points to `ba915e99ca06677d58e129f6fb671bd40d21600e` with unchanged API freeze/runtime inventory.
- Add/retain tests of structured vs string names, no mutation, role placeholders, independent archive governance, and UI sinks.

## Release boundaries
No SQL scripts, database records, API files, write gates, authentication, or production processes changed. No merge, Firebase release or University API cutover. PR #125 unchanged.

## Next
Observe exact-head GitHub CI result, correct any remaining actual failures, confirm zero unexpected freeze drift and that all screens consistently use `Last, First` without touching business logic. Do not claim acceptance until CI success.
