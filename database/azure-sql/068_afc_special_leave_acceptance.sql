:ON ERROR EXIT
SET NOCOUNT ON;
SET XACT_ABORT ON;
IF DB_NAME()<>N'VetMed-Ops' THROW 56880,'Unexpected acceptance database.',1;
DECLARE @Source uniqueidentifier=NEWID(),@Faculty uniqueidentifier=NEWID(),@Record uniqueidentifier=NEWID(),
 @Other uniqueidentifier=NEWID(),@Request uniqueidentifier=NEWID(),@Version varchar(16),
 @Session uniqueidentifier=NEWID(),@Assignment uniqueidentifier=NEWID(),@Date date='2098-06-15';
BEGIN TRANSACTION;
INSERT staging.ImportBatch(ImportBatchId,StartedAtUtc,Status,SourceManifestSha256,ImporterVersion,ValidationSummaryJson)
 VALUES(@Source,SYSUTCDATETIME(),N'synthetic',REPLICATE('B',64),N'068-acceptance',N'{}');
INSERT paws.Faculty(FacultyId,RecordType,DisplayName,Active,SourceImportBatchId)
 VALUES(@Faculty,N'faculty',N'[068] Synthetic Faculty',1,@Source);
INSERT paws.UserProfile(FirebaseUid,Email,DisplayName,BaseRole,Active,MustChangePassword)
 VALUES(N'afc-special-068-admin',N'afc068-admin@example.invalid',N'Synthetic 068 Admin',N'owner',1,0);
EXEC paws_api.CreateAfcRecord @AfcRecordId=@Record,@FacultyId=@Faculty,@StartDate=@Date,@EndDate=@Date,
 @ReasonCode=N'special',@Notes=N'Synthetic test',@ActorFirebaseUid=N'afc-special-068-admin',@ActorName=N'Synthetic 068 Admin',@RequestId=@Request;
IF paws_api.CalendarActivityAvailability(@Faculty,@Date,'09:00','10:00',NULL)<>N'Unavailable'
 THROW 56881,'Ordinary Special Leave must still block scheduling.',1;
SELECT @Version=VersionToken FROM paws.vAfcRecordUnified WHERE AfcRecordId=@Record;
EXEC paws_api.SaveAfcSpecialLeave @Record,@Faculty,@Version,N'afc-special-068-admin',@Request,
 N'{"fteDeduction":0,"allocationsByYear":{"2098-99":{"teaching":0,"service":0,"research":0}},"confirmedYears":{"2098-99":false}}';
IF paws_api.CalendarActivityAvailability(@Faculty,@Date,'09:00','10:00',NULL)<>N'Available'
 THROW 56882,'An Available leave with pending deductions blocked scheduling.',1;
IF NOT EXISTS(SELECT 1 FROM paws.vAfcSpecialLeaveAdmin WHERE AfcRecordId=@Record AND VersionToken<>@Version)
 OR NOT EXISTS(SELECT 1 FROM paws.AuditEvent WHERE RequestId=@Request AND EventType=N'afc_special_leave_deduction_confirmed')
 THROW 56883,'AFC revision or audit was not recorded.',1;
INSERT paws.Session(SessionId,AcademicYear,CourseCode,SessionType,SessionDate,StartTime,EndTime,SourceImportBatchId)
 VALUES(@Session,N'2098-99',N'068TEST',N'LEC',@Date,'09:30','10:30',@Source);
INSERT paws.SessionAssignment(SessionAssignmentId,SessionId,FacultyId,FacultyResolutionStatus,SourceImportBatchId,SourceRow)
 VALUES(@Assignment,@Session,@Faculty,N'resolved',@Source,1);
IF paws_api.CalendarActivityAvailability(@Faculty,@Date,'09:00','10:00',NULL)<>N'Unavailable'
 THROW 56884,'Available Special Leave masked a real teaching conflict.',1;
IF EXISTS(SELECT 1 FROM paws_api.SchedulingTaskIssues(N'2098-99') WHERE SessionId=@Session AND IssueType=N'afc_unavailable')
 THROW 56885,'Available Special Leave raised an AFC scheduling task.',1;
SET @Request=NEWID();
EXEC paws_api.CreateAfcRecord @AfcRecordId=@Other,@FacultyId=@Faculty,@StartDate=@Date,@EndDate=@Date,
 @ReasonCode=N'vacation',@Notes=NULL,@ActorFirebaseUid=N'afc-special-068-admin',@ActorName=N'Synthetic 068 Admin',@RequestId=@Request;
IF paws_api.CalendarActivityAvailability(@Faculty,@Date,'09:00','10:00',@Session)<>N'Unavailable'
 OR NOT EXISTS(SELECT 1 FROM paws_api.SchedulingTaskIssues(N'2098-99') WHERE SessionId=@Session AND IssueType=N'afc_unavailable')
 THROW 56886,'Unavailable AFC must dominate Available leave.',1;
ROLLBACK TRANSACTION;
IF EXISTS(SELECT 1 FROM paws.AfcSpecialLeave WHERE AfcRecordId=@Record)
 OR EXISTS(SELECT 1 FROM paws.Faculty WHERE FacultyId=@Faculty)
 THROW 56887,'Synthetic acceptance data survived rollback.',1;
PRINT 'AFC_SPECIAL_LEAVE_068_ACCEPTANCE_OK';
