# PAWS Beta Module and File Map — current 2026-10-15

**Repository** Alex1122341/Teaching-assignment-azure; reviewed main 0d4b4d9. This replaces an old BETA-R1 map that described managed Azure SWA API as the active deployment. Legacy adapters remain in source but **University Node API + Firebase Hosting is the accepted Beta path**.

## 1. Frontend / page shells

| Files | Owner / user-facing functionality |
| --- | --- |
| index.html; timetable.js; timetable.css | Calendar Day/Week/Month/List; filters, Session details/creation/edit, instructor management, schedule selection/export, LAB grouped detail, Tasks and SWAP entry |
| paws-data-client.js; paws-api-origin.js; paws-auth-continuity.js; paws-login-performance.js | Authenticated API boundary, Firebase ID token continuity and temporary HTTPS University API ingress |
| faculty-admin.html; faculty-admin.js; faculty-admin.css | Faculty Dashboard: Lookup, Teaching Summary, Roles/Appointments, DOE Overview/List/Worksheet, AFC Records |
| faculty-admin-management.js; faculty-admin-enhancements.js; faculty-admin-afc-records.js; faculty-admin-afc-batch.js | Edit/Archive/Restore Faculty; precise AFC controls, batch and cancellation |
| faculty-admin-doe-rulebook.js; faculty-admin-doe-policy.js; faculty-admin-doe-worksheet.js; faculty-admin-doe-edit.js; faculty-admin-doe-manual.js; faculty-admin-doe-renderer.js | Annual DOE policy maintenance/selector editor; audited manual DOE, target/worksheet and review evidence |
| teaching-assignments.html; teaching-assignments.js; teaching-assignments.css | Scoped HICC/VISC work queue, contribution suggestion, ADFAD finalization, published releases |
| swap-workflow-sql.js; swap-workflow-sql.css | Session SWAP source snapshot, request inbox, review/apply UI |
| afc-workflow-sql.js; afc-form-*; afc-timetable-panel.js | Self-service absence form, signature/request and SQL flows |
| user-management.html; user-management.js; faculty-access.js | Legacy Firebase/Firestore account, password-reset and old HICC groups (SQL BaseRole stays server-side) |
| developer-support.js; workspace-tasks.js; workspace.css | 30-minute Developer delegation + Undo; all-year Tasks panel |
| lab-session-detail.js | Grouped existing LAB/SRL detail with real source intervals and row-level actions |
| password.html; password.js | Password management |

No automatic Microsoft Graph or Brightspace/D2L synchronization module is proven in current main. Exporting .ics and a legacy Outlook package is not an API integration.

## 2. University Node API and authorization

| Files | Owner |
| --- | --- |
| server/src/runtime/university-api.js; university-http-server.js; swa-sql-runtime.js | Current loopback Windows API runtime, HTTP/CORS, Composition root; legacy name swa-sql-runtime is not proof of SWA hosting |
| server/src/auth/firebase-admin.js; firebase-sql-auth.js; role-policy.js | Token validation, exact SQL identity, role normalization and allowlists |
| server/src/data/sql-connection.js; sql-user-repository.js; write-gates.js | Encrypted Windows SQL connection, transactional support, SQL profile and 20 independent exact-true gates |
| server/src/data/data-api.js; sql-session-repository.js; dashboard-api.js; sql-dashboard-repository.js | Timetable and Dashboard read/authorized Session and Faculty writes |
| server/src/teaching-assignment/teaching-assignment-api.js; server/src/data/sql-teaching-assignment-workflow-repository.js | HICC/VISC/ADFAD package authorization, revision, contribution, finalization and publication |
| server/src/swap/swap-api.js; swap-domain.js; server/src/data/sql-swap-repository.js | SWAP request/revision/decision API, SQL scope/transactions |
| server/src/afc/afc-request-api.js; afc-approval-api.js; afc-approved-artifact-api.js; server/src/data/sql-afc-* | AFC self-service, admin create/batch/cancel, approved artifact, source privacy |
| server/src/doe/doe-api.js; doe-policy-service.js; doe-calculation-service.js; doe-worksheet-service.js; doe-reserve-service.js | DOE API, annual policy lifecycle, calculation facts and worksheet/reserve |
| server/src/domain/doe-rule-book.js; doe-calculator.js; doe-policy-engine.js; doe-formula.js; doe-course-catalog-2026-27.js | 34 Guidelines reference rows; deterministic fallback; selector/formula and documented exact course mapping |
| server/src/doe/doe-session-service.js; manual-doe-service.js; doe-target-override-service.js; doe-workflow-preview-service.js | Session triggered DOE, negotiated adjustments, target overrides and preview |
| server/src/support/support-service.js | Developer-only delegated context and guarded SQL rollback/Undo |

## 3. SQL definitions and tools

- database/azure-sql/001–037: versioned Schema SQL, rollback scripts and SQL acceptance. Current major domains: Faculty, Session/SessionAssignment, AFC, Teaching Assignment, DOE, SWAP, Developer Support, RoleAppointmentSchedule.
- tools/azure_sql_migration/*; tools/build_azure_sql_import.py: historical deterministic source import/reconciliation. Initial empty SQL import **already completed**.
- tools/populate-current-doe-rulebook.cjs; tools/rationalize-current-doe-rulebook.cjs; tools/apply-confirmed-master-doe-allocations.cjs: approved DOE source/Draft and exception processing. Do not rerun prior live corrections.
- tools/build-static.js; tools/beta-freeze.js; tools/beta-api-freeze.js; tools/static-assets.json; tools/beta-baseline.json: static build and pinned immutable reference checks. Freeze product anchor is not an arbitrary mutable JSON.
- .github/workflows/firebase-hosting-deploy.yml and azure-beta-* workflows: preserved CI/release tooling; the actual directed Oct14 release used Firebase Hosting-only CLI after a stale DOE-off workflow gate stopped before deploying.

## 4. Documentation and release

- AGENTS.md; agent.Ai/{README,AGENT,ARCHITECTURE,DOMAINS,DATA_MODEL,WORKFLOWS,ALGORITHMS,TEST_RELEASE,PROJECT_STATE,TASK_CHAIN,DECISIONS}.md; agent.Ai/updates/*.
- docs/current-doe-rulebook-import-20261011.md; docs/doe-source-rationalization-20261011.md; docs/afc-record-management-lab-release-20261013.md; docs/PAWS-UCalgary-IT-Production-Hardening-Requests.md.
- Tests: tests/* browser/domain regression, server/test/* SQL/API/DOE/SWAP/TA, database/azure-sql/* acceptance and GitHub Actions CI. Code in open PRs is **not** part of main.

## 5. Unmerged branches to inspect independently

As of review: Draft #97 architecture/design, #98 Calendar working activities/AFC source migration, #99 admin DOE/availability SWAP preview (stacked on #98), #100 scoped scheduling conflicts/Tasks (stacked on #99/#98). Never use one PR's implementation as evidence of a deployed feature.
