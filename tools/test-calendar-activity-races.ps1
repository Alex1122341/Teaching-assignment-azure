param([Parameter(Mandatory)][string]$ContainerName)
$ErrorActionPreference='Stop'
function Fail-Disposable {throw 'DISPOSABLE_SQL_REQUIRED: only the labeled local synthetic test container is allowed.'}
if($ContainerName -notmatch '^paws-calendar-[a-z0-9-]+$' -or -not(Get-Command docker -ErrorAction SilentlyContinue)){Fail-Disposable}
$contextName=& docker context show
if($LASTEXITCODE -ne 0){Fail-Disposable}
$contextData=(& docker context inspect $contextName | ConvertFrom-Json)
if($contextData[0].Endpoints.docker.Host -notmatch '^unix://' -and $contextData[0].Endpoints.docker.Host -notmatch '^npipe:///*\./pipe/'){Fail-Disposable}
$containerData=(& docker inspect $ContainerName | ConvertFrom-Json)
if($LASTEXITCODE -ne 0 -or $containerData[0].Config.Labels.'paws.calendar-test' -ne '1' -or -not $containerData[0].State.Running){Fail-Disposable}
if(-not $env:PAWS_SQL_TEST_PASSWORD){throw 'Synthetic SQL password is missing.'}
function Start-RaceSql([string]$Sql){
 $info=[Diagnostics.ProcessStartInfo]::new('docker');$info.UseShellExecute=$false;$info.CreateNoWindow=$true
 $info.RedirectStandardInput=$true;$info.RedirectStandardOutput=$true;$info.RedirectStandardError=$true
 foreach($argument in @('exec','-e',"SQLCMDPASSWORD=$env:PAWS_SQL_TEST_PASSWORD",'-i',$ContainerName,'/opt/mssql-tools18/bin/sqlcmd','-S','localhost','-U','sa','-C','-I','-b','-d','VetMed-Ops','-h','-1','-y','0','-i','/dev/stdin','-f','65001')){$info.ArgumentList.Add($argument)}
 $process=[Diagnostics.Process]::new();$process.StartInfo=$info;[void]$process.Start()
 $stdout=$process.StandardOutput.ReadToEndAsync();$stderr=$process.StandardError.ReadToEndAsync()
 $process.StandardInput.WriteLine(":ON ERROR EXIT`nSET NOCOUNT ON;`n"+$Sql);$process.StandardInput.Close()
 return @{Process=$process;Stdout=$stdout;Stderr=$stderr}
}
function Finish-RaceSql($Running,[int]$Timeout=30000){
 if(-not $Running.Process.WaitForExit($Timeout)){$Running.Process.Kill($true);throw 'Synthetic race SQL timed out.'}
 $output=$Running.Stdout.GetAwaiter().GetResult();$errorText=$Running.Stderr.GetAwaiter().GetResult()
 if($Running.Process.ExitCode -ne 0){throw "Synthetic SQL failed: $output $errorText"}
 return $output.Trim()
}
function Invoke-RaceSql([string]$Sql){$run=Start-RaceSql $Sql;try{return Finish-RaceSql $run}finally{$run.Process.Dispose()}}
function Wait-RaceCondition([string]$Sql,[string]$Label){
 $deadline=[DateTime]::UtcNow.AddSeconds(20)
 while([DateTime]::UtcNow -lt $deadline){
  if((Invoke-RaceSql $Sql).Trim() -eq '1'){return}
  Start-Sleep -Milliseconds 100
 }
 throw "Race barrier or expected wait was not observed: $Label"
}
$setup=Get-Content -LiteralPath (Join-Path (Split-Path $PSScriptRoot -Parent) 'server/test/fixtures/calendar-activity-race-setup.sql') -Raw
[void](Invoke-RaceSql $setup)
$row=3000
foreach($kind in @('migration','timing','recovery','afc_create','afc_cancel','session')){
 foreach($readerFirst in @($false,$true)){
  if($kind -eq 'afc_cancel' -and $readerFirst){continue}
  $row++;$name=$kind+$(if($readerFirst){'-swap-first'}else{'-writer-first'})
  $first=if($readerFirst){1}else{0}
  [void](Invoke-RaceSql "EXEC dbo.PrepareCalendarActivityRace '$name','$kind',$row,$first;")
  $case=(Invoke-RaceSql "SELECT (SELECT * FROM dbo.CalendarActivityRaceCase WHERE TestName='$name' FOR JSON PATH,WITHOUT_ARRAY_WRAPPER);") | ConvertFrom-Json
  $body=if($readerFirst){$case.ReaderSql}else{$case.WriterSql}
  $other=if($readerFirst){$case.WriterSql}else{$case.ReaderSql}
  $ready='paws:test:calendar-ready:'+$name
  $holderSql=@"
SET XACT_ABORT ON;
BEGIN TRANSACTION;
$body
DECLARE @ReadyResult int;
EXEC @ReadyResult=sys.sp_getapplock @Resource=N'$ready',@LockMode=N'Exclusive',@LockOwner=N'Session',@DbPrincipal=N'dbo',@LockTimeout=5000;
IF @ReadyResult<0 THROW 53891,'Race ready signal failed.',1;
DECLARE @Deadline datetime2=DATEADD(second,30,SYSUTCDATETIME());
WHILE (SELECT ReleaseFlag FROM dbo.CalendarActivityRaceBarrier WHERE TestName='$name')=0
BEGIN
 IF SYSUTCDATETIME()>@Deadline THROW 53891,'Race holder timed out.',1;
 WAITFOR DELAY '00:00:00.100';
END;
COMMIT TRANSACTION;
EXEC sys.sp_releaseapplock @Resource=N'$ready',@LockOwner=N'Session',@DbPrincipal=N'dbo';
PRINT 'RACE_HOLDER_OK';
"@
  $holder=Start-RaceSql $holderSql;$waiter=$null
  try{
   Wait-RaceCondition "SELECT CASE WHEN APPLOCK_TEST(N'dbo',N'$ready',N'Shared',N'Session')=0 THEN 1 ELSE 0 END;" "$name holder-ready"
   $context=[Convert]::ToHexString([Text.Encoding]::ASCII.GetBytes($name))
   $waiter=Start-RaceSql "SET CONTEXT_INFO 0x$context; $other PRINT 'RACE_WAITER_OK';"
   $type=if($case.ExpectedWait -eq 'APPLICATION'){" AND locks.resource_type=N'APPLICATION'"}else{" AND locks.resource_type<>N'APPLICATION'"}
   Wait-RaceCondition "SELECT CASE WHEN EXISTS(SELECT 1 FROM sys.dm_tran_locks locks JOIN sys.dm_exec_sessions sessions ON sessions.session_id=locks.request_session_id WHERE sessions.context_info=0x$context AND locks.request_status IN(N'WAIT',N'CONVERT') $type) THEN 1 ELSE 0 END;" "$name observed-$($case.ExpectedWait)-wait"
   [void](Invoke-RaceSql "UPDATE dbo.CalendarActivityRaceBarrier SET ReleaseFlag=1 WHERE TestName='$name';")
   $holderOutput=Finish-RaceSql $holder;$waiterOutput=Finish-RaceSql $waiter
   if($holderOutput -notmatch 'RACE_HOLDER_OK' -or $waiterOutput -notmatch 'RACE_WAITER_OK'){throw 'Race did not reach both durable outcomes.'}
   if($kind -eq 'migration'){
    [void](Invoke-RaceSql "IF (SELECT COUNT(*) FROM paws.CalendarActivity WHERE FacultyId='$($case.FacultyId)')<>1 OR EXISTS(SELECT 1 FROM paws.AfcRecord WHERE FacultyId='$($case.FacultyId)' AND Active=1) THROW 53891,'Migration race left mixed AFC/activity state.',1;")
   }
   if($kind -eq 'recovery'){
    [void](Invoke-RaceSql "IF EXISTS(SELECT 1 FROM paws.CalendarActivity WHERE FacultyId='$($case.FacultyId)') OR (SELECT COUNT(*) FROM paws.AfcRecord WHERE FacultyId='$($case.FacultyId)' AND Active=1)<>1 THROW 53891,'Recovery race left mixed AFC/activity state.',1;")
   }
   Write-Output "CALENDAR_RACE_OK $name actual-$($case.ExpectedWait)-wait"
  }finally{
   [void](Invoke-RaceSql "UPDATE dbo.CalendarActivityRaceBarrier SET ReleaseFlag=1 WHERE TestName='$name';")
   foreach($run in @($holder,$waiter)){
    if($run){if(-not $run.Process.HasExited){$run.Process.Kill($true)};$run.Process.Dispose()}
   }
  }
 }
}
[void](Invoke-RaceSql 'DROP PROCEDURE dbo.PrepareCalendarActivityRace;DROP TABLE dbo.CalendarActivityRaceCase;DROP TABLE dbo.CalendarActivityRaceBarrier;')
Write-Output 'CALENDAR_ACTIVITY_SWAP_SERIALIZED_OK'
