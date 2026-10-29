# PAWS Beta current test/release guidance — 2026-10-15

This top section supersedes the older per-milestone "Current" labels below without removing their evidence. Reviewed Beta main: 0d4b4d9; most recent **documented deployed API + Firebase Hosting**: ca465bf1401b457ca3b74048cfaf170bedc7694a (2026-10-14), immutable product/trust anchor fb2c625745957fa7d9990033f15a7b1ef91974a5. No live release action occurs from a docs-only update.

## Production-like Beta path

- https://tester-teaching.web.app Firebase Hosting static site, Firebase Authentication, temporary Cloudflare HTTPS ingress, University Windows Node API, SQL Server ITAPPVETOPSDB01 / VetMed-Ops. No direct browser SQL, no Firestore fallback for migrated SQL business data.
- The current release target is Firebase Hosting-only, not the retired historic Azure SWA deployment. Standard GitHub CI or a source merge does not deploy.
- Runtime SQL identity still requires an institution-managed least-privilege replacement and proper ingress/host/hardening before production. Do not accept broad db_owner runtime membership as a permission verification substitute.

## Latest accepted release evidence

- PR #94/#95/#96 history: AFC record Create/Cancel controls and grouped LAB/SRL detail, SQL036/037 rowversion correction, final docs; deployed runtime ca465bf, trust fb2c625.
- Exact-main Beta Build run38453614170 and migration run38453614145 passed; all 71 shipped static assets matched accepted artifact; SQL cancellation/encoding and stale/denied/concurrent rollback tests passed.
- Authenticated Chrome read-only acceptance: actual grouped LAB/SRL rows, enabled Create AFC and 803 active Delete controls, Faculty labels with names and no GUID/UID displayed. Delete confirmation dismissed; a fresh read still showed 803. **No live business UI create/cancel operation occurred.**
- Firebase Hosting workflow run38454750572 failed predeployment due to its stale DOE-off check. A separately authorized Hosting-only CLI release published the exact accepted artifact; **do not disable properly approved DOE gates to satisfy a stale workflow assumption**.
- Earlier SWAP/Developer Support read-acceptance is not evidence of completed live SWAP application or Developer Undo.

## Required ordered release gates

1. Verify exact owner authorization, repo track, current main, PR/dependency HEADs, SQL/runtime state, and whether comparable code already exists. Never use a historic PR/CI result as fresh release proof.
2. Implement on isolated feature branch/worktree; independent product/security review and tests. Document SQL source identity and privacy scope.
3. Independently review immutable freeze promotion of shipped static and API paths, pin accepted product SHA and verify both Git repository and generated build artifacts against immutable Git blobs. Never use mutable baseline JSON or a drift waiver as authority.
4. Require full expected PR CI, including JS/server, relevant emulators, migration syntax, actual SQL concurrency tests when needed, generated artifact/freeze checks; investigate failing jobs.
5. Require owner-authorized PR merge; exact merged-main CI acceptance follows. CI PASS != deploy.
6. For changed schema/API, stage approved narrow SQL migrations, least-privileged procedure roles, exact attested University runtime, runtime health/permissions/CORS and retained rollback version; activate only approved gates.
7. Publish only the exact accepted static package to Firebase Hosting using authorized Hosting-only release. Do not publish Firestore rules/indexes/Functions or historic Azure SWA paths unless independently scoped.
8. Live acceptance: public assets and SHA convergence, login and self-scope, anonymous /me -> 401, actual SQL-backed data, no leaked sensitive fields, stale-denied/rollback behavior, correct DOE source and policy labels, and preserved record counts; distinguish read UI review from actual mutation tests.
9. Write a dated agent.Ai/updates/ record with exact SHA, runs, tests, verified live operations, negative claims, blockers and DO NOT REDO.

## Current Draft/not-yet-releasable chain

- PR #97: documentation/design only; #98: Calendar working activity and exact-source AFC counterpart migration candidate, code/review/CI prepared; at the 2026-10-15 checkpoint it was not in main, and HEAD now contains the 038–043 source range covering this scope; no live SQL objects/import/deletion follows from source presence alone.
- PR #99: ADFA SWAP DOE/availability preview on #98; draft/not released.
- PR #100: scoped scheduling conflict Tasks on #99/#98; at last inspection Azure Beta Build #386 (run38771955326) failure, despite SQL and Calendar Activity acceptance checks passing. Not release-ready.
- Before #98's irreversible source change: approved private recovery artifacts, exact source preflight, dedicated narrow runtime identity, SQL locks and explicit separate destructive-data authorization. No preview number is permission to delete.

## DOE release boundary

- 34 guidelines reference entries in code; candidate normalized 2026-27 Master/Guidelines annual Rule Book Draft revision2: 58 rules, 56 courses, 25 subjects, 25 scoped exceptions. Candidate impact across 5282 rows with zero delta is **not Active publication**.
- Independently confirm current SQL Active policy, validated revision and source fingerprint before Publish or global Recalculate. Reviewer/admin UI availability alone does not prove these gates may be activated.
- Signed manual DOE, reserved supervision, role effective periods, contract target and versioned result provenance remain independent; do not invent missing data.

---

## Historical test and release evidence below (the old "current" titles are milestone-specific)

# PAWS Test and Release Guide

## Current — AFC Multi Input paste-date normalization

**Status: IMPLEMENTED LOCALLY / FREEZE PROMOTION PREPARED / NOT LIVE**

- Base `main` and `origin/main` verified at `1a6e04b895650718cdd4bc41ddfaa9c7014a05a1`.
- Product commit `51ed5f7aa0851aac5f20133ea213666028e018a3` on `fix/beta-afc-paste-date-normalization`.
- Strict year-first paste normalization, visible field-specific invalid-date errors, whole-batch submit gating, and 1–20 row regressions are implemented.
- Focused UI/parser and AFC API contract tests passed 31/31; server suite 309/309. Root `npm test` after promoting the reviewed product SHA: 771 total / 742 pass / 29 skipped / 0 failed. Candidate and API freezes pass with zero drift; the static manifest remains 52 files. Release bundle build and static/API artifact checks pass.
- Emulator suite is not locally verified: Firestore JVM failed native memory allocation; serial/low-memory retry later hit a Windows child-process access violation (`git show`, exit 3221225477) and one hosting-boundary test failure. Standard GitHub CI on Node 22/Java 21 remains the required acceptance evidence.
- Static manifest remains at 52 paths, with no path additions/removals. API protected source is unchanged. No SQL/API/auth/Firebase/data mutation, deployment, or synthetic AFC business record.
- Next: rerun full suite/build against the promoted baseline; then PR/CI, merge, exact-main frontend deployment, and no-write live UI acceptance.

---

## 0. Current BETA-R4D-11 release evidence

**Status: LIVE DEPLOYED / AUTHENTICATED ACCEPTANCE PASSED / RELEASE CLOSED**

- Deployed release SHA: `dcf0607c027a08e5341710a449091fca4c7aa106`.
- Build #134 / run `36574888135` passed on exact main.
- Tested artifact: `azure-beta-dcf0607c027a08e5341710a449091fca4c7aa106`, artifact ID `11036059566`.
- Artifact digest: `sha256:2adbfbdcd94ec580d8f5ee84878dab4ebee66d82091ae65b2c5feb4675c00103`.
- ACR Publish #9 / run `36575614909` published immutable image digest `sha256:a9d9021fec23439fa33bd4f67cc958cec8d2737d0cb9afa90f85912948b12503`.
- ACA Deploy #2 / run `36582044521` activated revision `paws-sql-beta-api-260926--rdcf0607c027a` by exact digest.
- Static Deploy #7 / run `36582983859` completed the static cutover.
- ADFA authenticated acceptance passed.
- Faculty authenticated acceptance passed with exact `153/153` Faculty-scoped `SessionId` set equality.
- Admin-boundary API tests returned 403 and the cross-faculty detail test returned 403.
- Session writes were disabled and fail closed; no Firestore business fallback was used for the migrated timetable/dashboard path.
- DOE evidence was presentation-only from stored SQL evidence: `DOE_PRESENTATION_PARITY=YES`; `FULL_DOE_ENGINE_PARITY=NO`.

ACA Deploy #1 / run `36581374421` is a safe failure before mutation: OIDC lacked `Microsoft.App/containerApps/read`, `activationPerformed=false`, and no revision/image mutation occurred. The remediation was the exact target Container Apps Contributor role. Do not record private service-principal object IDs.

The ACR G1 failure remains historical safe-failure evidence: no image build/push occurred, the absence-classification defect was fixed, and the single-publish/no-overwrite invariant remained intact.

The deployed release SHA must remain distinct from repository main. A documentation-only main advance is not a deployment. After this closure, the next task is **AWAITING OWNER / ARCHITECT SCOPING**; no R4D-12 is implied.

## 0A. Current B2B-PERF governance state

**Status: B2B-PERF ACCEPTED / BASELINE PROMOTED / PR PENDING / NOT LIVE**

- Accepted B2B-PERF runtime candidate and promoted frozen trust anchor:
  `6bfd637af57955ded38e6a39d2c055bec67a0aa0`.
- Previous frozen baseline:
  `65766bcf9fc57e50ff8b4fe7dd7cedcffb6825be`.
- Static protected set is 48 paths — added 0, removed 0, content drift 0. The 11
  recorded `sha256` values are byte-for-byte unchanged and `tools/static-assets.json`
  is unchanged.
- API runtime set grows 17 → 18. The only new protected path is
  `server/src/perf/request-timing.js`; the accepted modified set is exactly
  `server/src/data/data-api.js`, `server/src/data/sql-connection.js`,
  `server/src/data/sql-user-repository.js`, `server/src/runtime/swa-functions.js`.
  `deploy/aca/Dockerfile` delta is zero.
- B2B-PERF instruments `GET /api/v1/me` with the fixed metric allowlist
  `firebase_verify`, `sql_connect`, `sql_user_query`, `profile_validate`,
  `me_total`. Timing is monotonic and request-local only: no persistence, no
  telemetry backend, no logging sink, no token/UID/FacultyId/email/name.
  Anonymous and invalid-token requests receive no detailed `Server-Timing`.
- `sql_connect;desc="cold"` means only a new `ConnectionPool.connect()` in the
  current Node runtime; `desc="warm"` means only that a reusable pool already
  existed. `me_total` is application-side `/me` timing, not browser-visible
  latency; the derived remainder is described only as `in-process unattributed
  remainder`.
- B2A/B2B behavior is preserved and B2B-PERF is NOT LIVE.
- This is governance promotion only. No merge, deployment, Azure scaling change,
  SQL, Firebase, Firestore, secret, B3, or DOE mutation has occurred.

## 0B. Previous B2B governance state

**Status: B2B LOGIN UX / PERFORMANCE ACCEPTED / BASELINE PROMOTED / PR PENDING / NOT LIVE**

- Accepted B2B runtime candidate and promoted frozen trust anchor:
  `65766bcf9fc57e50ff8b4fe7dd7cedcffb6825be`.
- Previous frozen baseline:
  `f2d76449a4881cb24196289ebf63fd4cfaaa7d05`.
- Static protected set is 48 paths. All 47 B2A paths remain protected and the
  only added path is `paws-login-performance.js`.
- B2A continuity semantics remain unchanged. B2B adds single-flight Email/Phone
  login UX, sanitized in-memory T0–T7 diagnostics, and removes optional
  Firestore Faculty enrichment from the blocking login path.
- SQL FacultyId remains authoritative; late enrichment reconciles My Timetable
  locally when needed and stale cross-user enrichment is ignored.
- This is governance promotion only. No merge, deployment, SQL, Firebase,
  Firestore, secret, Azure, B3, or DOE mutation has occurred.

## 0C. Previous B2A governance state

**Status: B2A AUTHENTICATION CONTINUITY ACCEPTED / BASELINE PROMOTED / PR PENDING / NOT LIVE**

- Accepted B2A candidate and promoted frozen trust anchor:
  `f2d76449a4881cb24196289ebf63fd4cfaaa7d05`.
- Previous frozen baseline:
  `5a7f8a535caaf42992598c6fc8fe301818075e67`.
- Static protected set is 47 paths. All 46 prior paths remain protected and the
  only added path is `paws-auth-continuity.js`.
- Static and API freezes continue to share one immutable Git baseline.
- B2A preserves valid Firebase sessions across transient API/SQL failures,
  performs at most one forced refresh/replay after an explicit first 401, keeps
  authorization/inactive failures fail-closed without automatic signout, and
  exposes explicit Faculty/HICC/VISC Dashboard self-service capability while
  `other_office` fails closed for that capability.
- This is governance promotion only. No merge, deployment, SQL, Firebase,
  Firestore, secret, or Azure mutation has occurred; B2B has not started.

## 0D. Previous BETA-R4D-12B1D-RG governance state

The corrected B1 runtime `5a7f8a535caaf42992598c6fc8fe301818075e67` is now the
immutable static/API freeze trust anchor. It supersedes
`68bda43a71034089a57d3369128e5dafd80f06eb`, which is retained as historical
evidence only.

The correction it carries: an unfiltered AFC list
(`GET /api/v1/dashboard/afc-records`) answered 503 `SQL_UNAVAILABLE` because
`listAfcRecords()` emitted a bare `WHERE` clause when no predicates were
supplied. The corrected runtime omits the clause entirely.

B1 is implemented, B1R/B1R2 accepted, B1D-R corrected, baseline-promoted,
PR-pending, and **NOT LIVE**. The legacy Firestore Approval/AFC workflow is
fail-closed unless the explicit compatibility backend is `firestore`; the Azure
Beta client remains `azure-sql` with writes disabled. B1D-RD (ACR publish of the
corrected digest plus ACA redeploy) is the separate gate that makes the
correction live; the static cutover and authenticated acceptance resume follow
it.

Promotion evidence: static freeze PASS with `protected: 46, drift: []`;
candidate verifier PASS with static drift `[]` and API drift `[]`. Static
protected delta between the two anchors is 0; API protected delta is exactly 1
path (`server/src/data/sql-dashboard-repository.js`).

### Previous governance state (BETA-R4D-12B1G)

The reviewed B1 dual-runtime candidate
`68bda43a71034089a57d3369128e5dafd80f06eb` was the immutable static/API freeze
trust anchor before the B1D-R correction. It is superseded but remains readable
in Git as history.

The older sections below are retained as historical guidance and evidence.

## 1. Core rule

**Green CI is evidence, not deployment authorization.**

A PR may be complete and green while:

- not merged;
- not deployed;
- not live-provisioned;
- not connected to live runtime settings.

Always report these states separately.

## 2. Current BETA-R1 evidence

PR #6 implementation report recorded:

- Azure SQL Migration Tests #46: SUCCESS
- Azure Beta Build #58: SUCCESS
- Node tests: 290 pass, 0 fail, 29 skipped
- server SQL-runtime authorization tests: 10/10
- Firebase emulator regression: 319/319
- deployment/baseline contract tests: 14/14
- combined app/API artifact built
- no deployment

Verify again if PR #6 HEAD moves.

## 2A. BETA-R4D-9J live repair acceptance

R4D-9J live acceptance completed on 2026-09-27 using the reviewed
foreground PowerShell/device-code operator path.

Evidence:

- operator UPDATE mutates only `StartTime` and `EndTime`; the exact
  `SessionId + old StartTime + old EndTime` guard remains;
- manifest = 423, SHA-256
  `3802b09a9e0bc5b75a598f45390667577da90e7cb11493a399d0fee947fa17a9`;
- pre-apply preview = 423 corrections, 1,937 sessions, 4,970 canonical
  SessionAssignments, zero writes;
- outside-Git backup SHA-256 =
  `3c47c9890e56d65e3319947da2a88e92aa0cd3ea3d2d803d8ff819ecc7817ad8`;
- transaction = COMMITTED; 423 updated, 0 inserted, 0 deleted;
- Session and SessionAssignment counts unchanged at 1,937 and 4,970;
- all captured domain table row counts unchanged;
- SessionId-set SHA unchanged at
  `2a105c0086ac52dc574a732d7aef2b2eb9cac0cdfe9648d6ca346c4db1093224`;
- manifest new-time verification = 423/423;
- `paws.vCalendarSession` = 1,937; corrected sample = 20/20;
- browser/API = `azure-sql`, writes disabled, 1,937 sessions; corrected
  API sample = 20/20;
- Fall W1/W5/W6 and representative Spring W4 partitions are exhaustive and
  duplicate-free;
- rollback preview PASS with zero writes;
- no SWA deployment and no protected frontend runtime change.

PR #20 may be merged only after its post-continuity-update CI is green, using a
normal merge commit (no squash/rebase).

## 3. Freeze/baseline

Frozen application baseline:

`6bfd637af57955ded38e6a39d2c055bec67a0aa0`

This is the accepted B2B-PERF `/me` server-timing candidate and the single
static/API trust anchor. The previous B2B baseline
`65766bcf9fc57e50ff8b4fe7dd7cedcffb6825be`, the B2A baseline
`f2d76449a4881cb24196289ebf63fd4cfaaa7d05`, the B1 corrected baseline
`5a7f8a535caaf42992598c6fc8fe301818075e67`, the earlier B1 baseline
`68bda43a71034089a57d3369128e5dafd80f06eb`, and the B0 baseline
`b3458f79a05353ce1255874754e1c6c1ec8ee683` remain historical evidence only.

Protected static assets are driven by `tools/static-assets.json` (48 entries,
unchanged). The promotion adds 0, removes 0, and changes 0 static protected
paths; all 11 recorded `sha256` values are unchanged. The API runtime protected
set grows from 17 to 18 runtime files: the only new path is
`server/src/perf/request-timing.js`, and the accepted modified set is exactly
`server/src/data/data-api.js`, `server/src/data/sql-connection.js`,
`server/src/data/sql-user-repository.js`, and
`server/src/runtime/swa-functions.js`. `deploy/aca/Dockerfile` is unchanged.
Both `pull_request` and `push` to `main` allow zero protected runtime drift.

`tools/beta-freeze.js` compares against immutable Git blobs from the frozen baseline.

Do not bypass freeze protection merely to get a feature deployed.

When the approved Beta release intentionally changes protected runtime files, the baseline/release process must be updated deliberately.

## 4. Build artifacts

Historical static-only release used a static artifact.

BETA-R1 candidate builds:

```text
.azure-production/
  app/
  api/
```

The API artifact is part of the candidate and must be tested/bound to the exact release.

## 5. Minimum acceptance for BETA-R1 live activation

Before calling the SQL-backed Beta connected:

1. approved UserProfiles exist;
2. authenticated API verifies Firebase token;
3. `/api/v1/me` returns the expected SQL profile;
4. `/api/v1/sessions` successfully reads Azure SQL;
5. page visibly renders SQL-backed timetable data;
6. no session Firestore fallback;
7. browser contains no SQL credential;
8. session mutation remains disabled;
9. DOE remains unchanged;
10. exact deployed SHA/artifact is recorded.

## 6. Live operator evidence

After any live activation, the agent update must record:

- exact deployed frontend/API SHA/artifact;
- SQL profile count after apply;
- SQL principal name/type (not secret);
- permission categories;
- setting names configured (not values);
- smoke-test account category;
- success/failure;
- rollback/forward action if needed.

Never place secret values in the update.

## 7. Exact-ref discipline

When a task names a PR HEAD, inspect that HEAD.

Do not use default branch code as a substitute.

Important refs at the continuity baseline:

- Beta main `e15a532...`
- PR #3 `edb46dc...`
- PR #4 `d9244f5...`
- PR #5 `a940902...`
- PR #6 `075852b...`
- Experimental PR #76 `6ce74ef...`

Mutable facts must be reverified before action.

## 8. Merge discipline

No merge without explicit owner approval.

A Draft PR is not approval.

A green build is not approval.

A successful preview is not approval for live mutation.

## 9. Deployment discipline

Normal pushes do not release Beta.

Use the reviewed manual exact-SHA release path.

Record deployment in `agent.Ai/updates/` immediately after completion.

## 10. DOE regression boundary

Current owner instruction is stronger than a generic regression rule:

**do not modify DOE at all during the Beta connection work.**

If a proposed “small fix” touches DOE files, stop and ask whether scope changed.
