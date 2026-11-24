/* Attach an archived original to a saved multi-input row. This migration changes no business data. */
:ON ERROR EXIT
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
IF DB_NAME() <> N'VetMed-Ops'
   OR COL_LENGTH(N'paws.AfcManualRecord', N'BatchRequestId') IS NULL
   OR OBJECT_ID(N'paws.AfcRecordDocument', N'U') IS NULL
   OR DATABASE_PRINCIPAL_ID(N'paws_runtime_afc_record_document') IS NULL
    THROW 57100, 'Install the AFC batch and original PDF archive prerequisites first.', 1;
BEGIN TRANSACTION;
GO
CREATE OR ALTER VIEW paws.vAfcBatchOriginalEligible AS
    SELECT AfcRecordId, FacultyId FROM paws.AfcManualRecord
    WHERE Active = 1 AND BatchRequestId IS NOT NULL;
GO
CREATE OR ALTER PROCEDURE paws_api.LinkAfcBatchRecordDocument
    @ActorFirebaseUid nvarchar(128),
    @AfcRecordId uniqueidentifier,
    @FacultyId uniqueidentifier,
    @DocumentId uniqueidentifier,
    @RequestId uniqueidentifier
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    IF @AfcRecordId IS NULL OR @FacultyId IS NULL OR @DocumentId IS NULL OR @RequestId IS NULL
        THROW 57105, 'Record, faculty, document and request identifiers are required.', 1;

    DECLARE @ActorName nvarchar(260), @FileName nvarchar(180), @StartDate date, @EndDate date,
            @ExistingDocument uniqueidentifier, @Replay bit = 0;
    BEGIN TRY
        BEGIN TRANSACTION;
        SELECT @ActorName = DisplayName
        FROM paws.UserProfile WITH (HOLDLOCK)
        WHERE FirebaseUid COLLATE Latin1_General_100_BIN2 = @ActorFirebaseUid COLLATE Latin1_General_100_BIN2
          AND Active = 1 AND MustChangePassword = 0
          AND LOWER(BaseRole) COLLATE Latin1_General_100_BIN2 IN
              (N'developer', N'owner', N'administrator', N'adfa_general', N'adfa_regular', N'admin');
        IF @@ROWCOUNT <> 1
            THROW 57101, 'An active AFC administrator is required.', 1;

        -- Serialize operations sharing either the target row or the original, including a concurrent withdrawal.
        SELECT @StartDate = StartDate, @EndDate = EndDate
        FROM paws.AfcManualRecord WITH (UPDLOCK, HOLDLOCK)
        WHERE AfcRecordId = @AfcRecordId AND FacultyId = @FacultyId AND Active = 1 AND BatchRequestId IS NOT NULL;
        IF @@ROWCOUNT <> 1
            THROW 57102, 'The active batch record is unavailable for this faculty.', 1;
        SELECT @FileName = FileName
        FROM paws.AfcFormDocument WITH (UPDLOCK, HOLDLOCK)
        WHERE DocumentId = @DocumentId AND FacultyId = @FacultyId
          AND CreatedByUid COLLATE Latin1_General_100_BIN2 = @ActorFirebaseUid COLLATE Latin1_General_100_BIN2;
        IF @@ROWCOUNT <> 1
            THROW 57103, 'The archived original is unavailable for this faculty and uploader.', 1;

        SELECT @ExistingDocument = DocumentId FROM paws.AfcRecordDocument WHERE AfcRecordId = @AfcRecordId;
        IF @ExistingDocument = @DocumentId
            SET @Replay = 1;
        ELSE
        BEGIN
            IF @ExistingDocument IS NOT NULL OR EXISTS (SELECT 1 FROM paws.AfcRecordDocument WHERE DocumentId = @DocumentId)
                THROW 57104, 'The record or original already has a different link.', 1;
            INSERT paws.AfcRecordDocument (AfcRecordId, FacultyId, DocumentId, LinkedByUid)
            VALUES (@AfcRecordId, @FacultyId, @DocumentId, @ActorFirebaseUid);

            DECLARE @After nvarchar(max) = (
                SELECT @AfcRecordId AS afcRecordId, @FacultyId AS facultyId, @DocumentId AS documentId,
                       @FileName AS fileName, @StartDate AS startDate, @EndDate AS endDate FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
            );
            INSERT paws.AuditEvent (AuditEventId, EventType, EntityType, EntityId, ActorFirebaseUid, ActorName,
                                    OccurredAtUtc, BeforeJson, AfterJson, MetadataJson, RequestId, ImportBatchId)
            VALUES (NEWID(), N'afc_form_linked', N'afc_record', CONVERT(nvarchar(36), @AfcRecordId), @ActorFirebaseUid,
                    @ActorName, SYSUTCDATETIME(), NULL, @After,
                    (SELECT @FacultyId AS facultyId FOR JSON PATH, WITHOUT_ARRAY_WRAPPER), @RequestId, NULL);
        END;
        COMMIT TRANSACTION;
        SELECT @AfcRecordId AS afcRecordId, @FacultyId AS facultyId, @DocumentId AS documentId, @Replay AS idempotentReplay;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO
GRANT EXECUTE ON OBJECT::paws_api.LinkAfcBatchRecordDocument TO paws_runtime_afc_record_document;
GRANT SELECT ON OBJECT::paws.vAfcBatchOriginalEligible TO paws_runtime_read;
COMMIT TRANSACTION;
GO
