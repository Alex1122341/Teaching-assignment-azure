param(
 [Parameter(Mandatory=$true)][string]$ContainerName,
 [ValidateSet('Appointments','CccSlots')][string]$Mode='Appointments',
 [switch]$CheckRollback
)
$ErrorActionPreference='Stop'
$masterCheckRollback=$CheckRollback.IsPresent
$masterMode=$Mode
# The existing helper verifies local Docker context, exact container prefix and
# label before any reset. This runner deliberately accepts no server argument.
. (Join-Path $PSScriptRoot 'test-calendar-activity-sql.ps1') -ContainerName $ContainerName -Through '041' -SkipAcceptance
foreach($file in @('045_calendar_away_classification.sql','046_calendar_commit_preflight.sql','047_change_history.sql','048_afc_form_upload.sql','049_ccc_full_replacement.sql','050_afc_record_documents.sql','051_record_document_history.sql','052_master_source_refresh.sql')){
 Invoke-TestSql (Get-Content -LiteralPath (Join-Path $repoPath ('database/azure-sql/'+$file)) -Raw) 'VetMed-Ops'
}
if($masterMode -eq 'CccSlots'){
 if(-not $masterCheckRollback){Invoke-TestSql (Get-Content -LiteralPath (Join-Path $repoPath 'server/test/fixtures/ccc-master-slots-setup.sql') -Raw) 'VetMed-Ops'}
 Invoke-TestSql (Get-Content -LiteralPath (Join-Path $repoPath 'database/azure-sql/053_ccc_master_slots.sql') -Raw) 'VetMed-Ops'
 if($masterCheckRollback){
  Invoke-TestSql (Get-Content -LiteralPath (Join-Path $repoPath 'database/azure-sql/rollback_053_ccc_master_slots.sql') -Raw) 'VetMed-Ops'
  Invoke-TestSql "IF COL_LENGTH(N'paws.CalendarActivity',N'StaffingKind') IS NOT NULL OR OBJECT_ID(N'paws.MasterRefreshReceipt') IS NULL THROW 55390,'CCC rollback damaged existing authority.',1;PRINT 'MASTER_CCC_SLOTS_EMPTY_ROLLBACK_OK';" 'VetMed-Ops'
 }else{
  Invoke-TestSql (Get-Content -LiteralPath (Join-Path $repoPath 'database/azure-sql/053_ccc_master_slots_acceptance.sql') -Raw) 'VetMed-Ops'
  $slotRollback=(Get-Content -LiteralPath (Join-Path $repoPath 'database/azure-sql/rollback_053_ccc_master_slots.sql') -Raw).Replace(':ON ERROR EXIT','').Replace("'","''")
  Invoke-TestSql "BEGIN TRY EXEC(N'$slotRollback');THROW 55390,'Populated CCC rollback accepted.',1;END TRY BEGIN CATCH IF XACT_STATE()<>0 ROLLBACK;IF ERROR_NUMBER()<>55308 THROW;END CATCH;PRINT 'MASTER_CCC_SLOTS_POPULATED_ROLLBACK_REFUSED_OK';" 'VetMed-Ops'
 }
}elseif($masterCheckRollback){
 Invoke-TestSql (Get-Content -LiteralPath (Join-Path $repoPath 'database/azure-sql/rollback_052_master_source_refresh.sql') -Raw) 'VetMed-Ops'
 Invoke-TestSql "IF OBJECT_ID(N'staging.MasterRefresh') IS NOT NULL OR OBJECT_ID(N'paws.RoleAppointmentSchedule') IS NULL OR OBJECT_ID(N'paws.CalendarActivity') IS NULL THROW 55290,'MASTER rollback damaged prerequisites.',1;PRINT 'MASTER_EMPTY_ROLLBACK_OK';" 'VetMed-Ops'
}else{
 Invoke-TestSql (Get-Content -LiteralPath (Join-Path $repoPath 'database/azure-sql/052_master_source_refresh_acceptance.sql') -Raw) 'VetMed-Ops'
 . (Join-Path $PSScriptRoot 'test-master-refresh-races.ps1') -ContainerName $ContainerName
}
