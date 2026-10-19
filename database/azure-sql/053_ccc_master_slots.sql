/* Preserve legacy assigned activities; add only source-backed CCC staffing slots. */
:ON ERROR EXIT
SET NOCOUNT ON;SET XACT_ABORT ON;
SET ANSI_NULLS ON;SET QUOTED_IDENTIFIER ON;
IF DB_NAME()<>N'VetMed-Ops' OR OBJECT_ID(N'paws.MasterRefreshReceipt') IS NULL OR OBJECT_ID(N'paws.CccReplacementReceipt') IS NULL THROW 55300,'Accepted MASTER and CCC foundations required.',1;
IF COL_LENGTH(N'paws.CalendarActivity',N'StaffingKind') IS NOT NULL OR OBJECT_ID(N'staging.MasterCccSchemaBaseline') IS NOT NULL THROW 55300,'Inspect existing CCC slot upgrade.',1;
BEGIN TRANSACTION;
CREATE TABLE staging.MasterCccSchemaBaseline(ObjectName nvarchar(260) NOT NULL PRIMARY KEY,ObjectKind nvarchar(16) NOT NULL,BeforeDefinition nvarchar(max) NOT NULL,AfterSha256 char(64) NULL);
INSERT staging.MasterCccSchemaBaseline(ObjectName,ObjectKind,BeforeDefinition)
SELECT name,N'PROCEDURE',OBJECT_DEFINITION(OBJECT_ID(N'paws_api.'+name)) FROM(VALUES(N'ListCalendarActivities'),(N'ResolveCalendarActivityDayTime'),(N'LockCccReplacementScope'),(N'RecoverCccReplacement')) names(name)
UNION ALL SELECT N'CccScopeSnapshot',N'FUNCTION',OBJECT_DEFINITION(OBJECT_ID(N'paws_api.CccScopeSnapshot'));
ALTER TABLE paws.CalendarActivity ADD StaffingKind nvarchar(16) NOT NULL CONSTRAINT DF_CalendarActivity_StaffingKind DEFAULT N'assigned' WITH VALUES,
 StaffingLabel nvarchar(32) NULL,BlockLabel nvarchar(1000) NULL,SourceColumn nvarchar(4) NULL,SourceSlotKey nvarchar(320) NULL;
GO
ALTER TABLE paws.CalendarActivity ALTER COLUMN FacultyId uniqueidentifier NULL;
ALTER TABLE paws.CalendarActivity ADD CONSTRAINT CK_CalendarActivity_Staffing CHECK(
 (StaffingKind COLLATE Latin1_General_100_BIN2=N'assigned' AND FacultyId IS NOT NULL AND StaffingLabel IS NULL)
 OR(Category=N'ccc' AND StaffingKind COLLATE Latin1_General_100_BIN2=N'unassigned' AND FacultyId IS NULL AND StaffingLabel IS NOT NULL AND StaffingLabel COLLATE Latin1_General_100_BIN2=N'Locum' AND SourceColumn IS NOT NULL));
ALTER TABLE paws.CalendarActivity ADD CONSTRAINT CK_CalendarActivity_SourceSlot CHECK(
 (SourceColumn IS NULL AND SourceSlotKey IS NULL) OR
 (Category=N'ccc' AND SourceColumn IS NOT NULL AND SourceColumn COLLATE Latin1_General_100_BIN2 IN(N'C',N'D',N'E') AND SourceSlotKey IS NOT NULL AND SourceSlotKey COLLATE Latin1_General_100_BIN2=CONCAT(SourceSheet,N'!',SourceColumn,SourceRow) COLLATE Latin1_General_100_BIN2));
ALTER TABLE paws.CalendarActivity DROP CONSTRAINT UQ_CalendarActivity_Source;
ALTER TABLE paws.CalendarActivity ADD CONSTRAINT UQ_CalendarActivity_Source UNIQUE(SourceSha256,SourceSheet,SourceRow,SourceColumn);
GO
CREATE PROCEDURE paws_api.AcquireCccCalendarYearLock @Date date
WITH EXECUTE AS OWNER
AS
BEGIN
 SET NOCOUNT ON;
 IF @@TRANCOUNT=0 OR @Date IS NULL THROW 55309,'CCC transaction/date required.',1;
 DECLARE @Year int=YEAR(@Date)-IIF(MONTH(@Date)<5,1,0),@Result int,@Resource nvarchar(255);
 SET @Resource=CONCAT(N'paws:ccc-replacement:',@Year,N'-',RIGHT(CONVERT(varchar(4),@Year+1),2));
 EXEC @Result=sys.sp_getapplock @Resource=@Resource,@LockMode=N'Exclusive',@LockOwner=N'Transaction',@LockTimeout=5000,@DbPrincipal=N'dbo';
 IF @Result<0 THROW 55309,'CCC year is busy.',1;
END;
GO
CREATE TRIGGER paws.ValidateMasterCccIdentity ON paws.CalendarActivity AFTER INSERT,UPDATE AS
BEGIN
 SET NOCOUNT ON;
 -- Current identities are required for new MASTER source slots. Legacy
 -- historical rows retain their original faculty and recovery provenance.
 IF EXISTS(SELECT 1 FROM inserted i LEFT JOIN deleted d ON d.ActivityId=i.ActivityId
  WHERE i.SourceColumn IS NOT NULL AND i.StaffingKind=N'assigned'
  AND(d.ActivityId IS NULL OR d.FacultyId IS NULL OR d.FacultyId<>i.FacultyId)
  AND NOT EXISTS(SELECT 1 FROM paws.Faculty f WITH(UPDLOCK,HOLDLOCK) WHERE f.FacultyId=i.FacultyId AND f.Active=1)) THROW 55306,'Active faculty required for MASTER staffing.',1;
END;
GO
ALTER PROCEDURE paws_api.ListCalendarActivities
 @ActorFirebaseUid nvarchar(128),@StartDate date,@EndExclusive date,@FacultyKey uniqueidentifier=NULL,@Category nvarchar(64)=NULL,@Cursor nvarchar(64)=NULL,@Limit int=100,@IncludeFacultyKeys bit=0
AS
BEGIN
 SET NOCOUNT ON;
 DECLARE @Role nvarchar(128),@OwnFaculty uniqueidentifier,@FilterFaculty uniqueidentifier,@AfterDate date,@AfterId uniqueidentifier;
 SELECT @Role=LOWER(LTRIM(RTRIM(BaseRole))),@OwnFaculty=FacultyId FROM paws.UserProfile WHERE FirebaseUid=@ActorFirebaseUid AND Active=1 AND MustChangePassword=0;
 IF @Role IS NULL OR @Role NOT IN(N'developer',N'owner',N'administrator',N'admin',N'adfa_general',N'adfa_regular',N'adc',N'lab',N'faculty',N'hicc',N'visc')
  OR (@Role IN(N'faculty',N'hicc',N'visc') AND @OwnFaculty IS NULL) THROW 53801,'Timetable authorization is required.',1;
 IF @IncludeFacultyKeys=1 AND paws_api.CalendarActivityAdmin(@ActorFirebaseUid)<>1 THROW 53801,'Administrator key mapping permission is required.',1;
 IF @IncludeFacultyKeys=1 AND (SELECT COUNT(*) FROM paws.SwapCandidate c JOIN paws.Faculty f ON f.FacultyId=c.FacultyId WHERE f.Active=1)>500 THROW 53802,'Faculty key mapping exceeds its bounded scope.',1;
 IF @StartDate IS NULL OR @EndExclusive IS NULL OR @EndExclusive<=@StartDate OR DATEDIFF(day,@StartDate,@EndExclusive)>550 OR @Limit NOT BETWEEN 1 AND 100
  OR (@Category IS NOT NULL AND @Category NOT IN(N'ccc',N'rotation_participant',N'clinical_day',N'vetm581_rounds',N'vetm571_clinical_pharmacology',N'vetm591_presentations',N'teaching_excellence',N'remote_work'))
  THROW 53802,'A bounded valid activity range is required.',1;
 IF @FacultyKey IS NOT NULL
 BEGIN
  SELECT @FilterFaculty=FacultyId FROM paws.SwapCandidate WHERE CandidateKey=@FacultyKey;
  IF @FilterFaculty IS NULL THROW 53803,'Faculty key was not found.',1;
 END;
 IF @Role IN(N'faculty',N'hicc',N'visc')
 BEGIN
  IF @FilterFaculty IS NOT NULL AND @FilterFaculty<>@OwnFaculty THROW 53801,'Only your own activity scope is available.',1;
  SET @FilterFaculty=@OwnFaculty;
 END;
 IF @Cursor IS NOT NULL
 BEGIN
  IF LEN(@Cursor)<>47 OR SUBSTRING(@Cursor,11,1)<>N'|' THROW 53802,'Activity cursor is invalid.',1;
  SET @AfterDate=TRY_CONVERT(date,LEFT(@Cursor,10),23);SET @AfterId=TRY_CONVERT(uniqueidentifier,SUBSTRING(@Cursor,12,36));
  IF @AfterDate IS NULL OR @AfterId IS NULL THROW 53802,'Activity cursor is invalid.',1;
 END;
 DECLARE @Page TABLE(ActivityId uniqueidentifier,StartDate date);
 INSERT @Page SELECT TOP(@Limit+1) a.ActivityId,a.StartDate FROM paws.CalendarActivity a LEFT JOIN paws.Faculty f ON f.FacultyId=a.FacultyId
  WHERE (f.Active=1 OR a.StaffingKind=N'unassigned') AND a.StartDate<@EndExclusive AND a.EndDate>=@StartDate AND (@FilterFaculty IS NULL OR a.FacultyId=@FilterFaculty)
   AND (@Category IS NULL OR a.Category=@Category) AND (@AfterDate IS NULL OR a.StartDate>@AfterDate OR a.StartDate=@AfterDate AND a.ActivityId>@AfterId)
  ORDER BY a.StartDate,a.ActivityId;
 DECLARE @HasMore bit=IIF((SELECT COUNT(*) FROM @Page)>@Limit,1,0),@LastDate date,@LastId uniqueidentifier;
 IF @HasMore=1 DELETE @Page WHERE ActivityId=(SELECT TOP(1) ActivityId FROM @Page ORDER BY StartDate DESC,ActivityId DESC);
 SELECT TOP(1) @LastDate=StartDate,@LastId=ActivityId FROM @Page ORDER BY StartDate DESC,ActivityId DESC;
 SELECT (SELECT JSON_QUERY(COALESCE((SELECT a.ActivityId activityId,c.CandidateKey facultyKey,
    COALESCE(NULLIF(LTRIM(RTRIM(CONCAT(f.PreferredFirstName,N' ',f.PreferredLastName))),N''),f.DisplayName,CASE WHEN a.StaffingKind=N'unassigned' THEN N'Locum' END) facultyDisplayName,
    a.StaffingKind staffingKind,a.StaffingLabel staffingLabel,a.BlockLabel blockLabel,
    a.Category category,a.OriginalLabel label,a.StartDate startDate,a.EndDate endDate,course.CourseCode courseCode,
    CASE WHEN times.TimeCount=0 THEN N'not_provided' WHEN times.TimeCount=DATEDIFF(day,a.StartDate,a.EndDate)+1 THEN N'verified' ELSE N'partial' END timeStatus,
    CONVERT(varchar(16),CONVERT(binary(8),a.ActivityVersion),2) version,
    JSON_QUERY((SELECT t.ActivityDate date,CONVERT(char(5),t.StartTime,108) startTime,CONVERT(char(5),t.EndTime,108) endTime
      FROM paws.CalendarActivityDayTime t WHERE t.ActivityId=a.ActivityId ORDER BY t.ActivityDate FOR JSON PATH)) timeEvidence
    FROM @Page page JOIN paws.CalendarActivity a ON a.ActivityId=page.ActivityId LEFT JOIN paws.Faculty f ON f.FacultyId=a.FacultyId
    LEFT JOIN paws.SwapCandidate c ON c.FacultyId=a.FacultyId LEFT JOIN paws.Course course ON course.CourseId=a.CourseId
    OUTER APPLY(SELECT COUNT(*) TimeCount FROM paws.CalendarActivityDayTime t WHERE t.ActivityId=a.ActivityId) times
    ORDER BY a.StartDate,a.ActivityId FOR JSON PATH,INCLUDE_NULL_VALUES),N'[]')) activities,
    CASE WHEN @HasMore=1 THEN CONCAT(CONVERT(char(10),@LastDate,23),N'|',CONVERT(char(36),@LastId)) END nextCursor,
    JSON_QUERY(CASE WHEN @IncludeFacultyKeys=1 THEN (SELECT f.FacultyId facultyId,c.CandidateKey facultyKey FROM paws.SwapCandidate c JOIN paws.Faculty f ON f.FacultyId=c.FacultyId AND f.Active=1 ORDER BY f.FacultyId FOR JSON PATH) END) facultyKeys
    FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES) responseJson;
END;
GO
ALTER PROCEDURE paws_api.ResolveCalendarActivityDayTime
 @ActorFirebaseUid nvarchar(128),@ActivityId uniqueidentifier,@ExpectedVersion varchar(64),@ActivityDate date,
 @StartTime time(0),@EndTime time(0),@EvidenceRef nvarchar(512),@EvidenceNote nvarchar(1000)
AS
BEGIN
 SET NOCOUNT ON;SET XACT_ABORT ON;
 IF paws_api.CalendarActivityAdmin(@ActorFirebaseUid)<>1 THROW 53801,'Administrator permission is required.',1;
 IF @ActivityDate IS NULL OR @StartTime IS NULL OR @EndTime IS NULL OR @StartTime>=@EndTime
  OR DATEPART(second,@StartTime)<>0 OR DATEPART(second,@EndTime)<>0 OR LEN(LTRIM(RTRIM(COALESCE(@EvidenceRef,N''))))=0
  OR LEN(LTRIM(RTRIM(COALESCE(@EvidenceNote,N''))))=0 THROW 53802,'Verified date, times and evidence are required.',1;
 BEGIN TRY
  BEGIN TRANSACTION;
  DECLARE @Faculty uniqueidentifier=(SELECT FacultyId FROM paws.CalendarActivity WHERE ActivityId=@ActivityId);
  IF NOT EXISTS(SELECT 1 FROM paws.CalendarActivity WHERE ActivityId=@ActivityId) THROW 53803,'Activity was not found.',1;
  IF EXISTS(SELECT 1 FROM paws.CalendarActivity WHERE ActivityId=@ActivityId AND Category=N'ccc') EXEC paws_api.AcquireCccCalendarYearLock @ActivityDate;
  DECLARE @FacultyJson nvarchar(max)=CONCAT(N'["',CONVERT(char(36),@Faculty),N'"]');
  IF @Faculty IS NOT NULL EXEC paws_api.AcquireCalendarActivityFacultyLocks @FacultyJson;
  DECLARE @Version binary(8),@StartDate date,@EndDate date;
  SELECT @Version=ActivityVersion,@StartDate=StartDate,@EndDate=EndDate FROM paws.CalendarActivity WITH(UPDLOCK,HOLDLOCK) WHERE ActivityId=@ActivityId AND (FacultyId=@Faculty OR FacultyId IS NULL AND @Faculty IS NULL);
  IF @Version IS NULL OR @ExpectedVersion IS NULL OR DATALENGTH(@ExpectedVersion)<>16 OR TRY_CONVERT(binary(8),@ExpectedVersion,2) IS NULL
   OR TRY_CONVERT(binary(8),@ExpectedVersion,2)<>@Version THROW 53804,'Activity changed.',1;
  IF @ActivityDate<@StartDate OR @ActivityDate>@EndDate THROW 53802,'Evidence date is outside the activity range.',1;
  IF EXISTS(SELECT 1 FROM paws.CalendarActivityDayTime WITH(UPDLOCK,HOLDLOCK) WHERE ActivityId=@ActivityId AND ActivityDate=@ActivityDate)
   UPDATE paws.CalendarActivityDayTime SET StartTime=@StartTime,EndTime=@EndTime,EvidenceRef=@EvidenceRef,EvidenceNote=@EvidenceNote,ActorUid=@ActorFirebaseUid,UpdatedAtUtc=SYSUTCDATETIME() WHERE ActivityId=@ActivityId AND ActivityDate=@ActivityDate;
  ELSE INSERT paws.CalendarActivityDayTime(ActivityId,ActivityDate,StartTime,EndTime,EvidenceRef,EvidenceNote,ActorUid)
   VALUES(@ActivityId,@ActivityDate,@StartTime,@EndTime,@EvidenceRef,@EvidenceNote,@ActorFirebaseUid);
  UPDATE paws.CalendarActivity SET UpdatedAtUtc=SYSUTCDATETIME() WHERE ActivityId=@ActivityId;
  INSERT paws.AuditEvent(AuditEventId,EventType,EntityType,EntityId,ActorFirebaseUid,OccurredAtUtc,MetadataJson,ImportBatchId)
   SELECT NEWID(),N'calendar_activity_time_resolved',N'calendar_activity',CONVERT(nvarchar(36),@ActivityId),@ActorFirebaseUid,SYSUTCDATETIME(),
    (SELECT @ActivityDate activityDate FOR JSON PATH,WITHOUT_ARRAY_WRAPPER),ImportBatchId FROM paws.CalendarActivity WHERE ActivityId=@ActivityId;
  COMMIT TRANSACTION;
 END TRY BEGIN CATCH IF XACT_STATE()<>0 ROLLBACK TRANSACTION;THROW;END CATCH;
 SELECT (SELECT a.ActivityId activityId,c.CandidateKey facultyKey,COALESCE(NULLIF(LTRIM(RTRIM(CONCAT(f.PreferredFirstName,N' ',f.PreferredLastName))),N''),f.DisplayName,CASE WHEN a.StaffingKind=N'unassigned' THEN N'Locum' END) facultyDisplayName,
  a.StaffingKind staffingKind,a.StaffingLabel staffingLabel,a.BlockLabel blockLabel,
  a.Category category,a.OriginalLabel label,a.StartDate startDate,a.EndDate endDate,course.CourseCode courseCode,
  CASE WHEN (SELECT COUNT(*) FROM paws.CalendarActivityDayTime WHERE ActivityId=a.ActivityId)=DATEDIFF(day,a.StartDate,a.EndDate)+1 THEN N'verified' ELSE N'partial' END timeStatus,
  CONVERT(varchar(16),CONVERT(binary(8),a.ActivityVersion),2) version,
  JSON_QUERY((SELECT ActivityDate date,CONVERT(char(5),StartTime,108) startTime,CONVERT(char(5),EndTime,108) endTime FROM paws.CalendarActivityDayTime WHERE ActivityId=a.ActivityId ORDER BY ActivityDate FOR JSON PATH)) timeEvidence
  FROM paws.CalendarActivity a LEFT JOIN paws.Faculty f ON f.FacultyId=a.FacultyId LEFT JOIN paws.SwapCandidate c ON c.FacultyId=a.FacultyId LEFT JOIN paws.Course course ON course.CourseId=a.CourseId
  WHERE a.ActivityId=@ActivityId FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES) responseJson;
END;
GO
ALTER FUNCTION paws_api.CccScopeSnapshot(@AcademicYear varchar(7)) RETURNS nvarchar(max)
AS
BEGIN
 DECLARE @Start date=TRY_CONVERT(date,LEFT(@AcademicYear,4)+'-05-01'),@End date=DATEADD(year,1,TRY_CONVERT(date,LEFT(@AcademicYear,4)+'-05-01'));
 DECLARE @Rows nvarchar(max)=(SELECT a.ActivityId activityId,a.FacultyId facultyId,a.Category category,a.OriginalLabel label,a.StartDate startDate,a.EndDate endDate,a.CourseId courseId,c.CourseCode courseCode,
 a.ImportBatchId importBatchId,a.ImportRowId importRowId,a.SourceSha256 sourceSha256,a.SourceSheet sourceSheet,a.SourceRow sourceRow,
 a.CreatedByUid createdByUid,a.CreatedAtUtc createdAtUtc,a.UpdatedAtUtc updatedAtUtc,CONVERT(varchar(16),CONVERT(binary(8),a.ActivityVersion),2) version,
 JSON_QUERY((SELECT ActivityDate date,StartTime startTime,EndTime endTime,EvidenceRef evidenceRef,EvidenceNote evidenceNote,ActorUid actorUid,UpdatedAtUtc updatedAtUtc,CONVERT(varchar(16),CONVERT(binary(8),TimeVersion),2) version FROM paws.CalendarActivityDayTime t WHERE t.ActivityId=a.ActivityId ORDER BY ActivityDate FOR JSON PATH,INCLUDE_NULL_VALUES)) timeEvidence
 FROM paws.CalendarActivity a LEFT JOIN paws.Course c ON c.CourseId=a.CourseId
 WHERE a.Category=N'ccc' AND a.StartDate<@End AND a.EndDate>=@Start ORDER BY a.StartDate,a.ActivityId FOR JSON PATH,INCLUDE_NULL_VALUES);
 DECLARE @Parts TABLE(n int PRIMARY KEY,RowJson nvarchar(max));
 INSERT @Parts SELECT TRY_CONVERT(int,j.[key]),CASE WHEN a.SourceColumn IS NOT NULL OR a.BlockLabel IS NOT NULL OR a.StaffingKind=N'unassigned' THEN
 JSON_MODIFY(JSON_MODIFY(JSON_MODIFY(JSON_MODIFY(JSON_MODIFY(j.value,'$.staffingKind',a.StaffingKind),'$.staffingLabel',a.StaffingLabel),'$.blockLabel',a.BlockLabel),'$.sourceColumn',a.SourceColumn),'$.sourceSlotKey',a.SourceSlotKey)
 ELSE j.value END
 FROM OPENJSON(@Rows) j JOIN paws.CalendarActivity a ON a.ActivityId=TRY_CONVERT(uniqueidentifier,JSON_VALUE(j.value,'$.activityId'));
 -- An explicit ordinal loop preserves legacy JSON ordering on SQL2017 and
 -- avoids ordered-aggregate scalar-UDF inlining conflicts on newer SQL.
 DECLARE @Result nvarchar(max)=N'[',@n int=0,@Last int=(SELECT COUNT(*) FROM @Parts);
 WHILE @n<@Last
 BEGIN
  SELECT @Result=@Result+CASE WHEN @n=0 THEN N'' ELSE N',' END+RowJson FROM @Parts WHERE n=@n;
  SET @n+=1;
 END;
 RETURN @Result+N']';
END;
GO
ALTER PROCEDURE paws_api.LockCccReplacementScope @AcademicYear varchar(7),@SourceRowsJson nvarchar(max)
WITH EXECUTE AS OWNER
AS
BEGIN
 SET NOCOUNT ON;
 IF @@TRANCOUNT=0 THROW 54909,'CCC transaction required.',1;
 DECLARE @Result int,@Resource nvarchar(255)=CONCAT(N'paws:ccc-replacement:',@AcademicYear),@Faculty nvarchar(max),@Start date=TRY_CONVERT(date,LEFT(@AcademicYear,4)+'-05-01'),@End date=DATEADD(year,1,TRY_CONVERT(date,LEFT(@AcademicYear,4)+'-05-01'));
 EXEC @Result=sys.sp_getapplock @Resource=@Resource,@LockMode=N'Exclusive',@LockOwner=N'Transaction',@LockTimeout=5000,@DbPrincipal=N'dbo';
 IF @Result<0 THROW 54909,'CCC scope is busy.',1;
 -- Read committed first: never hold activity row locks while waiting for SWAP's faculty locks.
 SELECT @Faculty=N'['+COALESCE(STUFF((SELECT N',"'+CONVERT(varchar(36),FacultyId)+N'"' FROM(
  SELECT FacultyId FROM paws_api.CccReplacementRows(@SourceRowsJson,@AcademicYear) WHERE FacultyId IS NOT NULL
  UNION SELECT FacultyId FROM paws.CalendarActivity WHERE FacultyId IS NOT NULL AND Category=N'ccc' AND StartDate<@End AND EndDate>=@Start) ids ORDER BY FacultyId FOR XML PATH(''),TYPE).value('.','nvarchar(max)'),1,1,N''),N'')+N']';
 EXEC paws_api.AcquireCalendarActivityFacultyLocks @Faculty;
END;
GO
ALTER PROCEDURE paws_api.RecoverCccReplacement @ActorFirebaseUid nvarchar(128),@ReceiptId uniqueidentifier,@Confirm bit
AS
BEGIN
 SET NOCOUNT ON;SET XACT_ABORT ON;SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
 BEGIN TRY
  BEGIN TRANSACTION;EXEC paws_api.AssertCccAdministrator @ActorFirebaseUid;
  IF @Confirm IS NULL OR @Confirm<>1 THROW 54902,'Explicit recovery confirmation required.',1;
  DECLARE @Year varchar(7),@Before nvarchar(max),@Expected nvarchar(max),@Status nvarchar(16),@Batch uniqueidentifier,@Rows nvarchar(max),@Protected bit,@Current nvarchar(max);
  SELECT @Year=AcademicYear,@Before=BeforeRowsJson,@Expected=AfterScopeJson,@Status=Status,@Batch=ImportBatchId FROM paws.CccReplacementReceipt WITH(UPDLOCK,HOLDLOCK) WHERE ReceiptId=@ReceiptId;
  IF @Year IS NULL THROW 54903,'CCC receipt not found.',1;
  IF @Status<>N'committed' THROW 54904,'CCC receipt is not recoverable.',1;
  -- Lock the batch before the year/faculty locks, matching commit ordering.
  SELECT @Rows=RowsJson FROM staging.CccReplacement WITH(UPDLOCK,HOLDLOCK) WHERE ImportBatchId=@Batch;
  DECLARE @RecoveryRows nvarchar(max)=(SELECT JSON_VALUE(value,'$.facultyId') facultySourceId,CONVERT(int,[key])+2 sourceRow,N'[]' issues FROM OPENJSON(@Before) FOR JSON PATH);
  EXEC paws_api.LockCccReplacementScope @Year,@RecoveryRows;
  SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
  EXEC paws_api.CalendarActivityProtectedReferences N'activity',@Protected OUTPUT;SET @Current=paws_api.CccScopeSnapshot(@Year);
  IF @Protected=1 OR @Current COLLATE Latin1_General_100_BIN2<>@Expected COLLATE Latin1_General_100_BIN2 OR EXISTS(SELECT 1 FROM OPENJSON(@Current) WITH(TimeEvidence nvarchar(max) '$.timeEvidence' AS JSON) WHERE TimeEvidence<>N'[]')
   OR EXISTS(SELECT 1 FROM paws.CalendarActivity a JOIN OPENJSON(@Before) WITH(ActivityId uniqueidentifier '$.activityId') b ON b.ActivityId=a.ActivityId) THROW 54908,'Newer or referenced CCC rows prevent recovery.',1;
  INSERT paws.AuditEvent(AuditEventId,EventType,EntityType,EntityId,ActorFirebaseUid,OccurredAtUtc,BeforeJson,RequestId,ImportBatchId)
   SELECT NEWID(),N'ccc_activity_removed',N'calendar_activity',JSON_VALUE(value,'$.activityId'),@ActorFirebaseUid,SYSUTCDATETIME(),
    (SELECT JSON_VALUE(value,'$.facultyId') facultyId,JSON_VALUE(value,'$.label') label,N'ccc' category,JSON_VALUE(value,'$.startDate') startDate,JSON_VALUE(value,'$.endDate') endDate,JSON_VALUE(value,'$.courseCode') courseCode FOR JSON PATH,WITHOUT_ARRAY_WRAPPER),@ReceiptId,@Batch FROM OPENJSON(@Current);
  DELETE a FROM paws.CalendarActivity a JOIN OPENJSON(@Current) WITH(ActivityId uniqueidentifier '$.activityId') c ON c.ActivityId=a.ActivityId;
  INSERT paws.CalendarActivity(ActivityId,FacultyId,Category,OriginalLabel,StartDate,EndDate,CourseId,ImportBatchId,ImportRowId,SourceSha256,SourceSheet,SourceRow,CreatedByUid,CreatedAtUtc,UpdatedAtUtc,StaffingKind,StaffingLabel,BlockLabel,SourceColumn,SourceSlotKey)
   SELECT ActivityId,FacultyId,N'ccc',Label,StartDate,EndDate,CourseId,ImportBatchId,ImportRowId,SourceSha256,SourceSheet,SourceRow,CreatedByUid,CreatedAtUtc,UpdatedAtUtc,COALESCE(StaffingKind,N'assigned'),StaffingLabel,BlockLabel,SourceColumn,SourceSlotKey FROM OPENJSON(@Before)
   WITH(ActivityId uniqueidentifier '$.activityId',FacultyId uniqueidentifier '$.facultyId',Label nvarchar(1000) '$.label',StartDate date '$.startDate',EndDate date '$.endDate',CourseId uniqueidentifier '$.courseId',ImportBatchId uniqueidentifier '$.importBatchId',ImportRowId uniqueidentifier '$.importRowId',SourceSha256 char(64) '$.sourceSha256',SourceSheet nvarchar(256) '$.sourceSheet',SourceRow int '$.sourceRow',CreatedByUid nvarchar(128) '$.createdByUid',CreatedAtUtc datetime2(7) '$.createdAtUtc',UpdatedAtUtc datetime2(7) '$.updatedAtUtc',StaffingKind nvarchar(16) '$.staffingKind',StaffingLabel nvarchar(32) '$.staffingLabel',BlockLabel nvarchar(1000) '$.blockLabel',SourceColumn nvarchar(4) '$.sourceColumn',SourceSlotKey nvarchar(320) '$.sourceSlotKey');
  INSERT paws.AuditEvent(AuditEventId,EventType,EntityType,EntityId,ActorFirebaseUid,OccurredAtUtc,AfterJson,RequestId,ImportBatchId)
   SELECT NEWID(),N'ccc_activity_added',N'calendar_activity',JSON_VALUE(value,'$.activityId'),@ActorFirebaseUid,SYSUTCDATETIME(),
    (SELECT JSON_VALUE(value,'$.facultyId') facultyId,JSON_VALUE(value,'$.label') label,N'ccc' category,JSON_VALUE(value,'$.startDate') startDate,JSON_VALUE(value,'$.endDate') endDate,JSON_VALUE(value,'$.courseCode') courseCode FOR JSON PATH,WITHOUT_ARRAY_WRAPPER),@ReceiptId,@Batch FROM OPENJSON(@Before);
  UPDATE paws.CccReplacementReceipt SET Status=N'recovered' WHERE ReceiptId=@ReceiptId;UPDATE staging.CccReplacement SET Status=N'recovered' WHERE ImportBatchId=@Batch;
  COMMIT;SELECT(SELECT @ReceiptId receiptId,N'recovered' status FOR JSON PATH,WITHOUT_ARRAY_WRAPPER) responseJson;
 END TRY BEGIN CATCH IF XACT_STATE()<>0 ROLLBACK;THROW;END CATCH;
END;
GO
UPDATE staging.MasterCccSchemaBaseline SET AfterSha256=CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(N'paws_api.'+ObjectName))),2);
COMMIT;
GO
