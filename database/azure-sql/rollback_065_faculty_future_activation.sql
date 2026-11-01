/* Guarded reversal of migration 065.
   Refuses removal while any Faculty start date or newly created identity exists.
   Never deletes Faculty or historical assignment data. */
:ON ERROR EXIT
SET NOCOUNT ON;
SET XACT_ABORT ON;
IF DB_NAME()<>N'VetMed-Ops' THROW 56590,'Wrong database',1;
IF COL_LENGTH(N'paws.Faculty',N'ActivationDate') IS NULL
 PRINT N'No Faculty activation column remains.';
ELSE
BEGIN
 IF EXISTS(SELECT 1 FROM paws.Faculty WHERE ActivationDate IS NOT NULL)
  THROW 56591,'Cannot drop Faculty activation dates while records rely on them.',1;
 IF EXISTS(SELECT 1 FROM paws.Faculty f JOIN staging.ImportBatch i
  ON i.ImportBatchId=f.SourceImportBatchId WHERE i.ImporterVersion=N'paws-faculty-admin-ui-065')
  THROW 56592,'Cannot remove Faculty creation path while authored Faculty depend on it.',1;
END;
BEGIN TRANSACTION;
IF OBJECT_ID(N'paws.trg_FacultyActivation_SessionAssignment',N'TR') IS NOT NULL
 DROP TRIGGER paws.trg_FacultyActivation_SessionAssignment;
IF OBJECT_ID(N'paws.trg_FacultyActivation_Session',N'TR') IS NOT NULL
 DROP TRIGGER paws.trg_FacultyActivation_Session;
IF OBJECT_ID(N'paws.trg_FacultyActivation_DraftInstructor',N'TR') IS NOT NULL
 DROP TRIGGER paws.trg_FacultyActivation_DraftInstructor;
IF OBJECT_ID(N'paws.trg_FacultyActivation_Finalization',N'TR') IS NOT NULL
 DROP TRIGGER paws.trg_FacultyActivation_Finalization;
IF OBJECT_ID(N'paws.trg_FacultyActivation_PublishedInstructor',N'TR') IS NOT NULL
 DROP TRIGGER paws.trg_FacultyActivation_PublishedInstructor;
IF OBJECT_ID(N'paws.trg_FacultyActivation_PublishedSession',N'TR') IS NOT NULL
 DROP TRIGGER paws.trg_FacultyActivation_PublishedSession;
IF OBJECT_ID(N'paws_api.CreateFaculty',N'P') IS NOT NULL DROP PROCEDURE paws_api.CreateFaculty;
IF OBJECT_ID(N'paws_api.SetFacultyActivation',N'P') IS NOT NULL DROP PROCEDURE paws_api.SetFacultyActivation;
IF COL_LENGTH(N'paws.Faculty',N'ActivationDate') IS NOT NULL
 ALTER TABLE paws.Faculty DROP COLUMN ActivationDate;
COMMIT TRANSACTION;
PRINT N'FACULTY_065_GUARDED_ROLLBACK_OK';
