/* Source-backed Worksheet recovery. Does not publish the draft Annual Rule Book. */
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF OBJECT_ID(N'paws.DoeWorkloadSource',N'U') IS NULL
CREATE TABLE paws.DoeWorkloadSource (
 AcademicYear nvarchar(32) NOT NULL PRIMARY KEY,
 ParametersJson nvarchar(max) NOT NULL CHECK(ISJSON(ParametersJson)=1),
 SourceReference nvarchar(1000) NOT NULL,
 SourceSha256 char(64) NOT NULL,
 ApprovedBy nvarchar(128) NOT NULL,
 CreatedAtUtc datetime2(7) NOT NULL DEFAULT SYSUTCDATETIME()
);
IF OBJECT_ID(N'paws.DoeSupervisionSourceSnapshot',N'U') IS NULL
CREATE TABLE paws.DoeSupervisionSourceSnapshot (
 SnapshotId uniqueidentifier NOT NULL PRIMARY KEY,
 FacultyId uniqueidentifier NOT NULL REFERENCES paws.Faculty(FacultyId),
 AcademicYear nvarchar(32) NOT NULL REFERENCES paws.DoeWorkloadSource(AcademicYear),
 RawDoe decimal(12,6) NOT NULL CHECK(RawDoe>=0),
 EvidenceJson nvarchar(max) NOT NULL CHECK(ISJSON(EvidenceJson)=1),
 SourceReference nvarchar(1000) NOT NULL,
 SourceSha256 char(64) NOT NULL,
 CreatedBy nvarchar(128) NOT NULL,
 CreatedAtUtc datetime2(7) NOT NULL DEFAULT SYSUTCDATETIME(),
 CONSTRAINT UQ_DoeSupervisionSourceSnapshot_FacultyYear UNIQUE(FacultyId,AcademicYear)
);
COMMIT;
