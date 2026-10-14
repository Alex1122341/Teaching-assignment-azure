:ON ERROR EXIT
SET NOCOUNT ON;
IF OBJECT_ID(N'paws_api.CommitCalendarActivityImport') IS NULL THROW 53890,'Atomic activity commands are missing.',1;
GO
CREATE PROCEDURE dbo.CalendarActivityTestPrepare
 @Row int,@Faculty uniqueidentifier OUTPUT,@Afc uniqueidentifier OUTPUT,@Batch uniqueidentifier OUTPUT,@Version varchar(16) OUTPUT,@Manifest char(64) OUTPUT
AS
BEGIN
 SET NOCOUNT ON;
 SET @Faculty=NEWID();SET @Afc=NEWID();SET @Batch=NEWID();
 DECLARE @Source uniqueidentifier=NEWID(),@Raw uniqueidentifier=NEWID(),@Name nvarchar(256)=CONCAT(N'Synthetic ',CONVERT(char(36),@Faculty));
 IF NOT EXISTS(SELECT 1 FROM paws.UserProfile WHERE FirebaseUid=N'calendar-command-admin')
  INSERT paws.UserProfile(FirebaseUid,Email,DisplayName,BaseRole,Active,MustChangePassword) VALUES(N'calendar-command-admin',N'commands@example.test',N'Synthetic Command Admin',N'owner',1,0);
 INSERT staging.ImportBatch(ImportBatchId,StartedAtUtc,Status,SourceManifestSha256,ImporterVersion,ValidationSummaryJson)
 VALUES(@Source,SYSUTCDATETIME(),N'synthetic',REPLICATE('A',64),N'test',N'{}');
 INSERT paws.Faculty(FacultyId,RecordType,DisplayName,Active,SourceImportBatchId) VALUES(@Faculty,N'faculty',@Name,1,@Source);
 INSERT paws.SwapCandidate(FacultyId) VALUES(@Faculty);
 INSERT staging.AfcRecordRaw(ImportBatchId,ImportRowId,SourceRowNumber,FacultySourceName,StartDate,EndDate,Purpose,RawJson,ValidationStatus,ValidationErrorsJson)
 VALUES(@Source,@Raw,@Row,@Name,'2026-11-05','2026-11-06',N'CCC Day',N'{}',N'valid',N'[]');
 INSERT paws.AfcRecord(AfcRecordId,FacultyId,StartDate,EndDate,Purpose,Active,SourceImportBatchId,SourceRow)
 VALUES(@Afc,@Faculty,'2026-11-05','2026-11-06',N'CCC Day',1,@Source,@Row);
 DECLARE @Rows nvarchar(max)=(SELECT @Row sourceRow,@Name facultySourceName,N'2026-11-05' startDate,N'2026-11-06' endDate,N'CCC Day' originalLabel,N'ccc' category,N'working_candidate' treatment,JSON_QUERY(N'[]') issues FOR JSON PATH);
 DECLARE @Response TABLE(responseJson nvarchar(max));
 INSERT @Response EXEC paws_api.StageCalendarActivityImport N'calendar-command-admin',@Batch,'4FDB517FE0B6CDF26678643E6B606D9F8388701AAF7EA540206BEF8A5733E2DF',@Rows;
 SELECT @Version=JSON_VALUE(responseJson,'$.previewVersion'),@Manifest=JSON_VALUE(responseJson,'$.manifestSha256') FROM @Response;
END;
GO
DECLARE @Faculty uniqueidentifier,@Afc uniqueidentifier,@Batch uniqueidentifier,@Version varchar(16),@Manifest char(64),@Key uniqueidentifier,@Case int=1,@Expected int,@Rejected bit,@FixtureRow int;
WHILE @Case<=6
BEGIN
 SET @FixtureRow=@Case+100;
 EXEC dbo.CalendarActivityTestPrepare @Row=@FixtureRow,@Faculty=@Faculty OUTPUT,@Afc=@Afc OUTPUT,@Batch=@Batch OUTPUT,@Version=@Version OUTPUT,@Manifest=@Manifest OUTPUT;
 SET @Key=NEWID();SET @Expected=53804;SET @Rejected=0;
 IF @Case=1 UPDATE paws.AfcRecord SET Active=0 WHERE AfcRecordId=@Afc;
 IF @Case=2 UPDATE paws.AfcRecord SET Purpose=N'Vacation' WHERE AfcRecordId=@Afc;
 IF @Case=3 UPDATE paws.Faculty SET Active=0,UpdatedAtUtc=SYSUTCDATETIME() WHERE FacultyId=@Faculty;
 IF @Case=4
 BEGIN
  UPDATE staging.CalendarActivityImport SET ExpiresAtUtc=DATEADD(minute,-1,SYSUTCDATETIME()) WHERE ImportBatchId=@Batch;
  SELECT @Version=CONVERT(varchar(16),CONVERT(binary(8),ImportVersion),2) FROM staging.CalendarActivityImport WHERE ImportBatchId=@Batch;
  SET @Expected=53805;
 END;
 IF @Case=5 SET @Manifest=REPLICATE('0',64);
 IF @Case=5 SET @Expected=53806;
 IF @Case=6
  INSERT paws.Faculty(FacultyId,RecordType,DisplayName,Active,SourceImportBatchId)
   SELECT NEWID(),RecordType,DisplayName,1,SourceImportBatchId FROM paws.Faculty WHERE FacultyId=@Faculty;
 BEGIN TRY
  EXEC paws_api.CommitCalendarActivityImport N'calendar-command-admin',@Batch,@Version,@Manifest,'4FDB517FE0B6CDF26678643E6B606D9F8388701AAF7EA540206BEF8A5733E2DF',@Key,1;
 END TRY BEGIN CATCH IF ERROR_NUMBER()=@Expected SET @Rejected=1;ELSE THROW;END CATCH;
 IF @Rejected=0 OR NOT EXISTS(SELECT 1 FROM paws.AfcRecord WHERE AfcRecordId=@Afc) OR EXISTS(SELECT 1 FROM paws.CalendarActivity WHERE ImportBatchId=@Batch)
  THROW 53890,'Stale/expired/ambiguous import was not rejected atomically.',1;
 SET @Case+=1;
END;
-- A failure injected into the durable commit audit must roll back insert and delete.
EXEC dbo.CalendarActivityTestPrepare @Row=20,@Faculty=@Faculty OUTPUT,@Afc=@Afc OUTPUT,@Batch=@Batch OUTPUT,@Version=@Version OUTPUT,@Manifest=@Manifest OUTPUT;
SET @Key=NEWID();
EXEC(N'CREATE TRIGGER paws.TR_CalendarActivityTestRejectAudit ON paws.AuditEvent AFTER INSERT AS IF EXISTS(SELECT 1 FROM inserted WHERE EventType=N''calendar_activity_import_committed'') THROW 53899,''Synthetic injected audit failure.'',1;');
SET @Rejected=0;
BEGIN TRY EXEC paws_api.CommitCalendarActivityImport N'calendar-command-admin',@Batch,@Version,@Manifest,'4FDB517FE0B6CDF26678643E6B606D9F8388701AAF7EA540206BEF8A5733E2DF',@Key,1; END TRY
BEGIN CATCH IF ERROR_NUMBER()=53899 SET @Rejected=1;ELSE THROW;END CATCH;
DROP TRIGGER paws.TR_CalendarActivityTestRejectAudit;
IF @Rejected=0 OR NOT EXISTS(SELECT 1 FROM paws.AfcRecord WHERE AfcRecordId=@Afc AND Active=1) OR EXISTS(SELECT 1 FROM paws.CalendarActivity WHERE ImportBatchId=@Batch)
 OR EXISTS(SELECT 1 FROM paws.CalendarActivityImportReceipt WHERE ImportBatchId=@Batch) THROW 53890,'Commit audit failure did not fully roll back.',1;
EXEC dbo.CalendarActivityTestPrepare @Row=21,@Faculty=@Faculty OUTPUT,@Afc=@Afc OUTPUT,@Batch=@Batch OUTPUT,@Version=@Version OUTPUT,@Manifest=@Manifest OUTPUT;
SET @Key=NEWID();
DECLARE @OriginalVersion binary(8)=(SELECT AfcVersion FROM paws.AfcRecord WHERE AfcRecordId=@Afc);
DECLARE @Reply TABLE(responseJson nvarchar(max));
INSERT @Reply EXEC paws_api.CommitCalendarActivityImport N'calendar-command-admin',@Batch,@Version,@Manifest,'4FDB517FE0B6CDF26678643E6B606D9F8388701AAF7EA540206BEF8A5733E2DF',@Key,1;
DECLARE @Receipt uniqueidentifier=(SELECT TRY_CONVERT(uniqueidentifier,JSON_VALUE(responseJson,'$.receiptId')) FROM @Reply);
IF @Receipt IS NULL OR EXISTS(SELECT 1 FROM paws.AfcRecord WHERE AfcRecordId=@Afc) OR (SELECT COUNT(*) FROM paws.CalendarActivity WHERE ImportBatchId=@Batch)<>1
 THROW 53890,'Successful import did not perform exact two-sided movement.',1;
DELETE @Reply;
INSERT @Reply EXEC paws_api.CommitCalendarActivityImport N'calendar-command-admin',@Batch,@Version,@Manifest,'4FDB517FE0B6CDF26678643E6B606D9F8388701AAF7EA540206BEF8A5733E2DF',@Key,1;
IF JSON_VALUE((SELECT responseJson FROM @Reply),'$.idempotentReplay')<>N'true' OR (SELECT COUNT(*) FROM paws.CalendarActivityImportReceipt WHERE IdempotencyKey=@Key)<>1
 THROW 53890,'Lost-response retry created duplicate work.',1;
DECLARE @Recovery TABLE(recoveryJson nvarchar(max),recoverySha256 char(64));
INSERT @Recovery EXEC paws_api.ExportCalendarActivityRecovery N'calendar-command-admin',@Receipt;
DECLARE @RecoveryHash char(64)=(SELECT recoverySha256 FROM @Recovery);
EXEC paws_api.RecoverCalendarActivityImport N'calendar-command-admin',@Receipt,@RecoveryHash,1;
IF NOT EXISTS(SELECT 1 FROM paws.AfcRecord WHERE AfcRecordId=@Afc AND AfcVersion<>@OriginalVersion)
 OR EXISTS(SELECT 1 FROM paws.CalendarActivity WHERE ImportBatchId=@Batch) THROW 53890,'Narrow recovery did not restore exact identity with a new version.',1;
PRINT 'CALENDAR_ACTIVITY_ATOMIC_ACCEPTANCE_OK';
PRINT 'CALENDAR_ACTIVITY_RECOVERY_ACCEPTANCE_OK';
DROP PROCEDURE dbo.CalendarActivityTestPrepare;
