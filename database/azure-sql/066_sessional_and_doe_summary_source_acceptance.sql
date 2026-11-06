:ON ERROR EXIT
SET NOCOUNT ON;
SET XACT_ABORT ON;
IF DB_NAME()<>N'VetMed-Ops' OR OBJECT_ID(N'paws.SessionalAssignment',N'U') IS NULL
 OR OBJECT_ID(N'paws.DoeFacultySummarySource',N'U') IS NULL
 THROW 56680,'Migration 066 schema is required.',1;
DECLARE @Assignment uniqueidentifier=(SELECT TOP(1) SessionAssignmentId FROM paws.SessionAssignment ORDER BY SessionAssignmentId),
 @Faculty uniqueidentifier=(SELECT TOP(1) FacultyId FROM paws.Faculty ORDER BY FacultyId);
IF @Assignment IS NULL OR @Faculty IS NULL THROW 56681,'Canonical fixtures are required.',1;
BEGIN TRANSACTION;
-- Only additive presentation fixtures are changed, and always rolled back.
DELETE FROM paws.SessionalAssignment WHERE SessionId=(SELECT SessionId FROM paws.SessionAssignment WHERE SessionAssignmentId=@Assignment);
INSERT paws.SessionalAssignment(SessionId,SessionAssignmentId,ContributorName,SourceSha256,SourceSheet,SourceRow)
 SELECT SessionId,@Assignment,N'[ACCEPTANCE] External instructor',REPLICATE('a',64),N'[ACCEPTANCE]',1 FROM paws.SessionAssignment WHERE SessionAssignmentId=@Assignment;
IF (SELECT ContributorLabel FROM paws.SessionalAssignment WHERE SessionAssignmentId=@Assignment)<>N'Sessional'
 THROW 56682,'Absent subtype must default to Sessional.',1;
UPDATE paws.SessionalAssignment SET ContributorLabel=N'Librarian' WHERE SessionAssignmentId=@Assignment;
IF (SELECT ContributorLabel FROM paws.SessionalAssignment WHERE SessionAssignmentId=@Assignment)<>N'Librarian'
 THROW 56683,'Explicit source subtype was not preserved.',1;
DELETE FROM paws.DoeFacultySummarySource WHERE FacultyId=@Faculty AND AcademicYear=N'2999-00';
INSERT paws.DoeFacultySummarySource(FacultyId,AcademicYear,ContractClinicalTeachingDoe,PotentialGradTeachingDoe,SourceReference,SourceSha256,SourceRow)
 VALUES(@Faculty,N'2999-00',0,NULL,N'[ACCEPTANCE]',REPLICATE('b',64),1);
IF NOT EXISTS(SELECT 1 FROM paws.DoeFacultySummarySource WHERE FacultyId=@Faculty AND AcademicYear=N'2999-00'
 AND ContractClinicalTeachingDoe=0 AND PotentialGradTeachingDoe IS NULL)
 THROW 56684,'Zero and absent source values must remain distinct.',1;
ROLLBACK TRANSACTION;
SELECT N'passed; additive fixtures rolled back' Result;
