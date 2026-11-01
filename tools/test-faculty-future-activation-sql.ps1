param([Parameter(Mandatory=$true)][string]$ContainerName)
$ErrorActionPreference='Stop'
# Test only against the existing labeled synthetic Docker container and its
# generated password; deliberately no server, port or cloud/University fallback.
. (Join-Path $PSScriptRoot 'test-calendar-activity-sql.ps1') -ContainerName $ContainerName -Through '041' -SkipAcceptance
Invoke-TestSql @'
INSERT paws.UserProfile(FirebaseUid,Email,DisplayName,BaseRole,Active,MustChangePassword)
VALUES(N'faculty065-owner',N'owner065@example.invalid',N'[065] Synthetic Admin',N'owner',1,0);
'@ 'VetMed-Ops'
Invoke-TestSql (Get-Content -LiteralPath (Join-Path $repoPath 'database/azure-sql/065_faculty_future_activation.sql') -Raw) 'VetMed-Ops'
Invoke-TestSql (Get-Content -LiteralPath (Join-Path $repoPath 'database/azure-sql/065_faculty_future_activation_acceptance.sql') -Raw) 'VetMed-Ops'
Invoke-TestSql @'
SET NOCOUNT ON;
DECLARE @Email nvarchar(256)=N'faculty065-synthetic@example.invalid',@FacultyId uniqueidentifier,@BatchId uniqueidentifier,
 @BeforeSession uniqueidentifier=NEWID(),@AfterSession uniqueidentifier=NEWID(),@BeforeAssign uniqueidentifier=NEWID(),@AfterAssign uniqueidentifier=NEWID();
EXEC paws_api.CreateFaculty @ActorFirebaseUid=N'faculty065-owner',@DisplayName=N'[065] Scheduled Hire',@Email=@Email,@ActivationDate='2099-06-01';
SELECT @FacultyId=FacultyId,@BatchId=SourceImportBatchId FROM paws.Faculty WHERE Email=@Email;
IF @FacultyId IS NULL OR @BatchId IS NULL THROW 56570,'No saved synthetic Faculty',1;
INSERT paws.Session (SessionId,AcademicYear,CourseCode,SessionType,SessionDate,SourceImportBatchId)
VALUES(@BeforeSession,N'2099-00',N'065TEST',N'LEC','2099-05-31',@BatchId),
      (@AfterSession,N'2099-00',N'065TEST',N'LEC','2099-06-01',@BatchId);
DECLARE @Rejected bit=0;
BEGIN TRY
 INSERT paws.SessionAssignment(SessionAssignmentId,SessionId,FacultyId,FacultyResolutionStatus,SourceImportBatchId,SourceRow)
 VALUES(@BeforeAssign,@BeforeSession,@FacultyId,N'resolved',@BatchId,1);
END TRY BEGIN CATCH
 IF ERROR_NUMBER()=56551 SET @Rejected=1;ELSE THROW;
END CATCH;
IF @Rejected<>1 OR EXISTS(SELECT 1 FROM paws.SessionAssignment WHERE SessionAssignmentId=@BeforeAssign)
 THROW 56571,'Pre-start session assignment was not rejected atomically',1;
PRINT 'FACULTY_065_PRESTART_ASSIGNMENT_DENIED';
INSERT paws.SessionAssignment(SessionAssignmentId,SessionId,FacultyId,FacultyResolutionStatus,SourceImportBatchId,SourceRow)
VALUES(@AfterAssign,@AfterSession,@FacultyId,N'resolved',@BatchId,2);
IF NOT EXISTS(SELECT 1 FROM paws.SessionAssignment WHERE SessionAssignmentId=@AfterAssign)
 THROW 56572,'Effective-date session assignment was rejected',1;
PRINT 'FACULTY_065_START_DATE_ASSIGNMENT_ALLOWED';
SET @Rejected=0;
BEGIN TRY
 UPDATE paws.Session SET SessionDate='2099-05-31' WHERE SessionId=@AfterSession;
END TRY BEGIN CATCH
 IF ERROR_NUMBER()=56551 SET @Rejected=1;ELSE THROW;
END CATCH;
IF @Rejected<>1 OR EXISTS(SELECT 1 FROM paws.Session WHERE SessionId=@AfterSession AND SessionDate='2099-05-31')
 THROW 56573,'Rescheduling before start date was not denied atomically',1;
PRINT 'FACULTY_065_SESSION_REDATE_DENIED';
DECLARE @Version nvarchar(40)=(SELECT CONVERT(varchar(33),UpdatedAtUtc,126)+'Z' FROM paws.Faculty WHERE FacultyId=@FacultyId);
SET @Rejected=0;
BEGIN TRY
 EXEC paws_api.SetFacultyActivation @FacultyId=@FacultyId,@ExpectedUpdatedAtUtc=@Version,@ActivationDate='2099-06-02',@ActorFirebaseUid=N'faculty065-owner';
END TRY BEGIN CATCH
 IF ERROR_NUMBER()=56552 SET @Rejected=1;ELSE THROW;
END CATCH;
IF @Rejected<>1 OR EXISTS(SELECT 1 FROM paws.Faculty WHERE FacultyId=@FacultyId AND ActivationDate='2099-06-02')
 THROW 56574,'Moving effective start after assigned session was not denied',1;
PRINT 'FACULTY_065_BACKDATING_EXISTING_ASSIGNMENT_DENIED';
UPDATE paws.Faculty SET Active=0 WHERE FacultyId=@FacultyId;
SET @Rejected=0;
BEGIN TRY
 INSERT paws.SessionAssignment(SessionAssignmentId,SessionId,FacultyId,FacultyResolutionStatus,SourceImportBatchId,SourceRow)
 VALUES(NEWID(),@AfterSession,@FacultyId,N'resolved',@BatchId,3);
END TRY BEGIN CATCH
 IF ERROR_NUMBER()=56551 SET @Rejected=1;ELSE THROW;
END CATCH;
IF @Rejected<>1 THROW 56575,'Manual deactivation did not block new assignments',1;
PRINT 'FACULTY_065_MANUAL_DEACTIVATION_WINS';
'@ 'VetMed-Ops'
# Preserve data and stop an unsafe schema reversal when an authored Faculty
# depends on 065. Rehearse the actual rollback in a fresh synthetic database.
$rollback=Get-Content -LiteralPath (Join-Path $repoPath 'database/azure-sql/rollback_065_faculty_future_activation.sql') -Raw
$firstBatch=([regex]::Replace($rollback,'(?m)^:[^\r\n]+\r?\n','') -split '(?m)^GO[ \t]*$')[0]
$escaped=$firstBatch.Replace("'","''")
Invoke-TestSql "DECLARE @Refused bit=0;BEGIN TRY EXEC(N'$escaped');END TRY BEGIN CATCH IF XACT_STATE()<>0 ROLLBACK;IF ERROR_NUMBER() IN(56591,56592) SET @Refused=1;ELSE THROW;END CATCH;IF @Refused=0 THROW 56576,'Used 065 rollback was not refused.',1;PRINT 'FACULTY_065_USED_ROLLBACK_REFUSED';" 'VetMed-Ops'
. (Join-Path $PSScriptRoot 'test-calendar-activity-sql.ps1') -ContainerName $ContainerName -Through '041' -SkipAcceptance
Invoke-TestSql (Get-Content -LiteralPath (Join-Path $repoPath 'database/azure-sql/065_faculty_future_activation.sql') -Raw) 'VetMed-Ops'
Invoke-TestSql $rollback 'VetMed-Ops'
Invoke-TestSql "IF COL_LENGTH(N'paws.Faculty',N'ActivationDate') IS NOT NULL OR OBJECT_ID(N'paws_api.CreateFaculty',N'P') IS NOT NULL OR OBJECT_ID(N'paws_api.SetFacultyActivation',N'P') IS NOT NULL THROW 56577,'Empty rollback left protected objects.',1;PRINT 'FACULTY_065_EMPTY_ROLLBACK_OK';" 'VetMed-Ops'
