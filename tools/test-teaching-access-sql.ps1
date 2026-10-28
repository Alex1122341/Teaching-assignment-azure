param([Parameter(Mandatory=$true)][string]$ContainerName)
$ErrorActionPreference='Stop'
# Reuse all inspected local Docker boundaries and every accepted060 proof first.
. (Join-Path $PSScriptRoot 'test-account-access-sql.ps1') -ContainerName $ContainerName
Invoke-TestSql (Get-Content -LiteralPath (Join-Path $repoPath 'database/azure-sql/060_account_access.sql') -Raw) 'VetMed-Ops'
# Exercise the current MASTER layer as well as the older workflow foundation.
# Its historical role snapshot must survive additive access metadata unchanged.
foreach($masterFile in @('045_calendar_away_classification.sql','046_calendar_commit_preflight.sql','047_change_history.sql','048_afc_form_upload.sql','049_ccc_full_replacement.sql','050_afc_record_documents.sql','051_record_document_history.sql','052_master_source_refresh.sql','053_ccc_master_slots.sql','054_trainee_source_evidence.sql','055_trainee_empty_results.sql')){
 Invoke-TestSql (Get-Content -LiteralPath (Join-Path $repoPath ('database/azure-sql/'+$masterFile)) -Raw) 'VetMed-Ops'
}
Invoke-TestSql @'
CREATE TABLE dbo.PawsDisposableLeadership061(Marker bit NOT NULL);
INSERT dbo.PawsDisposableLeadership061 VALUES(1);
DECLARE @Batch uniqueidentifier=NEWID(),@Faculty uniqueidentifier=NEWID();
INSERT staging.ImportBatch(ImportBatchId,StartedAtUtc,Status,SourceManifestSha256,ImporterVersion,ValidationSummaryJson) VALUES(@Batch,SYSUTCDATETIME(),N'synthetic',REPLICATE('6',64),N'leadership061compat',N'{}');
INSERT paws.Faculty(FacultyId,RecordType,DisplayName,Active,SourceImportBatchId) VALUES(@Faculty,N'faculty',N'Synthetic snapshot compatibility',1,@Batch);
INSERT paws.RoleAssignment(RoleAssignmentId,FacultyId,FacultyResolutionStatus,AcademicYear,RoleType,CourseOrSubjectOrRotation,SourceImportBatchId,SourceRow) VALUES(NEWID(),@Faculty,N'resolved',N'2026-27',N'VISC',N'Synthetic snapshot baseline',@Batch,1);
'@ 'VetMed-Ops'
Invoke-TestSql (Get-Content -LiteralPath (Join-Path $repoPath 'server/test/fixtures/leadership-access-master-stage.sql') -Raw) 'VetMed-Ops'
Invoke-TestSql @'
SELECT FirebaseUid,Email,DisplayName,BaseRole,FacultyId,Active,MustChangePassword,OfficeName,CreatedAtUtc,UpdatedAtUtc INTO dbo.Leadership061ProfileBaseline FROM paws.UserProfile;
SELECT paws_api.MasterRefreshSnapshot('2026-27') SnapshotJson INTO dbo.Leadership061MasterSnapshotBaseline;
'@ 'VetMed-Ops'
Invoke-TestSql (Get-Content -LiteralPath (Join-Path $repoPath 'database/azure-sql/061_effective_teaching_access.sql') -Raw) 'VetMed-Ops'
Invoke-TestSql @'
IF EXISTS(SELECT FirebaseUid,Email,DisplayName,BaseRole,FacultyId,Active,MustChangePassword,OfficeName,CreatedAtUtc,UpdatedAtUtc FROM paws.UserProfile EXCEPT SELECT * FROM dbo.Leadership061ProfileBaseline) OR EXISTS(SELECT * FROM dbo.Leadership061ProfileBaseline EXCEPT SELECT FirebaseUid,Email,DisplayName,BaseRole,FacultyId,Active,MustChangePassword,OfficeName,CreatedAtUtc,UpdatedAtUtc FROM paws.UserProfile) THROW 54160,'Migration changed a base account profile.',1;
PRINT 'TEACHING_ACCESS_061_PROFILE_VALUES_PRESERVED';
IF paws_api.MasterRefreshSnapshot('2026-27')<>(SELECT SnapshotJson FROM dbo.Leadership061MasterSnapshotBaseline) THROW 54160,'Leadership metadata invalidated historical MASTER after-state hashes.',1;
DECLARE @OldReceipt uniqueidentifier=(SELECT ReceiptId FROM dbo.LeadershipMasterCompatibility);
EXEC paws_api.RecoverMasterRefresh @OldReceipt,N'leadership-master-owner',1;
IF NOT EXISTS(SELECT 1 FROM paws.MasterRefreshReceipt WHERE ReceiptId=@OldReceipt AND Status=N'recovered') THROW 54160,'Retained MASTER receipt did not recover after061.',1;
PRINT 'TEACHING_ACCESS_061_MASTER_SNAPSHOT_COMPATIBILITY';
'@ 'VetMed-Ops'
Invoke-TestSql (Get-Content -LiteralPath (Join-Path $repoPath 'database/azure-sql/061_effective_teaching_access_acceptance.sql') -Raw) 'VetMed-Ops'
Invoke-TestSql (Get-Content -LiteralPath (Join-Path $repoPath 'database/azure-sql/062_leadership_access_commands.sql') -Raw) 'VetMed-Ops'
Invoke-TestSql (Get-Content -LiteralPath (Join-Path $repoPath 'database/azure-sql/062_leadership_access_commands_acceptance.sql') -Raw) 'VetMed-Ops'
# INSERT ... EXEC introduces an outer transaction and is intentionally rejected
# by the standalone history procedure. Capture its real JSON across sqlcmd instead.
function Read-LeadershipHistory([string]$AcademicYear,[switch]$Snapshot){
 if($AcademicYear -notin @('2026-27','2027-28')){throw 'Synthetic history year required.'}
 $statement=if($Snapshot){"SET NOCOUNT ON; EXEC paws_api.GetTeachingLeadershipAccessSnapshot N'leadership062owner',N'leadership062target',N'$AcademicYear';"}else{"SET NOCOUNT ON; EXEC paws_api.GetTeachingLeadershipAccessHistory N'leadership062owner',N'leadership062target',N'$AcademicYear',0;"}
 $output=$statement | & docker exec -e "SQLCMDPASSWORD=$env:PAWS_SQL_TEST_PASSWORD" -i $ContainerName /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -C -I -b -d 'VetMed-Ops' -i /dev/stdin -f 65001 -y 0 -w 65535
 if($LASTEXITCODE -ne 0){throw 'Synthetic leadership history query failed.'}
 # sqlcmd does not permit -h with -y0. Remove the heading/separator, retaining
 # every subsequent JSON fragment if the large-value column spans lines.
 $lines=@($output);$jsonStart=-1
 for($index=0;$index -lt $lines.Count;$index++){if($lines[$index].TrimStart().StartsWith('{')){$jsonStart=$index;break}}
 if($jsonStart -lt 0){throw 'Synthetic leadership history JSON was not returned.'}
 return (($lines[$jsonStart..($lines.Count-1)] -join '').Trim() | ConvertFrom-Json)
}
$leadershipHistory=Read-LeadershipHistory '2026-27'
if($leadershipHistory.total -lt 1 -or @($leadershipHistory.operations).Count -lt 1 -or @($leadershipHistory.origins).Count -lt 1){throw 'Owner history did not preserve operations and original grants.'}
if(@($leadershipHistory.operations | Where-Object {$_.receipt.academicYear -ne '2026-27'}).Count){throw 'History returned another academic year.'}
$otherYearHistory=Read-LeadershipHistory '2027-28'
if($otherYearHistory.total -ne 0 -or $otherYearHistory.operations -isnot [Array] -or @($otherYearHistory.operations).Count -ne 0 -or $otherYearHistory.origins -isnot [Array]){throw 'History crossed academic-year scope or omitted its empty arrays.'}
$emptyYearSnapshot=Read-LeadershipHistory '2027-28' -Snapshot
if($emptyYearSnapshot.sources -isnot [Array] -or $emptyYearSnapshot.assignments -isnot [Array] -or @($emptyYearSnapshot.sources).Count -ne 0 -or @($emptyYearSnapshot.assignments).Count -ne 0){throw 'Empty-year catalog omitted its empty source/assignment arrays.'}
Write-Output 'LEADERSHIP_COMMAND_062_HISTORY_YEAR_OWNER_BOUNDARY'
Invoke-TestSql @'
CREATE TABLE dbo.Leadership062RaceBarrier(RaceId tinyint PRIMARY KEY);
SELECT COUNT(*) OperationCount INTO dbo.Leadership062RaceBaseline FROM paws.LeadershipAccessOperation WHERE TargetUid=N'leadership062target';
'@ 'VetMed-Ops'
$raceSql=Get-Content -LiteralPath (Join-Path $repoPath 'server/test/fixtures/leadership-access-race.sql') -Raw
$raceJobs=@()
try {
 foreach($racer in @(1,2)){
  $raceJobs+=Start-Job -ArgumentList $ContainerName,$env:PAWS_SQL_TEST_PASSWORD,$raceSql.Replace('{RACER}',[string]$racer) -ScriptBlock {
   param($TestContainer,$TestPassword,$SqlText)
   $OutputEncoding=[Text.UTF8Encoding]::new($false)
   $output=$SqlText | & docker exec -e "SQLCMDPASSWORD=$TestPassword" -i $TestContainer /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -C -I -b -d VetMed-Ops -i /dev/stdin -f 65001 2>&1
   [pscustomobject]@{exitCode=$LASTEXITCODE;output=($output -join "`n")}
  }
 }
 $null=$raceJobs | Wait-Job -Timeout 30
 if(@($raceJobs | Where-Object State -ne 'Completed').Count){throw 'Leadership race did not complete.'}
 $raceResults=@($raceJobs | Receive-Job)
 if(@($raceResults | Where-Object exitCode -eq 0).Count -ne 1 -or @($raceResults | Where-Object { $_.exitCode -ne 0 -and $_.output -match '54103' }).Count -ne 1){throw 'Competing leadership intents did not serialize against their exact authority epoch.'}
}finally{$raceJobs | Stop-Job -ErrorAction SilentlyContinue;$raceJobs | Remove-Job -Force -ErrorAction SilentlyContinue}
Invoke-TestSql @'
IF (SELECT COUNT(*) FROM paws.LeadershipAccessOperation WHERE TargetUid=N'leadership062target')<>(SELECT OperationCount+1 FROM dbo.Leadership062RaceBaseline) THROW 54260,'Concurrent intents persisted an incorrect operation count.',1;
IF (SELECT COUNT(*) FROM paws.TeachingResponsibilityAssignee WHERE ResponsibilityId=N'leadership062hicc')<>1 THROW 54260,'Concurrent intents duplicated the exclusive assignee.',1;
PRINT 'LEADERSHIP_COMMAND_062_CONCURRENT_EPOCH_SERIALIZATION';
'@ 'VetMed-Ops'
Invoke-TestSql (Get-Content -LiteralPath (Join-Path $repoPath 'database/azure-sql/063_scoped_teaching_workflow.sql') -Raw) 'VetMed-Ops'
Invoke-TestSql (Get-Content -LiteralPath (Join-Path $repoPath 'database/azure-sql/063_scoped_teaching_workflow_acceptance.sql') -Raw) 'VetMed-Ops'
Invoke-TestSql (Get-Content -LiteralPath (Join-Path $repoPath 'server/test/fixtures/leadership-access-master-recovery.sql') -Raw) 'VetMed-Ops'
$workflowRollback=Get-Content -LiteralPath (Join-Path $repoPath 'database/azure-sql/rollback_063_scoped_teaching_workflow.sql') -Raw
$workflowEscaped=([regex]::Replace($workflowRollback,'(?m)^:[^\r\n]+\r?\n','')).Replace("'","''")
Invoke-TestSql "DECLARE @Refused bit=0;BEGIN TRY EXEC(N'$workflowEscaped');END TRY BEGIN CATCH IF XACT_STATE()<>0 ROLLBACK;IF ERROR_NUMBER()=54362 SET @Refused=1;ELSE THROW;END CATCH;IF @Refused=0 THROW 54360,'Used workflow rollback was not refused.',1;PRINT 'SCOPED_WORKFLOW_063_USED_ROLLBACK_REFUSED';" 'VetMed-Ops'
$commandRollback=Get-Content -LiteralPath (Join-Path $repoPath 'database/azure-sql/rollback_062_leadership_access_commands.sql') -Raw
$commandEscaped=([regex]::Replace($commandRollback,'(?m)^:[^\r\n]+\r?\n','')).Replace("'","''")
Invoke-TestSql "DECLARE @Refused bit=0;BEGIN TRY EXEC(N'$commandEscaped');END TRY BEGIN CATCH IF XACT_STATE()<>0 ROLLBACK;IF ERROR_NUMBER()=54262 SET @Refused=1;ELSE THROW;END CATCH;IF @Refused=0 THROW 54260,'Used command rollback was not refused.',1;PRINT 'LEADERSHIP_COMMAND_062_USED_ROLLBACK_REFUSED';" 'VetMed-Ops'
$rollback=Get-Content -LiteralPath (Join-Path $repoPath 'database/azure-sql/rollback_061_effective_teaching_access.sql') -Raw
$initialBatch=([regex]::Replace($rollback,'(?m)^:[^\r\n]+\r?\n','') -split '(?m)^GO[ \t]*$')[0]
$escaped=$initialBatch.Replace("'","''")
Invoke-TestSql "DECLARE @Refused bit=0;BEGIN TRY EXEC(N'$escaped');END TRY BEGIN CATCH IF XACT_STATE()<>0 ROLLBACK;IF ERROR_NUMBER()=54162 SET @Refused=1;ELSE THROW;END CATCH;IF @Refused=0 THROW 54160,'Used leadership rollback was not refused.',1;PRINT 'TEACHING_ACCESS_061_USED_ROLLBACK_REFUSED';" 'VetMed-Ops'
# A fresh guarded reset proves the unused path without deleting used audit rows.
. (Join-Path $PSScriptRoot 'test-calendar-activity-sql.ps1') -ContainerName $ContainerName -Through '041' -SkipAcceptance
Invoke-TestSql (Get-Content -LiteralPath (Join-Path $repoPath 'database/azure-sql/060_account_access.sql') -Raw) 'VetMed-Ops'
foreach($masterFile in @('045_calendar_away_classification.sql','046_calendar_commit_preflight.sql','047_change_history.sql','048_afc_form_upload.sql','049_ccc_full_replacement.sql','050_afc_record_documents.sql','051_record_document_history.sql','052_master_source_refresh.sql','053_ccc_master_slots.sql','054_trainee_source_evidence.sql','055_trainee_empty_results.sql')){
 Invoke-TestSql (Get-Content -LiteralPath (Join-Path $repoPath ('database/azure-sql/'+$masterFile)) -Raw) 'VetMed-Ops'
}
Invoke-TestSql (Get-Content -LiteralPath (Join-Path $repoPath 'database/azure-sql/061_effective_teaching_access.sql') -Raw) 'VetMed-Ops'
Invoke-TestSql (Get-Content -LiteralPath (Join-Path $repoPath 'database/azure-sql/062_leadership_access_commands.sql') -Raw) 'VetMed-Ops'
Invoke-TestSql (Get-Content -LiteralPath (Join-Path $repoPath 'database/azure-sql/063_scoped_teaching_workflow.sql') -Raw) 'VetMed-Ops'
Invoke-TestSql 'SELECT ObjectName,OriginalHash,RestoreHash,OriginalObjectId INTO dbo.Leadership063RollbackBaseline FROM paws.LeadershipWorkflowModule;' 'VetMed-Ops'
Invoke-TestSql $workflowRollback 'VetMed-Ops'
Invoke-TestSql "IF OBJECT_ID(N'paws.LeadershipWorkflowModule') IS NOT NULL OR EXISTS(SELECT 1 FROM sys.triggers WHERE name LIKE N'LeadershipAuthority063[_]%') OR EXISTS(SELECT 1 FROM dbo.Leadership063RollbackBaseline WHERE OBJECT_ID(ObjectName) IS NULL OR OBJECT_DEFINITION(OBJECT_ID(ObjectName)) IS NULL OR OriginalObjectId<>OBJECT_ID(ObjectName) OR CONVERT(varchar(64),HASHBYTES('SHA2_256',OBJECT_DEFINITION(OBJECT_ID(ObjectName))),2) NOT IN(OriginalHash,RestoreHash)) THROW 54360,'Unused workflow rollback did not restore exact original parameters/body and object identity.',1;PRINT 'SCOPED_WORKFLOW_063_UNUSED_EXACT_MODULE_RESTORE';" 'VetMed-Ops'
Invoke-TestSql $commandRollback 'VetMed-Ops'
Invoke-TestSql "IF OBJECT_ID(N'paws_api.SetTeachingLeadershipAccess') IS NOT NULL OR OBJECT_ID(N'paws.LeadershipAuthority062_SourceLink') IS NOT NULL THROW 54260,'Unused command rollback left command objects.',1;PRINT 'LEADERSHIP_COMMAND_062_UNUSED_ROLLBACK_PRESERVES_061';" 'VetMed-Ops'
Invoke-TestSql $rollback 'VetMed-Ops'
Invoke-TestSql @'
IF OBJECT_ID(N'paws.LeadershipAccessState') IS NOT NULL OR OBJECT_ID(N'paws_api.EffectiveTeachingAssignments') IS NOT NULL OR COL_LENGTH(N'paws.RoleAssignment',N'AuthorityVersion') IS NOT NULL THROW 54160,'Unused leadership rollback left new objects.',1;
IF COL_LENGTH(N'paws.RoleAppointmentSchedule',N'ScheduleVersion') IS NULL OR COL_LENGTH(N'paws.UserProfile',N'AccessVersion') IS NULL OR OBJECT_ID(N'paws_api.SetAccountAccess') IS NULL OR DATABASE_PRINCIPAL_ID(N'paws_runtime_account_access') IS NULL THROW 54160,'Leadership rollback removed an existing authority feature.',1;
IF EXISTS(SELECT 1 FROM sys.triggers WHERE name LIKE N'LeadershipAuthority061[_]%') THROW 54160,'Leadership rollback left an epoch trigger.',1;
PRINT 'TEACHING_ACCESS_061_UNUSED_ROLLBACK_PRESERVES_060';
'@ 'VetMed-Ops'
