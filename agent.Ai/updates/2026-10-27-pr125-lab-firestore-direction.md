# Agent Update — PR125 Testing Firestore direction

**Date:** 2026-10-27  
**Agent:** Codex  
**Repository:** Alex1122341/Teaching-assignment-azure  
**Task status:** PARTIAL

## Goal and starting breakpoint

PR125 branch `feat/paws-testing-environment` started at `8986f23a1f782f1812ef74c57fe9c3806f57b895`. The owner chose the existing `vista-teaching-lab` Firestore for synthetic Testing data and prohibited RDC and Production mutations. The deployed Beta continues to use SQL.

## Work performed and architecture

- Verified the lab Web SDK config and selected it in Testing configuration. Kept Hosting at the separate `paws-testing-ucvm-20261022` project and added a strict site/project check to the publisher and credential validation.
- Added an unconnected Testing-only Firestore profile reader with a fixed lab project guard, minimal field projection, shared person-name formatting and fail-closed account flags. It relies on its future caller to verify the ID token first; no runtime routes use it yet.
- Read-only Firestore inventory found 22 top-level collections and at least one document in each of `users`, `faculty`, `sessions` and `calendar_sessions`. Their contents were not exported and existing data was not changed.
- The lab database is Standard in `northamerica-northeast1`. Existing data is shared with other lab tooling; do not reset, overwrite, or assume it is synthetic without verification.

## Tests and live operations

- `node --test tests/testing-firestore-profile.test.js tests/testing-auth-configuration.test.js tests/dual-environment-config.test.js tests/testing-deployment-readiness.test.js tests/testing-db-tooling.test.js server/test/runtime.test.js`: 81 passed. `node --test tests/testing-firestore-profile.test.js` passed 4/4 after the final name idempotency assertion.
- `node tools/verify-environment-config.js --repository` passed. Testing artifact build correctly skipped because its API origin is unset.
- No Firestore/Auth mutation, SQL write, Hosting deployment, Production change or merge was performed. The profile reader has no live or emulator acceptance.

## Current breakpoint and next action

The SQL-backed Beta API, Testing host supervisor, write gates, release attestation and deployment still assume SQL. The profile adapter is not wired into an API and is not a complete Firestore backend. Implement and verify Testing-only Firestore repositories and a deployment/runtime that preserve role scope, privacy, audit, stale-write protection, and server-authoritative DOE. Confirm test identities and data safely before any writes. Do not disable production freezes or weaken Firestore rules. PR125 remains draft until full functional and live acceptance.
