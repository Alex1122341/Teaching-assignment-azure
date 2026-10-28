:ON ERROR EXIT
SET NOCOUNT ON;SET XACT_ABORT ON;SET ANSI_NULLS ON;SET QUOTED_IDENTIFIER ON;
IF DB_NAME()<>N'VetMed-Ops' OR OBJECT_ID(N'paws.LeadershipWorkflowModule',N'U') IS NULL THROW 54362,'063 rollback requires the reviewed workflow journal.',1;
IF (SELECT COUNT(*) FROM paws.LeadershipWorkflowModule)<>4 OR EXISTS(SELECT 1 FROM paws.LeadershipWorkflowModule WHERE ObjectName NOT IN(N'paws_api.CanActOnTeachingAssignmentPackage',N'paws_api.RecordTeachingAssignmentReview',N'paws_api.AddTeachingAssignmentContribution',N'paws_api.RecoverMasterAppointments') OR InstalledHash IS NULL OR RestoreHash IS NULL OR RestoreDefinition IS NULL OR OriginalObjectId<>OBJECT_ID(ObjectName)
 OR OriginalHash<>CONVERT(varchar(64),HASHBYTES('SHA2_256',OriginalDefinition),2) OR RestoreHash<>CONVERT(varchar(64),HASHBYTES('SHA2_256',RestoreDefinition),2) OR OBJECT_DEFINITION(OBJECT_ID(ObjectName)) IS NULL OR InstalledHash<>CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(ObjectName))),2))
 THROW 54362,'063 rollback refuses incomplete or changed module evidence.',1;
IF EXISTS(SELECT 1 FROM paws.AuditEvent WHERE OccurredAtUtc>=(SELECT MIN(InstalledAtUtc) FROM paws.LeadershipWorkflowModule) AND EntityType IN(N'TeachingAssignmentPackage',N'session_swap',N'master_refresh'))
 THROW 54362,'Preserve used workflow history; disable writes/additional roles instead.',1;
BEGIN TRANSACTION;
DROP TRIGGER paws.LeadershipAuthority063_Ownership;
DROP TRIGGER paws.LeadershipAuthority063_Package;
DECLARE @Name sysname,@Original nvarchar(max),@Header nvarchar(200),@CreatePosition int;
DECLARE originals CURSOR LOCAL FAST_FORWARD FOR SELECT ObjectName,OriginalDefinition FROM paws.LeadershipWorkflowModule ORDER BY ObjectName;
OPEN originals;FETCH NEXT FROM originals INTO @Name,@Original;
WHILE @@FETCH_STATUS=0
BEGIN
 SET @Header=UPPER(LTRIM(REPLACE(REPLACE(REPLACE(LEFT(@Original,200),CHAR(9),N' '),CHAR(10),N' '),CHAR(13),N' ')));
 WHILE CHARINDEX(N'  ',@Header)>0 SET @Header=REPLACE(@Header,N'  ',N' ');
 SET @CreatePosition=CHARINDEX(N'CREATE',UPPER(@Original));
 IF LEFT(@Header,16)=N'CREATE PROCEDURE' OR LEFT(@Header,15)=N'CREATE FUNCTION' SET @Original=STUFF(@Original,@CreatePosition,6,N'ALTER');
 ELSE IF LEFT(@Header,25)=N'CREATE OR ALTER PROCEDURE' OR LEFT(@Header,24)=N'CREATE OR ALTER FUNCTION' SET @Original=STUFF(@Original,@CreatePosition,15,N'ALTER');
 ELSE IF LEFT(@Header,15)<>N'ALTER PROCEDURE' AND LEFT(@Header,14)<>N'ALTER FUNCTION' THROW 54362,'Unsupported original workflow module header.',1;
 IF (SELECT RestoreHash FROM paws.LeadershipWorkflowModule WHERE ObjectName=@Name)<>CONVERT(varchar(64),HASHBYTES('SHA2_256',@Original),2) THROW 54362,'Recovery differs beyond the accepted DDL-verb normalization.',1;
 EXEC sys.sp_executesql @Original;
 -- Depending on SQL build, metadata retains the original CREATE header or the
 -- canonical ALTER header. Both are exact complete definitions captured above;
 -- no parameter/body difference or arbitrary normalization is accepted.
 DECLARE @Actual nvarchar(max)=OBJECT_DEFINITION(OBJECT_ID(@Name)),@ActualHash char(64);
 SET @ActualHash=CONVERT(varchar(64),HASHBYTES('SHA2_256',@Actual),2);
 IF @Actual IS NULL OR NOT EXISTS(SELECT 1 FROM paws.LeadershipWorkflowModule WHERE ObjectName=@Name AND @ActualHash IN(OriginalHash,RestoreHash))
 BEGIN
  SELECT @Name moduleName,LEFT(@Original,100) expectedAlterHeader,LEFT(@Actual,100) actualHeader,DATALENGTH(@Original) expectedBytes,DATALENGTH(@Actual) actualBytes;
  THROW 54362,'Original module parameters/body did not restore exactly.',1;
 END;
 FETCH NEXT FROM originals INTO @Name,@Original;
END;
CLOSE originals;DEALLOCATE originals;
DROP TABLE paws.LeadershipWorkflowModule;
COMMIT;
