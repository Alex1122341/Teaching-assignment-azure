/* Run on a staging/accepted SQL database after migration 064. Every fixture,
   date change, approval and audit row is rolled back. Never COMMIT this script.
   Rejection paths (stale version, second open change, office edit while a
   faculty change is pending) roll back the caller's transaction by design, so
   they are covered by the API/repository tests rather than inside this script. */
:ON ERROR EXIT
SET NOCOUNT ON;
SET XACT_ABORT ON;
IF DB_NAME()<>N'VetMed-Ops' THROW 56410,'AFC date edit acceptance requires VetMed-Ops.',1;
DECLARE @Admin nvarchar(128)=(SELECT TOP (1) FirebaseUid FROM paws.UserProfile WHERE Active=1 AND MustChangePassword=0 AND BaseRole IN (N'owner',N'administrator',N'adfa_general',N'adfa_regular',N'admin'));
DECLARE @FacultyUid nvarchar(256),@Faculty uniqueidentifier;
SELECT TOP (1) @FacultyUid=up.FirebaseUid,@Faculty=up.FacultyId FROM paws.UserProfile up JOIN paws.Faculty f ON f.FacultyId=up.FacultyId AND f.Active=1
 WHERE up.Active=1 AND up.MustChangePassword=0 AND LOWER(up.BaseRole) IN (N'faculty',N'hicc',N'visc') AND f.ReportsToFacultyId IS NULL;
IF @Admin IS NULL OR @Faculty IS NULL THROW 56410,'Acceptance requires an administrator and a faculty account without Reports-To routing.',1;
DECLARE @Record uniqueidentifier=NEWID(),@Version varchar(16),@Edit uniqueidentifier=NEWID(),
 @Original uniqueidentifier=NEWID(),@Change uniqueidentifier=NEWID(),@Fp char(64)=REPLICATE('a',64);
BEGIN TRY
 BEGIN TRANSACTION;
 -- Office edit of a manual AFC record, retried with the same RequestId.
 EXEC paws_api.CreateAfcRecord @AfcRecordId=@Record,@FacultyId=@Faculty,@StartDate='2099-11-05',@EndDate='2099-11-06',@ReasonCode=N'vacation',@Notes=N'Rollback-only acceptance fixture',@ActorFirebaseUid=@Admin,@ActorName=N'Acceptance',@RequestId=NEWID();
 SELECT @Version=VersionToken FROM paws.vAfcRecordUnified WHERE AfcRecordId=@Record AND SourceKind=N'manual';
 EXEC paws_api.UpdateAfcDates @AfcRecordId=@Record,@SourceKind=N'manual',@ExpectedVersion=@Version,@StartDate='2099-11-09',@EndDate='2099-11-10',@WorkDays=NULL,@ActorFirebaseUid=@Admin,@RequestId=@Edit;
 EXEC paws_api.UpdateAfcDates @AfcRecordId=@Record,@SourceKind=N'manual',@ExpectedVersion=@Version,@StartDate='2099-11-09',@EndDate='2099-11-10',@WorkDays=NULL,@ActorFirebaseUid=@Admin,@RequestId=@Edit;
 IF NOT EXISTS(SELECT 1 FROM paws.AfcManualRecord WHERE AfcRecordId=@Record AND StartDate='2099-11-09' AND EndDate='2099-11-10' AND Active=1) THROW 56411,'Office date edit was not saved.',1;
 IF (SELECT COUNT(*) FROM paws.AuditEvent WHERE EntityId=CONVERT(nvarchar(36),@Record) AND EventType=N'afc_dates_changed'
   AND JSON_VALUE(BeforeJson,'$.startDate')='2099-11-05' AND JSON_VALUE(AfterJson,'$.startDate')='2099-11-09')<>1 THROW 56411,'Office edit audit is missing or duplicated.',1;

 -- Faculty date change of an approved request: old dates stay approved until the change is approved.
 EXEC paws_api.SubmitAfcRequest @AfcRequestId=@Original,@StartDate='2099-12-01',@EndDate='2099-12-02',@WorkDays=2,@Reason=N'vacation',@PurposeDestination=NULL,@Coverage=N'Acceptance coverage',
  @ContactAddress=N'Acceptance',@ContactPhone=N'000',@TermsVersion=N'ucvm-afc-terms-page2-v1',@TermsSource=N'absence-from-campus-app.pdf#page=2',
  @SignatureMode=N'typed',@SignatureName=N'Acceptance',@SignatureSignedAt='2099-01-01',@SignatureFingerprint=@Fp,@SignatureImageDataUrl=NULL,@ActorFirebaseUid=@FacultyUid;
 EXEC paws_api.ApproveAfcRequest @AfcRequestId=@Original,@ApprovalId=NEWID(),@SignatureMode=N'typed',@SignatureName=N'Acceptance',@SignatureSignedAt='2099-01-01',@SignatureFingerprint=@Fp,@SignatureImageDataUrl=NULL,@ActorFirebaseUid=@Admin;
 EXEC paws_api.SubmitAfcDateChange @ReplacesAfcRequestId=@Original,@AfcRequestId=@Change,@StartDate='2099-12-03',@EndDate='2099-12-04',@WorkDays=2,@Reason=N'vacation',@PurposeDestination=NULL,@Coverage=N'Acceptance coverage',
  @ContactAddress=N'Acceptance',@ContactPhone=N'000',@TermsVersion=N'ucvm-afc-terms-page2-v1',@TermsSource=N'absence-from-campus-app.pdf#page=2',
  @SignatureMode=N'typed',@SignatureName=N'Acceptance',@SignatureSignedAt='2099-01-01',@SignatureFingerprint=@Fp,@SignatureImageDataUrl=NULL,@ActorFirebaseUid=@FacultyUid;
 IF NOT EXISTS(SELECT 1 FROM paws.AfcRequest WHERE AfcRequestId=@Original AND Status=N'approved' AND SupersededByAfcRequestId IS NULL) THROW 56412,'Old dates must stay approved while the change is pending.',1;
 IF NOT EXISTS(SELECT 1 FROM paws.AfcRequest WHERE AfcRequestId=@Change AND ReplacesAfcRequestId=@Original AND Status=N'pending_admin') THROW 56412,'Date change was not linked to the approved request.',1;
 EXEC paws_api.ApproveAfcRequest @AfcRequestId=@Change,@ApprovalId=NEWID(),@SignatureMode=N'typed',@SignatureName=N'Acceptance',@SignatureSignedAt='2099-01-01',@SignatureFingerprint=@Fp,@SignatureImageDataUrl=NULL,@ActorFirebaseUid=@Admin;
 IF NOT EXISTS(SELECT 1 FROM paws.AfcRequest WHERE AfcRequestId=@Original AND Status=N'superseded' AND SupersededByAfcRequestId=@Change) THROW 56413,'Approved change did not supersede the old request.',1;
 IF NOT EXISTS(SELECT 1 FROM paws.AuditEvent WHERE EntityId=CONVERT(nvarchar(36),@Original) AND EventType=N'afc_dates_changed'
   AND JSON_VALUE(BeforeJson,'$.startDate')='2099-12-01' AND JSON_VALUE(AfterJson,'$.startDate')='2099-12-03') THROW 56413,'Old to new dates were not recorded in history.',1;
 ROLLBACK TRANSACTION;
END TRY
BEGIN CATCH
 IF XACT_STATE()<>0 ROLLBACK TRANSACTION;
 THROW;
END CATCH;
IF EXISTS(SELECT 1 FROM paws.AfcManualRecord WHERE AfcRecordId=@Record) OR EXISTS(SELECT 1 FROM paws.AfcRequest WHERE AfcRequestId IN (@Original,@Change))
 THROW 56414,'Rollback acceptance left its fixtures behind.',1;
PRINT 'AFC_DATE_EDIT_ROLLBACK_ACCEPTANCE_OK';
