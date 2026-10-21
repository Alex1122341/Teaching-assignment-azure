# Agent Update — Restore grouped Dashboard History from source archive
Date: 2026-10-20
Status: IMPLEMENTED IN BRANCH — CI/PR/release pending at authoring
Base main: 1b4c3fb3be383119039ee170660c395d8e556847
Reviewed product SHA: a6e555424241499abbfeb1f7401dcd4918ca886c
Feature branch: feat/dashboard-history-archive-restoration-20261020

Owner superseded the earlier Dashboard-only reset and requests the original archived operations to be consolidated and displayed in current History. Preserve complete SQL audit logs, no raw JSONL import or deletion, no changes to My History/Calendar Changes, no write-gate changes. Source inventory at export 1792 events, 9175 derived JSON field differences, 2026-10-05 earliest AuditEvent. New Dashboard has all years default; source window begins 2026-10-05T00:00:00Z and maintains trusted end bound. Existing group by receipt/true batch ID, privacy allowlists, snapshots, pagination, CSV/XLSX retained. Tests explicitly cover pre-reset read, date/source bounds, spoof rejection and other scopes.

Changed protected product files: `server/src/history/change-history-api.js`, `change-history.js`; focused test files updated. Preserve 81 static assets, 104 API protected files, and every other source blob. Freeze governance, CI and release must follow separate steps. No SQL DML/DDL or production restart so far.

Next: separate immutable freeze promotion to SHA above, full tests/CI, PR review/merge, exact-main artifact, isolated Stage with 27-gate and SQL/401 acceptance, controlled University API then Firebase Hosting, verification and fallback; no synthetic production writes or source import.
