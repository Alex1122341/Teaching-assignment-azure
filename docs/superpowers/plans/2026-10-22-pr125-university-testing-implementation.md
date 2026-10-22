# PR125 University Testing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Execution method already selected: implement sequentially in this session, then obtain independent whole-branch product and freeze-governance review.

**Goal:** Release existing PR125 with its Testing API on VET-C31293 and an independent synthetic VetMed-Ops-Testing database on ITAPPVETOPSDB01, preserving the real Production database.

**Architecture:** Extend the existing environment, SQL/reset, Firebase and artifact/release tooling. Bind online Testing to an exact approved server/database/UUID and verify that target on the same SQL connection used for each business/admin batch. Stage the desktop API locally; a main-defined workflow verifies it and publishes the matching Testing frontend before coordinated University API/Production Hosting release.

**Tech Stack:** Node22, CommonJS, node:test, mssql11/msnodesqlv8/ODBC18, University SQL Server, PowerShell5.1-compatible operational scripts, Firebase Auth/Hosting, Cloudflare, existing GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-22-pr125-university-testing-design.md` — approved by Owner on2026-10-22. Supersedes the online-LocalDB draft.

## Global Constraints

- Existing worktree: `C:\Users\xinyu.zhu1\PAWS-DOE-Preview\.worktrees\startup-recovery-20261017`, branch `feat/paws-testing-environment`, existing PR125. Planning base7a6a9c3f82c7adaaec4beb6d6ed7c4010c9793bd; revalidate remote/main before execution.
- Online API host `VET-C31293`, `127.0.0.1:18788`; SQL physical server `ITAPPVETOPSDB01`, exact new DB `VetMed-Ops-Testing`; Production DB remains `VetMed-Ops`. Actual certificate/FQDN must be inventoried, never guessed.
- Firebase Testing `paws-testing-ucvm-20261022`; Production `tester-teaching`. Synthetic Testing data only; LocalDB is disposable acceptance only.
- Windows integrated SQL authentication, msnodesqlv8/ODBC18, encryption and remote certificate validation on. Reuse a suitable existing Windows identity; no default requirement for a new University service account.
- No Azure provisioning/mutation, self-hosted runner, public SQL exposure, Production data/schema/role changes, source imports, reset, DOE publication/recalculation, or changes to its27write gates.
- No broad SQL-host allowlist removal or global replacement of Production migration text. Preserve historical receipts and Git-object freezes. Existing product4242426/governance5abbb2c and099 CI are historical source-bound evidence, not proof of new implementation.
- Work through human-required install/credential/grant steps only as authorized at the actual step. Keep blocked steps pending, continue independent tasks, and never relabel a required skip as a pass.
- Before destructive reset: exact target/UUID check, explicit RESET-TESTING, private Testing backup and external receipt. Unknown existing databases/processes/files remain untouched.
- Run commands with verified Node22 PATH, collect exit codes, use locked installs without rewriting locks. Each behavior task uses targeted red/green tests before its implementation; full freeze-dependent suites wait until reviewed promotion in Task7.

## Review Focus

1. A new native pool connection or marker change must not run its first business statement against the wrong DB (Task1, reconnect/concurrency tests).
2. An unfamiliar migration guard, hidden metadata or partial initialization must fail before destructive SQL or cross-database changes (Tasks2–3).
3. Shared SQL server permissions inherited through groups/public/ownership must not be mistaken for independent database authorization (Task3).
4. Malformed private config, rejected credentials or artifact URLs must not leak secrets into exceptions/logs/public receipts (Tasks4–5).
5. An offline desktop, changed tunnel hostname, occupied port or concurrent reset must never become a green deploy or stop an unrelated process (Tasks5–6).

## File and interface map

| Files | Responsibility |
| --- | --- |
| New `server/src/runtime/sql-environment-target.js`; existing `environment.js`, `swa-sql-runtime.js`, `server/src/data/sql-connection.js` | Parse/resolve target, compile bound same-request identity guards, enforce them on both normal/import connections |
| New `tools/testing-db/university-migration-adapter.js`, `university-guard-manifest.json`, `university-admin.js`; existing reset/seed integration | Hash-bound Testing guard adaptation, isolated database creation/reset/restore and permissions |
| New `tools/testing-db/shared-instance-acceptance.js`; existing `local-acceptance.js` | Fresh synthetic same-instance/two-DB and existing two-instance SQL proof |
| Existing `provision-test-accounts.js`; new `tools/testing-db/connection-profile.js` | Shared guarded driver/target configuration for reset/account tools |
| New `tools/testing-host/artifact-attestation.js`, `host-policy.js`, `Invoke-PawsTestingHost.ps1`, `testing-host.template.json` | Artifact provenance, host/path/process policy, stage/start/check/stop and sanitized receipts |
| Existing Testing/preflight/release tools and workflows | Non-Azure provider validation, main-only verified Testing Hosting and exact evidence binding |
| Existing environment configs/rendered assets and freeze manifests/tools | Actual Firebase/HTTPS values and separate immutable promotion |
| Tests listed in each task; dated evidence/runbook/continuity docs | Regression, acceptance, release and restart checkpoints |

New helpers are tooling unless explicitly under `server/src`. Any new shipped API file must be included in artifact/freeze inventories. Do not put host secrets or node_modules in static assets.

---

### Task1: Bind runtime SQL to the actual server/database identity

**Files:** Create `server/src/runtime/sql-environment-target.js`, `server/test/university-testing-target.test.js`; modify `server/src/runtime/environment.js`, `server/src/data/sql-connection.js`, `server/src/runtime/swa-sql-runtime.js`, `server/test/dual-environment.test.js`, `server/test/sql-connection-windows.test.js`.

**Interfaces:** `parseSqlTarget(connectionString) -> {host, database}`; `resolveSqlTarget(env) -> {profile, host, database, physicalServer, environmentId}`; `compileTargetGuard(target) -> {text, params}`. Extend `createSqlConnection` with optional `targetGuard`, consumed by both runtime pools. Existing callers without that option retain their behavior. Target params use a reserved internal prefix rejected in caller params.

- [ ] **1. Write regressions** named `University Testing accepts only the exact host/database pair` and `every SQL request guards its actual connection`. Use a safe fixture env: `PAWS_ENVIRONMENT=testing`, `PAWS_TESTING_SQL_PROFILE=university-testing`, `PAWS_TESTING_SQL_SERVER=itappvetopsdb01`, `PAWS_TESTING_DATABASE=VetMed-Ops-Testing`, UUID`7e570000-0000-4000-8000-00000000c0de`, and a synthetic Firebase project. Pin these assertions:
  ```js
  assert.equal(parseSqlTarget('Server=ITAPPVETOPSDB01;Database=VetMed-Ops-Testing').database, 'VetMed-Ops-Testing');
  assert.throws(() => parseSqlTarget('Server=ITAPPVETOPSDB01;Database=VetMed-Ops-Testing;Initial Catalog=VetMed-Ops'));
  ```
  Matrix: actual Production DB/system DBs, duplicate host/database aliases, missing profile/marker, wrong UUID/server, Production Firebase, local ODBC override, insecure TLS, forged params. Fake-pool tests assert reconnect/concurrent queries each execute the guard before business text and failed guards execute zero business SQL.
- [ ] **2. Run red:** `node --test server/test/university-testing-target.test.js`; expect missing exports/unguarded behavior, not an unrelated setup failure.
- [ ] **3. Implement** exact profile/DB allowlist and same-request bound SQL prologue. The prologue checks DB_NAME/physical server and marker on the actual connection executing the business batch, covering new pooled connections without a recursive db.query bootstrap. Production expects VetMed-Ops and rejects Testing identity; keep explicit LocalDB acceptance isolated. Do not hardcode an unverified FQDN or trust a request-supplied profile.
- [ ] **4. Run green:** `node --test server/test/university-testing-target.test.js server/test/dual-environment.test.js server/test/sql-connection-windows.test.js server/test/testing-persona-routes.test.js`; all executed tests pass, wrong-target spies show zero business calls.
- [ ] **5. Commit** only Task1 paths: `feat(testing): bind University SQL target and runtime batches`.

### Task2: Make Testing migrations and reset safe for the independent DB

**Files:** Create `tools/testing-db/university-migration-adapter.js`, `university-guard-manifest.json`, `connection-profile.js`; modify `tools/testing-db/reset-testing-db.js`; test `tests/testing-db-tooling.test.js` and new `tests/university-testing-migrations.test.js`.

**Interfaces:** `adaptUniversitySql({file, text, sourceSha256, target}) -> {text, sourceSha256, transformedSha256, guardCount}`; `connectTestingProfile(env) -> {sql, pool, target, guardedBatch(text, params)}`; preserve reset `main(argv, env, log)`. Task1 target/guard objects are the only shared target representation.

- [ ] **1. Write regressions:** every forward migration and seed with DB_NAME guards adapts only manifest-listed expressions to VetMed-Ops-Testing; original file hashes remain unchanged. Unknown source hash/count/context, USE/three-part Production reference, hidden-object metadata, wrong marker and non-empty unmarked DB reject. Pin `assert.equal(destructiveBatchCalls.length, 0)` for each rejected reset. A partially initialized marked DB can resume only through explicit reset, never automatic startup.
  Test `an unknown guard hash cannot execute a migration`: `assert.throws(() => adaptUniversitySql({file, text, sourceSha256:'0'.repeat(64), target}), /source|manifest/i)` using a real enumerated migration fixture and Task1's resolved target. Test `a mismatched marker cannot reset`: `assert.equal(destructiveBatchCalls.length, 0)` after the rejected call; neither assertion accepts a connection/setup error as its intended red signal.
- [ ] **2. Run red:** `node --test tests/university-testing-migrations.test.js tests/testing-db-tooling.test.js`; observe the new target is rejected or new adapter missing.
- [ ] **3. Implement** the manifest from actual migration inventory with exact source hashes and recognized comparison spans; preserve Production files and existing documented adaptations. Guard each admin batch on the same connection; the single empty-initialization step uses exact DB/physical-target/metadata checks before marker creation, subsequent batches require marker. Reject cross-target statements, use bounded timeouts and typed parameters. Shared connection helper selects real Windows driver for online profile; no acceptance adapter leaks into deployed runtime.
- [ ] **4. Run green** the same commands, plus `git diff --exit-code -- database/azure-sql` to prove no Production migration edit. Record per-file source/transformed hashes and fixture verification without secrets.
- [ ] **5. Commit:** `feat(testing): adapt guarded migrations for independent University DB`.

### Task3: Prove shared-instance isolation and provision the Testing DB

**Files:** Create `tools/testing-db/shared-instance-acceptance.js`, `university-admin.js`, `tests/university-testing-admin.test.js`; extend `tools/testing-db/local-acceptance.js`; add `docs/dual-environment/12-university-testing-operations.md`.

**Interfaces:** `inspectUniversityTesting({adminDb, runtimeDb, target}) -> sanitized inventory`; `createUniversityTesting({adminDb, target, storage, operator}) -> receipt`; `resetUniversityTesting({adminDb, target, operator, confirmation, backupPath}) -> receipt`. Admin dependency is injected for tests and comes only from approved private server configuration live. Never place it in the desktop runtime profile.

- [ ] **1. Write regressions:** the approved exact DB is the only create/reset target; existing unknown DB fails; confirmation mismatch or failed backup prevents reset; permissions audit includes direct/group/public/ownership/class0 authority and cross-DB chaining/trust/guest; unsuitable runtime identity is not accepted. Pin `assert.equal(receipt.target.database, 'VetMed-Ops-Testing')` and `assert.equal(productionFingerprintAfter, productionFingerprintBefore)` in a disposable same-instance/two-DB run.
  Name the refusal tests `reset refuses a wrong confirmation before backup or SQL` and `failed Testing backup prevents destructive batches`; fake adminDb records `backupCalls`/`destructiveBatchCalls`, both zero for wrong confirmation and the latter zero for backup failure. Name the real SQL case `same-instance Testing reset preserves Production stand-in fingerprint`.
- [ ] **2. Run red:** `node --test tests/university-testing-admin.test.js`; then implement guarded admin entrypoints, private backup/restore receipts, runtime role checks, capacity checks and serialized reset. Initial data/log limits1GiB/512MiB; no server-global change or Production role change.
- [ ] **3. Prepare disposable prerequisites** from official signed Microsoft LocalDB2025/ODBC18 installers. Verify actual Node22/native driver; request human action only when elevation/license/device policy requires it. Run fresh names via `PAWS_LOCAL_ACCEPTANCE_TESTING_INSTANCE=PAWSAccTest20261022A` and `PAWS_LOCAL_ACCEPTANCE_PRODUCTION_INSTANCE=PAWSAccProd20261022A`, then `node tools/testing-db/local-acceptance.js`; run `node tools/testing-db/shared-instance-acceptance.js --instance PAWSSharedAcc20261022A`. Every unknown/pre-existing instance/DB fails ownership checks; cleanup only recorded owned resources. Expected: every SQL assertion passes and stand-in fingerprints unchanged.
- [ ] **4. Inventory and provision live Testing only after green synthetic tests:** read canonical existing University SQL configuration safely, physical server/certificate/storage, existing target name and effective Windows identity permissions. Use existing University admin access to create the new DB if absent, keep TRUSTWORTHY/DB_CHAINING OFF, map only a suitable existing runtime principal to scoped Testing roles, initialize synthetic migrations/fixtures, and capture read-only Production before/after fingerprints. Verify strict-TLS connection from VET-C31293. Missing connectivity/permission is pending; do not infer access-denied from the earlier failed literal-extraction probe or enable public SQL.
- [ ] **5. Run green** Task3 tests plus both SQL harnesses; save private sanitized receipts with actual SHA/engine/driver/operator/target. Commit code and sanitized operations documentation: `feat(testing): verify shared-server database isolation and guarded administration`.

### Task4: Connect Testing Firebase accounts through the guarded Windows profile

**Files:** Modify `tools/testing-db/provision-test-accounts.js`, `tools/testing-db/connection-profile.js`; create `tests/testing-account-windows-profile.test.js`; update `tests/testing-db-tooling.test.js` and operations runbook.

**Interfaces:** `provision-test-accounts.main(argv, env, deps?) -> account summary`; inject Auth/connection dependencies for tests, use Task2 connection helper live. Existing CLI positional options/accountPlan remain compatible; credential values never appear in return/log/error text.

- [ ] **1. Write regressions:** matching Windows/Testing target permits lower-role persona provisioning; wrong DB/UUID or Production Firebase makes zero Auth writes; privileged personas stay switch-only; ordinary reset does not rotate a named operator password. Malformed private env/JSON with sentinel `DO_NOT_LOG_SECRET` must satisfy `assert.ok(!capturedOutput.includes('DO_NOT_LOG_SECRET'))`.
  Name the driver regression `account provisioning selects the guarded Windows connection`; injected connection/Auth spies assert `assert.equal(connectionCalls[0].target.profile, 'university-testing')` and `assert.equal(connectionCalls[0].driver, 'msnodesqlv8')`. Name the privacy regression `invalid credential JSON never reaches public output`.
- [ ] **2. Run red:** `node --test tests/testing-account-windows-profile.test.js tests/testing-db-tooling.test.js`.
- [ ] **3. Implement** shared guarded driver path and sanitized failure reporting. Complete existing Firebase Testing Auth Email/Password, authorized domains and default Hosting with minimum Testing-scoped credentials. Reuse existing login/tooling; record necessary human credential/grant steps pending without copying Production credentials or inventing keys. Provision synthetic sign-ins and explicit named operator through approved tooling; no incidental real-person email.
- [ ] **4. Run green** the same tests; verify actual account provisioning and Testing Firebase token project/disabled-user behavior privately without logging tokens/passwords. Actual deployed API role/cross-faculty checks run in Task8 after the new candidate API artifact exists; do not stage an old099 runtime against the new DB to satisfy this step.
- [ ] **5. Commit:** `feat(testing): provision Firebase accounts through guarded Windows SQL`.

### Task5: Stage and supervise the desktop API with artifact attestation

**Files:** Create `tools/testing-host/artifact-attestation.js`, `host-policy.js`, `Invoke-PawsTestingHost.ps1`, `testing-host.template.json`, `tests/testing-host-artifacts.test.js`, `tests/testing-host-process.test.js`; update operations runbook.

**Interfaces:** `verifySourceArtifact({repository, commitSha, sourceRun, artifact, checkout}) -> verified manifest`; `validateHostProfile(profile, observed) -> approved profile`; `Invoke-PawsTestingHost.ps1 -Action Stage|Start|Check|Stop -ConfigPath <private path>`. Receipts carry source/artifact SHA256/freeze/gates/UTC and `candidate-only|main` provenance, never raw secrets/paths/account emails publicly.

- [ ] **1. Write regressions:** wrong repo/PR head/merge-tree/digest, symlink/path traversal, raw-source instead of CI artifact, wrong machine/user/SQL target, foreign occupied port and malformed secret config reject. Stop affects only recorded verified executable/PID/start-time; Check never starts/stops/resets; concurrent reset prevents Start. Changed tunnel hostname yields NOT_READY rather than dirtying source automatically.
  Name cases `Check has no mutation calls`, `Stop never kills an unowned PID` and `tunnel origin drift invalidates readiness`; assert `assert.deepEqual(mutationCalls, [])`, `assert.deepEqual(killedPids, [])`, and `assert.equal(receipt.status, 'NOT_READY')` respectively using injected process/filesystem fixtures. Host template fields are `computerName`, `windowsIdentity`, `apiPort`, `target`, `firebaseProjectId`, `allowedOrigin`, `gateMap`, `privateRoot`, `releaseManifestPath`; no credential body in the public template.
- [ ] **2. Run red:** `node --test tests/testing-host-artifacts.test.js tests/testing-host-process.test.js`; fake process/filesystem dependencies avoid live side effects.
- [ ] **3. Implement** versioned private root `%LOCALAPPDATA%\PAWS\Testing`, exact Node22/locked API dependencies, hash-pinned manifest/launcher and real runtime startup on127.0.0.1:18788. Use Task1/Task4 profile; run no fake verifier in deployed API. Require8GiB free before setup/reset, bound logs100MiB and scratch/artifact retention2GiB, preserve active/rollback/evidence, reject unsafe cleanup. Spawn helpers hidden; optional current-user logon task is explicitly not an unattended service.
- [ ] **4. Run green** tests and PowerShell parser/policy checks with fake processes and fixture artifacts. Prepare the private host profile and separate Testing tunnel, record its actual origin for Task7; an ingress with no candidate API yet is explicitly NOT_READY. Actual Stage/Start/Check/Stop, SQL/Auth, restart and attestation run in Task8 after Task7 creates the reviewed candidate CI artifact. Do not silently reuse a Production tunnel or mapped admin credential.
- [ ] **5. Commit:** `feat(testing): stage attested desktop API and supervised ingress`.

### Task6: Replace Azure deployment dependencies with verified Testing Hosting

**Files:** Modify `.github/workflows/paws-testing-deploy.yml`, `tools/verify-testing-api-env.js`, `tools/testing-preflight.js`, `tools/verify-release-evidence.js`, `tests/testing-deployment-readiness.test.js`, `tests/azure-deployment.test.js`; retire `.github/workflows/paws-testing-db-reset.yml`, `azure-beta-aca-deploy.yml`, `azure-beta-acr-publish.yml`; update setup/runbook/status/uat docs. Preserve `azure-beta-build.yml` path/artifact names, `deploy/aca/Dockerfile` freeze input and `paws-release-approval.yml` interfaces.

**Interfaces:** `verifyTestingApiEnv(entries, {root, profile:'university-testing'}) -> {errors, gates}` with explicit CLI `--profile university-testing --env-file <private env>`. Existing `findEvidence/checkEvidence` API is retained; Testing evidence additionally binds targetProfile, runtimeAttestationDigest, sourceArtifactDigest, trustAnchor and configured gate fingerprint. Public receipts are sanitized operator attestations plus workflow checks, not fabricated cryptographic runtime proof.

- [ ] **1. Write regressions:** missing Azure IDs are irrelevant to explicit University profile; missing named DB/profile/strict TLS/full gates fails. A manual main-defined deploy must validate exact successful main push build and staged API before Hosting. Offline/wrong-SHA/wrong-origin/gates/anonymous status, branch-authored evidence, skipped job, mismatched attestation digest or stale approval testingRunId fails release checks. `assert.ok(!activeWorkflow.includes('azure/login'))`; retired paths cannot perform Azure mutation.
  Name cases `University preflight needs no Azure identity`, `offline staged API cannot publish Hosting` and `approval cannot substitute another Testing run`. Reuse configRoot/entry builders in the existing suite; assert zero Hosting calls on every probe failure and rejection when `approval.testingRunId !== acceptedTesting.runId`.
- [ ] **2. Run red:** `node --test tests/testing-deployment-readiness.test.js tests/azure-deployment.test.js`.
- [ ] **3. Implement** manual main-only Testing deploy with existing `deploy_testing` job: download exact build artifacts, verify source/freeze/config and supplied sanitized attestation digest, probe staged API/SQL/CORS, deploy only accepted Testing static files at `.firebase-production/app`, verify served hashes, emit evidence only with actual job outcome. Keep branch/provenance rejection and strengthen approval's link to the exact qualifying Testing run. Reset becomes Task3 explicit server-admin operation, not a fake cloud reset job. No desktop/SQL admin secret or remote shell is added to Actions.
- [ ] **4. Run green** both suites plus `node --test tests/dual-environment-config.test.js tests/firebase-hosting-config.test.js tests/startup-recovery.test.js`; review workflow permissions/trigger/source binding and update instructions to remove active Azure requirements while preserving dated historical claims.
- [ ] **5. Commit:** `feat(testing): publish verified University Testing without Azure deployment`.

### Task7: Commit actual environment values, review product and promote freezes

**Files:** Modify `config/environments/testing.json`, `production.json`, rendered `paws-api-origin.js`, `tools/beta-freeze.js`, `tools/static-assets.json`, `tools/beta-baseline.json`, API freeze inventory as required; add `docs/dual-environment-freeze-promotion-20261022-university-testing.md` and `tests/university-testing-governance.test.js`; update continuity/current runbooks.

**Interfaces:** Existing render/build/freeze CLI contracts remain. The product commit contains actual public Firebase/HTTPS configuration and all accepted runtime changes; a separate governance commit anchors exactly that product with unchanged protected bytes and full historical/current union.

- [ ] **1. Write governance regressions:** preserve historical anchors/receipts, all current/historical protected paths, original binary/PDF bytes and exact downloaded runtime assets. Pin `assert.equal(production.peerSiteUrl, testing.siteUrl)` and ensure only actual Testing Firebase/origin enters Testing render. Reject old Azure or Production target fallback and removal of a protected file to evade verification.
  Name cases `University target runtime is included in the shipped freeze union` and `removing a current asset cannot remove historical protection`; use the existing mutation/temporary-Git fixture pattern and assert freeze rejects the altered copy, while source/historical PDF blobs stay byte-identical.
- [ ] **2. Commit actual public configuration** from verified Task4/5 resource/origin output and the intended Testing site; render Production peerSiteUrl in this candidate only, with its live publication gated by Task8 Testing acceptance. Regenerate with `node tools/render-environment-config.js --environment production --output paws-api-origin.js`. Never commit private host profiles, credentials or evidence archives. Obtain independent whole-product/spec/security review of Tasks1–6 and fix findings with red/green regressions before selecting the product anchor.
- [ ] **3. Promote freezes separately** using existing reviewed pattern; include each new shipped runtime file, no drift exception, no broad receipt/hash rewrite. Obtain independent governance review before treating the anchor as accepted. Preserve sequential implementation; reviewer agents may review only when this explicit review stage is reached.
- [ ] **4. Run full verification sequentially:** `npm test`; `npm test --prefix server`; `npm run test:emulator`; `node tools/build-beta-release.js`; `node tools/build-testing-release.js`; `node tools/verify-beta-candidate.js`; `node tools/beta-api-freeze.js`; static/API artifact freezes; `node tools/verify-environment-config.js --repository`; both environment artifact checks; focused new governance tests. Expected: zero unexplained failures, complete Testing artifact with no unprovisioned skip. If parser concurrency timeouts recur, isolate unchanged tests and record default plus controlled serial results, never erase the failure qualification.
- [ ] **5. Push existing PR125** without force after scope/secret/whitespace checks. Obtain fresh exact-candidate Build/emulator/SQL CI and official artifact digest; previous099 evidence does not cover new code. If Actions quota blocks, prepare an exact-SHA cloud handoff prompt and continue other checks; do not reuse a PR124-only waiver. Update readiness docs/ledger statuses with actual candidate/source evidence, never mark deployment from a build.

### Task8: Accept candidate, merge, reaccept exact-main and release coherently

**Files:** Add `docs/dual-environment/13-university-testing-acceptance-release.md`; update status/operations/uat docs and `agent.Ai/` continuity. Operational private files stay outside Git and Hosting. No new business feature code is planned here; findings return to the owning regression task and invalidate downstream receipts as appropriate.

**Interfaces:** Consume Task3 SQL/reset receipts, Task5 runtime artifact attestation, Task6 deployment/approval evidence, Task7 accepted product/governance/full CI. Produce explicit CODE_READY / TESTING_ACCEPTED / PRODUCTION_RELEASED states and exact source/artifact/Hosting/API/rollback identifiers, not a blanket completion label.

- [ ] **1. Stage and accept the candidate:** consume Task7's official verified candidate artifacts through Task5 Stage/Start/Check; stage the accepted Testing static artifact at `.firebase-production/app`, verify its environment/freeze, then run locked Firebase CLI `deploy --only hosting --project paws-testing-ucvm-20261022 --config firebase.hosting-only.json` under authorized Testing credentials. This local candidate publish is labeled candidate-only, not main workflow evidence. Run browser A–H/P on actual University Testing SQL: Admin/Faculty/HICC/VISC/ADC/LAB/scope/expiry, persistence/search/Availability/CCC/read/export, synthetic imports/PDFs, stale updates, reset/restore, restart/occupied-port/tunnel drift and Production fingerprint/gate invariance. Save screenshots/expected-actual cases and attestation; mandatory pending steps block merge, not silently pass.
- [ ] **2. Revalidate and merge existing PR125** under standing Owner release authorization after independent reviews and fresh head/main checks. If main advanced, integrate on the feature branch and repeat affected review/freeze/CI/UAT. Record merged SHA; obtain exact-main successful push Build/SQL checks and new official artifacts, compare source/protected bytes and provenance without relabeling PR artifacts.
- [ ] **3. Stage exact-main Testing API locally**, run main-defined Testing deploy, repeat critical real authenticated UAT and verify guarded reset receipts. Record passed outcome through existing owner-listed Release Approval; bind its testingRunId to the exact accepted deploy. Activate existing Testing/approval/environment evidence requirements only when prerequisites actually pass; never turn a required gate off to publish.
- [ ] **4. Prepare and perform University API then Hosting rollout:** attest previous accepted runtime/launcher/config/static rollback identity; capture bounded Production data/schema fingerprints and27gates; stage exact-main API separately, validate strict TLS/Production DB and controlled-port health. Reconcile old logon task with pinned launcher, check identity/path/trigger and Recovery CheckOnly without a SQL restart. Required human unattended-boot/credential acceptance is an explicit gate, not a pass. Cut over only accepted components, verify actual Faculty authorization, then release exact-main Hosting-only artifact to tester-teaching. No Production SQL migration/import/reset/DOE publication or grant accompanies this.
- [ ] **5. Verify and record release:** served static hashes, expected API SHA/environment/DB, SQL health, anonymous401, actual scoped role flows, unchanged fingerprints/gates and coherent rollback. On failure restore matched attested API/Hosting versions and verify again. Update `C:/Users/xinyu.zhu1/Desktop/PAWS进度管理/outputs/paws-20261015/PAWS任务进度.xlsx` only in scoped progress/evidence/date fields, preserving human signoffs/native workbook features and file-lock handling; use the spreadsheet skill when that step starts. Update current runbook/continuity and report remaining manual items accurately. A missing mandatory acceptance leaves publication pending while other safe work continues.

## Plan self-review and execution handoff

- Spec coverage: sections1–5 → Tasks1/3/5; section6 → Tasks2/3; section7 → Tasks4/5; section8 → Tasks3/7/8; section9 → Tasks5/6/7/8; section10 → Task8. Every Review Focus item has an owning negative test.
- Interface check: all target objects originate from Task1; account/admin tools share Task2 connector; runtime guard executes on the same SQL request, avoiding recursive startup validation or a once-only pool assertion. Candidate-only and main evidence stay distinct.
- Dependency check: actual candidate API/Hosting staging and full role/UAT wait until Task7 produces a reviewed CI artifact; Task5 may prepare ingress while explicitly NOT_READY. This avoids using old099 code or requiring a future artifact during Tasks4/5. Main-defined workflow evidence follows merge and exact-main staging only.
- Scope check: only one deployable environment subsystem; no Product/DOE/UI redesign, no Azure revival, no extra runner/review service. Planning did not run tests, install software or change online state. Operational prerequisites are named checkpoints rather than invented resource values.
- Owner approved the written design; **this concrete plan awaits review**. Preserve sequential/native execution and final independent review already selected; no need to ask again which execution method to use. Begin executing-plans only after plan confirmation.
