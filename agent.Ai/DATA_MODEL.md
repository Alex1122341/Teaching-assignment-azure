# PAWS Beta Data Model — current 2026-10-15

**Source:** Beta main 0d4b4d9, migrations in database/azure-sql/001–037 and reviewed API/repositories. This is a conceptual inventory of SQL definitions and live domain provenance, **not** a fresh live SQL INFORMATION_SCHEMA audit. Historical early table counts and Firestore inventories are retained in dated updates / Git history and must not be assumed current.

## 1. SQL location / domains

- **Actual Beta database server:** ITAPPVETOPSDB01; database: VetMed-Ops (university SQL Server).
- **paws schema:** canonical business entities, versioned workflow data, historical/audit records, protected SQL views.
- **paws_api schema:** explicit SQL commands/permission and scope functions/procedures; prefer narrow EXECUTE grants to broad DML.
- **staging schema:** original workbook/source and migration evidence. Never treat a staging row or unmatched name as a canonical production entity.
- **Firebase Auth:** account identities and ID tokens, NOT SQL role authority. **Legacy Firestore:** limited user/group UI helpers; no SQL-domain fallback.
- **No direct browser SQL:** Node University API mediates all SQL operations.

## 2. Canonical people and course/schedule facts

| SQL object | Purpose / ownership |
| --- | --- |
| paws.UserProfile | FirebaseUid-to-SQL profile; BaseRole, Active, MustChangePassword, server-defined FacultyId. Authoritative SQL API roles |
| paws.Faculty | Canonical Faculty identity, official/preferred names and profile fields |
| paws.FacultyAlias / paws.FacultyProfessionalProfile / paws.JointAppointment | Exact aliases, professional metadata, appointments |
| paws.Course | Canonical course mapping, academic schedule/DOE context |
| paws.Subject | Distinct from Session Topic; scoped HICC/VISC mapping |
| paws.Session | Working teaching activity: date, time, type, course and topic |
| paws.SessionAssignment | Canonical Faculty assignment to Session, teaching role and DOE source |
| paws.vCalendarSession | Sanitized calendar read projection |
| paws.RoleDefinition / paws.RoleAssignment | Stable role vocabulary and assigned Faculty role-source facts |
| paws.RoleAppointmentSchedule | Accepted per-role as-of periods (up to 12), rowversion/audit; date is not DOE proration |

A Session may have multiple SessionAssignment rows. Final Faculty assignment authority stays in SessionAssignment, not a parallel FinalAssignment.

## 3. Teaching Responsibility / Group / Publish

Objects introduced in the current SQL migration line:
- paws.TeachingResponsibility, paws.TeachingResponsibilityScope, paws.TeachingResponsibilityAssignee.
- paws.TeachingAssignmentGroup, paws.TeachingAssignmentGroupHicc, paws.TeachingAssignmentPackage, paws.TeachingSessionOwnership.
- paws.TeachingAssignmentRevision, TeachingAssignmentRevisionSession, TeachingAssignmentRevisionInstructor.
- paws.TeachingAssignmentContribution, TeachingAssignmentReview.
- paws.TeachingAssignmentFinalization, TeachingAssignmentCurrentFinalization, TeachingAssignmentFinalizationLine.
- paws.TeachingAssignmentPublicationRelease, TeachingAssignmentPublicationState, TeachingAssignmentPublishedSession, TeachingAssignmentPublishedInstructor.

Invariant: stable responsibility + temporal assignee + exact Course/Subject/Group scope determines access. ADC/LAB/HICC suggestions are not final allocations. ADFAD finalizes assignments; Publish produces immutable release snapshots and a controlled academic-year active pointer. Historic Firestore faculty_groups is **not** TeachingAssignmentGroup.

## 4. AFC and SWAP

| Objects | Purpose |
| --- | --- |
| paws.AfcRecord / paws.AfcManualRecord | Imported and administrator-created absence records, unified by paws.vAfcRecordUnified |
| paws.AfcRequest / paws.AfcApproval | Faculty request, routing and approval decision |
| paws.AfcArtifact | Source-bound approved binary/signed record and integrity metadata |
| paws.SwapCandidate / paws.SwapRequest / paws.SwapRevision / paws.SwapDecision / paws.SwapNotification | Explicit Session SWAP workflow, source version, candidate, approvals and notifications |

October 14's SQL036 + SQL037 corrections added active cancellation and canonical hexadecimal rowversion tokens. Admin Delete is soft cancellation, preserving record/audit; never infer that this is authorization for PR #98's separate, proposed destructive source migration.

## 5. DOE model (separate policy, targets, facts, recorded sources)

| Objects / family | Authority and contract |
| --- | --- |
| paws.DoePolicyVersion | One annual policy version, status Active/Draft/Archived and revision |
| paws.DoePolicyRule / DoeRuleSelector / DoeRuleParameter / DoeRuleTier / DoeRuleInput | Match conditions, precedence and controlled calculation expressions |
| paws.DoeReferenceSource / DoeCourseMapping / DoeSubjectMapping / DoePolicyException | Guidelines/Master provenance, exact mappings, approved source-specific exceptions |
| paws.DoeCalculationRecord / DoeAssignmentFact / DoeAssignmentFactInput | Versioned calculation evidence and source fact snapshots |
| paws.DoeFacultyTarget / paws.DoeFacultyAllocation | Approved contractual target, explicit override and recorded faculty/year allocation |
| paws.DoeImpactRun / DoeImpactRunRow / DoePolicyPublication / DoeAuditEvent | Full-source impact fingerprint, validated preview, controlled publication and immutable audit |
| paws.ManualDoeAssignment | Signed negotiated manual DOE (including approved negative reduction with Notes) |
| paws.DoeRuleSeed | Legacy/source guideline reference metadata, not the sole Active SQL policy |

See server/src/data/sql-doe-* repositories and server/src/doe/* services for exact joins and source-line authority. A 2026-27 candidate Draft of 58 rules / 56 course mappings / 25 subject groups / 25 scoped allocations was recorded; do not promote it to Active or recalculate implicitly. Missing target/supervision input is not zero.

## 6. Support, audits and operational controls

- paws.SupportContext, paws.SupportOperation, paws.SupportChange, paws.SupportTable record 30-minute, real-developer-authorized delegation, row captures and recoverable operations; server-side support context changes effective SQL identity with real actor retained.
- General AuditEvent, DOE audit, AFC records/audits and source receipts are historical evidence; **history is not the only current domain state**.
- Business state writes flow through authenticated API, atomic SQL transactions, concurrency/rowversion rules, exact stored procedures, least-privilege grants and independent write gates.

## 7. Important non-equivalences and safety

- Firebase UID != FacultyId != UCID. Never display other Faculty UCID or confidential source fields in ordinary Faculty scope; do not use fuzzy matching.
- Course != Subject != Session Topic. Role label != durable responsibility. Group membership != actual historical assignee.
- Working Session != Published teaching-assignment release. TA finalization != publication; SWAP request/approval != a HICC/VISC package review.
- Recorded DOE != calculated candidate preview. Draft version != Active policy. Target DOE != actual assigned DOE.
- AFC binary availability != AFC reason. Soft cancellation != hard database deletion. LAB metadata != student roster; unknown group/rotation remains absent.
- 2026-10-15 Draft PR #98 adds proposed Calendar working activities with staging and exact AFC source counterpart migration; **not yet part of main or applied to the live SQL database**.

## 8. Source migration trail

- 001–004 foundational schema, calendar and original narrow SQL roles.
- 005–006 stable responsibilities, scopes, groups, temporal assignees.
- 007–011 AFC manual/request/review/artifact foundation.
- 012–019 session writes, early DOE target/allocation and role permissions.
- 020–025 SQL Teaching Assignment work queue, revision/finalization/publish and Faculty/admin scope.
- 026–029 annual DOE engine, supervision input, signed manual DOE.
- 030–034 Session SWAP, HR names, Developer Support capture.
- 035 RoleAppointmentSchedule effective periods.
- 036–037 AFC cancellation, token/version encoding correction.

Always inspect the actual migration source and **live applied inventory** before extending a table: existence in source is not proof that all migrations were applied everywhere. No initial SQL reset/import rerun.
