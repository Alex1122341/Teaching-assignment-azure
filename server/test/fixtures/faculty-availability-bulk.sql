/* This fixture is seeded only in the labeled disposable SQL container. */
IF USER_ID(N'paws-calendar-test-runtime') IS NULL OR
   NOT EXISTS(SELECT 1 FROM paws.UserProfile WHERE FirebaseUid=N'availability-admin')
 THROW 57290,'A disposable Availability SQL fixture is required.',1;
SET NOCOUNT ON;
SET XACT_ABORT ON;
DECLARE @Batch uniqueidentifier=NEWID(),@Book uniqueidentifier=NEWID(),@Sheet uniqueidentifier=NEWID(),@Row uniqueidentifier=NEWID();
INSERT staging.ImportBatch(ImportBatchId,StartedAtUtc,Status,SourceManifestSha256,ImporterVersion,ValidationSummaryJson)
 VALUES(@Batch,SYSUTCDATETIME(),N'completed',REPLICATE('C',64),N'availability-bulk-test',N'{}');
INSERT staging.ImportWorkbook(ImportWorkbookId,ImportBatchId,FileName,FileSha256,FileByteLength)
 VALUES(@Book,@Batch,N'synthetic-bulk.xlsx',REPLICATE('C',64),1);
INSERT staging.ImportSheet(ImportSheetId,ImportWorkbookId,SheetName,SheetIndex,MaxRow,MaxColumn,NonEmptyRowCount)
 VALUES(@Sheet,@Book,N'SyntheticBulk',1,2,1,1);
INSERT staging.ImportRow(ImportRowId,ImportSheetId,SourceRowNumber,RawJson,ValidationStatus,ValidationErrorsJson)
 VALUES(@Row,@Sheet,2,N'{}',N'accepted',N'[]');
DECLARE @People TABLE(Id uniqueidentifier PRIMARY KEY,N int);
INSERT @People SELECT TOP(150) NEWID(),ROW_NUMBER() OVER(ORDER BY object_id) FROM sys.all_objects ORDER BY object_id;
INSERT paws.Faculty(FacultyId,RecordType,DisplayName,PreferredFirstName,PreferredLastName,Active,SourceImportBatchId)
 SELECT Id,N'faculty',CONCAT(N'Synthetic Coordinator ',N),N'Synthetic',CONCAT(N'Coordination ',N),1,@Batch FROM @People;
INSERT paws.Faculty(FacultyId,RecordType,DisplayName,Active,SourceImportBatchId)
 SELECT TOP(360) NEWID(),N'faculty',CONCAT(N'Synthetic Inactive ',ROW_NUMBER() OVER(ORDER BY object_id)),0,@Batch
 FROM sys.all_objects ORDER BY object_id;
DECLARE @Days TABLE(N int PRIMARY KEY);
INSERT @Days SELECT TOP(31) ROW_NUMBER() OVER(ORDER BY object_id)-1 FROM sys.all_objects ORDER BY object_id;
DECLARE @Sessions TABLE(Id uniqueidentifier PRIMARY KEY,PersonId uniqueidentifier,Day date,FromTime time(0),ToTime time(0),RowNo int);
INSERT @Sessions
 SELECT NEWID(),p.Id,DATEADD(day,d.N,CONVERT(date,'2027-01-01')),
  DATEADD(minute,(p.N%6)*60,CONVERT(datetime,'1900-01-01T08:30:00')),
  DATEADD(minute,(p.N%6)*60,CONVERT(datetime,'1900-01-01T09:00:00')),p.N*31+d.N+2
 FROM @People p CROSS JOIN @Days d;
INSERT paws.Session(SessionId,AcademicYear,CourseCode,SessionType,SessionDate,StartTime,EndTime,Topic,SourceImportBatchId)
 SELECT Id,N'2026-27',N'AVSCALE',N'LEC',Day,FromTime,ToTime,N'Synthetic scale session',@Batch FROM @Sessions;
INSERT paws.SessionAssignment(SessionAssignmentId,SessionId,FacultyId,FacultyResolutionStatus,SourceImportBatchId,SourceRow)
 SELECT NEWID(),Id,PersonId,N'resolved',@Batch,RowNo FROM @Sessions;

DECLARE @Subject uniqueidentifier='11111111-1111-4111-8111-111111111111', @Ccc uniqueidentifier=NEWID(),@Rotation uniqueidentifier=NEWID();
INSERT paws.CalendarActivity(ActivityId,FacultyId,Category,OriginalLabel,StartDate,EndDate,ImportBatchId,ImportRowId,SourceSha256,SourceSheet,SourceRow,CreatedByUid)
 VALUES(@Ccc,@Subject,N'ccc',N'PRIVATE ORIGINAL WORK LABEL','2027-01-05','2027-01-06',@Batch,@Row,REPLICATE('C',64),N'SyntheticBulk',2,N'availability-admin'),
       (@Rotation,@Subject,N'rotation_participant',N'PRIVATE ORIGINAL ROTATION LABEL','2027-01-07','2027-01-07',@Batch,@Row,REPLICATE('C',64),N'SyntheticBulk',3,N'availability-admin');
INSERT paws.CalendarActivityDayTime(ActivityId,ActivityDate,StartTime,EndTime,EvidenceRef,EvidenceNote,ActorUid)
 VALUES(@Ccc,'2027-01-05','08:30','09:00',N'synthetic',N'PRIVATE EVIDENCE',N'availability-admin'),
       (@Rotation,'2027-01-07','09:30','11:00',N'synthetic',N'PRIVATE EVIDENCE',N'availability-admin');

DECLARE @Malformed uniqueidentifier=NEWID();
INSERT paws.RoleAssignment(RoleAssignmentId,FacultyId,FacultyResolutionStatus,AcademicYear,RoleType,EffectiveDate,SourceImportBatchId,SourceRow)
 VALUES(@Malformed,@Subject,N'resolved',N'2026-27',N'HICC','2027-01-01',@Batch,2);
INSERT paws.RoleAppointmentSchedule(RoleAssignmentId,PeriodsJson,UpdatedAtUtc,UpdatedByFirebaseUid)
 VALUES(@Malformed,N'[{"startDate":"2027-01-01","endDate":{"invalid":true}}]',SYSUTCDATETIME(),N'availability-admin');

DECLARE @Unlinked uniqueidentifier=NEWID(),@ClockGap uniqueidentifier=NEWID();
INSERT paws.Session(SessionId,AcademicYear,CourseCode,SessionType,SessionDate,StartTime,EndTime,Topic,SourceImportBatchId)
 VALUES(@Unlinked,N'2026-27',N'AVAILGAP',N'LEC','2027-01-04','12:00','13:00',N'PRIVATE UNRESOLVED SOURCE',@Batch),
       (@ClockGap,N'2025-26',N'AVAILDST',N'LEC','2026-03-08','02:15','02:45',N'Synthetic clock gap',@Batch);
INSERT paws.SessionAssignment(SessionAssignmentId,SessionId,FacultyId,FacultyResolutionStatus,SourceImportBatchId,SourceRow)
 VALUES(NEWID(),@Unlinked,NULL,N'unresolved',@Batch,9998),(NEWID(),@ClockGap,@Subject,N'resolved',@Batch,9999);

DECLARE @Available uniqueidentifier=NEWID(), @Unavailable uniqueidentifier=NEWID(), @Request uniqueidentifier=NEWID(), @Version varchar(16);
BEGIN TRANSACTION;
EXEC paws_api.CreateAfcRecord @AfcRecordId=@Available,@FacultyId=@Subject,@StartDate='2027-01-08',@EndDate='2027-01-08',
 @ReasonCode=N'special',@Notes=N'PRIVATE AVAILABLE NOTE',@ActorFirebaseUid=N'availability-admin',@ActorName=N'Example Admin',@RequestId=@Request;
SELECT @Version=VersionToken FROM paws.vAfcRecordUnified WHERE AfcRecordId=@Available;
EXEC paws_api.SaveAfcSpecialLeave @Available,@Subject,@Version,N'availability-admin',@Request,
 N'{"fteDeduction":0,"allocationsByYear":{"2026-27":{"teaching":0,"service":0,"research":0}},"confirmedYears":{"2026-27":false}}';
SET @Request=NEWID();
EXEC paws_api.CreateAfcRecord @AfcRecordId=@Unavailable,@FacultyId=@Subject,@StartDate='2027-01-09',@EndDate='2027-01-09',
 @ReasonCode=N'special',@Notes=N'PRIVATE UNAVAILABLE NOTE',@ActorFirebaseUid=N'availability-admin',@ActorName=N'Example Admin',@RequestId=@Request;
COMMIT TRANSACTION;
PRINT 'FACULTY_AVAILABILITY_BULK_SEEDED_150_X_31';
