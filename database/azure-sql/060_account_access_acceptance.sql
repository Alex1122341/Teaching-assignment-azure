:ON ERROR EXIT
SET NOCOUNT ON;
SET XACT_ABORT ON;
-- Executed only by the labeled disposable-container launcher; never on the school database.
IF DB_NAME()<>N'VetMed-Ops' OR OBJECT_ID(N'dbo.PawsDisposableAccess060',N'U') IS NULL THROW 54060,'Disposable access acceptance marker required.',1;
IF OBJECT_ID(N'paws_api.SetAccountAccess',N'P') IS NULL THROW 54060,'Access060 procedure is missing.',1;
DECLARE @Batch uniqueidentifier=NEWID(),@Faculty uniqueidentifier=NEWID();
INSERT staging.ImportBatch(ImportBatchId,StartedAtUtc,Status,SourceManifestSha256,ImporterVersion,ValidationSummaryJson) VALUES(@Batch,SYSUTCDATETIME(),N'synthetic',REPLICATE('A',64),N'access060',N'{}');
INSERT paws.Faculty(FacultyId,RecordType,DisplayName,Active,SourceImportBatchId) VALUES(@Faculty,N'faculty',N'Taylor Example',1,@Batch);
INSERT paws.UserProfile(FirebaseUid,Email,DisplayName,BaseRole,FacultyId,Active,MustChangePassword) VALUES
(N'access060-owner-a',N'owner-a@example.test',N'Owner A',N'owner',NULL,1,0),
(N'access060-owner-b',N'owner-b@example.test',N'Owner B',N'adfa_general',NULL,1,0),
(N'access060-admin',N'admin@example.test',N'Admin',N'adfa_regular',NULL,1,0),
(N'access060-developer',N'developer@example.test',N'Developer',N'developer',NULL,1,0),
(N'access060-target',N'target@example.test',N'Taylor Example',N'faculty',@Faculty,1,0);
DECLARE @ActorVersion varchar(16),@TargetVersion varchar(16),@Operation uniqueidentifier=NEWID(),@Preview uniqueidentifier=NEWID(),@Reply nvarchar(max),@Rejected bit=0,@Hash char(64)=REPLICATE('A',64);
SELECT @ActorVersion=CONVERT(varchar(16),CONVERT(binary(8),AccessVersion),2) FROM paws.UserProfile WHERE FirebaseUid=N'access060-owner-a';
SELECT @TargetVersion=CONVERT(varchar(16),CONVERT(binary(8),AccessVersion),2) FROM paws.UserProfile WHERE FirebaseUid=N'access060-target';
SELECT @ActorVersion AS syntheticActorVersion,@TargetVersion AS syntheticTargetVersion,LEN(@Hash) AS intentLength,
 IIF(@Hash COLLATE Latin1_General_100_BIN2 LIKE '%[^a-fA-F0-9]%',1,0) AS intentContainsNonHex,
 IIF(TRY_CONVERT(binary(8),@ActorVersion,2) IS NULL,1,0) AS invalidActorVersion,
 IIF(TRY_CONVERT(binary(8),@TargetVersion,2) IS NULL,1,0) AS invalidTargetVersion;
-- INSERT...EXEC adds an implicit surrounding transaction. Exercise the same
-- standalone EXEC used by the runtime, then independently verify its persisted receipt.
EXEC paws_api.SetAccountAccess N'access060-owner-a',@ActorVersion,N'access060-target',@TargetVersion,N'hicc',1,@Faculty,N'Approved role change',@Hash,@Operation,@Preview;
SELECT @Reply=ReceiptJson FROM paws.AccountAccessChange WHERE OperationId=@Operation;
IF JSON_VALUE(@Reply,'$.after.role')<>N'hicc' OR JSON_VALUE(@Reply,'$.reason')<>N'Approved role change' OR JSON_VALUE(@Reply,'$.before.role')<>N'faculty' THROW 54060,'Persisted receipt is inconsistent.',1;
IF NOT EXISTS(SELECT 1 FROM paws.UserProfile WHERE FirebaseUid=N'access060-target' AND BaseRole=N'hicc' AND CONVERT(varchar(16),CONVERT(binary(8),AccessVersion),2)<>@TargetVersion) THROW 54060,'Effective grant/version not persisted.',1;
IF (SELECT COUNT(*) FROM paws.AuditEvent WHERE RequestId=@Operation AND EventType=N'account_access_change')<>1 OR (SELECT COUNT(*) FROM paws.AccountAccessChange WHERE OperationId=@Operation)<>1 THROW 54060,'Atomic audit/operation not persisted.',1;
EXEC paws_api.SetAccountAccess N'access060-owner-a',@ActorVersion,N'access060-target',@TargetVersion,N'hicc',1,@Faculty,N'Approved role change',@Hash,@Operation,@Preview;
IF (SELECT COUNT(*) FROM paws.AuditEvent WHERE RequestId=@Operation)<>1 THROW 54060,'Idempotent retry duplicated audit.',1;
SET @Hash=REPLICATE('B',64);
BEGIN TRY
 EXEC paws_api.SetAccountAccess N'access060-owner-a',@ActorVersion,N'access060-target',@TargetVersion,N'hicc',1,@Faculty,N'Different reason',@Hash,@Operation,@Preview;
END TRY BEGIN CATCH IF ERROR_NUMBER()=54008 SET @Rejected=1;ELSE THROW;END CATCH;
IF @Rejected=0 THROW 54060,'Conflicting retry was accepted.',1;
PRINT 'ACCOUNT_ACCESS_060_PERSISTED_IDEMPOTENT_AUDIT';

SET @Rejected=0;SET @Operation=NEWID();
BEGIN TRY
 EXEC paws_api.SetAccountAccess N'access060-owner-a',@ActorVersion,N'access060-target',@TargetVersion,N'faculty',1,@Faculty,N'Stale preview',@Hash,@Operation,@Preview;
END TRY BEGIN CATCH IF ERROR_NUMBER()=54003 SET @Rejected=1;ELSE THROW;END CATCH;
IF @Rejected=0 THROW 54060,'Stale access was accepted.',1;
-- A -> B -> A values never restore an old rowversion.
UPDATE paws.UserProfile SET BaseRole=N'faculty' WHERE FirebaseUid=N'access060-target';
SET @Rejected=0;
BEGIN TRY
 EXEC paws_api.SetAccountAccess N'access060-owner-a',@ActorVersion,N'access060-target',@TargetVersion,N'hicc',1,@Faculty,N'ABA preview',@Hash,@Operation,@Preview;
END TRY BEGIN CATCH IF ERROR_NUMBER()=54003 SET @Rejected=1;ELSE THROW;END CATCH;
IF @Rejected=0 THROW 54060,'ABA access was accepted.',1;
PRINT 'ACCOUNT_ACCESS_060_STALE_ABA_DENIED';

SELECT @TargetVersion=CONVERT(varchar(16),CONVERT(binary(8),AccessVersion),2) FROM paws.UserProfile WHERE FirebaseUid=N'access060-target';
DECLARE @AdminVersion varchar(16)=(SELECT CONVERT(varchar(16),CONVERT(binary(8),AccessVersion),2) FROM paws.UserProfile WHERE FirebaseUid=N'access060-admin');
SET @Rejected=0;
BEGIN TRY
 EXEC paws_api.SetAccountAccess N'access060-admin',@AdminVersion,N'access060-target',@TargetVersion,N'hicc',1,@Faculty,N'Forbidden admin',@Hash,@Operation,@Preview;
END TRY BEGIN CATCH IF ERROR_NUMBER()=54001 SET @Rejected=1;ELSE THROW;END CATCH;
IF @Rejected=0 THROW 54060,'Administrator changed account access.',1;
DECLARE @DeveloperVersion varchar(16)=(SELECT CONVERT(varchar(16),CONVERT(binary(8),AccessVersion),2) FROM paws.UserProfile WHERE FirebaseUid=N'access060-developer');
SET @Rejected=0;
BEGIN TRY
 EXEC paws_api.SetAccountAccess N'access060-owner-a',@ActorVersion,N'access060-developer',@DeveloperVersion,N'faculty',1,@Faculty,N'Forbidden Developer edit',@Hash,@Operation,@Preview;
END TRY BEGIN CATCH IF ERROR_NUMBER()=54005 SET @Rejected=1;ELSE THROW;END CATCH;
IF @Rejected=0 THROW 54060,'Owner edited protected Developer.',1;
SET @Rejected=0;
BEGIN TRY
 EXEC paws_api.SetAccountAccess N'access060-owner-a',@ActorVersion,N'access060-owner-a',@ActorVersion,N'adfa_general',0,NULL,N'Self disable',@Hash,@Operation,@Preview;
END TRY BEGIN CATCH IF ERROR_NUMBER()=54009 SET @Rejected=1;ELSE THROW;END CATCH;
IF @Rejected=0 THROW 54060,'Owner disabled self.',1;
PRINT 'ACCOUNT_ACCESS_060_OWNER_PROTECTION';

-- Force a later audit failure: profile and operation must both roll back.
EXEC(N'CREATE TRIGGER paws.Access060RejectAudit ON paws.AuditEvent AFTER INSERT AS BEGIN IF EXISTS(SELECT 1 FROM inserted WHERE EventType=N''account_access_change'') THROW 54061,''Synthetic audit failure'',1; END;');
SET @Rejected=0;SET @Operation=NEWID();
BEGIN TRY
 EXEC paws_api.SetAccountAccess N'access060-owner-a',@ActorVersion,N'access060-target',@TargetVersion,N'hicc',1,@Faculty,N'Atomic rollback',@Hash,@Operation,@Preview;
END TRY BEGIN CATCH IF ERROR_NUMBER()=54061 SET @Rejected=1;ELSE THROW;END CATCH;
DROP TRIGGER paws.Access060RejectAudit;
IF @Rejected=0 OR EXISTS(SELECT 1 FROM paws.AccountAccessChange WHERE OperationId=@Operation) OR EXISTS(SELECT 1 FROM paws.UserProfile WHERE FirebaseUid=N'access060-target' AND BaseRole<>N'faculty') THROW 54060,'Audit failure left partial access change.',1;
PRINT 'ACCOUNT_ACCESS_060_ATOMIC_ROLLBACK';
