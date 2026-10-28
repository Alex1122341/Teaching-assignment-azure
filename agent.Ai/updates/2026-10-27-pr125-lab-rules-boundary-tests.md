# Agent Update — PR125 lab Firestore boundary regression tests

**Date:** 2026-10-27
**Agent/model:** Codex
**Repository:** Alex1122341/Teaching-assignment-azure
**Task status:** PARTIAL

## Goal and starting breakpoint

Continue PR125 and verify security before Testing deployment. Branch `feat/paws-testing-environment` started at `bc3c0be46e879057a2fb30323703e59b3cd12e32`. See `2026-10-27-pr125-lab-firestore-direction.md` for the prior runtime and deployment state. Existing shared lab data and Production must be preserved; no RDC.

## Work performed

Added `tests/testing-lab-rules-boundary-emulator.test.js`. With `PAWS_LAB_RULES_TEST=1` and `PAWS_LAB_RULES_FILE` naming the candidate rules file, it refuses non-loopback emulator hosts and tests a real Testing Auth emulator token with a colliding lab UID, positive access to sanitized `calendar_sessions` and administrator raw-session access, anonymous denial, and denial of Faculty raw-session access including a shared multi-faculty session. It uses only synthetic emulator documents. The test is skipped by default because it requires external rules and the emulator; default CI therefore does not establish these boundaries.

The live rules cached by the prior investigation were tested locally. The cross-project token and other-Faculty private session checks failed, while the sanitized calendar check passed. Emulator cross-project acceptance is not proof of actual live-service token verification. An in-memory/local prototype adding an explicit token audience condition blocked the cross-project test and retained the sanitized calendar test, but both other-Faculty and shared-session checks still failed. A more restrictive local prototype additionally denies raw sessions to Faculty roles. That rule cannot be deployed as-is: the current Faculty Dashboard queries raw sessions, and an app-compatible, correctly synchronized private projection is still missing. Neither prototype was deployed or committed as a rules change.

## Tests and CI evidence

`node --test tests/testing-lab-rules-boundary-emulator.test.js tests/testing-firestore-profile.test.js tests/testing-firestore-calendar.test.js`: 10 passed, 1 emulator test skipped by default. With Firestore and Auth emulators and supplied live rules, the cross-project and raw-session checks failed as expected, and sanitized calendar passed; the shared-session check was added afterwards. With the audience-only prototype, cross-project and sanitized-calendar checks passed, while both private-session checks failed. With the more restrictive local prototype, all 6 boundary subtests passed, but that does not establish whole-app compatibility or complete security. Two `npm test` attempts were stopped after they saturated local resources; the appended concurrency option did not limit Node's file runner on Windows. A correctly ordered `node --test --test-concurrency=3 tests/*.test.js` rerun was started. Use the original live ruleset SHA from the preceding update and reacquire deployed rules before claiming any new live state. Exact-head CI at starting SHA `bc3c0be`: `testing_parity` and `sql_acceptance` passed; `test_and_build` skipped. These checks do not prove Firestore end-to-end acceptance.

## Live operations and remaining work

Read-only cloud billing inspection found billing disabled for both `paws-testing-ucvm-20261022` and `vista-teaching-lab`, and no billing accounts visible to the authenticated identity. Service Usage reported Cloud Run disabled in both projects; Cloud Run service-list requests returned 403, which does not distinguish permission and disabled API causes. A billable Cloud Run deployment therefore has no currently verified billing path; other suitable Hosting/API infrastructure has not been established. Testing Hosting returned HTTP 404 and Production Hosting HTTP 200. No live data, rules, Auth settings, SQL, API service or Hosting mutation; no merge.

The runtime implements only two read endpoints and is not deployed. The other Testing API features, safe Firestore isolation, authoritative DOE handling, host, Testing frontend configuration, deployment and live role acceptance remain incomplete. Do not weaken or overwrite the shared lab rules or break its app. The isolated canonical lab source checkout is `C:\Users\xinyu.zhu1\Desktop\Teaching-assignment-azure-worktrees\lab-firestore-security-20261027` at `cc7cd33120275d3ac18da84310bc968d1fa32d74`; its local rules differ from live rules. Preserve all lab data and reproduce any final rules against the actual current deployed rules before deployment.

Next: design and implement a faculty-specific sanitized session view with correct synchronization across all session mutation paths, prove privacy and application functionality with emulator tests, complete the Testing Firestore backend and deploy only after accepted evidence. A rule-only denial blocks the existing dashboard and is not sufficient. Do not treat the temporary prototype as production-ready or the Admin-SDK emulator test as a rules test.
