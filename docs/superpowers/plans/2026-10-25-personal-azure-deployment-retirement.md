# Personal Azure deployment retirement — implementation plan

> **For agentic workers:** Implement and verify each task with test-first checks. This plan covers a conservative first PR; dependent API artifact migration requires its own protected baseline promotion.

**Goal:** Remove active personal Azure ACA/ACR deployment capability and unnecessary container build, without changing Firebase Hosting, the Windows Node API, VetMed-Ops SQL, or deployed byte-level release rules.

**Architecture:** Keep the existing immutable `.azure-production/app` + `.azure-production/api` CI artifact contract while it remains consumed by Firebase Hosting and frozen API tests. The artifact name and historical `swa-api/` wrapper do not trigger Azure calls by themselves; remove Azure deployment actions first. Follow-up changes to the artifact format must include a dedicated API freeze promotion, test rewrites and exact-source release validation.

**Tech stack:** Node 22, JavaScript node:test, GitHub Actions, Firebase Hosting/Auth, University Windows Node runtime + SQL Server.

**Spec:** `docs/azure-frontend-retirement-audit-20261022.md` and the 2026-10-25 repository audit (Git commit snapshot `87a7f943`), with current `main` inspected before work.

## Global constraints

- Do not merge, deploy, switch write gates, execute live SQL, change Firebase Auth/Firestore, or touch the production server.
- Do not edit `server/src/`, `database/azure-sql/`, or public `frontend/` assets in the first PR.
- Preserve frozen static and API content and keep the exact-main build SHA/artifact checks and Firebase health/CORS/401 gate.
- Retire ACA/ACR GitHub deployment entry points only; continue the local SQL acceptance test workflows.
- Do not delete `swa-api/`, `deploy/aca/Dockerfile`, or change `tools/beta-api-freeze.js` until an independent complete artifact/baseline migration is ready.
- No blanket deletion of `.md` evidence, historical migrations, or files identified only by name; preserve auditable history.

## Review focus

1. A manual workflow dispatch after merge must be incapable of logging into a personal Azure subscription or deploying ACA/ACR.
2. Main/pull-request build must keep both static and API frozen artifact checks while no longer building an unnecessary ACA container.
3. Firebase publisher must continue to require the exact successful main build and unchanged live API authorization/write gates.
4. No obsolete deployment guard tests should fail merely because their retired workflows are absent.
5. Open PR #125 may reintroduce old deployment workflows; identify the rebase/conflict and require its own non-Azure acceptance before merging.

---

### Task 1: Negative tests and live deployment isolation

**Files:** Create `tests/personal-azure-retirement.test.js`.

**Interfaces:** Reads workflow files and the active Firebase publisher; verifies absence of Azure account, registry and Container Apps execution, retention of exact-artifact checks.

- [ ] Write the new test asserting no ACA/ACR workflows and no Docker image build in the active CI.
- [ ] Run node:test and observe the expected failed assertions against current code.
- [ ] Retire Azure deploy workflows; remove cloud-only tag-publish guard and its obsolete tests.
- [ ] Run targeted tests again; verify failed assertions become green.

### Task 2: Preserve and simplify the supported CI build

**Files:** Modify `.github/workflows/azure-beta-build.yml`, `tests/azure-deployment.test.js`, `tests/beta-r4d11c-governance.test.js`, `tests/beta-r4d4-packaging.test.js`.

**Interfaces:** The existing artifact contract `azure-beta-<SHA>` and `.azure-production/app` + `.azure-production/api` is unchanged.

- [ ] Write/update tests for no Docker/ACR/ACA operations in current workflows.
- [ ] Verify old cloud-build assertions fail for the correct reason.
- [ ] Remove the ACA Docker build and unused `npm ci --prefix swa-api` from the CI workflow; keep `npm ci --prefix server`, Node 22, tests, emulator, both freezes and artifact upload.
- [ ] Run targeted build/governance tests.

### Task 3: Documentation and integration guardrails

**Files:** Modify `README.md`, `SETUP.md`, `AGENTS.md`, `docs/README.md`, `docs/azure-frontend-retirement-audit-20261022.md`.

**Interfaces:** These files must describe Firebase + University Windows API + VetMed-Ops as active; label dormant Azure packaging and historical notes clearly.

- [ ] Remove active instructions for Azure ACA/ACR releases.
- [ ] Explain why the `swa-api` + `.azure-production` frozen artifact still remains pending migration.
- [ ] Record PR #125 as an integration concern: no Azure deploy paths should return through its rebase.
- [ ] Check for conflicting current-runbook instructions.

### Task 4: Verification and PR

- [ ] Compare protected files against base and confirm zero changes to `server/src/`, `database/azure-sql/`, `frontend/`, `tools/beta-freeze.js`, `tools/beta-api-freeze.js`.
- [ ] Run `npm test`, `npm test --prefix server`, `npm run test:emulator`, `npm run build:release`, `node tools/verify-beta-candidate.js`, both built artifact freezes via GitHub Actions; inspect checks/logs.
- [ ] Open **Draft PR** from this branch to `main`, with exact tested HEAD, evidence and deferred scopes listed.
- [ ] No merge or deploy.

## Deferred, dependent retirement work (not silently done in this PR)

- Repackage Windows API directly from `server/package*.json` and `server/src/`, then remove `swa-api/`, `deploy/aca/`, `tools/build-swa-api.js`, historical Azure artifact names; promote a reviewed new immutable API baseline, update Firebase publisher and all related tests together.
- Confirm actual runtime SQL driver and identity on ITAPPVETOPSDB01; only then retire `PAWS_SQL_MI_CLIENT_ID`, Azure AD/default logic and old personal Azure SQL reset/import tooling. Preserve VetMed-Ops migrations, rollback and acceptance scripts.
- Review dormant Teaching Assignment foundation and duplicate asset packaging; avoid deleting production data/read paths merely because their names are old.
- Compact `agent.Ai/PROJECT_STATE.md` and `TASK_CHAIN.md` only after extracting current state into a concise source and preserving decision/rollback evidence. Historical MD/PNG deletion requires explicit reference mapping.

**Completion criteria:** A draft PR exists with executable Azure deployment entry points removed; active CI remains capable of validating the same Firebase static and University API frozen release inputs; no production or data change has been made.