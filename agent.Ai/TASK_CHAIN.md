# Current task — PAWS Beta P3 ProfileVersion hotfix release and closeout

- Architect #6 approved the serialization hotfix, protected trust-anchor advance, one two-commit PR, merge commit, exact-main artifact, University API rollout, and synthetic-fixture acceptance. No P4.
- Repository Alex1122341/Teaching-assignment-azure; base/origin main 9ef8f7a1f8f64ddde8cac3288cdeea7faac03d7f; branch fix/p3-faculty-version-json.
- Functional runtime commit is immutable: 576fff9687417a97fe635cbb4e523f41ade74e4a. Governance files point to it locally; governance commit, push, PR, merge, and deployment remain outstanding.
- Migrations 023/024 were already applied. Existing fixture is FacultyId 7AE9027A-BFD3-4795-B79F-8621E351C291 / ImportBatchId 1B026924-539C-4CB4-BFC2-573EA1861AF5; do not create another. Continue only after fresh API reads post-deployment.
- Local verification: focused P3 16/16; root 782 total / 750 pass / 32 skipped / 0 fail; server 396/396; static build 56 files / 1,835,569 bytes; candidate, repository/artifact freezes zero drift; diff check pass. Secret scan remains; gitleaks unavailable.
- Existing API release is 9ef8f7a… with trust anchor 6b257fb…; no new live change in this checkpoint. Do not rerun migrations, use ACR/ACA, deploy Hosting if static bytes are unchanged, or begin P4.
- Next: finish secret scan; commit governance separately; push/open exactly one two-commit PR; hosted CI; merge commit; exact-main CI/artifact; deploy directly to ITAPPVETOPSDB01 University Node runtime; complete lifecycle/concurrency/role/audit checks and bounded P1/P2 smoke. Final fixture inactive; counts 120 active / 1 inactive.

---

# Historical checkpoint — P0 W1Q0 Static anonymous auth boundary coverage

- `fix/beta-w1q0-static-auth-boundary` is based on `main` at `d81c1e9117bfccb2044724ede72036e994a58a35`. Governance commit `6d334d5953f01191a450169c8b796f529c7c6aed` is open as PR #58 to `main`.
- Static upload workflow and test enforce the exact same nine anonymous protected routes independently before and after upload; each request requires HTTP 401.
- PR head `6d334d5` Azure Beta Build `37491345772` / job `112364580460` completed SUCCESS. SQL Migration Tests did not trigger under configured path filters. Local root suite 775 total / 743 pass / 32 skipped / 0 fail; focused static workflow 7/7; governance suite 55/55.
- Static freeze remains 52 / zero drift; API runtime remains 34 / zero drift; exact product anchor remains `06b517dff59a07e802cb8dff09400532fb195fe4`; ACA deploy workflow is unchanged.
- No merge, deployment, runtime restart/change, SQL/Azure/Firebase/Firestore mutation, migration, permission change, or gate activation.
- **Next:** Architect #6 final review. Do not merge PR #58 or deploy Static until separately directed.

---

# Historical checkpoint — P0 W1M runtime attestation + static release governance

**Status:** Product and separate freeze/governance commits are locally accepted. Exact feature branch push follows continuity update. No PR, merge, or deployment.
**Repository:** `Alex1122341/Teaching-assignment-azure`
**Base:** `main` / `origin/main` `ab8f8085ddfe073c0b872a6678b0a8d2174b220b`
**Branch:** `feature/beta-w1m-runtime-attestation-static-governance`
**Product commit:** `06b517dff59a07e802cb8dff09400532fb195fe4`
**Governance commit:** `951fbb3b20414594273e0bb056caea07c88b198c`

- University HTTP adapter serves `GET /api/health/runtime`, validating `PAWS_RELEASE_SHA` and `PAWS_RUNTIME_TRUST_ANCHOR` as lowercase 40-character Git SHAs at server construction. It reports configured identity, `vetmed-ops-sql` authority, and the six existing `createWriteGates(env)` booleans; it is anonymous, GET-only, no-store/nosniff, and bypasses generic runtime/Firebase/SQL.
- Static Deploy derives the HTTPS API origin from `paws-api-origin.js`; it checks SQL health, runtime attestation/release SHA/trust anchor, all six gates false, anonymous auth boundaries and exact CORS preflight before and after static-only release. Existing exact-main, successful build, exact artifact, freeze, and public byte convergence remain. Public convergence covers seven named files including `afc-workflow-sql.js`.
- Freeze promotion is a separate governance commit anchored at product SHA `06b517d…`. Coverage remains 52 static and 34 API runtime paths (37 protected items including build/repository inputs); protected static delta from W1H is empty, protected API delta is only `server/src/runtime/university-http-server.js`.
- Runbook records that the endpoint is an operational self-report, not cryptographic proof. API origin and separate ACA deploy workflow/tooling are unchanged.
- Verification: server 340/340; root 775 total / 743 pass / 32 skipped / 0 fail; Auth/Firestore emulator 775/775; runtime/workflow focused 11/11; repository/artifact freeze and candidate verifier zero drift; combined static/API artifact built at governance SHA and zero drift; YAML, syntax, diff, ACA unchanged, and targeted added-line secret checks pass. Local Node 24.19.0 versus declared server Node 22.x noted in chronological update.
- No live server access, API requests, SQL/Firebase/Firestore mutation, write-gate change, deployment, PR, merge, or main modification.
- Chronological evidence: `agent.Ai/updates/2026-10-06-0846-paws-w1m-runtime-attestation-static-governance.md`.

**Next:** push only this feature branch after final branch-state verification; then Architect #6 reviews. No PR, merge, deployment, service restart, live mutation, or gate activation.

---
---
# Current task — P0 W1F integration / freeze reconciliation / hosted CI

- Existing branch: `feature/beta-w1e-identity-runtime-least-privilege`, starting SHA `ef7d925c4393d0d3c5e5d93ebd99e9870bc4d59c`; `origin/main` remains `1dca1037f61e8dbb054cc53b119d2b73982ab810`.
- Accepted history is main → W1C `0863327` / `916a90c` → W1D product `da21223` / accepted checkpoint `2d40117` → W1E `ef7d925`; the promoted immutable freeze anchor is the W1D product commit `da21223a1d92572ff72767796229a655d122efb4`.
- W1F local static/API freeze and artifact checks are zero-drift; no whitelist or protected-path removal. Detailed counts, runtime hash equality, test commands, security scan scope, and AFC correction are in the new W1F chronological update.
- Required root, emulator, server, and focused suites pass; hosted CI has not yet run because the one integration PR is pending.
- AFC build run `37366171691` attempt 3 and job `112055470521` succeeded; static deploy `37397731687` succeeded. AFC evidence remains PARTIAL only for screenshot, authenticated `/api/v1/me`, and network zero-write capture. The older W1E update remains preserved as historical chronology; current state is corrected in `PROJECT_STATE.md` and the W1F update.
- Runtime identity remains the previously observed personal identity with `db_owner`, `CONTROL DATABASE`, and `ALTER DATABASE`; live write activation remains NO-GO. SQL migrations 016/017, Firestore rules publication, Firebase configuration, runtime service, deployment, gates, and live data remain untouched.
- **Next:** commit W1F governance and evidence separately from accepted runtime/product commits, push the same branch, create exactly one PR to `main`, wait for every required workflow/job on the exact PR SHA, report the result to Architect #6, and stop before merge for Architect's deep final review.

---

# Superseded checkpoint — P0 W1E identity authority and runtime least privilege

# Superseded task — P0 W1D Firestore authority containment

- Starting point: W1C accepted at `916a90cc2e3e9f55c01e26ace6a14f21c7d2cca9`; work is isolated on `feature/beta-w1d-firestore-authority-containment`.
- W1D local changes make SQL-canonical Firestore rules independent of `settings/system_state`, fail-close old reachable client writers, retain separate user/group/announcement behavior, and inventory each path in the authority matrix.
- Identity overlap (`users.role` / Firebase `facultyRoles` vs SQL `UserProfile.BaseRole`) remains unresolved for Architect #6. The runtime SQL principal still has previously evidenced broad authority; no permission change is in scope.
- No live Firestore/SQL/Azure write, rules publish, Firebase configuration mutation, W1C activation, migration 016, deployment, PR, merge, or `main` change.
- Current local verification and freeze-drift classification are in `agent.Ai/updates/2026-10-05-paws-w1d-firestore-authority-containment.md`.
- W1D implementation commit `da21223a1d92572ff72767796229a655d122efb4` is pushed to origin; independent read-only review found no Critical or Important issue; a Minor AFC Firestore read-path description was corrected in the matrix. A–L report sent to Architect #6. **Next:** wait for Architect review; no PR/deploy/rules publication/SQL change is authorized.

---

# Current task — P0 W1C containment ready for Architect #6 review

- Implementation commit `08633276663b71d7a6fc995e9be2d20c7cba4065` is pushed on `feature/beta-w1c-write-containment`; no PR/deployment.
- Independent server gates for AFC single, AFC batch, and Session PATCH are default-disabled; client capability is false. Migration 016 is local-only.
- Focused 70/70; server 318/318; root 771 total / 738 pass / 4 expected immutable-freeze failures / 29 skipped. Four failures correspond only to W1C static/API drift; no unrelated protected drift.
- P0 readiness remains PARTIAL / write activation NO-GO: legacy Firestore business writers remain allowed while the maintenance lock doc is absent; current University SQL identity has `db_owner` and `CONTROL DATABASE`.
- Next: Architect #6 reviews the branch and audit. Keep no PR, merge, permission/rules change, migration apply, gate activation, or deployment until separately instructed.

---

# Current task — AFC Multi Input date paste normalization

- Status: product commit complete; separate freeze/documentation promotion prepared; root and server suites pass; emulator suite requires CI verification.
- Base `main`: `1a6e04b895650718cdd4bc41ddfaa9c7014a05a1`; product commit `51ed5f7aa0851aac5f20133ea213666028e018a3`; branch `fix/beta-afc-paste-date-normalization`.
- Scope: frontend-only strict year-first pasted-date normalization and visible row errors. Keep SQL/API/auth/Firebase/data unchanged, and do not start unrelated queued UI work.
- Local evidence: root 771 total / 742 pass / 29 skipped / 0 failed; server 309/309; static/API candidate and artifact checks pass; release build succeeds. Emulator tests encounter local Windows Java native-memory failure and child-process crash; do not change product code or weaken gates for this host issue.
- Next: commit separate freeze/doc promotion, inspect diff, push/open PR, wait for Node 22/Java 21 CI (including emulator tests), merge under owner authorization, then use exact-main static release workflow and attempt live UI acceptance without submitting rows.
- Experimental repository, password workflow, and PR #76 remain parked and untouched.

---
# Superseded checkpoint — Firebase Admin security patch locally verified; PR pending

**Last verified:** 2026-10-05
**Repository:** `Alex1122341/Teaching-assignment-azure`
**Base:** `main` @ `99906c6b9abb29ae5e0932368ccb352798e111d0`
**Branch:** `fix/beta-firebase-admin-security`
**Product commit:** `ae45597cc1bd9da38bccdb1807ba763c9f763ca8`
**Freeze/governance commit:** `810873d672a4ea04720ac105667faf56641a8bc6`
**Status:** local checks accepted; push/PR/hosted CI and any runtime activation are pending.

- Product diff changes only `server/package.json` and `server/package-lock.json`; Firebase Admin is exact-pinned at 13.10.0. Top-level msnodesqlv8, mssql, and pdf-lib remain unchanged.
- Before production audit: 9 findings (2 HIGH, 7 MODERATE, 0 CRITICAL). After: 8 MODERATE, 0 HIGH, 0 CRITICAL. Remaining grouped moderate findings are in the Firebase Admin production dependency tree; see `agent.Ai/updates/2026-10-05-firebase-admin-security.md` for packages, paths, advisory and fix classification.
- Node 22.23.2 verification: focused 40/40; server 309/309; root 764 total / 735 passed / 29 skipped / 0 failed. Static freeze 52 protected / zero drift; API freeze and candidate verifier zero drift; secret scan no matches; diff check passes.
- Freeze anchor is the immutable product commit above. Governance was committed separately; zero-drift assertions remain strict.
- The previously staged vulnerable runtime remains preserved and inactive. No SQL/Firebase/Azure/Cloudflare/service/configuration/data mutation, migration replay, deployment, or synthetic-record work occurred.

**Next:** review the final branch diff, push `fix/beta-firebase-admin-security`, open the focused PR, and wait for required hosted CI. Do not activate/deploy until the exact-main release process is authorized and the production audit still has HIGH=0 and CRITICAL=0. Do not start Work Queue or touch the Experimental repository.

---
# Superseded checkpoint — migration 015 applied; live AFC/session acceptance partial

**Last verified:** 2026-10-05
**Repository:** `Alex1122341/Teaching-assignment-azure`
**Base:** `main` / start `340f599e13de98847b2e41a057be32517e79fee7`
**Branch:** `feature/beta-doe-afc-data-completion`
**Working head:** still base SHA; milestone changes remain uncommitted. No PR, push, merge, or deployment.

- Do not rerun the accepted AFC source import: imported active count 803; 799/799 valid source rows represented.
- Local DOE/FTE, AFC Multi Input, and Session Edit feature implementation remains on `feature/beta-doe-afc-data-completion`; no commit/PR/push/merge/deployment.
- Migration 015 was applied successfully to VetMed-Ops after two rolled-back attempts uncovered SQL Server batch-compilation and filtered-index SET-option issues. Post-state verified: nullable `ManualPurpose nvarchar(1000)` and legacy `ReasonCode`; batch procedure + unified view; required constraints/index; 803 imported active AFC; 0 manual rows; procedure hash matches reviewed local procedure; runtime role unchanged and no new explicit grant (effective EXECUTE via existing db_owner). Do not rerun migration 015.
- Focused migration/AFC tests 19/19; full server suite 309/309; root suite 762 total / 726 passed / 29 skipped / 7 immutable freeze-baseline drift failures; `git diff --check` passed. Gates remain unchanged.
- Public Beta sign-in remains unresponsive. A temporary local real-browser probe proves both frozen and feature-branch sources bind one Sign in click handler and open the modal. Live Beta has no visible response and no console error. The raw public HTML has no static `approval-workflow.js` reference, while the loaded DOM includes that script with an app-specific marker; its origin is unproven. Do not guess at a fix or alter auth architecture; no credentials entered. Details: `agent.Ai/updates/2026-10-05-0954-signin-reproduction.md`.
- No synthetic AFC/session rows or AuditEvents, no deployment, commit, push, PR, or merge.

**Next:** ask Architect#5 to direct a supported check for the live click listener/callback and the extra DOM node's source. The sign-in root cause remains unisolated; do not change auth code. Once sign-in works, run the authorized synthetic AFC + session sentinel API acceptance and safe cleanup. Reconcile deliberate runtime drift through the normal frozen-baseline review and rerun full root tests; do not relax freeze gates or release before acceptance.

---
# Latest checkpoint — PAWS post-P3 stabilization released / acceptance partial

**Released application main:** `e03fd867c4b5af36a2d980e7a515bd13af2d34d3`, PR #48 merged. Exact-main Build `37255508927`, SQL Migration Tests `37255508911`, ACR Publish `37255826375`, ACA Deploy `37255946409`, and Static Deploy `37256161825` succeeded.

- Repository cleanup completed: 57 branches / 10 open PRs immediately before cleanup; 3 branches / 0 open PRs after. PR #48 merged; #2, #4, #5, and #8–#13 closed. Keep `docs/agent-ai-continuity` and `feature/faculty-enrichment-phase-a` for documented future work.
- ADFA General Beta sign-in, read-only timetable/list access, timeout-notice clearing after fresh reload, and Faculty Dashboard/DOE page load verified.
- Full-year list partition: 1,902 grid-ready + 35 unknown-time check-needed = 1,937 unique sessions; no live session business row changed. The 1,938 accessibility row count includes the table header.
- SQL scalar edit endpoint and transaction/AuditEvent path are implemented and tested, but `sessionWritesEnabled()` remains false. Admin login failed and no test-safe sentinel exists; therefore no live edit/AuditEvent, Faculty-denial acceptance, or Firestore-negative live test was performed.
- Live business-data normalization/import: 0 rows. DOE workbook identity conflicts remain 0 exact active matches / 112 name mismatches / 3 no-match. Policy/target tables remain empty; contract DOE, 91 teaching-role/rate gaps, 78 role DOE gaps, and 162 role-date gaps require authoritative sources.
- Next: resume live write acceptance only with a secure working admin test account and an explicitly test-safe session/isolated target; otherwise continue only source-backed read-only review.

**Do not redo:** do not reapply migrations 012/013; do not apply the DOE workbook; do not infer DOE/identity/FTE/time values; do not edit a real session as a test; do not directly mutate assignments or Firestore timetable data.

---

# Historical checkpoint — PAWS post-P3 stabilization before release

Status: **PR #48 OPEN / ORIGINAL HEAD CI GREEN / THREE SELF-REVIEW FIXES VERIFIED LOCALLY / PUSH AND FRESH CI PENDING**

1. **Complete:** aggregate VetMed-Ops audit; safe/reversible schema migration 012 for bounded scalar session edits and migration 013 for DOE target allocations; rollback scripts; DOE source audit and no-import decision because 112 identity mismatches and 3 no-match rows remain.
2. **Complete:** Firebase-verified SQL scalar session edit endpoint with server-resolved role, transaction, and AuditEvent. Assignment/DOE edits and unsupported add/bulk/swap writers remain unavailable.
3. **Complete:** timeout notice lifecycle fix and academic-year-wide ALL / GRID-READY / CHECK NEEDED list with canonical reasons and coverage tests.
4. **Complete:** merge reviewed B2B login retry, prefetch, and navigation continuity work into the candidate branch.
5. **Complete:** promote immutable static/API freeze to `6cd77eb53d532b1f2279777452d45e55182b49ee`; repository and built artifacts have zero drift.
6. **In progress:** PR #48 (`ddb4cbf`) is open with its original exact-head CI green; local review fixes now enforce May–April academic-year bounds, block DOE Apply on any unmatched/inactive source row, and restrict importer SQL access to local shared memory on ITAPPVETOPSDB01. Focused tests, full local suites, PowerShell parsing, release build, and freezes pass; these fixes are not pushed yet. The current Beta login worked for ADFA General after one network retry. The admin test credential autofill was rejected. No synthetic sentinel session exists in live data, and no real course row was edited.
7. **Next:** commit and push the review fixes/state update, verify fresh exact-head CI, then use the authorized exact-main API/static release flow. Complete only acceptance that can use a confirmed test target and valid authorized login. Close stale PRs and delete documented merged/superseded refs after their disposition is verified.

**Do not redo:** do not reapply migrations 012/013; do not apply the DOE import (it was not applied and remains blocked by identity conflicts); do not infer Faculty FTE, contract DOE, HICC/CCC role DOE, identity, or session times; do not edit a real timetable session as a test; do not directly edit assignments or Firestore timetable data.

---

# Historical checkpoint — P3B4 — APPROVED AFC ARTIFACT / CANDIDATE ACCEPTED BY CI

# P3 BETA END-TO-END CONNECTION — CURRENT

**Branch:** `feature/p3-beta-end-to-end-cutover`
**Base:** `feature/p3-stage-a-activation-prep` @ `45d06cfc5e528409e820fea05a7d8205317b30eb`
**Product commit:** `6fc77fb94e0de3aa116c9c4d5743d4aec45da61c`
**Status:** product and governance commits pushed; PR #47 open; exact-head Azure Beta Build green; not merged or deployed.

- P3B3/P3B4 approved feature work and the Stage A lineage were combined from the exact Stage A head.
- A single `paws-api-origin.js` now owns the clearly marked temporary Quick Tunnel API origin; page load order, data client, protected manifest, tests, and release verification are updated.
- Live read-only checks matched the accepted migrations/tables/procedures/counts. No migrations were repeated and no authenticated AFC rows/artifacts were created.
- Quick Tunnel maps only to `127.0.0.1:18787`; external health/auth boundary and exact Beta SWA CORS checks passed. SQL/RDP/SMB remain private.
- Root suite: 686 total / 657 passed / 29 skipped / 0 failed. Emulator root suite: 686/686. Server suite: 270/270. Release build, repository freeze, API freeze, static artifact freeze, and API artifact freeze passed with zero drift (50 static files / 32 API files).
- Local Node is 24.19.0. Hosted Azure Beta Build run `37240070237` passed on exact SHA `6a197270d7bd65f61871fe55c54476cf1c51f277` using Node 22.
- The open Beta site shows an authorized admin-role session, but the deployed static page lacks both `paws-api-origin.js` and `afc-workflow-sql.js`. It cannot exercise the new AFC lifecycle. No credential/token was inspected.
- Do not merge/deploy before authenticated backend E2E passes. This creates a current gate cycle because the old deployed UI has no AFC API workflow. Next: ask Architect #5/owner for a safe pre-deployment authenticated test route or other approved client. Do not bypass the E2E deployment gate.

# Historical P3B4 — APPROVED AFC ARTIFACT

Status: PRODUCT + GOVERNANCE + REMEDIATION COMMITS PUSHED / AZURE BETA BUILD SUCCESS / BRANCH-ONLY / NOT MERGED / NOT DEPLOYED.

- Branch: `feature/p3b4-afc-approved-artifact`; CI-validated candidate head `5caecdda95786ce24a3fcdbbb2fdda7f93dbbd7e` (run `37227596042` succeeded on this exact SHA). The current tip advances with docs-only closeout commit(s).
- Product commit: `b7b9ed45bcc88ea774fb2c64bbca8c753da41393`; product commit unchanged. Original governance commit: `7ff3b50d8bcd73b75b8e0a12005fda6371548164`; remediation commits: `46b93dbf3825bd891f595dc644862ec042cc9c3b` and `5caecdda95786ce24a3fcdbbb2fdda7f93dbbd7e`.
- Azure Beta Build `37227596042` succeeded on the exact head. Failed runs `37226440192` and `37226741275` and their causes are recorded in `agent.Ai/updates/2026-10-04-p3b4-candidate-acceptance.md`.
- Node 22.23.3 root suite: 679 total / 650 passed / 29 skipped / 0 failed. Server suite: 270/270. Focused P3B4: 45/45; runtime regression group: 38/38; workflow governance test: 11/11.
- Static freeze: 49 protected paths, zero drift in repository and artifact. API freeze: 32 runtime files + Dockerfile + 2 repository-only package inputs, zero drift in repository and artifact. SWA production artifact build passed and package verification found the approved-artifact route, repository, renderer, PDF template, and `pdf-lib@1.17.1`.
- SQL migrations 009–011 were not applied. Migration 011/rollback static review and contract tests passed; no local SQL Server parser was available. No live SQL/grants, Firebase, Cloudflare, deployment, main merge, or Remote Desktop Commander action. PR: none.
- Current breakpoint: P3B4 code and CI acceptance are complete. Live AFC activation remains out of scope and requires its own controlled task.

# P3B3 — AFC FRONTEND/API MIGRATION (IMPLEMENTED; REVIEW ONLY; NOT LIVE)

Status: **P3B3 IMPLEMENTED / REVIEW BASELINE PROMOTED / BRANCH PUSHED / PR NOT OPENED / NOT MERGED / NOT DEPLOYED**

- Base P3B2 branch head: `a45d63a986e18808b02cd36599e35a6479ec574c`.
- Feature branch: `feature/p3b3-afc-frontend-api`.
- Product candidate: `2adafc731d3eaeec10ca08e058c1272ca2a463fb`; baseline governance commit: `0d16194cac6e9c9c5ac052db2b6465712035b3cd`.
- Remote branch head was verified as the governance commit before continuity docs were added.
- AFC browser list/submit/withdraw/recommend/reject/approve use University API in SQL mode; Firestore behavior remains backend-guarded. Client omits server-derived identity/workflow fields. Approved-PDF transport is pending.
- Static freeze grows 48 → 49 solely by adding `afc-workflow-sql.js`; static and API freeze checks pass at the exact candidate.
- Root suite: 662 total / 633 passed / 29 skipped / 0 failed. Server suite: 224/224. P3B3/client/legacy focused: 29/29. Baseline suite after correction: 26/26. GitHub CI not verified (`gh` absent on target; Actions page fetch returned 404).
- Multi-user ingress still has the tested `10.58.160.21/32` restriction; PDF artifact API is undefined. DOE source and IAM cleanup are deferred blockers.
- No SQL/database, Firebase, Azure, firewall, IAM, service, certificate, deployment, merge, or live PAWS mutation. No PR opened.
- Exact next action: provide Architect #5 the checkpoint and await review; keep the candidate unmerged and undeployed.

## Historical task chain

# Historical checkpoint — PAWS VETMED-OPS WINDOWS AUTH / PR #44

Status: **IMPLEMENTED / LIVE READ + ROLLBACK PROOF COMPLETE / PR #44 OPEN / CI GREEN / NOT MERGED / NOT DEPLOYED**

- Base: `main` at `c99b064002d0cf07a9ef44b7914321f3921777ad`.
- Branch: `feature/vetmedops-windows-auth-runtime`.
- Runtime candidate: `e80d73558c137f9d2cb6de316e2179e4ad073353`.
- Governance baseline commit: `a79810b1d3f476193fa8c928730bd6b65de490c0`.
- CI test isolation fix: `37bb5a6b28a1ee18000ccbce85423c694c4de626`.
- PR: #44, https://github.com/Alex1122341/Teaching-assignment-azure/pull/44.
- GitHub Actions run `37138852302` passed for code head `37bb5a6b28a1ee18000ccbce85423c694c4de626`. This run validates the implementation/test head; the continuity documentation records that verified checkpoint.
- Server tests: 174/174. Root tests: 623 passed / 29 skipped / 0 failed.
- Static freeze: 48 protected paths, zero drift. API freeze: 18 protected runtime paths, zero path-set drift.
- Actual PAWS runtime health/read passed against VetMed-Ops. Strict certificate validation failed on the server's untrusted self-signed certificate as expected; production TLS remains blocked.
- AFC `paws_api.CreateAfcRecord` repository-path proof completed within an outer transaction; test row and audit event were removed by rollback, with no residue.
- No permanent test data, SQL schema, permissions, SQL configuration/certificate, Azure, Firebase, deployment, or main mutation. PR remains unmerged.
- The temporary migration identity is not approved as the production runtime identity. A dedicated least-privilege Windows service identity needs server-level SQL login administration; current server scope lacks `ALTER ANY LOGIN` and `CREATE LOGIN`.

**Exact next action:** Architect review of PR #44, then continue service-identity and trusted-certificate readiness work. Do not merge or deploy in this stage.

## Historical task chain

# B2B-PERF-PR — SERVER TIMING BASELINE PROMOTION / PR GATE

Status: **B2B-PERF ACCEPTED / BASELINE PROMOTED / PR PENDING / NOT LIVE**

- Accepted B2B-PERF runtime candidate: `6bfd637af57955ded38e6a39d2c055bec67a0aa0`.
- Previous frozen baseline: `65766bcf9fc57e50ff8b4fe7dd7cedcffb6825be`.
- Promoted static/API baseline: `6bfd637af57955ded38e6a39d2c055bec67a0aa0`.
- Static protected set: 48; added paths 0; removed paths 0; content drift 0; the 11
  recorded `sha256` values are unchanged and `tools/static-assets.json` is unchanged.
- API runtime count becomes 18. The only new protected API runtime path is
  `server/src/perf/request-timing.js`. The accepted previous→new API delta is exactly
  `server/src/data/data-api.js`, `server/src/data/sql-connection.js`,
  `server/src/data/sql-user-repository.js`, `server/src/runtime/swa-functions.js`
  (modified) plus `server/src/perf/request-timing.js` (added).
- `deploy/aca/Dockerfile` delta is zero; `swa-api/*` delta is zero.
- B2B-PERF adds the fixed `/me` `Server-Timing` allowlist `firebase_verify`,
  `sql_connect`, `sql_user_query`, `profile_validate`, `me_total` with monotonic
  request-local timing only — no persistence, telemetry backend, logging sink, or
  identity exposure. Anonymous/invalid-token requests receive no detailed timing.
- B2A and B2B behavior is preserved. B2B-PERF is NOT LIVE.
- Governance promotion only. No merge, deployment, Azure scaling change, SQL,
  Firebase, Firestore, secret, B3, or DOE action is authorized by this state.

# B2B-PR — LOGIN UX / PERFORMANCE BASELINE PROMOTION / PR GATE

Status: **B2B ACCEPTED / BASELINE PROMOTED / PR PENDING / NOT LIVE**

- Accepted B2B runtime candidate: `65766bcf9fc57e50ff8b4fe7dd7cedcffb6825be`.
- Previous frozen baseline: `f2d76449a4881cb24196289ebf63fd4cfaaa7d05`.
- Promoted static/API baseline: `65766bcf9fc57e50ff8b4fe7dd7cedcffb6825be`.
- Static protected set: 48; previous paths missing: 0; only added path:
  `paws-login-performance.js`.
- B2A continuity remains protected; B2B adds Email/Phone single-flight login UX,
  sanitized in-memory T0–T7 timing, post-T7 optional Firestore enrichment,
  SQL-authoritative FacultyId, safe My Timetable reconciliation, stale-user
  protection, and precise password-change diagnostics.
- Governance promotion only. No merge, deployment, SQL, Firebase, Firestore,
  secret, Azure, B3, or DOE action is authorized by this state.

# B2A-PR — AUTHENTICATION CONTINUITY BASELINE PROMOTION / PR GATE

Status: **B2A ACCEPTED / BASELINE PROMOTED / PR PENDING / NOT LIVE**

- Accepted B2A candidate: `f2d76449a4881cb24196289ebf63fd4cfaaa7d05`.
- Previous frozen baseline: `5a7f8a535caaf42992598c6fc8fe301818075e67`.
- Promoted static/API baseline: `f2d76449a4881cb24196289ebf63fd4cfaaa7d05`.
- Static protected set: 47; previous paths missing: 0; only added path:
  `paws-auth-continuity.js`.
- Authentication continuity is accepted: bounded first-401 refresh/replay,
  transient API/SQL failures preserve Firebase login, inactive accounts fail closed,
  and Dashboard self-service capability is explicit for Faculty/HICC/VISC while
  `other_office` is denied.
- Governance promotion only. No merge, deployment, SQL, Firebase, Firestore,
  secret, Azure, B2B, B3, or DOE action is authorized by this state.

# BETA-R4D-12B1D-RG — CORRECTED API BASELINE PROMOTION / PR INTEGRATION GATE

Status: **B1D-R CORRECTED / BASELINE PROMOTED / PR PENDING / NOT LIVE**

- Superseded frozen baseline: `68bda43a71034089a57d3369128e5dafd80f06eb`.
- Promoted frozen baseline (corrected runtime):
  `5a7f8a535caaf42992598c6fc8fe301818075e67`.
- Branch: `feature/beta-r4d12b1d-r-afc-unfiltered-list`.
- `origin/main` before merge: `c83faeb39ab637ba1fa17ca066c74004d8a9d620`.
- Reason: the accepted API runtime corrected the unfiltered AFC list query,
  which had returned 503 `SQL_UNAVAILABLE` because a bare `WHERE` was emitted
  when no predicates were supplied.
- `tools/beta-freeze.js` and `tools/beta-baseline.json` now use the corrected
  runtime as the single static/API trust anchor; `beta-api-freeze.js` still
  imports it and declares no anchor of its own.
- Static protected set 46, delta 0. API protected set 17 runtime files plus
  `deploy/aca/Dockerfile`, delta 1 = `server/src/data/sql-dashboard-repository.js`
  (the intended correction). All nine recorded static `sha256` values unchanged.
- Static freeze PASS (`protected: 46, drift: []`); candidate verifier PASS with
  static drift `[]` and API drift `[]`.
- Scope is limited to freeze configuration, baseline/governance tests, active
  static release evidence metadata, and continuity docs.
- One governance commit is pushed on this branch; one PR goes to `main` and must
  integrate with a merge commit only.
- No SQL apply, permission apply, live proof, live AFC creation, ACR publish,
  ACA deploy, SWA cutover, Azure mutation, A2B, Work Queue, B2A, B2B, or DOE
  change has occurred. B1D-RD, C10 resume, and C11 must not start automatically.

# BETA-R4D-12B1G — BASELINE PROMOTION / PR INTEGRATION GATE

Status: **B1 IMPLEMENTED / B1R+B1R2 ACCEPTED / BASELINE PROMOTED / PR PENDING / NOT LIVE**

- Accepted B1 candidate and required governance parent:
  `68bda43a71034089a57d3369128e5dafd80f06eb`.
- `origin/main` remains `68cd57074bbcf7916da6a031a238175d5530ae0b`; before merge,
  main must still equal that SHA.
- `tools/beta-freeze.js` and `tools/beta-baseline.json` use the candidate as
  the single static/API trust anchor; `beta-api-freeze.js` still imports it.
- Static protected set remains 46 with zero drift. API protection now includes
  `server/src/data/sql-afc-write-repository.js`; runtime and Dockerfile drift
  are zero.
- Candidate-to-governance product-runtime and SQL/business diffs must be empty.
- Only governance configuration, derived hashes, baseline/governance tests,
  active release evidence metadata, and continuity docs are in scope.
- No SQL apply, permission apply, live AFC, deployment, Azure mutation, PR
  merge, A2B, Work Queue, B2A, B2B, or DOE change has occurred.
- After local validation, make one governance commit on this branch, push it,
  open one PR to `main`, and merge with a merge commit only. B1D must not start
  automatically; B1D, B2A, B2B, B3, and DOE remain queued.

# BETA-R4D-12B1R2 — EXACT AFC SQL PERMISSION CONTRACT CORRECTION

Status: **CORRECTED / PENDING ARCHITECT FINAL REVIEW / NOT LIVE**

- Starting B1R2 HEAD: `b38afabeba683f728e751cfca0bfd144e471d5ee`.
- B1R2 correction commit and remote HEAD: `87026ec216ffbd418e2c61fb2f78d6a4862c2584`.
- Same branch: `feature/beta-r4d12b1-afc-dashboard-write-foundation`.
- Frozen baseline remains `b3458f79a05353ce1255874754e1c6c1ec8ee683`.
- 007 permissions and proof now share the same normalized exact permission
  contract: CONNECT, reviewed R4D-10A/10A2 reads, four paws DENYs, five staging
  DENYs, and only the two B1 object grants.
- Valid preflight states are exact pre-B1 and exact idempotent post-B1. Any
  unexpected class, permission, state, object, column, grant option, role,
  ownership, public broadening, missing DENY, or other delta fails before GRANT.
- Offline fixtures cover valid pre/post contracts, the class=1/class=3 guard
  regression, all requested invalid permission variants, and public broadening.
- No runtime/API/UI/auth/data behavior changed. No SQL apply, live permission
  mutation, proof against live, deployment, PR, baseline promotion, A2B, Work
  Queue, B2A, B2B, or DOE change occurred.
- B1R2 correction commit and push succeeded; B1G, B1D, B2A, B2B, B3, and DOE
  remain queued.

# BETA-R4D-12B1R — AFC WRITE SECURITY + DATA INTEGRITY CORRECTIONS

Status: **CORRECTED / PENDING ARCHITECT FINAL REVIEW / NOT LIVE**

- Starting `origin/main`: `68cd57074bbcf7916da6a031a238175d5530ae0b`.
- Feature branch: `feature/beta-r4d12b1-afc-dashboard-write-foundation`.
- Starting B1R HEAD: `59632a1f6c04650fabc177bbb1687ebb904a203f`.
- Correction commit: `438dba9cce6f0c917614643c13e6e011b6a0b668`.
- Frozen baseline remains `b3458f79a05353ce1255874754e1c6c1ec8ee683`.
- B0 remains LIVE ACCEPTED / CLOSED.
- Migration 007 adds `paws.AfcManualRecord`, `paws.vAfcRecordUnified`, and
  `paws_api.CreateAfcRecord` as proposal-only artifacts independent of 005/006.
- Dashboard AFC reads use the unified view and a hard maximum of 2,000 rows;
  AFC counts and faculty detail use the same source. The write repository is
  separate and can invoke only the hard-coded stored procedure.
- The API adds administrator-only GET/POST `/api/v1/dashboard/afc-records`;
  all existing Dashboard routes remain GET-only. Actor identity and record /
  request IDs are server-trusted/generated.
- The admin-only AFC Records tab renders one row per unified record, uses the
  canonical FacultyId selector, validates the frozen reason vocabulary and
  notes/date rules, disables Submit while saving, and reloads from the server.
- B1R corrected exact SQL ReasonCode case, widened procedure validation inputs,
  made schema/object ownership checks fail closed, hardened permission apply
  preflight and least-privilege proof, restored inactive-Faculty AFC history,
  and removed the post-commit response read.
- Focused B1/B1R tests pass 25/25; server suite passes 140/140. Full root and
  emulator suites pass all behavioral tests; each reports only the expected
  three frozen-baseline drift assertions. `git diff --check` and changed-JS
  syntax checks pass.
- No SQL apply, permission apply, live AFC creation, Firestore/Firebase/Auth/
  Rules mutation, Azure mutation, ACR/ACA/SWA deployment, PR, merge, baseline
  promotion, A2B, Work Queue, B2A, B2B, or DOE change occurred.

- Focused B1/B1R tests pass 25/25; server suite passes 140/140. Root and
  emulator behavioral tests are green with only the three expected baseline
  drift assertions.

Next exact action: push the B1R correction commit on the same feature branch,
then return the B1R report. B1G and B1D remain queued.

# PAWS Task Chain

## BETA-R4D-12B0G — FROZEN BASELINE PROMOTION / PR-INTEGRATION GATE

Status: **IMPLEMENTED / RUNTIME ACCEPTED / FROZEN BASELINE PROMOTED / PENDING PR-INTEGRATION / NOT LIVE**

- Reviewed B0 runtime candidate: `b3458f79a05353ce1255874754e1c6c1ec8ee683`.
- Previous frozen baseline: `8b1388f5afe210c761d6dbc3b4240536758f7342`.
- `origin/main` remains `5e5d947fd4c24b340185c1b8bb1a4bbe2c27d67d`; the
  feature branch starts from the accepted candidate and is ahead 2, behind 0.
- The protected static manifest remains exactly 46 paths: previous paths
  missing = 0 and new paths = 0. The old baseline is retained only in
  historical update/spec/plan records.
- The B0G governance commit changes only freeze references, regenerated
  reporting hashes, baseline tests, and active continuity documentation. It
  must not change protected runtime/API bytes.
- Current live R4D-11 remains unchanged. No SQL write, Firestore write,
  Firebase Auth mutation, Rules change, deployment, A2B, Work Queue, B1, B2,
  or DOE work is part of B0G.

Next exact action after the governance commit is one PR to `main`, followed by
required green CI and a merge-commit-only integration gate. After merge, the
next task is **B0D — controlled static release + final live acceptance**. Do
not begin B1.

## BETA-R4D-12B0 — APPROVAL QUEUE REAL-DATA CLEANUP / REVIEW GATE

Status: **IMPLEMENTED / LIVE LEGACY QUEUE CLEANUP COMPLETE / RUNTIME ACCEPTED / FROZEN BASELINE PROMOTED / PENDING PR-INTEGRATION / NOT LIVE**

- Starting `origin/main`: `5e5d947fd4c24b340185c1b8bb1a4bbe2c27d67d`.
- Feature branch: `feature/beta-r4d12b0-approval-queue-real-data-cleanup`.
- Verified Beta Firebase project: `tester-teaching`.
- Live R4D-11 runtime was not deployed or mutated; SQL health remained 200.
- Migration 005 and 006 remain unapplied; no authority seed exists.
- Pre-cleanup inventory: `change_requests` total 3 (`pending` 2,
  `rejected` 1); request types `session_edit` 1 and `faculty_swap` 2.
  `afc_requests` total 2 (`pending_admin` 1, `approved` 1).
- Private backup is outside Git at the B0 output path recorded in
  `PROJECT_STATE.md`, SHA-256
  `e8bbf5e61d1dd60ff44918e0b7d140456f842fcb2c6a66864f59ed5d932ab572`.
- Targeted cleanup deleted exactly two pending change requests and one pending
  AFC request; no `pdf_chunks` children existed. Post-cleanup pending counts
  are all zero, with completed records preserved.
- Azure SQL containment skips legacy approval dependencies, guards direct
  `approval-workflow.js` loading before `UCVM.init()`, and exposes a safe AFC
  facade that preserves panel navigation without Firestore request/approval
  reads or writes.
- Focused B0 and all non-freeze runtime regression tests pass. The only full
  suite failure is the existing zero-drift baseline assertion, intentionally
  reporting the exact three protected frontend B0 files; the freeze baseline
  was not promoted. API freeze remains zero drift.
- No PR, merge, deployment, SQL write, migration, seed, A2B, Work Queue, B1,
  B2, DOE, Firebase Auth, or Firestore-rules change was performed.

Next exact action: Architect review/integration gate for B0. Do not begin B1.

## BETA-R4D-12A5G — FOUNDATION ACCEPTED / CONTINUITY SYNC / PR MERGE GATE

Status: **A5/A5R ACCEPTED FOR INTEGRATION; CONTINUITY DOCUMENTATION ONLY**

- Expected `origin/main`: `342b45ab7433997ed2961dc13a68a2978fa989a5`.
- Accepted branch: `feature/beta-r4d12a5-concurrent-responsibility-assignees`.
- Accepted A5R implementation HEAD before this documentation-only commit:
  `e9a415247c80ade128210384a87992257b4c4959`.
- Expected branch distance before continuity sync: ahead 2, behind 0.
- R4D-12A5 is **FOUNDATION ACCEPTED / NOT LIVE / NOT SEEDED**.
- Migration 005 is MERGED / NOT APPLIED. Migration 006 is MERGED AFTER A5G /
  NOT APPLIED. No authority seed, SQL write, Work Queue implementation,
  deployment, or B-series implementation is included.

Accepted concurrency contract: `exclusive` and `concurrent` are the only
assignment modes; different Faculty rows may overlap only when both are
`concurrent`; same-Faculty overlap and all `exclusive` overlap fail; touching
boundaries and deliberate gaps are valid; co-HICC shares one package; co-VISC
shares one stable leader responsibility; package identity does not depend on
assignees; DOE is independent.

Continuity evidence: R1/R2/R3/R4/R5 = 9/9/0/0/0; four exact Faculty lookups
remain NO_MATCH; 18 legacy-only HICC courses remain historical/not-current
candidates; exact live evidence is 539 Session rows, 24 legacy ambiguous HICC
RoleAssignment rows, and all 18 `paws.Course` rows. Private V2.1 CSV/XLSX
remain outside Git.

Required documentation-only changes:

- Update `agent.Ai/PROJECT_STATE.md` without rewriting historical sections.
- Update this task chain without rewriting historical update files.
- Add `agent.Ai/updates/2026-09-29-beta-r4d12a5-concurrent-authority-accepted.md`.
- Commit only documentation with message
  `docs: record R4D-12A5 concurrent authority acceptance`.
- Re-run `git diff --check`, `node tools/beta-freeze.js`,
  `node tools/beta-api-freeze.js`, and the normal Beta test suite.
- Push the same feature branch and open one PR to `main`.

### Future product order — do not implement in A5G

1. **B0 — Beta Approval Queue real-data cleanup.** Trace each visible ADFA,
   AFC, and Timetable request to its source; classify REAL, TEST, SYNTHETIC,
   HARDCODED, or DEMO/FALLBACK; preserve real business records; remove or
   disable only confirmed non-real data after downstream/audit review. An
   empty queue is correct when no real pending requests exist. Acceptance must
   prove no mock/hardcoded/Firestore-demo fallback remains on the migrated
   Beta path and real SQL/API records remain untouched.
2. **B1 — AFC line-by-line and controlled create.** One AFC record per line
   with canonical Faculty, Start Date, End Date, Reason, and optional Notes;
   `EndDate >= StartDate` including same-day AFC; reasons are University
   Travel, Vacation, RSL, Medical, MAT, Special, Other; Special/Other require
   explanatory Notes. AFC does not reassign HICC/VISC, sessions, DOE, or
   packages automatically.
3. **B2 — Login UX and measured performance diagnostics.** Separate visible
   Signing in state, loading, duplicate-submit prevention, accessible status,
   failure recovery, and retry from timing instrumentation T0 through T7.
   Report T0-T2, T2-T4, T4-T5, T5-T7, and T0-T7. Do not replace Firebase or
   assume cold start without evidence.
4. **B3 — remaining Dashboard/UI cleanup.** Keep after B0, B1, and B2.
5. **DOE semantic/source repair.** Keep after current Dashboard/UI work; do
   not present a sum of personal Faculty DOE percentages as one institutional
   percentage. Required future sources remain Faculty Summary, Faculty
   Workload, UCVM Workload Guidelines, DOE Map/role DOE, Azure
   teaching/service evidence, with experimental DOE logic reference-only.

Parallel owner-dependent path remains: Owner review -> A2B -> SQL-backed
Teaching Assignment Work Queue. It must not block independent B-series work.

## BETA-R4D-12A1 — FOUNDATION ACCEPTED / NOT LIVE / MIGRATION NOT APPLIED

Status: **FOUNDATION ACCEPTED / AWAITING INTEGRATION GATE**

- Accepted branch: `feature/beta-r4d12a1-ta-authority-foundation`.
- Accepted implementation HEAD: `bae3d11784575b4b4dc5f17c9789c023e54de5bf`.
- Live deployed release remains `dcf0607c027a08e5341710a449091fca4c7aa106`; current accepted runtime remains R4D-11.
- This is dormant foundation code. Merging it does not deploy it.
- Migration `005_teaching_assignment_authority_foundation.sql` is proposal-only and NOT applied; no seed data, API mount, Work Queue UI, DOE change, or live SQL/Firebase/Firestore/Azure mutation exists.
- Evidence at acceptance: focused 22/22, server 125/125, Beta 500 passed / 29 skipped / 0 failed, static freeze protected 46 with zero drift, API freeze zero protected runtime drift.

### Immediate next bounded unit — BETA-R4D-12A2

**CONTROLLED TEACHING ASSIGNMENT SEED / SOURCE RECONCILIATION AUDIT**

Read-only first. Produce deterministic reviewed seed evidence for canonical
Subjects, stable HICC/VISC responsibilities, exact HICC Course/Subject scopes,
temporal Faculty assignee windows, Teaching Assignment Groups, explicit HICC
memberships, VISC group leaders, AY + Group + HICC packages, and working-session
ownership. No fuzzy or guessed seeding and no live seed/apply before a later
Architect gate. A2 is not Work Queue UI implementation.

Queued after the bounded A2 audit: SQL-backed read-only Work Queue; owner-directed
Dashboard/UI repair; AFC line-by-line records plus a separate controlled write
design; and DOE semantic/source repair. These queues are not implemented here.

## BETA-R4D-11 — FINAL RELEASE CLOSURE

Status: **COMPLETE / LIVE ACCEPTED / CLOSED**

The deployed release SHA is `dcf0607c027a08e5341710a449091fca4c7aa106`. The release sequence is complete: Dashboard/DOE presentation accepted, ACR guard defect fixed, exact-main Build #134 passed (run `36574888135`), immutable ACR image published by ACR Publish #9 (run `36575614909`), ACA exact-digest activation passed by ACA Deploy #2 (run `36582044521`), static cutover passed by Static Deploy #7 (run `36582983859`), ADFA authenticated acceptance passed, and Faculty authenticated acceptance passed.

Release evidence:

- Tested artifact `azure-beta-dcf0607c027a08e5341710a449091fca4c7aa106`, artifact ID `11036059566`, artifact digest `sha256:2adbfbdcd94ec580d8f5ee84878dab4ebee66d82091ae65b2c5feb4675c00103`.
- Immutable ACR image digest `sha256:a9d9021fec23439fa33bd4f67cc958cec8d2737d0cb9afa90f85912948b12503`.
- Active ACA revision `paws-sql-beta-api-260926--rdcf0607c027a`.
- Faculty scope proved exact `153/153` `SessionId` set equality; admin-boundary calls returned 403; cross-faculty detail returned 403.
- Session writes are disabled; the migrated timetable/dashboard path has no Firestore business fallback; DOE remains presentation-only (`DOE_PRESENTATION_PARITY=YES`, `FULL_DOE_ENGINE_PARITY=NO`).

ACA Deploy #1 (run `36581374421`) is retained as a safe failure before mutation: missing `Microsoft.App/containerApps/read`, `activationPerformed=false`, and no revision/image mutation. The ACR G1 failure is likewise retained as a historical safe failure with no image build/push. No private service-principal identifiers are recorded.

The deployed release SHA and repository main are distinct concepts. Documentation-only advancement of main after this closure must not be described as a deployment. The next task is **AWAITING OWNER / ARCHITECT SCOPING**; no R4D-12 is created.

## Historical task chain (pre-closure)

## BETA-R4D-11G3 — ACR guard PR continuity synchronized / awaiting merge gate

Status: **PR #32 OPEN / CI PASSED / AWAITING FINAL MERGE GATE**

- Base: `origin/main` at `22194b098ddde312c16af5af01633387374cdd72`.
- Clean branch: `fix/beta-r4d11g2-acr-tag-guard`.
- Local implementation `378dd79...` was cherry-picked as `295cc8c...`; the historical R4D-11C branch was not reused.
- Scope: ACR exact-SHA absent-tag classification, behavior-level tests, and continuity documentation only.
- PR #32 is open against `main`; the original accepted PR head before this continuity sync was `16aac238426fafcc59c72719ba3fa6bae35c5171`.
- Azure Beta Build #132 / run ID `36572092893` passed; synthetic PR merge SHA was `b6929c5dfdd3bc21e522beb18a033e71cbb2a8d7`.
- Protected static runtime: 46 paths / zero drift. Protected API runtime: 16 runtime files plus `deploy/aca/Dockerfile` / zero drift.
- No product runtime, Azure, SQL, Firebase, ACR, ACA, SWA, merge, or deployment mutation occurred.
- Current breakpoint: PR #32 exists, CI passed, merge has not occurred, and release has not started.
- Next safe action: await the Architect merge gate. After any future merge, use a new exact-main Build before release.

## BETA-R4D-11A — Dashboard UI + DOE parity

Status: **IMPLEMENTED / AWAITING ARCHITECT REVIEW**

- Branch: `feature/beta-r4d11a-dashboard-ui-doe-parity`
- Base: `6adf40cd8cd89a915e23bcd505d0e3110f91b2e4`
- Added pure DOE/course view models, three administrator-only GET aggregate
  routes, lazy API client methods, four read-only Dashboard tabs, rich detail
  sections, deterministic course/session expansion, and scoped self-service.
- No Firestore dependency/fallback, CRUD/import/rule editor, SQL write,
  deployment, merge, baseline promotion, or PR was performed.
- Server suite: 102/102. Focused R4D-11A frontend suite passes; legacy Stage 3
  source-shape assertions that require the retired lookup-only UI are tracked
  as expected compatibility-test drift.

**Last updated:** 2026-09-27

## BETA-R4D-10B — Dashboard Firestore → Azure SQL/API read cutover

Status: **STAGE 2 IMPLEMENTED / AWAITING ARCHITECT REVIEW**

- Branch: `feature/beta-r4d10b-dashboard-api-client-auth`
- Base: `db777d721ccff5665bc103fba89482a356dc0041`
- Stage 1 audit: accepted (`READY_FOR_IMPLEMENTATION`).
- Stage 2: Dashboard API client methods added; Dashboard auth profile source
  changed from Firestore `users/{uid}` to `/api/v1/me`.
- Current auth path has zero `users/{uid}` reads, zero `UCVM.ready()` calls,
  zero `UCVM.watch()` calls, zero `linkFacultyIdentity()` calls, and one
  `UCVM_PAWS_DATA.currentUser()` call.
- No PR, baseline promotion, deployment, backend, SQL, or live data mutation.
- Next only after Architect approval: Stage 3 Dashboard UI API read cutover and
  fail-closed legacy mutation controls.

## BETA-R4D-9J — Authoritative session-time reconciliation

Status: **LIVE ACCEPTANCE PASSED / READY FOR FINAL PR MERGE**

- Branch: `feature/beta-r4d9j-session-time-reconciliation`
- PR: `#20`
- Starting PR HEAD for live operation: `90b4276cfb03891a679bfce1ae4765f8608a77d9`
- Operator safety fix: `6f875be2302b75082aa51d47a87dfe19b397421c`
- Focused test follow-up: `c825f87497ab2852bf19be9d00b7046da5a7a13e`
- Manifest: 423 corrections; SHA-256 `3802b09a9e0bc5b75a598f45390667577da90e7cb11493a399d0fee947fa17a9`
- Rebuild gate PASS: 4,974 raw Teaching Assignments, 4,970 canonical
  SessionAssignments before/after, 1,937 sessions before/after, identical
  SessionIds and assignment relationships.
- Live repair COMMITTED: 423 updates, 0 inserts, 0 deletes; Session 1,937 ->
  1,937; SessionAssignment 4,970 -> 4,970.
- SessionId SHA before/after:
  `2a105c0086ac52dc574a732d7aef2b2eb9cac0cdfe9648d6ca346c4db1093224`.
- Backup SHA-256:
  `3c47c9890e56d65e3319947da2a88e92aa0cd3ea3d2d803d8ff819ecc7817ad8`.
- Post-SQL: 423/423 new times match; `vCalendarSession` = 1,937; 20/20
  corrected view samples pass.
- Browser/API: `sessionBackend() = azure-sql`,
  `sessionWritesEnabled() = false`, `listSessions().length = 1937`,
  corrected API sample = 20/20.
- Calendar partition PASS: Fall W1 52+25=77; Fall W5 60+9=69; Fall W6
  60+19=79; Spring W4 10+7=17; unique counts equal totals.
- Fall W5 before/after: 37 grid / 32 check -> 60 grid / 9 check; total 69.
- Remaining Check-needed: 493 early-clock + 65 reversed + 35 00:00 sentinel
  = 593; other invalid/out-of-window = 0.
- Rollback preview PASS; `applied=false`, `writesPerformed=false`.
- No protected frontend runtime change; no SWA deployment; no Firestore
  timetable fallback.

## BETA-R4D-9B — Runtime Commit C

Status: **IMPLEMENTED / MERGED / DEPLOYED**

- Fresh base main: `37b4db8a556cb12e588a0f95b08a83e793960851`
- Goal: direct browser timetable reads to the approved ACA API with Firebase
  Auth retained, no Firestore session fallback, and writes fail-closed.
- The production SWA workflow must remain manual exact-main and must not attach
  `.azure-production/api`; the API artifact may remain buildable for packaging.
- Runtime Commit C intentionally changed the protected browser client. Governance
  Commit D is the separate follow-up that promotes the frozen baseline to C.
- No Azure/Firebase/SQL mutation or deployment is part of R4D-9B.

## BETA-R4D-9C — Governance Commit D

Status: **IMPLEMENTED / MERGED / DEPLOYED**

- Parent was Runtime Commit C `4fed98d908476df7c4066062ad6435194d3b0493`; Governance Commit D is now merged and deployed.
- Governance-only changes update the immutable freeze anchor and active docs/tests.
- PR #16 remains the existing review vehicle; no replacement PR is allowed.

## BETA-R4D-9E — Runtime Commit E

Status: **IMPLEMENTED / PR #17 OPEN / GOVERNANCE PROMOTION IN PROGRESS**

- Base main: `4071f7f339418162e473d9a3c7830f625bc1fa35`.
- Branch: `feature/beta-r4d9e-calendar-period-mapping`.
- `azureSessionRow` derives `semester` and `week` from the existing academic
  date mapping; invalid dates fail closed.
- SQL/API/backend/auth/CORS behavior is unchanged.

## BETA-R4D-9H — Governance Commit J

Status: **IN PROGRESS / NOT MERGED / NOT DEPLOYED**

- Parent must be Runtime Commit I `2b10aca5b9ab26ffecdffb685bddd33ae4de70f5`.
- Governance-only changes promote the freeze anchor and update active tests/docs.
- Keep PR #19 as the only review vehicle; do not create a replacement PR.

## BETA-R4D-4 — ACA packaging + UAMI SQL adapter

Status: **R4D-4A HARDENED / CI GREEN / DRAFT PR OPEN**

- Branch: `task/beta-r4d4-aca-packaging`
- Base: `main` at `ffd870ee5faae298049df08d1bcb616832a07d87`
- Adds the official Node 22 Functions Dockerfile, deterministic API artifact
  packaging, private-file exclusions, and explicit `mssql` Azure AD default
  authentication for `PAWS_SQL_MI_CLIENT_ID`.
- Existing Firebase verification, public routes, and frontend freeze assets
  remain unchanged.
- No Azure deployment, ACR push, SQL mutation, or merge is authorized in this
  phase.

Draft PR: https://github.com/Alex1122341/Teaching-assignment-azure/pull/14

R4D-4A adds strict allowlist parsing, conflict detection, secure encryption
enforcement, stale-reference cleanup, and a no-push Docker build step to the
existing workflow. Azure Beta Build run `36289550648` passed. Next safe action:
architect review. Do not merge, deploy, push an image, or mutate
Azure/SQL/Firebase/SWA.

## P0 — Current Beta objective

Get the Azure Beta frontend reading the existing Azure SQL database.

### BETA-R0 — SQL foundation/import

Status: **COMPLETE as a loaded checkpoint**

- Azure SQL reset completed.
- canonical schema/data load completed.
- do not rerun reset/initial loader.
- PR #3 remains Draft/open as the migration foundation.

### BETA-R1 — connect frontend read path to Azure SQL

Status: **IMPLEMENTATION COMPLETE / NOT DEPLOYED**

PR #6:

- base `main` (`ea80eecc9fa2ac2b693c23979bad5c5809a26863`) — retargeted 2026-09-26
- **Runtime Commit A** `6eeb1a4ac8c9565a4afbf479277a7e2f543f9e26` (merge of `main` into the PR
  branch; parents `075852b…` + `ea80eecc…`; tree `543b00af…`)
- **Commit B (BETA-R3A-3)** — governance-only: promotes the frozen baseline from
  `86bd5aa2c8a25259f3f708e49b322220ff43a147` to `6eeb1a4ac8c9565a4afbf479277a7e2f543f9e26`
- HEAD = Commit B; the 4 BETA-R1 commits `c006c9a`, `b230718`, `4af5af8`, `075852b` preserved
- Firebase login retained
- API token verification
- SQL UserProfile authorization
- `/api/v1/sessions` → `paws.vCalendarSession`
- no Firestore session fallback
- session writes disabled
- no DOE changes
- protected runtime assets changed by Commit B: **0** (all 45 blobs identical to Commit A)
- protected path set 44 → 45 (superset; `paws-data-client.js` added)
- zero protected runtime drift required on `pull_request` and on `push` to `main`
- **PR #6 is NOT merged and NOT deployed.** Do not merge on green CI alone: architect review
  and owner approval are required, and the later merge must preserve Commit A ancestry
  (no squash, no rebase-merge)

### BETA-R2 — activation preview

Status: **NEXT**

Read-only/operator preview only:

1. build/review exact six-profile UserProfile plan;
2. verify HICC-1 exact Faculty link;
3. confirm HICC-2 exclusion;
4. inspect live `paws_swa_beta` principal state;
5. preview narrow 004 permission contract;
6. inspect SWA runtime setting names as PRESENT/ABSENT, never values;
7. verify PR #6 candidate/artifact;
8. stop before live mutation.

Expected output:

`READY-FOR-LIVE-ACTIVATION` or a precise blocker.

### BETA-R3 — live activation

Status: **NOT AUTHORIZED YET**

Only after explicit owner approval and a clean R2:

- insert approved UserProfile rows;
- create/configure runtime SQL principal if needed;
- apply reviewed read permissions;
- configure required server-side runtime settings;
- deploy exact candidate;
- run authenticated live smoke test.

Do not combine R2 preview and R3 mutation without explicit approval.

### BETA-R4 — first live SQL-backed Beta validation

Status: **PENDING R3**

Prove:

- Firebase login works;
- SQL profile lookup works;
- Beta timetable shows Azure SQL sessions;
- browser has no SQL credentials;
- no Firestore session fallback;
- writes remain fail-closed;
- errors fail closed.

## Separate/parallel Beta work

### PR #5 Faculty enrichment

Status: Draft, architecture accepted, live apply not completed at last checkpoint.

Do not let enrichment block the first timetable connection unless a required field is actually missing.

### Session reconciliation

Status: needed before destructive/session migration decisions.

Classify 1,861 Firestore vs 1,937 SQL deterministically. This does not block a read-only SQL Beta if the owner accepts the loaded SQL baseline for the read path.

### PR #3 metadata cleanup

Status: historical prose drift remains possible.

Do not rerun operations because the PR body still mentions the old empty checkpoint.

## HOLD

### PR #4 old session-read candidate

Status: HOLD / reference only.

Do not merge as-is.

PR #6 supersedes it for the current Beta-R1 implementation direction.

## Experimental/Demo track

Repository `Teaching-assignment`.

### P3.1

PR #76 remains a future-feature architecture source.

Do not require full P3.1 completion before the immediate Beta SQL connection milestone.

### DOE

Current owner decision:

- keep DOE algorithm/engine in Experimental/Demo;
- no Azure DOE migration/rewrite now;
- DOE must not block BETA-R1/R2/R3.

## Later work, not current P0

- Beta write APIs
- full Change Request SQL port
- live AFC SQL workflow/document sealing
- Published Timetable implementation
- P3.1 authority/review port
- LAB SQL port
- DOE SQL port
- complete Firestore retirement
- production hardening/hosting redesign if owner chooses it


# Historical checkpoint — P3B4 AFC artifact specification (superseded 2026-10-04)

This planning-only checkpoint is superseded by the current Tasks 1–7 implementation status at the top of this file.

## P3B3 AFC frontend/API candidate

Status: **CI ACCEPTED FOR EXACT HEAD / REVIEW-ONLY / NOT MERGED / NOT DEPLOYED**

- Branch: `feature/p3b3-afc-frontend-api`.
- Exact head tested: `1454934473d2e1431402f22c8b02d9584b8be4d0`.
- GitHub Actions `Azure Beta Build` run `37214972330` (run 170): SUCCESS.
- Existing test/freeze evidence: root 662 total / 633 passed / 29 skipped / 0 failed; server 224/224; focused 29/29; static freeze 49 paths and API freeze 27 paths, no drift.
- Code review found rapid repeat submits may create duplicate AFC requests because there is no single-flight lock and each attempt gets a new request ID.
- The separate owner question for the narrow P3B3 fix remains unanswered. Do not implement it until answered.
- No PR, merge, or deployment is recorded for this checkpoint.

## Cloudflare named endpoint

Status: **BLOCKED_EXTERNAL_ACCOUNT_OR_DOMAIN**

Read-only account inspection found an authenticated Cloudflare account, no DNS zones/domains, and no named tunnels. Do not create a tunnel or change DNS without a concrete authorized domain/zone and explicit task.

## P3B4 approved AFC artifact

Status: **OWNER DESIGN APPROVED / SPECIFICATION DRAFTED / OWNER SPEC REVIEW PENDING / NO IMPLEMENTATION / NOT LIVE**

- Branch: `feature/p3b4-afc-approved-artifact`, based on P3B3 exact head `1454934473d2e1431402f22c8b02d9584b8be4d0`.
- Specification: `docs/superpowers/specs/2026-10-04-p3b4-afc-approved-artifact.md`.
- Proposed contract: immutable SQL `varbinary(max)` PDF artifact, server-rendered from SQL-authoritative approved data, authenticated and idempotent retrieval/creation, integrity metadata, no public URL.
- No code, SQL migration, table/procedure/grant, live SQL write, Firebase/Firestore change, deployment, merge, or frontend cutover.
- Next gate: owner reviews the saved specification. After approval, write a concrete implementation plan and obtain separate plan approval before coding.
- P3B2 run `37205085774` and P3B3 run `37214972330` are already verified successful; do not repeat without a change.

**Next action:** Commit and push the docs-only spec/checkpoint on the feature branch, present the saved spec to the owner for review, and wait before implementation planning.
## 2026-10-04 — P3B3 duplicate-submit closure
- Fixed the AFC SQL-mode frontend single-flight defect and added regression coverage.
- Product commit `adb943ccadff8851ba9de47bfc6b1d226916b89b`; baseline/governance commit `c818f3937b4fca6372312c41a484ae541a7aa6ae`.
- Exact-head Azure Beta Build run `37216988289` SUCCESS.
- Root suite 666/637 passed/29 skipped; server 224/224; focused client+legacy 50/50; baseline/governance 27/27; static 49 and API 27 protected files, no drift.
- No live SQL/Firebase/cloud/network/deployment changes. Branch remains unmerged and undeployed.
- Stable Cloudflare hostname blocked by unavailable authorized DNS zone/domain. P3B4 remains design-only per owner approval.

