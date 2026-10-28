# Agent Update — PR125 Testing CCC schedule read

**Date:** 2026-10-27
**Agent/model:** Codex
**Repository:** Alex1122341/Teaching-assignment-azure
**Task status:** PARTIAL

## Work performed

Extended the unpublished Testing Firestore runtime and loopback HTTP transport with `GET /api/v1/ccc-schedule`. The reader pins `vista-teaching-lab/(default)`, uses only the isolated `paws_testing_ccc` collection, validates the academic year, refuses unmarked data and more than 2,500 records, selects only public fields, and uses the shared name formatter. Existing CCC API authorization and projection enforce the original response contract. No Production runtime files were changed.

The local synthetic seed includes one CCC fixture, but no live seed or account provisioning has been run. The Auth/Firestore emulator run passed 2/2 tests, including a real HTTP CCC request using an emulator-issued Testing identity and checks that private UCID and purpose do not reach the response. This Admin SDK test bypasses Firestore Security Rules. The targeted suite including CCC, prior Testing slices, environment/deployment and server runtime passed 86/86. The rules test was extended to check browser denial for the new collection; its live-rules emulator run remains to be repeated after this change. Prior exact-head CI on `8c2f1e6` passed Testing parity and SQL acceptance and skipped `test_and_build`; obtain fresh CI after later changes.

## Current user direction and remaining work

The user instructed that Testing environment configuration, deployment and runtime scripts be centralized in a dedicated folder, while automated tests remain in `tests`. Preserve compatible entry points and update active callers before removing old implementations. Continue this relocation without changing Production or weakening verification. Only Testing profile, calendar, leadership-directory and CCC schedule reads are implemented; writes, faculty dashboard, assignments, AFC, DOE, swap/approval, history, reports, identity activation, host deployment and browser acceptance remain incomplete. No live Testing API, site publication or PR merge has occurred.
