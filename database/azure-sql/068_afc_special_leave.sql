/* Available Special Leave is an explicit attribute of an approved manual AFC.
   Existing imported, manual, and approved request records keep their semantics. */
:ON ERROR EXIT
SET XACT_ABORT ON;
SET NOCOUNT ON;
IF DB_NAME()<>N'VetMed-Ops' THROW 56800,'Special Leave migration requires VetMed-Ops.',1;
IF OBJECT_ID(N'paws_api.UpdateAfcDates',N'P') IS NULL
 OR OBJECT_ID(N'paws_api.CalendarActivityAvailability',N'FN') IS NULL
 OR OBJECT_ID(N'paws_api.SchedulingTaskIssues',N'IF') IS NULL
 OR OBJECT_ID(N'paws_api.ListFacultyAvailability',N'P') IS NULL
 THROW 56800,'Apply the existing AFC and scheduling migrations first.',1;
BEGIN TRANSACTION;
IF OBJECT_ID(N'paws.CK_DoeFacultyAllocation_CategoryCode',N'C') IS NULL
 THROW 56800,'The contract DOE allocation category check is required.',1;
ALTER TABLE paws.DoeFacultyAllocation DROP CONSTRAINT CK_DoeFacultyAllocation_CategoryCode;
ALTER TABLE paws.DoeFacultyAllocation WITH CHECK ADD CONSTRAINT CK_DoeFacultyAllocation_CategoryCode CHECK (CategoryCode IN (
 N'scholarly_activity',N'ppvm_cost_share',N'clinical_unsorted',N'clinical_teaching',N'clinical_activity_ppvm',
 N'research',N'service',N'contract_admin',N'service_admin',N'other',N'onboarding'));
IF OBJECT_ID(N'paws.AfcSpecialLeave',N'U') IS NULL
 CREATE TABLE paws.AfcSpecialLeave(
  AfcRecordId uniqueidentifier NOT NULL PRIMARY KEY REFERENCES paws.AfcManualRecord(AfcRecordId),
  ReviewedStartDate date NOT NULL,
  ReviewedEndDate date NOT NULL,
  DeductionJson nvarchar(max) NOT NULL,
  UpdatedAtUtc datetime2(7) NOT NULL,
  CONSTRAINT CK_AfcSpecialLeave_Dates CHECK (ReviewedStartDate<=ReviewedEndDate),
  CONSTRAINT CK_AfcSpecialLeave_Deduction CHECK (ISJSON(DeductionJson)=1)
 );
GO
CREATE OR ALTER VIEW paws.vAfcSpecialLeaveAdmin AS
 SELECT m.AfcRecordId,m.FacultyId,m.StartDate,m.EndDate,m.Active,
   CONVERT(varchar(33),m.CreatedAtUtc,126) AS ApprovedAt,
   CONVERT(varchar(16),CONVERT(binary(8),m.AfcVersion),2) AS VersionToken,
   s.ReviewedStartDate,s.ReviewedEndDate,s.DeductionJson
 FROM paws.AfcSpecialLeave s JOIN paws.AfcManualRecord m ON m.AfcRecordId=s.AfcRecordId
 WHERE m.ReasonCode=N'special';
GO
CREATE OR ALTER PROCEDURE paws_api.SaveAfcSpecialLeave
 @AfcRecordId uniqueidentifier,@FacultyId uniqueidentifier,@ExpectedVersion varchar(16),
 @ActorFirebaseUid nvarchar(128),@RequestId uniqueidentifier,@DeductionJson nvarchar(max)
AS
BEGIN
 SET NOCOUNT ON;
 SET XACT_ABORT ON;
 IF @@TRANCOUNT=0 THROW 56800,'Special Leave requires an atomic AFC write.',1;
 DECLARE @ActorName nvarchar(260),@Version binary(8),@StartDate date,@EndDate date,
  @Before nvarchar(max),@CurrentFacultyId uniqueidentifier;
 SELECT @ActorName=DisplayName FROM paws.UserProfile
  WHERE FirebaseUid=@ActorFirebaseUid AND Active=1 AND MustChangePassword=0
   AND LOWER(LTRIM(RTRIM(BaseRole))) IN(N'developer',N'owner',N'administrator',N'adfa_general',N'adfa_regular',N'admin');
 IF @ActorName IS NULL THROW 56402,'Special Leave requires an authorized administrator.',1;
 IF COALESCE(ISJSON(@DeductionJson),0)<>1 OR DATALENGTH(@DeductionJson)>262144
  THROW 51213,'Invalid Special Leave deduction.',1;
 SELECT @Version=AfcVersion,@StartDate=StartDate,@EndDate=EndDate,@CurrentFacultyId=FacultyId
 FROM paws.AfcManualRecord WITH(UPDLOCK,HOLDLOCK)
 WHERE AfcRecordId=@AfcRecordId AND Active=1 AND ReasonCode=N'special';
 IF @Version IS NULL OR @CurrentFacultyId<>@FacultyId THROW 56403,'Active manual Special Leave was not found.',1;
 IF @ExpectedVersion IS NULL OR TRY_CONVERT(binary(8),@ExpectedVersion,2) IS NULL
  OR @Version<>TRY_CONVERT(binary(8),@ExpectedVersion,2) THROW 56404,'AFC changed. Reload before applying deductions.',1;
 SELECT @Before=DeductionJson FROM paws.AfcSpecialLeave WITH(UPDLOCK,HOLDLOCK) WHERE AfcRecordId=@AfcRecordId;
 IF @Before IS NULL
 BEGIN
  IF NOT EXISTS(SELECT 1 FROM paws.AfcManualRecord WHERE AfcRecordId=@AfcRecordId AND RequestId=@RequestId AND CreatedByFirebaseUid=@ActorFirebaseUid)
   THROW 56406,'Only a newly approved manual record can become Available.',1;
  INSERT paws.AfcSpecialLeave VALUES(@AfcRecordId,@StartDate,@EndDate,@DeductionJson,SYSUTCDATETIME());
 END
 ELSE
  UPDATE paws.AfcSpecialLeave
   SET DeductionJson=@DeductionJson,ReviewedStartDate=@StartDate,ReviewedEndDate=@EndDate,UpdatedAtUtc=SYSUTCDATETIME()
   WHERE AfcRecordId=@AfcRecordId;
 UPDATE paws.AfcManualRecord SET Notes=Notes WHERE AfcRecordId=@AfcRecordId;
 INSERT paws.AuditEvent(AuditEventId,EventType,EntityType,EntityId,ActorFirebaseUid,ActorName,OccurredAtUtc,BeforeJson,AfterJson,MetadataJson,RequestId)
  VALUES(NEWID(),N'afc_special_leave_deduction_confirmed',N'AfcRecord',CONVERT(nvarchar(36),@AfcRecordId),@ActorFirebaseUid,@ActorName,
   SYSUTCDATETIME(),JSON_MODIFY(JSON_MODIFY(@Before,'$.startDate',CONVERT(varchar(10),@StartDate,23)),'$.endDate',CONVERT(varchar(10),@EndDate,23)),
   JSON_MODIFY(JSON_MODIFY(@DeductionJson,'$.startDate',CONVERT(varchar(10),@StartDate,23)),'$.endDate',CONVERT(varchar(10),@EndDate,23)),
   (SELECT @FacultyId AS facultyId,@StartDate AS startDate,@EndDate AS endDate FOR JSON PATH,WITHOUT_ARRAY_WRAPPER),@RequestId);
 SELECT * FROM paws.vAfcSpecialLeaveAdmin WHERE AfcRecordId=@AfcRecordId;
END;
GO
GRANT SELECT ON OBJECT::paws.vAfcSpecialLeaveAdmin TO [paws_runtime_read];
GRANT SELECT ON OBJECT::paws.DoeFacultyAllocation (UpdatedAtUtc) TO [paws_runtime_read];
GRANT SELECT ON OBJECT::paws.Faculty (UpdatedAtUtc) TO [paws_runtime_read];
GRANT EXECUTE ON OBJECT::paws_api.SaveAfcSpecialLeave TO [paws_runtime_afc_single_write];
GO

/* Carry Available semantics through the existing scheduling checks. */
CREATE OR ALTER FUNCTION paws_api.CalendarActivityAvailability(@FacultyId uniqueidentifier,@Date date,@StartTime time(0),@EndTime time(0),@ExcludeSessionId uniqueidentifier=NULL) RETURNS nvarchar(16)
AS
BEGIN
 IF @FacultyId IS NULL OR @Date IS NULL OR @StartTime IS NULL OR @EndTime IS NULL OR @StartTime>=@EndTime
  OR NOT EXISTS(SELECT 1 FROM paws.Faculty WHERE FacultyId=@FacultyId AND Active=1) RETURN N'Unavailable';
 -- Unverified working time must not be hidden by a separately overridable known conflict.
 IF EXISTS(SELECT 1 FROM paws.CalendarActivity a WHERE a.FacultyId=@FacultyId AND @Date BETWEEN a.StartDate AND a.EndDate
  AND NOT EXISTS(SELECT 1 FROM paws.CalendarActivityDayTime t WHERE t.ActivityId=a.ActivityId AND t.ActivityDate=@Date)) RETURN N'Needs Review';
 IF EXISTS(SELECT 1 FROM paws.vAfcRecordUnified af WHERE af.FacultyId=@FacultyId AND af.Active=1 AND @Date BETWEEN af.StartDate AND af.EndDate AND NOT EXISTS(SELECT 1 FROM paws.AfcSpecialLeave sl WHERE af.SourceKind=N'manual' AND sl.AfcRecordId=af.AfcRecordId)) RETURN N'Unavailable';
 IF EXISTS(SELECT 1 FROM paws.AfcRequest r WHERE r.FacultyId=@FacultyId AND r.Status=N'approved' AND @Date BETWEEN r.StartDate AND r.EndDate) RETURN N'Unavailable';
 IF EXISTS(SELECT 1 FROM paws.SessionAssignment a JOIN paws.Session s ON s.SessionId=a.SessionId WHERE a.FacultyId=@FacultyId AND (@ExcludeSessionId IS NULL OR s.SessionId<>@ExcludeSessionId)
  AND (s.SessionDate IS NULL OR s.SessionDate=@Date AND (s.StartTime IS NULL OR s.EndTime IS NULL OR s.StartTime>=s.EndTime OR s.StartTime<@EndTime AND s.EndTime>@StartTime))) RETURN N'Unavailable';
 IF EXISTS(SELECT 1 FROM paws.CalendarActivity a JOIN paws.CalendarActivityDayTime t ON t.ActivityId=a.ActivityId AND t.ActivityDate=@Date
  WHERE a.FacultyId=@FacultyId AND @Date BETWEEN a.StartDate AND a.EndDate AND t.StartTime<@EndTime AND t.EndTime>@StartTime) RETURN N'Unavailable';
 RETURN N'Available';
END;
GO
CREATE OR ALTER PROCEDURE paws_api.DecideSessionSwap @ActorFirebaseUid nvarchar(128),@RequestId uniqueidentifier,@ExpectedRevision int,@Decision nvarchar(32),@Comment nvarchar(2000)=NULL,@OverrideReason nvarchar(2000)=NULL,@ApplyEnabled bit=0 AS
BEGIN
 SET NOCOUNT ON;SET XACT_ABORT ON;
 DECLARE @Session uniqueidentifier,@Assignment uniqueidentifier,@Target uniqueidentifier,@Revision int,@Stage nvarchar(16),@Status nvarchar(32),@Changes nvarchar(max),@Hash varchar(64),@Before nvarchar(max),@After nvarchar(max),@Lock uniqueidentifier,@Adc bit,@Lab bit,@Visc bit,@Next nvarchar(16),@Override bit=0,
 @Date date,@Start time,@End time,@Course nvarchar(32),@Type nvarchar(128),@Room nvarchar(256),@Duration decimal(12,4),@OldDuration decimal(12,4),@Blocked bit=0;
 IF @Decision NOT IN(N'approve',N'reject',N'push_back') OR (@Decision<>N'approve' AND NULLIF(LTRIM(RTRIM(@Comment)),N'') IS NULL) THROW 53001,'A valid decision and reason are required.',1;
 BEGIN TRY
 BEGIN TRANSACTION;
 SELECT @Session=SessionId,@Assignment=AssignmentId,@Target=TargetFacultyId,@Revision=Revision,@Stage=NextStage,@Status=Status,@Changes=ChangesJson,@Hash=SnapshotToken,@Adc=NeedsAdc,@Lab=NeedsLab,@Visc=NeedsVisc FROM paws.SwapRequest WITH(UPDLOCK,HOLDLOCK) WHERE RequestId=@RequestId;
 IF @Session IS NULL THROW 53004,'Request not found.',1;
 IF @Revision<>@ExpectedRevision OR @ExpectedRevision IS NULL THROW 53009,'Revision changed; reload before deciding.',1;
 IF @Status<>N'pending' THROW 53011,'Request is not pending.',1;
 IF NULLIF(LTRIM(RTRIM(@OverrideReason)),N'') IS NOT NULL BEGIN IF paws_api.CanActOnSessionSwap(@Session,@ActorFirebaseUid,N'override')<>1 THROW 53003,'Only Owner/Developer may override with a recorded reason.',1;SET @Override=1;END;
 IF @Override=0 AND NOT ((@Stage=N'target' AND EXISTS(SELECT 1 FROM paws.SwapNotification n JOIN paws.UserProfile u ON u.FirebaseUid=n.TargetUid AND u.FacultyId=@Target AND u.Active=1 AND u.MustChangePassword=0 WHERE n.RequestId=@RequestId AND n.Revision=@Revision AND n.TargetUid=@ActorFirebaseUid AND n.Status=N'pending')) OR (@Stage<>N'target' AND paws_api.CanActOnSessionSwap(@Session,@ActorFirebaseUid,@Stage)=1)) THROW 53003,'This actor cannot decide the current stage.',1;
 -- Even privileged actors cannot fabricate target consent. Overrides are explicit office/conflict bypasses only.
 IF @Override=1 AND @Stage=N'target' THROW 53003,'Target consent must come from the linked replacement account.',1;
 SELECT @Lock=SessionId FROM paws.Session WITH(UPDLOCK,HOLDLOCK) WHERE SessionId=@Session;
 SELECT @Lock=SessionAssignmentId FROM paws.SessionAssignment WITH(UPDLOCK,HOLDLOCK) WHERE SessionId=@Session;
 SET @Before=paws_api.SessionSwapSnapshot(@Session);
 IF @Hash<>CONVERT(varchar(64),HASHBYTES('SHA2_256',CONVERT(varbinary(max),@Before)),2) THROW 53010,'Canonical session or assignment source changed; withdraw and recreate.',1;
 IF @Stage=N'target' UPDATE paws.SwapNotification SET Status=CASE @Decision WHEN N'approve' THEN N'accepted' WHEN N'reject' THEN N'rejected' ELSE N'changes_requested' END WHERE RequestId=@RequestId AND Revision=@Revision;
 IF @Decision<>N'approve'
 BEGIN
  INSERT paws.SwapDecision(RequestId,Revision,Stage,Decision,Comment,OverrideReason,ActorUid) VALUES(@RequestId,@Revision,@Stage,@Decision,@Comment,@OverrideReason,@ActorFirebaseUid);
  UPDATE paws.SwapRequest SET Status=IIF(@Decision=N'reject',N'rejected',N'changes_requested'),NextStage=NULL,UpdatedAtUtc=SYSUTCDATETIME() WHERE RequestId=@RequestId;
  UPDATE paws.SwapNotification SET Status=N'closed' WHERE RequestId=@RequestId AND Revision=@Revision AND Status=N'pending';
 END
 ELSE
 BEGIN
  SET @Next=CASE WHEN @Stage=N'target' AND @Visc=1 THEN N'visc' WHEN @Stage IN(N'target',N'visc') AND @Adc=1 THEN N'adc' WHEN @Stage IN(N'target',N'visc',N'adc') AND @Lab=1 THEN N'lab' WHEN @Stage<>N'adfa' THEN N'adfa' END;
  IF @Override=1 SET @Next=NULL;
  IF @Next IS NULL
  BEGIN
   IF @ApplyEnabled<>1 THROW 53001,'Final SWAP application is disabled.',1;
   -- Serializable range checks protect target availability and all untouched co-instructors.
   SELECT @Date=COALESCE(TRY_CONVERT(date,JSON_VALUE(@Changes,'$.date'),23),SessionDate),@Start=COALESCE(TRY_CONVERT(time,JSON_VALUE(@Changes,'$.startTime')),StartTime),@End=COALESCE(TRY_CONVERT(time,JSON_VALUE(@Changes,'$.endTime')),EndTime),@Course=COALESCE(JSON_VALUE(@Changes,'$.courseCode'),CourseCode),@Type=COALESCE(JSON_VALUE(@Changes,'$.sessionType'),SessionType),@Room=COALESCE(JSON_VALUE(@Changes,'$.room'),Room),@OldDuration=CONVERT(decimal(12,4),DATEDIFF(second,StartTime,EndTime)/3600.0) FROM paws.Session WHERE SessionId=@Session;
   SET @Duration=CONVERT(decimal(12,4),DATEDIFF(second,@Start,@End)/3600.0);
   IF @Date IS NULL OR @Start IS NULL OR @End IS NULL OR @Start>=@End THROW 53011,'Application requires a known valid session date and time.',1;
   DECLARE @ActivityFaculty TABLE(FacultyId uniqueidentifier NOT NULL PRIMARY KEY);
   IF EXISTS(SELECT 1 FROM paws.SessionAssignment WHERE SessionId=@Session AND CASE WHEN SessionAssignmentId=@Assignment THEN @Target ELSE FacultyId END IS NULL) THROW 53011,'Active resolved faculty identities are required.',1;
   INSERT @ActivityFaculty SELECT DISTINCT CASE WHEN SessionAssignmentId=@Assignment THEN @Target ELSE FacultyId END FROM paws.SessionAssignment WHERE SessionId=@Session;
   DECLARE @ActivityFacultyJson nvarchar(max)=(SELECT COALESCE(CONCAT(N'[',STRING_AGG(CONVERT(nvarchar(max),CONCAT(N'"',CONVERT(char(36),FacultyId),N'"')),N','),N']'),N'[]') FROM @ActivityFaculty);
   EXEC paws_api.AcquireCalendarActivityFacultyLocks @ActivityFacultyJson;
   DECLARE @ActivityLock uniqueidentifier;
   SELECT @ActivityLock=a.ActivityId FROM paws.CalendarActivity a WITH(UPDLOCK,HOLDLOCK) JOIN @ActivityFaculty f ON f.FacultyId=a.FacultyId WHERE @Date BETWEEN a.StartDate AND a.EndDate;
   SELECT @ActivityLock=t.ActivityId FROM paws.CalendarActivityDayTime t WITH(UPDLOCK,HOLDLOCK) JOIN paws.CalendarActivity a ON a.ActivityId=t.ActivityId JOIN @ActivityFaculty f ON f.FacultyId=a.FacultyId WHERE t.ActivityDate=@Date;
   IF EXISTS(SELECT 1 FROM @ActivityFaculty f WHERE NOT EXISTS(SELECT 1 FROM paws.SwapCalendarActivitySnapshot snapshot WITH(UPDLOCK,HOLDLOCK)
    WHERE snapshot.RequestId=@RequestId AND snapshot.Revision=@Revision AND snapshot.FacultyId=f.FacultyId AND snapshot.ProposedDate=@Date AND snapshot.ProposedStart=@Start AND snapshot.ProposedEnd=@End AND snapshot.ActivityDigest=paws_api.CalendarActivityVersionDigest(f.FacultyId,@Date,@Start,@End)))
    OR EXISTS(SELECT 1 FROM paws.SwapCalendarActivitySnapshot WHERE RequestId=@RequestId AND Revision=@Revision AND FacultyId NOT IN(SELECT FacultyId FROM @ActivityFaculty)) THROW 53010,'Calendar activity state changed or is not snapshotted; save a fresh revision.',1;
   IF EXISTS(SELECT 1 FROM @ActivityFaculty WHERE paws_api.CalendarActivityAvailability(FacultyId,@Date,@Start,@End,@Session)=N'Needs Review') THROW 53011,'Activity timing needs review; it cannot be overridden.',1;
   IF EXISTS(SELECT 1 FROM @ActivityFaculty WHERE paws_api.CalendarActivityAvailability(FacultyId,@Date,@Start,@End,@Session)=N'Unavailable') SET @Blocked=1;
   IF EXISTS(SELECT 1 FROM paws.SessionAssignment a LEFT JOIN paws.Faculty f WITH(UPDLOCK,HOLDLOCK) ON f.FacultyId=CASE WHEN a.SessionAssignmentId=@Assignment THEN @Target ELSE a.FacultyId END WHERE a.SessionId=@Session AND (f.FacultyId IS NULL OR f.Active=0 OR a.FacultyResolutionStatus<>N'resolved')) THROW 53011,'Application requires active resolved faculty identities.',1;
   IF @Target IS NOT NULL AND EXISTS(SELECT 1 FROM paws.SessionAssignment WITH(UPDLOCK,HOLDLOCK) WHERE SessionId=@Session AND FacultyId=@Target) THROW 53011,'Replacement is already assigned.',1;
   IF EXISTS(SELECT 1 FROM paws.SessionAssignment currentAssignment CROSS APPLY(SELECT CASE WHEN currentAssignment.SessionAssignmentId=@Assignment THEN @Target ELSE currentAssignment.FacultyId END FacultyId) candidate JOIN paws.AfcRecord af WITH(UPDLOCK,HOLDLOCK) ON af.FacultyId=candidate.FacultyId AND af.Active=1 AND @Date BETWEEN af.StartDate AND af.EndDate WHERE currentAssignment.SessionId=@Session)
    OR EXISTS(SELECT 1 FROM paws.SessionAssignment currentAssignment CROSS APPLY(SELECT CASE WHEN currentAssignment.SessionAssignmentId=@Assignment THEN @Target ELSE currentAssignment.FacultyId END FacultyId) candidate JOIN paws.AfcManualRecord af WITH(UPDLOCK,HOLDLOCK) ON af.FacultyId=candidate.FacultyId AND af.Active=1 AND @Date BETWEEN af.StartDate AND af.EndDate WHERE currentAssignment.SessionId=@Session AND NOT EXISTS(SELECT 1 FROM paws.AfcSpecialLeave sl WHERE sl.AfcRecordId=af.AfcRecordId)) SET @Blocked=1;
   IF EXISTS(SELECT 1 FROM paws.SessionAssignment currentAssignment CROSS APPLY(SELECT CASE WHEN currentAssignment.SessionAssignmentId=@Assignment THEN @Target ELSE currentAssignment.FacultyId END FacultyId) candidate JOIN paws.SessionAssignment otherAssignment WITH(UPDLOCK,HOLDLOCK) ON otherAssignment.FacultyId=candidate.FacultyId JOIN paws.Session otherSession WITH(UPDLOCK,HOLDLOCK) ON otherSession.SessionId=otherAssignment.SessionId WHERE currentAssignment.SessionId=@Session AND otherSession.SessionId<>@Session AND (otherSession.SessionDate IS NULL OR (otherSession.SessionDate=@Date AND (otherSession.StartTime IS NULL OR otherSession.EndTime IS NULL OR (otherSession.StartTime<@End AND otherSession.EndTime>@Start))))) SET @Blocked=1;
   IF NULLIF(LTRIM(RTRIM(@Room)),N'') IS NOT NULL AND EXISTS(SELECT 1 FROM paws.Session WITH(UPDLOCK,HOLDLOCK) WHERE SessionId<>@Session AND Room=@Room AND SessionDate=@Date AND (StartTime IS NULL OR EndTime IS NULL OR (StartTime<@End AND EndTime>@Start))) SET @Blocked=1;
   IF @Blocked=1 AND @Override=0 THROW 53011,'Application blocked by unresolved identity, unknown schedule, AFC availability, or timetable conflict.',1;
   -- Source DOE cannot silently inherit an incompatible course/type rate. Such changes require reviewed source evidence.
   IF EXISTS(SELECT 1 FROM paws.Session s JOIN paws.SessionAssignment a ON a.SessionId=s.SessionId WHERE s.SessionId=@Session AND (s.CourseCode<>@Course OR s.SessionType<>@Type) AND (a.DoeCredit IS NOT NULL OR a.DoeRate IS NOT NULL OR a.DoeQuantity IS NOT NULL)) THROW 53011,'DOE source preview requires a compatible course/type rule; application remains blocked pending reviewed evidence.',1;
   IF @Duration<>@OldDuration AND EXISTS(SELECT 1 FROM paws.SessionAssignment WHERE SessionId=@Session AND (DoeCredit IS NOT NULL OR DoeRate IS NOT NULL OR DoeQuantity IS NOT NULL) AND (LOWER(COALESCE(DoeUnit,N'')) NOT IN(N'hour',N'hours',N'hr',N'hrs') OR DoeRate IS NULL OR DoeQuantity IS NULL OR DoeCredit IS NULL OR ABS(DoeCredit-DoeRate*DoeQuantity)>0.00001 OR ABS(DoeQuantity-@OldDuration)>0.0001)) THROW 53011,'DOE source preview cannot reconcile the proposed duration with authoritative units and rate.',1;
   IF @Target IS NOT NULL UPDATE paws.SessionAssignment SET FacultyId=@Target,FacultyResolutionStatus=N'resolved' WHERE SessionAssignmentId=@Assignment AND SessionId=@Session;
   IF @Duration<>@OldDuration UPDATE paws.SessionAssignment SET DoeQuantity=@Duration,DoeCredit=ROUND(DoeRate*@Duration,6),CreditedHours=CASE WHEN CreditedHours=@OldDuration THEN @Duration ELSE CreditedHours END WHERE SessionId=@Session AND LOWER(DoeUnit) IN(N'hour',N'hours',N'hr',N'hrs') AND DoeRate IS NOT NULL;
   -- The existing session procedure validates canonical course/date/type and duplicate sessions. Its nested transaction is part of this atomic apply.
   DECLARE @Patch nvarchar(max)=(SELECT [key],value,type FROM OPENJSON(@Changes) WHERE [key]<>N'replacementCandidateKey' FOR JSON PATH);
   DECLARE @SessionPatch nvarchar(max)=N'{}',@Key nvarchar(128),@Value nvarchar(4000);
   DECLARE patchCursor CURSOR LOCAL FAST_FORWARD FOR SELECT [key],value FROM OPENJSON(@Changes) WHERE [key]<>N'replacementCandidateKey';
   OPEN patchCursor;FETCH NEXT FROM patchCursor INTO @Key,@Value;WHILE @@FETCH_STATUS=0 BEGIN SET @SessionPatch=JSON_MODIFY(@SessionPatch,CONCAT(N'$.',@Key),@Value);FETCH NEXT FROM patchCursor INTO @Key,@Value;END;CLOSE patchCursor;DEALLOCATE patchCursor;
   IF @SessionPatch<>N'{}'
   BEGIN
    DECLARE @Discard TABLE(id uniqueidentifier,academicYear nvarchar(32),curriculumYear nvarchar(64),courseCode nvarchar(32),courseName nvarchar(512),topic nvarchar(max),sessionType nvarchar(128),date varchar(10),startTime varchar(8),endTime varchar(8),room nvarchar(256),instructorNames nvarchar(max));
    INSERT @Discard EXEC paws_api.UpdateCalendarSession @SessionId=@Session,@PatchJson=@SessionPatch,@ActorFirebaseUid=@ActorFirebaseUid;
   END;
   SET @After=paws_api.SessionSwapSnapshot(@Session);
   UPDATE paws.SwapRequest SET Status=N'applied',NextStage=NULL,UpdatedAtUtc=SYSUTCDATETIME() WHERE RequestId=@RequestId;
   INSERT paws.AuditEvent(AuditEventId,EventType,EntityType,EntityId,ActorFirebaseUid,OccurredAtUtc,BeforeJson,AfterJson,MetadataJson,RequestId) VALUES(NEWID(),N'swap_applied',N'session_swap',CONVERT(nvarchar(36),@RequestId),@ActorFirebaseUid,SYSUTCDATETIME(),@Before,@After,(SELECT @OverrideReason overrideReason,@Revision revision FOR JSON PATH,WITHOUT_ARRAY_WRAPPER),@RequestId);
  END ELSE UPDATE paws.SwapRequest SET NextStage=@Next,UpdatedAtUtc=SYSUTCDATETIME() WHERE RequestId=@RequestId;
  INSERT paws.SwapDecision(RequestId,Revision,Stage,Decision,Comment,OverrideReason,ActorUid) VALUES(@RequestId,@Revision,@Stage,@Decision,@Comment,@OverrideReason,@ActorFirebaseUid);
 END;
 INSERT paws.AuditEvent(AuditEventId,EventType,EntityType,EntityId,ActorFirebaseUid,OccurredAtUtc,MetadataJson,RequestId) VALUES(NEWID(),N'swap_decision',N'session_swap',CONVERT(nvarchar(36),@RequestId),@ActorFirebaseUid,SYSUTCDATETIME(),(SELECT @Stage stage,@Decision decision,@Revision revision,@Comment comment,@OverrideReason overrideReason FOR JSON PATH,WITHOUT_ARRAY_WRAPPER),@RequestId);
 COMMIT;
 END TRY BEGIN CATCH IF XACT_STATE()<>0 ROLLBACK;THROW;END CATCH;
 EXEC paws_api.GetSessionSwap @RequestId,@ActorFirebaseUid;
END;
GO
CREATE OR ALTER FUNCTION paws_api.SchedulingTaskIssues(@AcademicYear nvarchar(32))
RETURNS TABLE AS RETURN
WITH assigned AS (
 SELECT a.SessionId,a.FacultyId,COUNT(*) AssignmentCount,
  STRING_AGG(CONVERT(nvarchar(max),CONCAT(a.SessionAssignmentId,N':',CONVERT(varchar(16),CONVERT(binary(8),a.SchedulingVersion),2))),N'|') WITHIN GROUP(ORDER BY a.SessionAssignmentId) AssignmentVersions
 FROM paws.SessionAssignment a WHERE a.FacultyId IS NOT NULL GROUP BY a.SessionId,a.FacultyId
), pairs AS (
 SELECT a.FacultyId,s.SessionId,t.SessionId RelatedSessionId,
  CONVERT(nvarchar(40),CASE WHEN s.CourseCode=t.CourseCode AND s.StartTime=t.StartTime AND s.EndTime=t.EndTime AND s.SessionType=t.SessionType
   AND LOWER(LTRIM(RTRIM(COALESCE(s.Topic,N''))))=LOWER(LTRIM(RTRIM(COALESCE(t.Topic,N'')))) THEN N'duplicate_session_assignment' ELSE N'instructor_overlap' END) IssueType,
  CONVERT(nvarchar(16),N'Conflict') Severity,
  CONVERT(nvarchar(max),CONCAT(CONVERT(varchar(16),CONVERT(binary(8),s.SchedulingVersion),2),N'|',CONVERT(varchar(16),CONVERT(binary(8),t.SchedulingVersion),2),N'|',a.AssignmentVersions,N'|',b.AssignmentVersions)) Evidence
 FROM assigned a JOIN assigned b ON b.FacultyId=a.FacultyId AND b.SessionId>a.SessionId
 JOIN paws.Session s ON s.SessionId=a.SessionId JOIN paws.Session t ON t.SessionId=b.SessionId
 WHERE s.AcademicYear=@AcademicYear AND t.AcademicYear=@AcademicYear AND s.SessionDate=t.SessionDate
 AND s.StartTime<s.EndTime AND t.StartTime<t.EndTime AND s.StartTime<t.EndTime AND t.StartTime<s.EndTime
), duplicateAssignments AS (
 SELECT a.FacultyId,s.SessionId,CAST(NULL AS uniqueidentifier) RelatedSessionId,N'duplicate_assignment' IssueType,N'Conflict' Severity,
 CONVERT(nvarchar(max),CONCAT(CONVERT(varchar(16),CONVERT(binary(8),s.SchedulingVersion),2),N'|',a.AssignmentVersions)) Evidence
 FROM assigned a JOIN paws.Session s ON s.SessionId=a.SessionId WHERE s.AcademicYear=@AcademicYear AND a.AssignmentCount>1
), quality AS (
 SELECT a.FacultyId,s.SessionId,CAST(NULL AS uniqueidentifier) RelatedSessionId,
 CASE WHEN s.StartTime IS NOT NULL AND s.EndTime IS NOT NULL AND s.StartTime>=s.EndTime THEN N'invalid_schedule' ELSE N'missing_schedule' END IssueType,N'Needs Review' Severity,
 CONVERT(nvarchar(max),CONCAT(CONVERT(varchar(16),CONVERT(binary(8),s.SchedulingVersion),2),N'|',a.AssignmentVersions)) Evidence
 FROM paws.Session s LEFT JOIN assigned a ON a.SessionId=s.SessionId
 WHERE s.AcademicYear=@AcademicYear AND (s.SessionDate IS NULL OR s.StartTime IS NULL OR s.EndTime IS NULL OR s.StartTime>=s.EndTime OR NULLIF(LTRIM(RTRIM(s.CourseCode)),N'') IS NULL OR a.FacultyId IS NULL)
 UNION ALL
 SELECT CAST(NULL AS uniqueidentifier),s.SessionId,CAST(NULL AS uniqueidentifier),N'missing_schedule',N'Needs Review',
 CONVERT(nvarchar(max),CONCAT(CONVERT(varchar(16),CONVERT(binary(8),s.SchedulingVersion),2),N'|',STRING_AGG(CONVERT(nvarchar(max),CONCAT(a.SessionAssignmentId,N':',CONVERT(varchar(16),CONVERT(binary(8),a.SchedulingVersion),2))),N'|') WITHIN GROUP(ORDER BY a.SessionAssignmentId)))
 FROM paws.Session s JOIN paws.SessionAssignment a ON a.SessionId=s.SessionId AND a.FacultyId IS NULL
 WHERE s.AcademicYear=@AcademicYear AND EXISTS(SELECT 1 FROM assigned own WHERE own.SessionId=s.SessionId)
 GROUP BY s.SessionId,s.SchedulingVersion
), absences AS (
 SELECT AfcRecordId,FacultyId,StartDate,EndDate,CONVERT(varchar(16),CONVERT(binary(8),AfcVersion),2) SourceVersion,N'import' SourceKind FROM paws.AfcRecord WHERE Active=1
 UNION ALL
 SELECT AfcRecordId,FacultyId,StartDate,EndDate,CONVERT(varchar(16),CONVERT(binary(8),AfcVersion),2),N'manual' FROM paws.AfcManualRecord af WHERE af.Active=1 AND NOT EXISTS(SELECT 1 FROM paws.AfcSpecialLeave sl WHERE sl.AfcRecordId=af.AfcRecordId)
), afc AS (
 SELECT a.FacultyId,s.SessionId,CAST(NULL AS uniqueidentifier) RelatedSessionId,N'afc_unavailable' IssueType,N'Conflict' Severity,
 CONVERT(nvarchar(max),CONCAT(CONVERT(varchar(16),CONVERT(binary(8),s.SchedulingVersion),2),N'|',a.AssignmentVersions,N'|',STRING_AGG(CONVERT(nvarchar(max),CONCAT(x.SourceKind,N':',x.AfcRecordId,N':',x.SourceVersion)),N'|') WITHIN GROUP(ORDER BY x.SourceKind,x.AfcRecordId))) Evidence
 FROM assigned a JOIN paws.Session s ON s.SessionId=a.SessionId JOIN absences x ON x.FacultyId=a.FacultyId AND s.SessionDate BETWEEN x.StartDate AND x.EndDate
 WHERE s.AcademicYear=@AcademicYear GROUP BY a.FacultyId,s.SessionId,s.SchedulingVersion,a.AssignmentVersions
), activities AS (
 SELECT a.FacultyId,s.SessionId,CAST(NULL AS uniqueidentifier) RelatedSessionId,k.IssueType,
 CASE WHEN k.IssueType=N'calendar_time_unknown' THEN N'Needs Review' ELSE N'Conflict' END Severity,
 CONVERT(nvarchar(max),CONCAT(CONVERT(varchar(16),CONVERT(binary(8),s.SchedulingVersion),2),N'|',a.AssignmentVersions,N'|',STRING_AGG(CONVERT(nvarchar(max),CONCAT(x.ActivityId,N':',CONVERT(varchar(16),CONVERT(binary(8),x.ActivityVersion),2),N':',CONVERT(varchar(16),CONVERT(binary(8),t.TimeVersion),2))),N'|') WITHIN GROUP(ORDER BY x.ActivityId))) Evidence
 FROM assigned a JOIN paws.Session s ON s.SessionId=a.SessionId
 JOIN paws.CalendarActivity x ON x.FacultyId=a.FacultyId AND s.SessionDate BETWEEN x.StartDate AND x.EndDate
 LEFT JOIN paws.CalendarActivityDayTime t ON t.ActivityId=x.ActivityId AND t.ActivityDate=s.SessionDate
 CROSS APPLY(SELECT CASE WHEN t.ActivityId IS NULL THEN N'calendar_time_unknown' ELSE N'calendar_activity_overlap' END IssueType) k
 WHERE s.AcademicYear=@AcademicYear AND (t.ActivityId IS NULL OR s.StartTime<s.EndTime AND s.StartTime<t.EndTime AND t.StartTime<s.EndTime)
 GROUP BY a.FacultyId,s.SessionId,s.SchedulingVersion,a.AssignmentVersions,k.IssueType
), findings AS (
 SELECT * FROM pairs UNION ALL SELECT * FROM duplicateAssignments UNION ALL SELECT * FROM quality UNION ALL SELECT * FROM afc UNION ALL SELECT * FROM activities
)
SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256',CONVERT(varbinary(max),CONCAT(i.IssueType,N'|',i.SessionId,N'|',i.RelatedSessionId,N'|',i.FacultyId))),2) IssueKey,
 i.FacultyId,i.SessionId,i.RelatedSessionId,i.IssueType,i.Severity,
 CONVERT(varchar(64),HASHBYTES('SHA2_256',CONVERT(varbinary(max),CONCAT(Evidence,N'|',CONVERT(varchar(16),CONVERT(binary(8),v.AssignmentVersion),2),N'|',CONVERT(varchar(16),CONVERT(binary(8),r.AssignmentVersion),2),N'|',allAssignments.Versions))),2) EvidenceVersion
FROM findings i
LEFT JOIN paws.SchedulingAssignmentRevision v ON v.SessionId=i.SessionId
LEFT JOIN paws.SchedulingAssignmentRevision r ON r.SessionId=i.RelatedSessionId
OUTER APPLY(SELECT STRING_AGG(CONVERT(nvarchar(max),CONCAT(a.SessionAssignmentId,N':',CONVERT(varchar(16),CONVERT(binary(8),a.SchedulingVersion),2))),N'|') WITHIN GROUP(ORDER BY a.SessionAssignmentId) Versions
 FROM paws.SessionAssignment a WHERE a.SessionId=i.SessionId OR a.SessionId=i.RelatedSessionId) allAssignments;
GO
CREATE OR ALTER PROCEDURE paws_api.ListFacultyAvailability
 @ActorFirebaseUid nvarchar(128),
 @FacultyId uniqueidentifier,
 @Mode nvarchar(12)=N'upcoming',
 @StartDate date=NULL,
 @EndDate date=NULL,
 @Kind nvarchar(16)=N'all',
 @Cursor int=0,
 @Limit int=50
AS
BEGIN
 SET NOCOUNT ON;
 DECLARE @Role nvarchar(128),@OwnFaculty uniqueidentifier;
 SELECT @Role=LOWER(LTRIM(RTRIM(BaseRole))),@OwnFaculty=FacultyId
 FROM paws.UserProfile
 WHERE FirebaseUid=@ActorFirebaseUid AND Active=1 AND MustChangePassword=0;
 IF @Role IS NULL OR @Role NOT IN(N'developer',N'owner',N'administrator',N'admin',
       N'adfa_general',N'adfa_regular',N'faculty',N'hicc',N'visc')
 THROW 55603,'The account is not authorized for Faculty Availability.',1;
 IF @Role IN(N'faculty',N'hicc',N'visc') AND (@OwnFaculty IS NULL OR @OwnFaculty<>@FacultyId)
 THROW 55603,'Only the linked Faculty availability may be read.',1;
 IF @FacultyId IS NULL OR NOT EXISTS(SELECT 1 FROM paws.Faculty WHERE FacultyId=@FacultyId)
 THROW 55604,'Faculty is not found.',1;
 IF @Mode NOT IN(N'upcoming',N'from',N'range')
 OR @Kind NOT IN(N'all',N'teaching',N'work',N'afc',N'pending',N'role')
 OR (@Mode=N'upcoming' AND (@StartDate IS NOT NULL OR @EndDate IS NOT NULL))
 OR (@Mode=N'from' AND (@StartDate IS NULL OR @EndDate IS NOT NULL))
 OR (@Mode=N'range' AND (@StartDate IS NULL OR @EndDate IS NULL OR @EndDate<@StartDate))
 OR @Limit NOT BETWEEN 1 AND 100 OR @Cursor IS NULL OR @Cursor<0 OR @Cursor>100000
 THROW 55601,'Invalid availability filters.',1;
 DECLARE @NowLocal datetimeoffset=SYSUTCDATETIME() AT TIME ZONE 'UTC' AT TIME ZONE 'Mountain Standard Time';
 DECLARE @Today date=CONVERT(date,@NowLocal),@Clock time(0)=CONVERT(time(0),@NowLocal);
 DECLARE @Floor date=CASE WHEN @Mode=N'upcoming' THEN @Today ELSE @StartDate END;
 DECLARE @Ceiling date=CASE WHEN @Mode=N'range' THEN @EndDate ELSE NULL END;

 CREATE TABLE #Events (
  Kind nvarchar(16) NOT NULL,
  SourceKey nvarchar(100) NOT NULL,
  Label nvarchar(520) NOT NULL,
  StartDate date NOT NULL,
  EndDate date NULL,
  StartTime time(0) NULL,
  EndTime time(0) NULL,
  Availability nvarchar(24) NOT NULL,
  TimeStatus nvarchar(24) NOT NULL,
  CourseCode nvarchar(32) NULL,
  SessionId uniqueidentifier NULL,
  Detail nvarchar(500) NULL,
  TimeEvidence nvarchar(max) NULL
 );

 IF @Kind IN(N'all',N'teaching')
 INSERT #Events(Kind,SourceKey,Label,StartDate,EndDate,StartTime,EndTime,
                Availability,TimeStatus,CourseCode,SessionId,Detail)
 SELECT N'teaching',CONCAT(N'teaching:',CONVERT(nvarchar(36),s.SessionId)),
        CONCAT(COALESCE(NULLIF(s.CourseCode,N''),N'Teaching session'),N' · ',COALESCE(NULLIF(s.SessionType,N''),N'Session')),
        s.SessionDate,s.SessionDate,s.StartTime,s.EndTime,
        CASE WHEN s.StartTime IS NULL OR s.EndTime IS NULL OR s.StartTime>=s.EndTime
             THEN N'time_unconfirmed' ELSE N'busy' END,
        CASE WHEN s.StartTime IS NULL OR s.EndTime IS NULL OR s.StartTime>=s.EndTime
             THEN N'unknown' ELSE N'verified' END,
        s.CourseCode,s.SessionId,LEFT(NULLIF(LTRIM(RTRIM(s.Topic)),N''),500)
 FROM paws.vCalendarSession s
 WHERE s.SessionDate IS NOT NULL
   AND s.SessionDate>=@Floor AND (@Ceiling IS NULL OR s.SessionDate<=@Ceiling)
   AND EXISTS(SELECT 1 FROM paws.SessionAssignment a
              WHERE a.SessionId=s.SessionId AND a.FacultyId=@FacultyId)
   AND (@Mode<>N'upcoming' OR s.SessionDate>@Today
       OR s.EndTime IS NULL OR s.StartTime IS NULL OR s.StartTime>=s.EndTime OR s.EndTime>@Clock);

 IF @Kind IN(N'all',N'work')
 INSERT #Events(Kind,SourceKey,Label,StartDate,EndDate,Availability,TimeStatus,CourseCode,Detail,TimeEvidence)
 SELECT N'work',CONCAT(N'work:',CONVERT(nvarchar(36),a.ActivityId)),
        COALESCE(NULLIF(LEFT(LTRIM(RTRIM(a.OriginalLabel)),520),N''),N'Working activity'),
        a.StartDate,a.EndDate,
        CASE WHEN a.Category=N'remote_work' THEN N'informational'
             WHEN missing.MissingDays>0 THEN N'time_unconfirmed' ELSE N'busy' END,
        CASE WHEN missing.MissingDays>0 AND evidence.EvidenceDays>0 THEN N'partial'
             WHEN missing.MissingDays>0 THEN N'unknown' ELSE N'verified' END,
        c.CourseCode,CONCAT(N'Work beyond teaching · ',a.Category),
        COALESCE((SELECT CONVERT(char(10),t.ActivityDate,23) date,
                         CONVERT(char(5),t.StartTime,108) startTime,
                         CONVERT(char(5),t.EndTime,108) endTime
                  FROM paws.CalendarActivityDayTime t
                  WHERE t.ActivityId=a.ActivityId AND t.ActivityDate BETWEEN a.StartDate AND a.EndDate
                  ORDER BY t.ActivityDate FOR JSON PATH),N'[]')
 FROM paws.CalendarActivity a
 LEFT JOIN paws.Course c ON c.CourseId=a.CourseId
 OUTER APPLY(SELECT COUNT_BIG(*) EvidenceDays FROM paws.CalendarActivityDayTime t WHERE t.ActivityId=a.ActivityId AND t.ActivityDate BETWEEN a.StartDate AND a.EndDate) evidence
 OUTER APPLY(SELECT DATEDIFF(day,a.StartDate,a.EndDate)+1-evidence.EvidenceDays MissingDays) missing
 WHERE a.FacultyId=@FacultyId AND a.StartDate<=COALESCE(@Ceiling,'9999-12-31')
   AND a.EndDate>=@Floor
   AND (@Mode<>N'upcoming' OR a.EndDate>@Today
        OR NOT EXISTS(SELECT 1 FROM paws.CalendarActivityDayTime t WHERE t.ActivityId=a.ActivityId AND t.ActivityDate=@Today)
        OR EXISTS(SELECT 1 FROM paws.CalendarActivityDayTime t WHERE t.ActivityId=a.ActivityId
                  AND t.ActivityDate=@Today AND t.EndTime>@Clock));

 IF @Kind IN(N'all',N'afc')
 INSERT #Events(Kind,SourceKey,Label,StartDate,EndDate,Availability,TimeStatus,Detail)
 SELECT N'afc',CONCAT(N'afc:',a.RecordKey),N'Away from campus',
        a.StartDate,a.EndDate,N'away',N'all_day',N'Approved or recorded AFC'
 FROM paws.vAfcRecordUnified a
 WHERE a.FacultyId=@FacultyId AND a.Active=1
   AND NOT EXISTS(SELECT 1 FROM paws.AfcSpecialLeave sl WHERE a.SourceKind=N'manual' AND sl.AfcRecordId=a.AfcRecordId)
   AND a.EndDate>=@Floor AND (@Ceiling IS NULL OR a.StartDate<=@Ceiling);

 -- Some accepted historical unified views contain only imported/manual AFC.
 -- Include approved requests exactly once using their canonical request identity.
 IF @Kind IN(N'all',N'afc')
 INSERT #Events(Kind,SourceKey,Label,StartDate,EndDate,Availability,TimeStatus,Detail)
 SELECT N'afc',CONCAT(N'afc:request:',CONVERT(nvarchar(36),r.AfcRequestId)),N'Away from campus',
        r.StartDate,r.EndDate,N'away',N'all_day',N'Approved or recorded AFC'
 FROM paws.AfcRequest r
 WHERE r.FacultyId=@FacultyId AND r.Status=N'approved'
   AND r.EndDate>=@Floor AND (@Ceiling IS NULL OR r.StartDate<=@Ceiling)
   AND NOT EXISTS(SELECT 1 FROM paws.vAfcRecordUnified a WHERE a.RecordKey=CONCAT(N'request:',CONVERT(nvarchar(36),r.AfcRequestId)) AND a.Active=1);

 IF @Kind IN(N'all',N'pending')
 INSERT #Events(Kind,SourceKey,Label,StartDate,EndDate,Availability,TimeStatus,Detail)
 SELECT N'pending',CONCAT(N'pending:',CONVERT(nvarchar(36),r.AfcRequestId)),N'Pending absence request',
        r.StartDate,r.EndDate,N'tentative',N'all_day',N'Pending approval; not confirmed leave'
 FROM paws.AfcRequest r
 WHERE r.FacultyId=@FacultyId AND r.Status IN(N'pending_report_to',N'pending_admin')
   AND r.EndDate>=@Floor AND (@Ceiling IS NULL OR r.StartDate<=@Ceiling);

 IF @Kind IN(N'all',N'role')
 BEGIN
  INSERT #Events(Kind,SourceKey,Label,StartDate,EndDate,Availability,TimeStatus,Detail)
  SELECT N'role',CONCAT(N'role:',CONVERT(nvarchar(36),r.RoleAssignmentId),N':',j.[key]),
         COALESCE(NULLIF(r.RoleType,N''),N'Role / appointment'),
         dates.StartDate,dates.EndDate,N'ongoing',N'not_applicable',
         LEFT(COALESCE(NULLIF(r.CourseOrSubjectOrRotation,N''),NULLIF(r.CourseName,N''),N'Ongoing responsibility'),500)
  FROM paws.RoleAssignment r
  JOIN paws.RoleAppointmentSchedule p ON p.RoleAssignmentId=r.RoleAssignmentId
  CROSS APPLY OPENJSON(p.PeriodsJson) j
  CROSS APPLY (SELECT CASE WHEN j.type=5 THEN j.value ELSE N'{}' END PeriodJson) safe
  CROSS APPLY (SELECT TRY_CONVERT(date,JSON_VALUE(safe.PeriodJson,'$.startDate'),23) StartDate,
                      TRY_CONVERT(date,JSON_VALUE(safe.PeriodJson,'$.endDate'),23) EndDate) dates
  WHERE r.FacultyId=@FacultyId AND dates.StartDate IS NOT NULL AND (dates.EndDate IS NULL OR dates.EndDate>=dates.StartDate)
    AND dates.StartDate<=COALESCE(@Ceiling,'9999-12-31')
    AND (dates.EndDate IS NULL OR dates.EndDate>=@Floor);

  INSERT #Events(Kind,SourceKey,Label,StartDate,EndDate,Availability,TimeStatus,Detail)
  SELECT N'role',CONCAT(N'role:',CONVERT(nvarchar(36),r.RoleAssignmentId),N':legacy'),
         COALESCE(NULLIF(r.RoleType,N''),N'Role / appointment'),
         r.EffectiveDate,
         CASE WHEN r.ExpirationDate IS NULL THEN NULL ELSE DATEADD(day,-1,r.ExpirationDate) END,
         N'ongoing',N'not_applicable',
         LEFT(COALESCE(NULLIF(r.CourseOrSubjectOrRotation,N''),NULLIF(r.CourseName,N''),N'Ongoing responsibility'),500)
  FROM paws.RoleAssignment r
  WHERE r.FacultyId=@FacultyId AND NOT EXISTS
       (SELECT 1 FROM paws.RoleAppointmentSchedule p WHERE p.RoleAssignmentId=r.RoleAssignmentId)
    AND r.EffectiveDate IS NOT NULL
    AND (r.ExpirationDate IS NULL OR r.ExpirationDate>r.EffectiveDate)
    AND (r.EffectiveDate IS NULL OR r.EffectiveDate<=COALESCE(@Ceiling,'9999-12-31'))
    AND (r.ExpirationDate IS NULL OR r.ExpirationDate>@Floor);

  -- Authority assignments are independent of imported RoleAssignment rows.
  -- Their expiration is exclusive; retain source identity without guessed deduplication.
  INSERT #Events(Kind,SourceKey,Label,StartDate,EndDate,Availability,TimeStatus,Detail)
  SELECT N'role',CONCAT(N'responsibility:',CONVERT(nvarchar(36),a.ResponsibilityAssigneeId)),
         CONCAT(UPPER(r.Kind),N' responsibility'),a.ActiveDate,DATEADD(day,-1,a.ExpirationDate),
         N'ongoing',N'not_applicable',r.Label
  FROM paws.TeachingResponsibilityAssignee a
  JOIN paws.TeachingResponsibility r ON r.ResponsibilityId=a.ResponsibilityId
  WHERE a.FacultyId=@FacultyId AND a.ActiveDate<=COALESCE(@Ceiling,'9999-12-31')
    AND (a.ExpirationDate IS NULL OR a.ExpirationDate>@Floor);
 END;

 DECLARE @Total int=(SELECT COUNT(*) FROM #Events);
 DECLARE @UndatedSessions int=(SELECT COUNT(DISTINCT s.SessionId) FROM paws.vCalendarSession s
   JOIN paws.SessionAssignment a ON a.SessionId=s.SessionId
   WHERE a.FacultyId=@FacultyId AND s.SessionDate IS NULL);
 DECLARE @UndatedRoles int=(SELECT COUNT(*) FROM paws.RoleAssignment r
   WHERE r.FacultyId=@FacultyId AND (
    ((r.EffectiveDate IS NULL OR r.ExpirationDate<=r.EffectiveDate) AND NOT EXISTS(SELECT 1 FROM paws.RoleAppointmentSchedule p WHERE p.RoleAssignmentId=r.RoleAssignmentId))
    OR EXISTS(SELECT 1 FROM paws.RoleAppointmentSchedule p WHERE p.RoleAssignmentId=r.RoleAssignmentId AND (
      LEFT(LTRIM(p.PeriodsJson),1)<>N'[' OR EXISTS(SELECT 1 FROM OPENJSON(p.PeriodsJson) j
      CROSS APPLY (SELECT CASE WHEN j.type=5 THEN j.value ELSE N'{}' END PeriodJson) safe
      WHERE j.type<>5 OR TRY_CONVERT(date,JSON_VALUE(safe.PeriodJson,'$.startDate'),23) IS NULL
       OR (JSON_VALUE(safe.PeriodJson,'$.endDate') IS NOT NULL AND (TRY_CONVERT(date,JSON_VALUE(safe.PeriodJson,'$.endDate'),23) IS NULL
           OR TRY_CONVERT(date,JSON_VALUE(safe.PeriodJson,'$.endDate'),23)<TRY_CONVERT(date,JSON_VALUE(safe.PeriodJson,'$.startDate'),23))))))));
 SELECT (SELECT JSON_QUERY(COALESCE((
   SELECT e.SourceKey eventKey,e.Kind kind,e.Label label,
          CONVERT(char(10),e.StartDate,23) startDate,
          CONVERT(char(10),e.EndDate,23) endDate,
          CONVERT(char(5),e.StartTime,108) startTime,
          CONVERT(char(5),e.EndTime,108) endTime,
          e.Availability availability,e.TimeStatus timeStatus,
          e.CourseCode courseCode,CONVERT(nvarchar(36),e.SessionId) sessionId,
          e.Detail detail,JSON_QUERY(e.TimeEvidence) timeEvidence
   FROM #Events e
   ORDER BY e.StartDate,ISNULL(e.StartTime,'00:00:00'),e.Kind,e.SourceKey
   OFFSET @Cursor ROWS FETCH NEXT @Limit ROWS ONLY
   FOR JSON PATH,INCLUDE_NULL_VALUES
 ),N'[]')) items,
 @Total total,
 CASE WHEN @Total>@Cursor+@Limit THEN CONVERT(varchar(20),@Cursor+@Limit) END nextCursor,
 CONVERT(char(10),@Today,23) today,
 JSON_QUERY((SELECT @UndatedSessions undatedSessions,@UndatedRoles undatedRoles
  FOR JSON PATH,WITHOUT_ARRAY_WRAPPER)) coverage
 FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES) responseJson;
END;
GO
CREATE OR ALTER PROCEDURE paws_api.ListChangeHistoryEvents
 @ActorFirebaseUid nvarchar(128),@Scope nvarchar(16),@StartUtc datetime2(7),@EndExclusiveUtc datetime2(7)
AS
BEGIN
 SET NOCOUNT ON;
 DECLARE @Role nvarchar(128),@Faculty uniqueidentifier,@Admin bit=0;
 SELECT @Role=LOWER(LTRIM(RTRIM(BaseRole))),@Faculty=FacultyId FROM paws.UserProfile
 WHERE FirebaseUid=@ActorFirebaseUid AND Active=1 AND MustChangePassword=0;
 IF @Role IS NULL OR @Role NOT IN(N'owner',N'administrator',N'admin',N'developer',N'adfa_general',N'adfa_regular',N'faculty',N'hicc',N'visc',N'adc',N'lab')
 OR (@Role IN(N'faculty',N'hicc',N'visc') AND @Faculty IS NULL) THROW 54701,'History role denied.',1;
 IF @Scope NOT IN(N'mine',N'timetable',N'dashboard') OR @StartUtc IS NULL OR @EndExclusiveUtc IS NULL OR @StartUtc>=@EndExclusiveUtc
 THROW 54702,'Invalid history range or scope.',1;
 IF @Scope=N'mine' AND @Faculty IS NULL THROW 54703,'My history requires a faculty link.',1;
 IF @Role IN(N'owner',N'administrator',N'admin',N'developer',N'adfa_general',N'adfa_regular') SET @Admin=1;
 SELECT TOP(10001) * INTO #HistoryEvents FROM (
 SELECT N'audit' source,CONVERT(nvarchar(36),e.AuditEventId) eventId,e.EventType eventType,e.EntityType entityType,e.EntityId entityId,
 e.OccurredAtUtc occurredAtUtc,e.BeforeJson beforeJson,e.AfterJson afterJson,e.MetadataJson metadataJson,c.ContextJson contextJson,
 e.ActorName actorName,CAST(NULL AS nvarchar(32)) academicYear,CAST(NULL AS uniqueidentifier) facultyId
 FROM paws.AuditEvent e LEFT JOIN paws.ChangeHistoryContext c ON c.AuditEventId=e.AuditEventId
 WHERE e.OccurredAtUtc>=@StartUtc AND e.OccurredAtUtc<@EndExclusiveUtc AND (
 (@Scope IN(N'mine',N'timetable') AND e.EventType IN(N'session_updated',N'session_created',N'session_assignments_replaced',N'swap_applied',N'session_deleted')
 AND (@Scope=N'timetable' OR EXISTS(SELECT 1 FROM paws_api.HistoryAffectedFaculty(e.BeforeJson,e.AfterJson,c.ContextJson) af WHERE af.FacultyId=@Faculty)))
 OR (@Scope=N'dashboard' AND @Admin=1 AND e.EventType=N'afc_special_leave_deduction_confirmed')
 OR (@Scope=N'dashboard' AND e.EventType IN(N'FacultyUpdated',N'FacultyDeactivated',N'FacultyRestored',N'role_periods_updated',N'trainee_source_refreshed',N'trainee_source_recovered',N'afc_form_uploaded',N'afc_form_linked',N'afc_record_created',N'afc_record_cancelled',N'afc_dates_changed',N'afc_date_change_requested',N'afc_request_submitted',N'afc_request_withdrawn',N'afc_request_recommended',N'afc_request_approved',N'afc_request_rejected')
 AND (@Admin=1 OR EXISTS(SELECT 1 FROM paws_api.HistoryAffectedFaculty(e.BeforeJson,e.AfterJson,c.ContextJson) af WHERE af.FacultyId=@Faculty)
 OR(e.EventType IN(N'afc_form_uploaded',N'afc_form_linked',N'afc_record_created',N'afc_record_cancelled',N'afc_dates_changed',N'afc_date_change_requested',N'afc_request_submitted',N'afc_request_withdrawn',N'afc_request_recommended',N'afc_request_approved',N'afc_request_rejected') AND TRY_CONVERT(uniqueidentifier,JSON_VALUE(e.MetadataJson,'$.facultyId'))=@Faculty)
 OR(e.EventType IN(N'FacultyUpdated',N'FacultyDeactivated',N'FacultyRestored') AND TRY_CONVERT(uniqueidentifier,e.EntityId)=@Faculty)))
 )
 UNION ALL
 SELECT N'doe',CONVERT(nvarchar(36),e.AuditEventId),e.Action,e.EntityType,e.EntityId,e.ChangedAtUtc,e.BeforeJson,e.AfterJson,NULL,
 (SELECT CONVERT(bit,CASE WHEN EXISTS(SELECT 1 FROM paws.DoePolicyPublication p WHERE p.PolicyVersionId=e.PolicyVersionId) THEN 1 ELSE 0 END) wasPublished FOR JSON PATH,WITHOUT_ARRAY_WRAPPER),
 e.ActorName,e.AcademicYear,e.FacultyId
 FROM paws.DoeAuditEvent e WHERE @Scope=N'dashboard' AND e.ChangedAtUtc>=@StartUtc AND e.ChangedAtUtc<@EndExclusiveUtc
 AND ((e.EntityType=N'doe_policy_version' AND e.Action IN(N'draft_created',N'draft_updated',N'working_draft_created',N'published',N'archived')
 AND (@Admin=1 OR e.Action=N'published' OR(e.Action=N'archived' AND EXISTS(SELECT 1 FROM paws.DoePolicyPublication p WHERE p.PolicyVersionId=e.PolicyVersionId AND p.PublishedAtUtc<=e.ChangedAtUtc))))
 OR(e.EntityType IN(N'doe_assignment',N'faculty_doe_target',N'manual_doe_assignment') AND (@Admin=1 OR e.FacultyId=@Faculty)))
 UNION ALL
 -- Receipt/recovery bindings prove historical membership without inferring it
 -- from today's assignments. Only immutable source activity facts are selected;
 -- confidential AFC recovery before-images never leave this read procedure.
 SELECT N'work',CONCAT(CONVERT(nvarchar(36),e.AuditEventId),N':',CONVERT(nvarchar(36),recovery.ActivityId)),e.EventType,N'calendar_activity',CONVERT(nvarchar(256),recovery.ActivityId),e.OccurredAtUtc,
 CASE WHEN e.EventType=N'calendar_activity_import_recovered' THEN(SELECT item.FacultyId facultyId,item.OriginalLabel label,item.Category category,item.StartDate startDate,item.EndDate endDate FOR JSON PATH,WITHOUT_ARRAY_WRAPPER) END,
 CASE WHEN e.EventType=N'calendar_activity_import_committed' THEN(SELECT item.FacultyId facultyId,item.OriginalLabel label,item.Category category,item.StartDate startDate,item.EndDate endDate FOR JSON PATH,WITHOUT_ARRAY_WRAPPER) END,NULL,NULL,
 e.ActorName,NULL,item.FacultyId
 FROM paws.AuditEvent e JOIN paws.CalendarActivityImportReceipt receipt ON receipt.ReceiptId=TRY_CONVERT(uniqueidentifier,e.EntityId)
 JOIN paws.CalendarActivityRecoveryRow recovery ON recovery.ReceiptId=receipt.ReceiptId
 JOIN staging.CalendarActivityImportItem item ON item.ImportBatchId=receipt.ImportBatchId AND item.AfcRecordId=recovery.OriginalAfcRecordId
 WHERE @Scope IN(N'mine',N'dashboard') AND e.EventType IN(N'calendar_activity_import_committed',N'calendar_activity_import_recovered')
 AND e.OccurredAtUtc>=@StartUtc AND e.OccurredAtUtc<@EndExclusiveUtc
 AND ((@Scope=N'dashboard' AND @Admin=1) OR item.FacultyId=@Faculty)
 UNION ALL
 SELECT N'work',CONVERT(nvarchar(36),e.AuditEventId),e.EventType,e.EntityType,e.EntityId,e.OccurredAtUtc,e.BeforeJson,JSON_QUERY(c.ContextJson,'$.workActivity'),NULL,c.ContextJson,
 e.ActorName,NULL,TRY_CONVERT(uniqueidentifier,JSON_VALUE(c.ContextJson,'$.facultyId'))
 FROM paws.AuditEvent e LEFT JOIN paws.ChangeHistoryContext c ON c.AuditEventId=e.AuditEventId
 WHERE e.EventType=N'calendar_activity_time_resolved' AND @Scope IN(N'mine',N'dashboard')
 AND e.OccurredAtUtc>=@StartUtc AND e.OccurredAtUtc<@EndExclusiveUtc
 AND ((@Scope=N'dashboard' AND @Admin=1) OR TRY_CONVERT(uniqueidentifier,JSON_VALUE(c.ContextJson,'$.facultyId'))=@Faculty)
 UNION ALL
 SELECT N'work',CONVERT(nvarchar(36),e.AuditEventId),e.EventType,e.EntityType,e.EntityId,e.OccurredAtUtc,e.BeforeJson,e.AfterJson,NULL,NULL,
 e.ActorName,NULL,COALESCE(TRY_CONVERT(uniqueidentifier,JSON_VALUE(e.AfterJson,'$.facultyId')),TRY_CONVERT(uniqueidentifier,JSON_VALUE(e.BeforeJson,'$.facultyId')))
 FROM paws.AuditEvent e WHERE e.EventType IN(N'ccc_activity_added',N'ccc_activity_removed') AND @Scope IN(N'mine',N'dashboard')
 AND e.OccurredAtUtc>=@StartUtc AND e.OccurredAtUtc<@EndExclusiveUtc
 AND ((@Scope=N'dashboard' AND @Admin=1) OR EXISTS(SELECT 1 FROM paws_api.HistoryAffectedFaculty(e.BeforeJson,e.AfterJson,NULL) affected WHERE affected.FacultyId=@Faculty))
 ) events ORDER BY occurredAtUtc DESC,source,eventId;
 IF (SELECT COUNT(*) FROM #HistoryEvents)>10000 OR (SELECT COALESCE(SUM(CONVERT(bigint,COALESCE(DATALENGTH(beforeJson),0))+COALESCE(DATALENGTH(afterJson),0)+COALESCE(DATALENGTH(contextJson),0)+COALESCE(DATALENGTH(metadataJson),0)),0) FROM #HistoryEvents)>12582912
 THROW 54704,'Narrow the history range before reading.',1;
 -- Resolve only proven historical IDs to opaque filter keys. Today's roster is
 -- never evidence of affected membership; current names label the filter only.
 SELECT events.*,(
 SELECT candidate.FacultyId facultyId,candidate.CandidateKey facultyKey,
 COALESCE(NULLIF(LTRIM(RTRIM(CONCAT(f.PreferredFirstName,N' ',f.PreferredLastName))),N''),f.DisplayName) displayName
 FROM paws.SwapCandidate candidate JOIN paws.Faculty f ON f.FacultyId=candidate.FacultyId
 WHERE candidate.FacultyId IN(
 SELECT FacultyId FROM paws_api.HistoryAffectedFaculty(events.beforeJson,events.afterJson,events.contextJson)
 UNION SELECT events.facultyId WHERE events.facultyId IS NOT NULL
 UNION SELECT TRY_CONVERT(uniqueidentifier,JSON_VALUE(events.metadataJson,'$.facultyId')) WHERE events.eventType IN(N'afc_form_uploaded',N'afc_form_linked',N'afc_record_created',N'afc_record_cancelled',N'afc_dates_changed',N'afc_date_change_requested',N'afc_request_submitted',N'afc_request_withdrawn',N'afc_request_recommended',N'afc_request_approved',N'afc_request_rejected')
 UNION SELECT TRY_CONVERT(uniqueidentifier,events.entityId) WHERE events.eventType IN(N'FacultyUpdated',N'FacultyDeactivated',N'FacultyRestored')
 ) FOR JSON PATH) directoryFacultyJson
 FROM #HistoryEvents events ORDER BY occurredAtUtc DESC,source,eventId;
END;
GO
COMMIT TRANSACTION;
