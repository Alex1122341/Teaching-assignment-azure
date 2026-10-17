/* Synthetic disposable-database acceptance. Runner rejects remote/live hosts. */
:ON ERROR EXIT
SET NOCOUNT ON;
SET XACT_ABORT ON;
IF DB_NAME()<>N'VetMed-Ops' OR USER_ID(N'paws-calendar-test-runtime') IS NULL
 THROW 54790,'Synthetic history acceptance prerequisites are missing.',1;
IF EXISTS(SELECT 1 FROM paws.ChangeHistoryContext WHERE AuditEventId='ffffffff-ffff-4fff-8fff-ffffffffffff')
 THROW 54790,'Old audit was backfilled with current relationships.',1;
BEGIN TRANSACTION;
DECLARE @Batch uniqueidentifier=NEWID(),@A uniqueidentifier=NEWID(),@B uniqueidentifier=NEWID(),@Session uniqueidentifier=NEWID(),@Second uniqueidentifier=NEWID();
DECLARE @One uniqueidentifier=NEWID(),@Two uniqueidentifier=NEWID(),@Replacement uniqueidentifier=NEWID(),@Private uniqueidentifier=NEWID();
INSERT staging.ImportBatch(ImportBatchId,StartedAtUtc,Status,SourceManifestSha256,ImporterVersion,ValidationSummaryJson)
VALUES(@Batch,SYSUTCDATETIME(),N'completed',REPLICATE('A',64),N'synthetic-history',N'{}');
INSERT paws.Faculty(FacultyId,RecordType,DisplayName,Active,SourceImportBatchId)
VALUES(@A,N'faculty',N'Synthetic A',1,@Batch),(@B,N'faculty',N'Synthetic B',1,@Batch);
INSERT paws.SwapCandidate(FacultyId) VALUES(@A),(@B);
INSERT paws.UserProfile(FirebaseUid,Email,DisplayName,BaseRole,FacultyId,Active,MustChangePassword)
VALUES(N'history-test-a',N'history-a@example.test',N'A',N'faculty',@A,1,0),
(N'history-test-b',N'history-b@example.test',N'B',N'faculty',@B,1,0),
(N'history-test-admin',N'history-admin@example.test',N'Admin',N'owner',NULL,1,0),
(N'history-test-disabled',N'history-disabled@example.test',N'Disabled',N'faculty',@A,0,0);
INSERT paws.Session(SessionId,AcademicYear,CourseCode,Topic,SessionType,SessionDate,SourceImportBatchId)
VALUES(@Session,N'2026-27',N'206',N'Synthetic history lab',N'LAB','2026-10-16',@Batch),(@Second,N'2026-27',N'207',N'Synthetic second',N'LEC','2026-10-16',@Batch);
INSERT paws.SessionAssignment(SessionAssignmentId,SessionId,FacultyId,SourceFacultyName,FacultyResolutionStatus,TeachingRole,SourceImportBatchId,SourceRow)
VALUES(NEWID(),@Session,@A,N'Synthetic A',N'resolved',N'Lead',@Batch,1);
INSERT paws.AuditEvent(AuditEventId,EventType,EntityType,EntityId,OccurredAtUtc,BeforeJson,AfterJson)
VALUES(@One,N'session_updated',N'session',CONVERT(nvarchar(36),@Session),'2026-10-16T10:00:00',N'{"room":"A"}',N'{"room":"B"}'),
(@Two,N'session_created',N'session',CONVERT(nvarchar(36),@Second),'2026-10-16T10:01:00',NULL,N'{"courseCode":"207"}');
IF (SELECT COUNT(*) FROM paws.ChangeHistoryContext WHERE AuditEventId IN(@One,@Two))<>2 THROW 54790,'Multirow event context capture failed.',1;
IF NOT EXISTS(SELECT 1 FROM paws.ChangeHistoryContext c CROSS APPLY paws_api.HistoryAffectedFaculty(NULL,NULL,c.ContextJson) f WHERE c.AuditEventId=@One AND f.FacultyId=@A)
 THROW 54790,'Event-time assignment membership missing.',1;
UPDATE paws.SessionAssignment SET FacultyId=@B,SourceFacultyName=N'Synthetic B' WHERE SessionId=@Session;
IF NOT EXISTS(SELECT 1 FROM paws.ChangeHistoryContext c CROSS APPLY paws_api.HistoryAffectedFaculty(NULL,NULL,c.ContextJson) f WHERE c.AuditEventId=@One AND f.FacultyId=@A)
 OR EXISTS(SELECT 1 FROM paws.ChangeHistoryContext c CROSS APPLY paws_api.HistoryAffectedFaculty(NULL,NULL,c.ContextJson) f WHERE c.AuditEventId=@One AND f.FacultyId=@B)
 THROW 54790,'Later assignments changed an earlier event snapshot.',1;
DECLARE @Before nvarchar(max)=(SELECT @A facultyId,N'Synthetic A' sourceFacultyName FOR JSON PATH);
DECLARE @After nvarchar(max)=(SELECT @B facultyId,N'Synthetic B' sourceFacultyName FOR JSON PATH);
INSERT paws.AuditEvent(AuditEventId,EventType,EntityType,EntityId,OccurredAtUtc,BeforeJson,AfterJson)
VALUES(@Replacement,N'session_assignments_replaced',N'session',CONVERT(nvarchar(36),@Session),'2026-10-16T10:02:00',@Before,@After);
IF (SELECT COUNT(*) FROM paws_api.HistoryAffectedFaculty(@Before,@After,NULL))<>2 THROW 54790,'Removal/replacement affected membership incomplete.',1;
INSERT paws.AuditEvent(AuditEventId,EventType,EntityType,EntityId,OccurredAtUtc,AfterJson)
VALUES(@Private,N'afc_record_created',N'afc_record',CONVERT(nvarchar(36),NEWID()),'2026-10-16T10:03:00',(SELECT @B facultyId,N'private reason B' purpose FOR JSON PATH,WITHOUT_ARRAY_WRAPPER));
DECLARE @Rows table(source nvarchar(16),eventId nvarchar(80),eventType nvarchar(128),entityType nvarchar(128),entityId nvarchar(256),occurredAtUtc datetime2(7),beforeJson nvarchar(max),afterJson nvarchar(max),metadataJson nvarchar(max),contextJson nvarchar(max),actorName nvarchar(260),academicYear nvarchar(32),facultyId uniqueidentifier);
INSERT @Rows EXEC paws_api.ListChangeHistoryEvents N'history-test-a',N'mine','2026-10-16','2026-10-17';
IF NOT EXISTS(SELECT 1 FROM @Rows WHERE eventId=CONVERT(nvarchar(36),@One)) OR NOT EXISTS(SELECT 1 FROM @Rows WHERE eventId=CONVERT(nvarchar(36),@Replacement))
 OR EXISTS(SELECT 1 FROM @Rows WHERE eventId=CONVERT(nvarchar(36),@Private)) THROW 54790,'My history scope failed.',1;
DELETE @Rows;
INSERT @Rows EXEC paws_api.ListChangeHistoryEvents N'history-test-a',N'timetable','2026-10-16','2026-10-17';
IF NOT EXISTS(SELECT 1 FROM @Rows WHERE eventId=CONVERT(nvarchar(36),@Two)) OR EXISTS(SELECT 1 FROM @Rows WHERE eventId=CONVERT(nvarchar(36),@Private)) THROW 54790,'Public timetable scope failed.',1;
DELETE @Rows;
INSERT @Rows EXEC paws_api.ListChangeHistoryEvents N'history-test-a',N'dashboard','2026-10-16','2026-10-17';
IF EXISTS(SELECT 1 FROM @Rows WHERE eventId=CONVERT(nvarchar(36),@Private)) THROW 54790,'Private AFC leaked across faculty.',1;
DELETE @Rows;
INSERT @Rows EXEC paws_api.ListChangeHistoryEvents N'history-test-b',N'dashboard','2026-10-16','2026-10-17';
IF NOT EXISTS(SELECT 1 FROM @Rows WHERE eventId=CONVERT(nvarchar(36),@Private)) THROW 54790,'Own AFC history missing.',1;
IF ISJSON(paws_api.DoeHistoryPolicySnapshot(NEWID()))<>1 THROW 54790,'Policy snapshot must be valid JSON even for a missing version.',1;
CREATE USER [history-synthetic-policy-writer] WITHOUT LOGIN;
ALTER ROLE paws_runtime_doe_admin_write ADD MEMBER [history-synthetic-policy-writer];
EXECUTE AS USER=N'history-synthetic-policy-writer';
DECLARE @PolicySnapshot nvarchar(max)=paws_api.DoeHistoryPolicySnapshot(NEWID());
REVERT;
IF ISJSON(@PolicySnapshot)<>1 THROW 54790,'Existing draft role cannot invoke the audit snapshot.',1;
ROLLBACK;
IF EXISTS(SELECT 1 FROM paws.AuditEvent WHERE AuditEventId=@One) OR EXISTS(SELECT 1 FROM paws.ChangeHistoryContext WHERE AuditEventId=@One)
 THROW 54790,'Audit and event context did not roll back together.',1;
-- Denial is outside the fixture transaction: XACT_ABORT may abort on THROW.
BEGIN TRY
 EXEC paws_api.ListChangeHistoryEvents N'missing-synthetic-history-user',N'timetable','2026-10-16','2026-10-17';
 THROW 54790,'Missing profile was allowed.',1;
END TRY BEGIN CATCH IF ERROR_NUMBER()<>54701 THROW; END CATCH;
IF EXISTS(SELECT 1 FROM sys.database_role_members WHERE role_principal_id=DATABASE_PRINCIPAL_ID(N'paws_runtime_history_read'))
 THROW 54790,'Migration must not add runtime membership.',1;
PRINT 'CHANGE_HISTORY_SQL_ACCEPTANCE_OK';
