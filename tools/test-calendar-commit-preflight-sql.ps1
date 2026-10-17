param([Parameter(Mandatory=$true)][string]$ContainerName)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'test-calendar-away-sql.ps1') -ContainerName $ContainerName
Invoke-TestSql (Get-Content -LiteralPath (Join-Path $repoPath 'database/azure-sql/046_calendar_commit_preflight.sql') -Raw) 'VetMed-Ops'
Invoke-TestSql (Get-Content -LiteralPath (Join-Path $repoPath 'database/azure-sql/rollback_046_calendar_commit_preflight.sql') -Raw) 'VetMed-Ops'
# The second application proves rollback restored the exact accepted045 definition.
Invoke-TestSql (Get-Content -LiteralPath (Join-Path $repoPath 'database/azure-sql/046_calendar_commit_preflight.sql') -Raw) 'VetMed-Ops'
# INSERT-EXEC can mask the original command error with SQL3915. Capture errors
# only in this already-guarded disposable container, without changing the module.
Invoke-TestSql "CREATE EVENT SESSION CalendarCommitAcceptanceErrors ON SERVER ADD EVENT sqlserver.error_reported(WHERE severity>=16) ADD TARGET package0.ring_buffer;ALTER EVENT SESSION CalendarCommitAcceptanceErrors ON SERVER STATE=START;" 'VetMed-Ops'
try {
 Invoke-TestSql (Get-Content -LiteralPath (Join-Path $repoPath 'database/azure-sql/040_calendar_activity_acceptance.sql') -Raw) 'VetMed-Ops'
} catch {
 Invoke-TestSql "SELECT CAST(target_data AS xml) FROM sys.dm_xe_session_targets target JOIN sys.dm_xe_sessions session ON session.address=target.event_session_address WHERE session.name=N'CalendarCommitAcceptanceErrors';" 'VetMed-Ops'
 throw
} finally {
 Invoke-TestSql 'DROP EVENT SESSION CalendarCommitAcceptanceErrors ON SERVER;' 'VetMed-Ops'
}
Invoke-TestSql (Get-Content -LiteralPath (Join-Path $repoPath 'database/azure-sql/046_calendar_commit_preflight_acceptance.sql') -Raw) 'VetMed-Ops'
& (Join-Path $PSScriptRoot 'test-calendar-activity-races.ps1') -ContainerName $ContainerName
