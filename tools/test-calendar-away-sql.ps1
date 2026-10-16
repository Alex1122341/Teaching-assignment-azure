param([Parameter(Mandatory=$true)][string]$ContainerName)
$ErrorActionPreference='Stop'
# Reuse the existing local-context/name/label guards and fresh synthetic baseline.
. (Join-Path $PSScriptRoot 'test-calendar-activity-sql.ps1') -ContainerName $ContainerName -Through '041'
Invoke-TestSql (Get-Content -LiteralPath (Join-Path $repoPath 'database/azure-sql/045_calendar_away_acceptance.sql') -Raw) 'VetMed-Ops'
