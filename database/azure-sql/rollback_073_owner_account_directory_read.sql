/* Roll back the API release first. Use the installed definition SHA256
   recorded during acceptance, passed via sqlcmd -v. No data rollback. */
:ON ERROR EXIT
SET NOCOUNT ON;
SET XACT_ABORT ON;
IF DB_NAME()<>N'VetMed-Ops' THROW 57300,'Owner directory rollback requires VetMed-Ops.',1;
DECLARE @ObjectId int=OBJECT_ID(N'paws_api.ListOwnerAccountDirectory',N'P');
DECLARE @Hash varchar(64)=N'$(PAWS_OWNER_DIRECTORY_SHA256)';
IF @ObjectId IS NULL OR LEN(@Hash)<>64 OR @Hash LIKE '%[^0-9A-Fa-f]%'
 OR OBJECT_DEFINITION(@ObjectId) IS NULL
 OR CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(@ObjectId)),2)<>UPPER(@Hash)
 OR (SELECT COUNT(*) FROM sys.database_permissions WHERE class=1 AND major_id=@ObjectId)<>1
 OR NOT EXISTS(SELECT 1 FROM sys.database_permissions WHERE class=1 AND major_id=@ObjectId
   AND minor_id=0 AND grantee_principal_id=DATABASE_PRINCIPAL_ID(N'paws_runtime_account_access') AND type='EX' AND state='G')
 THROW 57308,'Owner directory definition or grants changed; inspect before rollback.',1;
BEGIN TRANSACTION;
REVOKE EXECUTE ON OBJECT::paws_api.ListOwnerAccountDirectory FROM paws_runtime_account_access;
DROP PROCEDURE paws_api.ListOwnerAccountDirectory;
COMMIT TRANSACTION;
