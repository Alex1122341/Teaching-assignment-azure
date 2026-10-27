# Agent Update — PR125 synthetic Firestore seed groundwork

**Date:** 2026-10-27
**Agent/model:** Codex
**Repository:** Alex1122341/Teaching-assignment-azure
**Task status:** PARTIAL

## Work performed

Added `tools/testing/firestore-seed.js` with a small deterministic, marked-synthetic bootstrap for the two currently implemented read routes. It contains three test profiles and three sessions, including a shared session, uses reserved `example.test` email addresses and writes only `paws_testing_users` and `paws_testing_sessions`. All profiles are inactive and require a password change until a future trusted process verifies and provisions the matching Testing Auth identities. No Auth account is created by the seed. It is not a full Beta-parity dataset.

The seed pins `vista-teaching-lab` and its `(default)` database, pre-reads every intended path, fails if any exists, and creates all fixture documents in a single Firestore transaction. It never resets or overwrites data. Both existing read adapters also reject a different database within the same project and refuse unmarked `synthetic` profiles/sessions; a marker alone is not proof of data provenance. No live seed was run. `tests/testing-firestore-seed.test.js` verifies synthetic marking, inactive profiles, project/database targeting and all-or-nothing collision behavior; the Auth/Firestore emulator suite exercises a transaction, retry rejection and faculty-scoped calendar projection with synthetic data. The focused HTTP/profile/calendar/index/seed run passed 18 tests; adding deployment/environment and existing server-runtime tests passed 76/76. The final Auth/Firestore emulator run passed both tests, including HTTP authentication and the seed transaction. The Admin SDK bypasses Security Rules.

## Remaining work

The HTTP service remains unpublished and supports only profile/calendar reads. Implement additional Firestore repositories, role-safe write and audit paths, stale-request checks, trusted DOE workflows, secure synthetic identity provisioning, safe frontend integration, API host staging and live acceptance. Existing lab raw-session privacy is separate and unresolved. The Testing index is READY and live cross-project control differs from emulator behavior as documented in `2026-10-27-pr125-live-auth-control.md`. Do not enable users or run the seed live until account ownership and runtime access are verified; no Production changes, deployment or merge have occurred.
