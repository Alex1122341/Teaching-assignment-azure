/* Preserve MASTER evidence separately from changes entered in Faculty administration. */
:ON ERROR EXIT
SET NOCOUNT ON;
SET XACT_ABORT ON;
IF DB_NAME()<>N'VetMed-Ops' THROW 56700,'Migration 067 requires VetMed-Ops.',1;
IF OBJECT_ID(N'paws.DoeFacultySummarySource',N'U') IS NULL
 OR OBJECT_ID(N'paws_api.SetFacultyActivation',N'P') IS NULL
 OR DATABASE_PRINCIPAL_ID(N'paws_runtime_faculty_admin_write') IS NULL
 THROW 56700,'Apply the Faculty administration and DOE source migrations first.',1;
BEGIN TRANSACTION;
IF OBJECT_ID(N'paws.FacultyDoeSummaryEdit',N'U') IS NULL
 CREATE TABLE paws.FacultyDoeSummaryEdit(
  FacultyId uniqueidentifier NOT NULL REFERENCES paws.Faculty(FacultyId),
  AcademicYear nvarchar(16) NOT NULL,
  ClinicalEdited bit NOT NULL,
  ContractClinicalTeachingDoe decimal(12,6) NULL,
  GradEdited bit NOT NULL,
  PotentialGradTeachingDoe decimal(12,6) NULL,
  CONSTRAINT PK_FacultyDoeSummaryEdit PRIMARY KEY(FacultyId,AcademicYear),
  CONSTRAINT CK_FacultyDoeSummaryEdit_Clinical CHECK(ContractClinicalTeachingDoe IS NULL OR (ClinicalEdited=1 AND ContractClinicalTeachingDoe BETWEEN 0 AND 100)),
  CONSTRAINT CK_FacultyDoeSummaryEdit_Grad CHECK(PotentialGradTeachingDoe IS NULL OR (GradEdited=1 AND PotentialGradTeachingDoe>=0))
 );
GO
CREATE OR ALTER VIEW paws.vFacultyDoeSummaryInputs AS
 SELECT COALESCE(s.FacultyId,m.FacultyId) FacultyId, COALESCE(s.AcademicYear,m.AcademicYear) AcademicYear,
  CASE WHEN m.ClinicalEdited=1 THEN m.ContractClinicalTeachingDoe ELSE s.ContractClinicalTeachingDoe END ContractClinicalTeachingDoe,
  CASE WHEN m.GradEdited=1 THEN m.PotentialGradTeachingDoe ELSE s.PotentialGradTeachingDoe END PotentialGradTeachingDoe,
  CASE WHEN m.FacultyId IS NULL THEN s.SourceReference
       ELSE CONCAT(N'Faculty administration', CASE WHEN s.SourceReference IS NOT NULL THEN CONCAT(N' · MASTER source: ',s.SourceReference) END) END SourceReference
 FROM paws.DoeFacultySummarySource s
 FULL JOIN paws.FacultyDoeSummaryEdit m ON m.FacultyId=s.FacultyId AND m.AcademicYear=s.AcademicYear;
GO
CREATE OR ALTER PROCEDURE paws_api.SetFacultyTeachingDoeInputs
 @FacultyId uniqueidentifier, @AcademicYear nvarchar(16), @ActorFirebaseUid nvarchar(128),
 @BeforeJson nvarchar(max), @ValuesJson nvarchar(max)
AS
BEGIN
 SET NOCOUNT ON;
 SET XACT_ABORT ON;
 IF DB_NAME()<>N'VetMed-Ops' OR @@TRANCOUNT=0 THROW 56700,'An atomic Faculty administration save is required.',1;
 DECLARE @ActorName nvarchar(260);
 SELECT @ActorName=DisplayName FROM paws.UserProfile
  WHERE FirebaseUid=@ActorFirebaseUid AND Active=1 AND MustChangePassword=0
    AND LOWER(LTRIM(RTRIM(BaseRole))) IN (N'developer',N'owner',N'administrator',N'adfa_general',N'adfa_regular',N'admin');
 IF @ActorName IS NULL THROW 56502,'Teaching DOE changes require an authorized Faculty administrator.',1;
 IF @AcademicYear IS NULL OR @AcademicYear NOT LIKE N'[1-9][0-9][0-9][0-9]-[0-9][0-9]'
  OR TRY_CONVERT(int,RIGHT(@AcademicYear,2))<>(TRY_CONVERT(int,LEFT(@AcademicYear,4))+1)%100
  OR COALESCE(ISJSON(@BeforeJson),0)<>1 OR COALESCE(ISJSON(@ValuesJson),0)<>1
  THROW 56702,'Invalid teaching DOE payload.',1;
 IF EXISTS(
  SELECT 1 FROM (SELECT 0 Snapshot,[key],[value],[type] FROM OPENJSON(@BeforeJson)
                 UNION ALL SELECT 1,[key],[value],[type] FROM OPENJSON(@ValuesJson)) f
  GROUP BY Snapshot,[key]
  HAVING COUNT(*)<>1 OR [key] NOT IN (N'contractTeachingDoe',N'contractClinicalTeachingDoe',N'potentialGradTeachingDoe')
   OR MAX(CASE WHEN [type] NOT IN (0,2) OR ([type]=2 AND (TRY_CONVERT(decimal(12,6),[value]) IS NULL
     OR TRY_CONVERT(decimal(12,6),[value])<0
     OR ([key]<>N'potentialGradTeachingDoe' AND TRY_CONVERT(decimal(12,6),[value])>100))) THEN 1 ELSE 0 END)=1
 ) OR (SELECT COUNT(*) FROM OPENJSON(@BeforeJson))<>3 OR (SELECT COUNT(*) FROM OPENJSON(@ValuesJson))<>3
 THROW 56702,'Invalid teaching DOE values.',1;
 IF NOT EXISTS(SELECT 1 FROM paws.Faculty WITH(UPDLOCK,HOLDLOCK) WHERE FacultyId=@FacultyId)
  THROW 52303,'Faculty record was not found.',1;

 DECLARE @Teaching decimal(12,6), @Clinical decimal(12,6), @Grad decimal(12,6), @TargetId uniqueidentifier,
  @NewTeaching decimal(12,6), @NewClinical decimal(12,6), @NewGrad decimal(12,6);
 SELECT @TargetId=DoeFacultyTargetId,@Teaching=ContractTeachingDoe
 FROM paws.DoeFacultyTarget WITH(UPDLOCK,HOLDLOCK) WHERE FacultyId=@FacultyId AND AcademicYear=@AcademicYear AND Active=1;
 SELECT @Clinical=ContractClinicalTeachingDoe,@Grad=PotentialGradTeachingDoe
 FROM paws.vFacultyDoeSummaryInputs WITH(HOLDLOCK) WHERE FacultyId=@FacultyId AND AcademicYear=@AcademicYear;
 IF EXISTS(
  SELECT @Teaching,@Clinical,@Grad
  EXCEPT
  SELECT contractTeachingDoe,contractClinicalTeachingDoe,potentialGradTeachingDoe
  FROM OPENJSON(@BeforeJson) WITH(contractTeachingDoe decimal(12,6),contractClinicalTeachingDoe decimal(12,6),potentialGradTeachingDoe decimal(12,6))
 ) THROW 56703,'Teaching DOE changed; reload before saving.',1;
 SELECT @NewTeaching=contractTeachingDoe,@NewClinical=contractClinicalTeachingDoe,@NewGrad=potentialGradTeachingDoe
 FROM OPENJSON(@ValuesJson) WITH(contractTeachingDoe decimal(12,6),contractClinicalTeachingDoe decimal(12,6),potentialGradTeachingDoe decimal(12,6));
 IF NOT EXISTS(SELECT @Teaching,@Clinical,@Grad EXCEPT SELECT @NewTeaching,@NewClinical,@NewGrad) RETURN;

 IF EXISTS(SELECT @Teaching EXCEPT SELECT @NewTeaching)
 BEGIN
  IF @TargetId IS NULL
   INSERT paws.DoeFacultyTarget(DoeFacultyTargetId,FacultyId,AcademicYear,ContractTeachingDoe,Source,UpdatedBy)
   VALUES(NEWID(),@FacultyId,@AcademicYear,@NewTeaching,N'faculty-admin',@ActorFirebaseUid);
  ELSE
   UPDATE paws.DoeFacultyTarget
    SET ContractTeachingDoe=@NewTeaching,UpdatedBy=@ActorFirebaseUid,UpdatedAtUtc=SYSUTCDATETIME()
    WHERE DoeFacultyTargetId=@TargetId;
 END;
 DECLARE @ChangeClinical bit=0,@ChangeGrad bit=0;
 IF EXISTS(SELECT @Clinical EXCEPT SELECT @NewClinical) SET @ChangeClinical=1;
 IF EXISTS(SELECT @Grad EXCEPT SELECT @NewGrad) SET @ChangeGrad=1;
 IF @ChangeClinical=1 OR @ChangeGrad=1
 BEGIN
  UPDATE paws.FacultyDoeSummaryEdit
   SET ContractClinicalTeachingDoe=CASE WHEN @ChangeClinical=1 THEN @NewClinical ELSE ContractClinicalTeachingDoe END,
       PotentialGradTeachingDoe=CASE WHEN @ChangeGrad=1 THEN @NewGrad ELSE PotentialGradTeachingDoe END,
       ClinicalEdited=CASE WHEN @ChangeClinical=1 THEN 1 ELSE ClinicalEdited END,
       GradEdited=CASE WHEN @ChangeGrad=1 THEN 1 ELSE GradEdited END
   WHERE FacultyId=@FacultyId AND AcademicYear=@AcademicYear;
  IF @@ROWCOUNT=0
   INSERT paws.FacultyDoeSummaryEdit VALUES(@FacultyId,@AcademicYear,@ChangeClinical,
    CASE WHEN @ChangeClinical=1 THEN @NewClinical END,@ChangeGrad,CASE WHEN @ChangeGrad=1 THEN @NewGrad END);
 END;
 INSERT paws.AuditEvent(AuditEventId,EventType,EntityType,EntityId,ActorFirebaseUid,ActorName,OccurredAtUtc,BeforeJson,AfterJson,MetadataJson)
 VALUES(NEWID(),N'FacultyUpdated',N'Faculty',CONVERT(nvarchar(36),@FacultyId),@ActorFirebaseUid,@ActorName,SYSUTCDATETIME(),
  JSON_MODIFY(@BeforeJson,'$.academicYear',@AcademicYear),JSON_MODIFY(@ValuesJson,'$.academicYear',@AcademicYear),
  N'{"source":"faculty-admin-teaching-doe"}');
END;
GO
GRANT SELECT ON OBJECT::paws.vFacultyDoeSummaryInputs TO [paws_runtime_read];
GRANT EXECUTE ON OBJECT::paws_api.SetFacultyTeachingDoeInputs TO [paws_runtime_faculty_admin_write];
COMMIT TRANSACTION;
