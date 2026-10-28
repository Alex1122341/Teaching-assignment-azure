/* Synthetic reader fixtures, applied only after all forward migrations in a guarded Testing reset. */
SET NOCOUNT ON;
SET XACT_ABORT ON;
IF DB_NAME() <> N'VetMed-Ops' OR OBJECT_ID(N'paws_env.EnvironmentIdentity') IS NULL
 THROW 55990,'A marked Testing database is required for synthetic reader fixtures.',1;
IF (SELECT COUNT(*) FROM paws_env.EnvironmentIdentity WHERE Environment=N'testing') <> 1
 THROW 55990,'One Testing identity is required.',1;
BEGIN TRANSACTION;
DECLARE @Batch uniqueidentifier='4F0D202B-DE40-50B5-BF3B-1E454D633732',
 @Book uniqueidentifier='7e570001-0000-4000-8000-000000000001',
 @Sheet uniqueidentifier='7e570001-0000-4000-8000-000000000002',
 @Faculty uniqueidentifier=(SELECT FacultyId FROM paws.UserProfile WHERE FirebaseUid=N'syn-faculty-a'),
 @Other uniqueidentifier=(SELECT FacultyId FROM paws.UserProfile WHERE FirebaseUid=N'syn-faculty-b');
INSERT staging.ImportWorkbook(ImportWorkbookId,ImportBatchId,FileName,FileSha256,FileByteLength)
 VALUES(@Book,@Batch,N'synthetic-readers.xlsx',REPLICATE('7',64),1);
INSERT staging.ImportSheet(ImportSheetId,ImportWorkbookId,SheetName,SheetIndex,MaxRow,MaxColumn,NonEmptyRowCount)
 VALUES(@Sheet,@Book,N'Synthetic readers',1,7,4,6);
DECLARE @Rows TABLE(Id uniqueidentifier,SourceRow int,FacultyId uniqueidentifier,Category nvarchar(64),Label nvarchar(1000),Starts date,Ends date,StaffingKind nvarchar(16));
INSERT @Rows VALUES
 ('7e570002-0000-4000-8000-000000000001',2,@Faculty,N'ccc',N'Synthetic CCC Clinic','2026-11-02','2026-11-02',N'assigned'),
 ('7e570002-0000-4000-8000-000000000002',3,NULL,N'ccc',N'Synthetic CCC Clinic','2026-11-03','2026-11-03',N'unassigned'),
 ('7e570002-0000-4000-8000-000000000003',4,@Faculty,N'ccc',N'Synthetic next-year CCC','2027-05-02','2027-05-02',N'assigned'),
 ('7e570002-0000-4000-8000-000000000004',5,@Faculty,N'clinical_day',N'Synthetic cross-year clinical days','2027-04-29','2027-05-03',N'assigned'),
 ('7e570002-0000-4000-8000-000000000005',6,@Faculty,N'rotation_participant',N'Synthetic rotation','2026-11-09','2026-11-13',N'assigned'),
 ('7e570002-0000-4000-8000-000000000006',7,@Other,N'ccc',N'Synthetic CCC Clinic','2026-11-04','2026-11-04',N'assigned');
INSERT staging.ImportRow(ImportRowId,ImportSheetId,SourceRowNumber,RawJson,ValidationStatus,ValidationErrorsJson)
 SELECT Id,@Sheet,SourceRow,N'{}',N'accepted',N'[]' FROM @Rows;
INSERT paws.CalendarActivity(ActivityId,FacultyId,Category,OriginalLabel,StartDate,EndDate,ImportBatchId,ImportRowId,
 SourceSha256,SourceSheet,SourceRow,CreatedByUid,StaffingKind,StaffingLabel,BlockLabel,SourceColumn,SourceSlotKey)
 SELECT Id,FacultyId,Category,Label,Starts,Ends,@Batch,Id,REPLICATE('7',64),N'Synthetic readers',SourceRow,N'syn-admin',
 StaffingKind,CASE WHEN StaffingKind=N'unassigned' THEN N'Locum' END,
 CASE WHEN Category=N'ccc' THEN N'Synthetic Block' END,
 CASE WHEN StaffingKind=N'unassigned' THEN N'D' END,
 CASE WHEN StaffingKind=N'unassigned' THEN CONCAT(N'Synthetic readers!D',SourceRow) END FROM @Rows;
/* No clock evidence is invented: readers must retain the original range and unconfirmed time. */
COMMIT TRANSACTION;
