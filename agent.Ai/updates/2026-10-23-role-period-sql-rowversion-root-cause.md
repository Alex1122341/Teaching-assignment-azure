# Agent Update — Role Appointment SQL rowversion source fix

**Date:** 2026-10-23
**Repository:** Alex1122341/Teaching-assignment-azure
**Baseline:** merged main 49f34d0a3bdc1412439d05f2cf5476634f8d1cc8
**Product commit:** 58daab3a2401af69c2298cc1f078d78aad069ea9
**Branch:** fix/role-appointment-hex-rowversion-20261023
**Status:** Product change committed; separate immutable freeze governance / PR CI required; NOT merged or deployed.

## User-reported regression

On the live Production UI after PR137 the editor displayed "Appointment version is unavailable. Close and reload this appointment before editing." The user did not cause it. This is the PR137 frontend guard, which correctly rejects malformed non-null version fields.

## Direct DBA read-only evidence

Queries against ITAPPVETOPSDB01 / VetMed-Ops (Windows integrated auth, no writes) showed 198 roles in 2026–27, with 148 schedule rows and 50 without. Existing `CONVERT(varchar(18),ScheduleVersion,1)` returned raw binary timestamp bytes (7–8 visible bytes), while `CONVERT(varchar(18),CONVERT(varbinary(8),ScheduleVersion),1)` returned valid 18-character 0x-prefixed hexadecimal, including sample `0x0000000000009C57`. SQL column type = timestamp, length 8. The SQL stored procedure's optimistic-lock `@version` and returned scheduleVersion used the same bad expression. This validates root cause at SQL source rather than a client issue.

## Fix

- Both administrator list and faculty detail DTO query expressions now cast the rowversion to varbinary(8) before style-1 hex.
- Additive SQL `058_role_appointment_rowversion_hex.sql` redefines only two conversions within `paws_api.SetRoleAppointmentPeriods`, leaving all existing authorization, 12-period validation, locks, 53509 conflict, audit, grants, data and table schema unchanged. Original `035` historical migration remains unchanged.
- Read-only `058_role_appointment_rowversion_hex_acceptance.sql` verifies all emitted formats and stored procedure preservation after an authorized deployment.
- New TDD unit test failed 3/3 before changes and passed 3/3 after. Independent governance proof checks one protected API source changed and no static assets altered.
- Freeze promotion should be a separate commit anchored to exact product SHA. Do not weaken the freeze or alter previous historic release receipts.

## Release boundary

The owner's current message asked whether they operated the UI incorrectly, not for a new database change. Therefore **do not merge, execute SQL migration, or deploy API/Hosting without a fresh explicit decision**. Current Production stays at 49f34d0; existing 27 write gates, SQL, Firebase and user data are untouched.

After authorized release, verify successful real appointment editing, post-save reload, true stale HTTP 409, and preservation of DOE and original dates. Keep rollback snapshots and compare all runtime write gates. Firebase Hosting has no changes in this candidate; do not unnecessarily redeploy it.
