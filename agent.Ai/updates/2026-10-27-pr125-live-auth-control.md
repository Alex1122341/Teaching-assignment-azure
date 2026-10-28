# Agent Update — PR125 live Firebase cross-project identity control

**Date:** 2026-10-27
**Agent/model:** Codex
**Repository:** Alex1122341/Teaching-assignment-azure
**Task status:** PARTIAL

## Live read-only isolation control

The earlier emulator accepted a PAWS Testing token with a colliding lab UID. To distinguish emulator behavior from the actual service without reading any real user data, created an ephemeral random-email synthetic Firebase Auth user in `paws-testing-ucvm-20261022`, then requested `vista-teaching-lab` Firestore `users/{same UID}` using that token. The current lab rule for this path allows a signed-in user to get its own UID without requiring an existing profile. The real service returned HTTP 403 `PERMISSION_DENIED`.

As a positive control, created an ephemeral random-email synthetic user in `vista-teaching-lab` and made the same request for its own absent UID. The real service returned HTTP 404 `NOT_FOUND`. Both Firebase Auth signups returned HTTP 200 and both accounts were successfully deleted with the respective synthetic ID tokens. No Firestore user/session document was created or read, and no personal data or credential was logged. This is evidence that actual cross-project behavior differs from the emulator in this particular self-path test; it is not a complete live UID-collision or application security audit.

The direct lab Faculty/legacy-role raw-session privacy issue remains reproducible under current rules and is separate from this control. Testing-specific collection isolation, the remaining Firestore backend, trusted DOE workflows, synthetic dataset, dedicated runtime credentials, app-compatible lab privacy repair, live Testing deployment and browser acceptance remain unfinished. See `2026-10-27-pr125-testing-index.md` for the one Testing index created; Production was not modified. PR125 remains Draft.
