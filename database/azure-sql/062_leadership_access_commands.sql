:ON ERROR EXIT
SET NOCOUNT ON;
SET XACT_ABORT ON;
IF DB_NAME()<>N'VetMed-Ops' OR OBJECT_ID(N'paws_api.EffectiveTeachingAssignments',N'IF') IS NULL
 OR OBJECT_ID(N'paws_api.TeachingAuthorityState',N'IF') IS NULL OR OBJECT_ID(N'paws.TeachingLeadershipGrantSource',N'U') IS NULL
 OR DATABASE_PRINCIPAL_ID(N'paws_runtime_account_access') IS NULL
 THROW 54200,'062 requires the accepted061 leadership foundation.',1;
IF OBJECT_ID(N'paws_api.SetTeachingLeadershipAccess') IS NOT NULL OR OBJECT_ID(N'paws_api.GetTeachingLeadershipAccessSnapshot') IS NOT NULL
 OR OBJECT_ID(N'paws_api.GetTeachingLeadershipAccessOperation') IS NOT NULL OR OBJECT_ID(N'paws.LeadershipAuthority062_SourceLink') IS NOT NULL
 THROW 54200,'062 refuses an existing or unknown command deployment.',1;
BEGIN TRANSACTION;
GO
CREATE TRIGGER paws.LeadershipAuthority062_SourceLink ON paws.TeachingLeadershipGrantSource AFTER INSERT,UPDATE,DELETE AS
BEGIN
 SET NOCOUNT ON;
 IF NOT EXISTS(SELECT 1 FROM inserted) AND NOT EXISTS(SELECT 1 FROM deleted) RETURN;
 UPDATE paws.LeadershipAccessState SET Enabled=Enabled WHERE SingletonId=1;
 IF @@ROWCOUNT<>1 THROW 54103,'Leadership authority state unavailable.',1;
END;
GO
CREATE PROCEDURE paws_api.GetTeachingLeadershipAccessSnapshot
 @ActorUid nvarchar(128),@TargetUid nvarchar(128),@AcademicYear nvarchar(32)
AS
BEGIN
 SET NOCOUNT ON;SET XACT_ABORT ON;
 IF @@TRANCOUNT<>0 OR @AcademicYear IS NULL OR LEN(@AcademicYear)<>7 OR @AcademicYear NOT LIKE '[1-9][0-9][0-9][0-9]-[0-9][0-9]'
 OR TRY_CONVERT(int,RIGHT(@AcademicYear,2))<>(TRY_CONVERT(int,LEFT(@AcademicYear,4))+1)%100 THROW 54107,'Canonical academic year required.',1;
 BEGIN TRY
  BEGIN TRANSACTION;
  IF NOT EXISTS(SELECT 1 FROM paws.UserProfile WITH(HOLDLOCK) WHERE FirebaseUid=@ActorUid AND Active=1 AND MustChangePassword=0 AND LOWER(LTRIM(RTRIM(BaseRole))) IN(N'owner',N'adfa_general')) THROW 54101,'Active Owner required.',1;
  DECLARE @Epoch varchar(16)=(SELECT LOWER(CONVERT(varchar(16),CONVERT(binary(8),AuthorityVersion),2)) FROM paws.LeadershipAccessState WITH(HOLDLOCK) WHERE SingletonId=1),@Faculty uniqueidentifier,@Target nvarchar(max),@Catalog nvarchar(max),@Sources nvarchar(max),@Assignments nvarchar(max),@Snapshot nvarchar(max);
  IF @Epoch IS NULL THROW 54103,'Authority state unavailable.',1;
  SELECT @Faculty=u.FacultyId FROM paws.UserProfile u WITH(HOLDLOCK) WHERE u.FirebaseUid=@TargetUid;
  SET @Target=(SELECT u.FirebaseUid firebaseUid,u.BaseRole baseRole,u.Active active,u.MustChangePassword mustChangePassword,
   CONVERT(varchar(36),u.FacultyId) facultyId,CAST(COALESCE(f.Active,0) AS bit) facultyActive,
   LOWER(CONVERT(varchar(16),CONVERT(binary(8),u.AccessVersion),2)) version
   FROM paws.UserProfile u LEFT JOIN paws.Faculty f ON f.FacultyId=u.FacultyId WHERE u.FirebaseUid=@TargetUid FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES);
  IF NULLIF(@Target,N'') IS NULL THROW 54102,'Target account unavailable.',1;
  SET @Catalog=(SELECT TOP(1001) r.ResponsibilityId responsibilityId,r.Kind kind,r.Active active,
   LOWER(CONVERT(varchar(64),HASHBYTES('SHA2_256',CONCAT(N'leadership062|',@Epoch,N'|',r.ResponsibilityId)),2)) definitionVersion,
   JSON_QUERY(CASE WHEN r.Kind=N'hicc' THEN (SELECT CONVERT(varchar(36),s.CourseId) courseId,c.CourseCode courseCode FROM paws.TeachingResponsibilityScope s JOIN paws.Course c ON c.CourseId=s.CourseId WHERE s.HiccResponsibilityId=r.ResponsibilityId AND s.SubjectId IS NULL ORDER BY s.CourseId FOR JSON PATH) ELSE N'[]' END) courses,
   JSON_QUERY(CASE WHEN r.Kind=N'visc' THEN (SELECT g.GroupId groupId,g.Name name FROM paws.TeachingAssignmentGroup g WHERE g.LeaderViscResponsibilityId=r.ResponsibilityId AND g.Active=1 ORDER BY g.GroupId FOR JSON PATH) ELSE N'[]' END) groups
   FROM paws.TeachingResponsibility r WHERE r.Active=1 AND NOT EXISTS(SELECT 1 FROM paws.TeachingResponsibilityScope partial WHERE partial.HiccResponsibilityId=r.ResponsibilityId AND partial.SubjectId IS NOT NULL)
   ORDER BY r.ResponsibilityId FOR JSON PATH);
  SET @Sources=(SELECT TOP(1001) CONVERT(varchar(36),r.RoleAssignmentId) sourceRoleAssignmentId,CONVERT(varchar(36),r.FacultyId) facultyId,r.AcademicYear academicYear,r.RoleType roleType,
   CONVERT(varchar(36),r.CourseId) courseId,r.CourseOrSubjectOrRotation recordedScope,CONVERT(varchar(10),r.EffectiveDate,23) effectiveDate,CONVERT(varchar(10),r.ExpirationDate,23) expirationDate,
   CAST(IIF(s.RoleAssignmentId IS NULL,0,1) AS bit) hasSchedule,s.PeriodsJson periodsJson,
   LOWER(CONVERT(varchar(16),CONVERT(binary(8),r.AuthorityVersion),2)) version,
   LOWER(CONVERT(varchar(16),CONVERT(binary(8),s.ScheduleVersion),2)) scheduleVersion,LOWER(paws_api.TeachingAppointmentAccessSourceStamp(r.RoleAssignmentId)) signature
   FROM paws.RoleAssignment r LEFT JOIN paws.RoleAppointmentSchedule s ON s.RoleAssignmentId=r.RoleAssignmentId
   WHERE r.FacultyId=@Faculty AND r.AcademicYear=@AcademicYear AND UPPER(LTRIM(RTRIM(r.RoleType))) IN(N'HICC',N'COURSE COORDINATOR',N'VISC') ORDER BY r.RoleAssignmentId FOR JSON PATH,INCLUDE_NULL_VALUES);
  SET @Assignments=(SELECT TOP(1001) CONVERT(varchar(36),a.ResponsibilityAssigneeId) assignmentId,a.ResponsibilityId responsibilityId,CONVERT(varchar(36),a.FacultyId) facultyId,a.AcademicYear academicYear,
   CONVERT(varchar(10),a.ActiveDate,23) startDate,CONVERT(varchar(10),a.ExpirationDate,23) endExclusive,
   LOWER(CONVERT(varchar(16),CONVERT(binary(8),a.AuthorityVersion),2)) version,CAST(IIF(s.ResponsibilityAssigneeId IS NULL,0,1) AS bit) managed
   FROM paws.TeachingResponsibilityAssignee a LEFT JOIN paws.TeachingLeadershipGrantSource s ON s.ResponsibilityAssigneeId=a.ResponsibilityAssigneeId
   WHERE a.AcademicYear=@AcademicYear ORDER BY a.ResponsibilityAssigneeId FOR JSON PATH);
  IF (SELECT COUNT(*) FROM OPENJSON(@Catalog))>1000 OR (SELECT COUNT(*) FROM OPENJSON(@Sources))>1000 OR (SELECT COUNT(*) FROM OPENJSON(@Assignments))>1000 THROW 54107,'Leadership snapshot exceeds its bounded limit.',1;
  SET @Snapshot=(SELECT JSON_QUERY(@Target) target,@Epoch authorityVersion,JSON_QUERY(@Catalog) catalog,JSON_QUERY(@Sources) sources,JSON_QUERY(@Assignments) assignments FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES);
  COMMIT;SELECT @Snapshot snapshotJson;
 END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK;THROW;END CATCH
END;
GO
CREATE PROCEDURE paws_api.GetTeachingLeadershipAccessOperation @ActorUid nvarchar(128),@OperationId uniqueidentifier
AS
BEGIN
 SET NOCOUNT ON;
 IF NOT EXISTS(SELECT 1 FROM paws.UserProfile WHERE FirebaseUid=@ActorUid AND Active=1 AND MustChangePassword=0 AND LOWER(LTRIM(RTRIM(BaseRole))) IN(N'owner',N'adfa_general')) THROW 54101,'Active Owner required.',1;
 SELECT ReceiptJson receiptJson FROM paws.LeadershipAccessOperation WHERE OperationId=@OperationId;
END;
GO
CREATE PROCEDURE paws_api.SetTeachingLeadershipAccess
 @ActorUid nvarchar(128),@ActorVersion varchar(16),@TargetUid nvarchar(128),@TargetVersion varchar(16),@AcademicYear nvarchar(32),@AuthorityVersion varchar(16),
 @ChangesJson nvarchar(max),@Reason nvarchar(1000),@IntentHash char(64),@OperationId uniqueidentifier,@PreviewId uniqueidentifier
AS
BEGIN
 -- PAWS_LEADERSHIP_COMMAND_062: account BaseRole and business appointments are never updated.
 SET NOCOUNT ON;SET XACT_ABORT ON;
 SET @Reason=LTRIM(RTRIM(@Reason));
 IF @@TRANCOUNT<>0 OR NULLIF(@ActorUid,N'') IS NULL OR NULLIF(@TargetUid,N'') IS NULL OR NULLIF(@Reason,N'') IS NULL OR @OperationId IS NULL OR @PreviewId IS NULL
 OR @AcademicYear IS NULL OR LEN(@AcademicYear)<>7 OR @AcademicYear NOT LIKE '[1-9][0-9][0-9][0-9]-[0-9][0-9]' OR TRY_CONVERT(int,RIGHT(@AcademicYear,2))<>(TRY_CONVERT(int,LEFT(@AcademicYear,4))+1)%100
 OR @ActorVersion IS NULL OR LEN(@ActorVersion)<>16 OR TRY_CONVERT(binary(8),@ActorVersion,2) IS NULL OR @TargetVersion IS NULL OR LEN(@TargetVersion)<>16 OR TRY_CONVERT(binary(8),@TargetVersion,2) IS NULL
 OR @AuthorityVersion IS NULL OR LEN(@AuthorityVersion)<>16 OR TRY_CONVERT(binary(8),@AuthorityVersion,2) IS NULL OR @IntentHash IS NULL OR LEN(@IntentHash)<>64 OR @IntentHash COLLATE Latin1_General_100_BIN2 LIKE '%[^a-fA-F0-9]%'
 OR @ChangesJson IS NULL OR DATALENGTH(@ChangesJson)>4194304 OR ISJSON(@ChangesJson)<>1 OR LEFT(LTRIM(@ChangesJson),1)<>N'[' OR RIGHT(RTRIM(@ChangesJson),1)<>N']' THROW 54107,'Invalid leadership change.',1;
 IF (SELECT COUNT(*) FROM OPENJSON(@ChangesJson)) NOT BETWEEN 1 AND 20 OR EXISTS(SELECT 1 FROM OPENJSON(@ChangesJson) WHERE type<>5) THROW 54107,'One to twenty object changes required.',1;
 IF EXISTS(SELECT 1 FROM OPENJSON(@ChangesJson) c CROSS APPLY OPENJSON(c.value) f GROUP BY c.[key],f.[key] COLLATE Latin1_General_100_BIN2 HAVING COUNT(*)>1)
 OR EXISTS(SELECT 1 FROM OPENJSON(@ChangesJson) c CROSS APPLY OPENJSON(c.value) f WHERE
  (JSON_VALUE(c.value,'$.action')=N'grant' AND f.[key] COLLATE Latin1_General_100_BIN2 NOT IN(N'action',N'responsibilityId',N'kind',N'definitionVersion',N'sourceRoleAssignmentId',N'sourceVersion',N'sourceScheduleVersion',N'sourceSignature',N'recordedScope',N'startDate',N'endExclusive',N'usesApprovedDefaultDates',N'assignmentMode',N'courses',N'groups')) OR
  (JSON_VALUE(c.value,'$.action')=N'revoke' AND f.[key] COLLATE Latin1_General_100_BIN2 NOT IN(N'action',N'assignmentId',N'expectedVersion',N'responsibilityId')))
 THROW 54107,'Unsupported or duplicate leadership fields.',1;
 DECLARE @Changes TABLE(n int PRIMARY KEY,Action nvarchar(10),ResponsibilityId nvarchar(64),AssignmentId uniqueidentifier,ExpectedVersion varchar(16),Kind nvarchar(16),DefinitionVersion varchar(64),SourceId uniqueidentifier,SourceVersion varchar(16),ScheduleVersion varchar(16),SourceSignature varchar(64),RecordedScope nvarchar(1000),StartDate date,EndExclusive date,DefaultDates bit,NewAssignee uniqueidentifier,RawJson nvarchar(max));
 INSERT @Changes SELECT TRY_CONVERT(int,j.[key]),JSON_VALUE(j.value,'$.action'),JSON_VALUE(j.value,'$.responsibilityId'),TRY_CONVERT(uniqueidentifier,JSON_VALUE(j.value,'$.assignmentId')),JSON_VALUE(j.value,'$.expectedVersion'),
 JSON_VALUE(j.value,'$.kind'),JSON_VALUE(j.value,'$.definitionVersion'),TRY_CONVERT(uniqueidentifier,JSON_VALUE(j.value,'$.sourceRoleAssignmentId')),JSON_VALUE(j.value,'$.sourceVersion'),JSON_VALUE(j.value,'$.sourceScheduleVersion'),JSON_VALUE(j.value,'$.sourceSignature'),
 JSON_VALUE(j.value,'$.recordedScope'),TRY_CONVERT(date,JSON_VALUE(j.value,'$.startDate'),23),TRY_CONVERT(date,JSON_VALUE(j.value,'$.endExclusive'),23),IIF(JSON_VALUE(j.value,'$.usesApprovedDefaultDates')=N'true',1,0),NEWID(),j.value FROM OPENJSON(@ChangesJson) j;
 IF EXISTS(SELECT 1 FROM @Changes WHERE Action IS NULL OR Action COLLATE Latin1_General_100_BIN2 NOT IN(N'grant',N'revoke') OR NULLIF(ResponsibilityId,N'') IS NULL OR LEN(JSON_VALUE(RawJson,'$.responsibilityId'))>64)
 OR EXISTS(SELECT 1 FROM @Changes WHERE Action=N'revoke' AND(AssignmentId IS NULL OR ExpectedVersion IS NULL OR LEN(JSON_VALUE(RawJson,'$.expectedVersion'))<>16 OR TRY_CONVERT(binary(8),ExpectedVersion,2) IS NULL))
 OR EXISTS(SELECT 1 FROM @Changes WHERE Action=N'grant' AND(SourceId IS NULL OR Kind IS NULL OR Kind NOT IN(N'hicc',N'visc') OR DefinitionVersion IS NULL OR LEN(JSON_VALUE(RawJson,'$.definitionVersion'))<>64 OR SourceVersion IS NULL OR LEN(JSON_VALUE(RawJson,'$.sourceVersion'))<>16 OR TRY_CONVERT(binary(8),SourceVersion,2) IS NULL
 OR SourceSignature IS NULL OR LEN(JSON_VALUE(RawJson,'$.sourceSignature'))<>64 OR NULLIF(LTRIM(RTRIM(RecordedScope)),N'') IS NULL OR LEN(JSON_VALUE(RawJson,'$.recordedScope'))>1000
 OR StartDate IS NULL OR EndExclusive IS NULL OR StartDate>=EndExclusive OR LEN(JSON_VALUE(RawJson,'$.startDate'))<>10 OR LEN(JSON_VALUE(RawJson,'$.endExclusive'))<>10 OR CONVERT(varchar(10),StartDate,23)<>JSON_VALUE(RawJson,'$.startDate') OR CONVERT(varchar(10),EndExclusive,23)<>JSON_VALUE(RawJson,'$.endExclusive')
 OR StartDate<TRY_CONVERT(date,LEFT(@AcademicYear,4)+N'-05-01') OR EndExclusive>DATEADD(year,1,TRY_CONVERT(date,LEFT(@AcademicYear,4)+N'-05-01'))
 OR ISNULL(JSON_VALUE(RawJson,'$.assignmentMode'),N'')<>N'exclusive' OR NOT EXISTS(SELECT 1 FROM OPENJSON(RawJson) WHERE [key]=N'usesApprovedDefaultDates' AND type=3)))
 OR EXISTS(SELECT 1 FROM @Changes WHERE Action=N'grant' GROUP BY ResponsibilityId HAVING COUNT(*)>1)
 OR EXISTS(SELECT 1 FROM @Changes WHERE Action=N'revoke' GROUP BY AssignmentId HAVING COUNT(*)>1)
 THROW 54107,'Invalid or duplicate canonical leadership changes.',1;
 BEGIN TRY
  BEGIN TRANSACTION;
  DECLARE @Lock int;EXEC @Lock=sys.sp_getapplock @Resource=N'paws-leadership-access-062',@LockMode=N'Exclusive',@LockOwner=N'Transaction',@LockTimeout=5000;
  IF @Lock<0 THROW 54103,'Another authority change is running.',1;
  DECLARE @ActorCurrent binary(8),@ActorName nvarchar(260);
  SELECT @ActorCurrent=AccessVersion,@ActorName=DisplayName FROM paws.UserProfile WITH(UPDLOCK,HOLDLOCK) WHERE FirebaseUid=@ActorUid AND Active=1 AND MustChangePassword=0 AND LOWER(LTRIM(RTRIM(BaseRole))) IN(N'owner',N'adfa_general');
  IF @ActorCurrent IS NULL THROW 54101,'Active Owner required.',1;
  DECLARE @Existing nvarchar(max),@ExistingActor nvarchar(128),@ExistingTarget nvarchar(128),@ExistingPreview uniqueidentifier,@ExistingHash char(64);
  SELECT @Existing=ReceiptJson,@ExistingActor=ActorUid,@ExistingTarget=TargetUid,@ExistingPreview=PreviewId,@ExistingHash=IntentHash FROM paws.LeadershipAccessOperation WITH(UPDLOCK,HOLDLOCK) WHERE OperationId=@OperationId;
  IF @Existing IS NOT NULL BEGIN
   IF @ExistingActor<>@ActorUid OR @ExistingTarget<>@TargetUid OR @ExistingPreview<>@PreviewId OR @ExistingHash<>@IntentHash THROW 54108,'Operation identifier has another intent.',1;
   COMMIT;SELECT @Existing receiptJson;RETURN;
  END;
  IF @ActorCurrent<>CONVERT(binary(8),@ActorVersion,2) THROW 54101,'Owner authority changed.',1;
  DECLARE @Faculty uniqueidentifier,@TargetRole nvarchar(128),@TargetCurrent binary(8),@Ready bit;
  SELECT @Faculty=u.FacultyId,@TargetRole=LOWER(LTRIM(RTRIM(u.BaseRole))),@TargetCurrent=u.AccessVersion,@Ready=IIF(u.Active=1 AND u.MustChangePassword=0 AND f.Active=1,1,0)
   FROM paws.UserProfile u WITH(UPDLOCK,HOLDLOCK) LEFT JOIN paws.Faculty f WITH(HOLDLOCK) ON f.FacultyId=u.FacultyId WHERE u.FirebaseUid=@TargetUid;
  IF @TargetRole=N'developer' THROW 54106,'Developer account is protected.',1;
  IF @Ready IS NULL OR @Ready<>1 OR @Faculty IS NULL OR @TargetRole NOT IN(N'faculty',N'hicc',N'visc') OR @TargetCurrent<>CONVERT(binary(8),@TargetVersion,2) THROW 54102,'Target authority changed or is ineligible.',1;
  DECLARE @Epoch varchar(16)=(SELECT LOWER(CONVERT(varchar(16),CONVERT(binary(8),AuthorityVersion),2)) FROM paws.LeadershipAccessState WITH(UPDLOCK,HOLDLOCK) WHERE SingletonId=1);
  IF @Epoch IS NULL OR @Epoch<>LOWER(@AuthorityVersion) THROW 54103,'Authority changed after preview.',1;
  IF EXISTS(SELECT 1 FROM @Changes c WHERE c.Action=N'revoke' AND NOT EXISTS(SELECT 1 FROM paws.TeachingResponsibilityAssignee a WITH(UPDLOCK,HOLDLOCK) JOIN paws.TeachingLeadershipGrantSource s WITH(UPDLOCK,HOLDLOCK) ON s.ResponsibilityAssigneeId=a.ResponsibilityAssigneeId WHERE a.ResponsibilityAssigneeId=c.AssignmentId AND a.FacultyId=@Faculty AND a.AcademicYear=@AcademicYear AND a.ResponsibilityId=c.ResponsibilityId AND a.AuthorityVersion=CONVERT(binary(8),c.ExpectedVersion,2))) THROW 54109,'Exact managed assignee changed.',1;
  IF EXISTS(SELECT 1 FROM @Changes c JOIN paws.TeachingResponsibilityAssignee a WITH(UPDLOCK,HOLDLOCK) ON a.ResponsibilityId=c.ResponsibilityId AND a.AcademicYear=@AcademicYear AND a.ActiveDate<c.EndExclusive AND c.StartDate<a.ExpirationDate
   WHERE c.Action=N'grant' AND NOT EXISTS(SELECT 1 FROM @Changes removed WHERE removed.Action=N'revoke' AND removed.AssignmentId=a.ResponsibilityAssigneeId)) THROW 54105,'Responsibility already has an overlapping assignee.',1;
  DECLARE @N int,@Responsibility nvarchar(64),@Kind nvarchar(16),@Source uniqueidentifier,@SourceStart date,@SourceEnd date,@HasSchedule bit,@Schedule nvarchar(max),@Default bit,@Start date,@End date,@Raw nvarchar(max),@Date date;
  DECLARE @Periods TABLE(n int,StartDate date,EndDate date,RawStart nvarchar(40),RawEnd nvarchar(40),Kind int);
  DECLARE grants_cursor CURSOR LOCAL FAST_FORWARD FOR SELECT n,ResponsibilityId,Kind,SourceId,DefaultDates,StartDate,EndExclusive,RawJson FROM @Changes WHERE Action=N'grant' ORDER BY n;
  OPEN grants_cursor;FETCH NEXT FROM grants_cursor INTO @N,@Responsibility,@Kind,@Source,@Default,@Start,@End,@Raw;
  WHILE @@FETCH_STATUS=0
  BEGIN
   IF NOT EXISTS(SELECT 1 FROM paws.TeachingResponsibility WITH(UPDLOCK,HOLDLOCK) WHERE ResponsibilityId=@Responsibility AND Kind=@Kind AND Active=1)
    OR LOWER(JSON_VALUE(@Raw,'$.definitionVersion'))<>LOWER(CONVERT(varchar(64),HASHBYTES('SHA2_256',CONCAT(N'leadership062|',@Epoch,N'|',@Responsibility)),2))
    OR EXISTS(SELECT 1 FROM paws.TeachingResponsibilityScope WHERE HiccResponsibilityId=@Responsibility AND SubjectId IS NOT NULL) THROW 54104,'Canonical definition changed or requires subject-level review.',1;
   IF JSON_QUERY(@Raw,'$.courses') IS NULL OR LEFT(JSON_QUERY(@Raw,'$.courses'),1)<>N'[' OR JSON_QUERY(@Raw,'$.groups') IS NULL OR LEFT(JSON_QUERY(@Raw,'$.groups'),1)<>N'['
    OR (SELECT COUNT(*) FROM OPENJSON(@Raw,'$.courses'))>200 OR (SELECT COUNT(*) FROM OPENJSON(@Raw,'$.groups'))>200 THROW 54104,'Canonical scope arrays required.',1;
   IF @Kind=N'hicc' BEGIN
    IF (SELECT COUNT(*) FROM OPENJSON(@Raw,'$.groups'))<>0 OR (SELECT COUNT(*) FROM OPENJSON(@Raw,'$.courses'))=0
     OR EXISTS(SELECT TRY_CONVERT(uniqueidentifier,JSON_VALUE(value,'$.courseId')),JSON_VALUE(value,'$.courseCode') FROM OPENJSON(@Raw,'$.courses') EXCEPT SELECT s.CourseId,c.CourseCode FROM paws.TeachingResponsibilityScope s JOIN paws.Course c ON c.CourseId=s.CourseId WHERE s.HiccResponsibilityId=@Responsibility)
     OR EXISTS(SELECT s.CourseId,c.CourseCode FROM paws.TeachingResponsibilityScope s JOIN paws.Course c ON c.CourseId=s.CourseId WHERE s.HiccResponsibilityId=@Responsibility EXCEPT SELECT TRY_CONVERT(uniqueidentifier,JSON_VALUE(value,'$.courseId')),JSON_VALUE(value,'$.courseCode') FROM OPENJSON(@Raw,'$.courses')) THROW 54104,'Exact canonical course scope required.',1;
   END ELSE BEGIN
    IF (SELECT COUNT(*) FROM OPENJSON(@Raw,'$.courses'))<>0 OR (SELECT COUNT(*) FROM OPENJSON(@Raw,'$.groups'))=0
     OR EXISTS(SELECT JSON_VALUE(value,'$.groupId'),JSON_VALUE(value,'$.name') FROM OPENJSON(@Raw,'$.groups') EXCEPT SELECT GroupId,Name FROM paws.TeachingAssignmentGroup WHERE LeaderViscResponsibilityId=@Responsibility AND Active=1)
     OR EXISTS(SELECT GroupId,Name FROM paws.TeachingAssignmentGroup WHERE LeaderViscResponsibilityId=@Responsibility AND Active=1 EXCEPT SELECT JSON_VALUE(value,'$.groupId'),JSON_VALUE(value,'$.name') FROM OPENJSON(@Raw,'$.groups')) THROW 54104,'Exact canonical area scope required.',1;
   END;
   SET @HasSchedule=NULL;SET @Schedule=NULL;SET @SourceStart=NULL;SET @SourceEnd=NULL;
   SELECT @SourceStart=r.EffectiveDate,@SourceEnd=r.ExpirationDate,@HasSchedule=IIF(s.RoleAssignmentId IS NULL,0,1),@Schedule=s.PeriodsJson
    FROM paws.RoleAssignment r WITH(UPDLOCK,HOLDLOCK) LEFT JOIN paws.RoleAppointmentSchedule s WITH(UPDLOCK,HOLDLOCK) ON s.RoleAssignmentId=r.RoleAssignmentId
    WHERE r.RoleAssignmentId=@Source AND r.FacultyId=@Faculty AND r.AcademicYear=@AcademicYear
     AND ((@Kind=N'hicc' AND UPPER(LTRIM(RTRIM(r.RoleType))) IN(N'HICC',N'COURSE COORDINATOR')) OR (@Kind=N'visc' AND UPPER(LTRIM(RTRIM(r.RoleType)))=N'VISC'))
     AND LOWER(CONVERT(varchar(16),CONVERT(binary(8),r.AuthorityVersion),2))=LOWER(JSON_VALUE(@Raw,'$.sourceVersion'))
     AND ((s.RoleAssignmentId IS NULL AND JSON_VALUE(@Raw,'$.sourceScheduleVersion') IS NULL) OR LOWER(CONVERT(varchar(16),CONVERT(binary(8),s.ScheduleVersion),2))=LOWER(JSON_VALUE(@Raw,'$.sourceScheduleVersion')))
     AND LOWER(paws_api.TeachingAppointmentAccessSourceStamp(r.RoleAssignmentId))=LOWER(JSON_VALUE(@Raw,'$.sourceSignature'))
     AND LTRIM(RTRIM(r.CourseOrSubjectOrRotation))=JSON_VALUE(@Raw,'$.recordedScope')
     AND (r.CourseId IS NULL OR (@Kind=N'hicc' AND (SELECT COUNT(*) FROM paws.TeachingResponsibilityScope WHERE HiccResponsibilityId=@Responsibility)=1 AND EXISTS(SELECT 1 FROM paws.TeachingResponsibilityScope WHERE HiccResponsibilityId=@Responsibility AND CourseId=r.CourseId)));
   IF @HasSchedule IS NULL THROW 54104,'Appointment evidence changed.',1;
   IF @Default=1 BEGIN
    IF @HasSchedule=1 OR @SourceStart IS NOT NULL OR @SourceEnd IS NOT NULL OR @Start<>TRY_CONVERT(date,LEFT(@AcademicYear,4)+N'-05-01') OR @End<>DATEADD(year,1,TRY_CONVERT(date,LEFT(@AcademicYear,4)+N'-05-01')) THROW 54104,'Default provenance does not match an undated full-year source.',1;
   END ELSE BEGIN
    DELETE @Periods;
    IF @HasSchedule=1 BEGIN
     IF ISJSON(@Schedule)<>1 OR LEFT(LTRIM(@Schedule),1)<>N'[' THROW 54104,'Source schedule is invalid.',1;
     INSERT @Periods SELECT TRY_CONVERT(int,j.[key]),TRY_CONVERT(date,JSON_VALUE(j.value,'$.startDate'),23),TRY_CONVERT(date,JSON_VALUE(j.value,'$.endDate'),23),JSON_VALUE(j.value,'$.startDate'),JSON_VALUE(j.value,'$.endDate'),j.type FROM OPENJSON(@Schedule) j;
     IF (SELECT COUNT(*) FROM @Periods) NOT BETWEEN 1 AND 12 OR EXISTS(SELECT 1 FROM @Periods WHERE Kind<>5 OR StartDate IS NULL OR LEN(RawStart)<>10 OR CONVERT(varchar(10),StartDate,23)<>RawStart OR (RawEnd IS NOT NULL AND(EndDate IS NULL OR LEN(RawEnd)<>10 OR CONVERT(varchar(10),EndDate,23)<>RawEnd)) OR EndDate<StartDate) THROW 54104,'Source schedule dates require review.',1;
    END ELSE BEGIN
     IF @SourceStart IS NULL THROW 54104,'Recorded source dates required.',1;
     INSERT @Periods VALUES(0,@SourceStart,@SourceEnd,CONVERT(varchar(10),@SourceStart,23),CONVERT(varchar(10),@SourceEnd,23),5);
    END;
    IF EXISTS(SELECT 1 FROM @Periods a JOIN @Periods b ON a.n<b.n WHERE a.StartDate<=COALESCE(b.EndDate,'99991231') AND b.StartDate<=COALESCE(a.EndDate,'99991231')) THROW 54104,'Overlapping source schedule requires review.',1;
    SET @Date=@Start;
    WHILE @Date<@End BEGIN
     IF NOT EXISTS(SELECT 1 FROM @Periods WHERE StartDate<=@Date AND(EndDate IS NULL OR @Date<=EndDate)) THROW 54104,'Requested dates cross an uncovered source period.',1;
     SET @Date=DATEADD(day,1,@Date);
    END;
   END;
   FETCH NEXT FROM grants_cursor INTO @N,@Responsibility,@Kind,@Source,@Default,@Start,@End,@Raw;
  END;
  CLOSE grants_cursor;DEALLOCATE grants_cursor;
  DECLARE @Before nvarchar(max)=(SELECT CONVERT(varchar(36),a.ResponsibilityAssigneeId) assignmentId,a.ResponsibilityId responsibilityId,CONVERT(varchar(10),a.ActiveDate,23) startDate,CONVERT(varchar(10),a.ExpirationDate,23) endExclusive,
   CONVERT(varchar(36),s.SourceRoleAssignmentId) sourceRoleAssignmentId,s.UsesApprovedDefaultDates usesApprovedDefaultDates,
   CONVERT(varchar(36),a.FacultyId) facultyId,a.AcademicYear academicYear,a.AssignmentMode assignmentMode,
   s.ApprovedSourceSignature approvedSourceSignature,s.ApprovedScopeSignature approvedScopeSignature,s.ApprovedAssigneeSignature approvedAssigneeSignature,CONVERT(varchar(36),s.OperationId) grantOperationId
   FROM paws.TeachingResponsibilityAssignee a JOIN paws.TeachingLeadershipGrantSource s ON s.ResponsibilityAssigneeId=a.ResponsibilityAssigneeId WHERE a.FacultyId=@Faculty AND a.AcademicYear=@AcademicYear ORDER BY a.ResponsibilityAssigneeId FOR JSON PATH),@After nvarchar(max),@Receipt nvarchar(max),@Now datetime2(7)=SYSUTCDATETIME();
  INSERT paws.LeadershipAccessOperation(OperationId,PreviewId,ActorUid,TargetUid,AcademicYear,IntentHash,Reason,ReceiptJson,CreatedAtUtc) VALUES(@OperationId,@PreviewId,@ActorUid,@TargetUid,@AcademicYear,@IntentHash,@Reason,N'{}',@Now);
  DELETE s FROM paws.TeachingLeadershipGrantSource s JOIN @Changes c ON c.AssignmentId=s.ResponsibilityAssigneeId WHERE c.Action=N'revoke';
  DELETE a FROM paws.TeachingResponsibilityAssignee a JOIN @Changes c ON c.AssignmentId=a.ResponsibilityAssigneeId WHERE c.Action=N'revoke';
  INSERT paws.TeachingResponsibilityAssignee(ResponsibilityAssigneeId,ResponsibilityId,AcademicYear,FacultyId,ActiveDate,ExpirationDate,AssignmentMode)
   SELECT NewAssignee,ResponsibilityId,@AcademicYear,@Faculty,StartDate,EndExclusive,N'exclusive' FROM @Changes WHERE Action=N'grant';
  INSERT paws.TeachingLeadershipGrantSource(ResponsibilityAssigneeId,SourceRoleAssignmentId,ApprovedSourceSignature,ApprovedScopeSignature,ApprovedAssigneeSignature,UsesApprovedDefaultDates,OperationId)
   SELECT NewAssignee,SourceId,SourceSignature,paws_api.TeachingResponsibilityAccessScopeStamp(ResponsibilityId),paws_api.TeachingAssigneeAccessStamp(NewAssignee),DefaultDates,@OperationId FROM @Changes WHERE Action=N'grant';
  SET @After=(SELECT CONVERT(varchar(36),a.ResponsibilityAssigneeId) assignmentId,a.ResponsibilityId responsibilityId,CONVERT(varchar(10),a.ActiveDate,23) startDate,CONVERT(varchar(10),a.ExpirationDate,23) endExclusive,
   CONVERT(varchar(36),s.SourceRoleAssignmentId) sourceRoleAssignmentId,s.UsesApprovedDefaultDates usesApprovedDefaultDates,
   CONVERT(varchar(36),a.FacultyId) facultyId,a.AcademicYear academicYear,a.AssignmentMode assignmentMode,
   s.ApprovedSourceSignature approvedSourceSignature,s.ApprovedScopeSignature approvedScopeSignature,s.ApprovedAssigneeSignature approvedAssigneeSignature,CONVERT(varchar(36),s.OperationId) grantOperationId
   FROM paws.TeachingResponsibilityAssignee a JOIN paws.TeachingLeadershipGrantSource s ON s.ResponsibilityAssigneeId=a.ResponsibilityAssigneeId WHERE a.FacultyId=@Faculty AND a.AcademicYear=@AcademicYear ORDER BY a.ResponsibilityAssigneeId FOR JSON PATH);
  SET @Receipt=(SELECT CONVERT(varchar(36),@OperationId) operationId,CONVERT(varchar(36),@PreviewId) previewId,@ActorUid actorUid,@TargetUid targetUid,@AcademicYear academicYear,@Reason reason,
   (SELECT authorityVersion FROM paws_api.TeachingAuthorityState()) savedAuthorityVersion,@Now createdAtUtc,JSON_QUERY(@Before) before,JSON_QUERY(@After) after,JSON_QUERY(@ChangesJson) changes FOR JSON PATH,WITHOUT_ARRAY_WRAPPER);
  UPDATE paws.LeadershipAccessOperation SET ReceiptJson=@Receipt WHERE OperationId=@OperationId;
  INSERT paws.AuditEvent(AuditEventId,EventType,EntityType,EntityId,ActorFirebaseUid,ActorName,OccurredAtUtc,BeforeJson,AfterJson,MetadataJson,RequestId)
   VALUES(NEWID(),N'leadership_access_change',N'account_leadership_access',@TargetUid,@ActorUid,@ActorName,@Now,@Before,@After,(SELECT @AcademicYear academicYear,@Reason reason,CONVERT(varchar(36),@PreviewId) previewId FOR JSON PATH,WITHOUT_ARRAY_WRAPPER),@OperationId);
  COMMIT;SELECT @Receipt receiptJson;
 END TRY BEGIN CATCH IF CURSOR_STATUS('local','grants_cursor')>=0 CLOSE grants_cursor;IF CURSOR_STATUS('local','grants_cursor')>=-1 DEALLOCATE grants_cursor;IF @@TRANCOUNT>0 ROLLBACK;THROW;END CATCH
END;
GO
GRANT EXECUTE ON OBJECT::paws_api.GetTeachingLeadershipAccessSnapshot TO paws_runtime_account_access;
GRANT EXECUTE ON OBJECT::paws_api.GetTeachingLeadershipAccessOperation TO paws_runtime_account_access;
GRANT EXECUTE ON OBJECT::paws_api.SetTeachingLeadershipAccess TO paws_runtime_account_access;
COMMIT;
