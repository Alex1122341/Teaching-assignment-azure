$ErrorActionPreference='Stop'
$ContainerName='paws-calendar-pr171-browser'
if($env:GITHUB_ACTIONS -ne 'true' -or !$env:PAWS_SQL_TEST_PASSWORD -or $env:PAWS_BROWSER_TEST_MARKER -notmatch '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'){throw 'Disposable Runner required'}
$details=(& docker inspect $ContainerName | ConvertFrom-Json)
if($LASTEXITCODE -ne 0 -or $details[0].Config.Labels.'paws.calendar-test' -ne '1' -or -not $details[0].State.Running){throw 'Labeled running SQL required'}
$bindings=@($details[0].NetworkSettings.Ports.'1433/tcp')
if($bindings.Count -ne 1 -or $bindings[0].HostIp -ne '127.0.0.1' -or $bindings[0].HostPort -ne '14339'){throw 'Loopback SQL required'}
# The existing shared runner also checks the Docker transport, label and password.
. (Join-Path $PSScriptRoot 'test-calendar-activity-sql.ps1') -ContainerName $ContainerName -Through '041' -SkipAcceptance
$files=@(
 '042_adfa_swap_preview.sql','043_scheduling_tasks.sql','045_calendar_away_classification.sql',
 '046_calendar_commit_preflight.sql','047_change_history.sql','048_afc_form_upload.sql',
 '049_ccc_full_replacement.sql','050_afc_record_documents.sql','051_record_document_history.sql',
 '052_master_source_refresh.sql','053_ccc_master_slots.sql','054_trainee_source_evidence.sql',
 '055_trainee_empty_results.sql','056_faculty_availability_read.sql','057_ccc_schedule_read.sql',
 '058_role_appointment_rowversion_hex.sql','059_swap_approval_read.sql','060_account_access.sql',
 '061_effective_teaching_access.sql','062_leadership_access_commands.sql','063_scoped_teaching_workflow.sql',
 '064_afc_date_edit.sql','065_faculty_future_activation.sql','066_sessional_and_doe_summary_source.sql',
 '067_faculty_teaching_doe_inputs.sql','068_afc_special_leave.sql','069_faculty_contract_allocations.sql',
 '070_workflow_regressions.sql','071_afc_batch_record_document.sql','072_faculty_availability_bulk_read.sql'
)
foreach($file in $files){
 Write-Output "BROWSER_SQL_MIGRATION $file"
 Invoke-TestSql (Get-Content -LiteralPath (Join-Path $repoPath ('database/azure-sql/'+$file)) -Raw) 'VetMed-Ops'
}
Invoke-TestSql "CREATE TABLE dbo.PawsBrowserDisposableMarker(Marker uniqueidentifier PRIMARY KEY); INSERT dbo.PawsBrowserDisposableMarker VALUES('$env:PAWS_BROWSER_TEST_MARKER');" 'VetMed-Ops'
Write-Output 'BROWSER_SQL_SCHEMA_READY'
