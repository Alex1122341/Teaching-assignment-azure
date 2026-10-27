SET NOCOUNT ON;
IF DB_NAME()<>N'VetMed-Ops' OR OBJECT_ID(N'dbo.PawsDisposableLeadership061',N'U') IS NULL OR OBJECT_ID(N'dbo.Leadership062RaceBarrier',N'U') IS NULL
 THROW 54260,'Disposable leadership race marker required.',1;
DECLARE @ActorVersion varchar(16)=(SELECT LOWER(CONVERT(varchar(16),CONVERT(binary(8),AccessVersion),2)) FROM paws.UserProfile WHERE FirebaseUid=N'leadership062owner'),
 @TargetVersion varchar(16)=(SELECT LOWER(CONVERT(varchar(16),CONVERT(binary(8),AccessVersion),2)) FROM paws.UserProfile WHERE FirebaseUid=N'leadership062target'),
 @Epoch varchar(16)=(SELECT authorityVersion FROM paws_api.TeachingAuthorityState()),@Source uniqueidentifier,@Course uniqueidentifier,@Changes nvarchar(max),@Operation uniqueidentifier=NEWID(),@Preview uniqueidentifier=NEWID(),@Hash char(64)=REPLICATE('E',64);
SELECT @Source=r.RoleAssignmentId,@Course=r.CourseId FROM paws.RoleAssignment r JOIN paws.UserProfile u ON u.FacultyId=r.FacultyId WHERE u.FirebaseUid=N'leadership062target' AND r.AcademicYear=N'2026-27' AND r.RoleType=N'Course Coordinator';
IF @Source IS NULL OR @Course IS NULL THROW 54260,'Synthetic race source unavailable.',1;
SET @Changes=(SELECT N'grant' action,N'leadership062hicc' responsibilityId,N'hicc' kind,
 LOWER(CONVERT(varchar(64),HASHBYTES('SHA2_256',CONCAT(N'leadership062|',@Epoch,N'|leadership062hicc')),2)) definitionVersion,
 CONVERT(varchar(36),@Source) sourceRoleAssignmentId,
 (SELECT LOWER(CONVERT(varchar(16),CONVERT(binary(8),AuthorityVersion),2)) FROM paws.RoleAssignment WHERE RoleAssignmentId=@Source) sourceVersion,
 CAST(NULL AS varchar(16)) sourceScheduleVersion,LOWER(paws_api.TeachingAppointmentAccessSourceStamp(@Source)) sourceSignature,
 N'Synthetic canonical course' recordedScope,N'2026-05-01' startDate,N'2027-05-01' endExclusive,
 CAST(1 AS bit) usesApprovedDefaultDates,N'exclusive' assignmentMode,
 JSON_QUERY((SELECT CONVERT(varchar(36),@Course) courseId,N'062SYNTHETIC' courseCode FOR JSON PATH)) courses,JSON_QUERY(N'[]') groups FOR JSON PATH,INCLUDE_NULL_VALUES);
-- Both contenders capture the same authority snapshot before either can commit.
INSERT dbo.Leadership062RaceBarrier(RaceId) VALUES({RACER});
DECLARE @Tries int=0;
WHILE (SELECT COUNT(*) FROM dbo.Leadership062RaceBarrier)<2 AND @Tries<100 BEGIN WAITFOR DELAY '00:00:00.100';SET @Tries+=1;END;
IF (SELECT COUNT(*) FROM dbo.Leadership062RaceBarrier)<>2 THROW 54260,'Synthetic race barrier timed out.',1;
EXEC paws_api.SetTeachingLeadershipAccess N'leadership062owner',@ActorVersion,N'leadership062target',@TargetVersion,N'2026-27',@Epoch,@Changes,N'Synthetic concurrent exact-scope grant',@Hash,@Operation,@Preview;
