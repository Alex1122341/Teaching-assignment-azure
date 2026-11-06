:ON ERROR EXIT
SET NOCOUNT ON;
SET XACT_ABORT ON;
DECLARE @Actor nvarchar(128)=N'synthetic-069-'+CONVERT(nvarchar(36),NEWID()),
 @Email nvarchar(256)=CONVERT(nvarchar(36),NEWID())+N'@example.invalid',
 @Faculty uniqueidentifier,@Policy uniqueidentifier=NEWID(),@Year nvarchar(16)=N'2097-98',
 @Blank nvarchar(max)=N'{"scholarly_activity":null,"ppvm_cost_share":null,"clinical_unsorted":null,"clinical_teaching":null,"clinical_activity_ppvm":null,"research":null,"service":null,"contract_admin":null,"service_admin":null,"other":null,"onboarding":null}',
 @Allocations nvarchar(max);
SET @Allocations=JSON_MODIFY(JSON_MODIFY(@Blank,'$.service_admin',10),'$.onboarding',10);
BEGIN TRANSACTION;
INSERT paws.UserProfile(FirebaseUid,Email,DisplayName,BaseRole,Active,MustChangePassword)
 VALUES(@Actor,@Email,N'[069] Synthetic Administrator',N'owner',1,0);
EXEC paws_api.CreateFaculty @ActorFirebaseUid=@Actor,@DisplayName=N'[069] Synthetic Faculty',@Email=@Email,@Fte=1;
SELECT @Faculty=FacultyId FROM paws.Faculty WHERE Email=@Email;
INSERT paws.DoePolicyVersion(PolicyVersionId,AcademicYear,VersionLabel,SourceReference,Active,Status,Revision)
 VALUES(@Policy,@Year,N'Synthetic contract 069',N'Synthetic',1,N'active',1);
EXEC paws_api.SetFacultyTeachingDoeInputs @Faculty,@Year,@Actor,
 N'{"contractTeachingDoe":null,"contractClinicalTeachingDoe":null,"potentialGradTeachingDoe":null}',
 N'{"contractTeachingDoe":80,"contractClinicalTeachingDoe":15,"potentialGradTeachingDoe":20}';
EXEC paws_api.SetFacultyContractAllocations @Faculty,@Year,@Actor,@Blank,@Allocations;
IF (SELECT SUM(AllocationDoe) FROM paws.DoeFacultyAllocation WHERE FacultyId=@Faculty AND AcademicYear=@Year AND Active=1)<>20
 OR NOT EXISTS(SELECT 1 FROM paws.DoeFacultyTarget WHERE FacultyId=@Faculty AND AcademicYear=@Year AND ContractTeachingDoe=80)
 THROW 56980,'The 100 percent allocation did not round-trip.',1;
DECLARE @Reallocated nvarchar(max)=JSON_MODIFY(JSON_MODIFY(@Allocations,'$.service_admin',15),'$.onboarding',5);
EXEC paws_api.SetFacultyContractAllocations @Faculty,@Year,@Actor,@Allocations,@Reallocated;
IF (SELECT AllocationDoe FROM paws.DoeFacultyAllocation WHERE FacultyId=@Faculty AND CategoryCode=N'service_admin' AND Active=1)<>15
 OR NOT EXISTS(SELECT 1 FROM paws.DoeFacultyAllocation WHERE FacultyId=@Faculty AND CategoryCode=N'service_admin' AND Active=0 AND AllocationDoe=10)
 THROW 56981,'Changed allocation did not preserve the former source row.',1;
IF NOT EXISTS(SELECT 1 FROM paws.AuditEvent WHERE ActorFirebaseUid=@Actor AND JSON_VALUE(AfterJson,'$.contractAllocations.onboarding')='5')
 THROW 56982,'Allocation changes were not audited.',1;
UPDATE paws.Faculty SET Fte=.9 WHERE FacultyId=@Faculty;
BEGIN TRY
 EXEC paws_api.CheckFacultyContractDoeCap @Faculty,@Year;
 THROW 56983,'An FTE-only edit allowed excess contract DOE.',1;
END TRY
BEGIN CATCH
 IF ERROR_NUMBER()<>56901 THROW;
END CATCH;
ROLLBACK TRANSACTION;
IF EXISTS(SELECT 1 FROM paws.Faculty WHERE FacultyId=@Faculty)
 THROW 56984,'Synthetic contract changes survived rollback.',1;
PRINT 'FACULTY_CONTRACT_069_ACCEPTANCE_OK';
