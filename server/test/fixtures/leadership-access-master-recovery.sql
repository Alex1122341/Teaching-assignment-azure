/* Synthetic disposable SQL only. Linked grants must be explicitly revoked. */
:ON ERROR EXIT
SET NOCOUNT ON;SET XACT_ABORT ON;
IF DB_NAME()<>N'VetMed-Ops' OR OBJECT_ID(N'dbo.PawsDisposableLeadership061',N'U') IS NULL THROW 54360,'Disposable leadership marker required.',1;
EXEC dbo.StageLeadershipMasterCompatibility N'Synthetic MASTER linked area';
DECLARE @Source uniqueidentifier,@Receipt uniqueidentifier,@Faculty uniqueidentifier;
SELECT @Source=RoleId,@Receipt=ReceiptId FROM dbo.LeadershipMasterCompatibility;
SELECT @Faculty=FacultyId FROM paws.UserProfile WHERE FirebaseUid=N'leadership-master-faculty';
INSERT paws.TeachingResponsibility(ResponsibilityId,Kind,Label,Active) VALUES(N'leadershipmastervisc',N'visc',N'Synthetic MASTER VISC',1);
INSERT paws.TeachingAssignmentGroup(GroupId,Name,LeaderViscResponsibilityId,Active) VALUES(N'leadershipmasterarea',N'Synthetic MASTER linked area',N'leadershipmastervisc',1);
DECLARE @Epoch varchar(16)=(SELECT authorityVersion FROM paws_api.TeachingAuthorityState()),
 @ActorVersion varchar(16)=(SELECT LOWER(CONVERT(varchar(16),CONVERT(binary(8),AccessVersion),2)) FROM paws.UserProfile WHERE FirebaseUid=N'leadership-master-owner'),
 @TargetVersion varchar(16)=(SELECT LOWER(CONVERT(varchar(16),CONVERT(binary(8),AccessVersion),2)) FROM paws.UserProfile WHERE FirebaseUid=N'leadership-master-faculty'),
 @Hash char(64)=REPLICATE('D',64),@Operation uniqueidentifier=NEWID(),@Preview uniqueidentifier=NEWID();
DECLARE @Changes nvarchar(max)=(SELECT N'grant' action,N'leadershipmastervisc' responsibilityId,N'visc' kind,
 LOWER(CONVERT(varchar(64),HASHBYTES('SHA2_256',CONCAT(N'leadership062|',@Epoch,N'|leadershipmastervisc')),2)) definitionVersion,
 CONVERT(varchar(36),@Source) sourceRoleAssignmentId,@Epoch sourceVersion,
 (SELECT LOWER(CONVERT(varchar(16),CONVERT(binary(8),ScheduleVersion),2)) FROM paws.RoleAppointmentSchedule WHERE RoleAssignmentId=@Source) sourceScheduleVersion,
 LOWER(paws_api.TeachingAppointmentAccessSourceStamp(@Source)) sourceSignature,N'Synthetic MASTER linked area' recordedScope,
 N'2026-05-01' startDate,N'2027-05-01' endExclusive,CAST(0 AS bit) usesApprovedDefaultDates,N'exclusive' assignmentMode,
 JSON_QUERY(N'[]') courses,JSON_QUERY(N'[{"groupId":"leadershipmasterarea","name":"Synthetic MASTER linked area"}]') groups FOR JSON PATH);
EXEC paws_api.SetTeachingLeadershipAccess N'leadership-master-owner',@ActorVersion,N'leadership-master-faculty',@TargetVersion,N'2026-27',@Epoch,@Changes,N'Synthetic MASTER exact source grant',@Hash,@Operation,@Preview;
DECLARE @Snapshot nvarchar(max)=paws_api.MasterRefreshSnapshot('2026-27'),@AuditCount int=(SELECT COUNT(*) FROM paws.AuditEvent),@Rejected bit=0;
BEGIN TRY EXEC paws_api.RecoverMasterRefresh @Receipt,N'leadership-master-owner',1;END TRY
BEGIN CATCH IF ERROR_NUMBER()=54304 SET @Rejected=1;ELSE THROW;END CATCH;
IF @Rejected=0 THROW 54360,'MASTER Undo did not require explicit leadership revocation.',1;
IF @Snapshot<>paws_api.MasterRefreshSnapshot('2026-27') OR @AuditCount<>(SELECT COUNT(*) FROM paws.AuditEvent)
 OR NOT EXISTS(SELECT 1 FROM paws.MasterRefreshReceipt WHERE ReceiptId=@Receipt AND Status=N'committed')
 OR NOT EXISTS(SELECT 1 FROM paws.TeachingLeadershipGrantSource WHERE SourceRoleAssignmentId=@Source AND OperationId=@Operation)
 THROW 54360,'Refused MASTER Undo changed business, authority, receipt or audit state.',1;
SET @Epoch=(SELECT authorityVersion FROM paws_api.TeachingAuthorityState());
SET @Changes=(SELECT N'revoke' action,CONVERT(varchar(36),a.ResponsibilityAssigneeId) assignmentId,
 LOWER(CONVERT(varchar(16),CONVERT(binary(8),a.AuthorityVersion),2)) expectedVersion,a.ResponsibilityId responsibilityId
 FROM paws.TeachingResponsibilityAssignee a JOIN paws.TeachingLeadershipGrantSource s ON s.ResponsibilityAssigneeId=a.ResponsibilityAssigneeId WHERE s.SourceRoleAssignmentId=@Source FOR JSON PATH);
DECLARE @Revoke uniqueidentifier=NEWID();
EXEC paws_api.SetTeachingLeadershipAccess N'leadership-master-owner',@ActorVersion,N'leadership-master-faculty',@TargetVersion,N'2026-27',@Epoch,@Changes,N'Synthetic explicit revoke before MASTER Undo',@Hash,@Revoke,@Preview;
EXEC paws_api.RecoverMasterRefresh @Receipt,N'leadership-master-owner',1;
IF EXISTS(SELECT 1 FROM paws.RoleAssignment WHERE RoleAssignmentId=@Source) OR NOT EXISTS(SELECT 1 FROM paws.MasterRefreshReceipt WHERE ReceiptId=@Receipt AND Status=N'recovered')
 OR (SELECT COUNT(*) FROM paws.LeadershipAccessOperation WHERE OperationId IN(@Operation,@Revoke))<>2
 THROW 54360,'MASTER Undo after explicit revoke lost recovery or authority history.',1;
PRINT 'SCOPED_WORKFLOW_063_MASTER_UNDO_REQUIRES_REVOKE';
