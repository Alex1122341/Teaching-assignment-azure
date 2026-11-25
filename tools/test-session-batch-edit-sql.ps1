param([Parameter(Mandatory=$true)][string]$ContainerName)
$ErrorActionPreference='Stop'
# No server/connection-string parameter. This runner intentionally targets only
# the labeled, loopback-bound, disposable SQL container.
if($ContainerName -ne 'paws-calendar-batch171'){throw 'DISPOSABLE_BATCH_SQL_REQUIRED'}
if(-not $env:PAWS_SQL_TEST_PASSWORD -or $env:PAWS_BATCH_TEST_MARKER -notmatch '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'){throw 'Synthetic password and marker required.'}
$contextName=& docker context show
if($LASTEXITCODE -ne 0){throw 'Local Docker required.'}
$contextData=(& docker context inspect $contextName | ConvertFrom-Json)
if($contextData[0].Endpoints.docker.Host -notmatch '^unix://' -and $contextData[0].Endpoints.docker.Host -notmatch '^npipe:///*\./pipe/'){throw 'Local Docker required.'}
$details=(& docker inspect $ContainerName | ConvertFrom-Json)
if($LASTEXITCODE -ne 0 -or $details[0].Config.Labels.'paws.calendar-test' -ne '1' -or -not $details[0].State.Running){throw 'Labeled running SQL container required.'}
$bindings=@($details[0].NetworkSettings.Ports.'1433/tcp')
if($bindings.Count -ne 1 -or $bindings[0].HostIp -ne '127.0.0.1' -or $bindings[0].HostPort -ne '14337'){throw 'Expected isolated loopback SQL port mapping.'}
# Shared runner rechecks the Docker label and transport before its synthetic reset.
. (Join-Path $PSScriptRoot 'test-calendar-activity-sql.ps1') -ContainerName $ContainerName -Through '041' -SkipAcceptance
foreach($file in @('042_adfa_swap_preview.sql','043_scheduling_tasks.sql','066_sessional_and_doe_summary_source.sql')){
 Invoke-TestSql (Get-Content -LiteralPath (Join-Path $repoPath ('database/azure-sql/'+$file)) -Raw) 'VetMed-Ops'
}
Invoke-TestSql "CREATE TABLE dbo.Batch171DisposableMarker(Marker uniqueidentifier PRIMARY KEY); INSERT dbo.Batch171DisposableMarker VALUES('$env:PAWS_BATCH_TEST_MARKER');" 'VetMed-Ops'
node (Join-Path $PSScriptRoot 'test-session-batch-edit-sql.js')
if($LASTEXITCODE -ne 0){throw 'BATCH171_REAL_SQL_ACCEPTANCE_FAILED'}
