:ON ERROR EXIT
SET NOCOUNT ON;SET XACT_ABORT ON;SET ANSI_NULLS ON;SET QUOTED_IDENTIFIER ON;
IF DB_NAME()<>N'VetMed-Ops' OR OBJECT_ID(N'paws_api.SetTeachingLeadershipAccess',N'P') IS NULL
 OR OBJECT_ID(N'paws_api.EffectiveTeachingAssignments',N'IF') IS NULL OR OBJECT_ID(N'paws_api.CanActOnTeachingAssignmentPackage',N'FN') IS NULL
 THROW 54300,'063 requires accepted062 and the existing workflow.',1;
IF OBJECT_ID(N'paws.LeadershipWorkflowModule') IS NOT NULL OR OBJECT_ID(N'paws.LeadershipAuthority063_Ownership') IS NOT NULL OR OBJECT_ID(N'paws.LeadershipAuthority063_Package') IS NOT NULL
 THROW 54300,'063 refuses an existing or unknown workflow deployment.',1;
IF OBJECT_DEFINITION(OBJECT_ID(N'paws_api.CanActOnTeachingAssignmentPackage')) NOT LIKE N'%LOWER(up.BaseRole) = N''hicc''%'
 OR OBJECT_DEFINITION(OBJECT_ID(N'paws_api.CanActOnTeachingAssignmentPackage')) NOT LIKE N'%N''developer''%'
 OR OBJECT_DEFINITION(OBJECT_ID(N'paws_api.RecordTeachingAssignmentReview')) IS NULL
 OR OBJECT_DEFINITION(OBJECT_ID(N'paws_api.AddTeachingAssignmentContribution')) IS NULL
 OR OBJECT_DEFINITION(OBJECT_ID(N'paws_api.RecoverMasterAppointments')) IS NULL
 THROW 54300,'063 refuses an unknown or pre025 workflow authority.',1;
IF EXISTS(SELECT 1 FROM sys.sql_modules WHERE object_id IN(OBJECT_ID(N'paws_api.CanActOnTeachingAssignmentPackage'),OBJECT_ID(N'paws_api.RecordTeachingAssignmentReview'),OBJECT_ID(N'paws_api.AddTeachingAssignmentContribution'),OBJECT_ID(N'paws_api.RecoverMasterAppointments')) AND(uses_ansi_nulls<>1 OR uses_quoted_identifier<>1)) THROW 54300,'063 requires the reviewed SQL module settings.',1;
BEGIN TRANSACTION;
CREATE TABLE paws.LeadershipWorkflowModule(
 ObjectName sysname NOT NULL PRIMARY KEY,OriginalDefinition nvarchar(max) NOT NULL,OriginalHash char(64) NOT NULL,
 OriginalObjectId int NOT NULL,RestoreDefinition nvarchar(max) NULL,RestoreHash char(64) NULL,
 InstalledHash char(64) NULL,InstalledAtUtc datetime2(7) NOT NULL DEFAULT SYSUTCDATETIME()
);
INSERT paws.LeadershipWorkflowModule(ObjectName,OriginalDefinition,OriginalHash,OriginalObjectId)
 SELECT name,OBJECT_DEFINITION(OBJECT_ID(name)),CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(name))),2),OBJECT_ID(name)
 FROM (VALUES(N'paws_api.CanActOnTeachingAssignmentPackage'),(N'paws_api.RecordTeachingAssignmentReview'),(N'paws_api.AddTeachingAssignmentContribution'),(N'paws_api.RecoverMasterAppointments')) known(name);
-- Reuse025's bounded header normalization. SQL stores CREATE OR ALTER as a
-- CREATE header on some versions; changing only the DDL verb to ALTER keeps
-- every parameter/body byte, object identity and existing permission binding.
DECLARE @ObjectName sysname,@Canonical nvarchar(max),@Header nvarchar(200),@CreatePosition int;
DECLARE canonical_modules CURSOR LOCAL FAST_FORWARD FOR SELECT ObjectName,OriginalDefinition FROM paws.LeadershipWorkflowModule;
OPEN canonical_modules;FETCH NEXT FROM canonical_modules INTO @ObjectName,@Canonical;
WHILE @@FETCH_STATUS=0
BEGIN
 SET @Header=UPPER(LTRIM(REPLACE(REPLACE(REPLACE(LEFT(@Canonical,200),CHAR(9),N' '),CHAR(10),N' '),CHAR(13),N' ')));
 WHILE CHARINDEX(N'  ',@Header)>0 SET @Header=REPLACE(@Header,N'  ',N' ');
 SET @CreatePosition=CHARINDEX(N'CREATE',UPPER(@Canonical));
 IF LEFT(@Header,16)=N'CREATE PROCEDURE' OR LEFT(@Header,15)=N'CREATE FUNCTION' SET @Canonical=STUFF(@Canonical,@CreatePosition,6,N'ALTER');
 ELSE IF LEFT(@Header,25)=N'CREATE OR ALTER PROCEDURE' OR LEFT(@Header,24)=N'CREATE OR ALTER FUNCTION' SET @Canonical=STUFF(@Canonical,@CreatePosition,15,N'ALTER');
 ELSE IF LEFT(@Header,15)<>N'ALTER PROCEDURE' AND LEFT(@Header,14)<>N'ALTER FUNCTION' THROW 54300,'Unsupported workflow module header.',1;
 UPDATE paws.LeadershipWorkflowModule SET RestoreDefinition=@Canonical,RestoreHash=CONVERT(varchar(64),HASHBYTES('SHA2_256',@Canonical),2) WHERE ObjectName=@ObjectName;
 FETCH NEXT FROM canonical_modules INTO @ObjectName,@Canonical;
END;
CLOSE canonical_modules;DEALLOCATE canonical_modules;
GO
CREATE OR ALTER FUNCTION paws_api.CanActOnTeachingAssignmentPackage
(@PackageId uniqueidentifier,@ActorFirebaseUid nvarchar(128),@ActionKind nvarchar(16))
RETURNS bit
AS
BEGIN
 -- PAWS_SCOPED_TEACHING_063: exact canonical authority, never BaseRole replacement.
 DECLARE @Today date=CONVERT(date,(SYSUTCDATETIME() AT TIME ZONE 'UTC') AT TIME ZONE 'Mountain Standard Time');
 IF @ActionKind=N'adfad' RETURN IIF(EXISTS(SELECT 1 FROM paws.UserProfile WHERE FirebaseUid=@ActorFirebaseUid AND Active=1 AND MustChangePassword=0 AND LOWER(LTRIM(RTRIM(BaseRole))) IN(N'owner',N'administrator',N'adfa_general',N'adfa_regular',N'admin',N'developer')),1,0);
 IF @ActionKind NOT IN(N'hicc',N'visc') RETURN 0;
 RETURN IIF(EXISTS(
  SELECT 1 FROM paws.TeachingAssignmentPackage p
  JOIN paws.TeachingAssignmentGroup g ON g.GroupId=p.GroupId AND g.Active=1
  JOIN paws.TeachingResponsibility hr ON hr.ResponsibilityId=p.HiccResponsibilityId AND hr.Kind=N'hicc' AND hr.Active=1
  JOIN paws.TeachingAssignmentGroupHicc gh ON gh.GroupId=p.GroupId AND gh.HiccResponsibilityId=p.HiccResponsibilityId AND gh.HiccResponsibilityKind=N'hicc'
  CROSS APPLY paws_api.EffectiveTeachingAssignments(@ActorFirebaseUid,p.AcademicYear,@Today) effective
  JOIN paws.TeachingResponsibilityAssignee a ON a.ResponsibilityAssigneeId=CONVERT(uniqueidentifier,effective.assignmentId)
  WHERE p.TeachingAssignmentPackageId=@PackageId
   AND ((@ActionKind=N'hicc' AND effective.kind=N'hicc' AND effective.responsibilityId=p.HiccResponsibilityId)
     OR(@ActionKind=N'visc' AND effective.kind=N'visc' AND effective.responsibilityId=g.LeaderViscResponsibilityId))
   AND EXISTS(SELECT 1 FROM paws.TeachingResponsibilityScope s JOIN paws.Course c ON c.CourseId=s.CourseId WHERE s.HiccResponsibilityId=p.HiccResponsibilityId AND LEN(LTRIM(RTRIM(c.CourseCode)))>0)
   AND NOT EXISTS(SELECT 1 FROM paws.TeachingResponsibilityAssignee other WHERE other.ResponsibilityId=a.ResponsibilityId AND other.AcademicYear=a.AcademicYear AND other.ResponsibilityAssigneeId<>a.ResponsibilityAssigneeId
    AND other.ActiveDate<a.ExpirationDate AND a.ActiveDate<other.ExpirationDate AND(other.AssignmentMode<>N'concurrent' OR a.AssignmentMode<>N'concurrent'))
   AND NOT EXISTS(SELECT 1 FROM paws.TeachingSessionOwnership o JOIN paws.Session s ON s.SessionId=o.SessionId WHERE o.TeachingAssignmentPackageId=p.TeachingAssignmentPackageId
    AND(s.AcademicYear<>p.AcademicYear OR s.CourseId IS NULL OR NOT EXISTS(SELECT 1 FROM paws.TeachingResponsibilityScope scope WHERE scope.HiccResponsibilityId=p.HiccResponsibilityId AND scope.CourseId=s.CourseId AND(scope.SubjectId IS NULL OR scope.SubjectId=o.SubjectId))))
   AND NOT EXISTS(SELECT 1 FROM paws.TeachingAssignmentRevision r JOIN paws.TeachingAssignmentRevisionSession rs ON rs.RevisionId=r.RevisionId
    WHERE r.TeachingAssignmentPackageId=p.TeachingAssignmentPackageId AND r.RevisionNumber=p.WorkingRevision AND NOT EXISTS(SELECT 1 FROM paws.TeachingSessionOwnership o WHERE o.SessionId=rs.SessionId AND o.TeachingAssignmentPackageId=p.TeachingAssignmentPackageId))
 ),1,0);
END;
GO
CREATE TRIGGER paws.LeadershipAuthority063_Ownership ON paws.TeachingSessionOwnership AFTER INSERT,UPDATE,DELETE AS
BEGIN
 SET NOCOUNT ON;IF NOT EXISTS(SELECT 1 FROM inserted) AND NOT EXISTS(SELECT 1 FROM deleted) RETURN;
 UPDATE paws.LeadershipAccessState SET Enabled=Enabled WHERE SingletonId=1;
 IF @@ROWCOUNT<>1 THROW 54103,'Leadership authority state unavailable.',1;
END;
GO
CREATE TRIGGER paws.LeadershipAuthority063_Package ON paws.TeachingAssignmentPackage AFTER INSERT,UPDATE,DELETE AS
BEGIN
 SET NOCOUNT ON;
 -- Status/revision changes are business writes, not changes to the caller's
 -- authority. Only canonical package identity/ownership alters this epoch.
 IF NOT EXISTS(SELECT TeachingAssignmentPackageId,AcademicYear,GroupId,HiccResponsibilityId FROM inserted EXCEPT SELECT TeachingAssignmentPackageId,AcademicYear,GroupId,HiccResponsibilityId FROM deleted)
 AND NOT EXISTS(SELECT TeachingAssignmentPackageId,AcademicYear,GroupId,HiccResponsibilityId FROM deleted EXCEPT SELECT TeachingAssignmentPackageId,AcademicYear,GroupId,HiccResponsibilityId FROM inserted) RETURN;
 UPDATE paws.LeadershipAccessState SET Enabled=Enabled WHERE SingletonId=1;
 IF @@ROWCOUNT<>1 THROW 54103,'Leadership authority state unavailable.',1;
END;
GO
DECLARE @Definition nvarchar(max),@Needle nvarchar(max),@Replacement nvarchar(max);
SELECT @Definition=RestoreDefinition FROM paws.LeadershipWorkflowModule WHERE ObjectName=N'paws_api.RecordTeachingAssignmentReview';
SET @Needle=N'SELECT @RevisionId = RevisionId FROM paws.TeachingAssignmentRevision WHERE TeachingAssignmentPackageId = @PackageId AND RevisionNumber = @RevisionNumber;';
IF @Definition IS NULL OR (LEN(@Definition)-LEN(REPLACE(@Definition,@Needle,N'')))/LEN(@Needle)<>1 THROW 54300,'Review procedure differs from the accepted source.',1;
SET @Replacement=@Needle+N'
        -- PAWS_SCOPED_TEACHING_063: a dual role does not authorize self-review.
        IF EXISTS(SELECT 1 FROM paws.TeachingAssignmentRevision WHERE RevisionId=@RevisionId AND CreatedByFirebaseUid=@ActorFirebaseUid)
         OR EXISTS(SELECT 1 FROM paws.AuditEvent WHERE EntityType=N''TeachingAssignmentPackage'' AND EntityId=CONVERT(nvarchar(36),@PackageId) AND EventType=N''TeachingAssignmentSubmitted'' AND ActorFirebaseUid=@ActorFirebaseUid AND TRY_CONVERT(int,JSON_VALUE(AfterJson,''$.submittedRevision''))=@RevisionNumber)
         THROW 52133,''Another authorized VISC reviewer must review this proposal.'',1;';
SET @Definition=REPLACE(@Definition,@Needle,@Replacement);
EXEC sys.sp_executesql @Definition;
SELECT @Definition=RestoreDefinition FROM paws.LeadershipWorkflowModule WHERE ObjectName=N'paws_api.AddTeachingAssignmentContribution';
SET @Needle=N'IF @ActorName IS NULL OR @BaseRole NOT IN (N''adc'',N''lab'',N''hicc'') OR @BaseRole<>@SuggestedByOffice';
IF @Definition IS NULL OR (LEN(@Definition)-LEN(REPLACE(@Definition,@Needle,N'')))/LEN(@Needle)<>1 THROW 54300,'Contribution procedure differs from the accepted source.',1;
SET @Replacement=N'-- PAWS_SCOPED_TEACHING_063: local action context only; never update BaseRole.
        IF @BaseRole IN(N''faculty'',N''visc'') AND @SuggestedByOffice=N''hicc'' AND paws_api.CanActOnTeachingAssignmentPackage(@PackageId,@ActorFirebaseUid,N''hicc'')=1 SET @BaseRole=N''hicc'';
        '+@Needle;
SET @Definition=REPLACE(@Definition,@Needle,@Replacement);
EXEC sys.sp_executesql @Definition;
-- Preserve historical MASTER snapshot bytes and receipts. New access grants
-- must be explicitly revoked before Undo can delete their source appointment.
SELECT @Definition=RestoreDefinition FROM paws.LeadershipWorkflowModule WHERE ObjectName=N'paws_api.RecoverMasterAppointments';
SET @Needle=N'INSERT @Affected SELECT RoleId,IsNew FROM OPENJSON(@Operations) WITH(RoleId uniqueidentifier ''$.roleId'',IsNew bit ''$.isNew'');';
IF @Definition IS NULL OR (LEN(@Definition)-LEN(REPLACE(@Definition,@Needle,N'')))/LEN(@Needle)<>1 THROW 54300,'MASTER recovery differs from the accepted source.',1;
SET @Replacement=@Needle+N'
  -- PAWS_SCOPED_TEACHING_063: refuse before recovery audit or business writes.
  IF EXISTS(SELECT 1 FROM @Affected a JOIN paws.TeachingLeadershipGrantSource source WITH(UPDLOCK,HOLDLOCK) ON source.SourceRoleAssignmentId=a.RoleId WHERE a.IsNew=1)
   THROW 54304,''Revoke dependent teaching leadership assignments before MASTER recovery.'',1;';
SET @Definition=REPLACE(@Definition,@Needle,@Replacement);
EXEC sys.sp_executesql @Definition;
UPDATE paws.LeadershipWorkflowModule SET InstalledHash=CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(ObjectName))),2);
IF EXISTS(SELECT 1 FROM paws.LeadershipWorkflowModule WHERE InstalledHash IS NULL OR RestoreDefinition IS NULL OR RestoreHash IS NULL OR OriginalObjectId<>OBJECT_ID(ObjectName) OR OriginalHash<>CONVERT(varchar(64),HASHBYTES('SHA2_256',OriginalDefinition),2) OR RestoreHash<>CONVERT(varchar(64),HASHBYTES('SHA2_256',RestoreDefinition),2)) THROW 54300,'Workflow definition capture is incomplete.',1;
COMMIT;
