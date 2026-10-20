# Agent Update — Faculty Availability Candidate

**Date:** 2026-10-20
**Agent/model:** GPT-6
**Repository:** Alex1122341/Teaching-assignment-azure
**Task status:** CANDIDATE / ACCEPTANCE PENDING

## Goal
Create read-only, single-Faculty availability lookup in the Faculty Dashboard; default future, date onward or historical range, all PAWS teaching/work/AFC/role records.

## Starting breakpoint
Main 6addfb9125066c5dd14ca7a3d7c38be6a01a870a. Branch feature/faculty-availability-single-20261020. No pre-existing SQL-backed Dashboard availability tab.

## Work performed
- Inspected legacy availability lookup, scheduling-task overlap SQL, Calendar Activity, AFC unified, roles, Dashboard API/role conventions.
- Created separate read-only SQL projection and rollback, server API/route/SQL repository, static client/Tab/list module and tests.
- Scope/tenant/role checks at both API and SQL; private AFC reason not exposed; work time unknown is not fabricated; pending leave tentative; roles informational.
- No business/SQL/Firebase write, migration apply, merge, release or gate change.

## Candidate files
database/azure-sql/056_faculty_availability_read.sql; rollback_056; server/src/availability/faculty-availability-api.js; server/src/data/sql-faculty-availability-repository.js; server/src/runtime/swa-faculty-availability-functions.js; swa-sql-runtime.js; faculty-availability.js/css; faculty-admin.html/js; paws-data-client.js; tools/static-assets.json; new focused server/root tests; docs.

## Acceptance/boundary
Candidate CI / freeze governance still required. SQL migration never applied from candidate. No authenticated live SQL/browser evidence. Owner asked to reach launch-ready state before subsequent Codex edits; do not conflate candidate with deployed live feature.

## Next safe action
Run CI, independent code review, SQL disposable acceptance, separately review freeze promotion, controlled API+Hosting release, then authenticated live acceptance. Never replay prior CCC/AFC/MASTER migrations or change DOE policy/gates.
