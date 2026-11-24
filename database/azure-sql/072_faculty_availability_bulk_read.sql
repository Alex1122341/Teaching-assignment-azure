/* Add a read-only set projection of the same committed PAWS sources used by
   ListFacultyAvailability (056/068). The existing procedure remains available
   to legacy callers. No persisted availability data or business updates. */
:ON ERROR EXIT
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
IF DB_NAME()<>N'VetMed-Ops'
 OR OBJECT_ID(N'paws_api.ListFacultyAvailability',N'P') IS NULL
 OR OBJECT_ID(N'paws.AfcSpecialLeave',N'U') IS NULL
 OR OBJECT_ID(N'paws.vCalendarSession',N'V') IS NULL
 OR OBJECT_ID(N'paws.vAfcRecordUnified',N'V') IS NULL
 OR COL_LENGTH(N'paws.Faculty',N'ActivationDate') IS NULL
 OR COL_LENGTH(N'paws.CalendarActivity',N'StaffingKind') IS NULL
 OR DATABASE_PRINCIPAL_ID(N'paws_runtime_read') IS NULL
 OR OBJECT_ID(N'paws_api.ListFacultyAvailabilityBulk') IS NOT NULL
 OR EXISTS(SELECT 1 FROM sys.schemas WHERE name IN(N'paws',N'paws_api') AND principal_id<>DATABASE_PRINCIPAL_ID(N'dbo'))
 THROW 57200,'Inspect Faculty Availability sources, schema owners and prior deployment before applying.',1;
BEGIN TRANSACTION;
GO
CREATE PROCEDURE paws_api.ListFacultyAvailabilityBulk
 @ActorFirebaseUid nvarchar(128),
 @Action nvarchar(12),
 @Selection nvarchar(12)=N'selected',
 @FacultyIdsJson nvarchar(max)=N'[]',
 @IncludeInactive bit=0,
 @Mode nvarchar(12)=N'upcoming',
 @StartDate date=NULL,
 @EndDate date=NULL,
 @RosterSearch nvarchar(128)=NULL,
 @RosterOffset int=0
AS
BEGIN
 SET NOCOUNT ON;
 DECLARE @Role nvarchar(128),@OwnFaculty uniqueidentifier,@Admin bit=0;
 SELECT @Role=LOWER(LTRIM(RTRIM(BaseRole))),@OwnFaculty=FacultyId
 FROM paws.UserProfile
 WHERE FirebaseUid COLLATE Latin1_General_100_BIN2=@ActorFirebaseUid COLLATE Latin1_General_100_BIN2
   AND Active=1 AND MustChangePassword=0;
 IF @Role IN(N'developer',N'owner',N'administrator',N'admin',N'adfa_general',N'adfa_regular') SET @Admin=1;
 IF @Role IS NULL OR (@Admin=0 AND (@Role NOT IN(N'faculty',N'hicc',N'visc') OR @OwnFaculty IS NULL))
  THROW 55603,'The account is not authorized for Faculty Availability.',1;
 IF @Action IS NULL OR @Action NOT IN(N'roster',N'query',N'check')
  OR @Selection IS NULL OR @Selection NOT IN(N'selected',N'allActive')
  OR @IncludeInactive IS NULL
  OR (@Action=N'check' AND @Selection<>N'selected')
  OR (@Action=N'query' AND @Selection=N'allActive' AND @IncludeInactive=1)
  OR COALESCE(ISJSON(@FacultyIdsJson),0)<>1 OR LEFT(LTRIM(@FacultyIdsJson),1)<>N'['
  OR DATALENGTH(@FacultyIdsJson)>50000
  OR @Mode IS NULL OR @Mode NOT IN(N'upcoming',N'from',N'range')
  OR (@Mode=N'upcoming' AND (@StartDate IS NOT NULL OR @EndDate IS NOT NULL))
  OR (@Mode=N'from' AND (@StartDate IS NULL OR @EndDate IS NOT NULL))
  OR (@Mode=N'range' AND (@StartDate IS NULL OR @EndDate IS NULL OR @StartDate<'0001-01-02' OR @EndDate>'9999-12-30'
       OR DATEDIFF(day,@StartDate,@EndDate) NOT BETWEEN 0 AND 30))
  OR @RosterOffset IS NULL OR @RosterOffset NOT BETWEEN 0 AND 100000 OR @RosterOffset%500<>0
  OR (@Action<>N'roster' AND (@RosterSearch IS NOT NULL OR @RosterOffset<>0))
  THROW 55601,'Invalid Faculty Availability filters.',1;
 IF @Admin=0 AND (@IncludeInactive=1 OR @Selection=N'allActive')
  THROW 55603,'Only the linked Faculty availability may be read.',1;

 DECLARE @Ids TABLE(FacultyId uniqueidentifier PRIMARY KEY);
 DECLARE @IdCount int=(SELECT COUNT(*) FROM OPENJSON(@FacultyIdsJson));
 IF @IdCount>500 OR EXISTS(SELECT 1 FROM OPENJSON(@FacultyIdsJson)
        WHERE type<>1 OR DATALENGTH(value)<>72 OR TRY_CONVERT(uniqueidentifier,value) IS NULL)
  OR ((@Action=N'roster' OR @Selection=N'allActive') AND @IdCount<>0)
  OR (@Action<>N'roster' AND @Selection=N'selected' AND @IdCount=0)
  THROW 55601,'Invalid Faculty Availability selection.',1;
 INSERT @Ids SELECT DISTINCT CONVERT(uniqueidentifier,value) FROM OPENJSON(@FacultyIdsJson);
 IF @@ROWCOUNT<>@IdCount THROW 55601,'Faculty IDs must be unique.',1;
 IF @Admin=0 AND @Action<>N'roster' AND (@IdCount<>1 OR NOT EXISTS(SELECT 1 FROM @Ids WHERE FacultyId=@OwnFaculty))
  THROW 55603,'Only the linked Faculty availability may be read.',1;

 DECLARE @Local datetimeoffset=SYSUTCDATETIME() AT TIME ZONE 'UTC' AT TIME ZONE 'Mountain Standard Time';
 DECLARE @Today date=CONVERT(date,@Local),@Clock time(0)=CONVERT(time(0),@Local);
 DECLARE @Floor date=CASE WHEN @Mode=N'upcoming' THEN @Today ELSE @StartDate END;
 DECLARE @Ceiling date=COALESCE(@EndDate,CONVERT(date,'9999-12-31'));
 IF @Action=N'roster'
 BEGIN
  SELECT f.FacultyId,f.PreferredFirstName,f.PreferredLastName,f.DisplayName,
   CONVERT(bit,CASE WHEN f.Active=1 AND (f.ActivationDate IS NULL OR f.ActivationDate<=@Today) THEN 1 ELSE 0 END) AS Active
  INTO #Roster
  FROM paws.Faculty f
  WHERE @Admin=1 OR f.FacultyId=@OwnFaculty;
  DECLARE @ActiveTotal int=(SELECT COUNT(*) FROM #Roster WHERE Active=1),@RosterTotal int;
  SELECT f.* INTO #Matches FROM #Roster f
  WHERE (@IncludeInactive=1 OR f.Active=1) AND NOT EXISTS(
   SELECT 1 FROM STRING_SPLIT(@RosterSearch,N' ') token WHERE token.value<>N''
    AND CHARINDEX(token.value COLLATE Latin1_General_100_CI_AI,
      CONCAT(f.PreferredLastName,N' ',f.PreferredFirstName,N' ',f.DisplayName) COLLATE Latin1_General_100_CI_AI)=0);
  SET @RosterTotal=@@ROWCOUNT;
  SELECT (SELECT JSON_QUERY(COALESCE((SELECT FacultyId AS facultyId,PreferredFirstName AS preferredFirstName,
      PreferredLastName AS preferredLastName,DisplayName AS displayName,Active AS active
      FROM #Matches ORDER BY FacultyId OFFSET @RosterOffset ROWS FETCH NEXT 500 ROWS ONLY FOR JSON PATH),N'[]')) AS faculty,
      @ActiveTotal AS activeTotal,@RosterTotal AS total,
      CASE WHEN @RosterTotal>@RosterOffset+500 THEN CONVERT(varchar(20),@RosterOffset+500) END AS nextCursor
      FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES) AS responseJson;
  RETURN;
 END;
 SELECT TOP (501) f.FacultyId,f.PreferredFirstName,f.PreferredLastName,f.DisplayName,
   active.EffectiveActive AS Active
 INTO #Faculty
 FROM paws.Faculty f
 CROSS APPLY(SELECT CONVERT(bit,CASE WHEN f.Active=1 AND (f.ActivationDate IS NULL OR f.ActivationDate<=@Today)
                                THEN 1 ELSE 0 END) EffectiveActive) active
 WHERE (@Admin=1 OR f.FacultyId=@OwnFaculty)
   AND (@IncludeInactive=1 OR active.EffectiveActive=1)
   AND (@Selection=N'allActive' OR EXISTS(SELECT 1 FROM @Ids i WHERE i.FacultyId=f.FacultyId))
 ORDER BY f.FacultyId;
 IF (SELECT COUNT(*) FROM #Faculty)>500 THROW 57205,'Faculty selection exceeds the query limit.',1;
 IF @Selection=N'selected' AND (SELECT COUNT(*) FROM #Faculty)<>@IdCount
  THROW 55604,'A selected Faculty is inactive or no longer exists.',1;
 IF @Action=N'check'
 BEGIN
  SELECT N'{"authorized":true}' AS responseJson;
  RETURN;
 END;

 -- Source keys deduplicate repeat instructor assignments and the two approved AFC projections.
 CREATE UNIQUE CLUSTERED INDEX IX_FacultySelection ON #Faculty(FacultyId);
  SELECT r.FacultyId,r.RoleAssignmentId,r.RoleType,
    LEFT(COALESCE(NULLIF(r.CourseOrSubjectOrRotation,N''),r.CourseName),500) AS Detail,
    CASE WHEN p.RoleAssignmentId IS NULL THEN N'legacy' ELSE j.[key] END AS PeriodKey,
    CASE WHEN p.RoleAssignmentId IS NULL THEN r.EffectiveDate ELSE dates.StartDate END AS StartDate,
    CASE WHEN p.RoleAssignmentId IS NULL AND r.ExpirationDate>r.EffectiveDate THEN DATEADD(day,-1,r.ExpirationDate)
         WHEN p.RoleAssignmentId IS NULL THEN NULL ELSE dates.EndDate END AS EndDate,
    CASE WHEN p.RoleAssignmentId IS NULL AND (r.EffectiveDate IS NULL OR r.ExpirationDate<=r.EffectiveDate) THEN 1
         WHEN p.RoleAssignmentId IS NOT NULL AND LEFT(LTRIM(p.PeriodsJson),1)<>N'[' THEN 1
         WHEN p.RoleAssignmentId IS NOT NULL AND j.[key] IS NULL THEN 0
         WHEN p.RoleAssignmentId IS NOT NULL AND (j.type<>5 OR ISNULL(fields.StartCount,0)<>1 OR dates.StartDate IS NULL OR
              DATALENGTH(fields.StartText)<>20 OR CONVERT(nvarchar(10),dates.StartDate,23)<>fields.StartText OR
              ISNULL(fields.EndCount,0)>1 OR
              (fields.EndType IS NOT NULL AND fields.EndType<>0 AND
               (fields.EndType<>1 OR dates.EndDate IS NULL OR DATALENGTH(fields.EndText)<>20 OR
                CONVERT(nvarchar(10),dates.EndDate,23)<>fields.EndText OR dates.EndDate<dates.StartDate))) THEN 1
         ELSE 0 END AS HasMissingDates
  INTO #Appointments
  FROM paws.RoleAssignment r
  JOIN #Faculty f ON f.FacultyId=r.FacultyId
  LEFT JOIN paws.RoleAppointmentSchedule p ON p.RoleAssignmentId=r.RoleAssignmentId
  OUTER APPLY OPENJSON(p.PeriodsJson) j
  CROSS APPLY (
   SELECT COUNT(CASE WHEN item.[key]=N'startDate' THEN 1 END) AS StartCount,
     MAX(CASE WHEN item.[key]=N'startDate' AND item.type=1 THEN item.value END) AS StartText,
     COUNT(CASE WHEN item.[key]=N'endDate' THEN 1 END) AS EndCount,
     MAX(CASE WHEN item.[key]=N'endDate' THEN item.type END) AS EndType,
     MAX(CASE WHEN item.[key]=N'endDate' AND item.type=1 THEN item.value END) AS EndText
   FROM OPENJSON(CASE WHEN j.type=5 THEN j.value ELSE N'{}' END) item
  ) fields
  CROSS APPLY (SELECT TRY_CONVERT(date,fields.StartText,23) AS StartDate,
                      TRY_CONVERT(date,fields.EndText,23) AS EndDate) dates;
 ;WITH assigned AS (
  SELECT DISTINCT a.FacultyId,a.SessionId
  FROM paws.SessionAssignment a JOIN #Faculty f ON f.FacultyId=a.FacultyId
 ), events AS (
  SELECT a.FacultyId,N'teaching' AS Kind,CONCAT(N'teaching:',CONVERT(nvarchar(36),s.SessionId)) COLLATE DATABASE_DEFAULT AS EventKey,
    s.SessionType COLLATE DATABASE_DEFAULT AS [Type],CONVERT(nvarchar(520),NULL) AS Label,
    LEFT(NULLIF(s.Topic,N''),500) COLLATE DATABASE_DEFAULT AS Detail,
    s.SessionDate AS StartDate,s.SessionDate AS EndDate,s.StartTime,s.EndTime,
    s.CourseCode COLLATE DATABASE_DEFAULT AS CourseCode,s.SessionId,CONVERT(uniqueidentifier,NULL) AS ActivityId
  FROM assigned a JOIN paws.vCalendarSession s ON s.SessionId=a.SessionId
  WHERE s.SessionDate BETWEEN @Floor AND @Ceiling
  UNION ALL
  SELECT a.FacultyId,N'work',CONCAT(N'work:',CONVERT(nvarchar(36),a.ActivityId)),a.Category COLLATE DATABASE_DEFAULT,NULL,NULL,
    a.StartDate,a.EndDate,NULL,NULL,c.CourseCode COLLATE DATABASE_DEFAULT,NULL,a.ActivityId
  FROM paws.CalendarActivity a
  JOIN #Faculty f ON f.FacultyId=a.FacultyId
  LEFT JOIN paws.Course c ON c.CourseId=a.CourseId
  WHERE a.StartDate<=@Ceiling AND a.EndDate>=@Floor
   AND a.StaffingKind<>N'unassigned'
  UNION ALL
  SELECT a.FacultyId,N'afc',CONCAT(N'afc:',a.RecordKey) COLLATE DATABASE_DEFAULT,NULL,NULL,NULL,a.StartDate,a.EndDate,NULL,NULL,NULL,NULL,NULL
  FROM paws.vAfcRecordUnified a
  JOIN #Faculty f ON f.FacultyId=a.FacultyId
  WHERE a.Active=1 AND a.StartDate<=@Ceiling AND a.EndDate>=@Floor
   AND NOT EXISTS(SELECT 1 FROM paws.AfcSpecialLeave sl WHERE a.SourceKind=N'manual' AND sl.AfcRecordId=a.AfcRecordId)
  UNION ALL
  SELECT r.FacultyId,CASE WHEN r.Status=N'approved' THEN N'afc' ELSE N'pending' END,
    CONCAT(CASE WHEN r.Status=N'approved' THEN N'afc:request:' ELSE N'pending:' END,CONVERT(nvarchar(36),r.AfcRequestId)),
    NULL,NULL,NULL,r.StartDate,r.EndDate,NULL,NULL,NULL,NULL,NULL
  FROM paws.AfcRequest r JOIN #Faculty f ON f.FacultyId=r.FacultyId
  WHERE r.Status IN(N'approved',N'pending_report_to',N'pending_admin') AND r.StartDate<=@Ceiling AND r.EndDate>=@Floor
   AND (r.Status<>N'approved' OR NOT EXISTS(SELECT 1 FROM paws.vAfcRecordUnified a
          WHERE a.FacultyId=r.FacultyId AND a.Active=1 AND a.RecordKey=CONCAT(N'request:',CONVERT(nvarchar(36),r.AfcRequestId))))
  UNION ALL
  SELECT a.FacultyId,N'role',CONCAT(N'role:',CONVERT(nvarchar(36),a.RoleAssignmentId),N':',a.PeriodKey) COLLATE DATABASE_DEFAULT,
    NULL,COALESCE(NULLIF(a.RoleType,N''),N'Role / appointment') COLLATE DATABASE_DEFAULT,a.Detail COLLATE DATABASE_DEFAULT,
    a.StartDate,a.EndDate,NULL,NULL,NULL,NULL,NULL
  FROM #Appointments a
  WHERE a.HasMissingDates=0 AND a.StartDate<=@Ceiling AND (a.EndDate IS NULL OR a.EndDate>=@Floor)
  UNION ALL
  SELECT a.FacultyId,N'role',CONCAT(N'responsibility:',CONVERT(nvarchar(36),a.ResponsibilityAssigneeId)),
    NULL,CONCAT(UPPER(r.Kind),N' responsibility') COLLATE DATABASE_DEFAULT,r.Label COLLATE DATABASE_DEFAULT,
    a.ActiveDate,DATEADD(day,-1,a.ExpirationDate),NULL,NULL,NULL,NULL,NULL
  FROM paws.TeachingResponsibilityAssignee a
  JOIN #Faculty f ON f.FacultyId=a.FacultyId
  JOIN paws.TeachingResponsibility r ON r.ResponsibilityId=a.ResponsibilityId
  WHERE a.ActiveDate<=@Ceiling AND (a.ExpirationDate IS NULL OR a.ExpirationDate>@Floor)
 )
 SELECT TOP (15001) *
 INTO #Events
 FROM events
 ORDER BY StartDate,StartTime,FacultyId,Kind,EventKey;

 DECLARE @Complete bit=CASE WHEN @@ROWCOUNT>15000 THEN 0 ELSE 1 END;
 SELECT TOP (20001) t.ActivityId,t.ActivityDate,t.StartTime,t.EndTime
 INTO #DayTimes
 FROM #Events e JOIN paws.CalendarActivityDayTime t ON t.ActivityId=e.ActivityId
 WHERE t.ActivityDate BETWEEN @Floor AND @Ceiling AND t.ActivityDate BETWEEN e.StartDate AND e.EndDate;
 IF @@ROWCOUNT>20000 THROW 57205,'Daily availability evidence exceeds the query limit.',1;
 CREATE CLUSTERED INDEX IX_AvailabilityDayTimes ON #DayTimes(ActivityId,ActivityDate);

 -- Retain today's evidence through projection so ambiguous clocks can be
 -- handled before excluding elapsed records. Self-service sees date gaps only.
 SELECT DISTINCT TOP (501) s.SessionDate,
   CASE WHEN @Admin=1 THEN s.StartTime END AS EvidenceStart,
   CASE WHEN @Admin=1 THEN s.EndTime END AS EvidenceEnd
 INTO #UnlinkedSessions
 FROM paws.vCalendarSession s
 WHERE (s.SessionDate IS NULL OR s.SessionDate BETWEEN @Floor AND @Ceiling)
   AND EXISTS(SELECT 1 FROM paws.SessionAssignment a WHERE a.SessionId=s.SessionId AND a.FacultyId IS NULL
      AND a.FacultyResolutionStatus IN(N'unresolved',N'ambiguous'))
 ORDER BY s.SessionDate,EvidenceStart,EvidenceEnd;
 IF @@ROWCOUNT>500 SET @Complete=0;
 DECLARE @ClockDates TABLE(ClockDate date PRIMARY KEY);
 DECLARE @ClockChanges nvarchar(max)=N'[]';
 IF @Mode=N'range'
 BEGIN
  ;WITH days AS (SELECT @Floor AS ClockDate UNION ALL SELECT DATEADD(day,1,ClockDate) FROM days WHERE ClockDate<@Ceiling)
  INSERT @ClockDates SELECT ClockDate FROM days OPTION (MAXRECURSION 32);
 END
 ELSE
  INSERT @ClockDates
   SELECT StartDate FROM #Events WHERE Kind=N'teaching' AND StartTime IS NOT NULL AND EndTime IS NOT NULL
     AND StartDate BETWEEN '0001-01-02' AND '9999-12-30'
   UNION SELECT ActivityDate FROM #DayTimes WHERE ActivityDate BETWEEN '0001-01-02' AND '9999-12-30'
   UNION SELECT SessionDate FROM #UnlinkedSessions WHERE EvidenceStart IS NOT NULL AND EvidenceEnd IS NOT NULL
     AND SessionDate BETWEEN '0001-01-02' AND '9999-12-30'
   UNION SELECT @Today WHERE @Mode=N'upcoming';

 -- Use the same Windows Calgary zone as @Today. Check only transition dates
 -- at hourly resolution, including timed evidence in the open-ended Agenda.
 ;WITH hours AS (
  SELECT 0 AS N UNION ALL SELECT N+1 FROM hours WHERE N<36
 ), possible AS (
  SELECT ClockDate,CONVERT(datetime2(0),ClockDate) AS Midnight FROM @ClockDates
  WHERE DATEPART(TZOFFSET,CONVERT(datetime2(0),ClockDate) AT TIME ZONE 'Mountain Standard Time')
    <>DATEPART(TZOFFSET,DATEADD(hour,23,CONVERT(datetime2(0),ClockDate)) AT TIME ZONE 'Mountain Standard Time')
 ), utcOffsets AS (
  SELECT p.ClockDate,tick.UtcTime,
   DATEPART(TZOFFSET,tick.UtcTime AT TIME ZONE 'UTC' AT TIME ZONE 'Mountain Standard Time') AS OffsetMinutes
  FROM possible p CROSS JOIN hours
  CROSS APPLY(SELECT DATEADD(hour,hours.N,p.Midnight) AS UtcTime) tick
 ), edges AS (
  SELECT ClockDate,UtcTime,OffsetMinutes,LAG(OffsetMinutes) OVER(PARTITION BY ClockDate ORDER BY UtcTime) AS PriorOffset
  FROM utcOffsets
 )
 SELECT @ClockChanges=COALESCE((
  SELECT CONVERT(char(10),ClockDate,23) AS [date],
   DATEDIFF(second,ClockDate,wall.Starts) AS [start],
   DATEDIFF(second,ClockDate,wall.Ends) AS [end]
  FROM edges
  CROSS APPLY(SELECT DATEADD(minute,CASE WHEN PriorOffset<OffsetMinutes THEN PriorOffset ELSE OffsetMinutes END,UtcTime) AS Starts,
    DATEADD(minute,CASE WHEN PriorOffset>OffsetMinutes THEN PriorOffset ELSE OffsetMinutes END,UtcTime) AS Ends) wall
  WHERE PriorOffset<>OffsetMinutes AND CONVERT(date,wall.Starts)=ClockDate
  ORDER BY ClockDate FOR JSON PATH
 ),N'[]') OPTION (MAXRECURSION 40);
 SELECT (
  SELECT CONVERT(char(10),@Today,23) AS today,CONVERT(char(8),@Clock,108) AS localTime,@Complete AS complete,
   JSON_QUERY(@ClockChanges) AS clockChanges,
   JSON_QUERY(COALESCE((
    SELECT TOP (500) CONVERT(char(10),SessionDate,23) AS [date],
      CONVERT(char(8),EvidenceStart,108) AS startTime,CONVERT(char(8),EvidenceEnd,108) AS endTime
    FROM #UnlinkedSessions ORDER BY SessionDate,EvidenceStart,EvidenceEnd FOR JSON PATH,INCLUDE_NULL_VALUES
   ),N'[]')) AS unlinkedTeaching,
   JSON_QUERY(COALESCE((SELECT f.FacultyId AS facultyId,f.PreferredFirstName AS preferredFirstName,
     f.PreferredLastName AS preferredLastName,f.DisplayName AS displayName,f.Active AS active,
     undated.Sessions AS undatedSessions,roles.Appointments AS undatedRoles
    FROM #Faculty f
    CROSS APPLY (SELECT COUNT(DISTINCT s.SessionId) AS Sessions
      FROM paws.SessionAssignment a JOIN paws.vCalendarSession s ON s.SessionId=a.SessionId
      WHERE a.FacultyId=f.FacultyId AND s.SessionDate IS NULL) undated
    CROSS APPLY (SELECT COUNT(DISTINCT a.RoleAssignmentId) AS Appointments
      FROM #Appointments a WHERE a.FacultyId=f.FacultyId AND a.HasMissingDates=1) roles
    ORDER BY f.FacultyId FOR JSON PATH),N'[]')) AS faculty,
   JSON_QUERY(COALESCE((SELECT TOP (15000) e.FacultyId AS facultyId,e.Kind AS kind,e.EventKey AS eventKey,
        e.[Type] AS [type],e.Label AS label,e.Detail AS detail,
        CONVERT(char(10),e.StartDate,23) AS startDate,CONVERT(char(10),e.EndDate,23) AS endDate,
        CONVERT(char(8),e.StartTime,108) AS startTime,CONVERT(char(8),e.EndTime,108) AS endTime,
        e.CourseCode AS courseCode,e.SessionId AS sessionId,
        JSON_QUERY(COALESCE((SELECT CONVERT(char(10),t.ActivityDate,23) AS date,
           CONVERT(char(8),t.StartTime,108) AS startTime,CONVERT(char(8),t.EndTime,108) AS endTime
         FROM #DayTimes t WHERE t.ActivityId=e.ActivityId
         ORDER BY t.ActivityDate FOR JSON PATH),N'[]')) AS timeEvidence
    FROM #Events e ORDER BY e.StartDate,e.StartTime,e.FacultyId,e.Kind,e.EventKey
    FOR JSON PATH,INCLUDE_NULL_VALUES),N'[]')) AS events
  FOR JSON PATH,WITHOUT_ARRAY_WRAPPER
 ) AS responseJson;
END;
GO
GRANT EXECUTE ON OBJECT::paws_api.ListFacultyAvailabilityBulk TO paws_runtime_read;
COMMIT TRANSACTION;
GO
