SET NOCOUNT ON;
SET XACT_ABORT ON;

/*
  B1 proposal only. This migration is intentionally independent of migrations
  005/006 and never changes imported paws.AfcRecord rows.
*/
IF SCHEMA_ID(N'paws_api') IS NULL
    EXEC(N'CREATE SCHEMA paws_api AUTHORIZATION dbo;');
GO

IF OBJECT_ID(N'paws.AfcManualRecord', N'U') IS NULL
BEGIN
    CREATE TABLE paws.AfcManualRecord (
        AfcRecordId uniqueidentifier NOT NULL CONSTRAINT PK_AfcManualRecord PRIMARY KEY,
        FacultyId uniqueidentifier NOT NULL,
        StartDate date NOT NULL,
        EndDate date NOT NULL,
        ReasonCode nvarchar(32) NOT NULL,
        Notes nvarchar(1000) NULL,
        Active bit NOT NULL CONSTRAINT DF_AfcManualRecord_Active DEFAULT (1),
        CreatedAtUtc datetime2(7) NOT NULL CONSTRAINT DF_AfcManualRecord_CreatedAt DEFAULT SYSUTCDATETIME(),
        CreatedByFirebaseUid nvarchar(128) NOT NULL,
        CreatedByName nvarchar(260) NULL,
        RequestId uniqueidentifier NOT NULL,
        CONSTRAINT FK_AfcManualRecord_Faculty FOREIGN KEY (FacultyId) REFERENCES paws.Faculty(FacultyId),
        CONSTRAINT CK_AfcManualRecord_DateRange CHECK (EndDate >= StartDate),
        CONSTRAINT CK_AfcManualRecord_Reason CHECK (ReasonCode IN (
            N'university_travel', N'vacation', N'rsl', N'medical', N'mat', N'special', N'other'
        )),
        CONSTRAINT CK_AfcManualRecord_Notes CHECK (
            ReasonCode NOT IN (N'special', N'other') OR NULLIF(LTRIM(RTRIM(Notes)), N'') IS NOT NULL
        )
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_AfcManualRecord_FacultyDate' AND object_id = OBJECT_ID(N'paws.AfcManualRecord'))
    CREATE INDEX IX_AfcManualRecord_FacultyDate ON paws.AfcManualRecord(FacultyId, StartDate DESC, EndDate DESC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_AfcManualRecord_Active' AND object_id = OBJECT_ID(N'paws.AfcManualRecord'))
    CREATE INDEX IX_AfcManualRecord_Active ON paws.AfcManualRecord(Active, StartDate DESC);
GO

CREATE OR ALTER VIEW paws.vAfcRecordUnified
AS
    SELECT
        a.AfcRecordId,
        a.FacultyId,
        a.StartDate,
        a.EndDate,
        CAST(NULL AS nvarchar(32)) AS ReasonCode,
        a.Purpose AS ReasonDisplay,
        CAST(NULL AS nvarchar(1000)) AS Notes,
        a.Purpose AS LegacyPurpose,
        a.Active,
        CAST(N'import' AS nvarchar(16)) AS SourceKind,
        CAST(NULL AS datetime2(7)) AS CreatedAtUtc,
        CAST(NULL AS nvarchar(260)) AS CreatedByName,
        CONVERT(nvarchar(50), CONCAT(N'import:', CONVERT(varchar(36), a.AfcRecordId))) AS RecordKey
    FROM paws.AfcRecord AS a
    UNION ALL
    SELECT
        m.AfcRecordId,
        m.FacultyId,
        m.StartDate,
        m.EndDate,
        m.ReasonCode,
        CASE m.ReasonCode
            WHEN N'university_travel' THEN N'University Travel'
            WHEN N'vacation' THEN N'Vacation'
            WHEN N'rsl' THEN N'RSL'
            WHEN N'medical' THEN N'Medical'
            WHEN N'mat' THEN N'MAT'
            WHEN N'special' THEN N'Special'
            WHEN N'other' THEN N'Other'
        END AS ReasonDisplay,
        m.Notes,
        CAST(NULL AS nvarchar(1000)) AS LegacyPurpose,
        m.Active,
        CAST(N'manual' AS nvarchar(16)) AS SourceKind,
        m.CreatedAtUtc,
        m.CreatedByName,
        CONVERT(nvarchar(50), CONCAT(N'manual:', CONVERT(varchar(36), m.AfcRecordId))) AS RecordKey
    FROM paws.AfcManualRecord AS m;
GO

CREATE OR ALTER PROCEDURE paws_api.CreateAfcRecord
    @AfcRecordId uniqueidentifier,
    @FacultyId uniqueidentifier,
    @StartDate date,
    @EndDate date,
    @ReasonCode nvarchar(32),
    @Notes nvarchar(1000),
    @ActorFirebaseUid nvarchar(128),
    @ActorName nvarchar(260),
    @RequestId uniqueidentifier
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @ReasonCode = LOWER(LTRIM(RTRIM(@ReasonCode)));
    SET @Notes = NULLIF(LTRIM(RTRIM(COALESCE(@Notes, N''))), N'');
    SET @ActorFirebaseUid = LTRIM(RTRIM(@ActorFirebaseUid));
    SET @ActorName = NULLIF(LTRIM(RTRIM(COALESCE(@ActorName, N''))), N'');

    IF @AfcRecordId IS NULL THROW 51201, 'AfcRecordId is required.', 1;
    IF @RequestId IS NULL THROW 51202, 'RequestId is required.', 1;
    IF @FacultyId IS NULL THROW 51203, 'FacultyId is required.', 1;
    IF NULLIF(@ActorFirebaseUid, N'') IS NULL THROW 51204, 'ActorFirebaseUid is required.', 1;
    IF @StartDate IS NULL OR @EndDate IS NULL THROW 51205, 'AFC dates are required.', 1;
    IF @EndDate < @StartDate THROW 51206, 'EndDate must be on or after StartDate.', 1;
    IF @ReasonCode NOT IN (N'university_travel', N'vacation', N'rsl', N'medical', N'mat', N'special', N'other')
        THROW 51207, 'ReasonCode is not recognised.', 1;
    IF @ReasonCode IN (N'special', N'other') AND NULLIF(@Notes, N'') IS NULL
        THROW 51208, 'Notes are required for Special and Other.', 1;
    IF DATALENGTH(@Notes) / 2 > 1000 THROW 51209, 'Notes are too long.', 1;
    IF NOT EXISTS (SELECT 1 FROM paws.Faculty WHERE FacultyId = @FacultyId AND Active = 1)
        THROW 51210, 'Active Faculty record was not found.', 1;

    BEGIN TRY
        BEGIN TRANSACTION;

        INSERT INTO paws.AfcManualRecord (
            AfcRecordId, FacultyId, StartDate, EndDate, ReasonCode, Notes,
            CreatedByFirebaseUid, CreatedByName, RequestId
        )
        VALUES (
            @AfcRecordId, @FacultyId, @StartDate, @EndDate, @ReasonCode, @Notes,
            @ActorFirebaseUid, @ActorName, @RequestId
        );

        INSERT INTO paws.AuditEvent (
            AuditEventId, EventType, EntityType, EntityId, ActorFirebaseUid,
            ActorName, OccurredAtUtc, BeforeJson, AfterJson, MetadataJson,
            RequestId, ImportBatchId
        )
        VALUES (
            NEWID(), N'afc_record_created', N'afc_record', CONVERT(nvarchar(36), @AfcRecordId),
            @ActorFirebaseUid, @ActorName, SYSUTCDATETIME(), NULL,
            (SELECT @AfcRecordId AS afcRecordId, @FacultyId AS facultyId,
                    @StartDate AS startDate, @EndDate AS endDate,
                    @ReasonCode AS reasonCode, @Notes AS notes, CAST(1 AS bit) AS active
             FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
            NULL, @RequestId, NULL
        );

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;

    SELECT TOP (1)
        u.AfcRecordId AS afcRecordId,
        u.FacultyId AS facultyId,
        f.DisplayName AS facultyName,
        CONVERT(varchar(10), u.StartDate, 23) AS startDate,
        CONVERT(varchar(10), u.EndDate, 23) AS endDate,
        u.ReasonCode AS reasonCode,
        u.ReasonDisplay AS reason,
        u.Notes AS notes,
        u.Active AS active,
        u.SourceKind AS sourceKind
    FROM paws.vAfcRecordUnified AS u
    INNER JOIN paws.Faculty AS f ON f.FacultyId = u.FacultyId
    WHERE u.AfcRecordId = @AfcRecordId;
END;
GO
