param([Parameter(Mandatory=$true)][string]$ContainerName)
$ErrorActionPreference='Stop'
# Inherits the local-Docker, explicit-label, running-container and synthetic-password guards.
# There is deliberately no Server/connection-string argument or production fallback.
. (Join-Path $PSScriptRoot 'test-calendar-activity-sql.ps1') -ContainerName $ContainerName -Through '041' -SkipAcceptance
Invoke-TestSql @'
CREATE TABLE dbo.PawsDisposableAccess060(Marker bit NOT NULL);
INSERT dbo.PawsDisposableAccess060 VALUES(1);
INSERT paws.UserProfile(FirebaseUid,Email,DisplayName,BaseRole,Active,MustChangePassword) VALUES(N'access060-baseline',N'baseline@example.test',N'Baseline Account',N'adfa_regular',1,0);
SELECT FirebaseUid,Email,DisplayName,BaseRole,FacultyId,Active,MustChangePassword,OfficeName,CreatedAtUtc,UpdatedAtUtc INTO dbo.Access060ProfileBaseline FROM paws.UserProfile;
'@ 'VetMed-Ops'
$migration=(Get-Content -LiteralPath (Join-Path $repoPath 'database/azure-sql/060_account_access.sql') -Raw)
$initialBatch=([regex]::Replace($migration,'(?m)^:[^\r\n]+\r?\n','') -split '(?m)^GO[ \t]*$')[0]
$initialEscaped=$initialBatch.Replace("'","''")
Invoke-TestSql @'
CREATE USER access060_collision_member WITHOUT LOGIN;
CREATE ROLE paws_runtime_account_access AUTHORIZATION dbo;
ALTER ROLE paws_runtime_account_access ADD MEMBER access060_collision_member;
'@ 'VetMed-Ops'
Invoke-TestSql "DECLARE @Refused bit=0;BEGIN TRY EXEC(N'$initialEscaped');IF XACT_STATE()<>0 ROLLBACK;END TRY BEGIN CATCH IF XACT_STATE()<>0 ROLLBACK;IF ERROR_NUMBER()=54000 SET @Refused=1;ELSE THROW;END CATCH;IF @Refused=0 THROW 54060,'Pre-existing feature principal was not refused.',1;IF COL_LENGTH(N'paws.UserProfile',N'AccessVersion') IS NOT NULL OR OBJECT_ID(N'paws.AccountAccessChange') IS NOT NULL THROW 54060,'Refused principal left schema changes.',1;IF NOT EXISTS(SELECT 1 FROM sys.database_role_members WHERE role_principal_id=DATABASE_PRINCIPAL_ID(N'paws_runtime_account_access') AND member_principal_id=DATABASE_PRINCIPAL_ID(N'access060_collision_member')) THROW 54060,'Refusal changed existing role membership.',1;IF EXISTS(SELECT 1 FROM sys.database_permissions WHERE grantee_principal_id=DATABASE_PRINCIPAL_ID(N'paws_runtime_account_access')) THROW 54060,'Refusal granted permissions to an existing principal.',1;ALTER ROLE paws_runtime_account_access DROP MEMBER access060_collision_member;DROP USER access060_collision_member;DROP ROLE paws_runtime_account_access;PRINT 'ACCOUNT_ACCESS_060_EXISTING_PRINCIPAL_REFUSED';" 'VetMed-Ops'
Invoke-TestSql (Get-Content -LiteralPath (Join-Path $repoPath 'database/azure-sql/060_account_access.sql') -Raw) 'VetMed-Ops'
Invoke-TestSql @'
IF EXISTS(SELECT FirebaseUid,Email,DisplayName,BaseRole,FacultyId,Active,MustChangePassword,OfficeName,CreatedAtUtc,UpdatedAtUtc FROM paws.UserProfile EXCEPT SELECT * FROM dbo.Access060ProfileBaseline) OR EXISTS(SELECT * FROM dbo.Access060ProfileBaseline EXCEPT SELECT FirebaseUid,Email,DisplayName,BaseRole,FacultyId,Active,MustChangePassword,OfficeName,CreatedAtUtc,UpdatedAtUtc FROM paws.UserProfile) THROW 54060,'Migration changed an existing access profile.',1;
PRINT 'ACCOUNT_ACCESS_060_MIGRATION_PRESERVES_GRANTS';
'@ 'VetMed-Ops'
Invoke-TestSql (Get-Content -LiteralPath (Join-Path $repoPath 'database/azure-sql/060_account_access_acceptance.sql') -Raw) 'VetMed-Ops'

$raceTemplate=@'
SET NOCOUNT ON;
DECLARE @ActorVersion varchar(16)=(SELECT CONVERT(varchar(16),CONVERT(binary(8),AccessVersion),2) FROM paws.UserProfile WHERE FirebaseUid=N'{ACTOR}');
DECLARE @TargetVersion varchar(16)=(SELECT CONVERT(varchar(16),CONVERT(binary(8),AccessVersion),2) FROM paws.UserProfile WHERE FirebaseUid=N'{TARGET}');
DECLARE @Operation uniqueidentifier=NEWID(),@Preview uniqueidentifier=NEWID(),@Hash char(64)=REPLICATE('F',64);
WAITFOR DELAY '00:00:01';
EXEC paws_api.SetAccountAccess N'{ACTOR}',@ActorVersion,N'{TARGET}',@TargetVersion,N'adfa_regular',1,NULL,N'Synthetic concurrent demotion',@Hash,@Operation,@Preview;
'@
$jobs=@()
try {
 foreach($pair in @(@('access060-owner-a','access060-owner-b'),@('access060-owner-b','access060-owner-a'))){
  $sqlText=$raceTemplate.Replace('{ACTOR}',$pair[0]).Replace('{TARGET}',$pair[1])
  $jobs+=Start-Job -ArgumentList $ContainerName,$env:PAWS_SQL_TEST_PASSWORD,$sqlText -ScriptBlock {
   param($TestContainer,$TestPassword,$SqlText)
   $OutputEncoding=[Text.UTF8Encoding]::new($false)
   $output=$SqlText | & docker exec -e "SQLCMDPASSWORD=$TestPassword" -i $TestContainer /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -C -I -b -d VetMed-Ops -i /dev/stdin -f 65001 2>&1
   [pscustomobject]@{exitCode=$LASTEXITCODE;output=($output -join "`n")}
  }
 }
 $null=$jobs | Wait-Job -Timeout 30
 if(@($jobs | Where-Object State -ne 'Completed').Count){throw 'Access concurrency probe did not complete.'}
 $results=@($jobs | Receive-Job)
 if(@($results | Where-Object exitCode -eq 0).Count -ne 1 -or @($results | Where-Object { $_.exitCode -ne 0 -and $_.output -match '54001|54003' }).Count -ne 1){throw 'Concurrent Owner revocation did not serialize safely.'}
}finally{$jobs | Stop-Job -ErrorAction SilentlyContinue;$jobs | Remove-Job -Force -ErrorAction SilentlyContinue}
Invoke-TestSql "IF (SELECT COUNT(*) FROM paws.UserProfile WHERE BaseRole IN(N'owner',N'adfa_general') AND Active=1 AND MustChangePassword=0)<>1 THROW 54060,'Concurrent edits lost the last Owner.',1;PRINT 'ACCOUNT_ACCESS_060_CONCURRENT_OWNER_REVOCATION';" 'VetMed-Ops'

$rollback=(Get-Content -LiteralPath (Join-Path $repoPath 'database/azure-sql/rollback_060_account_access.sql') -Raw)
$firstBatch=([regex]::Replace($rollback,'(?m)^:[^\r\n]+\r?\n','') -split '(?m)^GO[ \t]*$')[0]
$escaped=$firstBatch.Replace("'","''")
Invoke-TestSql "DECLARE @Refused bit=0;BEGIN TRY EXEC(N'$escaped');END TRY BEGIN CATCH IF XACT_STATE()<>0 ROLLBACK;IF ERROR_NUMBER()=54062 SET @Refused=1;ELSE THROW;END CATCH;IF @Refused=0 THROW 54060,'Used audit rollback was not refused.',1;PRINT 'ACCOUNT_ACCESS_060_USED_ROLLBACK_REFUSED';" 'VetMed-Ops'
# A second inspected disposable reset proves the unused-schema rollback only.
. (Join-Path $PSScriptRoot 'test-calendar-activity-sql.ps1') -ContainerName $ContainerName -Through '041' -SkipAcceptance
Invoke-TestSql (Get-Content -LiteralPath (Join-Path $repoPath 'database/azure-sql/060_account_access.sql') -Raw) 'VetMed-Ops'
Invoke-TestSql $rollback 'VetMed-Ops'
Invoke-TestSql "IF COL_LENGTH(N'paws.UserProfile',N'AccessVersion') IS NOT NULL OR OBJECT_ID(N'paws.AccountAccessChange') IS NOT NULL OR OBJECT_ID(N'paws_api.SetAccountAccess') IS NOT NULL THROW 54060,'Empty access rollback left feature objects.',1;PRINT 'ACCOUNT_ACCESS_060_EMPTY_ROLLBACK_OK';" 'VetMed-Ops'
