:ON ERROR EXIT
SET NOCOUNT ON;
SET XACT_ABORT ON;
IF DB_NAME()<>N'VetMed-Ops' THROW 54162,'061 rollback requires the reviewed target.',1;
IF OBJECT_ID(N'paws.LeadershipAccessState',N'U') IS NULL
 OR OBJECT_ID(N'paws.LeadershipAccessOperation',N'U') IS NULL
 OR OBJECT_ID(N'paws.TeachingLeadershipGrantSource',N'U') IS NULL
 OR OBJECT_ID(N'paws_api.EffectiveTeachingAssignments',N'IF') IS NULL
 OR OBJECT_ID(N'paws_api.TeachingAuthorityState',N'IF') IS NULL
 OR OBJECT_ID(N'paws_api.TeachingAppointmentAccessSourceStamp',N'FN') IS NULL
 THROW 54162,'061 rollback refuses an unknown or incomplete deployment.',1;
IF EXISTS(SELECT 1 FROM paws.LeadershipAccessOperation) OR EXISTS(SELECT 1 FROM paws.TeachingLeadershipGrantSource)
 OR EXISTS(SELECT 1 FROM paws.LeadershipAccessState WHERE Enabled=1)
 OR EXISTS(SELECT 1 FROM paws.AuditEvent WHERE EventType=N'leadership_access_change')
 THROW 54162,'Keep used leadership operations and audits; disable additional access instead.',1;
IF OBJECT_ID(N'paws_api.SetTeachingLeadershipAccess') IS NOT NULL OR OBJECT_ID(N'paws.LeadershipWorkflowModule') IS NOT NULL
 THROW 54162,'061 foundation rollback refuses a later command deployment.',1;
BEGIN TRANSACTION;
DROP FUNCTION paws_api.EffectiveTeachingAssignments;
DROP FUNCTION paws_api.TeachingAppointmentAccessSourceStamp;
DROP FUNCTION paws_api.TeachingResponsibilityAccessScopeStamp;
DROP FUNCTION paws_api.TeachingAssigneeAccessStamp;
DROP FUNCTION paws_api.TeachingAuthorityState;
DECLARE @Table sysname,@TriggerSql nvarchar(max);
DECLARE authority_tables CURSOR LOCAL FAST_FORWARD FOR SELECT name FROM (VALUES
 (N'TeachingResponsibility'),(N'TeachingResponsibilityScope'),(N'TeachingResponsibilityAssignee'),
 (N'TeachingAssignmentGroup'),(N'TeachingAssignmentGroupHicc'),(N'RoleAssignment'),
 (N'RoleAppointmentSchedule'),(N'Faculty'),(N'Course')) AS fixed(name);
OPEN authority_tables;FETCH NEXT FROM authority_tables INTO @Table;
WHILE @@FETCH_STATUS=0
BEGIN
 SET @TriggerSql=N'DROP TRIGGER paws.'+QUOTENAME(N'LeadershipAuthority061_'+@Table)+N';';
 EXEC sys.sp_executesql @TriggerSql;
 FETCH NEXT FROM authority_tables INTO @Table;
END;
CLOSE authority_tables;DEALLOCATE authority_tables;
DROP TABLE paws.TeachingLeadershipGrantSource;
DROP TABLE paws.LeadershipAccessOperation;
DROP TABLE paws.LeadershipAccessState;
ALTER TABLE paws.TeachingResponsibility DROP COLUMN AuthorityVersion;
ALTER TABLE paws.TeachingResponsibilityScope DROP COLUMN AuthorityVersion;
ALTER TABLE paws.TeachingResponsibilityAssignee DROP COLUMN AuthorityVersion;
ALTER TABLE paws.TeachingAssignmentGroup DROP COLUMN AuthorityVersion;
ALTER TABLE paws.TeachingAssignmentGroupHicc DROP COLUMN AuthorityVersion;
-- Preserve the pre-existing ScheduleVersion, SQL060, its role and all business rows.
COMMIT;
