# Agent Update — PR125 Testing activity read slice

**Date:** 2026-10-28
**Agent/model:** Codex
**Repository:** Alex1122341/Teaching-assignment-azure
**Task status:** PARTIAL

## 1. Goal and starting breakpoint

Continue PR #125 toward a working synthetic-only Testing environment. Starting branch `feat/paws-testing-environment` was `e32a157b7b59af659ce2eb6bd2c327031703fd40`; see `2026-10-28-pr125-testing-folder.md`. The owner selected `vista-teaching-lab/(default)` and the university Testing host. No complete backend or Testing deployment existed.

## 2. Work performed and invariants

Added an unpublished Firestore reader for calendar activities under `tools/testing/`, with activity and capability GET routes in the existing Testing-only loopback transport. It uses the shared activity API and person-name formatter, validates the active profile twice, confines Faculty-scoped users to their own Faculty ID, restricts key mappings to administrators, projects a fixed field list, and bounds both activity and mapping reads. Opaque keys are checked against all Faculty IDs. Writes remain unavailable. Added collision-safe synthetic activity and key fixtures to the existing transactional seed; it has not been run live. Automated tests remain under `tests/`.

No production runtime, SQL, DOE, AFC, approval or audit write path was changed. This is a partial read slice, not Beta parity. A synthetic marker alone does not prove data provenance.

## 3. Verification

- `node --test --test-concurrency=2 tests/testing-firestore*.test.js`: 34 passed, 2 skipped emulator-only tests.
- With private Java 21, `PAWS_LAB_EMULATOR_TEST=1` and `firebase emulators:exec --only firestore,auth --project paws-testing-ucvm-20261022 'node --test tests/testing-firestore-emulator.test.js'`: 2 passed. This includes a verified emulator token and a real loopback HTTP activity request. Admin SDK bypasses Firestore rules; this is not live security acceptance. The first emulator run failed because two local tests shared a synthetic Faculty ID; separate IDs fixed the test isolation and the rerun passed.
- Two full root runs were started but stopped after resource saturation/slow historical governance checks. Neither is a completed `npm test`. Historical full-suite evidence must not be relabeled as exact-current-head evidence.
- On starting SHA `e32a157`, GitHub `testing_parity` and `sql_acceptance` succeeded, while `test_and_build` was skipped. Obtain new exact-head CI after this change.

## 4. Live operations and remaining work

No live write, seed, account activation, deployment, service restart or merge occurred in this update. The host supervisor still targets the old SQL design and requires a reviewed Firestore startup and credential design. Dedicated Testing identity activation, the rest of the backend, Faculty privacy in the shared lab app, end-to-end isolation, live browser acceptance and full tests remain incomplete. Do not merge or publish this partial slice as complete.
