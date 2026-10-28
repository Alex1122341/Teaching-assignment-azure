:ON ERROR EXIT
SET NOCOUNT ON;SET XACT_ABORT ON;SET ANSI_NULLS ON;SET QUOTED_IDENTIFIER ON;
IF DB_NAME()<>N'VetMed-Ops' OR OBJECT_ID(N'paws.LeadershipWorkflowModule',N'U') IS NULL THROW 54362,'063 rollback requires the reviewed workflow journal.',1;
IF (SELECT COUNT(*) FROM paws.LeadershipWorkflowModule)<>3 OR EXISTS(SELECT 1 FROM paws.LeadershipWorkflowModule WHERE ObjectName NOT IN(N'paws_api.CanActOnTeachingAssignmentPackage',N'paws_api.RecordTeachingAssignmentReview',N'paws_api.AddTeachingAssignmentContribution') OR InstalledHash IS NULL
 OR OriginalHash<>CONVERT(varchar(64),HASHBYTES('SHA2_256',OriginalDefinition),2) OR OBJECT_DEFINITION(OBJECT_ID(ObjectName)) IS NULL OR InstalledHash<>CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(ObjectName))),2))
 THROW 54362,'063 rollback refuses incomplete or changed module evidence.',1;
IF EXISTS(SELECT 1 FROM paws.AuditEvent WHERE OccurredAtUtc>=(SELECT MIN(InstalledAtUtc) FROM paws.LeadershipWorkflowModule) AND EntityType IN(N'TeachingAssignmentPackage',N'session_swap'))
 THROW 54362,'Preserve used workflow history; disable writes/additional roles instead.',1;
BEGIN TRANSACTION;
DROP TRIGGER paws.LeadershipAuthority063_Ownership;
DROP TRIGGER paws.LeadershipAuthority063_Package;
DECLARE @Name sysname,@Original nvarchar(max);
DECLARE originals CURSOR LOCAL FAST_FORWARD FOR SELECT ObjectName,OriginalDefinition FROM paws.LeadershipWorkflowModule ORDER BY ObjectName;
OPEN originals;FETCH NEXT FROM originals INTO @Name,@Original;
WHILE @@FETCH_STATUS=0
BEGIN
 EXEC sys.sp_executesql @Original;
 IF (SELECT OriginalHash FROM paws.LeadershipWorkflowModule WHERE ObjectName=@Name)<>CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(@Name))),2) THROW 54362,'Original module did not restore exactly.',1;
 FETCH NEXT FROM originals INTO @Name,@Original;
END;
CLOSE originals;DEALLOCATE originals;
DROP TABLE paws.LeadershipWorkflowModule;
COMMIT;
