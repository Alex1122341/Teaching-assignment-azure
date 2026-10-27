# Agent Update — PR125 Testing Firestore calendar index

**Date:** 2026-10-27
**Agent/model:** Codex
**Repository:** Alex1122341/Teaching-assignment-azure
**Task status:** PARTIAL

## Work performed

The user selected the existing university Testing host and allowed RDC. See `2026-10-27-pr125-existing-host-and-http-slice.md` for host inventory and unpublished read-only HTTP work. This update follows it.

The Testing calendar adapter combines `facultyIds array-contains` and a range on `date`. Firestore emulator success alone does not prove a live composite index exists. Read-only index inventory showed the similar existing index belongs to the shared `sessions` collection, not the isolated `paws_testing_sessions` collection. Created one collection-scoped composite index in the `vista-teaching-lab` default database for `paws_testing_sessions`: `facultyIds` array CONTAINS and `date` ASCENDING, with Firestore's generated `__name__` ASCENDING. Live inventory confirmed `READY`, and an authorized read-only query with a synthetic non-matching faculty key returned HTTP 200 and zero documents. The non-deploying specification is recorded in `deploy/testing/firestore-calendar-index.json`; never use it to replace all indexes in the shared database. No existing indexes were deleted or replaced, and no document data, rules, IAM, account, host or Production settings were modified.

The Testing site and API are still not deployed; the branch implements only an isolated two-route read slice. The shared lab rules privacy finding, synchronized faculty-safe projection, remaining Firestore business repositories, audit, stale writes, DOE, Testing identities, API staging, live acceptance and safe merge all remain outstanding. Do not treat index creation as application acceptance.

The expanded rules emulator test applied the cached deployed rules to synthetic documents. Direct browser reads of both `paws_testing_users` and `paws_testing_sessions` were denied for lab and PAWS Testing tokens. The same run still failed the cross-project UID-collision and other-Faculty raw-session assertions, including `editor` and `viewer`; this is not a pass of the overall isolation suite. The separate local-only restrictive prototype had passed the earlier boundary checks but remains incompatible with the existing dashboard and was not deployed. The separate end-to-end emulator run also verified that the HTTP slice returns 401 without a token and rejects the Production browser origin.

The resource-limited full local suite mentioned in the preceding update was stopped after the branch head and tests changed while it was running; it is not exact-head evidence. An earlier full `npm test` at the prior checkpoint had 46 failures matching the documented Production-only assertion register. The 14 focused HTTP/profile/calendar/index tests passed on the working tree before this update. Recheck exact-head CI after the new commits.
