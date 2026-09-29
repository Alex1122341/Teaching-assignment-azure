# BETA-R4D-12B1 — AFC LINE-BY-LINE / ISOLATED SQL CREATE FOUNDATION

Status: **IMPLEMENTED / PENDING ARCHITECT REVIEW / NOT LIVE**

- Starting `origin/main`: `68cd57074bbcf7916da6a031a238175d5530ae0b`.
- Feature branch: `feature/beta-r4d12b1-afc-dashboard-write-foundation`.
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
- Focused B1 tests pass 20/20; server suite passes 135/135. Full root and
  emulator suites pass all behavioral tests; each reports only the expected
  three frozen-baseline drift assertions. `git diff --check` and changed-JS
  syntax checks pass.
- No SQL apply, permission apply, live AFC creation, Firestore/Firebase/Auth/
  Rules mutation, Azure mutation, ACR/ACA/SWA deployment, PR, merge, baseline
  promotion, A2B, Work Queue, B2A, B2B, or DOE change occurred.

Next exact action: create the B1 implementation commit and push the feature
branch. Stop after the architect report; B1G and B1D remain queued.

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
