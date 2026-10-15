:ON ERROR EXIT
SET NOCOUNT ON;
SET XACT_ABORT ON;
DECLARE @Batch uniqueidentifier=NEWID(),@Faculty uniqueidentifier=NEWID(),@Course uniqueidentifier=NEWID(),@A uniqueidentifier=NEWID(),@B uniqueidentifier=NEWID();
INSERT staging.ImportBatch(ImportBatchId,StartedAtUtc,Status,SourceManifestSha256,ImporterVersion,ValidationSummaryJson) VALUES(@Batch,SYSUTCDATETIME(),N'synthetic',REPLICATE('D',64),N'test',N'{}');
INSERT paws.Faculty(FacultyId,RecordType,DisplayName,Active,SourceImportBatchId) VALUES(@Faculty,N'faculty',N'Synthetic Review Faculty',1,@Batch);
INSERT paws.SwapCandidate(FacultyId) VALUES(@Faculty);
INSERT paws.UserProfile(FirebaseUid,Email,DisplayName,BaseRole,FacultyId,Active,MustChangePassword)
VALUES(N'task-review-admin',N'review-admin@example.test',N'Synthetic ADFA',N'adfa_regular',NULL,1,0),(N'task-review-reader',N'review-reader@example.test',N'Synthetic Faculty',N'faculty',@Faculty,1,0);
INSERT paws.Course(CourseId,CourseCode,CourseName,SourceImportBatchId) VALUES(@Course,N'REVIEW_TEST',N'Synthetic review course',@Batch);
INSERT paws.Session(SessionId,AcademicYear,CourseId,CourseCode,Topic,SessionType,SessionDate,StartTime,EndTime,SourceImportBatchId)
VALUES(@A,N'REVIEW-TEST',@Course,N'REVIEW_TEST',N'A',N'LEC','2026-11-05','09:00','10:00',@Batch),(@B,N'REVIEW-TEST',@Course,N'REVIEW_TEST',N'B',N'LEC','2026-11-05','09:30','10:30',@Batch);
INSERT paws.SessionAssignment(SessionAssignmentId,SessionId,FacultyId,FacultyResolutionStatus,SourceImportBatchId,SourceRow)
VALUES(NEWID(),@A,@Faculty,N'resolved',@Batch,1),(NEWID(),@B,@Faculty,N'resolved',@Batch,2);
DECLARE @Reply TABLE(responseJson nvarchar(max));
INSERT @Reply EXEC paws_api.ListSchedulingTasks N'task-review-admin',N'{"academicYear":"REVIEW-TEST"}';
DECLARE @Json nvarchar(max)=(SELECT responseJson FROM @Reply),@Key varchar(64),@Evidence varchar(64),@Review varchar(16);
SELECT @Key=JSON_VALUE(@Json,'$.tasks[0].issueKey'),@Evidence=JSON_VALUE(@Json,'$.tasks[0].evidenceVersion'),@Review=JSON_VALUE(@Json,'$.tasks[0].reviewVersion');
DELETE @Reply;INSERT @Reply EXEC paws_api.ReviewSchedulingTask N'task-review-admin',@Key,N'REVIEW-TEST',@Evidence,@Review,N'Reviewed';
SELECT @Json=responseJson FROM @Reply;
IF COALESCE(JSON_VALUE(@Json,'$.reviewStatus'),N'')<>N'Reviewed' THROW 54390,'Mark reviewed did not persist.',1;
SET @Review=JSON_VALUE(@Json,'$.reviewVersion');
DELETE @Reply;INSERT @Reply EXEC paws_api.ListSchedulingTasks N'task-review-admin',N'{"academicYear":"REVIEW-TEST"}';SELECT @Json=responseJson FROM @Reply;
IF COALESCE(TRY_CONVERT(int,JSON_VALUE(@Json,'$.total')),-1)<>1 OR COALESCE(JSON_VALUE(@Json,'$.tasks[0].reviewStatus'),N'')<>N'Reviewed' THROW 54390,'Review suppressed an unresolved conflict.',1;
DECLARE @Rejected bit=0;
BEGIN TRY EXEC paws_api.ReviewSchedulingTask N'task-review-admin',@Key,N'REVIEW-TEST',@Evidence,'0000000000000000',N'Unreviewed';END TRY BEGIN CATCH IF ERROR_NUMBER()=54310 SET @Rejected=1;ELSE THROW;END CATCH;
IF @Rejected=0 THROW 54390,'Stale review overwrote another review.',1;
UPDATE paws.Session SET StartTime='10:00',EndTime='11:00' WHERE SessionId=@B;
DELETE @Reply;INSERT @Reply EXEC paws_api.ListSchedulingTasks N'task-review-admin',N'{"academicYear":"REVIEW-TEST"}';SELECT @Json=responseJson FROM @Reply;
IF COALESCE(TRY_CONVERT(int,JSON_VALUE(@Json,'$.total')),-1)<>0 THROW 54390,'Fixed conflict remained active.',1;
UPDATE paws.Session SET StartTime='09:30',EndTime='10:30' WHERE SessionId=@B;
DELETE @Reply;INSERT @Reply EXEC paws_api.ListSchedulingTasks N'task-review-admin',N'{"academicYear":"REVIEW-TEST"}';SELECT @Json=responseJson FROM @Reply;
IF COALESCE(JSON_VALUE(@Json,'$.tasks[0].reviewStatus'),N'')<>N'Unreviewed' OR JSON_VALUE(@Json,'$.tasks[0].evidenceVersion')=@Evidence THROW 54390,'Recreated conflict inherited the old review.',1;
SET @Rejected=0;
BEGIN TRY EXEC paws_api.ReviewSchedulingTask N'task-review-admin',@Key,N'REVIEW-TEST',@Evidence,@Review,N'Reviewed';END TRY BEGIN CATCH IF ERROR_NUMBER()=54310 SET @Rejected=1;ELSE THROW;END CATCH;
IF @Rejected=0 THROW 54390,'Old source evidence was accepted.',1;
SET @Evidence=JSON_VALUE(@Json,'$.tasks[0].evidenceVersion');
DECLARE @Roles TABLE(RoleName nvarchar(32),Allowed bit);
INSERT @Roles VALUES(N'faculty',0),(N'hicc',0),(N'visc',0),(N'adc',0),(N'lab',0),(N'owner',1),(N'administrator',1),(N'admin',1),(N'adfa_general',1),(N'adfa_regular',1),(N'developer',1);
DECLARE @Role nvarchar(32),@Allowed bit;
DECLARE roles_cursor CURSOR LOCAL FAST_FORWARD FOR SELECT RoleName,Allowed FROM @Roles;
OPEN roles_cursor;FETCH NEXT FROM roles_cursor INTO @Role,@Allowed;
WHILE @@FETCH_STATUS=0
BEGIN
 UPDATE paws.UserProfile SET BaseRole=@Role WHERE FirebaseUid=N'task-review-reader';
 SET @Rejected=0;
 BEGIN TRY
  DELETE @Reply;INSERT @Reply EXEC paws_api.ReviewSchedulingTask N'task-review-reader',@Key,N'REVIEW-TEST',@Evidence,@Review,N'Reviewed';
  SELECT @Json=responseJson FROM @Reply;SET @Review=JSON_VALUE(@Json,'$.reviewVersion');
 END TRY BEGIN CATCH IF ERROR_NUMBER()=54303 SET @Rejected=1;ELSE THROW;END CATCH;
 IF @Rejected=1 AND @Allowed=1 OR @Rejected=0 AND @Allowed=0 THROW 54390,'Review role boundary failed.',1;
 FETCH NEXT FROM roles_cursor INTO @Role,@Allowed;
END;
CLOSE roles_cursor;DEALLOCATE roles_cursor;
IF (SELECT COUNT(*) FROM paws.AuditEvent WHERE EntityId=@Key AND EventType=N'SchedulingTaskReviewed')<>7 THROW 54390,'Review audit count is incorrect.',1;
DELETE paws.SchedulingTaskReview WHERE IssueKey=@Key;
DELETE paws.AuditEvent WHERE EntityId=@Key AND EventType=N'SchedulingTaskReviewed';
DELETE paws.SessionAssignment WHERE SessionId IN(@A,@B);
DELETE paws.Session WHERE SessionId IN(@A,@B);
DELETE paws.Course WHERE CourseId=@Course;
DELETE paws.UserProfile WHERE FirebaseUid IN(N'task-review-admin',N'task-review-reader');
DELETE paws.SwapCandidate WHERE FacultyId=@Faculty;
DELETE paws.Faculty WHERE FacultyId=@Faculty;
DELETE staging.ImportBatch WHERE ImportBatchId=@Batch;
PRINT 'SCHEDULING_TASK_REVIEW_OK';
