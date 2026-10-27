:ON ERROR EXIT
SET NOCOUNT ON;
SET XACT_ABORT ON;
IF DB_NAME()<>N'VetMed-Ops' OR OBJECT_ID(N'dbo.PawsDisposableLeadership061',N'U') IS NULL
 THROW 54160,'Disposable leadership acceptance marker required; never run on the school target.',1;
IF OBJECT_ID(N'paws_api.EffectiveTeachingAssignments',N'IF') IS NULL
 OR COL_LENGTH(N'paws.RoleAppointmentSchedule',N'ScheduleVersion') IS NULL
 OR COL_LENGTH(N'paws.RoleAppointmentSchedule',N'AuthorityVersion') IS NOT NULL
 THROW 54160,'Accepted appointment version must be reused.',1;
IF EXISTS(SELECT 1 FROM paws.LeadershipAccessOperation) OR EXISTS(SELECT 1 FROM paws.TeachingLeadershipGrantSource)
 OR EXISTS(SELECT 1 FROM paws.LeadershipAccessState WHERE Enabled<>0)
 THROW 54160,'Foundation unexpectedly seeded or enabled additional grants.',1;
PRINT 'TEACHING_ACCESS_061_NO_SEED_SCHEDULE_VERSION_REUSED';

DECLARE @Batch uniqueidentifier=NEWID(),@Faculty uniqueidentifier=NEWID(),@Other uniqueidentifier=NEWID(),@Course uniqueidentifier=NEWID(),
 @HiccSource uniqueidentifier=NEWID(),@ViscSource uniqueidentifier=NEWID(),@HiccAssignee uniqueidentifier=NEWID(),@ViscAssignee uniqueidentifier=NEWID(),
 @LegacyAssignee uniqueidentifier=NEWID(),@Operation uniqueidentifier=NEWID();
INSERT staging.ImportBatch(ImportBatchId,StartedAtUtc,Status,SourceManifestSha256,ImporterVersion,ValidationSummaryJson)
 VALUES(@Batch,SYSUTCDATETIME(),N'synthetic',REPLICATE('A',64),N'leadership061',N'{}');
INSERT paws.Faculty(FacultyId,RecordType,DisplayName,Active,SourceImportBatchId) VALUES
 (@Faculty,N'faculty',N'Taylor Example',1,@Batch),(@Other,N'faculty',N'Morgan Example',1,@Batch);
INSERT paws.Course(CourseId,CourseCode,CourseName,SourceImportBatchId) VALUES(@Course,N'061-SYNTHETIC',N'Synthetic authority course',@Batch);
INSERT paws.UserProfile(FirebaseUid,Email,DisplayName,BaseRole,FacultyId,Active,MustChangePassword) VALUES
 (N'leadership061-faculty',N'faculty@example.test',N'Taylor Example',N'faculty',@Faculty,1,0),
 (N'leadership061-legacy',N'legacy@example.test',N'Morgan Example',N'hicc',@Other,1,0);
INSERT paws.TeachingResponsibility(ResponsibilityId,Kind,Label,Active) VALUES
 (N'leadership061-hicc',N'hicc',N'Synthetic HICC',1),(N'leadership061-visc',N'visc',N'Synthetic VISC',1);
INSERT paws.TeachingResponsibilityScope(ResponsibilityScopeId,HiccResponsibilityId,CourseId)
 VALUES(NEWID(),N'leadership061-hicc',@Course);
INSERT paws.TeachingAssignmentGroup(GroupId,Name,LeaderViscResponsibilityId,Active)
 VALUES(N'leadership061-area',N'Synthetic area',N'leadership061-visc',1);
INSERT paws.TeachingAssignmentGroupHicc(GroupId,HiccResponsibilityId) VALUES(N'leadership061-area',N'leadership061-hicc');
INSERT paws.TeachingResponsibilityAssignee(ResponsibilityAssigneeId,ResponsibilityId,AcademicYear,FacultyId,ActiveDate,ExpirationDate,AssignmentMode) VALUES
 (@HiccAssignee,N'leadership061-hicc',N'2026-27',@Faculty,'20260501','20270501',N'concurrent'),
 (@ViscAssignee,N'leadership061-visc',N'2026-27',@Faculty,'20260501','20270501',N'exclusive'),
 (@LegacyAssignee,N'leadership061-hicc',N'2026-27',@Other,'20260501','20270501',N'concurrent');
IF EXISTS(SELECT 1 FROM paws_api.EffectiveTeachingAssignments(N'leadership061-faculty',N'2026-27','20261027'))
 THROW 54160,'Unapproved assignees added authority to a Faculty profile.',1;
IF (SELECT COUNT(*) FROM paws_api.EffectiveTeachingAssignments(N'leadership061-legacy',N'2026-27','20261027'))<>1
 THROW 54160,'Existing same-kind legacy authority was removed.',1;
UPDATE paws.LeadershipAccessState SET Enabled=1 WHERE SingletonId=1;
IF EXISTS(SELECT 1 FROM paws_api.EffectiveTeachingAssignments(N'leadership061-faculty',N'2026-27','20261027'))
 THROW 54160,'Enabled state alone activated unapproved legacy mappings.',1;
PRINT 'TEACHING_ACCESS_061_EXPLICIT_SOURCE_AND_LEGACY_BOUNDARIES';

INSERT paws.RoleAssignment(RoleAssignmentId,FacultyId,FacultyResolutionStatus,AcademicYear,RoleType,CourseId,CourseOrSubjectOrRotation,SourceImportBatchId,SourceRow) VALUES
 (@HiccSource,@Faculty,N'resolved',N'2026-27',N'Course Coordinator',@Course,N'Synthetic canonical course',@Batch,1),
 (@ViscSource,@Faculty,N'resolved',N'2026-27',N'VISC',NULL,N'Synthetic canonical area',@Batch,2);
INSERT paws.RoleAppointmentSchedule(RoleAssignmentId,PeriodsJson,UpdatedAtUtc,UpdatedByFirebaseUid)
 VALUES(@ViscSource,N'[{"startDate":"2026-05-01","endDate":"2027-04-30"}]',SYSUTCDATETIME(),N'leadership061-fixture');
-- Synthetic source-link fixture exercises only the reader foundation. The Owner
-- grant command and its independent transaction/audit acceptance follow separately.
INSERT paws.LeadershipAccessOperation(OperationId,PreviewId,ActorUid,TargetUid,AcademicYear,IntentHash,Reason,ReceiptJson,CreatedAtUtc)
 VALUES(@Operation,NEWID(),N'leadership061-fixture',N'leadership061-faculty',N'2026-27',REPLICATE('A',64),N'Synthetic reader foundation fixture',N'{}',SYSUTCDATETIME());
INSERT paws.TeachingLeadershipGrantSource(ResponsibilityAssigneeId,SourceRoleAssignmentId,ApprovedSourceSignature,UsesApprovedDefaultDates,OperationId) VALUES
 (@HiccAssignee,@HiccSource,paws_api.TeachingAppointmentAccessSourceStamp(@HiccSource),1,@Operation),
 (@ViscAssignee,@ViscSource,paws_api.TeachingAppointmentAccessSourceStamp(@ViscSource),0,@Operation);
IF (SELECT COUNT(*) FROM paws_api.EffectiveTeachingAssignments(N'leadership061-faculty',N'2026-27','20261027'))<>2
 THROW 54160,'Approved concurrent HICC/VISC roles were not returned.',1;
IF NOT EXISTS(SELECT 1 FROM paws.UserProfile WHERE FirebaseUid=N'leadership061-faculty' AND BaseRole=N'faculty')
 THROW 54160,'Additional authority rewrote the Faculty base role.',1;
IF NOT EXISTS(SELECT 1 FROM paws_api.EffectiveTeachingAssignments(N'leadership061-faculty',N'2026-27','20261027')
 WHERE kind=N'hicc' AND JSON_VALUE(coursesJson,'$[0].courseId')=CONVERT(varchar(36),@Course) AND groupsJson=N'[]')
 OR NOT EXISTS(SELECT 1 FROM paws_api.EffectiveTeachingAssignments(N'leadership061-faculty',N'2026-27','20261027')
 WHERE kind=N'visc' AND JSON_VALUE(groupsJson,'$[0].groupId')=N'leadership061-area' AND coursesJson=N'[]')
 THROW 54160,'Canonical course and area descriptors are incorrect.',1;
IF EXISTS(SELECT 1 FROM paws_api.EffectiveTeachingAssignments(N'leadership061-faculty',N'2026-27','20270501'))
 OR EXISTS(SELECT 1 FROM paws_api.EffectiveTeachingAssignments(N'leadership061-faculty',N'2026-27','20260430'))
 OR EXISTS(SELECT 1 FROM paws_api.EffectiveTeachingAssignments(N'leadership061-faculty',N'2025-26','20261027'))
 OR (SELECT COUNT(*) FROM paws_api.EffectiveTeachingAssignments(N'leadership061-faculty',N'2026-27','20270430'))<>2
 THROW 54160,'Academic year or half-open authority dates were not enforced.',1;
PRINT 'TEACHING_ACCESS_061_DUAL_ROLE_SCOPE_AND_DATES';

DECLARE @Epoch varchar(16)=(SELECT authorityVersion FROM paws_api.TeachingAuthorityState()),@Definition varchar(64);
SELECT @Definition=definitionVersion FROM paws_api.EffectiveTeachingAssignments(N'leadership061-faculty',N'2026-27','20261027') WHERE kind=N'hicc';
UPDATE paws.TeachingResponsibility SET Label=N'Changed synthetic label' WHERE ResponsibilityId=N'leadership061-hicc';
UPDATE paws.TeachingResponsibility SET Label=N'Synthetic HICC' WHERE ResponsibilityId=N'leadership061-hicc';
IF @Epoch=(SELECT authorityVersion FROM paws_api.TeachingAuthorityState())
 OR @Definition=(SELECT definitionVersion FROM paws_api.EffectiveTeachingAssignments(N'leadership061-faculty',N'2026-27','20261027') WHERE kind=N'hicc')
 THROW 54160,'Definition A-B-A restored an obsolete version.',1;
SET @Epoch=(SELECT authorityVersion FROM paws_api.TeachingAuthorityState());
DELETE paws.TeachingAssignmentGroupHicc WHERE GroupId=N'leadership061-area';
INSERT paws.TeachingAssignmentGroupHicc(GroupId,HiccResponsibilityId) VALUES(N'leadership061-area',N'leadership061-hicc');
IF @Epoch=(SELECT authorityVersion FROM paws_api.TeachingAuthorityState()) THROW 54160,'Deleted/recreated scope restored an old epoch.',1;
SET @Epoch=(SELECT authorityVersion FROM paws_api.TeachingAuthorityState());
UPDATE paws.RoleAppointmentSchedule SET PeriodsJson=PeriodsJson WHERE RoleAssignmentId=@ViscSource;
IF @Epoch=(SELECT authorityVersion FROM paws_api.TeachingAuthorityState()) THROW 54160,'Existing schedule writes did not invalidate authority context.',1;
IF (SELECT COUNT(*) FROM paws_api.EffectiveTeachingAssignments(N'leadership061-faculty',N'2026-27','20261027'))<>2
 THROW 54160,'Unchanged appointment facts revoked an approved grant.',1;
PRINT 'TEACHING_ACCESS_061_SCOPE_SCHEDULE_ABA_EPOCH';

UPDATE paws.RoleAssignment SET CourseId=NULL WHERE RoleAssignmentId=@HiccSource;
IF EXISTS(SELECT 1 FROM paws_api.EffectiveTeachingAssignments(N'leadership061-faculty',N'2026-27','20261027') WHERE kind=N'hicc')
 THROW 54160,'Changed source course retained its old approval.',1;
UPDATE paws.RoleAssignment SET CourseId=@Course WHERE RoleAssignmentId=@HiccSource;
UPDATE paws.Faculty SET Active=0 WHERE FacultyId=@Faculty;
IF EXISTS(SELECT 1 FROM paws_api.EffectiveTeachingAssignments(N'leadership061-faculty',N'2026-27','20261027')) THROW 54160,'Inactive Faculty retained authority.',1;
UPDATE paws.Faculty SET Active=1 WHERE FacultyId=@Faculty;
UPDATE paws.UserProfile SET MustChangePassword=1 WHERE FirebaseUid=N'leadership061-faculty';
IF EXISTS(SELECT 1 FROM paws_api.EffectiveTeachingAssignments(N'leadership061-faculty',N'2026-27','20261027')) THROW 54160,'Password-required profile retained authority.',1;
UPDATE paws.UserProfile SET MustChangePassword=0 WHERE FirebaseUid=N'leadership061-faculty';
UPDATE paws.LeadershipAccessState SET Enabled=0 WHERE SingletonId=1;
IF EXISTS(SELECT 1 FROM paws_api.EffectiveTeachingAssignments(N'leadership061-faculty',N'2026-27','20261027')) THROW 54160,'Disabled additional-role state retained authority.',1;
PRINT 'TEACHING_ACCESS_061_SOURCE_PROFILE_REVOCATION';
