/* Synthetic disposable SQL only. Stage through the retained MASTER commands. */
:ON ERROR EXIT
SET NOCOUNT ON;SET XACT_ABORT ON;
IF DB_NAME()<>N'VetMed-Ops' OR OBJECT_ID(N'dbo.PawsDisposableLeadership061',N'U') IS NULL THROW 54360,'Disposable leadership marker required.',1;
DECLARE @Faculty uniqueidentifier=(SELECT FacultyId FROM paws.Faculty WHERE DisplayName=N'Synthetic snapshot compatibility');
IF @Faculty IS NULL THROW 54360,'Synthetic MASTER faculty unavailable.',1;
INSERT paws.UserProfile(FirebaseUid,Email,DisplayName,BaseRole,FacultyId,Active,MustChangePassword) VALUES
 (N'leadership-master-owner',N'leadership-master-owner@example.test',N'Synthetic MASTER owner',N'owner',NULL,1,0),
 (N'leadership-master-faculty',N'leadership-master-faculty@example.test',N'Synthetic MASTER faculty',N'faculty',@Faculty,1,0);
CREATE TABLE dbo.LeadershipMasterCompatibility(ReceiptId uniqueidentifier NOT NULL,RoleId uniqueidentifier NOT NULL);
GO
CREATE PROCEDURE dbo.StageLeadershipMasterCompatibility @Scope nvarchar(1000)
AS
BEGIN
 SET NOCOUNT ON;
 DECLARE @Faculty uniqueidentifier=(SELECT FacultyId FROM paws.UserProfile WHERE FirebaseUid=N'leadership-master-faculty');
 DECLARE @Row nvarchar(max)=(SELECT @Faculty facultyId,N'Synthetic snapshot compatibility' sourceName,N'VISC' roleType,@Scope scope,
  JSON_QUERY(N'[{"startDate":"2026-05-01","endDate":"2027-04-30"}]') periods,
  JSON_QUERY((SELECT REPLICATE('A',64) sha256,N'VISCs' sheet,2 row,N'A' [column] FOR JSON PATH,WITHOUT_ARRAY_WRAPPER)) sourceRef FOR JSON PATH,WITHOUT_ARRAY_WRAPPER);
 -- Missing DOE stays missing; this test never invents an allocation or engine result.
 DECLARE @Source nvarchar(max)=(SELECT 1 schemaVersion,N'2026-27' academicYear,REPLICATE('A',64) sourceSha256,REPLICATE('B',64) manifestSha256,
  JSON_QUERY(N'['+@Row+N']') appointments,JSON_QUERY(N'[]') rotations,JSON_QUERY(N'[]') cccAllocations,JSON_QUERY(N'[]') roleDefinitions,
  JSON_QUERY(N'[]') trainees,JSON_QUERY(N'[]') cccSlots,JSON_QUERY(N'[]') issues FOR JSON PATH,WITHOUT_ARRAY_WRAPPER);
 DECLARE @Guard nvarchar(max)=(SELECT 1 schemaVersion,REPLICATE('B',64) sourceManifestSha256,REPLICATE('C',64) doeGuardHash,
  CONVERT(varchar(64),HASHBYTES('SHA2_256',paws_api.MasterRefreshSnapshot('2026-27')),2) contextHash,JSON_QUERY(N'[]') rows FOR JSON PATH,WITHOUT_ARRAY_WRAPPER);
 DECLARE @Result TABLE(responseJson nvarchar(max));
 INSERT @Result EXEC paws_api.PreviewMasterRefresh N'appointments',N'2026-27',@Source,N'leadership-master-owner',@Guard;
 DECLARE @Preview nvarchar(max)=(SELECT responseJson FROM @Result),@Batch uniqueidentifier,@Version varchar(16),@Key uniqueidentifier=NEWID();
 IF (SELECT COUNT(*) FROM OPENJSON(@Preview,'$.operations'))<>1 THROW 54360,'Synthetic MASTER row did not stage.',1;
 SELECT @Batch=TRY_CONVERT(uniqueidentifier,JSON_VALUE(@Preview,'$.batchId')),@Version=JSON_VALUE(@Preview,'$.expectedVersion');
 DELETE @Result;
 DECLARE @Manifest varchar(64)=REPLICATE('B',64),@SourceHash varchar(64)=REPLICATE('A',64);
 INSERT @Result EXEC paws_api.CommitMasterRefresh N'appointments',@Batch,@Version,@Manifest,@SourceHash,@Key,N'leadership-master-owner',1;
 DELETE dbo.LeadershipMasterCompatibility;
 INSERT dbo.LeadershipMasterCompatibility SELECT TRY_CONVERT(uniqueidentifier,JSON_VALUE(responseJson,'$.receiptId')),TRY_CONVERT(uniqueidentifier,JSON_VALUE(@Preview,'$.operations[0].roleId')) FROM @Result;
 IF NOT EXISTS(SELECT 1 FROM paws.MasterRefreshReceipt r JOIN dbo.LeadershipMasterCompatibility t ON t.ReceiptId=r.ReceiptId WHERE r.Status=N'committed' AND r.AppliedCount=1) THROW 54360,'Synthetic MASTER receipt unavailable.',1;
END;
GO
EXEC dbo.StageLeadershipMasterCompatibility N'Synthetic pre061 retained receipt';
