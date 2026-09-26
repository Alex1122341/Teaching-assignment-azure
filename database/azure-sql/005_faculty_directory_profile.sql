-- PAWS Faculty Directory Profile — Phase A.
--
-- Phase A is deliberately narrow. It carries only the three approved directory
-- attributes (Campus, OfficeLocation, LabLocation) plus provenance and
-- timestamps. The following attributes are explicitly NOT part of this
-- migration and remain deferred for architect/domain review:
--
--   OfficeSpaceDetails, CurrentTitle, AppointmentType, EducationRank,
--   LegacyDepartment, TeachingAreaEmphasis, ClinicianDiagnostician,
--   EducationSummary, BoardSpecialties, TenureDate, TotalYearsExperience,
--   AwayFromCampusRecords
--
-- This script is additive and non-destructive. It creates exactly one new table
-- and does not ALTER, DROP, or TRUNCATE any existing paws.* or staging.* object.
--
-- It is NOT executed by tools/load_paws_azure_sql_empty.ps1. Like
-- 003_app_permissions.sql, it is a reviewed DDL artifact applied by a separate
-- operator gate after review. No live apply is performed by this branch.
--
-- SourceImportBatchId is NULLABLE and constrained by a foreign key to
-- staging.ImportBatch(ImportBatchId). The staging.ImportBatch model is generic
-- provenance (batch id, status, source manifest hash, importer version,
-- validation summary) and is not limited to workbook rows, so the one-time
-- Firestore enrichment import reuses it rather than introducing a second
-- provenance table. Nullable because a row may be created outside a tracked
-- batch; when a batch is recorded it must exist.

CREATE TABLE paws.FacultyDirectoryProfile (
    FacultyId uniqueidentifier NOT NULL CONSTRAINT PK_FacultyDirectoryProfile PRIMARY KEY,
    Campus nvarchar(50) NULL,
    OfficeLocation nvarchar(120) NULL,
    LabLocation nvarchar(120) NULL,
    SourceImportBatchId uniqueidentifier NULL,
    CreatedAtUtc datetime2(7) NOT NULL CONSTRAINT DF_FacultyDirectoryProfile_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAtUtc datetime2(7) NOT NULL CONSTRAINT DF_FacultyDirectoryProfile_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_FacultyDirectoryProfile_Faculty FOREIGN KEY (FacultyId) REFERENCES paws.Faculty(FacultyId),
    CONSTRAINT FK_FacultyDirectoryProfile_ImportBatch FOREIGN KEY (SourceImportBatchId) REFERENCES staging.ImportBatch(ImportBatchId)
);
