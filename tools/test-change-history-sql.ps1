param([Parameter(Mandatory=$true)][string]$ContainerName)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'test-calendar-activity-sql.ps1') -ContainerName $ContainerName -Through '041' -SkipAcceptance
Invoke-TestSql (Get-Content -LiteralPath (Join-Path $repoPath 'database/azure-sql/045_calendar_away_classification.sql') -Raw) 'VetMed-Ops'
Invoke-TestSql (Get-Content -LiteralPath (Join-Path $repoPath 'database/azure-sql/046_calendar_commit_preflight.sql') -Raw) 'VetMed-Ops'
Invoke-TestSql "INSERT paws.AuditEvent(AuditEventId,EventType,EntityType,EntityId,OccurredAtUtc,AfterJson) VALUES('ffffffff-ffff-4fff-8fff-ffffffffffff',N'session_updated',N'session',N'synthetic-old',SYSUTCDATETIME(),N'{`"room`":`"Old audit`"}');" 'VetMed-Ops'
Invoke-TestSql (Get-Content -LiteralPath (Join-Path $repoPath 'database/azure-sql/047_change_history.sql') -Raw) 'VetMed-Ops'
Invoke-TestSql (Get-Content -LiteralPath (Join-Path $repoPath 'database/azure-sql/047_change_history_acceptance.sql') -Raw) 'VetMed-Ops'
Invoke-TestSql (Get-Content -LiteralPath (Join-Path $repoPath 'database/azure-sql/rollback_047_change_history.sql') -Raw) 'VetMed-Ops'
Invoke-TestSql "IF OBJECT_ID(N'paws.CaptureChangeHistoryContext') IS NOT NULL OR OBJECT_ID(N'paws_api.ListChangeHistoryEvents') IS NOT NULL OR OBJECT_ID(N'paws.ChangeHistoryContext') IS NULL OR OBJECT_ID(N'paws_api.DoeHistoryPolicySnapshot') IS NULL THROW 54790,'History rollback failed to preserve evidence and dependencies.',1; PRINT 'CHANGE_HISTORY_ROLLBACK_OK';" 'VetMed-Ops'
