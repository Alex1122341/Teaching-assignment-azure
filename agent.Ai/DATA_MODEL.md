# PAWS Data Model Map

## 1. Azure SQL schemas

### `staging`

Purpose:

- import provenance;
- raw/typed source evidence;
- rejected/unresolved rows;
- reproducible migration support.

Important tables from foundation:

- `ImportBatch`
- `ImportWorkbook`
- `ImportSheet`
- `ImportRow`
- `PackageEntity`
- `FacultyRaw`
- `FacultyProfessionalRaw`
- `JointAppointmentRaw`
- `FacultyOverviewRaw`
- `TeachingAssignmentRaw`
- `RoleAssignmentRaw`
- `CourseRaw`
- `DoeRuleRaw`
- `AccountRoleRaw`
- `AfcRecordRaw`

Normal application runtime should not read/write staging.

### `paws`

Canonical/runtime domain schema.

## 2. Canonical SQL tables

### `paws.Faculty`

Key:

- `FacultyId` UUID

Identity/evidence:

- preferred names/display name
- UCID
- email
- Stream/Rank/FTE
- ReportsTo
- active
- source import batch/row

Constraints:

- unique non-null UCID
- unique non-null email
- ReportsTo self-FK
- ImportBatch FK

Last accepted count: **120**

### `paws.FacultyAlias`

Name alias relation.

Do not use as a generic UCID crosswalk.

Last accepted count: **5**

### `paws.FacultyProfessionalProfile`

One-to-one professional/profile attributes keyed by FacultyId.

Last accepted count: **116**

### `paws.JointAppointment`

Effective appointment evidence linked to Faculty.

Last accepted count: **14**

### `paws.Course`

Canonical Course.

Key:

- `CourseId`

Natural uniqueness:

- `CourseCode`

Last accepted count: **43**

### `paws.Session`

Canonical Working scheduling skeleton.

Key fields:

- SessionId
- AcademicYear
- CurriculumYear
- Course
- Topic
- SessionType
- SessionDate
- StartTime/EndTime
- Room
- source provenance

Last accepted count: **1,937**

Current foundation does not yet include all future P3.1 ownership metadata.

### `paws.SessionAssignment`

Canonical Faculty allocation rows.

Fields include:

- SessionAssignmentId
- SessionId
- FacultyId nullable
- source Faculty name
- resolution status
- TeachingRole
- LabLead
- credited hours
- imported DOE-related evidence columns
- source provenance

Last accepted count: **4,970**

This is the final assignment result store; do not duplicate it in another authoritative table.

### `paws.AfcRecord`

Historical imported AFC evidence.

Fields:

- Faculty
- StartDate/EndDate
- Purpose
- Active
- source provenance

Constraint:

`EndDate >= StartDate`

Last accepted count: **791**

Historical AFC is not the same as the live AFC request workflow.

### `paws.RoleAssignment`

Imported role/appointment/workload evidence.

Includes:

- Faculty
- AcademicYear
- RoleCategory/RoleType
- Course/scope text
- effective/expiration dates
- mapped DOE
- signed/zero/negative-capable override field
- reason/notes
- source provenance

Last accepted count: **162**

RoleAssignment is not the same as TeachingResponsibility authority.

### `paws.DoeRuleSeed`

24-row source seed/evidence from workbook.

Not a live replacement DOE engine.

Current owner instruction: do not work on DOE for the Beta connection task.

### `paws.RoleDefinition`

Imported account/role-definition evidence.

Do not conflate access-role definitions with academic responsibility/appointment authority.

Last accepted count: **14**

### `paws.UserProfile`

Primary key:

- `FirebaseUid`

Fields:

- Email
- DisplayName
- BaseRole
- FacultyId nullable
- Active
- MustChangePassword
- OfficeName
- timestamps

Last accepted live count: **0**

BETA-R1 requires exact profile rows before real browser access succeeds.

### `paws.AuditEvent`

Generic append-only audit structure:

- event/entity IDs/types
- actor UID/name
- timestamps
- bounded before/after/metadata JSON
- request/import linkage

Last accepted live count: **0**

Future authoritative current state must remain in typed domain tables; AuditEvent is history, not the only copy.

## 3. SQL view

### `paws.vCalendarSession`

Derived from:

`Session` + `SessionAssignment` + `Faculty`

Exposes:

- session scheduling fields
- aggregated instructor display names

Last accepted row count: **1,937**

BETA-R1 timetable read source.

Not writable.

Not a Published Timetable release.

## 4. PR #5 draft table

### `paws.FacultyDirectoryProfile`

Draft/not live at last accepted checkpoint.

Approved narrow columns:

- FacultyId
- Campus
- OfficeLocation
- LabLocation
- SourceImportBatchId
- timestamps

Do not assume live existence until verified.

## 5. Current Firestore Beta collections from saved live snapshot

Present at the 2026-09-25 read-only inventory:

- `users` — 7
- `faculty` — 117
- `sessions` — 1,861
- `faculty_groups` — 1
- `change_requests` — 3
- `afc_requests` — 2
- `afc_audit` — 3
- `session_change_log` — 8
- `faculty_change_log` — 17
- `account_audit` — 10
- `public_schedule` — 1
- `settings` — 5 derived docs

One approved AFC request had four PDF chunks in that snapshot.

These counts are dated evidence, not continuous monitoring.

## 6. Experimental/P3.1 collections

At the saved Beta inventory, these future-target collections had no Beta rows:

- `teaching_subjects`
- `teaching_responsibilities`
- `teaching_assignment_groups`
- `teaching_assignment_submissions`
- `session_assignment_contributions`
- LAB collections

This means future schema may be required when features are ported, but no Beta-row migration existed at that checkpoint.

## 7. Critical non-equivalences

Never map these as synonyms:

- Firestore `faculty_groups` != TeachingAssignmentGroup
- RoleAssignment != TeachingResponsibility
- UserProfile/BaseRole != current HICC/VISC authority
- `vCalendarSession` != Published Timetable
- historical `AfcRecord` != live AFC workflow
- SessionAssignment != contribution suggestion
- AuditEvent != current domain state
