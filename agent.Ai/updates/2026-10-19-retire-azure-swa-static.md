# Agent Update — Retire unused Azure Static Web Apps static hosting

## 1. Task and authority

- **Owner instruction:** Simplify Beta codebase; no longer intends to use Azure Static Web Apps static publishing.
- **Repo:** `Alex1122341/Teaching-assignment-azure`
- **Starting main:** `9fcabc04d923fc92228f81157eef67bbb93a5b93`.
- **Working branch:** `chore/remove-retired-azure-swa-static-20261019`.
- **Scope:** source-only deletion and corresponding tests/docs. No cloud resource/secret/SQL mutation.

## 2. Mandatory feature reuse & repository inspection

- Active Firebase browser hosting: `.github/workflows/firebase-hosting-deploy.yml`, `firebase.json`, `tools/build-static.js`, `tools/static-assets.json`.
- The immutable combined GitHub Actions CI artifact is built by `.github/workflows/azure-beta-build.yml` and `tools/build-beta-release.js`; despite its historical name this is **not** an SWA static deploy and must remain.
- `tools/beta-freeze.js` retains manifest union, Git blob-backed immutable baseline and artifact content comparison. Its former SWA routing-config existence check was extraneous to the Firebase manifest.
- University Windows API actively imports `server/src/runtime/swa-sql-runtime.js`; `swa-api/` and `server/src/runtime/swa-*` continue to be built and frozen for separate API/ACA packaging; retain.
- Azure ACR/ACA flows and Azure SQL import/migration tests are separate backend functionality and remain, including `deploy/aca/Dockerfile`.
- The old manual SWA deployment workflows were `.github/workflows/azure-beta-deploy.yml` and `azure-beta-static-deploy.yml`; `tools/deploy_azure_static_web.ps1` was a standalone SWA token/CLI deployer; `staticwebapp.config.json` was a redundant Azure redirect duplicated in `firebase.json`.

## 3. Files removed

- `.github/workflows/azure-beta-deploy.yml`
- `.github/workflows/azure-beta-static-deploy.yml`
- `tools/deploy_azure_static_web.ps1`
- `staticwebapp.config.json`
- `tests/static-release-workflow.test.js` (asserted only the deleted SWA workflow)

## 4. Existing behavior preserved and code changed

- `tools/build-beta-release.js`: no longer copies the SWA-only route config into the otherwise unchanged combined `app/` + `api/` artifact.
- `tools/beta-freeze.js`: dropped redundant SWA config sentinel; still checks artifact directory and **all 81** frozen static manifest paths against immutable reviewed blobs.
- `.github/workflows/azure-beta-acr-publish.yml`: removed obsolete `app/staticwebapp.config.json` check; frozen app and API artifact verifications remain.
- Replaced SWA tests with current active Firebase Hosting + retained combined build/API invariants in `tests/azure-deployment.test.js`, `tests/hosting-boundary.test.js`, `tests/beta-r4d9b-cutover.test.js` and `tests/beta-r4d11c-governance.test.js`.
- `SETUP.md` now describes the active Firebase and University API architecture rather than instructing release to retired Azure SWA.
- `tools/README.md`, `AGENTS.md`, `agent.Ai/ARCHITECTURE.md`, `agent.Ai/MODULE_MAP.md`, `agent.Ai/DECISIONS.md` updated for boundary and historical status.
- Dated old design documents and Git history retained as audit evidence, not live instructions.

## 5. Safety, CI and release gates

- No production Hosting deploy, API redeploy, SQL mutation, Firebase rules/index changes, data import/recalculation or cloud Azure resource deletion.
- Feature PR CI must pass before merge. Historic frozen static and API baseline anchors are **unchanged**; no protected runtime bytes changed.
- Validate that the Beta Build still creates and checks both app and API artifacts, and Firebase Hosting-only workflow accepts exact-main CI artifact without SWA config.
- If the Azure SWA resource should also be decommissioned, that is a **separate Azure infrastructure action** requiring resource dependency and costs review. The old `AZURE_STATIC_WEB_APPS_API_TOKEN` secret may remain in GitHub/Azure and should be revoked separately after administrative review; never print secrets.

## 6. Exact breakpoint and next steps

Product cleanup implemented on the branch. Open a reviewed PR, wait for full CI and address failures, then if authorized merge and verify exact-main CI. Cleanup by itself does not update the live UI or deploy new artifacts. Preserve all existing SQL, runtime security gates and historical backfill receipts; do not replay them.

