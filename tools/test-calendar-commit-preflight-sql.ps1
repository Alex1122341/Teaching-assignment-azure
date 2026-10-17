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
Invoke-TestSql @'
CREATE TABLE dbo.CalendarCommitDiagnosticDefinition(definition nvarchar(max) NOT NULL);
DECLARE @Definition nvarchar(max)=OBJECT_DEFINITION(OBJECT_ID(N'paws_api.CommitCalendarActivityImport'));
INSERT dbo.CalendarCommitDiagnosticDefinition VALUES(@Definition);
SET @Definition=REPLACE(@Definition,N'END TRY BEGIN CATCH IF XACT_STATE()<>0 ROLLBACK TRANSACTION;THROW;END CATCH;',
N'END TRY BEGIN CATCH PRINT CONCAT(''COMMIT_CATCH_DIAGNOSTIC '',ERROR_NUMBER(),'' '',ERROR_MESSAGE(),'' xact='',XACT_STATE(),'' count='',@@TRANCOUNT);IF XACT_STATE()<>0 ROLLBACK TRANSACTION;THROW;END CATCH;');
EXEC sys.sp_executesql @Definition;
'@ 'VetMed-Ops'
try {
 Invoke-TestSql (Get-Content -LiteralPath (Join-Path $repoPath 'database/azure-sql/040_calendar_activity_acceptance.sql') -Raw) 'VetMed-Ops'
} catch {
 Invoke-TestSql @'
SELECT event.value('(data[@name="error_number"]/value)[1]','int') errorNumber,
event.value('(data[@name="message"]/value)[1]','nvarchar(1000)') message
FROM (SELECT CAST(target_data AS xml) payload FROM sys.dm_xe_session_targets target
JOIN sys.dm_xe_sessions session ON session.address=target.event_session_address
WHERE session.name=N'CalendarCommitAcceptanceErrors') captured
CROSS APPLY payload.nodes('/RingBufferTarget/event') events(event);
'@ 'VetMed-Ops'
 throw
} finally {
 Invoke-TestSql 'DECLARE @Definition nvarchar(max)=(SELECT definition FROM dbo.CalendarCommitDiagnosticDefinition);EXEC sys.sp_executesql @Definition;DROP TABLE dbo.CalendarCommitDiagnosticDefinition;' 'VetMed-Ops'
 Invoke-TestSql 'DROP EVENT SESSION CalendarCommitAcceptanceErrors ON SERVER;' 'VetMed-Ops'
}
Invoke-TestSql (Get-Content -LiteralPath (Join-Path $repoPath 'database/azure-sql/046_calendar_commit_preflight_acceptance.sql') -Raw) 'VetMed-Ops'
& (Join-Path $PSScriptRoot 'test-calendar-activity-races.ps1') -ContainerName $ContainerName
