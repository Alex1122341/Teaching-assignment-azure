# PR #125 — single-site Admin Testing / Firestore go-live gates

Updated 2026-10-28. **Status: NO-GO / Draft / not deployed.** This is the acceptance contract, not a claim that the complete PAWS Testing environment is live.

## Approved user experience

- One public PAWS URL: `https://tester-teaching.web.app`. After an authorized administrator signs in, the Production header offers **Open Testing Environment**.
- The switch uses a tab-scoped mode and reloads only the same known PAWS path. It does not transfer passwords, Firebase tokens, Developer Support contexts, query parameters or hash fragments.
- The boot config makes the environment decision **before** Firebase Auth or PAWS API clients initialize. Production remains `tester-teaching` Auth + `VetMed-Ops` SQL. Testing uses independent `paws-testing-ucvm-20261022` Auth + an isolated Testing API that reads/writes only `vista-teaching-lab/(default)/paws_testing_*`.
- Testing requires its own Testing Auth sign-in. The one-click navigation is not SSO or role impersonation. Server-side authorization still applies; configuring a browser tab to Testing cannot grant new roles.
- A persistent Testing banner, return to Production, Admin persona switch and deterministic reset are required for user acceptance.
- No Testing UI or API is enabled until its pinned API origin and credentials are provisioned. Stale Testing-mode tabs must fail closed and never silently use Production.

## Verified source progress

- Same-origin selector and navigation have unit tests; Testing API CORS requires explicit `allowSameSite:true` and still requires a Testing Firebase token.
- The unpublished Firestore Testing API has read-only `/me`, sessions, calendar activities, CCC, leadership and initial Dashboard Faculty/summary/teaching/roles projections. A **single** synthetic Session PATCH route is now implemented with Firebase role authorization, explicit disabled-by-default write gate, bounded JSON transport, Firestore transaction, date/duplicate validation and synthetic audit record. Every other write/API route fails closed. No DOE calculation is claimed.
- The synthetic seed generator now prepares **383 documents** including **31 fictional Faculty records, 305 sessions (three original, 300 generated, two deliberate conflict sessions), 32 inactive Auth profiles, eight course records**, plus existing CCC, HICC/VISC and activity fixtures. These are source fixtures **not proof of live seeding**.
- Reuse of SQL-backed Beta frontend code does **not** imply Firestore backend parity. The current SQL Testing seed, database reset, Windows supervisor and SQL health checks are historical/SQL-only and must not be described as Firestore-ready.
- `node tools/testing/firestore-release-readiness.js --report` lists missing functionality. `--assert` must refuse release until all route groups and independent live evidence are accepted. The manual Testing deploy workflow calls `--assert`.

## Blocking tasks — complete before any production-hosting switch or Testing deployment

1. Implement **all** required Firestore endpoint behavior, safe writes, transactions, stale edit checks and server-authoritative DOE calculation. See the release matrix for Calendar, Faculty, DOE, AFC, Teaching Assignments, Calendar Activities, CCC, History, Reports, Tasks and Admin persona operations.
2. Finish synthetic fixtures for every state, including AFC pending/approved/rejected, DOE policy/overrides, swap decisions, Teaching Assignment lifecycle, Leave, grouped LAB, rotation, archived History and report data. Never import real people, email, UCIDs, AFC forms or student information.
3. Provision a **dedicated Testing API runtime** on the University host with credentials authorized for the Testing Auth project and scoped lab Firestore access, and a separately verified HTTPS origin. The SQL-only `tools/testing/host` supervisor and SQL-only deploy/probe are **not** a Firestore launch path.
4. Prepare and activate authorized Testing Admin identities with audit and rollback; support safe time-limited role simulations, independent from Production accounts. Ensure the Testing Firebase Auth project explicitly authorizes the Production web origin for same-site sign-in.
5. Investigate/resolve existing `vista-teaching-lab` raw-session Faculty access without breaking the separate experimental app. A Firestore emulator audience test alone is insufficient; record actual cross-project and Faculty scope evidence. Never deploy broad rule changes blindly.
6. Seed only verified unused `paws_testing_*` documents. Acceptance must independently verify all collections and absence of other lab/Production changes, with robust reset, rollback and collision handling.
7. Run all root/server tests, Firebase emulator checks, same-site real browser Admin and Faculty/role UAT, data edit/reload/rollback tests, CORS/401/403 negative tests and both Production/Testing artifact identity checks on the exact release SHA.
8. Verify Production HTTPS/API/SQL behavior and its immutable data/write gates remain unchanged. Confirm same-site Admin open/return works across all PAWS pages. Capture an Owner-accessible signed deployment receipt and manual UAT.
9. Only after those gates pass: merge PR #125, publish the accepted code, validate the deployed source hash, and manually accept the Testing experience. **Green PR checks alone are never deployment authorization.**

## Release decision

**NO-GO** until `firestore-release-readiness.js --assert` passes with verified live evidence and authenticated browser testing. Do not merge, overwrite the lab's shared collections, change Production SQL, or claim Admin Testing parity while any required business API is missing.
