# Agent Update — PR125 Testing leadership directory read

**Date:** 2026-10-27
**Agent/model:** Codex
**Repository:** Alex1122341/Teaching-assignment-azure
**Task status:** PARTIAL

## Work performed

Extended the unpublished Testing Firestore read runtime and loopback HTTP adapter with `GET /api/v1/dashboard/leadership-directory`. The adapter reads only the isolated `paws_testing_leadership` collection, pins the lab default database, filters by academic year, requires the synthetic marker and fails rather than silently truncating at 10,000 rows. It selects only fields needed by the existing authoritative role-status and directory projection; the shared API enforces existing identity and role rules and strips IDs, email, UCID, DOE and other fields from the response. This does not change Production runtime files.

Added synthetic HICC and VISC documents to the transactional, collision-safe seed; the seed and disabled-account helper have not run live. With cached live rules loaded in the emulator, direct browser reads of all three Testing collections were denied; the overall rules suite still failed the pre-existing cross-project emulator and raw-session privacy checks. The targeted identity/seed/HTTP/profile/calendar/directory tests passed 25/25; the wider targeted suite including deployment/environment and server runtime passed 83/83. The Auth/Firestore emulator passed 2/2 tests, including a real loopback HTTP request to the directory with an emulator-issued Testing token and privacy assertions. The Admin SDK bypasses Security Rules. An authorized read-only query against the currently empty `paws_testing_leadership` collection in the real lab Firestore returned HTTP 200 and zero documents; this verifies only the query, not end-to-end application behavior.

## Remaining work

Only profile, calendar and leadership directory reads are implemented. All writes, faculty dashboard, assignments, AFC, DOE, swap/approval, history, reports, privileged identity activation, runtime deployment, browser acceptance and safe PR merge remain incomplete. Existing lab Faculty raw-session privacy and the distinction between live and emulator cross-project checks are documented in preceding updates. No documents, rules, credentials or services were changed live in this step, and Production was not altered. Do not deploy this incomplete runtime or claim Beta parity.
