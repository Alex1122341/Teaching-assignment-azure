# PAWS Locked Decisions

## Owner-approved AFC cancellation and LAB layout — 2026-10-13

Within controlled Beta, administrator AFC Delete cancels active availability while retaining records and audit snapshots. It requires a separate default-off server gate, exact manual/import key, SQL administrator authorization and optimistic rowversion. No hard deletion or faculty reason disclosure. Owner approved grouped same-course/date/year LAB tables with true source intervals, explicit missing rotation groups, and original per-row Edit/Manage Instructors/SWAP flows. User explicitly selected Teaching-assignment-azure over the Experimental repository. Candidate PR and directed release acceptance remain required.

## Owner-authorized Developer support — 2026-10-09

Real active SQL Developer accounts may delegate into existing active accounts for 30-minute testing/support contexts. Real Firebase identity is always verified; SQL target role/scope remains authoritative. Captured business writes are atomic and audited with real actor and effective account. Undo restores only unchanged afterimages, refuses conflicts atomically, and retains original audit history. Credential/account operations and unsupported artifact writes are excluded. No manufactured accounts or privilege promotion. User authorized publication and delegated later implementation decisions. Released7256220; see developer-support release update for exact evidence and live acceptance limits.


## P1 controlled Beta writes — 2026-10-06

**LOCKED FOR THIS BETA MILESTONE BY ARCHITECT #6:** P0's authenticated read-only platform remains accepted, but P1 is authorized to enable individually gated, audited Beta writes for existing-session scalar edits, session create/batch, safe canonical Faculty assignment replacement, AFC administrator single/batch entry, and Faculty/HICC/VISC self-service AFC submit/withdraw after each domain passes acceptance. This is a temporary Beta testing exception, not production authorization.

- Keep DOE/target/override/rule editing, Faculty master changes, RoleAssignment changes, destructive session deletion, AFC decision writes, AFC approved-artifact creation, generic SQL, and browser Firestore timetable writes disabled.
- Each business write must use server Firebase authentication + SQL `UserProfile` authorization, validation, a narrow reviewed stored procedure, a transaction, durable audit, and a deterministic response.
- `UC\sa-xinyu.zhu1` is accepted only as `TEMPORARY_BETA_OVERPRIVILEGED_RUNTIME` for this Beta task. Dedicated least-privilege identity remains mandatory before production, wider audience, broad write expansion, or removal of the Beta designation.
- Exact final gate states are recorded with the P1 acceptance report and runtime attestation; gates default to false and remain independent.

## P0 W1E identity authority — 2026-10-05

**LOCKED for the University SQL API:** Firebase Authentication is authoritative for sign-in identity, verified Firebase UID, and token validity/revocation. SQL `paws.UserProfile` is authoritative for API `BaseRole`, active/password-change state, faculty scope, and SQL business authorization. Firestore `users.role` / `facultyRoles` may govern separate Firestore-backed UI/account features only; they cannot grant or reduce University SQL API authority. Do not add browser-side synchronization between Firestore roles and SQL `BaseRole`; a future role-management API must be a trusted server-side task.

**Runtime least privilege:** the University API must use a dedicated nonpersonal identity with only its separately reviewed read permission set and any explicitly activated domain stored-procedure roles. `db_owner`, `CONTROL DATABASE`, `sysadmin`, broad DML/DDL, and schema-wide EXECUTE are not runtime requirements. W1E's SQL role artifact is local-only and unexecuted; no identity binding or write activation is approved here.

## Owner-approved post-P3 Beta stabilization scope — 2026-10-04

**LOCKED FOR THIS MILESTONE**

- Keep Firebase Authentication as identity only; `VetMed-Ops` is the business-data authority through the University API.
- Use only deterministic, source-backed normalization. Unknown identity, FTE, rank, stream, contract DOE, role DOE, date, and time remain unset and reported for review.
- Do not import the provided DOE workbook while its conflict gate reports mismatches or no-match rows.
- Permit only authenticated, server-authorized scalar updates to existing SQL sessions. Faculty assignments and their DOE fields remain unchanged until a separate SQL write path exists.
- Preserve the one-hour timeout and do not restore Firestore timetable writes.

---

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

## Frozen Beta runtime baseline (BETA-R4D-9E/F Governance Commit F)

**LOCKED**

- the frozen runtime trust anchor is Runtime Commit I `2b10aca5b9ab26ffecdffb685bddd33ae4de70f5`.
- previous baseline `6eeb1a4ac8c9565a4afbf479277a7e2f543f9e26` is historical evidence only.
- the protected path set remains monotonic at 45 paths; Runtime Commit I preserves the complete prior set and adds only the approved admin timetable access behavior.
- Git commit objects remain the immutable trust anchor; `tools/beta-baseline.json` stays non-authoritative.
- zero protected runtime drift is allowed on BOTH `pull_request` and `push` to `main`.
- the candidate drift whitelist is removed: no special-case exception exists.
- promotion is governance-only; it does not deploy. The promoted baseline is NOT YET DEPLOYED.
- Governance Commit D does not authorize a PR #16 merge; merge remains a separate architect/owner decision after CI review.

## Superseded assumptions

Do not reuse these without re-verification:

- “Azure-hosted means Azure SQL-backed” — false.
- “PR #3 database is still empty” — historical prose, false for current loaded checkpoint.
- “faculty_groups is TeachingAssignmentGroup” — false.
- “DOE short repository keys prove a second short-name physical collection generation” — false; repository aliases must be inspected.
- “all future P3.1/DOE domains must be completed before first SQL-backed Beta read” — superseded by current owner priority.
- “the Beta-R1 candidate may report intentional protected runtime drift for `index.html` / `paws-data-client.js` / `timetable.js`” — superseded by the BETA-R3A-3 baseline promotion; zero drift is now required on every event.
- “strict frozen-main freeze runs on the PR candidate” — false; that step is push-only and is SKIPPED on `pull_request`.


## 2026-10-08 — Manual DOE release complete
- Owner-confirmed signed additive DOE and editable Course / Subject / Scope published via PR76. Live source e1005a909eca0c18df19f3a8f23b722d01084896; runtime anchor33f1742a938702643cdec946352db05875641929.
- Exact-main build37874892141 and migration37874892158 SUCCESS; existing emulator799/799 and governance53/53. No new tests or local test execution.
- Migration029 applied; scoped procedure EXECUTE membership and CourseCode/CourseName reads. Pre-existing db_owner unchanged; broad DOE roles empty. Runtime60-file attestation and API/SQL health passed; existing gates unchanged, manual gate enabled.
- Hosting60 assets released, version c81a9c4ffcc263d5, release1791513302939000. CLI release succeeded before debug-log cleanup EBUSY/exit1; no repeated release. Public manual script equals source SHA256992ff87c3a9e13c455d0e2a2cd8a9e43dd4256de610f38d6cb8cee9cb9f992de.
- Live editor verified editable scope/174 suggestions, enabled Save assignment, signed DOE input without min/step any, existing source DOE visible. Read-only acceptance; no invented negotiated entries.
- Postflight manual records0, role records196, supervision snapshots116. Prior111 formal targets and five deferred targets preserved. Do not rerun imports.
- Screenshot: C:/Users/xinyu/Documents/Codex/2026-08-31/outputs/manual-doe-20261008/manual-doe-editor.png.
- Rollback: C:/PAWS/Runtime/Acceptance/WorksheetDOE-20261008/Start-WorksheetDOE-Live.ps1. New launcher: C:/PAWS/Runtime/Acceptance/ManualDOE-20261008/Start-ManualDOE-Live.ps1.
- Breakpoint: published. Administrators enter actual negotiated values case by case; helper positive credit remains separate; negative adjustment requires Notes. No automatic paired allocations.

## 2026-10-09 — owner-directed Faculty / annual DOE administration
Owner approved reference Faculty Lookup/Edit and full annual Rule Book lifecycle, retaining negotiated signed manual DOE separately, and instructed publication. This supersedes earlier P1 exclusions for the specifically accepted Faculty/DOE admin, policy publication and recalculation operations. Existing API role checks, audit, draft validation/impact revisions and explicit action confirmations remain. Deployment itself does not activate annual policies or recalculate allocations. Deferred Master targets remain blank. SQL writes use valid nvarchar(max); clone version+contents+audits are atomic. Immutable freeze promotion902a6cc is separately reviewed.
