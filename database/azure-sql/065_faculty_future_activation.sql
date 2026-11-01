/*
 PAWS Beta 065 — Future Faculty activation and canonical admin creation.
 All writes are admin-gated. No accounts, assignment history or DOE are replaced.
 Active bit retains ADMIN ENABLED semantics; effective active state is derived
 at read time (local university date) from Active AND ActivationDate.
*/
:ON ERROR EXIT
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
IF DB_NAME()<>N'VetMed-Ops' THROW 56500,'Wrong database for faculty activation migration.',1;
IF OBJECT_ID(N'paws.Faculty',N'U') IS NULL
 OR OBJECT_ID(N'paws.FacultyProfessionalProfile',N'U') IS NULL
 OR OBJECT_ID(N'paws.UserProfile',N'U') IS NULL
 OR OBJECT_ID(N'paws.AuditEvent',N'U') IS NULL
 OR OBJECT_ID(N'staging.ImportBatch',N'U') IS NULL
 OR OBJECT_ID(N'paws_api.UpdateFaculty',N'P') IS NULL
 OR OBJECT_ID(N'paws.SessionAssignment',N'U') IS NULL
 OR OBJECT_ID(N'paws.TeachingAssignmentRevisionInstructor',N'U') IS NULL
 OR OBJECT_ID(N'paws.TeachingAssignmentFinalizationLine',N'U') IS NULL
 OR OBJECT_ID(N'paws.TeachingAssignmentPublishedInstructor',N'U') IS NULL
 THROW 56501,'Missing prerequisites: Faculty P3 and Teaching Assignment P2 are required.',1;
IF COL_LENGTH(N'paws.Faculty',N'ActivationDate') IS NULL
 ALTER TABLE paws.Faculty ADD ActivationDate date NULL;
GO

CREATE OR ALTER PROCEDURE paws_api.CreateFaculty
 @ActorFirebaseUid nvarchar(128),
 @PreferredFirstName nvarchar(128)=NULL,
 @PreferredLastName nvarchar(128)=NULL,
 @DisplayName nvarchar(260),
 @Ucid nvarchar(64)=NULL,
 @Email nvarchar(256)=NULL,
 @RecordType nvarchar(32)=N'faculty',
 @Stream nvarchar(128)=NULL,
 @Rank nvarchar(128)=NULL,
 @Fte decimal(5,4)=NULL,
 @ReportsToFacultyId uniqueidentifier=NULL,
 @ActivationDate date=NULL,
 @TeachingArea nvarchar(512)=NULL,
 @ProfessionalCategory nvarchar(256)=NULL,
 @ServiceDate date=NULL,
 @PriorYearsExperience decimal(5,2)=NULL,
 @DvmEarnedDate nvarchar(64)=NULL,
 @DvmType nvarchar(256)=NULL,
 @MastersEarnedDate nvarchar(64)=NULL,
 @MastersArea nvarchar(max)=NULL,
 @PhdEarnedDate nvarchar(64)=NULL,
 @PhdArea nvarchar(max)=NULL,
 @BoardCertifiedDate nvarchar(64)=NULL,
 @BoardCertification nvarchar(max)=NULL,
 @BoardCertificationCount decimal(5,2)=NULL,
 @AbvmaLicenseNumber nvarchar(128)=NULL,
 @AbvmaMemberType nvarchar(512)=NULL
AS
BEGIN
 SET NOCOUNT ON;SET XACT_ABORT ON;
 DECLARE @ActorName nvarchar(260),@ActorEmail nvarchar(256),
  @FacultyId uniqueidentifier=NEWID(),@BatchId uniqueidentifier=NEWID(),
  @CreatedAtUtc datetime2(7)=SYSUTCDATETIME(),
  @NormalizedName nvarchar(260)=NULLIF(LTRIM(RTRIM(@DisplayName)),N''),
  @NormalizedUcid nvarchar(64)=NULLIF(LTRIM(RTRIM(@Ucid)),N''),
  @NormalizedEmail nvarchar(256)=NULLIF(LTRIM(RTRIM(@Email)),N'');
 SELECT @ActorName=DisplayName,@ActorEmail=Email FROM paws.UserProfile
 WHERE FirebaseUid=@ActorFirebaseUid AND Active=1 AND MustChangePassword=0
 AND LOWER(LTRIM(RTRIM(BaseRole))) IN
  (N'developer',N'owner',N'administrator',N'adfa_general',N'adfa_regular',N'admin');
 IF @ActorName IS NULL THROW 56502,'Faculty creation requires an authorized admin.',1;
 IF @NormalizedName IS NULL
 OR @RecordType IS NULL OR LOWER(LTRIM(RTRIM(@RecordType))) NOT IN (N'faculty',N'other_pool',N'sessional_pool',N'vacancy')
 OR (@Fte IS NOT NULL AND @Fte<0)
 OR (@PriorYearsExperience IS NOT NULL AND @PriorYearsExperience<0)
 OR (@BoardCertificationCount IS NOT NULL AND @BoardCertificationCount<0)
 THROW 56503,'Invalid Faculty values.',1;
 IF @NormalizedUcid IS NULL AND @NormalizedEmail IS NULL
    THROW 56503,'At least a UCID or email is required to prevent duplicate Faculty identities.',1;
 BEGIN TRY
  BEGIN TRANSACTION;
  IF (@NormalizedUcid IS NOT NULL AND EXISTS(
    SELECT 1 FROM paws.Faculty WITH(UPDLOCK,HOLDLOCK)
    WHERE UPPER(LTRIM(RTRIM(Ucid)))=UPPER(@NormalizedUcid)))
   OR (@NormalizedEmail IS NOT NULL AND EXISTS(
    SELECT 1 FROM paws.Faculty WITH(UPDLOCK,HOLDLOCK)
    WHERE UPPER(LTRIM(RTRIM(Email)))=UPPER(@NormalizedEmail)))
   THROW 52304,'Faculty identity exists, including inactive records. Restore it rather than creating a duplicate.',1;
  IF @ReportsToFacultyId IS NOT NULL AND NOT EXISTS(
   SELECT 1 FROM paws.Faculty WHERE FacultyId=@ReportsToFacultyId)
   THROW 56503,'Reports-To Faculty does not exist.',1;
  DECLARE @Manifest char(64)=CONVERT(char(64),HASHBYTES('SHA2_256',
   CONVERT(varbinary(max),CONCAT(CONVERT(nvarchar(36),@FacultyId),N'|',@NormalizedName,N'|',@NormalizedUcid,N'|',@NormalizedEmail))),2);
  INSERT staging.ImportBatch
   (ImportBatchId,StartedAtUtc,CompletedAtUtc,Status,SourceManifestSha256,ImporterVersion,ActorUpn,ValidationSummaryJson)
  VALUES(@BatchId,@CreatedAtUtc,@CreatedAtUtc,N'Completed',@Manifest,N'paws-faculty-admin-ui-065',
   @ActorEmail,N'{"source":"faculty-admin-create","validated":true}');
  INSERT paws.Faculty
   (FacultyId,RecordType,PreferredFirstName,PreferredLastName,DisplayName,Ucid,Email,Stream,Rank,
    Fte,ReportsToFacultyId,ReportsToRaw,Active,ActivationDate,SourceImportBatchId,SourceRow,CreatedAtUtc,UpdatedAtUtc)
  VALUES(@FacultyId,LOWER(LTRIM(RTRIM(@RecordType))),NULLIF(LTRIM(RTRIM(@PreferredFirstName)),N''),
   NULLIF(LTRIM(RTRIM(@PreferredLastName)),N''),@NormalizedName,@NormalizedUcid,@NormalizedEmail,
   @Stream,@Rank,@Fte,@ReportsToFacultyId,NULL,1,@ActivationDate,@BatchId,NULL,@CreatedAtUtc,@CreatedAtUtc);
  INSERT paws.FacultyProfessionalProfile
   (FacultyId,TeachingArea,ProfessionalCategory,ServiceDate,PriorYearsExperience,DvmEarnedDate,DvmType,
    MastersEarnedDate,MastersArea,PhdEarnedDate,PhdArea,BoardCertifiedDate,BoardCertification,
    BoardCertificationCount,AbvmaLicenseNumber,AbvmaMemberType,SourceImportBatchId,SourceRow)
  VALUES(@FacultyId,@TeachingArea,@ProfessionalCategory,@ServiceDate,@PriorYearsExperience,
   @DvmEarnedDate,@DvmType,@MastersEarnedDate,@MastersArea,@PhdEarnedDate,@PhdArea,@BoardCertifiedDate,
   @BoardCertification,@BoardCertificationCount,@AbvmaLicenseNumber,@AbvmaMemberType,@BatchId,NULL);
  INSERT paws.AuditEvent
   (AuditEventId,EventType,EntityType,EntityId,ActorFirebaseUid,ActorName,OccurredAtUtc,BeforeJson,AfterJson,MetadataJson)
  VALUES(NEWID(),N'FacultyCreated',N'Faculty',CONVERT(nvarchar(36),@FacultyId),
   @ActorFirebaseUid,@ActorName,@CreatedAtUtc,NULL,
   (SELECT @FacultyId facultyId,@NormalizedName displayName,@NormalizedUcid ucid,@NormalizedEmail email,
     @ActivationDate activationDate,CAST(1 AS bit) administrativeActive FOR JSON PATH,WITHOUT_ARRAY_WRAPPER),
   N'{"source":"faculty-admin-create","identityPreserved":true}');
  COMMIT TRANSACTION;
 END TRY BEGIN CATCH IF XACT_STATE()<>0 ROLLBACK TRANSACTION;THROW; END CATCH;
 SELECT f.FacultyId AS facultyId,f.PreferredFirstName AS preferredFirstName,f.PreferredLastName AS preferredLastName,
 f.DisplayName AS displayName,f.Ucid AS ucid,f.Email AS email,f.RecordType AS recordType,
 f.Stream AS stream,f.Rank AS rank,f.Fte AS fte,f.ReportsToFacultyId AS reportsToFacultyId,
 f.Active AS administrativeActive,
 CASE WHEN f.Active=1 AND (f.ActivationDate IS NULL OR f.ActivationDate <= CONVERT(date,SYSDATETIMEOFFSET() AT TIME ZONE 'Mountain Standard Time')) THEN CAST(1 AS bit) ELSE CAST(0 AS bit) END AS active,
 CONVERT(varchar(10),f.ActivationDate,23) AS activationDate,
 CONVERT(varchar(33),f.UpdatedAtUtc,126)+'Z' updatedAtUtc,
 p.TeachingArea AS teachingArea,p.ProfessionalCategory AS professionalCategory,
 CONVERT(varchar(10),p.ServiceDate,23) AS serviceDate,p.PriorYearsExperience AS priorYearsExperience,
 p.DvmEarnedDate AS dvmEarnedDate,p.DvmType AS dvmType,
 p.MastersEarnedDate AS mastersEarnedDate,p.MastersArea AS mastersArea,p.PhdEarnedDate AS phdEarnedDate,p.PhdArea AS phdArea,
 p.BoardCertifiedDate AS boardCertifiedDate,p.BoardCertification AS boardCertification,
 p.BoardCertificationCount AS boardCertificationCount,p.AbvmaLicenseNumber AS abvmaLicenseNumber,
 p.AbvmaMemberType AS abvmaMemberType,CONVERT(varchar(18),CONVERT(varbinary(8),p.ProfileVersion),1) AS profileVersion
 FROM paws.Faculty f LEFT JOIN paws.FacultyProfessionalProfile p ON p.FacultyId=f.FacultyId WHERE f.FacultyId=@FacultyId;
END;
GO

CREATE OR ALTER PROCEDURE paws_api.SetFacultyActivation
 @FacultyId uniqueidentifier,
 @ExpectedUpdatedAtUtc nvarchar(40),
 @ActivationDate date=NULL,
 @ActorFirebaseUid nvarchar(128)
AS
BEGIN
 SET NOCOUNT ON;SET XACT_ABORT ON;
 DECLARE @ActorName nvarchar(260),@Before date,@Current datetime2(7);
 SELECT @ActorName=DisplayName FROM paws.UserProfile
 WHERE FirebaseUid=@ActorFirebaseUid AND Active=1 AND MustChangePassword=0
 AND LOWER(LTRIM(RTRIM(BaseRole))) IN
  (N'developer',N'owner',N'administrator',N'adfa_general',N'adfa_regular',N'admin');
 IF @ActorName IS NULL THROW 56502,'Faculty activation changes require an authorized admin.',1;
 BEGIN TRY
  BEGIN TRANSACTION;
  SELECT @Before=ActivationDate,@Current=UpdatedAtUtc
   FROM paws.Faculty WITH(UPDLOCK,HOLDLOCK) WHERE FacultyId=@FacultyId;
  IF @Current IS NULL THROW 52303,'Faculty was not found.',1;
  IF @Current<>TRY_CONVERT(datetime2(7),@ExpectedUpdatedAtUtc,127) THROW 52305,'Faculty changed; reload before setting activation.',1;
  IF @ActivationDate IS NOT NULL AND
  (
    EXISTS(SELECT 1 FROM paws.SessionAssignment sa
      JOIN paws.vCalendarSession s ON s.SessionId=sa.SessionId
      WHERE sa.FacultyId=@FacultyId AND (s.SessionDate IS NULL OR s.SessionDate<@ActivationDate))
    OR EXISTS(SELECT 1 FROM paws.TeachingAssignmentRevisionInstructor ri
      JOIN paws.Session s ON s.SessionId=ri.SessionId
      WHERE ri.FacultyId=@FacultyId AND (s.SessionDate IS NULL OR s.SessionDate<@ActivationDate))
    OR EXISTS(SELECT 1 FROM paws.TeachingAssignmentFinalizationLine fi
      JOIN paws.Session s ON s.SessionId=fi.SessionId
      WHERE fi.FacultyId=@FacultyId AND (s.SessionDate IS NULL OR s.SessionDate<@ActivationDate))
    OR EXISTS(SELECT 1 FROM paws.TeachingAssignmentPublishedInstructor pi
      JOIN paws.TeachingAssignmentPublishedSession ps ON ps.PublishedSessionId=pi.PublishedSessionId
      WHERE pi.FacultyId=@FacultyId AND (ps.SessionDate IS NULL OR ps.SessionDate<@ActivationDate))
  )
     THROW 56552,'Existing teaching assignments predate the requested Faculty start date.',1;
  IF (@Before IS NULL AND @ActivationDate IS NOT NULL)
   OR (@Before IS NOT NULL AND @ActivationDate IS NULL)
   OR (@Before<>@ActivationDate)
  BEGIN
   UPDATE paws.Faculty SET ActivationDate=@ActivationDate,UpdatedAtUtc=SYSUTCDATETIME()
    WHERE FacultyId=@FacultyId AND UpdatedAtUtc=@Current;
   IF @@ROWCOUNT<>1 THROW 52305,'Faculty activation changed concurrently.',1;
   INSERT paws.AuditEvent
    (AuditEventId,EventType,EntityType,EntityId,ActorFirebaseUid,ActorName,OccurredAtUtc,BeforeJson,AfterJson,MetadataJson)
   VALUES(NEWID(),N'FacultyActivationScheduled',N'Faculty',CONVERT(nvarchar(36),@FacultyId),
    @ActorFirebaseUid,@ActorName,SYSUTCDATETIME(),
    (SELECT @Before activationDate FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES),
    (SELECT @ActivationDate activationDate FOR JSON PATH,WITHOUT_ARRAY_WRAPPER,INCLUDE_NULL_VALUES),
    N'{"source":"faculty-admin-lifecycle"}');
  END;
  COMMIT TRANSACTION;
 END TRY BEGIN CATCH IF XACT_STATE()<>0 ROLLBACK TRANSACTION;THROW;END CATCH;
 SELECT f.FacultyId AS facultyId,f.PreferredFirstName AS preferredFirstName,f.PreferredLastName AS preferredLastName,
 f.DisplayName AS displayName,f.Ucid AS ucid,f.Email AS email,f.RecordType AS recordType,
 f.Stream AS stream,f.Rank AS rank,f.Fte AS fte,f.ReportsToFacultyId AS reportsToFacultyId,
 f.Active AS administrativeActive,
 CASE WHEN f.Active=1 AND (f.ActivationDate IS NULL OR f.ActivationDate<=CONVERT(date,SYSDATETIMEOFFSET() AT TIME ZONE 'Mountain Standard Time')) THEN CAST(1 AS bit) ELSE CAST(0 AS bit) END AS active,
 CONVERT(varchar(10),f.ActivationDate,23) AS activationDate,
 CONVERT(varchar(33),f.UpdatedAtUtc,126)+'Z' AS updatedAtUtc,
 p.TeachingArea AS teachingArea,p.ProfessionalCategory AS professionalCategory,
 CONVERT(varchar(10),p.ServiceDate,23) AS serviceDate,p.PriorYearsExperience AS priorYearsExperience,
 p.DvmEarnedDate AS dvmEarnedDate,p.DvmType AS dvmType,
 p.MastersEarnedDate AS mastersEarnedDate,p.MastersArea AS mastersArea,p.PhdEarnedDate AS phdEarnedDate,p.PhdArea AS phdArea,
 p.BoardCertifiedDate AS boardCertifiedDate,p.BoardCertification AS boardCertification,
 p.BoardCertificationCount AS boardCertificationCount,p.AbvmaLicenseNumber AS abvmaLicenseNumber,
 p.AbvmaMemberType AS abvmaMemberType,CONVERT(varchar(18),CONVERT(varbinary(8),p.ProfileVersion),1) AS profileVersion
 FROM paws.Faculty f LEFT JOIN paws.FacultyProfessionalProfile p ON p.FacultyId=f.FacultyId WHERE f.FacultyId=@FacultyId;
END;
GO

/* Reject newly authored assignments for inactive faculty, or a session
   scheduled before their official activation date. Old source rows are
   preserved; only INSERT/UPDATE of identifying columns are checked. */
CREATE OR ALTER TRIGGER paws.trg_FacultyActivation_SessionAssignment
ON paws.SessionAssignment AFTER INSERT,UPDATE
AS
BEGIN
 SET NOCOUNT ON;
 IF NOT(UPDATE(FacultyId) OR UPDATE(SessionId)) RETURN;
 IF EXISTS(SELECT 1 FROM inserted i
  JOIN paws.vCalendarSession s ON s.SessionId=i.SessionId
  LEFT JOIN paws.Faculty f ON f.FacultyId=i.FacultyId
  WHERE i.FacultyId IS NOT NULL AND
    (f.FacultyId IS NULL OR f.Active<>1 OR (f.ActivationDate IS NOT NULL AND (s.SessionDate IS NULL OR s.SessionDate<f.ActivationDate))))
  THROW 56551,'Faculty is inactive or the course session is before the effective start date.',1;
END;
GO
CREATE OR ALTER TRIGGER paws.trg_FacultyActivation_Session
ON paws.Session AFTER UPDATE
AS
BEGIN
 SET NOCOUNT ON;
 IF NOT UPDATE(SessionDate) RETURN;
 IF EXISTS(SELECT 1 FROM inserted i
   JOIN paws.SessionAssignment sa ON sa.SessionId=i.SessionId
   JOIN paws.Faculty f ON f.FacultyId=sa.FacultyId
   WHERE f.ActivationDate IS NOT NULL AND i.SessionDate<f.ActivationDate)
 THROW 56551,'Rescheduling would place a Faculty course before their start date.',1;
END;
GO
CREATE OR ALTER TRIGGER paws.trg_FacultyActivation_DraftInstructor
ON paws.TeachingAssignmentRevisionInstructor AFTER INSERT,UPDATE
AS
BEGIN
 SET NOCOUNT ON;
 IF NOT(UPDATE(FacultyId) OR UPDATE(SessionId)) RETURN;
 IF EXISTS(SELECT 1 FROM inserted i JOIN paws.Session s ON s.SessionId=i.SessionId
  LEFT JOIN paws.Faculty f ON f.FacultyId=i.FacultyId
  WHERE f.FacultyId IS NULL OR f.Active<>1 OR (f.ActivationDate IS NOT NULL AND (s.SessionDate IS NULL OR s.SessionDate<f.ActivationDate)))
 THROW 56551,'Draft teaching assignment precedes Faculty activation or Faculty is disabled.',1;
END;
GO
CREATE OR ALTER TRIGGER paws.trg_FacultyActivation_Finalization
ON paws.TeachingAssignmentFinalizationLine AFTER INSERT,UPDATE
AS
BEGIN
 SET NOCOUNT ON;
 IF NOT(UPDATE(FacultyId) OR UPDATE(SessionId)) RETURN;
 IF EXISTS(SELECT 1 FROM inserted i JOIN paws.Session s ON s.SessionId=i.SessionId
  LEFT JOIN paws.Faculty f ON f.FacultyId=i.FacultyId
  WHERE f.FacultyId IS NULL OR f.Active<>1 OR (f.ActivationDate IS NOT NULL AND (s.SessionDate IS NULL OR s.SessionDate<f.ActivationDate)))
 THROW 56551,'Final teaching assignment precedes Faculty activation or Faculty is disabled.',1;
END;
GO
CREATE OR ALTER TRIGGER paws.trg_FacultyActivation_PublishedInstructor
ON paws.TeachingAssignmentPublishedInstructor AFTER INSERT,UPDATE
AS
BEGIN
 SET NOCOUNT ON;
 IF NOT(UPDATE(FacultyId) OR UPDATE(PublishedSessionId)) RETURN;
 IF EXISTS(SELECT 1 FROM inserted i
  JOIN paws.TeachingAssignmentPublishedSession s ON s.PublishedSessionId=i.PublishedSessionId
  LEFT JOIN paws.Faculty f ON f.FacultyId=i.FacultyId
  WHERE f.FacultyId IS NULL OR f.Active<>1 OR (f.ActivationDate IS NOT NULL AND (s.SessionDate IS NULL OR s.SessionDate<f.ActivationDate)))
 THROW 56551,'Published teaching assignment precedes Faculty activation or Faculty is disabled.',1;
END;
GO
IF DATABASE_PRINCIPAL_ID(N'paws_runtime_read') IS NOT NULL
 GRANT SELECT ON OBJECT::paws.Faculty(ActivationDate) TO [paws_runtime_read];
IF DATABASE_PRINCIPAL_ID(N'paws_runtime_faculty_admin_write') IS NOT NULL
BEGIN
 GRANT EXECUTE ON OBJECT::paws_api.CreateFaculty TO [paws_runtime_faculty_admin_write];
 GRANT EXECUTE ON OBJECT::paws_api.SetFacultyActivation TO [paws_runtime_faculty_admin_write];
END;
GO
