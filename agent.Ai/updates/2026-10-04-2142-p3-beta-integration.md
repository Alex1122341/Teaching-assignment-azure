# Agent Update — P3 Beta integration candidate and governance

**Date:** 2026-10-04
**Agent/model:** Codex GPT-6
**Repository:** `Alex1122341/Teaching-assignment-azure`
**Task status:** PARTIAL — exact-head CI passed; authenticated backend acceptance remains blocked by the old deployed frontend

## 1. Goal

Combine accepted P3B3/P3B4 front-end work with the temporary University API ingress, preserve the Stage A base, and complete all independent candidate validation before authenticated backend acceptance.

## 2. Starting breakpoint

- Base branch: `feature/p3-stage-a-activation-prep`
- Base SHA: `45d06cfc5e528409e820fea05a7d8205317b30eb`
- Working branch: `feature/p3-beta-end-to-end-cutover`
- Product commit: `6fc77fb94e0de3aa116c9c4d5743d4aec45da61c`
- Governance commit: `6a197270d7bd65f61871fe55c54476cf1c51f277`
- PR: #47 — `https://github.com/Alex1122341/Teaching-assignment-azure/pull/47` (open, not merged)
- Live baseline: migrations 009/010/011 previously applied; read-only reconciliation matched tables, procedures, and aggregate counts; no authenticated AFC records created

## 3. Work performed

- Added a centralized `paws-api-origin.js` with the temporary public API origin, loaded before the shared data client on the Dashboard and Faculty Admin pages.
- Updated API-client origin use, static manifest, UI/client regression coverage, freeze baseline, artifact verification, and Azure static deployment convergence checks.
- Reconciled live SQL/runtime metadata read-only; verified external Quick Tunnel health/auth boundaries and exact Azure Beta SWA CORS behavior.
- Ran local build, repository freeze, API freeze, built static/API artifact freeze, unit suites, and Firebase emulator suite.
- No database writes, Firebase changes, Azure deployment, merge, or authenticated AFC lifecycle were performed.

## 4. Files / components changed

- Product commit: `paws-api-origin.js`, `paws-data-client.js`, `index.html`, `faculty-admin.html`, static manifest, and targeted client/auth/faculty tests.
- Governance delta: frozen static baseline promotion, exact 50-file manifest checks, historical P3B4 anchor retention in tests, deployment static-byte verification, and CRLF-tolerant workflow test.
- Continuity: `PROJECT_STATE.md`, `TASK_CHAIN.md`, this report, and the draft UCalgary IT hardening request list.

## 5. Architecture / invariants affected

- API host is defined once and labelled `TEMPORARY BETA INGRESS` for replacement after institutional ingress is provisioned.
- Browser continues to send Firebase bearer authorization with `credentials: omit`; 401-only forced token refresh/replay and PDF binary handling remain in the data client.
- SQL remains private; Quick Tunnel target is loopback API port 18787 only.
- No decisions about long-term production hosting or least-privilege identity are made here.

## 6. Data / algorithm changes

No schema, workflow, identity-matching, authorization, or data changes. No live AFC request/artifact was created.

## 7. Tests / CI evidence

- `npm test`: 686 total / 657 passed / 29 skipped / 0 failed.
- `npm run test:emulator`: 686/686 passed using Firebase Auth and Firestore emulators.
- `npm test --prefix server`: 270/270 passed.
- `node tools/build-beta-release.js`: passed.
- `node tools/verify-beta-candidate.js`: passed; 50 static files and 32 API runtime files, zero drift.
- `node tools/beta-freeze.js --artifact .azure-production/app`: passed, 50 protected files, zero drift.
- `node tools/beta-api-freeze.js --artifact .azure-production/api`: passed, 32 runtime files, zero drift.
- Node available locally is 24.19.0. Hosted Azure Beta Build on Node 22 must validate the exact pushed candidate; run ID not yet available.
- Azure Beta Build run `37240070237` passed on exact SHA `6a197270d7bd65f61871fe55c54476cf1c51f277`; root/server/emulator tests, container build, static/API freezes, governance tests, and artifact upload all passed.
- `git diff --check`: passed. Secret-pattern scan found only expected auth/token-related test files; no credential values were emitted by the scan.

## 8. Live operations

### Performed

- Read-only SQL object/count and runtime route checks.
- Existing Quick Tunnel was reconciled to one current HTTP/2 tunnel targeting only `http://127.0.0.1:18787`; external health/auth probes and exact Beta CORS preflight passed.

### Explicitly NOT performed

- No SQL writes, migration reruns, Firebase changes, Azure config changes, deployment, merge, or permissions changes.
- Public Beta read-only check shows the current deployed frontend lacks the new centralized-origin and P3B3 AFC SQL assets. The page has an authorized admin-role UI session, but no credentials or tokens were inspected.

## 9. Blockers and unresolved questions

- Authenticated backend E2E is not proven. The live Beta session is on the old frontend, which cannot exercise AFC submit/approval/artifact endpoints.
- Public frontend deployment remains gated on backend E2E proof; do not bypass that gate.
- A safe pre-deployment authenticated client/preview route is currently unresolved.

## 10. Exact current breakpoint

PR #47 is open and exact-head Azure Beta Build is green. Resolve the pre-deployment authenticated test-client gate with Architect #5/owner. Do not merge/deploy or create AFC business data until the backend E2E gate can be satisfied safely.

## 11. Things the next agent must not redo

- Do not reapply migrations 009/010/011 or repeat accepted source-package/TLS evidence without a relevant change.
- Do not create a test AFC/artifact before authenticated identity and role/scope are confirmed.
- Do not tunnel SQL/RDP/SMB, expose secrets, merge unrelated work, or deploy before the backend E2E gate.
