# Agent Update — UX-03 Change History check (academic year, keyword, six columns)

**Date:** 2026-11-03  
**Agent/model:** Claude Opus 5.5 (with Sakib)  
**Repository:** Alex1122341/Teaching-assignment-azure  
**Task status:** COMPLETE (PR open for review)

## 1. Goal

Worklist UX-03: check the academic-year filter, keyword search and the existing six columns; fix only what fails ("If already working, do not rebuild").

## 2. Starting breakpoint

- base: `main` `619e7c7` (PR #155 merge; UX-01 and UX-07 merged)
- working branch: `fix/ux03-change-history`
- product SHA: `feb2f74` (see git); previous freeze anchor `4da4598` (governance `7c950e2`)

## 3. Work performed

- Checked with synthetic events through `createChangeHistoryApi`: academic-year filter and year facets correct; six columns (Time, Type/Domain, Session/Faculty, Change From → To, Start/End, By whom) populated; keyword matches course, topic, field, values, change type.
- Found: names display "Last, First" but are recorded "First Last", so searching a name exactly as displayed returned nothing. Fix: keyword search treats commas as separators (both terms and haystack).
- Separate governance commit promotes the one-API-file freeze change; PR155 receipt kept as history.
- No live reads/writes, no deployment.

## 4. Files / components changed

`server/src/history/change-history-projection.js` (filterHistoryRows), `server/test/ux03-change-history-search.test.js`; governance files.

## 5–6. Invariants / data

No authorization, projection, export or SQL change.

## 7. Tests / CI evidence

Server: only the 5 pre-existing Docker/PowerShell failures. Root: only the pre-existing PowerShell failure.

## 8. Live operations

None.

## 9–12. State / next

PR open. Next safe action: review and merge (merge commit), then continue with UX-04.

## 13. DO NOT REDO

The year filter and columns were verified working; do not rebuild them.
