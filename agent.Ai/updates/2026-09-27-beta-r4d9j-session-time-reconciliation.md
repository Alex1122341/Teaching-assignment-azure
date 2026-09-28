# Agent Update — BETA-R4D-9J authoritative session-time reconciliation

**Date:** 2026-09-27  
**Agent/model:** Codex / GPT-5  
**Repository:** `Alex1122341/Teaching-assignment-azure`  
**Task status:** LIVE ACCEPTANCE PASSED / PR FINALIZATION

## 1. Goal

Reconcile all 1,937 Azure SQL sessions to the 2026-09-27 authoritative UCVM
timetable, persist only deterministic time corrections after stable identity
generation, and prepare a transactional exact-SessionId SQL repair.

## 2. Starting breakpoint

- base branch: `main`
- base SHA: `c090f73836d31ff02677b11f06a50dc8421d34af`
- working branch: `feature/beta-r4d9j-session-time-reconciliation`
- starting SHA: `c090f73836d31ff02677b11f06a50dc8421d34af`
- PR: Draft PR #20
- relevant prior update: `2026-09-27-beta-r4d9h-admin-timetable-access-governance-j.md`
- live environment: SQL-backed Beta, 1,937 sessions, session writes disabled

## 3. Work performed

- audited the three available source/audit files and recorded SHA-256 values;
- reconciled all 1,937 current SQL identities without fuzzy matching;
- generated an outside-Git review workbook and a 423-entry correction manifest;
- integrated corrections after original canonical `SessionId` generation;
- added deterministic reconciliation, manifest, replay, and operator tests;
- added a preview-default transactional SQL repair/rollback command;
- ran a live read-only preview after device-code authentication.

The live SQL repair was committed through the reviewed operator path. No frontend deployment, Firebase mutation, or merge was performed during the live repair itself.

## 4. Files / components changed

- `tools/azure_sql_migration/session_time_corrections.json`: reviewed corrections.
- `tools/azure_sql_migration/session_time_corrections.py`: strict loader/application.
- `tools/azure_sql_migration/session_time_reconciliation.py`: deterministic matching.
- `tools/azure_sql_migration/normalize.py`: post-identity time application.
- `tools/reconcile_session_times.py`: source/audit reconciliation generator.
- `tools/build_session_time_reconciliation_workbook.mjs`: outside-Git workbook builder.
- `tools/repair_paws_session_times.ps1`: preview/apply/rollback operator.
- Python tests, CI watch paths, design/plan, and operator documentation.

## 5. Architecture / invariants affected

Session identity is unchanged. `canonical_session_key()` is unchanged. The
correction layer may replace only normalized `start` and `end` after the
original stable SessionId is known. Ambiguous and unmatched sessions are left
unchanged. R4D-9G and all protected frontend runtime files are untouched.

## 6. Data / algorithm changes

The algorithm accepts only a unique controlled-normalization match on date,
course, type, and topic. Multiple current sessions or multiple source intervals
fail closed. No blind `+12` rule exists. Audit evidence is supplemental.

Counts: 529 deterministic source matches, 423 corrections, 106 already correct,
197 ambiguous, and 1,211 unmatched. Proposed repair changes grid-positionable
count 1,082 -> 1,344 and early-clock count 755 -> 493; reversed 65 and sentinel
35 remain for separate evidence/review.

## 7. Tests / CI evidence

- bundled Python: 59 passed, 0 failed.
- Node baseline: 356 passed, 2 known pre-existing faculty-swap failures, 29 skipped;
  the same two failures were present before this branch.
- `node tools/verify-beta-candidate.js`: 45 protected paths, zero drift.
- workbook: 1,937 rows; formula error scan 0; all three sheets rendered/reviewed.
- CI: pending on Draft PR #20.

## 8. Live operations

### Safety and rebuild gates

- operator UPDATE narrowed to `StartTime` + `EndTime` only;
- safety fix commit: `6f875be2302b75082aa51d47a87dfe19b397421c`;
- focused test follow-up: `c825f87497ab2852bf19be9d00b7046da5a7a13e`;
- manifest SHA-256 verified:
  `3802b09a9e0bc5b75a598f45390667577da90e7cb11493a399d0fee947fa17a9`;
- workload SHA-256:
  `fe3eb279b28f3c46a8bec7097e3c3ae82330a5f21d7e23629805f9f306f25214`;
- rebuild gate PASS: 4,974 raw rows, 4,970 canonical assignments before/after,
  1,937 sessions before/after, SessionId sets identical, assignment relationship
  SHA before/after
  `6e2f663e8dcc1071a2294f5bb285e197945a8f2856a38069edb6a2edc93195a7`,
  approved correction mismatches 0.

### Live apply

Final preview: 423/423 exact old intervals, 1,937 sessions, 4,970 assignments,
zero writes.

Pre/post domain counts were identical:

| Object | Before | After |
|---|---:|---:|
| Session | 1937 | 1937 |
| SessionAssignment | 4970 | 4970 |
| UserProfile | 2 | 2 |
| Faculty | 120 | 120 |
| FacultyAlias | 5 | 5 |
| FacultyProfessionalProfile | 116 | 116 |
| JointAppointment | 14 | 14 |
| Course | 43 | 43 |
| AfcRecord | 791 | 791 |
| RoleAssignment | 162 | 162 |
| DoeRuleSeed | 24 | 24 |
| RoleDefinition | 14 | 14 |
| AuditEvent | 0 | 0 |

Backup:
`C:\Users\xinyu\Desktop\PAWS-R4D9J-Live-Backup\PAWS_BETA_R4D9J_SQL_TIME_BACKUP.csv`

Backup SHA-256:
`3c47c9890e56d65e3319947da2a88e92aa0cd3ea3d2d803d8ff819ecc7817ad8`

Apply result:

- mode = repair
- applied = true
- correctionCount = 423
- rowsUpdated = 423
- rowsInserted = 0
- rowsDeleted = 0
- Session = 1937 -> 1937
- SessionAssignment = 4970 -> 4970
- SessionId set identical = true
- SessionId SHA before/after =
  `2a105c0086ac52dc574a732d7aef2b2eb9cac0cdfe9648d6ca346c4db1093224`
- transaction = COMMITTED

### Post-apply acceptance

- SQL manifest new-time match = 423/423, mismatch = 0;
- `paws.vCalendarSession` = 1,937;
- corrected view sample = 20/20;
- ACA health = 200 / `paws-beta-sql-runtime`;
- browser runtime = `azure-sql`, writes disabled, 1,937 sessions;
- corrected API sample = 20/20;
- Fall W1 = 52 grid + 25 check = 77, unique 77;
- Fall W5 = 60 grid + 9 check = 69, unique 69;
- Fall W6 = 60 grid + 19 check = 79, unique 79;
- Spring W4 = 10 grid + 7 check = 17, unique 17;
- Fall W5 before/after = 37 grid / 32 check -> 60 grid / 9 check,
  total population 69 both sides;
- remaining mutually exclusive Check-needed classification = 493 early-clock,
  65 reversed, 35 `00:00` sentinel, 0 other; total 593;
- rollback preview PASS: `applied=false`, `writesPerformed=false`,
  423 restore candidates, 1,937 sessions, 4,970 assignments.

The 423 manifest contains no Spring-period corrections; Spring W4 therefore
validates partition/exhaustiveness and unresolved-sentinel visibility rather
than a corrected Spring SessionId.

## 9. Current state after live acceptance

- branch: `feature/beta-r4d9j-session-time-reconciliation`
- PR: #20
- live SQL repair: COMPLETE
- API acceptance: PASS
- Calendar acceptance: PASS
- rollback preview: PASS
- frontend deployment: NOT REQUIRED / NOT PERFORMED
- protected frontend runtime changes: 0
- Firestore timetable fallback: none
- merge state: pending final continuity commit CI and normal merge commit.

## 10. Blockers / unresolved questions

No R4D-9J live-repair blocker remains. The remaining 593 Check-needed sessions
are intentionally unresolved data and must not be inferred or auto-corrected.

## 11. Exact current breakpoint

Commit these continuity updates to PR #20, mark the PR ready for review, wait
for all CI to pass, then merge with a normal merge commit. Do not deploy SWA.

## 12. Next safe action

Finalize and merge PR #20 after green CI. No Azure Beta Deploy is required.

## 13. DO NOT REDO

- do not regenerate corrections with fuzzy matching;
- do not change `timetable.js` or R4D-9G;
- do not reset/reimport SQL;
- do not deploy the frontend;
- do not run live `-Apply` before the rebuild gate.
