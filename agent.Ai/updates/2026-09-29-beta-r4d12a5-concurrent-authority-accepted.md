# BETA-R4D-12A5G — Concurrent Authority Acceptance

**Date:** 2026-09-29  
**Repository:** `Alex1122341/Teaching-assignment-azure`  
**Branch:** `feature/beta-r4d12a5-concurrent-responsibility-assignees`  
**Accepted implementation HEAD before continuity commit:** `e9a415247c80ade128210384a87992257b4c4959`  
**Expected `origin/main`:** `342b45ab7433997ed2961dc13a68a2978fa989a5`

## Status

R4D-12A5/A5R is **FOUNDATION ACCEPTED / NOT LIVE / NOT SEEDED** and is
ready for the integration PR gate. The accepted foundation supports multiple
temporal assignees for one stable responsibility without duplicating packages
or groups.

Migration 005 is **MERGED / NOT APPLIED**. Migration 006 is **MERGED AFTER
A5G / NOT APPLIED**. If assignee rows already exist when `AssignmentMode` is
introduced, migration 006 throws rather than silently classifying them as
`exclusive`; the default with `WITH VALUES` is reachable only for a zero-row
assignee table.

## Accepted architecture

- `AssignmentMode` is exactly `exclusive` or `concurrent`.
- Different Faculty rows may overlap only when both are `concurrent`.
- Same-Faculty overlap is invalid, including two concurrent rows.
- Any overlap involving `exclusive` is invalid.
- Touching boundaries and deliberate unassigned gaps are valid.
- Co-HICC assignees share one stable HICC responsibility and one Teaching
  Assignment Package.
- Co-VISC assignees share one stable VISC leader responsibility and do not
  automatically create another group.
- Package identity is independent of the assignee set.
- DOE cardinality and calculations remain independent and unchanged.

## Evidence carried forward

- R1/R2/R3/R4/R5 = `9 / 9 / 0 / 0 / 0`.
- Exact Faculty results: Xu Niu, Dongyan; Whiteside, Douglas; Hecker,
  Kenton; and Ceballos Betancourt, Maria Camila are all `NO_MATCH`.
  No identity was guessed; OD-06 remains.
- The 18 exact legacy-only HICC courses remain
  `HISTORICAL / NOT CURRENT CANDIDATE`; none was reactivated.
- Direct read-only SQL evidence: 539 current Session rows, 24 exact legacy
  ambiguous HICC RoleAssignment rows, and all 18 `paws.Course` rows exist.
- Private Owner Review V2.1 artifacts remain outside Git and must not be
  committed.

## Future product queue — recorded, not implemented here

1. **B0 — Beta Approval Queue real-data cleanup.** Trace every visible ADFA,
   AFC, and Timetable request to its actual source. Classify REAL, TEST,
   SYNTHETIC, HARDCODED, or DEMO/FALLBACK. Preserve real business data and
   remove/disable only confirmed non-real records after downstream/audit
   review. An empty queue is correct if no real requests are pending. Prove
   no test/demo/hardcoded/Firestore fallback remains while real SQL/API data
   remains untouched.
2. **B1 — AFC line-by-line + controlled create.** Use canonical Faculty,
   Start Date, End Date, Reason, and optional Notes. Enforce
   `EndDate >= StartDate`, including same-day AFC. Reasons: University
   Travel, Vacation, RSL, Medical, MAT, Special, Other; Special/Other
   require explanatory Notes. AFC must not automatically change HICC, VISC,
   SessionAssignment, DOE, or packages.
3. **B2 — Login UX + measured performance diagnostics.** Add immediate
   Signing in/loading/status feedback, duplicate-submit prevention,
   understandable failure and retry, then measure T0 Login click, T1 Firebase
   request start, T2 auth success, T3 `/api/v1/me` start, T4 completion, T5
   profile/role resolution, T6 required Dashboard/bootstrap completion, and
   T7 first usable page. Report T0-T2, T2-T4, T4-T5, T5-T7, and T0-T7. Do
   not replace Firebase or assume cold start without measurement.
4. **B3 — Additional Dashboard/UI cleanup** after B0/B1/B2.
5. **DOE semantic/source repair** after Dashboard/UI work. Do not present the
   sum of personal Faculty DOE percentages as one institutional DOE value.

The owner-dependent path remains Owner review -> A2B -> SQL-backed Teaching
Assignment Work Queue. A2B remains blocked and must not block independent
B-series cleanup.

## Integration gate

This continuity unit changes documentation only. It must be the single
documentation commit on the A5 feature branch. Verify `git diff --check`,
`node tools/beta-freeze.js`, `node tools/beta-api-freeze.js`, and the normal
Beta suite. Push the branch and open one PR to `main` titled:

`BETA-R4D-12A5: support concurrent responsibility assignees`

The PR scope must remain migration 006, dormant authority logic, dormant SQL
repository DTO change, tests, and continuity docs. No live migration, seed,
SQL write, API/UI route, Work Queue, AFC, DOE, Firebase/Firestore/Azure
mutation, or deployment is allowed. Merge only after the required CI checks
are green, using a merge commit only; observe the post-merge `main` Build.

