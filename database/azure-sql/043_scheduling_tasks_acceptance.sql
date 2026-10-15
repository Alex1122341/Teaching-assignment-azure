:ON ERROR EXIT
SET NOCOUNT ON;
SET XACT_ABORT ON;
BEGIN TRANSACTION;
DECLARE @Batch uniqueidentifier=NEWID(),@Faculty uniqueidentifier=NEWID(),@Course uniqueidentifier=NEWID(),@A uniqueidentifier=NEWID(),@B uniqueidentifier=NEWID();
INSERT staging.ImportBatch(ImportBatchId,StartedAtUtc,Status,SourceManifestSha256,ImporterVersion,ValidationSummaryJson) VALUES(@Batch,SYSUTCDATETIME(),N'synthetic',REPLICATE('C',64),N'test',N'{}');
INSERT paws.Faculty(FacultyId,RecordType,DisplayName,Active,SourceImportBatchId) VALUES(@Faculty,N'faculty',N'Synthetic Task Faculty',1,@Batch);
INSERT paws.SwapCandidate(FacultyId) VALUES(@Faculty);
INSERT paws.UserProfile(FirebaseUid,Email,DisplayName,BaseRole,Active,MustChangePassword) VALUES(N'task-admin',N'task-admin@example.test',N'Synthetic ADFA',N'adfa_regular',1,0);
INSERT paws.Course(CourseId,CourseCode,CourseName,SourceImportBatchId) VALUES(@Course,N'TASK_TEST',N'Synthetic task course',@Batch);
INSERT paws.Session(SessionId,AcademicYear,CourseId,CourseCode,Topic,SessionType,SessionDate,StartTime,EndTime,SourceImportBatchId)
VALUES(@A,N'TASK-TEST',@Course,N'TASK_TEST',N'A',N'LEC','2026-11-05','09:00','10:00',@Batch),(@B,N'TASK-TEST',@Course,N'TASK_TEST',N'B',N'LEC','2026-11-05','09:30','10:30',@Batch);
INSERT paws.SessionAssignment(SessionAssignmentId,SessionId,FacultyId,FacultyResolutionStatus,SourceImportBatchId,SourceRow)
VALUES(NEWID(),@A,@Faculty,N'resolved',@Batch,1),(NEWID(),@B,@Faculty,N'resolved',@Batch,2);
DECLARE @Reply TABLE(responseJson nvarchar(max));
INSERT @Reply EXEC paws_api.ListSchedulingTasks N'task-admin',N'{"academicYear":"TASK-TEST"}';
DECLARE @Json nvarchar(max)=(SELECT responseJson FROM @Reply);
IF TRY_CONVERT(int,JSON_VALUE(@Json,'$.total'))<>1 OR JSON_VALUE(@Json,'$.tasks[0].type')<>N'instructor_overlap' OR JSON_VALUE(@Json,'$.tasks[0].severity')<>N'Conflict'
 THROW 54390,'Overlapping assignments must produce exactly one confirmed pair.',1;
UPDATE paws.Session SET StartTime='10:00',EndTime='11:00' WHERE SessionId=@B;
DELETE @Reply;
INSERT @Reply EXEC paws_api.ListSchedulingTasks N'task-admin',N'{"academicYear":"TASK-TEST"}';
SELECT @Json=responseJson FROM @Reply;
IF TRY_CONVERT(int,JSON_VALUE(@Json,'$.total'))<>0 THROW 54390,'Adjacent sessions must not conflict.',1;
ROLLBACK;
PRINT 'SCHEDULING_TASK_OVERLAP_OK';
