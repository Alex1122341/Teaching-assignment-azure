/* Roll back the API/Hosting release first. Capture the installed object's
   definition hash at acceptance and supply it through sqlcmd -v. */
:ON ERROR EXIT
SET NOCOUNT ON;
SET XACT_ABORT ON;
IF DB_NAME()<>N'VetMed-Ops' THROW 57200,'Faculty Availability rollback requires VetMed-Ops.',1;
DECLARE @ObjectId int=OBJECT_ID(N'paws_api.ListFacultyAvailabilityBulk',N'P');
DECLARE @Hash varchar(64)=N'$(PAWS_AVAILABILITY_BULK_SHA256)';
IF @ObjectId IS NULL OR LEN(@Hash)<>64 OR @Hash LIKE '%[^0-9A-Fa-f]%'
 OR OBJECT_DEFINITION(@ObjectId) IS NULL
 OR CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(@ObjectId)),2)<>UPPER(@Hash)
 OR (SELECT COUNT(*) FROM sys.database_permissions WHERE class=1 AND major_id=@ObjectId)<>1
 OR NOT EXISTS(SELECT 1 FROM sys.database_permissions WHERE class=1 AND major_id=@ObjectId
   AND minor_id=0 AND grantee_principal_id=DATABASE_PRINCIPAL_ID(N'paws_runtime_read') AND type='EX' AND state='G')
 THROW 57208,'Bulk Availability SQL definition or grants changed; inspect before rollback.',1;
BEGIN TRANSACTION;
DROP PROCEDURE paws_api.ListFacultyAvailabilityBulk;
COMMIT TRANSACTION;
