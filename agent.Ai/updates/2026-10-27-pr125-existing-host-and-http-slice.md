# Agent Update — PR125 existing Testing host and Firestore HTTP slice

**Date:** 2026-10-27
**Agent/model:** Codex
**Repository:** Alex1122341/Teaching-assignment-azure
**Task status:** PARTIAL

## Goal and starting breakpoint

Continue PR125 using existing `vista-teaching-lab` and the university Testing host, preserving Production. The user explicitly allowed RDC and chose `ITAPPVETOPSDB01`, `P:\PAWS\Testing\Host`. Previous committed branch head was `8b4d8c6e67b59a199f85df96bc6a859b03cc8140`; see `2026-10-27-pr125-lab-rules-boundary-tests.md` for the security background.

## Work and environment

Read-only RDC inspection confirmed the server is online as `UC\sa-xinyu.zhu1`. The Testing root exists but `versions` and `releases` are empty. Node v22.23.2 and cloudflared 2026.9.3 are installed; Firestore HTTPS is reachable and Firebase signing certificates returned HTTP 200. The designated Testing port 18788 is not listening; another listener exists on 127.0.0.1:18789 and must not be altered. The Firebase CLI has a user login; do not repurpose Production credentials for Testing. Project IAM permission checks report that the current operator can create service accounts and keys and change project IAM, but no new account, key, permission or live data was created. Obtain a dedicated least-privilege Testing runtime identity only after its exact required access is reviewed.

Added an unpublished Testing-only HTTP transport in `tools/testing/firestore-http.js` with fixed 127.0.0.1 binding, Testing port 18788 (or ephemeral test port), exact Testing Hosting CORS origin, GET-only `me` and `sessions` routes, no fake SQL health, no-store responses, and generic errors. It wraps the existing token-verifying, lab-project-pinned read runtime; it is not started or staged on the server. Added HTTP tests and extended the opt-in Auth/Firestore emulator test to drive the real HTTP adapter using synthetic data. The code does not implement other endpoints or writes.

Expanded `testing-lab-rules-boundary-emulator.test.js` to cover `editor` and `viewer` legacy Faculty aliases. A first local rules prototype denied raw sessions to `faculty`, `hicc`, and `visc` but still allowed both legacy aliases to read another Faculty's raw session. A second local-only prototype denied all five roles and passed the boundary tests, but it remains incompatible with the existing Faculty Dashboard, and full rules security and application compatibility are not established. No rule was deployed.

## Tests / CI / live operations

The HTTP, calendar and profile targeted tests passed 13/13. With `PAWS_LAB_EMULATOR_TEST=1`, the Auth and Firestore emulator test passed 1/1 using a Testing Auth emulator token, synthetic Firestore data and a real loopback HTTP request. Its Admin SDK bypasses Security Rules. The expanded rules test passed against a second local-only denial prototype, including both legacy roles; the prior narrower prototype failed on them. The complete root test command with correctly positioned `--test-concurrency=3` was started separately; it was not exact-head evidence for later changes. Exact-head CI on `8b4d8c6`: Testing parity and SQL acceptance passed, `test_and_build` skipped. These do not establish Firestore end-to-end or live acceptance. See latest CI for subsequent changes.

No host files were changed, no service or tunnel started, no SQL/data/rules/Auth/IAM/Hosting mutation, and no merge. No live Testing API or functional Testing site exists. Browser access, all other API features and trusted DOE operations remain unimplemented or unverified. The direct lab rules leak, shared-session privacy and faculty-dashboard-compatible projection/synchronization must be addressed before release. Do not publish a rule-only denial or pretend the HTTP slice provides Beta parity.
