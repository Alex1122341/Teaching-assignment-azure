# PAWS Locked Decisions

Only change this file when the owner/architect explicitly changes a decision.

## Repository roles

**LOCKED**

- `Teaching-assignment` = Experimental / feature-forward / Firebase demo track.
- `Teaching-assignment-azure` = controlled/stability-sensitive Azure Beta track.
- no automatic repository synchronization.
- mature behavior is deliberately ported.

## Immediate Azure priority

**LOCKED 2026-09-26**

First priority is to connect the Azure Beta frontend to the existing Azure SQL database and make that Beta path run.

Do not block this with future DOE/P3.1 work.

## DOE

**LOCKED 2026-09-26**

- DOE algorithm and engine remain in Experimental/Demo for now.
- do not migrate DOE to Azure now.
- do not redesign DOE now.
- do not create a new DOE engine.
- DOE is out of scope for BETA-R1/R2/R3 unless owner explicitly reopens it.

This supersedes earlier plans that placed DOE SQL work on the immediate Azure migration path.

## Authentication

Current Beta direction:

- Firebase Authentication may remain for login.
- Firestore business persistence and Firebase Authentication are separate decisions.
- do not remove Firebase Auth merely because the Beta starts reading Azure SQL.

## Azure SQL baseline

**LOCKED**

- preserve the accepted loaded SQL baseline.
- reset/load already completed.
- do not rerun the reset.
- do not rerun the empty-database initial loader.
- SQL baseline is not overwritten from Firestore merely because counts differ.

## Session count mismatch

**LOCKED INTERPRETATION**

Firestore 1,861 vs SQL 1,937 is a net count difference.

Do not call it “76 missing Firestore sessions” without reconciliation.

## Identity

**LOCKED**

- no fuzzy identity matching.
- exact deterministic crosswalks only.
- HICC-2 excluded from SQL UserProfile under `HUMAN_CONFIRMED_DELETE_ACCOUNT`.
- HICC-1 uses exact reviewed Faculty mapping.
- DVM/LAB Beta viewer accounts remain non-Faculty.
- admin/global Beta accounts do not require FacultyId.

## BETA-R1 runtime behavior

**LOCKED FOR CURRENT CANDIDATE**

- session reads use Azure SQL through backend API.
- no direct browser SQL.
- no Firestore fallback for Azure session reads.
- session writes are disabled/fail-closed.
- timetable UI is not being redesigned.
- this is data-source substitution.

## PR #4

**LOCKED**

HOLD / do not merge as-is.

May be mined for implementation ideas only.

## ADFAD / assignment truth

**LOCKED ARCHITECTURE**

`SessionAssignment` is the authoritative final assignment result.

Do not create a rival authoritative FinalAssignment table.

## Responsibility architecture

**LOCKED FOR P3.1/FUTURE PORT**

- Person != Responsibility.
- responsibility != role label.
- stable responsibility + temporal assignee.
- HICC exact Course/Subject scope.
- VISC authority from Teaching Assignment Group leadership.
- TeachingAssignmentGroup != `faculty_groups`.
- package identity uses AcademicYear + Group + stable HICC responsibility.

## Workflow boundaries

**LOCKED**

- Working != Published.
- Contribution != final assignment.
- HICC/VISC review != Change Request/SWAP.
- Topic != Subject.
- ADFAD finalization != Publish.
- LAB roster completion does not block HICC/VISC/ADFAD readiness.
- missing referenced LAB group fails closed.

## Published timetable

Future architecture retained:

- versioned sealed release;
- active pointer;
- no Working fallback for Faculty;
- Publish does not mutate assignments and does not itself trigger DOE.

Not part of immediate Beta connection work.

## AFC

Retain historical imported AFC separate from live AFC workflow.

Future approved document should be immutable; SQL binary storage is preferred at the observed artifact size unless later evidence requires another mechanism.

Not part of BETA-R1.

## Beta deployment

- CI success != deployment.
- no merge/deploy/live mutation without explicit owner authorization.
- exact-SHA evidence required.
- update continuity memory after a live activation.

## Frozen Beta runtime baseline (BETA-R3A-3 Commit B)

**LOCKED**

- the frozen runtime trust anchor is Runtime Commit A `6eeb1a4ac8c9565a4afbf479277a7e2f543f9e26`.
- previous baseline `86bd5aa2c8a25259f3f708e49b322220ff43a147` is historical evidence only.
- the protected path set is monotonic: the 45-path Commit A manifest contains all 44 previous protected paths plus `paws-data-client.js`.
- Git commit objects remain the immutable trust anchor; `tools/beta-baseline.json` stays non-authoritative.
- zero protected runtime drift is allowed on BOTH `pull_request` and `push` to `main`.
- the candidate drift whitelist is removed: no Beta-R1 special-case exception exists.
- promotion is governance-only; it does not deploy. The promoted baseline is NOT YET DEPLOYED.
- Commit B does not authorize a PR #6 merge; merge remains a separate architect/owner decision.

## Superseded assumptions

Do not reuse these without re-verification:

- “Azure-hosted means Azure SQL-backed” — false.
- “PR #3 database is still empty” — historical prose, false for current loaded checkpoint.
- “faculty_groups is TeachingAssignmentGroup” — false.
- “DOE short repository keys prove a second short-name physical collection generation” — false; repository aliases must be inspected.
- “all future P3.1/DOE domains must be completed before first SQL-backed Beta read” — superseded by current owner priority.
- “the Beta-R1 candidate may report intentional protected runtime drift for `index.html` / `paws-data-client.js` / `timetable.js`” — superseded by the BETA-R3A-3 baseline promotion; zero drift is now required on every event.
- “strict frozen-main freeze runs on the PR candidate” — false; that step is push-only and is SKIPPED on `pull_request`.
