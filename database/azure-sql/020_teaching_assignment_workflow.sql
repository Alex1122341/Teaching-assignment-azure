/*
  PAWS Beta P2: normalized revisions, review history, ADFAD finalization, and
  immutable publication snapshots. This is schema-only; write gates stay closed.
  Apply to VetMed-Ops with sqlcmd :ON ERROR EXIT.
*/
:ON ERROR EXIT
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() <> N'VetMed-Ops'
    THROW 52000, 'Migration 020 must run in VetMed-Ops.', 1;

IF OBJECT_ID(N'paws.TeachingAssignmentPackage', N'U') IS NULL
   OR OBJECT_ID(N'paws.TeachingAssignmentGroup', N'U') IS NULL
   OR OBJECT_ID(N'paws.TeachingAssignmentGroupHicc', N'U') IS NULL
   OR OBJECT_ID(N'paws.TeachingResponsibilityAssignee', N'U') IS NULL
   OR OBJECT_ID(N'paws.TeachingSessionOwnership', N'U') IS NULL
   OR OBJECT_ID(N'paws.Session', N'U') IS NULL
   OR OBJECT_ID(N'paws.SessionAssignment', N'U') IS NULL
   OR OBJECT_ID(N'paws.Faculty', N'U') IS NULL
   OR OBJECT_ID(N'paws.AuditEvent', N'U') IS NULL
   OR OBJECT_ID(N'paws.UserProfile', N'U') IS NULL
   OR OBJECT_ID(N'staging.ImportBatch', N'U') IS NULL
    THROW 52001, 'Migration 020 requires the accepted Beta SQL foundation and migration 019.', 1;

IF OBJECT_ID(N'paws.TeachingAssignmentRevision', N'U') IS NOT NULL
   OR OBJECT_ID(N'paws.TeachingAssignmentRevisionSession', N'U') IS NOT NULL
   OR OBJECT_ID(N'paws.TeachingAssignmentRevisionInstructor', N'U') IS NOT NULL
   OR OBJECT_ID(N'paws.TeachingAssignmentContribution', N'U') IS NOT NULL
   OR OBJECT_ID(N'paws.TeachingAssignmentReview', N'U') IS NOT NULL
   OR OBJECT_ID(N'paws.TeachingAssignmentFinalization', N'U') IS NOT NULL
   OR OBJECT_ID(N'paws.TeachingAssignmentFinalizationLine', N'U') IS NOT NULL
   OR OBJECT_ID(N'paws.TeachingAssignmentCurrentFinalization', N'U') IS NOT NULL
   OR OBJECT_ID(N'paws.TeachingAssignmentPublicationRelease', N'U') IS NOT NULL
   OR OBJECT_ID(N'paws.TeachingAssignmentPublicationState', N'U') IS NOT NULL
   OR OBJECT_ID(N'paws.TeachingAssignmentPublishedSession', N'U') IS NOT NULL
   OR OBJECT_ID(N'paws.TeachingAssignmentPublishedInstructor', N'U') IS NOT NULL
   OR COL_LENGTH(N'paws.TeachingAssignmentPackage', N'DueAtUtc') IS NOT NULL
    THROW 52002, 'Migration 020 objects already exist; inspect the schema before retrying.', 1;
GO

BEGIN TRY
    BEGIN TRANSACTION;

    IF EXISTS (
        SELECT 1 FROM sys.columns
        WHERE object_id = OBJECT_ID(N'paws.TeachingResponsibilityAssignee')
          AND name = N'ExpirationDate' AND is_nullable = 0
    )
        ALTER TABLE paws.TeachingResponsibilityAssignee ALTER COLUMN ExpirationDate date NULL;

    ALTER TABLE paws.TeachingAssignmentPackage ADD DueAtUtc datetime2(7) NULL;

    CREATE TABLE paws.TeachingAssignmentRevision (
        RevisionId uniqueidentifier NOT NULL CONSTRAINT PK_TeachingAssignmentRevision PRIMARY KEY,
        TeachingAssignmentPackageId uniqueidentifier NOT NULL,
        RevisionNumber int NOT NULL,
        CreatedByFirebaseUid nvarchar(128) NOT NULL,
        CreatedByName nvarchar(260) NOT NULL,
        CreatedAtUtc datetime2(7) NOT NULL,
        RevisionNote nvarchar(1000) NULL,
        CONSTRAINT UQ_TeachingAssignmentRevision_PackageNumber UNIQUE (TeachingAssignmentPackageId, RevisionNumber),
        CONSTRAINT UQ_TeachingAssignmentRevision_IdPackage UNIQUE (RevisionId, TeachingAssignmentPackageId),
        CONSTRAINT FK_TeachingAssignmentRevision_Package FOREIGN KEY (TeachingAssignmentPackageId) REFERENCES paws.TeachingAssignmentPackage(TeachingAssignmentPackageId),
        CONSTRAINT CK_TeachingAssignmentRevision_Number CHECK (RevisionNumber > 0),
        CONSTRAINT CK_TeachingAssignmentRevision_Actor CHECK (LEN(LTRIM(RTRIM(CreatedByFirebaseUid))) > 0 AND LEN(LTRIM(RTRIM(CreatedByName))) > 0)
    );

    CREATE TABLE paws.TeachingAssignmentRevisionSession (
        RevisionId uniqueidentifier NOT NULL,
        TeachingAssignmentPackageId uniqueidentifier NOT NULL,
        SessionId uniqueidentifier NOT NULL,
        SessionOrder int NOT NULL,
        CONSTRAINT PK_TeachingAssignmentRevisionSession PRIMARY KEY (RevisionId, SessionId),
        CONSTRAINT UQ_TeachingAssignmentRevisionSession_Order UNIQUE (RevisionId, SessionOrder),
        CONSTRAINT FK_TeachingAssignmentRevisionSession_Revision FOREIGN KEY (RevisionId, TeachingAssignmentPackageId) REFERENCES paws.TeachingAssignmentRevision(RevisionId, TeachingAssignmentPackageId),
        CONSTRAINT FK_TeachingAssignmentRevisionSession_Session FOREIGN KEY (SessionId) REFERENCES paws.Session(SessionId),
        CONSTRAINT CK_TeachingAssignmentRevisionSession_Order CHECK (SessionOrder >= 0)
    );

    CREATE TABLE paws.TeachingAssignmentRevisionInstructor (
        RevisionId uniqueidentifier NOT NULL,
        SessionId uniqueidentifier NOT NULL,
        FacultyId uniqueidentifier NOT NULL,
        TeachingRole nvarchar(256) NOT NULL,
        CONSTRAINT PK_TeachingAssignmentRevisionInstructor PRIMARY KEY (RevisionId, SessionId, FacultyId),
        CONSTRAINT FK_TeachingAssignmentRevisionInstructor_Session FOREIGN KEY (RevisionId, SessionId) REFERENCES paws.TeachingAssignmentRevisionSession(RevisionId, SessionId),
        CONSTRAINT FK_TeachingAssignmentRevisionInstructor_Faculty FOREIGN KEY (FacultyId) REFERENCES paws.Faculty(FacultyId),
        CONSTRAINT CK_TeachingAssignmentRevisionInstructor_Role CHECK (LEN(LTRIM(RTRIM(TeachingRole))) > 0 AND DATALENGTH(TeachingRole) <= 512)
    );

    CREATE TABLE paws.TeachingAssignmentContribution (
        ContributionId uniqueidentifier NOT NULL CONSTRAINT PK_TeachingAssignmentContribution PRIMARY KEY,
        TeachingAssignmentPackageId uniqueidentifier NOT NULL,
        RevisionNumber int NOT NULL,
        SessionId uniqueidentifier NOT NULL,
        CandidateKey nvarchar(128) NOT NULL,
        SuggestedDisplayName nvarchar(260) NOT NULL,
        SuggestedByOffice nvarchar(16) NOT NULL,
        ActorFirebaseUid nvarchar(128) NOT NULL,
        ActorName nvarchar(260) NOT NULL,
        Note nvarchar(1000) NULL,
        CreatedAtUtc datetime2(7) NOT NULL,
        CONSTRAINT UQ_TeachingAssignmentContribution_Candidate UNIQUE (TeachingAssignmentPackageId, RevisionNumber, SessionId, CandidateKey, SuggestedByOffice),
        CONSTRAINT FK_TeachingAssignmentContribution_Package FOREIGN KEY (TeachingAssignmentPackageId) REFERENCES paws.TeachingAssignmentPackage(TeachingAssignmentPackageId),
        CONSTRAINT FK_TeachingAssignmentContribution_Session FOREIGN KEY (SessionId) REFERENCES paws.Session(SessionId),
        CONSTRAINT CK_TeachingAssignmentContribution_Revision CHECK (RevisionNumber > 0),
        CONSTRAINT CK_TeachingAssignmentContribution_Candidate CHECK (LEN(LTRIM(RTRIM(CandidateKey))) > 0 AND DATALENGTH(CandidateKey) <= 256),
        CONSTRAINT CK_TeachingAssignmentContribution_Display CHECK (LEN(LTRIM(RTRIM(SuggestedDisplayName))) > 0 AND DATALENGTH(SuggestedDisplayName) <= 520),
        CONSTRAINT CK_TeachingAssignmentContribution_Office CHECK (SuggestedByOffice COLLATE Latin1_General_100_BIN2 IN (N'adc', N'lab', N'hicc')),
        CONSTRAINT CK_TeachingAssignmentContribution_Actor CHECK (LEN(LTRIM(RTRIM(ActorFirebaseUid))) > 0 AND LEN(LTRIM(RTRIM(ActorName))) > 0)
    );
    CREATE INDEX IX_TeachingAssignmentContribution_PackageRevision ON paws.TeachingAssignmentContribution(TeachingAssignmentPackageId, RevisionNumber, CreatedAtUtc);

    CREATE TABLE paws.TeachingAssignmentReview (
        ReviewId uniqueidentifier NOT NULL CONSTRAINT PK_TeachingAssignmentReview PRIMARY KEY,
        TeachingAssignmentPackageId uniqueidentifier NOT NULL,
        RevisionId uniqueidentifier NOT NULL,
        RevisionNumber int NOT NULL,
        Decision nvarchar(24) NOT NULL,
        Comment nvarchar(2000) NULL,
        ActorFirebaseUid nvarchar(128) NOT NULL,
        ActorName nvarchar(260) NOT NULL,
        ActorResponsibilityId nvarchar(64) NOT NULL,
        CreatedAtUtc datetime2(7) NOT NULL,
        ContentFingerprint char(64) NOT NULL,
        CONSTRAINT FK_TeachingAssignmentReview_Revision FOREIGN KEY (RevisionId, TeachingAssignmentPackageId) REFERENCES paws.TeachingAssignmentRevision(RevisionId, TeachingAssignmentPackageId),
        CONSTRAINT FK_TeachingAssignmentReview_Responsibility FOREIGN KEY (ActorResponsibilityId) REFERENCES paws.TeachingResponsibility(ResponsibilityId),
        CONSTRAINT CK_TeachingAssignmentReview_Decision CHECK (Decision COLLATE Latin1_General_100_BIN2 IN (N'approved', N'push_back')),
        CONSTRAINT CK_TeachingAssignmentReview_Comment CHECK (Decision <> N'push_back' OR NULLIF(LTRIM(RTRIM(Comment)), N'') IS NOT NULL),
        CONSTRAINT CK_TeachingAssignmentReview_Fingerprint CHECK (DATALENGTH(ContentFingerprint) = 64 AND ContentFingerprint COLLATE Latin1_General_100_BIN2 NOT LIKE '%[^0-9a-f]%'),
        CONSTRAINT CK_TeachingAssignmentReview_Actor CHECK (LEN(LTRIM(RTRIM(ActorFirebaseUid))) > 0 AND LEN(LTRIM(RTRIM(ActorName))) > 0 AND RevisionNumber > 0)
    );
    CREATE INDEX IX_TeachingAssignmentReview_PackageHistory ON paws.TeachingAssignmentReview(TeachingAssignmentPackageId, CreatedAtUtc, RevisionNumber);

    CREATE TABLE paws.TeachingAssignmentFinalization (
        FinalizationId uniqueidentifier NOT NULL CONSTRAINT PK_TeachingAssignmentFinalization PRIMARY KEY,
        TeachingAssignmentPackageId uniqueidentifier NOT NULL,
        RevisionId uniqueidentifier NOT NULL,
        RevisionNumber int NOT NULL,
        VersionNumber int NOT NULL,
        ActorFirebaseUid nvarchar(128) NOT NULL,
        ActorName nvarchar(260) NOT NULL,
        FinalNote nvarchar(2000) NULL,
        CreatedAtUtc datetime2(7) NOT NULL,
        CONSTRAINT UQ_TeachingAssignmentFinalization_PackageVersion UNIQUE (TeachingAssignmentPackageId, VersionNumber),
        CONSTRAINT UQ_TeachingAssignmentFinalization_IdPackage UNIQUE (FinalizationId, TeachingAssignmentPackageId),
        CONSTRAINT FK_TeachingAssignmentFinalization_Revision FOREIGN KEY (RevisionId, TeachingAssignmentPackageId) REFERENCES paws.TeachingAssignmentRevision(RevisionId, TeachingAssignmentPackageId),
        CONSTRAINT CK_TeachingAssignmentFinalization_Version CHECK (VersionNumber > 0 AND RevisionNumber > 0),
        CONSTRAINT CK_TeachingAssignmentFinalization_Actor CHECK (LEN(LTRIM(RTRIM(ActorFirebaseUid))) > 0 AND LEN(LTRIM(RTRIM(ActorName))) > 0)
    );

    CREATE TABLE paws.TeachingAssignmentCurrentFinalization (
        TeachingAssignmentPackageId uniqueidentifier NOT NULL CONSTRAINT PK_TeachingAssignmentCurrentFinalization PRIMARY KEY,
        FinalizationId uniqueidentifier NOT NULL,
        CONSTRAINT FK_TeachingAssignmentCurrentFinalization_Finalization FOREIGN KEY (FinalizationId, TeachingAssignmentPackageId) REFERENCES paws.TeachingAssignmentFinalization(FinalizationId, TeachingAssignmentPackageId)
    );

    CREATE TABLE paws.TeachingAssignmentFinalizationLine (
        FinalizationId uniqueidentifier NOT NULL,
        SessionAssignmentId uniqueidentifier NOT NULL,
        SessionId uniqueidentifier NOT NULL,
        FacultyId uniqueidentifier NOT NULL,
        FacultyDisplayName nvarchar(260) NOT NULL,
        TeachingRole nvarchar(256) NOT NULL,
        CONSTRAINT PK_TeachingAssignmentFinalizationLine PRIMARY KEY (FinalizationId, SessionAssignmentId),
        CONSTRAINT FK_TeachingAssignmentFinalizationLine_Finalization FOREIGN KEY (FinalizationId) REFERENCES paws.TeachingAssignmentFinalization(FinalizationId),
        CONSTRAINT FK_TeachingAssignmentFinalizationLine_Session FOREIGN KEY (SessionId) REFERENCES paws.Session(SessionId),
        CONSTRAINT FK_TeachingAssignmentFinalizationLine_Faculty FOREIGN KEY (FacultyId) REFERENCES paws.Faculty(FacultyId)
    );

    CREATE TABLE paws.TeachingAssignmentPublicationRelease (
        ReleaseId uniqueidentifier NOT NULL CONSTRAINT PK_TeachingAssignmentPublicationRelease PRIMARY KEY,
        AcademicYear nvarchar(32) NOT NULL,
        VersionNumber int NOT NULL,
        PublishedAtUtc datetime2(7) NOT NULL,
        PublishedByFirebaseUid nvarchar(128) NOT NULL,
        PublishedByName nvarchar(260) NOT NULL,
        PublicationNote nvarchar(2000) NULL,
        CONSTRAINT UQ_TeachingAssignmentPublicationRelease_YearVersion UNIQUE (AcademicYear, VersionNumber),
        CONSTRAINT UQ_TeachingAssignmentPublicationRelease_IdYear UNIQUE (ReleaseId, AcademicYear),
        CONSTRAINT CK_TeachingAssignmentPublicationRelease_AcademicYear CHECK (AcademicYear LIKE '[1-9][0-9][0-9][0-9]-[0-9][0-9]' AND TRY_CONVERT(int, RIGHT(AcademicYear, 2)) = (TRY_CONVERT(int, LEFT(AcademicYear, 4)) + 1) % 100),
        CONSTRAINT CK_TeachingAssignmentPublicationRelease_Actor CHECK (VersionNumber > 0 AND LEN(LTRIM(RTRIM(PublishedByFirebaseUid))) > 0 AND LEN(LTRIM(RTRIM(PublishedByName))) > 0)
    );

    CREATE TABLE paws.TeachingAssignmentPublicationState (
        AcademicYear nvarchar(32) NOT NULL CONSTRAINT PK_TeachingAssignmentPublicationState PRIMARY KEY,
        CurrentReleaseId uniqueidentifier NOT NULL,
        CONSTRAINT FK_TeachingAssignmentPublicationState_Release FOREIGN KEY (CurrentReleaseId, AcademicYear) REFERENCES paws.TeachingAssignmentPublicationRelease(ReleaseId, AcademicYear)
    );

    CREATE TABLE paws.TeachingAssignmentPublishedSession (
        PublishedSessionId uniqueidentifier NOT NULL CONSTRAINT PK_TeachingAssignmentPublishedSession PRIMARY KEY,
        ReleaseId uniqueidentifier NOT NULL,
        SessionId uniqueidentifier NOT NULL,
        CourseCode nvarchar(32) NULL,
        CourseName nvarchar(512) NULL,
        Topic nvarchar(max) NULL,
        SessionType nvarchar(128) NULL,
        SessionDate date NULL,
        StartTime time(0) NULL,
        EndTime time(0) NULL,
        Room nvarchar(256) NULL,
        SourcePackageId uniqueidentifier NULL,
        SourceRevisionNumber int NULL,
        CONSTRAINT UQ_TeachingAssignmentPublishedSession_ReleaseSession UNIQUE (ReleaseId, SessionId),
        CONSTRAINT FK_TeachingAssignmentPublishedSession_Release FOREIGN KEY (ReleaseId) REFERENCES paws.TeachingAssignmentPublicationRelease(ReleaseId),
        CONSTRAINT FK_TeachingAssignmentPublishedSession_Session FOREIGN KEY (SessionId) REFERENCES paws.Session(SessionId),
        CONSTRAINT FK_TeachingAssignmentPublishedSession_Package FOREIGN KEY (SourcePackageId) REFERENCES paws.TeachingAssignmentPackage(TeachingAssignmentPackageId)
    );

    CREATE TABLE paws.TeachingAssignmentPublishedInstructor (
        PublishedSessionId uniqueidentifier NOT NULL,
        FacultyId uniqueidentifier NOT NULL,
        FacultyDisplayName nvarchar(260) NOT NULL,
        TeachingRole nvarchar(256) NOT NULL,
        CONSTRAINT PK_TeachingAssignmentPublishedInstructor PRIMARY KEY (PublishedSessionId, FacultyId, TeachingRole),
        CONSTRAINT FK_TeachingAssignmentPublishedInstructor_Session FOREIGN KEY (PublishedSessionId) REFERENCES paws.TeachingAssignmentPublishedSession(PublishedSessionId),
        CONSTRAINT FK_TeachingAssignmentPublishedInstructor_Faculty FOREIGN KEY (FacultyId) REFERENCES paws.Faculty(FacultyId)
    );
    CREATE INDEX IX_TeachingAssignmentPublicationRelease_YearVersion ON paws.TeachingAssignmentPublicationRelease(AcademicYear, VersionNumber DESC);

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
GO
