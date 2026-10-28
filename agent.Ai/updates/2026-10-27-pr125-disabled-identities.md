# Agent Update — PR125 disabled synthetic Testing identities

**Date:** 2026-10-27
**Agent/model:** Codex
**Repository:** Alex1122341/Teaching-assignment-azure
**Task status:** PARTIAL

## Work performed

Added `tools/testing/firestore-identities.js`, an unpublished helper that can create only the two fixed synthetic Faculty Auth identities, initially disabled, in `paws-testing-ucvm-20261022`. Before calling Firebase Auth, it requires the exact inactive synthetic profile from the Testing fixture in `vista-teaching-lab/(default)`, a 16–128 character password supplied by the caller, and the pinned Auth project. It never creates an Owner account, updates/reuses an existing account, enables a user or logs a password. Auth provider failures return a generic error. Because creation is external, an uncertain provider outcome can leave a disabled account; do not reset or overwrite it blindly.

Unit tests cover target/project/database mismatches, privileged role rejection, altered profile, password validation, collision and generic errors. The focused identity/seed/HTTP/profile/calendar/deployment/environment/runtime run passed 79/79. The opt-in Firestore/Auth emulator run passed 2/2 tests and verifies the seeded profile remains inactive, creates the corresponding disabled Testing Auth user, refuses duplicate creation and rejects password sign-in. No persistent live identity was created and no seed or account was enabled in the real projects.

## Remaining work

Identity activation and its audit/rollback handling need a separate trusted workflow. The minimal seed does not cover full Beta functionality. The Testing runtime is an unpublished two-route read slice, not a complete backend. Implement remaining business repositories, audit and stale-write protection, trusted DOE, verified credentials, host staging, browser acceptance and safe merge; preserve existing lab data and Production. Live cross-project control and the existing lab privacy finding are documented in `2026-10-27-pr125-live-auth-control.md`; the targeted Testing index is READY as described in `2026-10-27-pr125-testing-index.md`.
