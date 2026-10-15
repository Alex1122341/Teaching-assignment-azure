/* Scoped current scheduling findings. No memberships or live write-gate changes. */
:ON ERROR EXIT
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
IF DB_NAME()<>N'VetMed-Ops' OR OBJECT_ID(N'paws_api.GetAdfaSwapFacultyPreview') IS NULL
 THROW 54300,'Scheduling tasks require the reviewed Beta prerequisites.',1;
IF OBJECT_ID(N'paws_api.SchedulingTaskIssues') IS NOT NULL OR OBJECT_ID(N'paws_api.ListSchedulingTasks') IS NOT NULL
 THROW 54300,'Inspect existing scheduling task objects before applying.',1;
IF EXISTS(SELECT 1 FROM sys.columns WHERE object_id IN(OBJECT_ID(N'paws.Session'),OBJECT_ID(N'paws.SessionAssignment')) AND system_type_id=189)
 THROW 54300,'Inspect existing scheduling source versions before applying.',1;
BEGIN TRANSACTION;
ALTER TABLE paws.Session ADD SchedulingVersion rowversion NOT NULL;
ALTER TABLE paws.SessionAssignment ADD SchedulingVersion rowversion NOT NULL;
GO
CREATE FUNCTION paws_api.SchedulingTaskIssues(@AcademicYear nvarchar(32))
RETURNS TABLE AS RETURN
WITH assigned AS (
 SELECT a.SessionId,a.FacultyId,COUNT(*) AssignmentCount,
  STRING_AGG(CONVERT(nvarchar(max),CONCAT(a.SessionAssignmentId,N':',CONVERT(varchar(16),a.SchedulingVersion,2))),N'|') WITHIN GROUP(ORDER BY a.SessionAssignmentId) AssignmentVersions
 FROM paws.SessionAssignment a WHERE a.FacultyId IS NOT NULL GROUP BY a.SessionId,a.FacultyId
), pairs AS (
 SELECT a.FacultyId,s.SessionId,t.SessionId RelatedSessionId,
  CONVERT(nvarchar(40),CASE WHEN s.CourseCode=t.CourseCode AND s.StartTime=t.StartTime AND s.EndTime=t.EndTime AND s.SessionType=t.SessionType
   AND LOWER(LTRIM(RTRIM(COALESCE(s.Topic,N''))))=LOWER(LTRIM(RTRIM(COALESCE(t.Topic,N'')))) THEN N'duplicate_session_assignment' ELSE N'instructor_overlap' END) IssueType,
  CONVERT(nvarchar(16),N'Conflict') Severity,
  CONVERT(nvarchar(max),CONCAT(CONVERT(varchar(16),s.SchedulingVersion,2),N'|',CONVERT(varchar(16),t.SchedulingVersion,2),N'|',a.AssignmentVersions,N'|',b.AssignmentVersions)) Evidence
 FROM assigned a JOIN assigned b ON b.FacultyId=a.FacultyId AND b.SessionId>a.SessionId
 JOIN paws.Session s ON s.SessionId=a.SessionId JOIN paws.Session t ON t.SessionId=b.SessionId
 WHERE s.AcademicYear=@AcademicYear AND t.AcademicYear=@AcademicYear AND s.SessionDate=t.SessionDate
 AND s.StartTime<s.EndTime AND t.StartTime<t.EndTime AND s.StartTime<t.EndTime AND t.StartTime<s.EndTime
), duplicateAssignments AS (
 SELECT a.FacultyId,s.SessionId,CAST(NULL AS uniqueidentifier) RelatedSessionId,N'duplicate_assignment' IssueType,N'Conflict' Severity,
 CONVERT(nvarchar(max),CONCAT(CONVERT(varchar(16),s.SchedulingVersion,2),N'|',a.AssignmentVersions)) Evidence
 FROM assigned a JOIN paws.Session s ON s.SessionId=a.SessionId WHERE s.AcademicYear=@AcademicYear AND a.AssignmentCount>1
), quality AS (
 SELECT a.FacultyId,s.SessionId,CAST(NULL AS uniqueidentifier) RelatedSessionId,
 CASE WHEN s.StartTime IS NOT NULL AND s.EndTime IS NOT NULL AND s.StartTime>=s.EndTime THEN N'invalid_schedule' ELSE N'missing_schedule' END IssueType,N'Needs Review' Severity,
 CONVERT(nvarchar(max),CONCAT(CONVERT(varchar(16),s.SchedulingVersion,2),N'|',a.AssignmentVersions)) Evidence
 FROM paws.Session s LEFT JOIN assigned a ON a.SessionId=s.SessionId
 WHERE s.AcademicYear=@AcademicYear AND (s.SessionDate IS NULL OR s.StartTime IS NULL OR s.EndTime IS NULL OR s.StartTime>=s.EndTime OR NULLIF(LTRIM(RTRIM(s.CourseCode)),N'') IS NULL OR a.FacultyId IS NULL)
 UNION ALL
 SELECT CAST(NULL AS uniqueidentifier),s.SessionId,CAST(NULL AS uniqueidentifier),N'missing_schedule',N'Needs Review',
 CONVERT(nvarchar(max),CONCAT(CONVERT(varchar(16),s.SchedulingVersion,2),N'|',STRING_AGG(CONVERT(nvarchar(max),CONCAT(a.SessionAssignmentId,N':',CONVERT(varchar(16),a.SchedulingVersion,2))),N'|') WITHIN GROUP(ORDER BY a.SessionAssignmentId)))
 FROM paws.Session s JOIN paws.SessionAssignment a ON a.SessionId=s.SessionId AND a.FacultyId IS NULL
 WHERE s.AcademicYear=@AcademicYear AND EXISTS(SELECT 1 FROM assigned own WHERE own.SessionId=s.SessionId)
 GROUP BY s.SessionId,s.SchedulingVersion
), absences AS (
 SELECT AfcRecordId,FacultyId,StartDate,EndDate,CONVERT(varchar(16),AfcVersion,2) SourceVersion,N'import' SourceKind FROM paws.AfcRecord WHERE Active=1
 UNION ALL
 SELECT AfcRecordId,FacultyId,StartDate,EndDate,CONVERT(varchar(16),AfcVersion,2),N'manual' FROM paws.AfcManualRecord WHERE Active=1
), afc AS (
 SELECT a.FacultyId,s.SessionId,CAST(NULL AS uniqueidentifier) RelatedSessionId,N'afc_unavailable' IssueType,N'Conflict' Severity,
 CONVERT(nvarchar(max),CONCAT(CONVERT(varchar(16),s.SchedulingVersion,2),N'|',a.AssignmentVersions,N'|',STRING_AGG(CONVERT(nvarchar(max),CONCAT(x.SourceKind,N':',x.AfcRecordId,N':',x.SourceVersion)),N'|') WITHIN GROUP(ORDER BY x.SourceKind,x.AfcRecordId))) Evidence
 FROM assigned a JOIN paws.Session s ON s.SessionId=a.SessionId JOIN absences x ON x.FacultyId=a.FacultyId AND s.SessionDate BETWEEN x.StartDate AND x.EndDate
 WHERE s.AcademicYear=@AcademicYear GROUP BY a.FacultyId,s.SessionId,s.SchedulingVersion,a.AssignmentVersions
), activities AS (
 SELECT a.FacultyId,s.SessionId,CAST(NULL AS uniqueidentifier) RelatedSessionId,k.IssueType,
 CASE WHEN k.IssueType=N'calendar_time_unknown' THEN N'Needs Review' ELSE N'Conflict' END Severity,
 CONVERT(nvarchar(max),CONCAT(CONVERT(varchar(16),s.SchedulingVersion,2),N'|',a.AssignmentVersions,N'|',STRING_AGG(CONVERT(nvarchar(max),CONCAT(x.ActivityId,N':',CONVERT(varchar(16),x.ActivityVersion,2),N':',CONVERT(varchar(16),t.TimeVersion,2))),N'|') WITHIN GROUP(ORDER BY x.ActivityId))) Evidence
 FROM assigned a JOIN paws.Session s ON s.SessionId=a.SessionId
 JOIN paws.CalendarActivity x ON x.FacultyId=a.FacultyId AND s.SessionDate BETWEEN x.StartDate AND x.EndDate
 LEFT JOIN paws.CalendarActivityDayTime t ON t.ActivityId=x.ActivityId AND t.ActivityDate=s.SessionDate
 CROSS APPLY(SELECT CASE WHEN t.ActivityId IS NULL THEN N'calendar_time_unknown' ELSE N'calendar_activity_overlap' END IssueType) k
 WHERE s.AcademicYear=@AcademicYear AND (t.ActivityId IS NULL OR s.StartTime<s.EndTime AND s.StartTime<t.EndTime AND t.StartTime<s.EndTime)
 GROUP BY a.FacultyId,s.SessionId,s.SchedulingVersion,a.AssignmentVersions,k.IssueType
), findings AS (
 SELECT * FROM pairs UNION ALL SELECT * FROM duplicateAssignments UNION ALL SELECT * FROM quality UNION ALL SELECT * FROM afc UNION ALL SELECT * FROM activities
)
SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256',CONVERT(varbinary(max),CONCAT(IssueType,N'|',SessionId,N'|',RelatedSessionId,N'|',FacultyId))),2) IssueKey,
 FacultyId,SessionId,RelatedSessionId,IssueType,Severity,
 CONVERT(varchar(64),HASHBYTES('SHA2_256',CONVERT(varbinary(max),Evidence)),2) EvidenceVersion
FROM findings;
GO
CREATE PROCEDURE paws_api.ListSchedulingTasks @ActorFirebaseUid nvarchar(128),@QueryJson nvarchar(max)
AS
BEGIN
 SET NOCOUNT ON;
 DECLARE @Role nvarchar(128),@Faculty uniqueidentifier,@Year nvarchar(32);
 SELECT @Role=LOWER(LTRIM(RTRIM(BaseRole))),@Faculty=FacultyId FROM paws.UserProfile WHERE FirebaseUid=@ActorFirebaseUid AND Active=1 AND MustChangePassword=0;
 IF @Role IS NULL OR @Role NOT IN(N'owner',N'administrator',N'admin',N'adfa_general',N'adfa_regular',N'developer',N'adc',N'lab',N'faculty',N'hicc',N'visc')
  OR (@Role IN(N'faculty',N'hicc',N'visc') AND @Faculty IS NULL) THROW 54303,'Scheduling task access denied.',1;
 IF ISJSON(@QueryJson)<>1 THROW 54301,'Invalid scheduling task query.',1;
 SET @Year=JSON_VALUE(@QueryJson,'$.academicYear');
 IF @Year IS NULL OR LEN(LTRIM(RTRIM(@Year)))=0 THROW 54301,'Academic year is required.',1;
 SELECT i.* INTO #Issues FROM paws_api.SchedulingTaskIssues(@Year) i
 WHERE @Role NOT IN(N'faculty',N'hicc',N'visc') OR i.FacultyId=@Faculty;
 SELECT (SELECT (SELECT COUNT(*) FROM #Issues) total,
 JSON_QUERY((SELECT i.IssueKey issueKey,c.CandidateKey facultyKey,f.DisplayName displayName,s.CourseCode courseCode,
  i.SessionId sessionId,s.SessionDate date,CONVERT(char(5),s.StartTime,108) startTime,CONVERT(char(5),s.EndTime,108) endTime,
  i.IssueType type,i.Severity severity,N'Unreviewed' reviewStatus,i.EvidenceVersion evidenceVersion,'0000000000000000' reviewVersion,
  CAST(0 AS bit) canReview,
  JSON_QUERY((SELECT t.SessionId id,t.CourseCode courseCode,t.SessionDate date,CONVERT(char(5),t.StartTime,108) startTime,CONVERT(char(5),t.EndTime,108) endTime
   FROM paws.Session t WHERE t.SessionId=i.RelatedSessionId FOR JSON PATH,INCLUDE_NULL_VALUES)) relatedSessions
 FROM #Issues i JOIN paws.Session s ON s.SessionId=i.SessionId LEFT JOIN paws.Faculty f ON f.FacultyId=i.FacultyId LEFT JOIN paws.SwapCandidate c ON c.FacultyId=i.FacultyId
 ORDER BY s.SessionDate,i.IssueKey FOR JSON PATH,INCLUDE_NULL_VALUES)) tasks
 FOR JSON PATH,WITHOUT_ARRAY_WRAPPER) responseJson;
END;
GO
COMMIT;
