# B2B-PR — LOGIN UX / PERFORMANCE BASELINE PROMOTION / PR PENDING

**Last verified:** 2026-09-30
**Accepted B2B runtime candidate:** `65766bcf9fc57e50ff8b4fe7dd7cedcffb6825be`
**Previous frozen baseline:** `f2d76449a4881cb24196289ebf63fd4cfaaa7d05`
**Promoted frozen baseline:** `65766bcf9fc57e50ff8b4fe7dd7cedcffb6825be`
**Feature branch:** `feature/beta-b2b-login-ux-performance`
**Origin/main before PR:** `c2a71e8f92a6ced8d080e30dbaf39b9d6fd3725b`
**Status:** B2B LOGIN UX / PERFORMANCE ACCEPTED / BASELINE PROMOTED / PR PENDING / NOT LIVE.

B2B preserves B2A authentication continuity while adding bounded Email/Phone
single-flight UX, sanitized in-memory T0–T7 timing, and the protected
`paws-login-performance.js` helper. Optional Firestore Faculty enrichment stays
after T7, SQL FacultyId remains authoritative, late My Timetable enrichment is
locally reconciled without refetching auth or sessions, stale cross-user
enrichment is rejected, and password-change diagnostics use
`password-change-required`.

The static protected set increases from 47 to 48 paths. All 47 B2A paths remain
protected; the only added path is `paws-login-performance.js`. Static and API
freezes share the reviewed B2B candidate as the immutable trust anchor. This
promotion is governance only: no product runtime bytes changed during promotion,
and no merge, deployment, SQL, Firebase, Firestore, Azure, B3, or DOE mutation
has occurred.

# B2A-PR — AUTHENTICATION CONTINUITY BASELINE PROMOTION / PR PENDING

**Last verified:** 2026-09-30
**Accepted B2A candidate runtime:** `f2d76449a4881cb24196289ebf63fd4cfaaa7d05`
**Previous frozen baseline:** `5a7f8a535caaf42992598c6fc8fe301818075e67`
**Promoted frozen baseline:** `f2d76449a4881cb24196289ebf63fd4cfaaa7d05`
**Feature branch:** `feature/beta-r4d12b2a-auth-continuity`
**Origin/main before PR:** `5b705321d9564d00bd0e8cc97f4087347454276a`
**Status:** B2A AUTHENTICATION CONTINUITY ACCEPTED / BASELINE PROMOTED / PR PENDING / NOT LIVE.

B2A preserves a valid Firebase session across transient API/SQL failures, uses one
forced token refresh and one replay only after an explicit first HTTP 401, keeps
inactive/unauthorized accounts fail-closed without automatic signout, and exposes
Faculty Dashboard self-service navigation to Faculty/HICC/VISC while retired
`other_office` fails closed at that capability boundary.

The static protected set increases from 46 to 47 paths. All 46 previous paths
remain protected; the only added path is `paws-auth-continuity.js`. Static and
API freezes share the accepted B2A candidate as one immutable trust anchor.
This promotion is governance only: no SQL, Firebase, Firestore, Azure, merge, or
deployment mutation has occurred, and B2B has not started.

# BETA-R4D-12B1D-RG — CORRECTED API BASELINE PROMOTION / PR INTEGRATION GATE

**Last verified:** 2026-09-29
**Superseded frozen baseline:** `68bda43a71034089a57d3369128e5dafd80f06eb`
**Promoted frozen baseline (corrected runtime):** `5a7f8a535caaf42992598c6fc8fe301818075e67`
**Feature branch:** `feature/beta-r4d12b1d-r-afc-unfiltered-list`
**Origin/main before merge:** `c83faeb39ab637ba1fa17ca066c74004d8a9d620`
**Status:** B1D-R CORRECTED / BASELINE PROMOTED / PR-PENDING / NOT LIVE.

B1D-R found and fixed a live defect: an unfiltered AFC list
(`GET /api/v1/dashboard/afc-records`) returned 503 `SQL_UNAVAILABLE` because
`listAfcRecords()` emitted a bare `WHERE` when no predicates were supplied.
B1D-RG promotes the corrected runtime as the single static/API freeze trust
anchor. The superseded anchor `68bda43...` remains readable as history only.

The promotion is exactly scoped and proved: the static protected set is 46
paths with **zero** delta, and the API protected set (17 runtime files plus
`deploy/aca/Dockerfile`) has **exactly one** delta —
`server/src/data/sql-dashboard-repository.js`, the intended correction. All nine
recorded static `sha256` values are unchanged. `tools/beta-freeze.js` reports
`protected: 46, drift: []`; `tools/verify-beta-candidate.js` reports static
drift `[]` and API drift `[]`.

The governance diff is restricted to freeze trust-anchor configuration,
baseline/governance tests, active static release evidence metadata, and
continuity docs. No product static bytes, API/runtime bytes beyond the already
accepted correction, SQL artifacts, business tests, or Dockerfile are in scope.

B1D-RG performs no ACR publish, no ACA deploy, and no SWA cutover. The live API
still carries the unfiltered-list defect until B1D-RD publishes and activates the
corrected digest. ACR publish, ACA redeploy, C10 acceptance resume, C11 static
cutover, B2A, B2B, B3, and DOE remain queued and must not start automatically.

# BETA-R4D-12B1G — BASELINE PROMOTION / PR PENDING / NOT LIVE

**Last verified:** 2026-09-29
**Starting `origin/main`:** `68cd57074bbcf7916da6a031a238175d5530ae0b`
**Accepted B1 candidate:** `68bda43a71034089a57d3369128e5dafd80f06eb`
**Feature branch:** `feature/beta-r4d12b1-afc-dashboard-write-foundation`
**Parent required for governance commit:** `68bda43a71034089a57d3369128e5dafd80f06eb`
**Status:** B1 IMPLEMENTED / B1R+B1R2 ACCEPTED / BASELINE PROMOTED / PR PENDING / NOT LIVE.

B1G promotes exactly the accepted B1 dual-runtime candidate as the single
static/API freeze trust anchor. `tools/beta-freeze.js` and
`tools/beta-baseline.json` now reference the candidate; API freeze continues to
import the static baseline. Static protected count remains 46 with zero drift;
the API protected set is 17 runtime files plus the ACA Dockerfile with zero
runtime/build-definition drift. The new AFC write repository is now protected
by the candidate baseline rather than missing-at-baseline.

The governance diff is restricted to freeze trust-anchor configuration,
candidate-derived hashes, baseline/governance tests, active static release
evidence metadata, and continuity docs. Product static bytes, API/runtime
bytes, SQL artifacts, business tests, Dockerfile, and AFC behavior remain
unchanged. B1 remains NOT LIVE: migration 007, permissions, deployment, AFC
create, SQL grants, Firestore/Firebase/Auth/Rules mutations, Azure mutations,
A2B, Work Queue, B2A, B2B, and DOE changes were not performed.

Current B1G actions: full local validation, one governance-only commit with
parent exactly the accepted candidate, push, then one PR to `main` using a
merge commit only. Do not start B1D automatically. B1D, B2A, B2B, B3, and DOE
remain queued.

# BETA-R4D-12B1R2 — EXACT AFC SQL PERMISSION CONTRACT CORRECTION / NOT LIVE

**Last verified:** 2026-09-29
**Starting `origin/main`:** `68cd57074bbcf7916da6a031a238175d5530ae0b`
**Feature branch:** `feature/beta-r4d12b1-afc-dashboard-write-foundation`
**Frozen baseline:** `b3458f79a05353ce1255874754e1c6c1ec8ee683`
**Starting B1R2 HEAD:** `b38afabeba683f728e751cfca0bfd144e471d5ee`
**B1R2 correction commit:** `87026ec216ffbd418e2c61fb2f78d6a4862c2584`
**Remote branch HEAD:** `87026ec216ffbd418e2c61fb2f78d6a4862c2584`
**Status:** B1R2 CORRECTED / PENDING ARCHITECT FINAL REVIEW / NOT LIVE.

B1R2 changes only the proposal-only SQL permission contract and offline
contract fixtures. Both 007 permission artifacts now normalize database,
schema, whole-object, and column-level rows into an explicit exact allowlist.
The apply script accepts only the reviewed pre-B1 state or the idempotent
post-B1 state, then grants exactly `paws.vAfcRecordUnified` SELECT and
`paws_api.CreateAfcRecord` EXECUTE, and verifies the exact post-state after the
transaction. The proof script validates the same post-state without mutation.

The class=1/class=3 regression is covered by deterministic fixtures: legitimate
column SELECT and schema DENY rows no longer trip the database-level guard;
unexpected database, schema, full-object, provenance-column, direct AFC,
extra EXECUTE, grant-option, permission-type, missing-DENY, and public-
broadening variants fail closed. No runtime business, API, UI, auth, or data
model redesign was made.

Focused B1/B1R/B1R2/UI/client tests pass 30/30 and the server suite passes
145/145. Root Beta and emulator suites report zero behavioral failures and the
same expected three static frozen-baseline drift failures. API freeze reports
the same six intentional B1 runtime drifts, including the new write repository
missing at the frozen baseline. `git diff --check` and changed-test syntax
checks pass. Baseline, manifest, and freeze governance remain unchanged.

Migration 007, permissions, proof against live, AFC inserts, SQL grants,
Firestore/Firebase/Auth/Rules changes, Azure mutations, deployments, A2B,
Work Queue, B2A, B2B, and DOE changes were not performed. B1G, B1D, B2A, B2B,
B3, and DOE remain queued. Do not open a PR, promote the baseline, apply SQL,
or deploy.

Next exact action: report the two separated sections requested by the architect,
then wait for final review. The B1R2 correction is committed and pushed.

# BETA-R4D-12B1R — AFC WRITE SECURITY + DATA INTEGRITY CORRECTIONS / NOT LIVE

**Last verified:** 2026-09-29
**Starting `origin/main`:** `68cd57074bbcf7916da6a031a238175d5530ae0b`
**Feature branch:** `feature/beta-r4d12b1-afc-dashboard-write-foundation`
**Frozen baseline:** `b3458f79a05353ce1255874754e1c6c1ec8ee683`
**Starting B1R HEAD:** `59632a1f6c04650fabc177bbb1687ebb904a203f`
**Correction commit:** `438dba9cce6f0c917614643c13e6e011b6a0b668`
**Status:** B1R CORRECTED / PENDING ARCHITECT FINAL REVIEW / NOT LIVE.

B0 remains LIVE ACCEPTED / CLOSED. B1 adds an isolated Azure SQL AFC manual
record proposal, unified imported/manual AFC reads, an administrator-only
Dashboard GET/POST surface, and an administrator-only AFC Records UI. B1R
hardens the exact case-sensitive ReasonCode contract, wide SQL validation
inputs, schema/object ownership chain, permission preflight/proof, inactive-
Faculty historical reads, and post-commit procedure response reliability.

Migration 007, its permission proposal, and its least-privilege proof are
proposal artifacts only. No SQL migration, permission grant, manual AFC row,
Firestore write, Firebase/Auth/Rules change, Azure mutation, ACR publish, ACA
deploy, SWA deploy, PR, or merge was performed. Timetable/session writes,
Teaching Assignment authority, HICC/VISC authority, AssignmentMode, DOE, A2B,
Work Queue, B2A, B2B, and B3 remain untouched.

Focused B1/B1R tests pass 25/25 and the server suite passes 140/140. The full
root Beta suite and emulator suite each have only the expected three
frozen-baseline drift assertions failing; behavioral tests pass. Expected static drift is
`faculty-admin.html`, `faculty-admin.js`, and `paws-data-client.js`. Expected
API drift is `server/src/data/dashboard-api.js`,
`server/src/data/sql-afc-write-repository.js` (missing at baseline),
`server/src/data/sql-dashboard-repository.js`,
`server/src/runtime/swa-dashboard-functions.js`,
`server/src/runtime/swa-sql-runtime.js`, and `swa-api/index.js`.

Next exact action: push the B1R correction on this same feature branch, then
send the required B1R A–L report to the architect. Do not open a PR, promote
the baseline, apply SQL, grant permissions, deploy, or start B1G/B1D/B2A.

# PAWS Current Project State

## BETA-R4D-12B0G — FROZEN BASELINE PROMOTED / PENDING PR / NOT LIVE

**Last verified:** 2026-09-29
**Runtime candidate:** `b3458f79a05353ce1255874754e1c6c1ec8ee683`
**Previous frozen baseline:** `8b1388f5afe210c761d6dbc3b4240536758f7342`
**Branch:** `feature/beta-r4d12b0-approval-queue-real-data-cleanup`
**Expected `origin/main`:** `5e5d947fd4c24b340185c1b8bb1a4bbe2c27d67d`

B0/B0R is runtime-accepted. B0G promotes the exact reviewed candidate as the
immutable static/API trust anchor. The protected manifest remains 46 paths with
zero missing previous paths and zero newly added paths. The governance unit is
pending PR/integration and is **NOT LIVE**; B0D remains the separate controlled
static release and live-acceptance gate.

The old visible Approval Queue came from Firestore `change_requests` and
`afc_requests`, not Azure SQL. The live pending legacy records were backed up
and cleared; the B0R read-only recheck remains zero for pending
`change_requests`, `pending_report_to`, and `pending_admin`, and no completed,
signed, audit, or history records were deleted.

The canonical runtime rule is that legacy Firestore approval/AFC business
behavior executes only when `sessionBackend() === 'firestore'`. Azure SQL,
missing, unknown, and throwing backend states fail closed. The current Beta
client remains `sessionBackend() === 'azure-sql'` and
`sessionWritesEnabled() === false`.

The old baseline references retained in historical update/spec/plan records
are intentionally historical references and are not rewritten.

## BETA-R4D-12B0 — LEGACY FIRESTORE APPROVAL CONTAINMENT / CLEANUP COMPLETE

**Last verified:** 2026-09-29
**Starting main:** `5e5d947fd4c24b340185c1b8bb1a4bbe2c27d67d`
**Feature branch:** `feature/beta-r4d12b0-approval-queue-real-data-cleanup`
**Status:** B0 IMPLEMENTED / RUNTIME ACCEPTED / FROZEN BASELINE PROMOTED / PENDING PR-INTEGRATION; LIVE CODE NOT DEPLOYED.

The exact Beta Firebase project was verified as `tester-teaching`. Only the
`change_requests` and `afc_requests` collections were enumerated. The private
pre-cleanup snapshot is outside Git at
`C:\Users\xinyu\Documents\Codex\2026-08-31\outputs\b0\PAWS_BETA_B0_Legacy_Pending_Approval_Backup_2026-09-29.json`.
Its SHA-256 is
`e8bbf5e61d1dd60ff44918e0b7d140456f842fcb2c6a66864f59ed5d932ab572`.

The live legacy queue contained two pending `change_requests` and one
`pending_admin` AFC request. No pending record had finalized signature/PDF
evidence. Those three pending parents were deleted after backup; no AFC child
documents were present. Post-cleanup counts are zero for pending
`change_requests`, `pending_report_to`, and `pending_admin`; one approved AFC
record and one rejected change request remain. No audit/history collection was
modified.

B0 code containment is limited to `asset-loader.js`, `approval-workflow.js`,
and `afc-workflow.js`, plus focused containment tests. Azure SQL mode no longer
loads or initializes the legacy approval workflow, direct legacy script loading
fails closed before `UCVM.init()`, and the AFC panel keeps teaching/history
navigation while showing the temporary Azure SQL migration message without a
request or approval action. No SQL write, migration, seed, deployment, B1/B2,
DOE, Firebase Auth, or Firestore-rules change was made.

## BETA-R4D-12A5G — CONCURRENT AUTHORITY FOUNDATION ACCEPTED / CONTINUITY SYNC

**Last verified:** 2026-09-29
**Accepted branch:** `feature/beta-r4d12a5-concurrent-responsibility-assignees`
**Accepted implementation HEAD before continuity commit:** `e9a415247c80ade128210384a87992257b4c4959`
**Expected `origin/main`:** `342b45ab7433997ed2961dc13a68a2978fa989a5`

R4D-12A5/A5R is **FOUNDATION ACCEPTED / NOT LIVE / NOT SEEDED**. The
concurrent responsibility foundation remains dormant. Migration 005 is merged
but NOT applied. Migration 006 is merged after the A5R fail-closed correction
but NOT applied. No authority seed, Work Queue, AFC, DOE, API/UI route, or
deployment is part of this unit.

Accepted authority semantics:

- `AssignmentMode` is exactly `exclusive` or `concurrent`.
- A stable responsibility may have multiple concurrent Faculty assignees.
- Overlap is valid only for different Faculty rows when both rows are
  `concurrent`; same-Faculty overlap and every overlap involving `exclusive`
  are invalid.
- Touching handoff boundaries and deliberate temporal gaps are valid.
- Co-HICC assignees share one stable responsibility and one package.
- Co-VISC assignees share one stable leader responsibility and do not
  automatically create another group.
- Package identity is independent of the assignee set. DOE remains separate.

Migration 006 fails closed when existing assignee rows are present before
`AssignmentMode` is introduced; it does not infer their mode. The `WITH
VALUES` default is reachable only for a zero-row assignee table.

Continuity evidence retained for the next review gate:

- R1/R2/R3/R4/R5 = `9 / 9 / 0 / 0 / 0`.
- Four exact Faculty lookups remain `NO_MATCH`; no identities were guessed.
- 18 legacy-only HICC courses remain historical/not-current candidates.
- Exact live evidence: 539 Session rows, 24 legacy ambiguous HICC
  RoleAssignment rows, and all 18 `paws.Course` rows exist.
- Private Owner Review V2.1 artifacts remain outside the repository and must
  not be committed.

Owner-dependent review remains intentionally unresolved: OD-01 source
currentness, OD-02 unresolved responsibility patterns, OD-03 legacy-only
disposition, OD-04 temporal bounds, OD-05 Teaching Assignment Group
crosswalk, and OD-06 Faculty identity. A2B remains blocked.

The next independent product queue is ordered as follows and is recorded only
for future work: B0 Beta Approval Queue real-data cleanup; B1 AFC line-by-line
and controlled create; B2 Login UX plus measured performance diagnostics; B3
remaining Dashboard/UI cleanup; then DOE semantic/source repair. None of these
is implemented in A5G.

## BETA-R4D-12A1 — FOUNDATION ACCEPTED / NOT LIVE / MIGRATION NOT APPLIED

**Last verified:** 2026-09-29
**Accepted branch:** `feature/beta-r4d12a1-ta-authority-foundation`
**Accepted branch HEAD:** `bae3d11784575b4b4dc5f17c9789c023e54de5bf`
**Live deployed release remains:** `dcf0607c027a08e5341710a449091fca4c7aa106`
**Current accepted runtime remains:** R4D-11.

R4D-12A1 is a dormant, SELECT-only Teaching Assignment authority foundation.
Merging dormant foundation code does not deploy it. Migration
`005_teaching_assignment_authority_foundation.sql` remains a proposal and has
not been applied. No Subject, responsibility, group, package, or
session-ownership production rows exist from this task unless separately
authorized later.

The immediate next bounded unit is **BETA-R4D-12A2 — CONTROLLED TEACHING
ASSIGNMENT SEED / SOURCE RECONCILIATION AUDIT**. A2 is read-only first and
must produce deterministic reviewed seed evidence for canonical Subjects,
stable HICC/VISC responsibilities, exact HICC Course/Subject scopes,
temporal assignees, groups, memberships, VISC leaders, packages, and working
session ownership. No fuzzy or guessed seeding and no live seed/apply occur
without a later Architect gate. A2 is not Work Queue UI implementation.

Queued follow-up units, not implemented here:

- SQL-backed read-only Work Queue after approved foundation and controlled seed data.
- Owner-directed Dashboard/UI repair without restarting visual design.
- AFC line-by-line records and separately controlled Dashboard write design.
- DOE semantic/source repair, including source reconciliation and removal of meaningless cross-faculty percentage totals.

## 0. Current live state — BETA-R4D-11 CLOSED

**BETA-R4D-11: LIVE DEPLOYED / AUTHENTICATED ACCEPTANCE PASSED / RELEASE CLOSED**

**Last verified:** 2026-09-29
**Repository:** `Alex1122341/Teaching-assignment-azure`
**Deployed release SHA:** `dcf0607c027a08e5341710a449091fca4c7aa106`
**Repository main:** may advance after this point for documentation-only continuity work; a main-branch advance is not a new deployment unless a separately authorized release is performed.

The BETA-R4D-11 release is complete, live, and accepted. The release chain is closed:

- Dashboard/DOE presentation accepted within the documented boundary.
- ACR guard defect fixed.
- Exact-main Build #134 passed (run `36574888135`).
- Immutable ACR image published by ACR Publish #9 (run `36575614909`).
- ACA exact-digest activation passed by ACA Deploy #2 (run `36582044521`).
- Static cutover passed by Static Deploy #7 (run `36582983859`).
- ADFA authenticated acceptance passed.
- Faculty authenticated acceptance passed, including exact `153/153` scoped `SessionId` set equality.

Accepted release artifacts:

- Tested artifact: `azure-beta-dcf0607c027a08e5341710a449091fca4c7aa106` (artifact ID `11036059566`).
- Artifact digest: `sha256:2adbfbdcd94ec580d8f5ee84878dab4ebee66d82091ae65b2c5feb4675c00103`.
- Immutable ACR image digest: `sha256:a9d9021fec23439fa33bd4f67cc958cec8d2737d0cb9afa90f85912948b12503`.
- Active ACA revision: `paws-sql-beta-api-260926--rdcf0607c027a`.

Current architecture and release boundary:

`Browser → Firebase Authentication → Firebase ID token → PAWS Azure Container Apps API → Azure SQL`

- The static frontend is hosted by Azure Static Web Apps.
- Timetable and dashboard business reads use the Azure SQL/API path.
- Session writes are disabled and fail closed.
- There is no Firestore business-data fallback for the migrated timetable/dashboard path.
- DOE evidence is presentation-only from stored SQL evidence: `DOE_PRESENTATION_PARITY=YES`; `FULL_DOE_ENGINE_PARITY=NO`. The Experimental DOE engine is not claimed as migrated.

Canonical accepted SQL counts are Faculty 120, Session 1,937, SessionAssignment 4,970, RoleAssignment 162, and AFC 791. The live Beta has an active faculty-scoped UserProfile for the accepted faculty account; private identity keys are intentionally not recorded, and no total UserProfile count is claimed here.

ACA Deploy #1 (run `36581374421`) remains a **SAFE FAILURE BEFORE MUTATION**: its OIDC identity lacked `Microsoft.App/containerApps/read`, `activationPerformed=false`, and no revision or image mutation occurred. The remediation used the exact target Container Apps Contributor role; private service-principal object identifiers are not recorded.

The earlier ACR G1 failure also remains historical and safe: no image build/push occurred, the absence-classification defect was fixed, and the single-publish/no-overwrite invariant remained intact.

**Next task:** `AWAITING OWNER / ARCHITECT SCOPING`. No R4D-12 is invented here.

The sections below are retained as historical continuity records and are superseded by the current live state above.

## BETA-R4D-11G3 — ACR guard PR continuity synchronized / awaiting merge gate

**Last verified:** 2026-09-29

- Verified `origin/main` is `22194b098ddde312c16af5af01633387374cdd72`.
- The G2 implementation commit `378dd79...` was based on historical `a4550c...`; it was cherry-picked onto the new clean branch `fix/beta-r4d11g2-acr-tag-guard` as local commit `295cc8c...`.
- Scope is limited to the ACR guard, behavior-level regression coverage, and continuity documentation. Product/runtime drift is not introduced.
- R4D-11G1 remains `BLOCKED / SAFE FAILURE / NO IMAGE PUSH / NO LIVE MUTATION`; live Beta remains R4D-10G.
- PR #32 exists from `fix/beta-r4d11g2-acr-tag-guard` to `main`; the accepted implementation head before the continuity sync was `16aac238426fafcc59c72719ba3fa6bae35c5171`.
- PR #32 CI passed: Azure Beta Build #132, run ID `36572092893`; synthetic PR merge SHA `b6929c5dfdd3bc21e522beb18a033e71cbb2a8d7`.
- Protected static runtime verification is 46 paths / zero drift; protected API runtime verification is 16 runtime files plus `deploy/aca/Dockerfile` / zero drift.
- No merge, deployment, ACR/ACA/SWA action, SQL mutation, or Firebase mutation occurred. No release workflow has started.

The current breakpoint is PR #32 accepted through implementation/CI review and awaiting the final merge gate. Do not merge from this checkpoint; after an authorized future merge, start a new exact-main Build and do not reuse Build #131 or artifact `11013550164` for the post-G2 release.

## BETA-R4D-11A — Dashboard UI parity + DOE evidence (IMPLEMENTED / AWAITING ARCHITECT REVIEW)

**Branch:** `feature/beta-r4d11a-dashboard-ui-doe-parity`
**Base:** `6adf40cd8cd89a915e23bcd505d0e3110f91b2e4`

The Azure Dashboard now has four administrator read-only views (Lookup, Teaching
Summary, Roles & Appointments, DOE Overview), lazy server-side aggregate reads,
rich faculty detail sections, deterministic Year → Course → Session expansion,
and self-service profile scope. Stored `DoeCredit` and server-provided effective
role DOE remain authoritative; null, zero, and negative values are preserved.
The Dashboard runtime remains Firebase Auth → PAWS API → Azure SQL with no
Firestore SDK, fallback, writes, imports, rule editing, or N+1 detail loading.

No Azure resource, SQL, Firebase, Firestore, SWA, deployment, merge, baseline
promotion, or PR mutation was performed. Full server tests pass 102/102;
focused R4D-11A frontend tests pass. The freeze check reports intentional
protected drift only in the intentional candidate runtime files
`faculty-admin.html`, `faculty-admin.js`, `paws-data-client.js`, and the new
`dashboard-view-model.js` asset (missing from the older frozen baseline).

**Last verified:** 2026-09-27
**Repository:** `Alex1122341/Teaching-assignment-azure`

## 0. BETA-R4D-11D dual-runtime baseline promoted — AWAITING ARCHITECT REVIEW

**Last verified:** 2026-09-28

- **Accepted product/API runtime candidate:** `8b1388f5afe210c761d6dbc3b4240536758f7342`
- **Promoted frozen baseline:** `8b1388f5afe210c761d6dbc3b4240536758f7342` (previous: `25e8f483b7d2455c0f96b00c82f3fde30760ac17`)

The Faculty Dashboard is now an API-only, read-only surface. `faculty-admin.html` loads exactly five script
elements (Firebase app + auth compat CDN, `session-guard.js`, `paws-data-client.js`, `faculty-admin.js`) and no
longer loads the Firestore SDK, `faculty-access.js`, the legacy auto-start Dashboard modules, or the legacy tabs
and write/import controls. `faculty-admin.js` contains zero Firestore and zero `UCVM.` runtime references; all
Dashboard business data comes from the PAWS Azure SQL Dashboard API with Firebase Authentication only.

The frontend role policy now matches the server exactly: ADMIN = owner / administrator / adfa_general /
adfa_regular / admin, SELF-SERVICE = faculty / hicc / visc, and `other_office` is retired and denied on both sides.

R4D-11D promoted the shared static/API frozen trust anchor to the accepted product/API runtime candidate with
**zero static and API drift**. `verifyFreeze` reports 46 protected static paths; the API freeze reports 16 runtime
files plus the protected ACA Dockerfile. Governance promotion PASS; release readiness is NO pending the existing
faculty-swap source-contract test failures. No merge, PR, deployment, or Azure/SQL/Firebase mutation was performed.

---
## 0. BETA-R4D-10B Stage 2 — IMPLEMENTED / AWAITING ARCHITECT REVIEW

Stage 2 is implemented on `feature/beta-r4d10b-dashboard-api-client-auth` from
exact main `db777d721ccff5665bc103fba89482a356dc0041`. The shared browser data
client now exposes the three existing read-only Dashboard endpoints, and the
Faculty Dashboard authorization gate now resolves `/api/v1/me` through
`UCVM_PAWS_DATA.currentUser()` instead of reading Firestore `users/{uid}` or
calling `UCVM.ready()` / `UCVM.watch()` / `linkFacultyIdentity()`.

This is intentionally not the business-data cutover: the existing Dashboard
roster/detail/session Firestore reads and mutation controls remain for Stage 3,
and this branch has not been deployed. Protected runtime drift is expected for
`faculty-admin.html`, `faculty-admin.js`, and `paws-data-client.js`; frozen
baseline promotion remains Stage 4. No API, SQL, Firebase, Firestore, ACA, or
SWA live mutation was performed.

## 0. BETA-R4D-10A Dashboard read API foundation — IMPLEMENTED ON BRANCH

R4D-10A is implemented on `feature/beta-r4d10a-dashboard-api-read` from main
`7c0d857ed48ca5864aea78e58502066b568004d1` (the true merge commit of PR #21 /
BETA-R4D-9J2). It adds a READ-ONLY Azure SQL Dashboard surface:
`GET /api/v1/dashboard/summary`, `/faculty`, and `/faculty/:facultyId`.
Administrator roles are `owner`, `administrator`, `adfa_general`, `adfa_regular`,
and `admin`; self-service roles are `faculty`, `hicc`, and `visc`; `viewer` is
denied and `other_office` is deliberately NOT introduced. Faculty scope is a
server-side SQL predicate, not a presentation-side filter, and a faculty-scoped
caller with no linked FacultyId is refused with 403 `FACULTY_LINK_REQUIRED`
before any SQL read. Any non-GET method on a Dashboard path returns 405 with
`Allow: GET`.

The reviewed timetable wrapper is unchanged and no protected runtime asset was
touched, so the frozen baseline still reports zero drift. The Dashboard frontend
is NOT switched and no SWA deployment is part of this step. Tests: server 39/39,
root 357 pass / 1 environment-only fail / 29 skipped, Python 64/64. ACA
deployment and live acceptance follow the merge on the exact merged main SHA.

## 0C. BETA-R4D-9J2 owner 24-hour session patch — LANDED ON MAIN

R4D-9J2 replaced the inferred 423-entry session-time proposal with the
owner-supplied `PAWS_Faculty_Summaries_SQL_24h.csv`
(SHA-256 `de62f81cfed0bcd3a79f70a34bc6a6c352a2b68770fafa52c0516ce614ad4cde`).
Matching was exact-SessionId only: 224/224 matched, 0 material identity
mismatches, 179 already correct, 45 differing. All 45 are now grid-positionable
(39 AM→PM shifts, 6 reversed-interval repairs). The apply ran in a single
committed transaction through the approved device-code operator path
(rowsUpdated=45, 0 inserts, 0 deletes); `paws.Session` stayed 1,937,
`paws.SessionAssignment` stayed 4,970, and the SessionId set was unchanged.

The default repair manifest is now a 45-entry CSV-backed patch
(`tools/azure_sql_migration/session_time_corrections.json`, SHA-256
`ec79244237af3de374fff70e1c26ca1f652a381e8ab4b345b184ae3d5d781204`); the retired
423-entry set is retained as history only. Delivered via PR #21, merged to main as
`7c0d857ed48ca5864aea78e58502066b568004d1`.

## 0. BETA-R4D-4A hardening breakpoint

The R4D-4 feature branch `task/beta-r4d4-aca-packaging` starts from the
verified Azure-Beta `main` SHA `ffd870ee5faae298049df08d1bcb616832a07d87`.
It prepares a Node.js 22 Functions-on-Container-Apps image and a UAMI-aware
SQL adapter only. No image has been pushed, no Azure resource has been
created or changed, and no SQL/Firebase/SWA/GitHub live mutation has been
performed. R4D-4A hardening is implemented on the branch and Draft PR #14 is
open. GitHub Azure Beta Build run `36289550648` passed, including the Linux
Docker build step:
https://github.com/Alex1122341/Teaching-assignment-azure/pull/14

This file is intentionally concise. Detailed history belongs in `updates/`.

## 0A. R4D-8B / R4D-9E breakpoint

R4D-8B authenticated proof is complete for both approved ADFA General
accounts. The ACA API returns 1,937 SQL-backed sessions; Account A also has a
deterministic ordered SQL TOP 3 source check. R4D-9E Runtime Commit E adds the
existing academic semester/week mapping to normalized SQL rows so calendar views
accept them; SQL/API/auth/CORS behavior remains unchanged. Runtime E is being
implemented on a feature branch from main `37b4db8a556cb12e588a0f95b08a83e793960851`:
the browser data client will call the exact ACA origin directly, while the
manual SWA deployment remains static-only. Governance Commit F must promote
the frozen baseline separately after review. No frontend deployment has been
performed and no tokens, UIDs, or credentials are stored here.

## 0B. BETA-R4D-9J session-time reconciliation — LIVE ACCEPTANCE PASSED

R4D-9J is implemented on `feature/beta-r4d9j-session-time-reconciliation`
from main `c090f73836d31ff02677b11f06a50dc8421d34af`. The source-backed
reconciliation covers all 1,937 Azure SQL sessions and preserves the stable
SessionId set while applying 423 exact StartTime/EndTime corrections from
`ucvm_timetable_master_2026-09-27.xlsx`. The full rebuild gate passed:
4,974 raw Teaching Assignments -> 4,970 canonical SessionAssignments, 1,937
sessions before/after, identical SessionId sets, identical assignment
relationships, and zero approved-time mismatches.

The reviewed live operator path completed successfully on 2026-09-27. The
operator-safety fix removed the out-of-bound `UpdatedAtUtc` mutation so the SQL
UPDATE changes only `StartTime` and `EndTime` under the exact old-value guard.
A pre-update backup was written outside Git to
`C:\Users\xinyu\Desktop\PAWS-R4D9J-Live-Backup\PAWS_BETA_R4D9J_SQL_TIME_BACKUP.csv`
with SHA-256
`3c47c9890e56d65e3319947da2a88e92aa0cd3ea3d2d803d8ff819ecc7817ad8`.
The transaction committed 423/423 updates, 0 inserts, and 0 deletes.
`paws.Session` stayed 1,937, `paws.SessionAssignment` stayed 4,970, and
the SessionId-set SHA-256 stayed
`2a105c0086ac52dc574a732d7aef2b2eb9cac0cdfe9648d6ca346c4db1093224`.

Post-apply acceptance passed: all 423 manifest times match SQL,
`paws.vCalendarSession` = 1,937, 20/20 corrected view samples match,
the live browser reports `azure-sql`, writes disabled, and 1,937 API sessions,
with 20/20 corrected API samples matching. Calendar partition checks passed for
Fall W1 (52 grid + 25 check = 77), Fall W5 (60 + 9 = 69), Fall W6
(60 + 19 = 79), and Spring W4 (10 + 7 = 17), with unique SessionId counts equal
to totals. Fall W5 changed from 37 grid / 32 check to 60 grid / 9 check while
preserving 69 total sessions. Remaining unresolved SQL classification is
493 early-clock, 65 reversed, 35 00:00 sentinels, 0 other, total 593
Check-needed. Rollback preview passed with zero writes.

No protected frontend file changed, no Firestore timetable fallback was added,
and no SWA deployment is required for R4D-9J. PR #20 is the final review/merge
vehicle; merge only after the continuity commit CI is green.

## 1. Immediate owner priority

**P0: connect the existing Azure Beta frontend to the existing Azure SQL database and get the Beta running.**

Not current priority:

- DOE engine migration
- DOE algorithm redesign
- new DOE engine
- full P3.1 Azure implementation
- Published Timetable implementation
- complete Firestore retirement
- broad future-domain redesign

DOE remains in the Experimental/Firebase demo track for now.

## 2. Repository tracks

### Experimental / Demo

Repository: `Alex1122341/Teaching-assignment`

Purpose:

- feature-forward development
- Firebase/Firestore demo
- DOE algorithm and engine work
- P3.1 architecture and future workflows
- synthetic/lab validation

Important P3.1 PR:

- PR #76
- branch `feature/scoped-parallel-assignment-workflow`
- accepted review HEAD `6ce74ef832d5d3a801d48d5e3cb03943c7cc47a1`
- open, Draft, mergeable at last verification

### Azure Beta

Repository: `Alex1122341/Teaching-assignment-azure`

Purpose:

- controlled real-user Beta
- Azure SQL migration/integration
- Azure runtime/release validation
- stability-sensitive feature ports

Current main:

- `4071f7f339418162e473d9a3c7830f625bc1fa35` (pre-R4D-9E main)

Frozen application baseline:

- `2b10aca5b9ab26ffecdffb685bddd33ae4de70f5` (Runtime Commit I — BETA-R4D-9H admin timetable access: automatic administrator Dashboard landing removed so authorized ADFA/admin accounts stay in the timetable)
- previous baselines `f74443d945a9f6c917e7e634eb2e7825f02c7ab0` (Runtime Commit G) and `6eeb1a4ac8c9565a4afbf479277a7e2f543f9e26` are retained only as historical evidence
- Governance Commit F is pending review; deployment remains a separate exact-main step.

## 3. Current Azure SQL checkpoint

Server:

`ucvm-teaching-lab-xz-20260911.database.windows.net`

Database:

`teaching-assignment-lab`

Accepted loaded checkpoint:

| Object | Count/status |
|---|---:|
| `paws.Faculty` | 120 |
| `paws.Session` | 1,937 |
| `paws.SessionAssignment` | 4,970 |
| `paws.AfcRecord` | 791 |
| `paws.RoleAssignment` | 162 |
| `paws.vCalendarSession` | 1,937 |
| `paws.UserProfile` | 0 at last accepted checkpoint |
| `staging.ImportRow` | 6,838 |

The reset/load already completed.

**Do not rerun reset or the initial empty-database loader.**

## 4. Current Beta runtime before BETA-R1 deployment

The currently deployed Beta site still uses:

- Firebase Authentication
- Firestore project `tester-teaching` for the current deployed business runtime

Azure hosting does not by itself mean the deployed page is SQL-backed.

Saved read-only Firestore snapshot (2026-09-25) included:

- users 7
- faculty 117 (116 real + 1 synthetic placeholder)
- sessions 1,861
- faculty_groups 1
- change_requests 3
- afc_requests 2
- afc_audit 3
- session_change_log 8
- faculty_change_log 17
- account_audit 10
- public_schedule 1
- settings 5 derived documents

P3.1 future collections and LAB collections contained no Beta rows in that snapshot.

The Firestore/SQL session difference is a **net count difference**, not proof of exactly 76 missing sessions. It still requires deterministic reconciliation before any destructive session migration.

## 5. Current Beta PR state

### PR #3 — Azure SQL migration foundation

- Draft/open
- branch `feature/azure-sql-cutover-foundation`
- HEAD `edb46dc734613ea35bb211d1c98dd21bce851e33`
- mergeable at last verification
- foundation for loaded SQL schema/import tooling
- PR prose may contain historical empty-database wording; do not treat that wording as current live state

### PR #4 — old SQL session-read candidate

- Draft/open
- HEAD `d9244f5b0a841470ebf1a67b043f59c4b83ad9c2`
- mergeable false at last verification
- **HOLD / DO NOT MERGE AS-IS**
- useful implementation reference only

### PR #5 — Faculty enrichment Phase A

- Draft/open
- HEAD `a940902018315ca983ec2d6d362a1c1231247e07`
- mergeable at last verification
- `FacultyDirectoryProfile` is designed/tested but not live at last accepted checkpoint
- live apply requires a separate reviewed operator step

### PR #6 — BETA-R1 Azure SQL timetable read

- Draft/open
- branch `task/beta-r1-connect-azure-sql`
- base `main` (`ea80eecc9fa2ac2b693c23979bad5c5809a26863`) — retargeted 2026-09-26 (BETA-R3A-2)
- **Runtime Commit A** `6eeb1a4ac8c9565a4afbf479277a7e2f543f9e26` merged current `main` INTO the
  PR branch (merge commit; parents `075852b…` + `ea80eecc…`; tree `543b00af…`)
- **Commit B (BETA-R3A-3)** — governance-only frozen-baseline promotion, parent = Commit A
- HEAD = Commit B (tip of `task/beta-r1-connect-azure-sql`)
- mergeable at last verification
- implementation complete; **NOT merged**; **NOT deployed**
- session read path: Firebase Auth → API → Azure SQL → existing timetable UI
- no Firestore fallback for the Azure session-read path
- session writes fail closed
- no DOE files changed
- the 4 BETA-R1 commits `c006c9a`, `b230718`, `4af5af8`, `075852b` are preserved unchanged

Frozen Beta runtime baseline (promoted by Commit B):

- `6eeb1a4ac8c9565a4afbf479277a7e2f543f9e26` — BETA-R1 SQL-backed read runtime candidate
- previous baseline `86bd5aa2c8a25259f3f708e49b322220ff43a147` is historical evidence only
- protected path set 44 → 45 (all 44 previous paths retained, plus `paws-data-client.js`)
- zero protected runtime drift is allowed on both `pull_request` and `push` to `main`
- **the promoted baseline is NOT YET DEPLOYED**; the live Azure beta site still predates BETA-R1

Current CI for PR #6 (fresh, `pull_request`, base `main` @ `ea80eecc…`):

- Approved Commit A: Azure SQL Migration Tests `36265424485` SUCCESS;
  Azure Beta Build `36265424535` SUCCESS (head `6eeb1a4…`)
- Commit B CI: recorded in the BETA-R3A-3 report (new run IDs only)
- retired evidence: runs `36249819711` / `36249819750` are pre-retarget historical
  (checkout `Merge 075852b… into edb46dc…`) — do not reuse

## 6. BETA-R1 remaining live blockers

The code path exists, but real browser E2E remains blocked by live activation work.

At last checkpoint:

1. `paws.UserProfile` has no live profiles.
2. reviewed Beta profiles need deterministic provisioning.
3. runtime SQL principal/permissions need live verification/application.
4. SWA backend configuration must be reviewed/configured.
5. deployment has not happened.

Reviewed account outcome:

- source Beta users: 7
- planned SQL profiles: 6
- HICC-2 excluded with `HUMAN_CONFIRMED_DELETE_ACCOUNT`
- HICC-1 requires the exact previously reviewed SQL Faculty link
- DVM viewer remains non-Faculty
- LAB viewer remains non-Faculty
- admin/global profiles have no FacultyId
- no fuzzy identity matching

## 7. Current breakpoint

The next safe work is **BETA-R2 activation preview**, not more feature development:

- generate/review the six-profile UserProfile apply plan;
- inspect whether `paws_swa_beta` exists and its effective permissions;
- inspect presence/absence of required SWA runtime setting names without exposing values;
- verify PR #6 deployment candidate;
- stop before every live mutation.

Only after an explicit owner-approved live activation step should profiles, principal/grants, settings or deployment be changed.
