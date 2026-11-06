/* Transaction-scoped acceptance using a synthetic Faculty identity. */
:ON ERROR EXIT
SET NOCOUNT ON;
SET XACT_ABORT ON;
IF DB_NAME()<>N'VetMed-Ops' OR OBJECT_ID(N'paws_api.SetFacultyTeachingDoeInputs',N'P') IS NULL
 THROW 56780,'Migration 067 schema required.',1;
DECLARE @Actor nvarchar(128)=N'synthetic-doe-067-'+CONVERT(nvarchar(36),NEWID()),
 @Email nvarchar(256)=CONVERT(nvarchar(36),NEWID())+N'@example.invalid',
 @Faculty uniqueidentifier, @Year nvarchar(16)=N'2098-99',
 @Blank nvarchar(max)=N'{"contractTeachingDoe":null,"contractClinicalTeachingDoe":null,"potentialGradTeachingDoe":null}',
 @Initial nvarchar(max)=N'{"contractTeachingDoe":30,"contractClinicalTeachingDoe":null,"potentialGradTeachingDoe":0}',
 @Before nvarchar(max)=N'{"contractTeachingDoe":30,"contractClinicalTeachingDoe":12,"potentialGradTeachingDoe":0}',
 @After nvarchar(max)=N'{"contractTeachingDoe":35,"contractClinicalTeachingDoe":12,"potentialGradTeachingDoe":null}';
BEGIN TRANSACTION;
INSERT paws.UserProfile(FirebaseUid,Email,DisplayName,BaseRole,Active,MustChangePassword)
 VALUES(@Actor,@Email,N'[067] Synthetic Administrator',N'owner',1,0);
EXEC paws_api.CreateFaculty @ActorFirebaseUid=@Actor,@DisplayName=N'[067] Synthetic Faculty',@Email=@Email;
SELECT @Faculty=FacultyId FROM paws.Faculty WHERE Email=@Email;
EXEC paws_api.SetFacultyTeachingDoeInputs @Faculty,@Year,@Actor,@Blank,@Initial;
IF NOT EXISTS(SELECT 1 FROM paws.vFacultyDoeSummaryInputs WHERE FacultyId=@Faculty AND AcademicYear=@Year
 AND ContractClinicalTeachingDoe IS NULL AND PotentialGradTeachingDoe=0)
 THROW 56781,'A recorded zero did not round-trip.',1;
INSERT paws.DoeFacultySummarySource(FacultyId,AcademicYear,ContractClinicalTeachingDoe,PotentialGradTeachingDoe,SourceReference,SourceSha256,SourceRow)
 VALUES(@Faculty,@Year,12,4,N'[067] Synthetic MASTER',REPLICATE('a',64),1),(@Faculty,N'2099-00',14,7,N'[067] Other year',REPLICATE('b',64),2);
UPDATE paws.DoeFacultyTarget SET OverrideDoe=20,OverrideReason=N'Previously approved' WHERE FacultyId=@Faculty AND AcademicYear=@Year;
EXEC paws_api.SetFacultyTeachingDoeInputs @Faculty,@Year,@Actor,@Before,@After;
IF NOT EXISTS(SELECT 1 FROM paws.DoeFacultyTarget WHERE FacultyId=@Faculty AND AcademicYear=@Year AND Active=1
 AND ContractTeachingDoe=35 AND OverrideDoe=20 AND EffectiveTargetDoe=20)
 THROW 56782,'Changing contract teaching did not preserve the approved expected override.',1;
IF NOT EXISTS(SELECT 1 FROM paws.vFacultyDoeSummaryInputs WHERE FacultyId=@Faculty AND AcademicYear=@Year
 AND ContractClinicalTeachingDoe=12 AND PotentialGradTeachingDoe IS NULL)
 OR NOT EXISTS(SELECT 1 FROM paws.DoeFacultySummarySource WHERE FacultyId=@Faculty AND AcademicYear=@Year AND PotentialGradTeachingDoe=4)
 OR NOT EXISTS(SELECT 1 FROM paws.vFacultyDoeSummaryInputs WHERE FacultyId=@Faculty AND AcademicYear=N'2099-00' AND PotentialGradTeachingDoe=7)
 THROW 56783,'Clearing a value affected MASTER evidence or another academic year.',1;
IF NOT EXISTS(SELECT 1 FROM paws.AuditEvent WHERE EventType=N'FacultyUpdated' AND EntityId=CONVERT(nvarchar(36),@Faculty)
 AND ActorFirebaseUid=@Actor AND JSON_VALUE(AfterJson,'$.academicYear')=@Year
 AND JSON_VALUE(AfterJson,'$.contractTeachingDoe')='35' AND JSON_VALUE(BeforeJson,'$.contractTeachingDoe')='30')
 THROW 56784,'Missing year-scoped Faculty DOE audit event.',1;
BEGIN TRY
 EXEC paws_api.SetFacultyTeachingDoeInputs @Faculty,@Year,@Actor,@Before,@After;
 THROW 56785,'Stale DOE input was accepted.',1;
END TRY
BEGIN CATCH
 IF ERROR_NUMBER()<>56703 THROW;
END CATCH;
ROLLBACK TRANSACTION;
IF EXISTS(SELECT 1 FROM paws.Faculty WHERE FacultyId=@Faculty)
 OR EXISTS(SELECT 1 FROM paws.AuditEvent WHERE ActorFirebaseUid=@Actor)
 THROW 56786,'Synthetic Faculty or DOE history survived rollback.',1;
PRINT 'FACULTY_067_TEACHING_DOE_ACCEPTANCE_OK';
