param([Parameter(Mandatory=$true)][string]$ContainerName,[switch]$CheckRollback)
$ErrorActionPreference='Stop'
# The shared runner checks local transport and the synthetic label before any reset.
. (Join-Path $PSScriptRoot 'test-calendar-activity-sql.ps1') -ContainerName $ContainerName -Through '041'
Invoke-TestSql (Get-Content -LiteralPath (Join-Path $repoPath 'database/azure-sql/042_adfa_swap_preview.sql') -Raw) 'VetMed-Ops'
$migrationPath=Join-Path $repoPath 'database/azure-sql/043_scheduling_tasks.sql'
if(Test-Path -LiteralPath $migrationPath){Invoke-TestSql (Get-Content -LiteralPath $migrationPath -Raw) 'VetMed-Ops'}
Invoke-TestSql (Get-Content -LiteralPath (Join-Path $repoPath 'database/azure-sql/043_scheduling_tasks_acceptance.sql') -Raw) 'VetMed-Ops'
Invoke-TestSql (Get-Content -LiteralPath (Join-Path $repoPath 'database/azure-sql/043_scheduling_tasks_review_acceptance.sql') -Raw) 'VetMed-Ops'
if($CheckRollback){
 $rollbackPath=Join-Path $repoPath 'database/azure-sql/rollback_043_scheduling_tasks.sql'
 if(-not(Test-Path -LiteralPath $rollbackPath)){throw 'SCHEDULING_TASK_ROLLBACK_MISSING'}
 Invoke-TestSql (Get-Content -LiteralPath (Join-Path $repoPath 'database/azure-sql/043_scheduling_tasks_rollback_acceptance.sql') -Raw) 'VetMed-Ops'
 Invoke-TestSql (Get-Content -LiteralPath $rollbackPath -Raw) 'VetMed-Ops'
 Invoke-TestSql "IF OBJECT_ID(N'paws_api.SchedulingTaskIssues') IS NOT NULL OR OBJECT_ID(N'paws_api.ListSchedulingTasks') IS NOT NULL OR COL_LENGTH(N'paws.Session',N'SchedulingVersion') IS NOT NULL OR COL_LENGTH(N'paws.SessionAssignment',N'SchedulingVersion') IS NOT NULL THROW 54390,'Rollback left scheduling objects.',1;PRINT 'SCHEDULING_TASK_ROLLBACK_OK';" 'VetMed-Ops'
}
