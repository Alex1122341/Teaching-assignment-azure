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

## Superseded assumptions

Do not reuse these without re-verification:

- “Azure-hosted means Azure SQL-backed” — false.
- “PR #3 database is still empty” — historical prose, false for current loaded checkpoint.
- “faculty_groups is TeachingAssignmentGroup” — false.
- “DOE short repository keys prove a second short-name physical collection generation” — false; repository aliases must be inspected.
- “all future P3.1/DOE domains must be completed before first SQL-backed Beta read” — superseded by current owner priority.
