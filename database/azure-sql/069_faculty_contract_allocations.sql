/* Faculty contract allocations are saved with the profile in one transaction. */
:ON ERROR EXIT
SET NOCOUNT ON;
SET XACT_ABORT ON;
IF DB_NAME()<>N'VetMed-Ops' OR OBJECT_ID(N'paws_api.SetFacultyTeachingDoeInputs',N'P') IS NULL
 OR OBJECT_ID(N'paws.AfcSpecialLeave',N'U') IS NULL
 THROW 56900,'Apply Faculty DOE and Special Leave prerequisites first.',1;
BEGIN TRANSACTION;
GO
CREATE OR ALTER PROCEDURE paws_api.CheckFacultyContractDoeCap
 @FacultyId uniqueidentifier,@AcademicYear nvarchar(16)
AS
BEGIN
 SET NOCOUNT ON;
 IF @@TRANCOUNT=0 THROW 56900,'Check the cap inside the Faculty save.',1;
 DECLARE @Fte decimal(6,4),@Teaching decimal(12,6),@Allocations decimal(19,6);
 SELECT @Fte=Fte FROM paws.Faculty WITH(UPDLOCK,HOLDLOCK) WHERE FacultyId=@FacultyId;
 SELECT @Teaching=ContractTeachingDoe FROM paws.DoeFacultyTarget WITH(UPDLOCK,HOLDLOCK)
  WHERE FacultyId=@FacultyId AND AcademicYear=@AcademicYear AND Active=1;
 SELECT @Allocations=SUM(AllocationDoe) FROM paws.DoeFacultyAllocation WITH(UPDLOCK,HOLDLOCK)
  WHERE FacultyId=@FacultyId AND AcademicYear=@AcademicYear AND Active=1;
 IF (@Teaching IS NOT NULL OR @Allocations IS NOT NULL)
  AND (@Fte IS NULL OR COALESCE(@Teaching,0)+COALESCE(@Allocations,0)>@Fte*100)
  THROW 56901,'Contract DOE exceeds recorded FTE.',1;
END;
GO
CREATE OR ALTER PROCEDURE paws_api.SetFacultyContractAllocations
 @FacultyId uniqueidentifier,@AcademicYear nvarchar(16),@ActorFirebaseUid nvarchar(128),
 @BeforeJson nvarchar(max),@ValuesJson nvarchar(max)
AS
BEGIN
 SET NOCOUNT ON;
 SET XACT_ABORT ON;
 IF @@TRANCOUNT=0 THROW 56900,'Use the atomic Faculty save.',1;
 DECLARE @ActorName nvarchar(260);
 SELECT @ActorName=DisplayName FROM paws.UserProfile WHERE FirebaseUid=@ActorFirebaseUid AND Active=1 AND MustChangePassword=0
  AND LOWER(LTRIM(RTRIM(BaseRole))) IN(N'developer',N'owner',N'administrator',N'adfa_general',N'adfa_regular',N'admin');
 IF @ActorName IS NULL THROW 56502,'Contract editing requires an authorized Faculty administrator.',1;
 IF @AcademicYear IS NULL OR @AcademicYear NOT LIKE N'[1-9][0-9][0-9][0-9]-[0-9][0-9]'
  OR TRY_CONVERT(int,RIGHT(@AcademicYear,2))<>(TRY_CONVERT(int,LEFT(@AcademicYear,4))+1)%100
  OR COALESCE(ISJSON(@BeforeJson),0)<>1 OR COALESCE(ISJSON(@ValuesJson),0)<>1
  THROW 56904,'Invalid contract allocation payload.',1;
 DECLARE @Codes table (Code nvarchar(64) COLLATE Latin1_General_100_BIN2 PRIMARY KEY);
 INSERT @Codes VALUES(N'scholarly_activity'),(N'ppvm_cost_share'),(N'clinical_unsorted'),(N'clinical_teaching'),
  (N'clinical_activity_ppvm'),(N'research'),(N'service'),(N'contract_admin'),(N'service_admin'),(N'other'),(N'onboarding');
 DECLARE @Input table(Snapshot tinyint,Code nvarchar(64) COLLATE Latin1_General_100_BIN2,Amount decimal(12,6) NULL,Valid bit);
 INSERT @Input
 SELECT p.Snapshot,j.[key],TRY_CONVERT(decimal(12,6),j.[value]),
  IIF(j.[type]=0 OR (j.[type]=2 AND TRY_CONVERT(decimal(12,6),j.[value]) BETWEEN 0 AND 100),1,0)
 FROM (VALUES(0,@BeforeJson),(1,@ValuesJson)) p(Snapshot,JsonText) CROSS APPLY OPENJSON(p.JsonText) j
 WHERE LEN(j.[key])<=64;
 IF (SELECT COUNT(*) FROM @Input WHERE Snapshot=0)<>11 OR (SELECT COUNT(*) FROM @Input WHERE Snapshot=1)<>11
  OR (SELECT COUNT(*) FROM OPENJSON(@BeforeJson))<>11 OR (SELECT COUNT(*) FROM OPENJSON(@ValuesJson))<>11
  OR EXISTS(SELECT 1 FROM @Input i LEFT JOIN @Codes c ON c.Code=i.Code WHERE i.Valid=0 OR c.Code IS NULL)
  OR EXISTS(SELECT 1 FROM @Input GROUP BY Snapshot,Code HAVING COUNT(*)<>1)
  THROW 56904,'Contract categories must be unique with valid percentages.',1;

 DECLARE @Fte decimal(6,4),@Teaching decimal(12,6),@Allocations decimal(19,6);
 IF NOT EXISTS(SELECT 1 FROM paws.Faculty WITH(UPDLOCK,HOLDLOCK) WHERE FacultyId=@FacultyId)
  THROW 52303,'Faculty was not found.',1;
 SELECT @Fte=Fte FROM paws.Faculty WHERE FacultyId=@FacultyId;
 SELECT @Teaching=ContractTeachingDoe FROM paws.DoeFacultyTarget WITH(UPDLOCK,HOLDLOCK)
  WHERE FacultyId=@FacultyId AND AcademicYear=@AcademicYear AND Active=1;
 SELECT @Allocations=SUM(Amount) FROM @Input WHERE Snapshot=1;
 IF (@Teaching IS NOT NULL OR @Allocations IS NOT NULL)
  AND (@Fte IS NULL OR COALESCE(@Teaching,0)+COALESCE(@Allocations,0)<>@Fte*100)
  THROW 56901,'Total contract DOE must equal FTE times 100.',1;
 DECLARE @Current table (Code nvarchar(64) COLLATE Latin1_General_100_BIN2 PRIMARY KEY, Amount decimal(12,6),PolicyVersionId uniqueidentifier);
 INSERT @Current SELECT CategoryCode,AllocationDoe,PolicyVersionId FROM paws.DoeFacultyAllocation WITH(UPDLOCK,HOLDLOCK)
  WHERE FacultyId=@FacultyId AND AcademicYear=@AcademicYear AND Active=1;
 IF EXISTS(SELECT Code,Amount FROM @Input WHERE Snapshot=0 AND Amount IS NOT NULL EXCEPT SELECT Code,Amount FROM @Current)
  OR EXISTS(SELECT Code,Amount FROM @Current EXCEPT SELECT Code,Amount FROM @Input WHERE Snapshot=0 AND Amount IS NOT NULL)
  THROW 56902,'Contract allocations changed since review.',1;
 IF NOT EXISTS(SELECT Code,Amount FROM @Input WHERE Snapshot=0 EXCEPT SELECT Code,Amount FROM @Input WHERE Snapshot=1) RETURN;

 DECLARE @Policy uniqueidentifier;
 SELECT @Policy=PolicyVersionId FROM paws.DoePolicyVersion WITH(HOLDLOCK)
  WHERE AcademicYear=@AcademicYear AND Status=N'active';
 IF @Policy IS NULL AND EXISTS(SELECT 1 FROM @Input i LEFT JOIN @Current c ON c.Code=i.Code
  WHERE i.Snapshot=1 AND i.Amount IS NOT NULL AND c.Code IS NULL)
  THROW 56903,'An active policy is required to add allocations.',1;
 UPDATE a SET Active=0,UpdatedAtUtc=SYSUTCDATETIME()
 FROM paws.DoeFacultyAllocation a JOIN @Input i ON i.Code=a.CategoryCode COLLATE Latin1_General_100_BIN2 AND i.Snapshot=1
 WHERE a.FacultyId=@FacultyId AND a.AcademicYear=@AcademicYear AND a.Active=1 AND (i.Amount IS NULL OR i.Amount<>a.AllocationDoe);
 INSERT paws.DoeFacultyAllocation(DoeFacultyAllocationId,FacultyId,AcademicYear,CategoryCode,AllocationDoe,SourceReference,PolicyVersionId)
 SELECT NEWID(),@FacultyId,@AcademicYear,i.Code,i.Amount,N'Faculty administration',COALESCE(c.PolicyVersionId,@Policy)
 FROM @Input i LEFT JOIN @Current c ON c.Code=i.Code
 WHERE i.Snapshot=1 AND i.Amount IS NOT NULL AND (c.Code IS NULL OR i.Amount<>c.Amount);
 INSERT paws.AuditEvent(AuditEventId,EventType,EntityType,EntityId,ActorFirebaseUid,ActorName,OccurredAtUtc,BeforeJson,AfterJson,MetadataJson)
 VALUES(NEWID(),N'FacultyUpdated',N'Faculty',CONVERT(nvarchar(36),@FacultyId),@ActorFirebaseUid,@ActorName,SYSUTCDATETIME(),
  (SELECT @AcademicYear AS academicYear, JSON_QUERY(@BeforeJson) AS contractAllocations FOR JSON PATH,WITHOUT_ARRAY_WRAPPER),
  (SELECT @AcademicYear AS academicYear, JSON_QUERY(@ValuesJson) AS contractAllocations FOR JSON PATH,WITHOUT_ARRAY_WRAPPER),
  N'{"source":"faculty-admin-contract-allocations"}');
END;
GO
GRANT EXECUTE ON OBJECT::paws_api.CheckFacultyContractDoeCap TO [paws_runtime_faculty_admin_write];
GRANT EXECUTE ON OBJECT::paws_api.SetFacultyContractAllocations TO [paws_runtime_faculty_admin_write];
COMMIT TRANSACTION;
