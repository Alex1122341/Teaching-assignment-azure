/* Synthetic fixtures only. The calling harness proves the Docker container label before resetting this database. */
:ON ERROR EXIT
SET NOCOUNT ON;
SET XACT_ABORT ON;
IF DB_NAME() <> N'VetMed-Ops' OR USER_ID(N'paws-calendar-test-runtime') IS NULL
    THROW 57190, 'A disposable AFC test database is required.', 1;

DECLARE @Import uniqueidentifier = NEWID(), @Faculty uniqueidentifier = NEWID(), @Other uniqueidentifier = NEWID(),
        @Batch uniqueidentifier = NEWID(), @Request uniqueidentifier = NEWID(), @Rows nvarchar(max);
INSERT staging.ImportBatch (ImportBatchId, StartedAtUtc, Status, SourceManifestSha256, ImporterVersion, ValidationSummaryJson)
VALUES (@Import, SYSUTCDATETIME(), N'completed', REPLICATE('D',64), N'synthetic-batch-pdf', N'{}');
INSERT paws.Faculty (FacultyId, RecordType, DisplayName, Active, SourceImportBatchId)
VALUES (@Faculty, N'faculty', N'Synthetic Row Faculty', 1, @Import),
       (@Other, N'faculty', N'Synthetic Other Faculty', 1, @Import);
INSERT paws.UserProfile (FirebaseUid, Email, DisplayName, BaseRole, FacultyId, Active, MustChangePassword)
VALUES (N'batchpdf-owner', N'batchpdf-owner@example.test', N'Office One', N'owner', NULL, 1, 0),
       (N'batchpdf-admin', N'batchpdf-admin@example.test', N'Office Two', N'adfa_regular', NULL, 1, 0),
       (N'batchpdf-self', N'batchpdf-self@example.test', N'Faculty Self', N'faculty', @Faculty, 1, 0),
       (N'batchpdf-other', N'batchpdf-other@example.test', N'Faculty Other', N'faculty', @Other, 1, 0);

SET @Rows = (SELECT rowIndex, @Faculty AS facultyId, startDate, endDate, purpose
             FROM (VALUES (0, '2027-03-01', '2027-03-02', N'Vacation'), (1, '2027-03-10', '2027-03-12', N'Travel'))
                 AS entry(rowIndex, startDate, endDate, purpose) FOR JSON PATH);
EXEC paws_api.CreateAfcManualBatch @RequestId=@Batch, @RowsJson=@Rows, @ActorFirebaseUid=N'batchpdf-owner', @ActorName=N'Office One';
DECLARE @First uniqueidentifier = (SELECT AfcRecordId FROM paws.AfcManualRecord WHERE BatchRequestId=@Batch AND BatchRowNumber=0);
DECLARE @Second uniqueidentifier = (SELECT AfcRecordId FROM paws.AfcManualRecord WHERE BatchRequestId=@Batch AND BatchRowNumber=1);
DECLARE @Single uniqueidentifier = NEWID();
EXEC paws_api.CreateAfcRecord @AfcRecordId=@Single, @FacultyId=@Faculty, @StartDate='2027-03-20', @EndDate='2027-03-21',
     @ReasonCode=N'vacation', @Notes=NULL, @ActorFirebaseUid=N'batchpdf-owner', @ActorName=N'Office One', @RequestId=@Request;
DECLARE @Bytes varbinary(max)=0x255044462D73796E746865746963, @Hash varchar(64), @Doc uniqueidentifier, @Doc2 uniqueidentifier;
SET @Hash=CONVERT(varchar(64), HASHBYTES('SHA2_256', @Bytes), 2);
DECLARE @Upload TABLE (responseJson nvarchar(max));
DECLARE @UploadRequest uniqueidentifier=NEWID();
INSERT @Upload EXEC paws_api.UploadAfcForm @ActorFirebaseUid=N'batchpdf-owner', @FacultyId=@Faculty, @RequestId=@UploadRequest,
    @FileName=N'Travel.pdf', @PdfBytes=@Bytes, @PdfSha256=@Hash, @PageCount=1;
SELECT @Doc=CONVERT(uniqueidentifier,JSON_VALUE(responseJson,'$.documentId')) FROM @Upload;
DELETE @Upload;
SET @UploadRequest=NEWID();
INSERT @Upload EXEC paws_api.UploadAfcForm @ActorFirebaseUid=N'batchpdf-owner', @FacultyId=@Faculty, @RequestId=@UploadRequest,
    @FileName=N'Vacation.pdf', @PdfBytes=@Bytes, @PdfSha256=@Hash, @PageCount=1;
SELECT @Doc2=CONVERT(uniqueidentifier,JSON_VALUE(responseJson,'$.documentId')) FROM @Upload;
IF @First IS NULL OR @Second IS NULL OR @Doc IS NULL OR @Doc2 IS NULL OR @Doc=@Doc2
    THROW 57190, 'Synthetic batch or archive setup failed.', 1;

ALTER ROLE paws_runtime_afc_record_document ADD MEMBER [paws-calendar-test-runtime];
DECLARE @Reply TABLE (afcRecordId uniqueidentifier, facultyId uniqueidentifier, documentId uniqueidentifier, idempotentReplay bit);
EXECUTE AS USER=N'paws-calendar-test-runtime';
IF HAS_PERMS_BY_NAME(N'paws.AfcRecordDocument',N'OBJECT',N'INSERT')=1
    THROW 57190, 'The runtime has an unexpected direct link grant.', 1;
INSERT @Reply EXEC paws_api.LinkAfcBatchRecordDocument N'batchpdf-owner', @Second, @Faculty, @Doc, @Request;
INSERT @Reply EXEC paws_api.LinkAfcBatchRecordDocument N'batchpdf-owner', @Second, @Faculty, @Doc, @Request;
REVERT;
IF (SELECT COUNT(*) FROM @Reply WHERE afcRecordId=@Second AND facultyId=@Faculty AND documentId=@Doc)<>2
   OR (SELECT COUNT(*) FROM @Reply WHERE idempotentReplay=1)<>1
   OR (SELECT COUNT(*) FROM paws.AuditEvent WHERE EventType=N'afc_form_linked' AND EntityId=CONVERT(nvarchar(36),@Second)
       AND ActorName=N'Office One' AND JSON_VALUE(AfterJson,'$.documentId')=CONVERT(nvarchar(36),@Doc))<>1
    THROW 57190, 'The saved row must receive exactly one original and one audit event on replay.', 1;

BEGIN TRY EXEC paws_api.LinkAfcBatchRecordDocument N'batchpdf-self', @First, @Faculty, @Doc2, @Request;
    THROW 57190, 'Faculty linked a document.', 1; END TRY BEGIN CATCH IF ERROR_NUMBER()<>57101 THROW; END CATCH;
BEGIN TRY EXEC paws_api.LinkAfcBatchRecordDocument N'batchpdf-owner', @First, @Other, @Doc2, @Request;
    THROW 57190, 'Wrong faculty accepted.', 1; END TRY BEGIN CATCH IF ERROR_NUMBER()<>57102 THROW; END CATCH;
BEGIN TRY EXEC paws_api.LinkAfcBatchRecordDocument N'batchpdf-admin', @First, @Faculty, @Doc2, @Request;
    THROW 57190, 'Another uploader linked the document.', 1; END TRY BEGIN CATCH IF ERROR_NUMBER()<>57103 THROW; END CATCH;
BEGIN TRY EXEC paws_api.LinkAfcBatchRecordDocument N'batchpdf-owner', @Second, @Faculty, @Doc2, @Request;
    THROW 57190, 'An existing attachment was replaced.', 1; END TRY BEGIN CATCH IF ERROR_NUMBER()<>57104 THROW; END CATCH;
BEGIN TRY EXEC paws_api.LinkAfcBatchRecordDocument N'batchpdf-owner', @First, @Faculty, @Doc, @Request;
    THROW 57190, 'An attachment was shared between two rows.', 1; END TRY BEGIN CATCH IF ERROR_NUMBER()<>57104 THROW; END CATCH;
BEGIN TRY EXEC paws_api.LinkAfcBatchRecordDocument N'batchpdf-owner', @Single, @Faculty, @Doc2, @Request;
    THROW 57190, 'Single-entry attachment scope expanded.', 1; END TRY BEGIN CATCH IF ERROR_NUMBER()<>57102 THROW; END CATCH;
UPDATE paws.AfcManualRecord SET Active=0 WHERE AfcRecordId=@First;
BEGIN TRY EXEC paws_api.LinkAfcBatchRecordDocument N'batchpdf-owner', @First, @Faculty, @Doc2, @Request;
    THROW 57190, 'A withdrawn batch row accepted an attachment.', 1; END TRY BEGIN CATCH IF ERROR_NUMBER()<>57102 THROW; END CATCH;
IF EXISTS (SELECT 1 FROM paws.AfcRecordDocument WHERE AfcRecordId=@First OR DocumentId=@Doc2)
    THROW 57190, 'A rejected attachment changed another record.', 1;
DECLARE @Read TABLE (responseJson nvarchar(max), pdfBytes varbinary(max));
INSERT @Read EXEC paws_api.GetAfcForm @ActorFirebaseUid=N'batchpdf-self', @DocumentId=@Doc;
IF NOT EXISTS (SELECT 1 FROM @Read WHERE pdfBytes=@Bytes)
    THROW 57190, 'Faculty could not read the preserved PDF.', 1;
BEGIN TRY EXEC paws_api.GetAfcForm @ActorFirebaseUid=N'batchpdf-other', @DocumentId=@Doc;
    THROW 57190, 'Cross-faculty original download succeeded.', 1; END TRY BEGIN CATCH IF ERROR_NUMBER()<>54803 THROW; END CATCH;
PRINT 'AFC_BATCH_RECORD_DOCUMENT_071_OK';
