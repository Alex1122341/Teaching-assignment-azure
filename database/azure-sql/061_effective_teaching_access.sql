/* Effective multiple teaching roles: versioned canonical authority foundation.
   Development candidate: the Owner command, isolated acceptance and authority
   consumer changes must be completed/reviewed before any live application.
   No account, appointment, assignee, package or collaboration grant is seeded. */
:ON ERROR EXIT
SET NOCOUNT ON;
SET XACT_ABORT ON;
IF DB_NAME()<>N'VetMed-Ops' THROW 54100,'061 requires the reviewed VetMed-Ops target.',1;
IF COL_LENGTH(N'paws.UserProfile',N'AccessVersion') IS NULL
 OR DATABASE_PRINCIPAL_ID(N'paws_runtime_account_access') IS NULL
 OR OBJECT_DEFINITION(OBJECT_ID(N'paws_api.SetAccountAccess')) IS NULL
 OR OBJECT_DEFINITION(OBJECT_ID(N'paws_api.SetAccountAccess')) NOT LIKE N'%PAWS_EFFECTIVE_ACCESS_060%'
 THROW 54100,'061 requires accepted SQL060 authority.',1;
IF OBJECT_ID(N'paws.TeachingResponsibilityAssignee',N'U') IS NULL
 OR OBJECT_ID(N'paws.TeachingResponsibilityScope',N'U') IS NULL
 OR OBJECT_ID(N'paws.TeachingAssignmentGroupHicc',N'U') IS NULL
 OR OBJECT_ID(N'paws.RoleAssignment',N'U') IS NULL
 OR OBJECT_ID(N'paws.RoleAppointmentSchedule',N'U') IS NULL
 OR COL_LENGTH(N'paws.RoleAppointmentSchedule',N'ScheduleVersion') IS NULL
 THROW 54100,'061 requires the accepted responsibility and appointment foundations.',1;
IF OBJECT_ID(N'paws.LeadershipAccessState') IS NOT NULL
 OR OBJECT_ID(N'paws.LeadershipAccessOperation') IS NOT NULL
 OR OBJECT_ID(N'paws.TeachingLeadershipGrantSource') IS NOT NULL
 OR OBJECT_ID(N'paws_api.EffectiveTeachingAssignments') IS NOT NULL
 OR OBJECT_ID(N'paws_api.TeachingAppointmentAccessSourceStamp') IS NOT NULL
 OR OBJECT_ID(N'paws_api.TeachingAuthorityState') IS NOT NULL
 THROW 54100,'061 refuses existing or unknown leadership deployment.',1;
IF EXISTS(SELECT 1 FROM sys.columns WHERE system_type_id=189 AND object_id IN
 (OBJECT_ID(N'paws.TeachingResponsibility'),OBJECT_ID(N'paws.TeachingResponsibilityScope'),
  OBJECT_ID(N'paws.TeachingResponsibilityAssignee'),OBJECT_ID(N'paws.TeachingAssignmentGroup'),
  OBJECT_ID(N'paws.TeachingAssignmentGroupHicc'),OBJECT_ID(N'paws.RoleAssignment')))
 THROW 54100,'061 refuses pre-existing authority version columns.',1;
IF EXISTS(SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID(N'paws.RoleAppointmentSchedule') AND system_type_id=189 AND name<>N'ScheduleVersion')
 OR EXISTS(SELECT 1 FROM sys.triggers WHERE name LIKE N'LeadershipAuthority061[_]%')
 THROW 54100,'061 refuses an unknown appointment version or authority trigger.',1;
BEGIN TRANSACTION;
ALTER TABLE paws.TeachingResponsibility ADD AuthorityVersion rowversion NOT NULL;
ALTER TABLE paws.TeachingResponsibilityScope ADD AuthorityVersion rowversion NOT NULL;
ALTER TABLE paws.TeachingResponsibilityAssignee ADD AuthorityVersion rowversion NOT NULL;
ALTER TABLE paws.TeachingAssignmentGroup ADD AuthorityVersion rowversion NOT NULL;
ALTER TABLE paws.TeachingAssignmentGroupHicc ADD AuthorityVersion rowversion NOT NULL;
ALTER TABLE paws.RoleAssignment ADD AuthorityVersion rowversion NOT NULL;

CREATE TABLE paws.LeadershipAccessState(
 SingletonId tinyint NOT NULL CONSTRAINT PK_LeadershipAccessState PRIMARY KEY,
 Enabled bit NOT NULL,
 AuthorityVersion rowversion NOT NULL,
 CONSTRAINT CK_LeadershipAccessState_Singleton CHECK(SingletonId=1)
);
-- Existing same-kind BaseRole paths remain unchanged. Additional kinds stay off
-- until the coordinated accepted release explicitly enables this state.
INSERT paws.LeadershipAccessState(SingletonId,Enabled) VALUES(1,0);
-- A retained epoch also catches deletion/re-creation and A -> B -> A, including
-- an empty responsibility list. Existing appointment ScheduleVersion is reused.
-- These fixed-object triggers touch only the epoch, never the source values.
DECLARE @Table sysname,@TriggerSql nvarchar(max);
DECLARE authority_tables CURSOR LOCAL FAST_FORWARD FOR SELECT name FROM (VALUES
 (N'TeachingResponsibility'),(N'TeachingResponsibilityScope'),(N'TeachingResponsibilityAssignee'),
 (N'TeachingAssignmentGroup'),(N'TeachingAssignmentGroupHicc'),(N'RoleAssignment'),
 (N'RoleAppointmentSchedule'),(N'Faculty'),(N'Course')) AS fixed(name);
OPEN authority_tables;FETCH NEXT FROM authority_tables INTO @Table;
WHILE @@FETCH_STATUS=0
BEGIN
 SET @TriggerSql=N'CREATE TRIGGER paws.'+QUOTENAME(N'LeadershipAuthority061_'+@Table)+N' ON paws.'+QUOTENAME(@Table)+N' AFTER INSERT,UPDATE,DELETE AS BEGIN SET NOCOUNT ON; IF NOT EXISTS(SELECT 1 FROM inserted) AND NOT EXISTS(SELECT 1 FROM deleted) RETURN; UPDATE paws.LeadershipAccessState SET Enabled=Enabled WHERE SingletonId=1; IF @@ROWCOUNT<>1 THROW 54103,''Leadership authority state unavailable.'',1; END;';
 EXEC sys.sp_executesql @TriggerSql;
 FETCH NEXT FROM authority_tables INTO @Table;
END;
CLOSE authority_tables;DEALLOCATE authority_tables;
CREATE TABLE paws.LeadershipAccessOperation(
 OperationId uniqueidentifier NOT NULL CONSTRAINT PK_LeadershipAccessOperation PRIMARY KEY,
 PreviewId uniqueidentifier NOT NULL,
 ActorUid nvarchar(128) NOT NULL,
 TargetUid nvarchar(128) NOT NULL,
 AcademicYear nvarchar(32) NOT NULL,
 IntentHash char(64) NOT NULL,
 Reason nvarchar(1000) NOT NULL,
 ReceiptJson nvarchar(max) NOT NULL,
 CreatedAtUtc datetime2(7) NOT NULL,
 CONSTRAINT CK_LeadershipAccessOperation_Receipt CHECK(ISJSON(ReceiptJson)=1),
 CONSTRAINT CK_LeadershipAccessOperation_Reason CHECK(LEN(LTRIM(RTRIM(Reason)))>0)
);
CREATE INDEX IX_LeadershipAccessOperation_TargetYear ON paws.LeadershipAccessOperation(TargetUid,AcademicYear,CreatedAtUtc DESC,OperationId DESC);
CREATE TABLE paws.TeachingLeadershipGrantSource(
 ResponsibilityAssigneeId uniqueidentifier NOT NULL CONSTRAINT PK_TeachingLeadershipGrantSource PRIMARY KEY,
 SourceRoleAssignmentId uniqueidentifier NOT NULL,
 ApprovedSourceSignature char(64) NOT NULL,
 UsesApprovedDefaultDates bit NOT NULL,
 OperationId uniqueidentifier NOT NULL,
 AuthorityVersion rowversion NOT NULL,
 CONSTRAINT FK_TeachingLeadershipGrantSource_Assignee FOREIGN KEY(ResponsibilityAssigneeId) REFERENCES paws.TeachingResponsibilityAssignee(ResponsibilityAssigneeId),
 CONSTRAINT FK_TeachingLeadershipGrantSource_Source FOREIGN KEY(SourceRoleAssignmentId) REFERENCES paws.RoleAssignment(RoleAssignmentId),
 CONSTRAINT FK_TeachingLeadershipGrantSource_Operation FOREIGN KEY(OperationId) REFERENCES paws.LeadershipAccessOperation(OperationId),
 CONSTRAINT CK_TeachingLeadershipGrantSource_Hash CHECK(LEN(ApprovedSourceSignature)=64 AND ApprovedSourceSignature COLLATE Latin1_General_100_BIN2 NOT LIKE '%[^a-fA-F0-9]%')
);
GO
CREATE FUNCTION paws_api.TeachingAuthorityState()
RETURNS TABLE
AS RETURN(SELECT LOWER(CONVERT(varchar(16),CONVERT(binary(8),AuthorityVersion),2)) authorityVersion
 FROM paws.LeadershipAccessState WHERE SingletonId=1);
GO
CREATE FUNCTION paws_api.TeachingAppointmentAccessSourceStamp(@RoleAssignmentId uniqueidentifier)
RETURNS varchar(64)
AS
BEGIN
 -- Only authority-relevant appointment facts participate, never credit amounts
 -- or unrelated person fields. Source rowversions separately invalidate intents.
 DECLARE @Snapshot nvarchar(max)=(
  SELECT r.RoleAssignmentId,r.FacultyId,r.AcademicYear,UPPER(LTRIM(RTRIM(r.RoleType))) RoleType,
   r.CourseId,LTRIM(RTRIM(r.CourseOrSubjectOrRotation)) RecordedScope,r.EffectiveDate,r.ExpirationDate,
   s.PeriodsJson
  FROM paws.RoleAssignment r LEFT JOIN paws.RoleAppointmentSchedule s ON s.RoleAssignmentId=r.RoleAssignmentId
  WHERE r.RoleAssignmentId=@RoleAssignmentId FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES
 );
 IF @Snapshot IS NULL OR @Snapshot=N'' RETURN NULL;
 RETURN CONVERT(varchar(64),HASHBYTES('SHA2_256',@Snapshot),2);
END;
GO
CREATE FUNCTION paws_api.EffectiveTeachingAssignments(
 @FirebaseUid nvarchar(128),@AcademicYear nvarchar(32),@AsOfDate date
)
RETURNS TABLE
AS
RETURN(
 SELECT CONVERT(varchar(36),a.ResponsibilityAssigneeId) assignmentId,
  r.ResponsibilityId responsibilityId,r.Kind kind,CONVERT(varchar(36),a.FacultyId) facultyId,
  a.AcademicYear academicYear,CAST(r.Active AS bit) active,
  CONVERT(varchar(10),a.ActiveDate,23) startDate,CONVERT(varchar(10),a.ExpirationDate,23) endExclusive,
  CONVERT(varchar(16),CONVERT(binary(8),a.AuthorityVersion),2) version,
  CONVERT(varchar(64),HASHBYTES('SHA2_256',CONCAT(
   CONVERT(varchar(16),CONVERT(binary(8),r.AuthorityVersion),2),N'|',
   CONVERT(varchar(16),CONVERT(binary(8),state.AuthorityVersion),2),N'|',
   ISNULL(CONVERT(varchar(16),CONVERT(binary(8),linked.AuthorityVersion),2),N''),N'|',
   ISNULL(CONVERT(varchar(16),CONVERT(binary(8),source.AuthorityVersion),2),N''),N'|',
   ISNULL(CONVERT(varchar(16),CONVERT(binary(8),periods.ScheduleVersion),2),N''),N'|',
   (SELECT scope.ResponsibilityScopeId,scope.CourseId,scope.SubjectId,course.CourseCode,
     CONVERT(varchar(16),CONVERT(binary(8),scope.AuthorityVersion),2) version
    FROM paws.TeachingResponsibilityScope scope JOIN paws.Course course ON course.CourseId=scope.CourseId
    WHERE scope.HiccResponsibilityId=r.ResponsibilityId ORDER BY scope.ResponsibilityScopeId FOR JSON PATH),N'|',
   (SELECT g.GroupId,g.Name,g.Active,g.LeaderViscResponsibilityId,
     CONVERT(varchar(16),CONVERT(binary(8),g.AuthorityVersion),2) version,
     JSON_QUERY((SELECT gh.HiccResponsibilityId,CONVERT(varchar(16),CONVERT(binary(8),gh.AuthorityVersion),2) version
       FROM paws.TeachingAssignmentGroupHicc gh WHERE gh.GroupId=g.GroupId ORDER BY gh.HiccResponsibilityId FOR JSON PATH)) relationships
    FROM paws.TeachingAssignmentGroup g
    WHERE g.LeaderViscResponsibilityId=r.ResponsibilityId OR EXISTS(
     SELECT 1 FROM paws.TeachingAssignmentGroupHicc own WHERE own.GroupId=g.GroupId AND own.HiccResponsibilityId=r.ResponsibilityId)
    ORDER BY g.GroupId FOR JSON PATH)
  )),2) definitionVersion,
  CASE WHEN r.Kind=N'hicc' THEN (SELECT CONVERT(varchar(36),scope.CourseId) courseId,course.CourseCode courseCode
   FROM paws.TeachingResponsibilityScope scope JOIN paws.Course course ON course.CourseId=scope.CourseId
   WHERE scope.HiccResponsibilityId=r.ResponsibilityId GROUP BY scope.CourseId,course.CourseCode ORDER BY scope.CourseId FOR JSON PATH)
   ELSE N'[]' END coursesJson,
  CASE WHEN r.Kind=N'visc' THEN (SELECT g.GroupId groupId,g.Name name FROM paws.TeachingAssignmentGroup g
   WHERE g.LeaderViscResponsibilityId=r.ResponsibilityId AND g.Active=1 ORDER BY g.GroupId FOR JSON PATH)
   ELSE N'[]' END groupsJson
 FROM paws.UserProfile u
 JOIN paws.Faculty f ON f.FacultyId=u.FacultyId AND f.Active=1
 JOIN paws.TeachingResponsibilityAssignee a ON a.FacultyId=u.FacultyId AND a.AcademicYear=@AcademicYear
 JOIN paws.TeachingResponsibility r ON r.ResponsibilityId=a.ResponsibilityId AND r.Active=1
 CROSS JOIN paws.LeadershipAccessState state
 LEFT JOIN paws.TeachingLeadershipGrantSource linked ON linked.ResponsibilityAssigneeId=a.ResponsibilityAssigneeId
 LEFT JOIN paws.RoleAssignment source ON source.RoleAssignmentId=linked.SourceRoleAssignmentId
 LEFT JOIN paws.RoleAppointmentSchedule periods ON periods.RoleAssignmentId=source.RoleAssignmentId
 WHERE u.FirebaseUid=@FirebaseUid AND u.Active=1 AND u.MustChangePassword=0
  AND LOWER(LTRIM(RTRIM(u.BaseRole))) IN(N'faculty',N'hicc',N'visc')
  AND a.ActiveDate<=@AsOfDate AND @AsOfDate<a.ExpirationDate
  AND @AsOfDate>=TRY_CONVERT(date,LEFT(@AcademicYear,4)+N'-05-01')
  AND @AsOfDate<DATEADD(year,1,TRY_CONVERT(date,LEFT(@AcademicYear,4)+N'-05-01'))
  AND (LOWER(LTRIM(RTRIM(u.BaseRole)))=r.Kind OR (
   state.Enabled=1 AND linked.ResponsibilityAssigneeId IS NOT NULL
   AND source.FacultyId=u.FacultyId AND source.AcademicYear=a.AcademicYear
   AND ((r.Kind=N'hicc' AND UPPER(LTRIM(RTRIM(source.RoleType))) IN(N'HICC',N'COURSE COORDINATOR'))
    OR (r.Kind=N'visc' AND UPPER(LTRIM(RTRIM(source.RoleType)))=N'VISC'))
   AND linked.ApprovedSourceSignature=paws_api.TeachingAppointmentAccessSourceStamp(source.RoleAssignmentId)
  ))
);
GO
GRANT SELECT ON OBJECT::paws_api.EffectiveTeachingAssignments TO paws_runtime_account_access;
GRANT SELECT ON OBJECT::paws_api.TeachingAuthorityState TO paws_runtime_account_access;
-- New state remains disabled, no runtime principal, role assignment, appointment
-- value, group ownership, source identity or existing permission is rewritten.
COMMIT;
