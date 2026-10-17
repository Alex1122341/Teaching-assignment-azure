param([Parameter(Mandatory=$true)][string]$ContainerName)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'test-calendar-away-sql.ps1') -ContainerName $ContainerName
Invoke-TestSql (Get-Content -LiteralPath (Join-Path $repoPath 'database/azure-sql/046_calendar_commit_preflight_acceptance.sql') -Raw) 'VetMed-Ops'
