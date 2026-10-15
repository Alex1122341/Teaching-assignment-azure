param([Parameter(Mandatory=$true)][string]$ContainerName)
$ErrorActionPreference='Stop'
# The shared runner checks local transport and the synthetic label before any reset.
. (Join-Path $PSScriptRoot 'test-calendar-activity-sql.ps1') -ContainerName $ContainerName -Through '041'
Invoke-TestSql (Get-Content -LiteralPath (Join-Path $repoPath 'database/azure-sql/042_adfa_swap_preview.sql') -Raw) 'VetMed-Ops'
$migrationPath=Join-Path $repoPath 'database/azure-sql/043_scheduling_tasks.sql'
if(Test-Path -LiteralPath $migrationPath){Invoke-TestSql (Get-Content -LiteralPath $migrationPath -Raw) 'VetMed-Ops'}
Invoke-TestSql (Get-Content -LiteralPath (Join-Path $repoPath 'database/azure-sql/043_scheduling_tasks_acceptance.sql') -Raw) 'VetMed-Ops'
