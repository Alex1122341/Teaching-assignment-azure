:ON ERROR EXIT
SET NOCOUNT ON;SET XACT_ABORT ON;
IF DB_NAME()<>N'VetMed-Ops' OR OBJECT_ID(N'dbo.PawsDisposableLeadership061',N'U') IS NULL THROW 54360,'Disposable scoped workflow marker required.',1;
IF OBJECT_DEFINITION(OBJECT_ID(N'paws_api.CanActOnTeachingAssignmentPackage')) IS NULL OR OBJECT_DEFINITION(OBJECT_ID(N'paws_api.CanActOnTeachingAssignmentPackage')) NOT LIKE N'%PAWS_SCOPED_TEACHING_063%'
 THROW 54360,'Scoped multi-role SQL workflow authority is missing.',1;
GO
DECLARE @Today date=CONVERT(date,(SYSUTCDATETIME() AT TIME ZONE 'UTC') AT TIME ZONE 'Mountain Standard Time'),@Year int,@AY nvarchar(32),@Start date,@End date;
SET @Year=YEAR(@Today)-IIF(MONTH(@Today)<5,1,0);SET @AY=CONCAT(@Year,N'-',RIGHT(CONVERT(varchar(4),@Year+1),2));SET @Start=DATEFROMPARTS(@Year,5,1);SET @End=DATEFROMPARTS(@Year+1,5,1);
DECLARE @Batch uniqueidentifier=NEWID(),@Faculty uniqueidentifier=NEWID(),@Reviewer uniqueidentifier=NEWID(),@Course uniqueidentifier=NEWID(),@OtherCourse uniqueidentifier=NEWID(),@HSource uniqueidentifier=NEWID(),@VSource uniqueidentifier=NEWID(),@HAssignee uniqueidentifier=NEWID(),@VAssignee uniqueidentifier=NEWID(),@Operation uniqueidentifier=NEWID(),@Package uniqueidentifier=NEWID(),@OtherPackage uniqueidentifier=NEWID(),@Session uniqueidentifier=NEWID(),@CrossSession uniqueidentifier=NEWID();
INSERT staging.ImportBatch(ImportBatchId,StartedAtUtc,Status,SourceManifestSha256,ImporterVersion,ValidationSummaryJson) VALUES(@Batch,SYSUTCDATETIME(),N'synthetic',REPLICATE('F',64),N'workflow063',N'{}');
INSERT paws.Faculty(FacultyId,RecordType,DisplayName,Active,SourceImportBatchId) VALUES(@Faculty,N'faculty',N'Alex Example',1,@Batch),(@Reviewer,N'faculty',N'Jordan Example',1,@Batch);
INSERT paws.Course(CourseId,CourseCode,CourseName,SourceImportBatchId) VALUES(@Course,N'063SYNTHETIC',N'Synthetic scoped course',@Batch),(@OtherCourse,N'063OTHER',N'Synthetic unrelated course',@Batch);
INSERT paws.UserProfile(FirebaseUid,Email,DisplayName,BaseRole,FacultyId,Active,MustChangePassword) VALUES
 (N'leadership063dual',N'dual063@example.test',N'Alex Example',N'faculty',@Faculty,1,0),
 (N'leadership063reviewer',N'reviewer063@example.test',N'Jordan Example',N'visc',@Reviewer,1,0),
 (N'leadership063developer',N'developer063@example.test',N'Synthetic Developer',N'developer',NULL,1,0);
INSERT paws.TeachingResponsibility(ResponsibilityId,Kind,Label,Active) VALUES(N'leadership063hicc',N'hicc',N'Synthetic HICC',1),(N'leadership063visc',N'visc',N'Synthetic VISC',1),(N'leadership063otherhicc',N'hicc',N'Synthetic other HICC',1),(N'leadership063othervisc',N'visc',N'Synthetic other VISC',1);
INSERT paws.TeachingResponsibilityScope(ResponsibilityScopeId,HiccResponsibilityId,CourseId) VALUES(NEWID(),N'leadership063hicc',@Course),(NEWID(),N'leadership063otherhicc',@OtherCourse);
INSERT paws.TeachingAssignmentGroup(GroupId,Name,LeaderViscResponsibilityId,Active) VALUES(N'leadership063area',N'Synthetic authorized area',N'leadership063visc',1),(N'leadership063otherarea',N'Synthetic unrelated area',N'leadership063othervisc',1);
INSERT paws.TeachingAssignmentGroupHicc(GroupId,HiccResponsibilityId) VALUES(N'leadership063area',N'leadership063hicc'),(N'leadership063otherarea',N'leadership063otherhicc');
INSERT paws.TeachingResponsibilityAssignee(ResponsibilityAssigneeId,ResponsibilityId,AcademicYear,FacultyId,ActiveDate,ExpirationDate,AssignmentMode) VALUES
 (@HAssignee,N'leadership063hicc',@AY,@Faculty,@Start,@End,N'exclusive'),(@VAssignee,N'leadership063visc',@AY,@Faculty,@Start,@End,N'concurrent'),(NEWID(),N'leadership063visc',@AY,@Reviewer,@Start,@End,N'concurrent');
INSERT paws.RoleAssignment(RoleAssignmentId,FacultyId,FacultyResolutionStatus,AcademicYear,RoleType,CourseId,CourseOrSubjectOrRotation,EffectiveDate,ExpirationDate,SourceImportBatchId,SourceRow) VALUES
 (@HSource,@Faculty,N'resolved',@AY,N'HICC',@Course,N'Synthetic explicit course',@Start,DATEADD(day,-1,@End),@Batch,1),(@VSource,@Faculty,N'resolved',@AY,N'VISC',NULL,N'Synthetic explicit area',@Start,DATEADD(day,-1,@End),@Batch,2);
INSERT paws.LeadershipAccessOperation(OperationId,PreviewId,ActorUid,TargetUid,AcademicYear,IntentHash,Reason,ReceiptJson,CreatedAtUtc) VALUES(@Operation,NEWID(),N'synthetic063fixture',N'leadership063dual',@AY,REPLICATE('F',64),N'Synthetic concurrent legacy workflow fixture',N'{}',SYSUTCDATETIME());
INSERT paws.TeachingLeadershipGrantSource(ResponsibilityAssigneeId,SourceRoleAssignmentId,ApprovedSourceSignature,ApprovedScopeSignature,ApprovedAssigneeSignature,UsesApprovedDefaultDates,OperationId) VALUES
 (@HAssignee,@HSource,paws_api.TeachingAppointmentAccessSourceStamp(@HSource),paws_api.TeachingResponsibilityAccessScopeStamp(N'leadership063hicc'),paws_api.TeachingAssigneeAccessStamp(@HAssignee),0,@Operation),
 (@VAssignee,@VSource,paws_api.TeachingAppointmentAccessSourceStamp(@VSource),paws_api.TeachingResponsibilityAccessScopeStamp(N'leadership063visc'),paws_api.TeachingAssigneeAccessStamp(@VAssignee),0,@Operation);
UPDATE paws.LeadershipAccessState SET Enabled=1 WHERE SingletonId=1;
INSERT paws.TeachingAssignmentPackage(TeachingAssignmentPackageId,PackageIdentity,AcademicYear,GroupId,HiccResponsibilityId,Status,WorkingRevision) VALUES
 (@Package,CONCAT(N'ta-package-v1__',@AY,N'__leadership063area__leadership063hicc'),@AY,N'leadership063area',N'leadership063hicc',N'draft',0),
 (@OtherPackage,CONCAT(N'ta-package-v1__',@AY,N'__leadership063otherarea__leadership063otherhicc'),@AY,N'leadership063otherarea',N'leadership063otherhicc',N'draft',0);
INSERT paws.Session(SessionId,AcademicYear,CourseId,CourseCode,Topic,SessionType,SessionDate,StartTime,EndTime,SourceImportBatchId) VALUES(@Session,@AY,@Course,N'063SYNTHETIC',N'Synthetic scoped session',N'LEC',@Today,'09:00','10:00',@Batch),(@CrossSession,@AY,@OtherCourse,N'063OTHER',N'Synthetic mixed session',N'LEC',@Today,'11:00','12:00',@Batch);
INSERT paws.TeachingSessionOwnership(SessionOwnershipId,SessionId,AcademicYear,TeachingAssignmentGroupId,ResponsibleHiccResponsibilityId,TeachingAssignmentPackageId)
 VALUES(NEWID(),@Session,@AY,N'leadership063area',N'leadership063hicc',@Package);
IF paws_api.CanActOnTeachingAssignmentPackage(@Package,N'leadership063dual',N'hicc')<>1 OR paws_api.CanActOnTeachingAssignmentPackage(@Package,N'leadership063dual',N'visc')<>1 THROW 54360,'Concurrent Faculty/HICC/VISC authority is unavailable.',1;
IF paws_api.CanActOnTeachingAssignmentPackage(@OtherPackage,N'leadership063dual',N'hicc')<>0 OR paws_api.CanActOnTeachingAssignmentPackage(@OtherPackage,N'leadership063dual',N'visc')<>0 THROW 54360,'Unrelated course/area scope was granted.',1;
IF paws_api.CanActOnTeachingAssignmentPackage(NULL,N'leadership063developer',N'adfad')<>1 THROW 54360,'025 Developer authority regressed.',1;
IF paws_api.CanActOnSessionSwap(@Session,N'leadership063dual',N'visc')<>1 OR paws_api.CanActOnSessionSwap(@CrossSession,N'leadership063dual',N'visc')<>0 THROW 54360,'SWAP lost exact session ownership routing.',1;
PRINT 'SCOPED_WORKFLOW_063_DUAL_SCOPE_SWAP_DEVELOPER';
DECLARE @Epoch varchar(16)=(SELECT authorityVersion FROM paws_api.TeachingAuthorityState()),@CrossOwnership uniqueidentifier=NEWID();
INSERT paws.TeachingSessionOwnership(SessionOwnershipId,SessionId,AcademicYear,TeachingAssignmentGroupId,ResponsibleHiccResponsibilityId,TeachingAssignmentPackageId) VALUES(@CrossOwnership,@CrossSession,@AY,N'leadership063area',N'leadership063hicc',@Package);
IF paws_api.CanActOnTeachingAssignmentPackage(@Package,N'leadership063dual',N'hicc')<>0 OR paws_api.CanActOnTeachingAssignmentPackage(@Package,N'leadership063dual',N'visc')<>0 THROW 54360,'Mixed course package widened authority.',1;
DELETE paws.TeachingSessionOwnership WHERE SessionOwnershipId=@CrossOwnership;
IF @Epoch=(SELECT authorityVersion FROM paws_api.TeachingAuthorityState()) THROW 54360,'Ownership empty/add/remove restored an old authority context.',1;
PRINT 'SCOPED_WORKFLOW_063_MIXED_AND_OWNERSHIP_ABA';
DECLARE @Sessions nvarchar(max)=(SELECT CONVERT(varchar(36),@Session) sessionId,JSON_QUERY(N'[]') assignments FOR JSON PATH);
EXEC paws_api.SaveTeachingAssignmentDraft @Package,0,@Sessions,N'Synthetic current-role draft',N'leadership063dual';
EXEC paws_api.SubmitTeachingAssignmentRevision @Package,1,N'leadership063dual';
DECLARE @Rejected bit=0;
BEGIN TRY EXEC paws_api.RecordTeachingAssignmentReview @Package,1,N'approved',NULL,N'leadership063dual';END TRY BEGIN CATCH IF ERROR_NUMBER()=52133 SET @Rejected=1;ELSE THROW;END CATCH;
IF @Rejected=0 THROW 54360,'Dual-role author approved their own proposal.',1;
EXEC paws_api.RecordTeachingAssignmentReview @Package,1,N'approved',NULL,N'leadership063reviewer';
EXEC paws_api.FinalSubmitTeachingAssignment @Package,1,N'leadership063dual';
IF NOT EXISTS(SELECT 1 FROM paws.TeachingAssignmentPackage WHERE TeachingAssignmentPackageId=@Package AND Status=N'submitted_to_adfad') THROW 54360,'Independent VISC approval flow did not complete.',1;
PRINT 'SCOPED_WORKFLOW_063_SEPARATE_REVIEW_REVISION_FLOW';
UPDATE paws.TeachingResponsibilityAssignee SET ActiveDate=DATEADD(day,-1,@Today),ExpirationDate=@Today WHERE ResponsibilityAssigneeId=@HAssignee;
IF paws_api.CanActOnTeachingAssignmentPackage(@Package,N'leadership063dual',N'hicc')<>0 THROW 54360,'Expired HICC authority remained active.',1;
UPDATE paws.TeachingResponsibilityAssignee SET ActiveDate=@Start,ExpirationDate=@End WHERE ResponsibilityAssigneeId=@HAssignee;
UPDATE paws.Faculty SET Active=0 WHERE FacultyId=@Faculty;
IF paws_api.CanActOnTeachingAssignmentPackage(@Package,N'leadership063dual',N'visc')<>0 THROW 54360,'Deactivated Faculty retained authority.',1;
UPDATE paws.Faculty SET Active=1 WHERE FacultyId=@Faculty;
UPDATE paws.LeadershipAccessState SET Enabled=0 WHERE SingletonId=1;
IF paws_api.CanActOnTeachingAssignmentPackage(@Package,N'leadership063dual',N'hicc')<>0 OR paws_api.CanActOnTeachingAssignmentPackage(@Package,N'leadership063dual',N'visc')<>0 THROW 54360,'Disabled additional authority remained active.',1;
IF paws_api.CanActOnTeachingAssignmentPackage(@Package,N'leadership063reviewer',N'visc')<>1 THROW 54360,'Existing legacy VISC scope regressed.',1;
PRINT 'SCOPED_WORKFLOW_063_EXPIRY_DISABLED_LEGACY';
