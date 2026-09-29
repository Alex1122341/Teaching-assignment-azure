/* BETA-R4D-12A1 repository proposal only. SessionAssignment remains authoritative for final faculty assignment. */
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID(N'paws.Subject', N'U') IS NULL
BEGIN
    CREATE TABLE paws.Subject (
        SubjectId uniqueidentifier NOT NULL CONSTRAINT PK_Subject PRIMARY KEY,
        SubjectKey nvarchar(64) NOT NULL,
        SubjectKeyNormalized AS LOWER(LTRIM(RTRIM(SubjectKey))) PERSISTED,
        Label nvarchar(100) NOT NULL,
        Active bit NOT NULL,
        CreatedAtUtc datetime2(7) NOT NULL CONSTRAINT DF_Subject_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAtUtc datetime2(7) NOT NULL CONSTRAINT DF_Subject_UpdatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT CK_Subject_Key CHECK (SubjectKey = LOWER(LTRIM(RTRIM(SubjectKey))) AND SubjectKey LIKE '[a-z]%' AND SubjectKey NOT LIKE '%[^a-z0-9_-]%'),
        CONSTRAINT CK_Subject_Label CHECK (LEN(LTRIM(RTRIM(Label))) > 0)
    );
    CREATE UNIQUE INDEX UX_Subject_KeyNormalized ON paws.Subject(SubjectKeyNormalized);
END;

IF OBJECT_ID(N'paws.TeachingResponsibility', N'U') IS NULL
BEGIN
    CREATE TABLE paws.TeachingResponsibility (
        ResponsibilityId uniqueidentifier NOT NULL CONSTRAINT PK_TeachingResponsibility PRIMARY KEY,
        ResponsibilityKey nvarchar(64) NOT NULL,
        Kind nvarchar(16) NOT NULL,
        Label nvarchar(120) NOT NULL,
        Active bit NOT NULL,
        CreatedAtUtc datetime2(7) NOT NULL CONSTRAINT DF_TeachingResponsibility_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAtUtc datetime2(7) NOT NULL CONSTRAINT DF_TeachingResponsibility_UpdatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_TeachingResponsibility_Key UNIQUE (ResponsibilityKey),
        CONSTRAINT CK_TeachingResponsibility_Kind CHECK (Kind IN (N'hicc', N'visc'))
    );
END;

IF OBJECT_ID(N'paws.TeachingResponsibilityScope', N'U') IS NULL
BEGIN
    CREATE TABLE paws.TeachingResponsibilityScope (
        ResponsibilityScopeId uniqueidentifier NOT NULL CONSTRAINT PK_TeachingResponsibilityScope PRIMARY KEY,
        HiccResponsibilityId uniqueidentifier NOT NULL,
        CourseId uniqueidentifier NOT NULL,
        SubjectId uniqueidentifier NULL,
        CONSTRAINT FK_TeachingResponsibilityScope_Responsibility FOREIGN KEY (HiccResponsibilityId) REFERENCES paws.TeachingResponsibility(ResponsibilityId),
        CONSTRAINT FK_TeachingResponsibilityScope_Course FOREIGN KEY (CourseId) REFERENCES paws.Course(CourseId),
        CONSTRAINT FK_TeachingResponsibilityScope_Subject FOREIGN KEY (SubjectId) REFERENCES paws.Subject(SubjectId)
    );
    CREATE UNIQUE INDEX UX_TeachingResponsibilityScope_Subject ON paws.TeachingResponsibilityScope(HiccResponsibilityId, CourseId, SubjectId) WHERE SubjectId IS NOT NULL;
    CREATE UNIQUE INDEX UX_TeachingResponsibilityScope_CourseWide ON paws.TeachingResponsibilityScope(HiccResponsibilityId, CourseId) WHERE SubjectId IS NULL;
END;

IF OBJECT_ID(N'paws.TeachingResponsibilityAssignee', N'U') IS NULL
BEGIN
    CREATE TABLE paws.TeachingResponsibilityAssignee (
        ResponsibilityAssigneeId uniqueidentifier NOT NULL CONSTRAINT PK_TeachingResponsibilityAssignee PRIMARY KEY,
        ResponsibilityId uniqueidentifier NOT NULL,
        AcademicYear nvarchar(32) NOT NULL,
        FacultyId uniqueidentifier NOT NULL,
        ActiveDate date NOT NULL,
        ExpirationDate date NOT NULL,
        CONSTRAINT FK_TeachingResponsibilityAssignee_Responsibility FOREIGN KEY (ResponsibilityId) REFERENCES paws.TeachingResponsibility(ResponsibilityId),
        CONSTRAINT FK_TeachingResponsibilityAssignee_Faculty FOREIGN KEY (FacultyId) REFERENCES paws.Faculty(FacultyId),
        CONSTRAINT UQ_TeachingResponsibilityAssignee_Window UNIQUE (ResponsibilityId, AcademicYear, FacultyId, ActiveDate),
        CONSTRAINT CK_TeachingResponsibilityAssignee_Dates CHECK (ExpirationDate > ActiveDate)
    );
    CREATE INDEX IX_TeachingResponsibilityAssignee_ActorWindow ON paws.TeachingResponsibilityAssignee(FacultyId, AcademicYear, ActiveDate, ExpirationDate);
END;

IF OBJECT_ID(N'paws.TeachingAssignmentGroup', N'U') IS NULL
BEGIN
    CREATE TABLE paws.TeachingAssignmentGroup (
        GroupId uniqueidentifier NOT NULL CONSTRAINT PK_TeachingAssignmentGroup PRIMARY KEY,
        GroupKey nvarchar(64) NOT NULL,
        Name nvarchar(120) NOT NULL,
        LeaderViscResponsibilityId uniqueidentifier NOT NULL,
        Active bit NOT NULL,
        CONSTRAINT UQ_TeachingAssignmentGroup_Key UNIQUE (GroupKey),
        CONSTRAINT FK_TeachingAssignmentGroup_Visc FOREIGN KEY (LeaderViscResponsibilityId) REFERENCES paws.TeachingResponsibility(ResponsibilityId)
    );
END;

IF OBJECT_ID(N'paws.TeachingAssignmentGroupHicc', N'U') IS NULL
BEGIN
    CREATE TABLE paws.TeachingAssignmentGroupHicc (
        GroupId uniqueidentifier NOT NULL,
        HiccResponsibilityId uniqueidentifier NOT NULL,
        CONSTRAINT PK_TeachingAssignmentGroupHicc PRIMARY KEY (GroupId, HiccResponsibilityId),
        CONSTRAINT FK_TeachingAssignmentGroupHicc_Group FOREIGN KEY (GroupId) REFERENCES paws.TeachingAssignmentGroup(GroupId),
        CONSTRAINT FK_TeachingAssignmentGroupHicc_Hicc FOREIGN KEY (HiccResponsibilityId) REFERENCES paws.TeachingResponsibility(ResponsibilityId)
    );
END;

IF OBJECT_ID(N'paws.TeachingAssignmentPackage', N'U') IS NULL
BEGIN
    CREATE TABLE paws.TeachingAssignmentPackage (
        TeachingAssignmentPackageId uniqueidentifier NOT NULL CONSTRAINT PK_TeachingAssignmentPackage PRIMARY KEY,
        PackageIdentity nvarchar(256) NOT NULL,
        AcademicYear nvarchar(32) NOT NULL,
        GroupId uniqueidentifier NOT NULL,
        HiccResponsibilityId uniqueidentifier NOT NULL,
        Status nvarchar(32) NOT NULL,
        WorkingRevision int NOT NULL,
        SubmittedWorkingRevision int NULL,
        ViscApprovedWorkingRevision int NULL,
        ReviewFingerprint char(64) NOT NULL,
        ViscApprovedFingerprint char(64) NOT NULL,
        ViscReviewComment nvarchar(2000) NULL,
        CreatedAtUtc datetime2(7) NOT NULL CONSTRAINT DF_TeachingAssignmentPackage_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAtUtc datetime2(7) NOT NULL CONSTRAINT DF_TeachingAssignmentPackage_UpdatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_TeachingAssignmentPackage_Identity UNIQUE (PackageIdentity),
        CONSTRAINT UQ_TeachingAssignmentPackage_Tuple UNIQUE (AcademicYear, GroupId, HiccResponsibilityId),
        CONSTRAINT FK_TeachingAssignmentPackage_Group FOREIGN KEY (GroupId) REFERENCES paws.TeachingAssignmentGroup(GroupId),
        CONSTRAINT FK_TeachingAssignmentPackage_Hicc FOREIGN KEY (HiccResponsibilityId) REFERENCES paws.TeachingResponsibility(ResponsibilityId),
        CONSTRAINT CK_TeachingAssignmentPackage_Status CHECK (Status IN (N'draft', N'visc_review', N'visc_approved', N'changes_requested', N'submitted_to_adfad', N'adfad_finalized')),
        CONSTRAINT CK_TeachingAssignmentPackage_Revisions CHECK (WorkingRevision >= 0 AND (SubmittedWorkingRevision IS NULL OR SubmittedWorkingRevision >= 0) AND (ViscApprovedWorkingRevision IS NULL OR ViscApprovedWorkingRevision >= 0))
    );
    CREATE INDEX IX_TeachingAssignmentPackage_GroupHicc ON paws.TeachingAssignmentPackage(GroupId, HiccResponsibilityId, AcademicYear);
END;

IF OBJECT_ID(N'paws.TeachingSessionOwnership', N'U') IS NULL
BEGIN
    CREATE TABLE paws.TeachingSessionOwnership (
        SessionOwnershipId uniqueidentifier NOT NULL CONSTRAINT PK_TeachingSessionOwnership PRIMARY KEY,
        SessionId uniqueidentifier NOT NULL,
        AcademicYear nvarchar(32) NOT NULL,
        TeachingAssignmentGroupId uniqueidentifier NOT NULL,
        ResponsibleHiccResponsibilityId uniqueidentifier NOT NULL,
        TeachingAssignmentPackageId uniqueidentifier NOT NULL,
        SubjectId uniqueidentifier NULL,
        CONSTRAINT UQ_TeachingSessionOwnership_Session UNIQUE (SessionId),
        CONSTRAINT FK_TeachingSessionOwnership_Session FOREIGN KEY (SessionId) REFERENCES paws.Session(SessionId),
        CONSTRAINT FK_TeachingSessionOwnership_Group FOREIGN KEY (TeachingAssignmentGroupId) REFERENCES paws.TeachingAssignmentGroup(GroupId),
        CONSTRAINT FK_TeachingSessionOwnership_Hicc FOREIGN KEY (ResponsibleHiccResponsibilityId) REFERENCES paws.TeachingResponsibility(ResponsibilityId),
        CONSTRAINT FK_TeachingSessionOwnership_Package FOREIGN KEY (TeachingAssignmentPackageId) REFERENCES paws.TeachingAssignmentPackage(TeachingAssignmentPackageId),
        CONSTRAINT FK_TeachingSessionOwnership_Subject FOREIGN KEY (SubjectId) REFERENCES paws.Subject(SubjectId)
    );
    CREATE INDEX IX_TeachingSessionOwnership_Package ON paws.TeachingSessionOwnership(TeachingAssignmentPackageId, SessionId);
END;
