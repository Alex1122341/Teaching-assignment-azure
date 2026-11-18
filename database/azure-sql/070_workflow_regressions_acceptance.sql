:ON ERROR EXIT
SET NOCOUNT ON;
SET XACT_ABORT ON;
IF DB_NAME()<>N'VetMed-Ops' OR USER_ID(N'paws-calendar-test-runtime') IS NULL
    THROW 57001,'Use the disposable workflow acceptance database.',1;

BEGIN TRANSACTION;
DECLARE @Year nvarchar(32)=N'2088-89', @Actor nvarchar(128)=N'synthetic070developer',
    @Batch uniqueidentifier=NEWID(), @Lead uniqueidentifier=NEWID(), @CoLead uniqueidentifier=NEWID(),
    @Session uniqueidentifier=NEWID(), @Package uniqueidentifier=NEWID(), @Revision uniqueidentifier=NEWID(),
    @Finalization uniqueidentifier=NEWID(), @Release uniqueidentifier, @Now datetime2(7)=SYSUTCDATETIME();

INSERT staging.ImportBatch(ImportBatchId,StartedAtUtc,Status,SourceManifestSha256,ImporterVersion,ValidationSummaryJson)
VALUES(@Batch,@Now,N'synthetic',REPLICATE('F',64),N'workflow070',N'{}');
INSERT paws.Faculty(FacultyId,RecordType,DisplayName,Active,SourceImportBatchId)
VALUES(@Lead,N'faculty',N'Teacher, Alex',1,@Batch),(@CoLead,N'faculty',N'Teacher, Jordan',1,@Batch);
INSERT paws.UserProfile(FirebaseUid,Email,DisplayName,BaseRole,Active,MustChangePassword)
VALUES(@Actor,N'developer070@example.invalid',N'Developer, Case',N'developer',1,0);
INSERT paws.TeachingResponsibility(ResponsibilityId,Kind,Label,Active)
VALUES(N'workflow070hicc',N'hicc',N'Synthetic HICC',1),(N'workflow070visc',N'visc',N'Synthetic VISC',1);
INSERT paws.TeachingAssignmentGroup(GroupId,Name,LeaderViscResponsibilityId,Active)
VALUES(N'workflow070area',N'Synthetic area',N'workflow070visc',1);
INSERT paws.TeachingAssignmentGroupHicc(GroupId,HiccResponsibilityId) VALUES(N'workflow070area',N'workflow070hicc');
INSERT paws.TeachingAssignmentPackage(TeachingAssignmentPackageId,PackageIdentity,AcademicYear,GroupId,HiccResponsibilityId,Status,WorkingRevision)
VALUES(@Package,N'ta-package-v1__2088-89__workflow070area__workflow070hicc',@Year,N'workflow070area',N'workflow070hicc',N'adfad_finalized',1);
INSERT paws.Session(SessionId,AcademicYear,CourseCode,Topic,SessionType,SessionDate,StartTime,EndTime,SourceImportBatchId)
VALUES(@Session,@Year,N'070SYNTHETIC',N'Co-taught session',N'LEC','2088-10-01','09:00','10:00',@Batch);
INSERT paws.TeachingAssignmentRevision(RevisionId,TeachingAssignmentPackageId,RevisionNumber,CreatedByFirebaseUid,CreatedByName,CreatedAtUtc)
VALUES(@Revision,@Package,1,@Actor,N'Developer, Case',@Now);
INSERT paws.TeachingAssignmentRevisionSession(RevisionId,TeachingAssignmentPackageId,SessionId,SessionOrder)
VALUES(@Revision,@Package,@Session,0);
INSERT paws.TeachingAssignmentFinalization(FinalizationId,TeachingAssignmentPackageId,RevisionId,RevisionNumber,VersionNumber,ActorFirebaseUid,ActorName,FinalNote,CreatedAtUtc)
VALUES(@Finalization,@Package,@Revision,1,1,@Actor,N'Developer, Case',N'Synthetic final note',@Now);
INSERT paws.TeachingAssignmentCurrentFinalization(TeachingAssignmentPackageId,FinalizationId) VALUES(@Package,@Finalization);
INSERT paws.TeachingAssignmentFinalizationLine(FinalizationId,SessionAssignmentId,SessionId,FacultyId,FacultyDisplayName,TeachingRole)
VALUES(@Finalization,NEWID(),@Session,@Lead,N'Teacher, Alex',N'Lead'),
      (@Finalization,NEWID(),@Session,@CoLead,N'Teacher, Jordan',N'Co-instructor');

EXEC paws_api.PublishTeachingAssignmentRelease @AcademicYear=@Year,@PublicationNote=NULL,@ActorFirebaseUid=@Actor;
SELECT @Release=CurrentReleaseId FROM paws.TeachingAssignmentPublicationState WHERE AcademicYear=@Year;
IF (SELECT COUNT(*) FROM paws.TeachingAssignmentPublishedSession WHERE ReleaseId=@Release AND SessionId=@Session)<>1
    THROW 57001,'Co-teaching publication must create exactly one published session.',1;
IF NOT EXISTS (
    SELECT 1 FROM paws.TeachingAssignmentPublishedSession AS s
    JOIN paws.TeachingAssignmentPublishedInstructor AS lead ON lead.PublishedSessionId=s.PublishedSessionId AND lead.FacultyId=@Lead AND lead.TeachingRole=N'Lead'
    JOIN paws.TeachingAssignmentPublishedInstructor AS co ON co.PublishedSessionId=s.PublishedSessionId AND co.FacultyId=@CoLead AND co.TeachingRole=N'Co-instructor'
    WHERE s.ReleaseId=@Release AND s.SessionId=@Session
)
    THROW 57001,'The release must preserve both instructors and their roles.',1;

ROLLBACK TRANSACTION;
