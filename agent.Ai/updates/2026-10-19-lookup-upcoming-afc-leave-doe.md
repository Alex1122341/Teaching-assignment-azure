# Agent Update — Lookup upcoming AFC, Leave and DOE

**Date:** 2026-10-19  
**Agent/model:** GPT-6  
**Repository:** Alex1122341/Teaching-assignment-azure  
**Task status:** PARTIAL — draft PR and CI pending

## Goal
Show current academic-year Sessions and Roles, only future-start active AFC counts, next/current leave date, and authoritative remaining DOE in administrator Faculty Lookup.

## Starting breakpoint
- Base: main 2a541fd7f061c97ad9a848ace2d845aa1dc8eadf.
- Working branch: fix/lookup-upcoming-afc-leave-doe-20261019.
- PR: #121 (draft).
- Runtime: live controlled Beta freeze; no development files are deployed by these commits.

## Work performed
- Inspected current admin lookup rendering, Dashboard SQL AFC count, unified AFC record API, read-only worksheet list, privacy and freeze contracts.
- Wrote focused behavior tests before implementation.
- `dashboard-view-model.js`: Calgary date conversion, upcoming AFC/Leave classifier, Worksheet remaining presentation.
- `faculty-admin.js`: background-load authorized AFC and DOE worksheets, render new lookup summary; no SQL changes.
- `tests/dashboard-view-model.test.js`: date boundary, past/current/upcoming/inactive AFC, RSL/medical/maternity, unresolved/negative/zero DOE.
- `tests/faculty-admin-stage3c-zero-firestore.test.js`: updated initial loading summary assertion.

## Security and domain boundaries
- Admin-only Lookup enrichment uses authenticated existing API endpoints. Self-service mode does not load cross-faculty data.
- RSL/leave remains in AFC history; roster contains only dates, no confidential purpose/reason.
- DOE values use the server-authoritative `remainingDoe` only when status is `calculated`; no browser formula or SQL mutation.
- Complete AFC history in AFC Records remains unchanged.

## Tests, acceptance, and blockers
- Azure Beta Build GitHub Actions started on PR branch; latest run is pending (check exact branch SHA).
- No local root/server test results or independent review yet. **Do not merge/deploy until tests, product review and immutable freeze governance promotion pass.**
- Protected shipped static assets changed; normal freeze CI may block intentionally until separate governance promotion.

## Live operations
No database writes, DOE recalculation, policy publication, Firebase Hosting release, API restart, branch merge or experimental sync.

## Next safe action
Resolve CI/test findings, inspect authorized live-API preview with real Faculty Lookup; arrange separate accepted immutable-freeze promotion for the exact final product commit, candidate/exact-main CI, artifact validation, then authorized Hosting-only release.

## DO NOT REDO
Do not repeat prior AFC 639 import/15 corrections, MASTER CCC413 replacement, appointment/trainee imports or policy draft operations.
