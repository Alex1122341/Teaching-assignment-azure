# Future Faculty activation and Add New Faculty — Beta PR #155

## Verified existing-code gaps
The current Faculty Lookup has edit, deactivate and restore, but not create. The Dashboard API accepts PATCH on an existing faculty ID and status actions; it does not accept POST on the Faculty collection. SQL023/024 has UpdateFaculty, DeactivateFaculty and RestoreFaculty only. The current course assignment SQL checks the administrative Active bit, not a start date.

## Business contract
Administrators can record a future hire immediately, including UCID/email, appointment/profile information, and official date-only ActivationDate. If the start is June 1, 2027, the Faculty is Pending Start until that date, then becomes Active automatically when read; there is no cron task.

The Faculty.Active bit retains its original meaning: the administrator has enabled the record. Effective status = admin enabled AND (no scheduled date OR Alberta local date on/after scheduled date). Manual deactivate overrides the schedule, even after the start. Restore returns to Pending Start if the scheduled date is in the future. Inactive records and historical teaching, role, DOE and AFC rows are never hard-deleted. Existing Service Date is professional experience metadata and must not be conflated with ActivationDate.

Administrators can plan future teaching in advance: a Faculty member with a June 1 start may be assigned to June 1 and later sessions while still Pending Start today; any assignment with a session date before June 1 must be rejected. Re-dating an existing course session before the start must fail. Moving a Faculty start date after their existing assignments must fail until the assignments have been resolved. Manually deactivated Faculty cannot receive new teaching assignments.

## Security and data contract
Create uses the existing Faculty Admin write gate and requires authenticated administrative authority. It saves the canonical Faculty and FacultyProfessionalProfile together, with a valid staging.ImportBatch provenance FK and a FacultyCreated audit event. UCID/email uniqueness is checked against every Faculty record, even inactive ones; restore must be used rather than creating duplicate identities. Creation does not automatically create a Firebase login. Faculty/HICC/VISC self-service login respects effective activation, including linked existing accounts.

The database-side guards cover: SessionAssignment, Session date edits, TeachingAssignmentRevisionInstructor, TeachingAssignmentFinalizationLine and TeachingAssignmentPublishedInstructor. All course-write entry points use these canonical tables. UI filters are not the security boundary.

## Implementation and migration
Migration: database/azure-sql/065_faculty_future_activation.sql. Companion files: rollback_065_faculty_future_activation.sql, and 065_faculty_future_activation_acceptance.sql (rollback-only acceptance). Dashboard, SQL repository, authenticated routing and the Lookup editor/client are implemented in the same PR.

The migration does not modify DOE rules, current source data, user account permissions or other years.

## Acceptance and non-deployment boundary
Before merge/deploy: pass admin authorization and disabled-gate tests, strict date/duplicate checks, effective status, all course assignment guards, transactional create/update, and full Beta CI. Validate migration and rollback-only SQL acceptance against a representative non-production SQL database. Preserve the repository's frozen static/API governance with an independently reviewed product commit and promotion. Do not enable runtime gates, execute SQL on the linked database, or deploy from this PR without migration acceptance.

All changes were authored via GitHub without Remote Desktop Commander.
