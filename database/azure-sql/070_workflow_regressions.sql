/* Publish each finalized session once and restore AFC rejection reason readback. */
:ON ERROR EXIT
SET NOCOUNT ON;
SET XACT_ABORT ON;
IF DB_NAME()<>N'VetMed-Ops'
   OR OBJECT_ID(N'paws_api.PublishTeachingAssignmentRelease',N'P') IS NULL
   OR COL_LENGTH(N'paws.AfcRequest',N'RejectionReason') IS NULL
   OR DATABASE_PRINCIPAL_ID(N'paws_runtime_read') IS NULL
    THROW 57000,'Apply teaching publication and AFC runtime prerequisites first.',1;
BEGIN TRANSACTION;
GO
CREATE OR ALTER PROCEDURE paws_api.PublishTeachingAssignmentRelease
    @AcademicYear nvarchar(32),
    @PublicationNote nvarchar(2000)=NULL,
    @ActorFirebaseUid nvarchar(128)
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    DECLARE @ActorName nvarchar(260),@ReleaseId uniqueidentifier=NEWID(),@Now datetime2(7)=SYSUTCDATETIME(),@Version int,@Before nvarchar(max),@After nvarchar(max);
    IF @AcademicYear NOT LIKE '[1-9][0-9][0-9][0-9]-[0-9][0-9]' OR TRY_CONVERT(int,RIGHT(@AcademicYear,2))<>(TRY_CONVERT(int,LEFT(@AcademicYear,4))+1)%100
        THROW 52160,'Academic year is invalid.',1;
    BEGIN TRY
        BEGIN TRANSACTION;
        IF paws_api.CanActOnTeachingAssignmentPackage(NULL,@ActorFirebaseUid,N'adfad')<>1 THROW 52161,'ADFAD administrator authority is required.',1;
        IF NOT EXISTS(SELECT 1 FROM paws.TeachingAssignmentPackage p JOIN paws.TeachingAssignmentCurrentFinalization cf ON cf.TeachingAssignmentPackageId=p.TeachingAssignmentPackageId WHERE p.AcademicYear=@AcademicYear AND p.Status=N'adfad_finalized')
            THROW 52162,'No finalized assignments are available to publish.',1;
        IF EXISTS(SELECT 1 FROM paws.TeachingAssignmentPackage p LEFT JOIN paws.TeachingAssignmentCurrentFinalization cf ON cf.TeachingAssignmentPackageId=p.TeachingAssignmentPackageId
          WHERE p.AcademicYear=@AcademicYear AND (p.Status<>N'adfad_finalized' OR cf.FinalizationId IS NULL))
            THROW 52163,'Unfinalized packages remain; publication must not omit package assignments.',1;
        SELECT @Version=COALESCE(MAX(VersionNumber),0)+1 FROM paws.TeachingAssignmentPublicationRelease WITH(UPDLOCK,HOLDLOCK) WHERE AcademicYear=@AcademicYear;
        SELECT @Before=(SELECT CurrentReleaseId AS currentReleaseId FROM paws.TeachingAssignmentPublicationState WHERE AcademicYear=@AcademicYear FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES);
        SELECT @ActorName=DisplayName FROM paws.UserProfile WHERE FirebaseUid=@ActorFirebaseUid AND Active=1 AND MustChangePassword=0;
        INSERT paws.TeachingAssignmentPublicationRelease(ReleaseId,AcademicYear,VersionNumber,PublishedAtUtc,PublishedByFirebaseUid,PublishedByName,PublicationNote)
        VALUES(@ReleaseId,@AcademicYear,@Version,@Now,@ActorFirebaseUid,@ActorName,NULLIF(LTRIM(RTRIM(@PublicationNote)),N''));
        INSERT paws.TeachingAssignmentPublishedSession(PublishedSessionId,ReleaseId,SessionId,CourseCode,CourseName,Topic,SessionType,SessionDate,StartTime,EndTime,Room,SourcePackageId,SourceRevisionNumber)
        SELECT NEWID(),@ReleaseId,s.SessionId,s.CourseCode,s.CourseName,s.Topic,s.SessionType,s.SessionDate,s.StartTime,s.EndTime,s.Room,p.TeachingAssignmentPackageId,cf.RevisionNumber
        FROM paws.TeachingAssignmentPackage p JOIN paws.TeachingAssignmentCurrentFinalization c ON c.TeachingAssignmentPackageId=p.TeachingAssignmentPackageId
        JOIN paws.TeachingAssignmentFinalization cf ON cf.FinalizationId=c.FinalizationId
        CROSS APPLY (
            SELECT DISTINCT line.SessionId
            FROM paws.TeachingAssignmentFinalizationLine AS line
            WHERE line.FinalizationId=cf.FinalizationId
        ) AS finalized
        JOIN paws.Session s ON s.SessionId=finalized.SessionId
        WHERE p.AcademicYear=@AcademicYear AND p.Status=N'adfad_finalized';
        INSERT paws.TeachingAssignmentPublishedInstructor(PublishedSessionId,FacultyId,FacultyDisplayName,TeachingRole)
        SELECT ps.PublishedSessionId,fl.FacultyId,fl.FacultyDisplayName,fl.TeachingRole
        FROM paws.TeachingAssignmentPublishedSession ps JOIN paws.TeachingAssignmentPackage p ON p.TeachingAssignmentPackageId=ps.SourcePackageId
        JOIN paws.TeachingAssignmentCurrentFinalization c ON c.TeachingAssignmentPackageId=p.TeachingAssignmentPackageId
        JOIN paws.TeachingAssignmentFinalizationLine fl ON fl.FinalizationId=c.FinalizationId AND fl.SessionId=ps.SessionId
        WHERE ps.ReleaseId=@ReleaseId;
        IF EXISTS(SELECT 1 FROM paws.TeachingAssignmentPublicationState WHERE AcademicYear=@AcademicYear)
            UPDATE paws.TeachingAssignmentPublicationState SET CurrentReleaseId=@ReleaseId WHERE AcademicYear=@AcademicYear;
        ELSE INSERT paws.TeachingAssignmentPublicationState(AcademicYear,CurrentReleaseId) VALUES(@AcademicYear,@ReleaseId);
        SET @After=(SELECT @ReleaseId AS releaseId,@Version AS versionNumber,@AcademicYear AS academicYear FOR JSON PATH,WITHOUT_ARRAY_WRAPPER);
        INSERT paws.AuditEvent(AuditEventId,EventType,EntityType,EntityId,ActorFirebaseUid,ActorName,OccurredAtUtc,BeforeJson,AfterJson,MetadataJson,RequestId,ImportBatchId)
        VALUES(NEWID(),N'TeachingAssignmentPublished',N'TeachingAssignmentPublicationRelease',CONVERT(nvarchar(36),@ReleaseId),@ActorFirebaseUid,@ActorName,@Now,@Before,@After,
            (SELECT @PublicationNote AS note FOR JSON PATH,WITHOUT_ARRAY_WRAPPER),NEWID(),NULL);
        COMMIT TRANSACTION;
        SELECT @ReleaseId AS releaseId,@AcademicYear AS academicYear,@Version AS versionNumber,@Now AS publishedAtUtc;
    END TRY BEGIN CATCH IF XACT_STATE()<>0 ROLLBACK TRANSACTION; THROW; END CATCH;
END;
GO
GRANT SELECT ON OBJECT::paws.AfcRequest (RejectionReason) TO [paws_runtime_read];
COMMIT TRANSACTION;
GO
