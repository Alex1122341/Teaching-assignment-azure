:ON ERROR EXIT
SET NOCOUNT ON;
SET XACT_ABORT ON;
IF DB_NAME()<>N'VetMed-Ops' THROW 54000,'060 requires the reviewed VetMed-Ops target.',1;
IF OBJECT_ID(N'paws.UserProfile',N'U') IS NULL OR OBJECT_ID(N'paws.AuditEvent',N'U') IS NULL OR SCHEMA_ID(N'paws_api') IS NULL THROW 54000,'060 requires the accepted SQL authority foundation.',1;
-- Apply once. An existing candidate or unknown object needs explicit release reconciliation.
IF COL_LENGTH(N'paws.UserProfile',N'AccessVersion') IS NOT NULL OR OBJECT_ID(N'paws.AccountAccessChange') IS NOT NULL OR OBJECT_ID(N'paws_api.SetAccountAccess') IS NOT NULL THROW 54000,'060 refuses an existing or unknown access deployment.',1;
BEGIN TRANSACTION;
ALTER TABLE paws.UserProfile ADD AccessVersion rowversion NOT NULL;
CREATE TABLE paws.AccountAccessChange(
 OperationId uniqueidentifier NOT NULL CONSTRAINT PK_AccountAccessChange PRIMARY KEY,
 PreviewId uniqueidentifier NOT NULL,
 ActorUid nvarchar(128) NOT NULL,
 TargetUid nvarchar(128) NOT NULL,
 IntentHash char(64) NOT NULL,
 Reason nvarchar(1000) NOT NULL,
 ReceiptJson nvarchar(max) NOT NULL,
 CreatedAtUtc datetime2(7) NOT NULL,
 CONSTRAINT CK_AccountAccessChange_Receipt CHECK(ISJSON(ReceiptJson)=1),
 CONSTRAINT CK_AccountAccessChange_Reason CHECK(LEN(LTRIM(RTRIM(Reason)))>0)
);
CREATE INDEX IX_AccountAccessChange_TargetTime ON paws.AccountAccessChange(TargetUid,CreatedAtUtc DESC,OperationId DESC);
GO
CREATE PROCEDURE paws_api.SetAccountAccess
 @ActorUid nvarchar(128),@ActorVersion varchar(16),@TargetUid nvarchar(128),@ExpectedVersion varchar(16),
 @Role nvarchar(128),@Active bit,@FacultyId uniqueidentifier,@Reason nvarchar(1000),@IntentHash char(64),
 @OperationId uniqueidentifier,@PreviewId uniqueidentifier
AS
BEGIN
 -- PAWS_EFFECTIVE_ACCESS_060: no Auth provisioning, password, group, DOE or assignment writes.
 SET NOCOUNT ON;SET XACT_ABORT ON;
 IF @@TRANCOUNT<>0 THROW 54007,'Access changes require their own transaction.',1;
 SET @Role=LOWER(LTRIM(RTRIM(@Role)));SET @Reason=LTRIM(RTRIM(@Reason));
 IF @ActorUid IS NULL OR LEN(@ActorUid)=0 OR @TargetUid IS NULL OR LEN(@TargetUid)=0 OR @Role IS NULL OR @Role NOT IN(N'adfa_general',N'adfa_regular',N'faculty',N'hicc',N'visc',N'adc',N'lab') OR @Active IS NULL OR @OperationId IS NULL OR @PreviewId IS NULL OR @Reason IS NULL OR LEN(@Reason)=0 OR @IntentHash IS NULL OR LEN(@IntentHash)<>64 OR @IntentHash COLLATE Latin1_General_100_BIN2 LIKE '%[^a-fA-F0-9]%' OR LEN(@ExpectedVersion)<>16 OR LEN(@ActorVersion)<>16 OR TRY_CONVERT(binary(8),@ExpectedVersion,2) IS NULL OR TRY_CONVERT(binary(8),@ActorVersion,2) IS NULL THROW 54007,'Invalid access change.',1;
 BEGIN TRY
  BEGIN TRANSACTION;
  DECLARE @Lock int;
  EXEC @Lock=sys.sp_getapplock @Resource=N'paws-account-access-060',@LockMode=N'Exclusive',@LockOwner=N'Transaction',@LockTimeout=5000;
  IF @Lock<0 THROW 54003,'Another access change is running. Refresh before retrying.',1;
  DECLARE @ActorRole nvarchar(128),@ActorActive bit,@ActorPassword bit,@CurrentActorVersion binary(8),@ActorName nvarchar(260);
  SELECT @ActorRole=LOWER(LTRIM(RTRIM(BaseRole))),@ActorActive=Active,@ActorPassword=MustChangePassword,@CurrentActorVersion=AccessVersion,@ActorName=DisplayName FROM paws.UserProfile WITH(UPDLOCK,HOLDLOCK) WHERE FirebaseUid=@ActorUid;
  IF @ActorRole IS NULL OR @ActorRole NOT IN(N'owner',N'adfa_general') OR @ActorActive<>1 OR @ActorPassword<>0 THROW 54001,'Active Owner authority required.',1;
  DECLARE @Existing nvarchar(max),@ExistingActor nvarchar(128),@ExistingTarget nvarchar(128),@ExistingPreview uniqueidentifier,@ExistingIntent char(64);
  SELECT @Existing=ReceiptJson,@ExistingActor=ActorUid,@ExistingTarget=TargetUid,@ExistingPreview=PreviewId,@ExistingIntent=IntentHash FROM paws.AccountAccessChange WITH(UPDLOCK,HOLDLOCK) WHERE OperationId=@OperationId;
  IF @Existing IS NOT NULL
  BEGIN
   IF @ExistingActor<>@ActorUid OR @ExistingTarget<>@TargetUid OR @ExistingPreview<>@PreviewId OR @ExistingIntent<>@IntentHash THROW 54008,'Operation identifier has a different intent.',1;
   COMMIT;SELECT @Existing AS receiptJson;RETURN;
  END;
  IF @CurrentActorVersion<>CONVERT(binary(8),@ActorVersion,2) THROW 54001,'Owner access changed after preview.',1;
  DECLARE @OldRole nvarchar(128),@OldActive bit,@OldFaculty uniqueidentifier,@TargetVersion binary(8),@TargetPassword bit,@TargetName nvarchar(260);
  SELECT @OldRole=LOWER(LTRIM(RTRIM(BaseRole))),@OldActive=Active,@OldFaculty=FacultyId,@TargetVersion=AccessVersion,@TargetPassword=MustChangePassword,@TargetName=DisplayName FROM paws.UserProfile WITH(UPDLOCK,HOLDLOCK) WHERE FirebaseUid=@TargetUid;
  IF @TargetVersion IS NULL THROW 54002,'Target account not found.',1;
  IF @TargetVersion<>CONVERT(binary(8),@ExpectedVersion,2) THROW 54003,'Target access changed after preview.',1;
  IF @OldRole=N'developer' THROW 54005,'Developer account is protected.',1;
  SET @OldRole=CASE @OldRole WHEN N'owner' THEN N'adfa_general' WHEN N'administrator' THEN N'adfa_regular' WHEN N'admin' THEN N'adfa_regular' ELSE @OldRole END;
  IF @OldRole NOT IN(N'adfa_general',N'adfa_regular',N'faculty',N'hicc',N'visc',N'adc',N'lab') THROW 54007,'Legacy role requires explicit review.',1;
  IF @ActorUid=@TargetUid AND (@Role<>N'adfa_general' OR @Active=0) THROW 54009,'Owner cannot disable or demote self.',1;
  IF @Role IN(N'faculty',N'hicc',N'visc') AND @FacultyId IS NULL THROW 54006,'Faculty-facing access requires a canonical faculty link.',1;
  IF @FacultyId IS NOT NULL AND NOT EXISTS(SELECT 1 FROM paws.Faculty WITH(UPDLOCK,HOLDLOCK) WHERE FacultyId=@FacultyId AND (@Active=0 OR Active=1)) THROW 54006,'Canonical faculty link is unavailable.',1;
  IF @OldRole=@Role AND @OldActive=@Active AND (@OldFaculty=@FacultyId OR (@OldFaculty IS NULL AND @FacultyId IS NULL)) THROW 54010,'Access is already current.',1;
  IF @OldRole=N'adfa_general' AND @OldActive=1 AND @TargetPassword=0 AND (@Role<>N'adfa_general' OR @Active=0)
  BEGIN
   DECLARE @ReadyOwners int;
   SELECT @ReadyOwners=COUNT(*) FROM paws.UserProfile WITH(UPDLOCK,HOLDLOCK) WHERE LOWER(LTRIM(RTRIM(BaseRole))) IN(N'owner',N'adfa_general') AND Active=1 AND MustChangePassword=0;
   IF @ReadyOwners<=1 THROW 54004,'At least one ready Owner must remain.',1;
  END;
  DECLARE @Before nvarchar(max)=(SELECT @OldRole AS role,@OldActive AS active,@OldFaculty AS facultyId FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES),@After nvarchar(max)=(SELECT @Role AS role,@Active AS active,@FacultyId AS facultyId FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES),@Now datetime2(7)=SYSUTCDATETIME();
  UPDATE paws.UserProfile SET BaseRole=@Role,Active=@Active,FacultyId=@FacultyId,UpdatedAtUtc=@Now WHERE FirebaseUid=@TargetUid;
  DECLARE @Profile nvarchar(max)=(SELECT FirebaseUid AS firebaseUid,Email AS email,DisplayName AS displayName,BaseRole AS baseRole,FacultyId AS facultyId,Active AS active,MustChangePassword AS mustChangePassword,LOWER(CONVERT(varchar(16),CONVERT(binary(8),AccessVersion),2)) AS version FROM paws.UserProfile WHERE FirebaseUid=@TargetUid FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES);
  DECLARE @Receipt nvarchar(max)=(SELECT @OperationId AS operationId,@PreviewId AS previewId,@ActorUid AS actorUid,@ActorName AS actorName,@TargetUid AS targetUid,@TargetName AS targetName,@Reason AS reason,@IntentHash AS intentHash,JSON_QUERY(@Before) AS before,JSON_QUERY(@After) AS after,JSON_QUERY(@Profile) AS profile,CONVERT(varchar(33),@Now,126)+N'Z' AS createdAtUtc FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES);
  INSERT paws.AccountAccessChange(OperationId,PreviewId,ActorUid,TargetUid,IntentHash,Reason,ReceiptJson,CreatedAtUtc) VALUES(@OperationId,@PreviewId,@ActorUid,@TargetUid,@IntentHash,@Reason,@Receipt,@Now);
  INSERT paws.AuditEvent(AuditEventId,EventType,EntityType,EntityId,ActorFirebaseUid,ActorName,OccurredAtUtc,BeforeJson,AfterJson,MetadataJson,RequestId) VALUES(NEWID(),N'account_access_change',N'user_profile',@TargetUid,@ActorUid,@ActorName,@Now,@Before,@After,(SELECT @Reason AS reason,@PreviewId AS previewId FOR JSON PATH,WITHOUT_ARRAY_WRAPPER),@OperationId);
  COMMIT;
  SELECT @Receipt AS receiptJson;
 END TRY
 BEGIN CATCH
  IF XACT_STATE()<>0 ROLLBACK;
  THROW;
 END CATCH;
END;
GO
IF DATABASE_PRINCIPAL_ID(N'paws_runtime_account_access') IS NULL CREATE ROLE paws_runtime_account_access AUTHORIZATION dbo;
GRANT EXECUTE ON OBJECT::paws_api.SetAccountAccess TO paws_runtime_account_access;
GRANT SELECT ON OBJECT::paws.AccountAccessChange TO paws_runtime_account_access;
-- No principal is bound and no existing role, grant, password or profile is changed.
COMMIT;
