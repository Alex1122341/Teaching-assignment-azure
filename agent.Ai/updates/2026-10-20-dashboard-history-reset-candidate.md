# Agent Update — Dashboard History presentation reset candidate

**Date:** 2026-10-20
**Agent/model:** GPT-6
**Repository:** Alex1122341/Teaching-assignment-azure
**Task status:** PARTIAL — product candidate; governance, PR, CI and live release pending

## 1. Goal
Implement the owner-approved one-time Dashboard History display reset without deleting SQL audit logs. Start future operation tracking from `2026-10-20T21:13:42.660Z`.

## 2. Starting breakpoint
- Base branch: `main`, SHA `15dd7390d613bd3bd2163f411b81bc4ffdf22fd1`
- Work branch: `feat/dashboard-history-reset-baseline-20261020`
- Reviewed product commit: `573dbe468eb23b177d92317f9a6e3ec04d2c94ec`
- Live real-data API when inspected: old `6bc6a640986e2aebf4b3084cde43addedd8a9593`, PID 14052; newest accepted Stage `15dd7390d613bd3bd2163f411b81bc4ffdf22fd1`, PID 2848.
- Existing live and Stage SQL /health/sql returned ok; all 27 write gates had been verified equal.

## 3. Work performed
- Read existing front-end/API/SQL history projection, grouping, snapshots, CSV and XLSX implementation; reused rather than added tables or a duplicate history service.
- Added fixed server-origin UTC timestamp read bounds for Dashboard only and defense-in-depth event filtering.
- Added explanatory Dashboard reset notice.
- Added tests for exact boundary, oldest events, malformed events, filter spoofing, SQL time bounds, empty range and My/Calendar non-regression.
- Documented rollback and release safety.

## 4. Files
`server/src/history/change-history-api.js`; `server/src/data/sql-change-history-repository.js`; `change-history.js`; `change-history.css`; `server/test/change-history-api.test.js`; `server/test/change-history-routes.test.js`; `tests/change-history.test.js`; `docs/dashboard-history-reset-baseline-20261020.md`.

## 5. Architecture and data
Original AuditEvent, DoeAuditEvent, ChangeHistoryContext, receipt and business SQL tables remain authoritative and immutable. No SQL reset, migration, deletion, reimport, DOE recalculation or role/write-gate modification. Only Dashboard read behavior changes.

## 6. Tests / CI
Product commit created; explicit separate immutable freeze promotion, PR review, main CI and live verification are pending. Do not describe code or unit additions as a passed CI until verified.

## 7. Live operations
RDC read-only port and SQL health checks, server UTC capture. SQLCMD optional local connection failed TLS principal validation; did not bypass certificate verification. No DB write or API/Hosting cutover so far.

## 8. Exact breakpoint / next safe step
Promote frozen trust anchor to exact product commit `573dbe468eb23b177d92317f9a6e3ec04d2c94ec`, recalculate affected static hashes, run root/API CI and inspect any failures. Merge only if accepted; then stage/release exact-main University API and Hosting with rollback readiness. Verify authenticated History display and no changes to 27 gates or source audit counts. Do not rerun SQL055/540, CCC, AFC or trainees applications.
