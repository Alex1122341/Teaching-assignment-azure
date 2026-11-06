/* Additive, source-backed presentation records. No Faculty, account, target or DOE changes. */
:ON ERROR EXIT
SET NOCOUNT ON;
SET XACT_ABORT ON;
IF DB_NAME()<>N'VetMed-Ops' THROW 56600,'Migration 066 requires VetMed-Ops.',1;
IF OBJECT_ID(N'paws.SessionAssignment',N'U') IS NULL
 OR OBJECT_ID(N'paws.DoeFacultyTarget',N'U') IS NULL
 OR DATABASE_PRINCIPAL_ID(N'paws_runtime_read') IS NULL
 THROW 56601,'Canonical assignment, DOE target and runtime read schema required.',1;
BEGIN TRANSACTION;
IF OBJECT_ID(N'paws.SessionalAssignment',N'U') IS NULL
 CREATE TABLE paws.SessionalAssignment(
  SessionId uniqueidentifier NOT NULL,
  SessionAssignmentId uniqueidentifier NULL,
  ContributorName nvarchar(260) NOT NULL,
  ContributorLabel nvarchar(128) NOT NULL CONSTRAINT DF_SessionalAssignment_Label DEFAULT N'Sessional',
  SourceSha256 char(64) NOT NULL,
  SourceSheet nvarchar(128) NOT NULL,
  SourceRow int NOT NULL,
  RecordedAtUtc datetime2(7) NOT NULL CONSTRAINT DF_SessionalAssignment_Recorded DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_SessionalAssignment PRIMARY KEY(SessionId,ContributorName),
  CONSTRAINT FK_SessionalAssignment_Session FOREIGN KEY(SessionId) REFERENCES paws.Session(SessionId),
  CONSTRAINT FK_SessionalAssignment_Assignment FOREIGN KEY(SessionAssignmentId) REFERENCES paws.SessionAssignment(SessionAssignmentId),
  CONSTRAINT CK_SessionalAssignment_Name CHECK(LEN(LTRIM(RTRIM(ContributorName)))>0),
  CONSTRAINT CK_SessionalAssignment_Label CHECK(LEN(LTRIM(RTRIM(ContributorLabel)))>0),
  CONSTRAINT CK_SessionalAssignment_Source CHECK(SourceRow>0 AND LEN(SourceSha256)=64 AND SourceSha256 NOT LIKE '%[^0-9a-fA-F]%')
 );
IF OBJECT_ID(N'paws.DoeFacultySummarySource',N'U') IS NULL
 CREATE TABLE paws.DoeFacultySummarySource(
  FacultyId uniqueidentifier NOT NULL,
  AcademicYear nvarchar(16) NOT NULL,
  ContractClinicalTeachingDoe decimal(12,6) NULL,
  PotentialGradTeachingDoe decimal(12,6) NULL,
  SourceReference nvarchar(1000) NOT NULL,
  SourceSha256 char(64) NOT NULL,
  SourceRow int NOT NULL,
  RecordedAtUtc datetime2(7) NOT NULL CONSTRAINT DF_DoeFacultySummarySource_Recorded DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_DoeFacultySummarySource PRIMARY KEY(FacultyId,AcademicYear),
  CONSTRAINT FK_DoeFacultySummarySource_Faculty FOREIGN KEY(FacultyId) REFERENCES paws.Faculty(FacultyId),
  CONSTRAINT CK_DoeFacultySummarySource_Clinical CHECK(ContractClinicalTeachingDoe IS NULL OR ContractClinicalTeachingDoe BETWEEN 0 AND 100),
  CONSTRAINT CK_DoeFacultySummarySource_Grad CHECK(PotentialGradTeachingDoe IS NULL OR PotentialGradTeachingDoe>=0),
  CONSTRAINT CK_DoeFacultySummarySource_Source CHECK(SourceRow>0 AND LEN(SourceSha256)=64 AND SourceSha256 NOT LIKE '%[^0-9a-fA-F]%')
 );
IF COL_LENGTH(N'paws.SessionalAssignment',N'ContributorLabel') IS NULL
 OR COL_LENGTH(N'paws.DoeFacultySummarySource',N'PotentialGradTeachingDoe') IS NULL
 THROW 56602,'Existing source schema differs; inspect before retrying.',1;
GRANT SELECT ON OBJECT::paws.SessionalAssignment TO [paws_runtime_read];
GRANT SELECT ON OBJECT::paws.DoeFacultySummarySource TO [paws_runtime_read];
COMMIT TRANSACTION;
