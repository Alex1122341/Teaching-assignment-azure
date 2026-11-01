/* ROLLBACK-ONLY acceptance for 065. Invoke through sqlcmd after applying 065.
   Requires a real active ADFAD admin; fixtures are transactional and not committed. */
:ON ERROR EXIT
SET NOCOUNT ON;
SET XACT_ABORT ON;
IF DB_NAME()<>N'VetMed-Ops' THROW 56580,'Incorrect test database',1;
IF COL_LENGTH(N'paws.Faculty',N'ActivationDate') IS NULL
 OR OBJECT_ID(N'paws_api.CreateFaculty',N'P') IS NULL
 OR OBJECT_ID(N'paws_api.SetFacultyActivation',N'P') IS NULL
 THROW 56581,'065 not installed',1;
DECLARE @AdminUid nvarchar(128) =
 (SELECT TOP (1) FirebaseUid FROM paws.UserProfile
  WHERE Active=1 AND MustChangePassword=0
    AND BaseRole IN (N'owner',N'administrator',N'adfa_general',N'adfa_regular',N'admin')
  ORDER BY FirebaseUid);
IF @AdminUid IS NULL THROW 56582,'No active administrator for transactional acceptance',1;
DECLARE @Email nvarchar(256) = N'paws-065-acceptance-' + LOWER(CONVERT(nvarchar(36),NEWID())) + N'@example.invalid';
DECLARE @Start date = DATEADD(day,40,CONVERT(date,SYSDATETIMEOFFSET() AT TIME ZONE 'Mountain Standard Time'));
DECLARE @Following date=DATEADD(day,41,@Start),@FacultyId uniqueidentifier,
 @NowVersion nvarchar(40);
BEGIN TRY
 BEGIN TRANSACTION;
 EXEC paws_api.CreateFaculty @ActorFirebaseUid=@AdminUid,@DisplayName=N'[ACCEPTANCE] Future Faculty',
      @Email=@Email,@ActivationDate=@Start;
 SELECT @FacultyId=FacultyId,
   @NowVersion=CONVERT(varchar(33),UpdatedAtUtc,126)+'Z'
 FROM paws.Faculty WHERE Email=@Email;
 IF @FacultyId IS NULL THROW 56583,'CreateFaculty did not create canonical Faculty',1;
 IF NOT EXISTS(SELECT 1 FROM paws.Faculty f
     JOIN paws.FacultyProfessionalProfile p ON p.FacultyId=f.FacultyId
     WHERE f.FacultyId=@FacultyId AND f.Active=1 AND f.ActivationDate=@Start)
 THROW 56583,'Future Faculty record or profile was not saved',1;
 IF EXISTS(SELECT 1 FROM paws.Faculty
     WHERE FacultyId=@FacultyId AND
       (ActivationDate IS NULL OR ActivationDate<=CONVERT(date,SYSDATETIMEOFFSET() AT TIME ZONE 'Mountain Standard Time')))
 THROW 56583,'Future Faculty was prematurely activated',1;
 IF (SELECT COUNT_BIG(*) FROM paws.AuditEvent
   WHERE EntityId=CONVERT(nvarchar(36),@FacultyId) AND EventType=N'FacultyCreated')<>1
 THROW 56583,'CreateFaculty audit missing',1;

 EXEC paws_api.SetFacultyActivation @FacultyId=@FacultyId,@ExpectedUpdatedAtUtc=@NowVersion,
      @ActivationDate=@Following,@ActorFirebaseUid=@AdminUid;
 IF NOT EXISTS(SELECT 1 FROM paws.Faculty
   WHERE FacultyId=@FacultyId AND ActivationDate=@Following)
 THROW 56584,'SetFacultyActivation did not persist date',1;
 IF (SELECT COUNT_BIG(*) FROM paws.AuditEvent
   WHERE EntityId=CONVERT(nvarchar(36),@FacultyId) AND EventType=N'FacultyActivationScheduled')<>1
 THROW 56584,'Activation change audit missing',1;

 ROLLBACK TRANSACTION;
END TRY
BEGIN CATCH
 IF XACT_STATE()<>0 ROLLBACK TRANSACTION;
 THROW;
END CATCH;
IF EXISTS(SELECT 1 FROM paws.Faculty WHERE Email=@Email)
 OR EXISTS(SELECT 1 FROM staging.ImportBatch WHERE ImporterVersion=N'paws-faculty-admin-ui-065'
   AND ValidationSummaryJson LIKE N'%"source":"faculty-admin-create"%' AND ActorUpn=
    (SELECT TOP (1) Email FROM paws.UserProfile WHERE FirebaseUid=@AdminUid))
  PRINT N'Acceptance created no committed Faculty rows (external batches may exist).';
PRINT N'FACULTY_FUTURE_ACTIVATION_ROLLBACK_ACCEPTANCE_OK';
