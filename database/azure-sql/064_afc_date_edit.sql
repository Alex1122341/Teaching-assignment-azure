/* UX-07 AFC date edit. Apply before the API runtime that uses it.
   - Office (administrator) date edits for AFC records and approved AFC requests:
     paws_api.UpdateAfcDates, recorded as afc_dates_changed (old -> new dates).
   - Faculty date change for their own approved request: paws_api.SubmitAfcDateChange
     creates a new linked request that goes through the normal Reports-To / Admin
     approval. The old dates stay approved until the change is approved; approval
     then marks the old request superseded and records afc_dates_changed.
   - Pending requests are not edited: the requester withdraws and submits again.
   No business rows are rewritten by this migration. It grants no memberships;
   release adds the runtime identity to paws_runtime_afc_edit_write and enables
   PAWS_AFC_EDIT_WRITE_ENABLED only after acceptance succeeds. */
:ON ERROR EXIT
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
IF DB_NAME()<>N'VetMed-Ops' THROW 56400,'Migration 064 requires VetMed-Ops.',1;
IF OBJECT_ID(N'paws.AfcRequest',N'U') IS NULL OR OBJECT_ID(N'paws.AfcRecord',N'U') IS NULL OR OBJECT_ID(N'paws.AfcManualRecord',N'U') IS NULL
 OR OBJECT_ID(N'paws.AuditEvent',N'U') IS NULL OR OBJECT_ID(N'paws_api.SubmitAfcRequest',N'P') IS NULL OR OBJECT_ID(N'paws_api.ApproveAfcRequest',N'P') IS NULL
 OR OBJECT_ID(N'paws_api.CancelAfcRecord',N'P') IS NULL OR OBJECT_ID(N'paws_api.ListChangeHistoryEvents',N'P') IS NULL
 OR COL_LENGTH(N'paws.AfcManualRecord',N'AfcVersion') IS NULL OR COL_LENGTH(N'paws.AfcRecord',N'AfcVersion') IS NULL
 OR DATABASE_PRINCIPAL_ID(N'paws_runtime_read') IS NULL
 THROW 56400,'Migration 064 requires the AFC request, cancellation and history foundation.',1;
IF COL_LENGTH(N'paws.AfcRequest',N'ReplacesAfcRequestId') IS NOT NULL OR OBJECT_ID(N'paws_api.UpdateAfcDates',N'P') IS NOT NULL
 OR OBJECT_ID(N'paws_api.SubmitAfcDateChange',N'P') IS NOT NULL OR DATABASE_PRINCIPAL_ID(N'paws_runtime_afc_edit_write') IS NOT NULL
 THROW 56400,'AFC date edit objects already exist; inspect rather than reapplying.',1;
IF EXISTS (SELECT 1 FROM sys.schemas WHERE name IN (N'paws',N'paws_api') AND USER_NAME(principal_id)<>N'dbo')
 THROW 56400,'AFC ownership chain must remain dbo-owned.',1;
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID(N'paws.AfcRequest') AND system_type_id=189)
 THROW 56400,'Review the existing AfcRequest rowversion before adding another.',1;
GO
ALTER TABLE paws.AfcRequest ADD
 ReplacesAfcRequestId uniqueidentifier NULL CONSTRAINT FK_AfcRequest_Replaces REFERENCES paws.AfcRequest(AfcRequestId),
 SupersededByAfcRequestId uniqueidentifier NULL CONSTRAINT FK_AfcRequest_SupersededBy REFERENCES paws.AfcRequest(AfcRequestId),
 AfcVersion rowversion NOT NULL;
GO
ALTER TABLE paws.AfcRequest DROP CONSTRAINT CK_AfcRequest_Status;
ALTER TABLE paws.AfcRequest ADD CONSTRAINT CK_AfcRequest_Status CHECK (
 Status COLLATE Latin1_General_100_BIN2 IN (N'pending_report_to',N'pending_admin',N'approved',N'rejected',N'withdrawn',N'superseded'));
ALTER TABLE paws.AfcRequest ADD CONSTRAINT CK_AfcRequest_Superseded CHECK (
 (Status COLLATE Latin1_General_100_BIN2=N'superseded' AND SupersededByAfcRequestId IS NOT NULL)
 OR (Status COLLATE Latin1_General_100_BIN2<>N'superseded' AND SupersededByAfcRequestId IS NULL));
ALTER TABLE paws.AfcRequest ADD CONSTRAINT CK_AfcRequest_NotSelfReplacing CHECK (ReplacesAfcRequestId IS NULL OR ReplacesAfcRequestId<>AfcRequestId);
GO
-- At most one open (pending) date change per approved request.
CREATE UNIQUE INDEX UX_AfcRequest_OpenDateChange ON paws.AfcRequest(ReplacesAfcRequestId)
 WHERE ReplacesAfcRequestId IS NOT NULL AND Status IN (N'pending_report_to',N'pending_admin');
GO

CREATE PROCEDURE paws_api.UpdateAfcDates
 @AfcRecordId uniqueidentifier,
 @SourceKind nvarchar(64),
 @ExpectedVersion varchar(64),
 @StartDate date,
 @EndDate date,
 @WorkDays int,
 @ActorFirebaseUid nvarchar(128),
 @RequestId uniqueidentifier
AS
BEGIN
 SET NOCOUNT ON;
 SET XACT_ABORT ON;
 IF @AfcRecordId IS NULL OR @RequestId IS NULL OR @SourceKind IS NULL OR @SourceKind COLLATE Latin1_General_100_BIN2 NOT IN (N'manual',N'import',N'request')
  THROW 56401,'An exact AFC record and source are required.',1;
 IF @ExpectedVersion IS NULL OR DATALENGTH(@ExpectedVersion)<>16 OR @ExpectedVersion COLLATE Latin1_General_100_BIN2 LIKE '%[^0-9A-Fa-f]%'
  THROW 56401,'An exact AFC version is required.',1;
 IF @StartDate IS NULL OR @EndDate IS NULL OR @EndDate<@StartDate OR DATEDIFF(day,@StartDate,@EndDate)>366
  THROW 56405,'AFC dates are invalid.',1;
 IF @SourceKind=N'request' AND (@WorkDays IS NULL OR @WorkDays<1 OR @WorkDays>267)
  THROW 56405,'AFC working-day count is invalid.',1;
 DECLARE @ExpectedBytes binary(8)=TRY_CONVERT(binary(8),@ExpectedVersion,2),@CurrentBytes binary(8),@Active bit,@Status nvarchar(32),
  @FacultyId uniqueidentifier,@OldStart date,@OldEnd date,@OldWorkDays int,@TrustedName nvarchar(260),@Now datetime2(7)=SYSUTCDATETIME();
 BEGIN TRY
  BEGIN TRANSACTION;
  SELECT @TrustedName=DisplayName FROM paws.UserProfile WITH (HOLDLOCK)
   WHERE FirebaseUid=@ActorFirebaseUid AND Active=1 AND MustChangePassword=0
    AND LOWER(LTRIM(RTRIM(BaseRole))) IN (N'developer',N'owner',N'administrator',N'adfa_general',N'adfa_regular',N'admin');
  IF @@ROWCOUNT=0 THROW 56402,'Administrator permission is required.',1;
  -- Same RequestId retried after an unconfirmed response: return the saved outcome.
  IF EXISTS(SELECT 1 FROM paws.AuditEvent WHERE RequestId=@RequestId AND EventType=N'afc_dates_changed' AND EntityId=CONVERT(nvarchar(36),@AfcRecordId))
  BEGIN
   COMMIT TRANSACTION;
   GOTO Done;
  END;
  IF @SourceKind=N'manual'
   SELECT @CurrentBytes=AfcVersion,@Active=Active,@FacultyId=FacultyId,@OldStart=StartDate,@OldEnd=EndDate FROM paws.AfcManualRecord WITH (UPDLOCK,HOLDLOCK) WHERE AfcRecordId=@AfcRecordId;
  ELSE IF @SourceKind=N'import'
   SELECT @CurrentBytes=AfcVersion,@Active=Active,@FacultyId=FacultyId,@OldStart=StartDate,@OldEnd=EndDate FROM paws.AfcRecord WITH (UPDLOCK,HOLDLOCK) WHERE AfcRecordId=@AfcRecordId;
  ELSE
   SELECT @CurrentBytes=AfcVersion,@Status=Status,@Active=CASE WHEN Status=N'approved' THEN 1 ELSE 0 END,@FacultyId=FacultyId,@OldStart=StartDate,@OldEnd=EndDate,@OldWorkDays=WorkDays
   FROM paws.AfcRequest WITH (UPDLOCK,HOLDLOCK) WHERE AfcRequestId=@AfcRecordId;
  IF @CurrentBytes IS NULL THROW 56403,'AFC record was not found.',1;
  IF @Active<>1 THROW 56406,'Only an active AFC record or approved AFC request can have its dates changed.',1;
  IF @CurrentBytes<>@ExpectedBytes THROW 56404,'AFC record changed; refresh before changing dates.',1;
  IF @SourceKind=N'request' AND EXISTS(SELECT 1 FROM paws.AfcRequest WITH (UPDLOCK,HOLDLOCK) WHERE ReplacesAfcRequestId=@AfcRecordId AND Status IN (N'pending_report_to',N'pending_admin'))
   THROW 56407,'A faculty date change for this request is waiting for approval.',1;
  IF @OldStart=@StartDate AND @OldEnd=@EndDate THROW 56408,'The new dates are the same as the current dates.',1;
  IF @SourceKind=N'manual'
   UPDATE paws.AfcManualRecord SET StartDate=@StartDate,EndDate=@EndDate WHERE AfcRecordId=@AfcRecordId AND AfcVersion=@ExpectedBytes AND Active=1;
  ELSE IF @SourceKind=N'import'
   UPDATE paws.AfcRecord SET StartDate=@StartDate,EndDate=@EndDate WHERE AfcRecordId=@AfcRecordId AND AfcVersion=@ExpectedBytes AND Active=1;
  ELSE
   UPDATE paws.AfcRequest SET StartDate=@StartDate,EndDate=@EndDate,WorkDays=@WorkDays,UpdatedAtUtc=@Now WHERE AfcRequestId=@AfcRecordId AND AfcVersion=@ExpectedBytes AND Status=N'approved';
  IF @@ROWCOUNT<>1 THROW 56404,'AFC record changed; refresh before changing dates.',1;
  INSERT paws.AuditEvent (AuditEventId,EventType,EntityType,EntityId,ActorFirebaseUid,ActorName,OccurredAtUtc,BeforeJson,AfterJson,MetadataJson,RequestId,ImportBatchId)
  VALUES (NEWID(),N'afc_dates_changed',CASE WHEN @SourceKind=N'request' THEN N'afc_request' ELSE N'afc_record' END,CONVERT(nvarchar(36),@AfcRecordId),
   @ActorFirebaseUid,@TrustedName,@Now,
   (SELECT @FacultyId AS facultyId,CONVERT(varchar(10),@OldStart,23) AS startDate,CONVERT(varchar(10),@OldEnd,23) AS endDate,@OldWorkDays AS workDays FOR JSON PATH,WITHOUT_ARRAY_WRAPPER),
   (SELECT @FacultyId AS facultyId,CONVERT(varchar(10),@StartDate,23) AS startDate,CONVERT(varchar(10),@EndDate,23) AS endDate,CASE WHEN @SourceKind=N'request' THEN @WorkDays END AS workDays FOR JSON PATH,WITHOUT_ARRAY_WRAPPER),
   (SELECT @FacultyId AS facultyId,@SourceKind AS sourceKind,N'office' AS changedBy FOR JSON PATH,WITHOUT_ARRAY_WRAPPER),
   @RequestId,NULL);
  COMMIT TRANSACTION;
 END TRY
 BEGIN CATCH
  IF XACT_STATE()<>0 ROLLBACK TRANSACTION;
  THROW;
 END CATCH;
 Done:
 IF @SourceKind=N'manual'
  SELECT AfcRecordId AS afcRecordId,FacultyId AS facultyId,N'manual' AS sourceKind,CONVERT(varchar(10),StartDate,23) AS startDate,CONVERT(varchar(10),EndDate,23) AS endDate,Active AS active,CONVERT(varchar(16),AfcVersion,2) AS versionToken FROM paws.AfcManualRecord WHERE AfcRecordId=@AfcRecordId;
 ELSE IF @SourceKind=N'import'
  SELECT AfcRecordId AS afcRecordId,FacultyId AS facultyId,N'import' AS sourceKind,CONVERT(varchar(10),StartDate,23) AS startDate,CONVERT(varchar(10),EndDate,23) AS endDate,Active AS active,CONVERT(varchar(16),AfcVersion,2) AS versionToken FROM paws.AfcRecord WHERE AfcRecordId=@AfcRecordId;
 ELSE
  SELECT AfcRequestId AS afcRecordId,FacultyId AS facultyId,N'request' AS sourceKind,CONVERT(varchar(10),StartDate,23) AS startDate,CONVERT(varchar(10),EndDate,23) AS endDate,CAST(CASE WHEN Status=N'approved' THEN 1 ELSE 0 END AS bit) AS active,CONVERT(varchar(16),AfcVersion,2) AS versionToken,WorkDays AS workDays FROM paws.AfcRequest WHERE AfcRequestId=@AfcRecordId;
END;
GO

CREATE PROCEDURE paws_api.SubmitAfcDateChange
    @ReplacesAfcRequestId uniqueidentifier,
    @AfcRequestId uniqueidentifier,
    @StartDate date,
    @EndDate date,
    @WorkDays int,
    @Reason nvarchar(32),
    @PurposeDestination nvarchar(1000),
    @Coverage nvarchar(2000),
    @ContactAddress nvarchar(500),
    @ContactPhone nvarchar(50),
    @TermsVersion nvarchar(128),
    @TermsSource nvarchar(512),
    @SignatureMode nvarchar(32),
    @SignatureName nvarchar(260),
    @SignatureSignedAt datetime2(7),
    @SignatureFingerprint char(64),
    @SignatureImageDataUrl nvarchar(max),
    @ActorFirebaseUid nvarchar(256)
AS
BEGIN
 SET NOCOUNT ON;
 SET XACT_ABORT ON;
 SET @ActorFirebaseUid=LTRIM(RTRIM(COALESCE(@ActorFirebaseUid,N'')));
 IF @ReplacesAfcRequestId IS NULL OR @AfcRequestId IS NULL OR NULLIF(@ActorFirebaseUid,N'') IS NULL
  THROW 51510,'The approved AFC request to change is required.',1;
 DECLARE @Requester nvarchar(256),@Status nvarchar(32),@Superseded uniqueidentifier,@FacultyId uniqueidentifier,
  @OldStart date,@OldEnd date,@FacultyName nvarchar(520),@Now datetime2(7)=SYSUTCDATETIME();
 BEGIN TRY
  BEGIN TRANSACTION;
  SELECT @Requester=RequesterFirebaseUid,@Status=Status,@Superseded=SupersededByAfcRequestId,@FacultyId=FacultyId,
   @OldStart=StartDate,@OldEnd=EndDate,@FacultyName=FacultyName
  FROM paws.AfcRequest WITH (UPDLOCK,HOLDLOCK) WHERE AfcRequestId=@ReplacesAfcRequestId;
  IF @Requester IS NULL OR @Requester<>@ActorFirebaseUid THROW 51507,'An approved AFC request was not found for this requester.',1;
  IF @Status<>N'approved' OR @Superseded IS NOT NULL THROW 51510,'Only an approved AFC request can have its dates changed. Withdraw a pending request and submit a new one.',1;
  IF EXISTS(SELECT 1 FROM paws.AfcRequest WITH (UPDLOCK,HOLDLOCK) WHERE ReplacesAfcRequestId=@ReplacesAfcRequestId AND Status IN (N'pending_report_to',N'pending_admin'))
   THROW 51511,'A date change for this AFC request is already waiting for approval.',1;
  IF @StartDate=@OldStart AND @EndDate=@OldEnd THROW 51512,'The new dates are the same as the approved dates.',1;
  -- The normal submission resolves identity, Reports-To routing, teaching
  -- coverage and signature evidence exactly as for a new request.
  EXEC paws_api.SubmitAfcRequest
   @AfcRequestId=@AfcRequestId,@StartDate=@StartDate,@EndDate=@EndDate,@WorkDays=@WorkDays,@Reason=@Reason,
   @PurposeDestination=@PurposeDestination,@Coverage=@Coverage,@ContactAddress=@ContactAddress,@ContactPhone=@ContactPhone,
   @TermsVersion=@TermsVersion,@TermsSource=@TermsSource,@SignatureMode=@SignatureMode,@SignatureName=@SignatureName,
   @SignatureSignedAt=@SignatureSignedAt,@SignatureFingerprint=@SignatureFingerprint,@SignatureImageDataUrl=@SignatureImageDataUrl,
   @ActorFirebaseUid=@ActorFirebaseUid;
  UPDATE paws.AfcRequest SET ReplacesAfcRequestId=@ReplacesAfcRequestId
   WHERE AfcRequestId=@AfcRequestId AND RequesterFirebaseUid=@ActorFirebaseUid AND FacultyId=@FacultyId;
  IF @@ROWCOUNT<>1 THROW 51510,'The AFC date change could not be linked to the approved request.',1;
  INSERT paws.AuditEvent (AuditEventId,EventType,EntityType,EntityId,ActorFirebaseUid,ActorName,OccurredAtUtc,BeforeJson,AfterJson,MetadataJson,RequestId,ImportBatchId)
  VALUES (NEWID(),N'afc_date_change_requested',N'afc_request',CONVERT(nvarchar(36),@ReplacesAfcRequestId),@ActorFirebaseUid,@FacultyName,@Now,
   (SELECT @FacultyId AS facultyId,CONVERT(varchar(10),@OldStart,23) AS startDate,CONVERT(varchar(10),@OldEnd,23) AS endDate FOR JSON PATH,WITHOUT_ARRAY_WRAPPER),
   (SELECT @FacultyId AS facultyId,CONVERT(varchar(10),@StartDate,23) AS startDate,CONVERT(varchar(10),@EndDate,23) AS endDate,@AfcRequestId AS changeRequestId FOR JSON PATH,WITHOUT_ARRAY_WRAPPER),
   (SELECT @FacultyId AS facultyId,N'request' AS sourceKind,N'faculty' AS changedBy FOR JSON PATH,WITHOUT_ARRAY_WRAPPER),
   @AfcRequestId,NULL);
  COMMIT TRANSACTION;
 END TRY
 BEGIN CATCH
  IF XACT_STATE()<>0 ROLLBACK TRANSACTION;
  THROW;
 END CATCH;
END;
GO

CREATE OR ALTER PROCEDURE paws_api.ApproveAfcRequest
    @AfcRequestId uniqueidentifier,
    @ApprovalId uniqueidentifier,
    @SignatureMode nvarchar(32),
    @SignatureName nvarchar(260),
    @SignatureSignedAt datetime2(7),
    @SignatureFingerprint char(64),
    @SignatureImageDataUrl nvarchar(max),
    @ActorFirebaseUid nvarchar(256)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @ActorFirebaseUid = LTRIM(RTRIM(COALESCE(@ActorFirebaseUid, N'')));
    SET @SignatureMode = LTRIM(RTRIM(COALESCE(@SignatureMode, N'')));
    SET @SignatureName = LTRIM(RTRIM(COALESCE(@SignatureName, N'')));
    SET @SignatureFingerprint = LTRIM(RTRIM(COALESCE(@SignatureFingerprint, N'')));

    IF @AfcRequestId IS NULL OR @ApprovalId IS NULL
        THROW 51601, 'AFC request and approval identifiers are required.', 1;
    IF NULLIF(@ActorFirebaseUid, N'') IS NULL
        THROW 51601, 'An authenticated decision actor is required.', 1;
    IF @SignatureMode COLLATE Latin1_General_100_BIN2 NOT IN (N'typed', N'drawn', N'uploaded')
       OR NULLIF(@SignatureName, N'') IS NULL
       OR @SignatureSignedAt IS NULL
       OR LEN(@SignatureFingerprint) <> 64
       OR @SignatureFingerprint LIKE '%[^0-9a-fA-F]%'
        THROW 51605, 'Decision signature evidence is invalid.', 1;
    IF @SignatureImageDataUrl IS NOT NULL AND DATALENGTH(@SignatureImageDataUrl) > 2000000
        THROW 51605, 'Decision signature image is too large.', 1;

    DECLARE
        @ActorRole nvarchar(256),
        @ActorName nvarchar(520),
        @Status nvarchar(32),
        @ReportToFirebaseUid nvarchar(256),
        @FacultyId uniqueidentifier,
        @ReplacesAfcRequestId uniqueidentifier,
        @NewStart date,
        @NewEnd date,
        @OldStart date,
        @OldEnd date,
        @Now datetime2(7) = SYSUTCDATETIME();

    BEGIN TRY
        BEGIN TRANSACTION;

        SELECT
            @ActorRole = LOWER(LTRIM(RTRIM(up.BaseRole))),
            @ActorName = up.DisplayName
        FROM paws.UserProfile AS up WITH (UPDLOCK, HOLDLOCK)
        WHERE up.FirebaseUid = @ActorFirebaseUid
          AND up.Active = 1
          AND up.MustChangePassword = 0;

        IF @ActorRole IS NULL OR @ActorRole NOT IN (
            N'owner', N'administrator', N'adfa_general', N'adfa_regular', N'admin'
        )
            THROW 51604, 'Only an active administrator can approve an AFC request.', 1;

        SELECT
            @Status = ar.Status,
            @ReportToFirebaseUid = ar.ReportToFirebaseUid,
            @FacultyId = ar.FacultyId,
            @ReplacesAfcRequestId = ar.ReplacesAfcRequestId,
            @NewStart = ar.StartDate,
            @NewEnd = ar.EndDate
        FROM paws.AfcRequest AS ar WITH (UPDLOCK, HOLDLOCK)
        WHERE ar.AfcRequestId = @AfcRequestId;

        IF @Status IS NULL
            THROW 51602, 'AFC request was not found.', 1;
        IF @Status COLLATE Latin1_General_100_BIN2 <> N'pending_admin'
            THROW 51603, 'This AFC request is not awaiting Admin approval.', 1;

        IF @ReportToFirebaseUid IS NOT NULL
           AND NOT EXISTS (
                SELECT 1
                FROM paws.AfcApproval AS aa
                WHERE aa.AfcRequestId = @AfcRequestId
                  AND aa.Stage = N'report_to'
                  AND aa.Status = N'approved'
           )
            THROW 51608, 'Reports-To recommendation evidence is required before Admin approval.', 1;

        IF EXISTS (
            SELECT 1
            FROM paws.AfcApproval
            WHERE AfcRequestId = @AfcRequestId
              AND Stage = N'admin'
        )
            THROW 51606, 'An Admin decision already exists for this AFC request.', 1;

        INSERT INTO paws.AfcApproval (
            AfcApprovalId, AfcRequestId, Stage, Status,
            ApproverFirebaseUid, SignatureMode, SignatureName,
            SignatureSignedAtUtc, SignatureFingerprint, SignatureImageDataUrl,
            RejectionReason, DecidedAtUtc, UpdatedAtUtc
        )
        VALUES (
            @ApprovalId, @AfcRequestId, N'admin', N'approved',
            @ActorFirebaseUid, @SignatureMode, @SignatureName,
            @SignatureSignedAt, LOWER(@SignatureFingerprint), @SignatureImageDataUrl,
            NULL, @Now, @Now
        );

        UPDATE paws.AfcRequest
        SET Status = N'approved',
            ApprovedAtUtc = @Now,
            UpdatedAtUtc = @Now
        WHERE AfcRequestId = @AfcRequestId;

        INSERT INTO paws.AuditEvent (
            AuditEventId, EventType, EntityType, EntityId, ActorFirebaseUid,
            ActorName, OccurredAtUtc, BeforeJson, AfterJson, MetadataJson,
            RequestId, ImportBatchId
        )
        VALUES (
            NEWID(), N'afc_request_approved', N'afc_request',
            CONVERT(nvarchar(36), @AfcRequestId),
            @ActorFirebaseUid, @ActorName, @Now,
            (SELECT N'pending_admin' AS status FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
            (SELECT N'approved' AS status,
                    @Now AS approvedAtUtc
             FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
            (SELECT @FacultyId AS facultyId FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
            @ApprovalId, NULL
        );

        -- UX-07: an approved faculty date change replaces the earlier approved
        -- request. The old dates stayed in effect until this approval.
        IF @ReplacesAfcRequestId IS NOT NULL
        BEGIN
            SELECT @OldStart = StartDate, @OldEnd = EndDate
            FROM paws.AfcRequest WITH (UPDLOCK, HOLDLOCK)
            WHERE AfcRequestId = @ReplacesAfcRequestId
              AND Status = N'approved'
              AND SupersededByAfcRequestId IS NULL;

            IF @OldStart IS NOT NULL
            BEGIN
                UPDATE paws.AfcRequest
                SET Status = N'superseded',
                    SupersededByAfcRequestId = @AfcRequestId,
                    UpdatedAtUtc = @Now
                WHERE AfcRequestId = @ReplacesAfcRequestId
                  AND Status = N'approved'
                  AND SupersededByAfcRequestId IS NULL;

                INSERT INTO paws.AuditEvent (
                    AuditEventId, EventType, EntityType, EntityId, ActorFirebaseUid,
                    ActorName, OccurredAtUtc, BeforeJson, AfterJson, MetadataJson,
                    RequestId, ImportBatchId
                )
                VALUES (
                    NEWID(), N'afc_dates_changed', N'afc_request',
                    CONVERT(nvarchar(36), @ReplacesAfcRequestId),
                    @ActorFirebaseUid, @ActorName, @Now,
                    (SELECT @FacultyId AS facultyId,
                            CONVERT(varchar(10), @OldStart, 23) AS startDate,
                            CONVERT(varchar(10), @OldEnd, 23) AS endDate
                     FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
                    (SELECT @FacultyId AS facultyId,
                            CONVERT(varchar(10), @NewStart, 23) AS startDate,
                            CONVERT(varchar(10), @NewEnd, 23) AS endDate,
                            @AfcRequestId AS replacedByAfcRequestId
                     FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
                    (SELECT @FacultyId AS facultyId,
                            N'request' AS sourceKind,
                            N'faculty' AS changedBy
                     FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
                    @ApprovalId, NULL
                );
            END;
        END;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;

    SELECT
        @AfcRequestId AS afcRequestId,
        N'approved' AS status,
        @Now AS approvedAtUtc,
        @Now AS updatedAtUtc;
END;
GO

-- UX-07 history: office and faculty date changes appear with the other AFC events.
ALTER PROCEDURE paws_api.ListChangeHistoryEvents
 @ActorFirebaseUid nvarchar(128),@Scope nvarchar(16),@StartUtc datetime2(7),@EndExclusiveUtc datetime2(7)
AS
BEGIN
 SET NOCOUNT ON;
 DECLARE @Role nvarchar(128),@Faculty uniqueidentifier,@Admin bit=0;
 SELECT @Role=LOWER(LTRIM(RTRIM(BaseRole))),@Faculty=FacultyId FROM paws.UserProfile
 WHERE FirebaseUid=@ActorFirebaseUid AND Active=1 AND MustChangePassword=0;
 IF @Role IS NULL OR @Role NOT IN(N'owner',N'administrator',N'admin',N'developer',N'adfa_general',N'adfa_regular',N'faculty',N'hicc',N'visc',N'adc',N'lab')
 OR (@Role IN(N'faculty',N'hicc',N'visc') AND @Faculty IS NULL) THROW 54701,'History role denied.',1;
 IF @Scope NOT IN(N'mine',N'timetable',N'dashboard') OR @StartUtc IS NULL OR @EndExclusiveUtc IS NULL OR @StartUtc>=@EndExclusiveUtc
 THROW 54702,'Invalid history range or scope.',1;
 IF @Scope=N'mine' AND @Faculty IS NULL THROW 54703,'My history requires a faculty link.',1;
 IF @Role IN(N'owner',N'administrator',N'admin',N'developer',N'adfa_general',N'adfa_regular') SET @Admin=1;
 SELECT TOP(10001) * INTO #HistoryEvents FROM (
 SELECT N'audit' source,CONVERT(nvarchar(36),e.AuditEventId) eventId,e.EventType eventType,e.EntityType entityType,e.EntityId entityId,
 e.OccurredAtUtc occurredAtUtc,e.BeforeJson beforeJson,e.AfterJson afterJson,e.MetadataJson metadataJson,c.ContextJson contextJson,
 e.ActorName actorName,CAST(NULL AS nvarchar(32)) academicYear,CAST(NULL AS uniqueidentifier) facultyId
 FROM paws.AuditEvent e LEFT JOIN paws.ChangeHistoryContext c ON c.AuditEventId=e.AuditEventId
 WHERE e.OccurredAtUtc>=@StartUtc AND e.OccurredAtUtc<@EndExclusiveUtc AND (
 (@Scope IN(N'mine',N'timetable') AND e.EventType IN(N'session_updated',N'session_created',N'session_assignments_replaced',N'swap_applied',N'session_deleted')
 AND (@Scope=N'timetable' OR EXISTS(SELECT 1 FROM paws_api.HistoryAffectedFaculty(e.BeforeJson,e.AfterJson,c.ContextJson) af WHERE af.FacultyId=@Faculty)))
 OR (@Scope=N'dashboard' AND e.EventType IN(N'FacultyUpdated',N'FacultyDeactivated',N'FacultyRestored',N'role_periods_updated',N'trainee_source_refreshed',N'trainee_source_recovered',N'afc_form_uploaded',N'afc_form_linked',N'afc_record_created',N'afc_record_cancelled',N'afc_dates_changed',N'afc_date_change_requested',N'afc_request_submitted',N'afc_request_withdrawn',N'afc_request_recommended',N'afc_request_approved',N'afc_request_rejected')
 AND (@Admin=1 OR EXISTS(SELECT 1 FROM paws_api.HistoryAffectedFaculty(e.BeforeJson,e.AfterJson,c.ContextJson) af WHERE af.FacultyId=@Faculty)
 OR(e.EventType IN(N'afc_form_uploaded',N'afc_form_linked',N'afc_record_created',N'afc_record_cancelled',N'afc_dates_changed',N'afc_date_change_requested',N'afc_request_submitted',N'afc_request_withdrawn',N'afc_request_recommended',N'afc_request_approved',N'afc_request_rejected') AND TRY_CONVERT(uniqueidentifier,JSON_VALUE(e.MetadataJson,'$.facultyId'))=@Faculty)
 OR(e.EventType IN(N'FacultyUpdated',N'FacultyDeactivated',N'FacultyRestored') AND TRY_CONVERT(uniqueidentifier,e.EntityId)=@Faculty)))
 )
 UNION ALL
 SELECT N'doe',CONVERT(nvarchar(36),e.AuditEventId),e.Action,e.EntityType,e.EntityId,e.ChangedAtUtc,e.BeforeJson,e.AfterJson,NULL,
 (SELECT CONVERT(bit,CASE WHEN EXISTS(SELECT 1 FROM paws.DoePolicyPublication p WHERE p.PolicyVersionId=e.PolicyVersionId) THEN 1 ELSE 0 END) wasPublished FOR JSON PATH,WITHOUT_ARRAY_WRAPPER),
 e.ActorName,e.AcademicYear,e.FacultyId
 FROM paws.DoeAuditEvent e WHERE @Scope=N'dashboard' AND e.ChangedAtUtc>=@StartUtc AND e.ChangedAtUtc<@EndExclusiveUtc
 AND ((e.EntityType=N'doe_policy_version' AND e.Action IN(N'draft_created',N'draft_updated',N'working_draft_created',N'published',N'archived')
 AND (@Admin=1 OR e.Action=N'published' OR(e.Action=N'archived' AND EXISTS(SELECT 1 FROM paws.DoePolicyPublication p WHERE p.PolicyVersionId=e.PolicyVersionId AND p.PublishedAtUtc<=e.ChangedAtUtc))))
 OR(e.EntityType IN(N'doe_assignment',N'faculty_doe_target',N'manual_doe_assignment') AND (@Admin=1 OR e.FacultyId=@Faculty)))
 UNION ALL
 -- Receipt/recovery bindings prove historical membership without inferring it
 -- from today's assignments. Only immutable source activity facts are selected;
 -- confidential AFC recovery before-images never leave this read procedure.
 SELECT N'work',CONCAT(CONVERT(nvarchar(36),e.AuditEventId),N':',CONVERT(nvarchar(36),recovery.ActivityId)),e.EventType,N'calendar_activity',CONVERT(nvarchar(256),recovery.ActivityId),e.OccurredAtUtc,
 CASE WHEN e.EventType=N'calendar_activity_import_recovered' THEN(SELECT item.FacultyId facultyId,item.OriginalLabel label,item.Category category,item.StartDate startDate,item.EndDate endDate FOR JSON PATH,WITHOUT_ARRAY_WRAPPER) END,
 CASE WHEN e.EventType=N'calendar_activity_import_committed' THEN(SELECT item.FacultyId facultyId,item.OriginalLabel label,item.Category category,item.StartDate startDate,item.EndDate endDate FOR JSON PATH,WITHOUT_ARRAY_WRAPPER) END,NULL,NULL,
 e.ActorName,NULL,item.FacultyId
 FROM paws.AuditEvent e JOIN paws.CalendarActivityImportReceipt receipt ON receipt.ReceiptId=TRY_CONVERT(uniqueidentifier,e.EntityId)
 JOIN paws.CalendarActivityRecoveryRow recovery ON recovery.ReceiptId=receipt.ReceiptId
 JOIN staging.CalendarActivityImportItem item ON item.ImportBatchId=receipt.ImportBatchId AND item.AfcRecordId=recovery.OriginalAfcRecordId
 WHERE @Scope IN(N'mine',N'dashboard') AND e.EventType IN(N'calendar_activity_import_committed',N'calendar_activity_import_recovered')
 AND e.OccurredAtUtc>=@StartUtc AND e.OccurredAtUtc<@EndExclusiveUtc
 AND ((@Scope=N'dashboard' AND @Admin=1) OR item.FacultyId=@Faculty)
 UNION ALL
 SELECT N'work',CONVERT(nvarchar(36),e.AuditEventId),e.EventType,e.EntityType,e.EntityId,e.OccurredAtUtc,e.BeforeJson,JSON_QUERY(c.ContextJson,'$.workActivity'),NULL,c.ContextJson,
 e.ActorName,NULL,TRY_CONVERT(uniqueidentifier,JSON_VALUE(c.ContextJson,'$.facultyId'))
 FROM paws.AuditEvent e LEFT JOIN paws.ChangeHistoryContext c ON c.AuditEventId=e.AuditEventId
 WHERE e.EventType=N'calendar_activity_time_resolved' AND @Scope IN(N'mine',N'dashboard')
 AND e.OccurredAtUtc>=@StartUtc AND e.OccurredAtUtc<@EndExclusiveUtc
 AND ((@Scope=N'dashboard' AND @Admin=1) OR TRY_CONVERT(uniqueidentifier,JSON_VALUE(c.ContextJson,'$.facultyId'))=@Faculty)
 UNION ALL
 SELECT N'work',CONVERT(nvarchar(36),e.AuditEventId),e.EventType,e.EntityType,e.EntityId,e.OccurredAtUtc,e.BeforeJson,e.AfterJson,NULL,NULL,
 e.ActorName,NULL,COALESCE(TRY_CONVERT(uniqueidentifier,JSON_VALUE(e.AfterJson,'$.facultyId')),TRY_CONVERT(uniqueidentifier,JSON_VALUE(e.BeforeJson,'$.facultyId')))
 FROM paws.AuditEvent e WHERE e.EventType IN(N'ccc_activity_added',N'ccc_activity_removed') AND @Scope IN(N'mine',N'dashboard')
 AND e.OccurredAtUtc>=@StartUtc AND e.OccurredAtUtc<@EndExclusiveUtc
 AND ((@Scope=N'dashboard' AND @Admin=1) OR EXISTS(SELECT 1 FROM paws_api.HistoryAffectedFaculty(e.BeforeJson,e.AfterJson,NULL) affected WHERE affected.FacultyId=@Faculty))
 ) events ORDER BY occurredAtUtc DESC,source,eventId;
 IF (SELECT COUNT(*) FROM #HistoryEvents)>10000 OR (SELECT COALESCE(SUM(CONVERT(bigint,COALESCE(DATALENGTH(beforeJson),0))+COALESCE(DATALENGTH(afterJson),0)+COALESCE(DATALENGTH(contextJson),0)+COALESCE(DATALENGTH(metadataJson),0)),0) FROM #HistoryEvents)>12582912
 THROW 54704,'Narrow the history range before reading.',1;
 -- Resolve only proven historical IDs to opaque filter keys. Today's roster is
 -- never evidence of affected membership; current names label the filter only.
 SELECT events.*,(
 SELECT candidate.FacultyId facultyId,candidate.CandidateKey facultyKey,
 COALESCE(NULLIF(LTRIM(RTRIM(CONCAT(f.PreferredFirstName,N' ',f.PreferredLastName))),N''),f.DisplayName) displayName
 FROM paws.SwapCandidate candidate JOIN paws.Faculty f ON f.FacultyId=candidate.FacultyId
 WHERE candidate.FacultyId IN(
 SELECT FacultyId FROM paws_api.HistoryAffectedFaculty(events.beforeJson,events.afterJson,events.contextJson)
 UNION SELECT events.facultyId WHERE events.facultyId IS NOT NULL
 UNION SELECT TRY_CONVERT(uniqueidentifier,JSON_VALUE(events.metadataJson,'$.facultyId')) WHERE events.eventType IN(N'afc_form_uploaded',N'afc_form_linked',N'afc_record_created',N'afc_record_cancelled',N'afc_dates_changed',N'afc_date_change_requested',N'afc_request_submitted',N'afc_request_withdrawn',N'afc_request_recommended',N'afc_request_approved',N'afc_request_rejected')
 UNION SELECT TRY_CONVERT(uniqueidentifier,events.entityId) WHERE events.eventType IN(N'FacultyUpdated',N'FacultyDeactivated',N'FacultyRestored')
 ) FOR JSON PATH) directoryFacultyJson
 FROM #HistoryEvents events ORDER BY occurredAtUtc DESC,source,eventId;
END;
GO

CREATE ROLE paws_runtime_afc_edit_write AUTHORIZATION dbo;
GRANT EXECUTE ON OBJECT::paws_api.UpdateAfcDates TO paws_runtime_afc_edit_write;
GRANT EXECUTE ON OBJECT::paws_api.SubmitAfcDateChange TO paws_runtime_afc_edit_write;
GRANT SELECT ON OBJECT::paws.AfcRequest (ReplacesAfcRequestId,SupersededByAfcRequestId,AfcVersion) TO paws_runtime_read;
GO
/* Release: add the exact runtime identity to paws_runtime_afc_edit_write, run
   064_afc_date_edit_acceptance.sql, then set PAWS_AFC_EDIT_WRITE_ENABLED=true.
   Rollback: disable the gate and run rollback_064_afc_date_edit.sql. Changed
   dates, superseded requests and audit history are kept. */
