# Agent Update — PR125 Testing Firestore direction

**Date:** 2026-10-27  
**Agent:** Codex  
**Repository:** Alex1122341/Teaching-assignment-azure  
**Task status:** PARTIAL

## Goal and starting breakpoint

PR125 branch `feat/paws-testing-environment` started at `8986f23a1f782f1812ef74c57fe9c3806f57b895`. The owner chose the existing `vista-teaching-lab` Firestore for synthetic Testing data and prohibited RDC and Production mutations. The deployed Beta continues to use SQL.

## Work performed and architecture

- Verified both Web SDK configurations. After reproducing the shared lab rules issue, restored Testing Auth and Hosting to `paws-testing-ucvm-20261022`; the server-side Firestore target stays `vista-teaching-lab`. The publisher and credential validation pin the Testing site and Auth project explicitly.
- Added a Testing-only read runtime for `/api/v1/me` and `/api/v1/sessions`, with fixed lab database project, separate Testing token issuer/audience checks, fail-closed account flags, scoped Faculty queries, bounded results, minimal projections and shared person-name formatting. It reads isolated `paws_testing_users` and `paws_testing_sessions` collections, not the lab app's existing collections. All other routes and every write are unavailable. The runtime is not deployed or connected to the browser; its live cross-project boundary has not been verified.
- Read-only Firestore inventory found 22 top-level collections and at least one document in each of `users`, `faculty`, `sessions` and `calendar_sessions`. Their contents were not exported and existing data was not changed.
- The lab database is Standard in `northamerica-northeast1`. Existing data is shared with other lab tooling; do not reset, overwrite, or assume it is synthetic without verification.
- Read-only Rules API inspection returned live lab Firestore ruleset `996b9224-7f43-49d0-9dcc-ff137ac7316b`, normalized SHA256 `347ee3529972fdf01c465cc6dd7ede24aaec6764d5ed8904c08b85b34fd9370e`; it differs from the local lab rules. `sessions` reads use `privateReader()`, which includes Faculty. A local rules emulator reproduction using the actual live rules and synthetic documents confirmed that a Faculty account can read another Faculty member's raw session and its UCID/DOE fields. A read-only sample of 25 live lab sessions showed those field types are present; no field values are included here. This bypasses the new API's sanitization.
- A second emulator reproduction created the same synthetic UID in the lab profile and the separate PAWS Testing Auth emulator, applied the live lab rules, and requested another Faculty member's raw lab session using the PAWS Testing token. The Firestore emulator returned HTTP 200. Emulator handling of cross-project tokens is not proof of live behavior, but separate Auth projects cannot be treated as a verified safeguard; enforce and test the authorization boundary before deployment.

## Tests and live operations

- `node --test tests/testing-firestore-profile.test.js tests/testing-auth-configuration.test.js tests/dual-environment-config.test.js tests/testing-deployment-readiness.test.js tests/testing-db-tooling.test.js server/test/runtime.test.js`: 81 passed. `node --test tests/testing-firestore-profile.test.js` passed 4/4 after the final name idempotency assertion.
- `node --test tests/testing-firestore-profile.test.js tests/testing-firestore-calendar.test.js server/test/runtime.test.js`: 17 passed.
- After the Testing-Auth/lab-Firestore split, the profile, calendar, deployment readiness, environment configuration and server runtime tests passed 68/68.
- Using the private Java 21 runtime, `firebase emulators:exec --only firestore,auth --project paws-testing-ucvm-20261022 'node --test tests/testing-firestore-emulator.test.js'` with `PAWS_LAB_EMULATOR_TEST=1`: 1 passed, using separate emulator Auth and Firestore projects, emulator-issued tokens and local synthetic documents. The test explicitly refuses non-loopback emulator endpoints. It uses the Admin SDK, so it does not establish Firestore Security Rules coverage or a live cross-project security boundary.
- Local `npm test` completed with 1443 tests: 1344 passed, 46 failed, 53 skipped. All 46 failing test names exactly match the repository's documented Production-only assertion register. This run began before the calendar changes and is not exact-head evidence.
- Exact-head CI for `eb412a43f5716678afdf7bc264431aa2a4b82ebf`: Testing parity passed; SQL acceptance passed; legacy `test_and_build` skipped. The new lab emulator test was not enabled in that CI run.
- `node tools/verify-environment-config.js --repository` passed. Testing artifact build correctly skipped because its API origin is unset.
- No live Firestore/Auth mutation, SQL write, Hosting deployment, Production change or merge was performed. The read runtime has no live acceptance.

## Current breakpoint and next action

The SQL-backed Beta API, Testing host supervisor, write gates, release attestation and deployment still assume SQL. The new read-only runtime is not deployed and is not a complete Firestore backend. The design separates Testing Auth from the lab project and uses new, isolated Testing collections to avoid reusing the lab's raw sessions, but the emulator cross-project UID collision test returned 200; do not treat this as adequate isolation. Existing lab users can still read raw session documents directly under the existing Firestore rules; this pre-existing issue is not repaired. A clean checkout of `Alex1122341/Teaching-assignment` main at `cc7cd33120275d3ac18da84310bc968d1fa32d74` was created separately for investigation; its Faculty Dashboard listens directly to raw session documents, so a rule-only restriction would break its features. Preserve existing lab data, protect privacy, and validate both the app and rules with emulator tests; do not simply deploy a rule-only change. Continue remaining Testing-only repositories, audit, stale-write protection and server-authoritative DOE. PR125 remains draft until full functional and live acceptance.
