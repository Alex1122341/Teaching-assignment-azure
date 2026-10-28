:ON ERROR EXIT
SET NOCOUNT ON;
SET XACT_ABORT ON;
IF DB_NAME()<>N'VetMed-Ops' OR OBJECT_ID(N'paws_api.SetTeachingLeadershipAccess',N'P') IS NULL
 OR OBJECT_DEFINITION(OBJECT_ID(N'paws_api.SetTeachingLeadershipAccess')) IS NULL
 OR OBJECT_DEFINITION(OBJECT_ID(N'paws_api.SetTeachingLeadershipAccess')) NOT LIKE N'%PAWS_LEADERSHIP_COMMAND_062%'
 THROW 54262,'062 rollback refuses an unknown command deployment.',1;
IF EXISTS(SELECT 1 FROM paws.LeadershipAccessOperation) OR EXISTS(SELECT 1 FROM paws.TeachingLeadershipGrantSource)
 OR EXISTS(SELECT 1 FROM paws.AuditEvent WHERE EventType=N'leadership_access_change')
 THROW 54262,'Preserve used leadership receipts and audits; disable writes/additional roles instead.',1;
IF OBJECT_ID(N'paws.LeadershipWorkflowModule') IS NOT NULL THROW 54262,'Roll back the accepted scoped workflow layer first.',1;
BEGIN TRANSACTION;
DROP PROCEDURE paws_api.SetTeachingLeadershipAccess;
DROP PROCEDURE paws_api.GetTeachingLeadershipAccessSnapshot;
DROP PROCEDURE paws_api.GetTeachingLeadershipAccessOperation;
DROP PROCEDURE paws_api.GetTeachingLeadershipAccessHistory;
DROP TRIGGER paws.LeadershipAuthority062_SourceLink;
COMMIT;
