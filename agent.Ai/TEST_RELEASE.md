# PAWS Test and Release Guide

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

## 0A. Current B2B governance state

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

## 0B. Previous B2A governance state

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

## 0C. Previous BETA-R4D-12B1D-RG governance state

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

`65766bcf9fc57e50ff8b4fe7dd7cedcffb6825be`

This is the accepted B2B login UX/performance candidate and the single
static/API trust anchor. The previous B2A baseline
`f2d76449a4881cb24196289ebf63fd4cfaaa7d05`, the B1 corrected baseline
`5a7f8a535caaf42992598c6fc8fe301818075e67`, the earlier B1 baseline
`68bda43a71034089a57d3369128e5dafd80f06eb`, and the B0 baseline
`b3458f79a05353ce1255874754e1c6c1ec8ee683` remain historical evidence only.

Protected static assets are driven by `tools/static-assets.json` (48 entries).
All 47 B2A paths remain protected and the sole new protected path is
`paws-login-performance.js`. Both `pull_request` and `push` to `main`
allow zero protected runtime drift.

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
