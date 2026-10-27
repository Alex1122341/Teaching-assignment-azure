:ON ERROR EXIT
SET NOCOUNT ON;
SET XACT_ABORT ON;
IF DB_NAME()<>N'VetMed-Ops' OR OBJECT_ID(N'dbo.PawsDisposableLeadership061',N'U') IS NULL
 THROW 54260,'Disposable leadership command marker required.',1;
IF OBJECT_ID(N'paws_api.SetTeachingLeadershipAccess',N'P') IS NULL
 OR OBJECT_ID(N'paws_api.GetTeachingLeadershipAccessSnapshot',N'P') IS NULL
 OR OBJECT_ID(N'paws_api.GetTeachingLeadershipAccessOperation',N'P') IS NULL
 THROW 54260,'Versioned Owner leadership command is missing.',1;
GO
DECLARE @Batch uniqueidentifier=NEWID(),@Faculty uniqueidentifier=NEWID(),@Other uniqueidentifier=NEWID(),@Course uniqueidentifier=NEWID(),@Source uniqueidentifier=NEWID();
INSERT staging.ImportBatch(ImportBatchId,StartedAtUtc,Status,SourceManifestSha256,ImporterVersion,ValidationSummaryJson) VALUES(@Batch,SYSUTCDATETIME(),N'synthetic',REPLICATE('B',64),N'leadership062',N'{}');
INSERT paws.Faculty(FacultyId,RecordType,DisplayName,Active,SourceImportBatchId) VALUES(@Faculty,N'faculty',N'Riley Example',1,@Batch),(@Other,N'faculty',N'Casey Example',1,@Batch);
INSERT paws.Course(CourseId,CourseCode,CourseName,SourceImportBatchId) VALUES(@Course,N'062SYNTHETIC',N'Synthetic leadership command course',@Batch);
INSERT paws.UserProfile(FirebaseUid,Email,DisplayName,BaseRole,FacultyId,Active,MustChangePassword) VALUES
 (N'leadership062owner',N'owner062@example.test',N'Synthetic Owner',N'owner',NULL,1,0),
 (N'leadership062admin',N'admin062@example.test',N'Synthetic Admin',N'administrator',NULL,1,0),
 (N'leadership062target',N'target062@example.test',N'Riley Example',N'faculty',@Faculty,1,0),
 (N'leadership062developer',N'developer062@example.test',N'Synthetic Developer',N'developer',NULL,1,0);
INSERT paws.TeachingResponsibility(ResponsibilityId,Kind,Label,Active) VALUES(N'leadership062hicc',N'hicc',N'Synthetic command HICC',1);
INSERT paws.TeachingResponsibilityScope(ResponsibilityScopeId,HiccResponsibilityId,CourseId) VALUES(NEWID(),N'leadership062hicc',@Course);
INSERT paws.RoleAssignment(RoleAssignmentId,FacultyId,FacultyResolutionStatus,AcademicYear,RoleType,CourseId,CourseOrSubjectOrRotation,SourceImportBatchId,SourceRow)
 VALUES(@Source,@Faculty,N'resolved',N'2026-27',N'Course Coordinator',@Course,N'Synthetic canonical course',@Batch,1);
DECLARE @ActorVersion varchar(16)=(SELECT LOWER(CONVERT(varchar(16),CONVERT(binary(8),AccessVersion),2)) FROM paws.UserProfile WHERE FirebaseUid=N'leadership062owner'),
 @TargetVersion varchar(16)=(SELECT LOWER(CONVERT(varchar(16),CONVERT(binary(8),AccessVersion),2)) FROM paws.UserProfile WHERE FirebaseUid=N'leadership062target'),
 @Epoch varchar(16)=(SELECT authorityVersion FROM paws_api.TeachingAuthorityState()),@Operation uniqueidentifier=NEWID(),@Preview uniqueidentifier=NEWID(),@Hash char(64)=REPLICATE('C',64),@Changes nvarchar(max);
-- The independently derived definition token binds the exact epoch and stable ID.
SET @Changes=(SELECT N'grant' action,N'leadership062hicc' responsibilityId,N'hicc' kind,
 LOWER(CONVERT(varchar(64),HASHBYTES('SHA2_256',CONCAT(N'leadership062|',@Epoch,N'|leadership062hicc')),2)) definitionVersion,
 CONVERT(varchar(36),@Source) sourceRoleAssignmentId,
 (SELECT LOWER(CONVERT(varchar(16),CONVERT(binary(8),AuthorityVersion),2)) FROM paws.RoleAssignment WHERE RoleAssignmentId=@Source) sourceVersion,
 CAST(NULL AS varchar(16)) sourceScheduleVersion,LOWER(paws_api.TeachingAppointmentAccessSourceStamp(@Source)) sourceSignature,
 N'Synthetic canonical course' recordedScope,N'2026-05-01' startDate,N'2027-05-01' endExclusive,
 CAST(1 AS bit) usesApprovedDefaultDates,N'exclusive' assignmentMode,
 JSON_QUERY((SELECT CONVERT(varchar(36),@Course) courseId,N'062SYNTHETIC' courseCode FOR JSON PATH)) courses,JSON_QUERY(N'[]') groups
 FOR JSON PATH,INCLUDE_NULL_VALUES);
EXEC paws_api.SetTeachingLeadershipAccess N'leadership062owner',@ActorVersion,N'leadership062target',@TargetVersion,N'2026-27',@Epoch,@Changes,N'Synthetic approved scoped grant',@Hash,@Operation,@Preview;
IF (SELECT COUNT(*) FROM paws.LeadershipAccessOperation WHERE OperationId=@Operation)<>1 OR (SELECT COUNT(*) FROM paws.AuditEvent WHERE EventType=N'leadership_access_change' AND RequestId=@Operation)<>1 THROW 54260,'Grant did not persist exactly one operation and audit.',1;
DECLARE @Assignee uniqueidentifier=(SELECT a.ResponsibilityAssigneeId FROM paws.TeachingResponsibilityAssignee a JOIN paws.TeachingLeadershipGrantSource s ON s.ResponsibilityAssigneeId=a.ResponsibilityAssigneeId WHERE a.FacultyId=@Faculty AND s.OperationId=@Operation);
IF @Assignee IS NULL OR NOT EXISTS(SELECT 1 FROM paws.TeachingResponsibilityAssignee WHERE ResponsibilityAssigneeId=@Assignee AND ActiveDate='20260501' AND ExpirationDate='20270501' AND AssignmentMode=N'exclusive') THROW 54260,'Exact assignee dates/mode not persisted.',1;
IF NOT EXISTS(SELECT 1 FROM paws.UserProfile WHERE FirebaseUid=N'leadership062target' AND BaseRole=N'faculty' AND LOWER(CONVERT(varchar(16),CONVERT(binary(8),AccessVersion),2))=@TargetVersion) THROW 54260,'Leadership command replaced Faculty or its account version.',1;
EXEC paws_api.SetTeachingLeadershipAccess N'leadership062owner',@ActorVersion,N'leadership062target',@TargetVersion,N'2026-27',@Epoch,@Changes,N'Synthetic approved scoped grant',@Hash,@Operation,@Preview;
IF (SELECT COUNT(*) FROM paws.AuditEvent WHERE RequestId=@Operation)<>1 THROW 54260,'Retry duplicated grant audit.',1;
DECLARE @Rejected bit=0,@OtherHash char(64)=REPLICATE('D',64);
BEGIN TRY EXEC paws_api.SetTeachingLeadershipAccess N'leadership062owner',@ActorVersion,N'leadership062target',@TargetVersion,N'2026-27',@Epoch,@Changes,N'Synthetic different intent',@OtherHash,@Operation,@Preview;END TRY BEGIN CATCH IF ERROR_NUMBER()=54108 SET @Rejected=1;ELSE THROW;END CATCH;
IF @Rejected=0 THROW 54260,'Conflicting operation replay was accepted.',1;
EXEC paws_api.GetTeachingLeadershipAccessOperation N'leadership062owner',@Operation;
EXEC paws_api.GetTeachingLeadershipAccessSnapshot N'leadership062owner',N'leadership062target',N'2026-27';
PRINT 'LEADERSHIP_COMMAND_062_PERSISTED_REPLAY_AUDIT';

SET @Rejected=0;SET @Operation=NEWID();
BEGIN TRY EXEC paws_api.SetTeachingLeadershipAccess N'leadership062owner',@ActorVersion,N'leadership062target',@TargetVersion,N'2026-27',@Epoch,@Changes,N'Synthetic stale epoch',@Hash,@Operation,@Preview;END TRY BEGIN CATCH IF ERROR_NUMBER()=54103 SET @Rejected=1;ELSE THROW;END CATCH;
IF @Rejected=0 THROW 54260,'Stale authority epoch accepted.',1;
SET @Epoch=(SELECT authorityVersion FROM paws_api.TeachingAuthorityState());
UPDATE paws.TeachingResponsibility SET Label=N'B' WHERE ResponsibilityId=N'leadership062hicc';
UPDATE paws.TeachingResponsibility SET Label=N'Synthetic command HICC' WHERE ResponsibilityId=N'leadership062hicc';
SET @Rejected=0;
BEGIN TRY EXEC paws_api.SetTeachingLeadershipAccess N'leadership062owner',@ActorVersion,N'leadership062target',@TargetVersion,N'2026-27',@Epoch,@Changes,N'Synthetic ABA epoch',@Hash,@Operation,@Preview;END TRY BEGIN CATCH IF ERROR_NUMBER()=54103 SET @Rejected=1;ELSE THROW;END CATCH;
IF @Rejected=0 THROW 54260,'Authority ABA restored an old preview.',1;
PRINT 'LEADERSHIP_COMMAND_062_STALE_ABA_DENIED';

SET @Epoch=(SELECT authorityVersion FROM paws_api.TeachingAuthorityState());
DECLARE @Revoke nvarchar(max)=(SELECT N'revoke' action,CONVERT(varchar(36),@Assignee) assignmentId,
 LOWER(CONVERT(varchar(16),CONVERT(binary(8),AuthorityVersion),2)) expectedVersion,N'leadership062hicc' responsibilityId FROM paws.TeachingResponsibilityAssignee WHERE ResponsibilityAssigneeId=@Assignee FOR JSON PATH);
DECLARE @AdminVersion varchar(16)=(SELECT LOWER(CONVERT(varchar(16),CONVERT(binary(8),AccessVersion),2)) FROM paws.UserProfile WHERE FirebaseUid=N'leadership062admin');
SET @Rejected=0;
BEGIN TRY EXEC paws_api.SetTeachingLeadershipAccess N'leadership062admin',@AdminVersion,N'leadership062target',@TargetVersion,N'2026-27',@Epoch,@Revoke,N'Forbidden admin',@Hash,@Operation,@Preview;END TRY BEGIN CATCH IF ERROR_NUMBER()=54101 SET @Rejected=1;ELSE THROW;END CATCH;
IF @Rejected=0 THROW 54260,'Administrator changed leadership authority.',1;
SET @Changes=JSON_MODIFY(@Changes,'$[0].definitionVersion',LOWER(CONVERT(varchar(64),HASHBYTES('SHA2_256',CONCAT(N'leadership062|',@Epoch,N'|leadership062hicc')),2)));
DECLARE @Replacement nvarchar(max)=JSON_MODIFY(@Changes,'append $',JSON_QUERY((SELECT N'revoke' action,CONVERT(varchar(36),@Assignee) assignmentId,
 LOWER(CONVERT(varchar(16),CONVERT(binary(8),AuthorityVersion),2)) expectedVersion,N'leadership062hicc' responsibilityId FROM paws.TeachingResponsibilityAssignee WHERE ResponsibilityAssigneeId=@Assignee FOR JSON PATH,WITHOUT_ARRAY_WRAPPER))),@Fault nvarchar(max);
-- The existing exclusive assignee must block another grant even to the same person.
SET @Rejected=0;
BEGIN TRY EXEC paws_api.SetTeachingLeadershipAccess N'leadership062owner',@ActorVersion,N'leadership062target',@TargetVersion,N'2026-27',@Epoch,@Changes,N'Synthetic duplicate overlap',@Hash,@Operation,@Preview;END TRY BEGIN CATCH IF ERROR_NUMBER()=54105 SET @Rejected=1;ELSE THROW;END CATCH;
IF @Rejected=0 THROW 54260,'Overlapping authority was accepted.',1;
SET @Fault=JSON_MODIFY(@Replacement,'$[0].sourceSignature',REPLICATE('0',64));SET @Rejected=0;
BEGIN TRY EXEC paws_api.SetTeachingLeadershipAccess N'leadership062owner',@ActorVersion,N'leadership062target',@TargetVersion,N'2026-27',@Epoch,@Fault,N'Synthetic invalid source evidence',@Hash,@Operation,@Preview;END TRY BEGIN CATCH IF ERROR_NUMBER()=54104 SET @Rejected=1;ELSE THROW;END CATCH;
IF @Rejected=0 THROW 54260,'Changed source proof was accepted.',1;
SET @Fault=JSON_MODIFY(@Replacement,'$[0].courses[0].courseId',CONVERT(varchar(36),@Other));SET @Rejected=0;
BEGIN TRY EXEC paws_api.SetTeachingLeadershipAccess N'leadership062owner',@ActorVersion,N'leadership062target',@TargetVersion,N'2026-27',@Epoch,@Fault,N'Synthetic forged course scope',@Hash,@Operation,@Preview;END TRY BEGIN CATCH IF ERROR_NUMBER()=54104 SET @Rejected=1;ELSE THROW;END CATCH;
IF @Rejected=0 THROW 54260,'Forged canonical course was accepted.',1;
SET @Fault=JSON_MODIFY(@Replacement,'$[0].startDate',N'2026-06-01');SET @Rejected=0;
BEGIN TRY EXEC paws_api.SetTeachingLeadershipAccess N'leadership062owner',@ActorVersion,N'leadership062target',@TargetVersion,N'2026-27',@Epoch,@Fault,N'Synthetic partial-year default',@Hash,@Operation,@Preview;END TRY BEGIN CATCH IF ERROR_NUMBER()=54104 SET @Rejected=1;ELSE THROW;END CATCH;
IF @Rejected=0 THROW 54260,'Partial default window was accepted.',1;
SET @Fault=JSON_MODIFY(@Replacement,'$[0].endExclusive',N'2027-06-01');SET @Rejected=0;
BEGIN TRY EXEC paws_api.SetTeachingLeadershipAccess N'leadership062owner',@ActorVersion,N'leadership062target',@TargetVersion,N'2026-27',@Epoch,@Fault,N'Synthetic outside academic year',@Hash,@Operation,@Preview;END TRY BEGIN CATCH IF ERROR_NUMBER()=54107 SET @Rejected=1;ELSE THROW;END CATCH;
IF @Rejected=0 THROW 54260,'Cross-year dates were accepted.',1;
SET @Fault=JSON_MODIFY(@Revoke,'$[0].expectedVersion',N'0000000000000000');SET @Rejected=0;
BEGIN TRY EXEC paws_api.SetTeachingLeadershipAccess N'leadership062owner',@ActorVersion,N'leadership062target',@TargetVersion,N'2026-27',@Epoch,@Fault,N'Synthetic stale assignee',@Hash,@Operation,@Preview;END TRY BEGIN CATCH IF ERROR_NUMBER()=54109 SET @Rejected=1;ELSE THROW;END CATCH;
IF @Rejected=0 THROW 54260,'Stale managed assignee was accepted.',1;
PRINT 'LEADERSHIP_COMMAND_062_SCOPE_SOURCE_DATES_OVERLAP_DENIED';
DECLARE @DeveloperVersion varchar(16)=(SELECT LOWER(CONVERT(varchar(16),CONVERT(binary(8),AccessVersion),2)) FROM paws.UserProfile WHERE FirebaseUid=N'leadership062developer');
SET @Rejected=0;
BEGIN TRY EXEC paws_api.SetTeachingLeadershipAccess N'leadership062owner',@ActorVersion,N'leadership062developer',@DeveloperVersion,N'2026-27',@Epoch,@Changes,N'Forbidden Developer grant',@Hash,@Operation,@Preview;END TRY BEGIN CATCH IF ERROR_NUMBER()=54106 SET @Rejected=1;ELSE THROW;END CATCH;
IF @Rejected=0 THROW 54260,'Protected Developer accepted a leadership grant.',1;
SET @Fault=JSON_MODIFY(@Replacement,'$[0].assignmentMode',NULL);SET @Rejected=0;
BEGIN TRY EXEC paws_api.SetTeachingLeadershipAccess N'leadership062owner',@ActorVersion,N'leadership062target',@TargetVersion,N'2026-27',@Epoch,@Fault,N'Synthetic missing mode',@Hash,@Operation,@Preview;END TRY BEGIN CATCH IF ERROR_NUMBER()=54107 SET @Rejected=1;ELSE THROW;END CATCH;
IF @Rejected=0 THROW 54260,'A missing mode bypassed canonical validation.',1;
SET @Rejected=0;
BEGIN TRY EXEC paws_api.SetTeachingLeadershipAccess N'leadership062owner',@ActorVersion,N'leadership062target',@TargetVersion,NULL,@Epoch,@Replacement,N'Synthetic missing year',@Hash,@Operation,@Preview;END TRY BEGIN CATCH IF ERROR_NUMBER()=54107 SET @Rejected=1;ELSE THROW;END CATCH;
IF @Rejected=0 THROW 54260,'A missing year bypassed canonical validation.',1;
PRINT 'LEADERSHIP_COMMAND_062_PROTECTED_AND_NULL_INPUT_DENIED';
-- Recorded schedules must cover every requested day, not merely both endpoints.
INSERT paws.RoleAppointmentSchedule(RoleAssignmentId,PeriodsJson,UpdatedAtUtc,UpdatedByFirebaseUid) VALUES(@Source,N'[{"startDate":"2026-05-01","endDate":"2026-08-31"},{"startDate":"2026-10-01","endDate":"2027-04-30"}]',SYSUTCDATETIME(),N'leadership062owner');
SET @Epoch=(SELECT authorityVersion FROM paws_api.TeachingAuthorityState());
SET @Fault=JSON_MODIFY(@Replacement,'$[0].definitionVersion',LOWER(CONVERT(varchar(64),HASHBYTES('SHA2_256',CONCAT(N'leadership062|',@Epoch,N'|leadership062hicc')),2)));
SET @Fault=JSON_MODIFY(@Fault,'$[0].usesApprovedDefaultDates',CAST(0 AS bit));
SET @Fault=JSON_MODIFY(@Fault,'$[0].sourceScheduleVersion',(SELECT LOWER(CONVERT(varchar(16),CONVERT(binary(8),ScheduleVersion),2)) FROM paws.RoleAppointmentSchedule WHERE RoleAssignmentId=@Source));
SET @Fault=JSON_MODIFY(@Fault,'$[0].sourceSignature',LOWER(paws_api.TeachingAppointmentAccessSourceStamp(@Source)));SET @Rejected=0;
BEGIN TRY EXEC paws_api.SetTeachingLeadershipAccess N'leadership062owner',@ActorVersion,N'leadership062target',@TargetVersion,N'2026-27',@Epoch,@Fault,N'Synthetic uncovered schedule gap',@Hash,@Operation,@Preview;END TRY BEGIN CATCH IF ERROR_NUMBER()=54104 SET @Rejected=1;ELSE THROW;END CATCH;
IF @Rejected=0 THROW 54260,'Uncovered source schedule gap was accepted.',1;
DELETE paws.RoleAppointmentSchedule WHERE RoleAssignmentId=@Source;
SET @Epoch=(SELECT authorityVersion FROM paws_api.TeachingAuthorityState());
SET @Replacement=JSON_MODIFY(@Replacement,'$[0].definitionVersion',LOWER(CONVERT(varchar(64),HASHBYTES('SHA2_256',CONCAT(N'leadership062|',@Epoch,N'|leadership062hicc')),2)));
UPDATE paws.UserProfile SET BaseRole=BaseRole WHERE FirebaseUid=N'leadership062owner';SET @Rejected=0;
BEGIN TRY EXEC paws_api.SetTeachingLeadershipAccess N'leadership062owner',@ActorVersion,N'leadership062target',@TargetVersion,N'2026-27',@Epoch,@Revoke,N'Synthetic Owner version changed',@Hash,@Operation,@Preview;END TRY BEGIN CATCH IF ERROR_NUMBER()=54101 SET @Rejected=1;ELSE THROW;END CATCH;
IF @Rejected=0 THROW 54260,'Changed Owner version was accepted.',1;
SET @ActorVersion=(SELECT LOWER(CONVERT(varchar(16),CONVERT(binary(8),AccessVersion),2)) FROM paws.UserProfile WHERE FirebaseUid=N'leadership062owner');
PRINT 'LEADERSHIP_COMMAND_062_RECORDED_GAP_AND_ACTOR_CHANGED_DENIED';
-- A later audit failure must restore assignee/source link and leave no operation.
EXEC(N'CREATE TRIGGER paws.RejectLeadership062Audit ON paws.AuditEvent AFTER INSERT AS BEGIN IF EXISTS(SELECT 1 FROM inserted WHERE EventType=N''leadership_access_change'') THROW 54261,''Synthetic leadership audit failure.'',1; END;');
SET @Rejected=0;SET @Operation=NEWID();
BEGIN TRY EXEC paws_api.SetTeachingLeadershipAccess N'leadership062owner',@ActorVersion,N'leadership062target',@TargetVersion,N'2026-27',@Epoch,@Replacement,N'Synthetic rollback replacement',@Hash,@Operation,@Preview;END TRY BEGIN CATCH IF ERROR_NUMBER()=54261 SET @Rejected=1;ELSE THROW;END CATCH;
IF @Rejected=0 OR NOT EXISTS(SELECT 1 FROM paws.TeachingResponsibilityAssignee WHERE ResponsibilityAssigneeId=@Assignee) OR NOT EXISTS(SELECT 1 FROM paws.TeachingLeadershipGrantSource WHERE ResponsibilityAssigneeId=@Assignee) OR EXISTS(SELECT 1 FROM paws.LeadershipAccessOperation WHERE OperationId=@Operation) THROW 54260,'Audit failure left a partial revoke.',1;
DROP TRIGGER paws.RejectLeadership062Audit;
SET @Epoch=(SELECT authorityVersion FROM paws_api.TeachingAuthorityState());SET @Operation=NEWID();
EXEC paws_api.SetTeachingLeadershipAccess N'leadership062owner',@ActorVersion,N'leadership062target',@TargetVersion,N'2026-27',@Epoch,@Revoke,N'Synthetic approved revoke',@Hash,@Operation,@Preview;
IF EXISTS(SELECT 1 FROM paws.TeachingResponsibilityAssignee WHERE ResponsibilityAssigneeId=@Assignee) OR EXISTS(SELECT 1 FROM paws.TeachingLeadershipGrantSource WHERE ResponsibilityAssigneeId=@Assignee) THROW 54260,'Approved exact revoke did not remove current grant.',1;
IF NOT EXISTS(SELECT 1 FROM paws.LeadershipAccessOperation WHERE TargetUid=N'leadership062target' AND OperationId<>@Operation) THROW 54260,'Revocation removed historical grant receipt.',1;
PRINT 'LEADERSHIP_COMMAND_062_OWNER_ATOMIC_REVOKE';
