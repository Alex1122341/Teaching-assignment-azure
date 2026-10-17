param([Parameter(Mandatory=$true)][string]$ContainerName)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'test-calendar-away-sql.ps1') -ContainerName $ContainerName
Invoke-TestSql (Get-Content -LiteralPath (Join-Path $repoPath 'database/azure-sql/046_calendar_commit_preflight.sql') -Raw) 'VetMed-Ops'
Invoke-TestSql (Get-Content -LiteralPath (Join-Path $repoPath 'database/azure-sql/rollback_046_calendar_commit_preflight.sql') -Raw) 'VetMed-Ops'
# The second application proves rollback restored the exact accepted045 definition.
Invoke-TestSql (Get-Content -LiteralPath (Join-Path $repoPath 'database/azure-sql/046_calendar_commit_preflight.sql') -Raw) 'VetMed-Ops'
Invoke-TestSql (Get-Content -LiteralPath (Join-Path $repoPath 'database/azure-sql/040_calendar_activity_acceptance.sql') -Raw) 'VetMed-Ops'
Invoke-TestSql (Get-Content -LiteralPath (Join-Path $repoPath 'database/azure-sql/046_calendar_commit_preflight_acceptance.sql') -Raw) 'VetMed-Ops'
& (Join-Path $PSScriptRoot 'test-calendar-activity-races.ps1') -ContainerName $ContainerName
