-- Synthetic Teaching Assignment authority (run after all migrations).
-- HICC responsibility for VTMD 200 held by the syn-hicc user's Faculty record; VISC group leader is syn-visc.
SET NOCOUNT ON;
DECLARE @Hicc uniqueidentifier=(SELECT FacultyId FROM paws.UserProfile WHERE FirebaseUid=N'syn-hicc');
DECLARE @Visc uniqueidentifier=(SELECT FacultyId FROM paws.UserProfile WHERE FirebaseUid=N'syn-visc');
DECLARE @Course uniqueidentifier=(SELECT CourseId FROM paws.Course WHERE CourseCode=N'VTMD 200');
DECLARE @Course2 uniqueidentifier=(SELECT CourseId FROM paws.Course WHERE CourseCode=N'VTMD 202');
DECLARE @Pkg uniqueidentifier='7A000000-0000-4000-8000-000000000200', @Pkg2 uniqueidentifier='7A000000-0000-4000-8000-000000000202';
INSERT paws.TeachingResponsibility(ResponsibilityId,Kind,Label,Active) VALUES
 (N'hiccvtmd200',N'hicc',N'VTMD 200 HICC',1),(N'hiccvtmd202',N'hicc',N'VTMD 202 HICC',1),(N'viscyear1',N'visc',N'Year 1 VISC',1);
INSERT paws.TeachingResponsibilityAssignee(ResponsibilityAssigneeId,ResponsibilityId,AcademicYear,FacultyId,ActiveDate,ExpirationDate) VALUES
 (NEWID(),N'hiccvtmd200',N'2026-27',@Hicc,'2026-05-01','2027-04-30'),
 (NEWID(),N'hiccvtmd202',N'2026-27',@Hicc,'2026-05-01','2027-04-30'),
 (NEWID(),N'viscyear1',N'2026-27',@Visc,'2026-05-01','2027-04-30');
INSERT paws.TeachingResponsibilityScope(ResponsibilityScopeId,HiccResponsibilityId,CourseId) VALUES (NEWID(),N'hiccvtmd200',@Course),(NEWID(),N'hiccvtmd202',@Course2);
INSERT paws.TeachingAssignmentGroup(GroupId,Name,LeaderViscResponsibilityId,Active) VALUES (N'year1',N'Year 1',N'viscyear1',1);
INSERT paws.TeachingAssignmentGroupHicc(GroupId,HiccResponsibilityId) VALUES (N'year1',N'hiccvtmd200'),(N'year1',N'hiccvtmd202');
INSERT paws.TeachingAssignmentPackage(TeachingAssignmentPackageId,PackageIdentity,AcademicYear,GroupId,HiccResponsibilityId,Status,WorkingRevision) VALUES
 (@Pkg,N'ta-package-v1__2026-27__year1__hiccvtmd200',N'2026-27',N'year1',N'hiccvtmd200',N'draft',0),
 (@Pkg2,N'ta-package-v1__2026-27__year1__hiccvtmd202',N'2026-27',N'year1',N'hiccvtmd202',N'draft',0);
INSERT paws.TeachingSessionOwnership(SessionOwnershipId,SessionId,AcademicYear,TeachingAssignmentGroupId,ResponsibleHiccResponsibilityId,TeachingAssignmentPackageId)
 SELECT NEWID(),s.SessionId,N'2026-27',N'year1',CASE s.CourseCode WHEN N'VTMD 200' THEN N'hiccvtmd200' ELSE N'hiccvtmd202' END,CASE s.CourseCode WHEN N'VTMD 200' THEN @Pkg ELSE @Pkg2 END
 FROM paws.Session s WHERE s.CourseCode IN (N'VTMD 200',N'VTMD 202') AND s.AcademicYear=N'2026-27';
-- NOTE: the IDs above avoid '-' and '_' because CK_TeachingResponsibility_Id rejects them on SQL Server 2019 (see report).
-- Swap-workflow fixture: normalise VTMD 200 assignments to the 'resolved' vocabulary the swap procedures require,
-- and give syn-faculty-a two future single-instructor VTMD 200 lectures.
DECLARE @A uniqueidentifier=(SELECT FacultyId FROM paws.UserProfile WHERE FirebaseUid=N'syn-faculty-a');
UPDATE sa SET FacultyResolutionStatus=N'resolved' FROM paws.SessionAssignment sa JOIN paws.Session s ON s.SessionId=sa.SessionId WHERE s.CourseCode=N'VTMD 200' AND sa.FacultyId IS NOT NULL;
;WITH pick AS (SELECT TOP (2) s.SessionId FROM paws.Session s WHERE s.CourseCode=N'VTMD 200' AND s.SessionType=N'LEC' AND s.SessionDate>'2026-11-15'
   AND (SELECT COUNT(*) FROM paws.SessionAssignment x WHERE x.SessionId=s.SessionId)=1 ORDER BY s.SessionDate)
UPDATE sa SET FacultyId=@A FROM paws.SessionAssignment sa JOIN pick ON pick.SessionId=sa.SessionId;
PRINT N'SYNTHETIC_TA_SEED_OK';
