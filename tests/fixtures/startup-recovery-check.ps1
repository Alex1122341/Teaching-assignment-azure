$ErrorActionPreference='Stop'
Import-Module (Join-Path $PSScriptRoot '..\..\tools\recovery\PawsRecovery.psm1') -Force
function Check($Actual,$Expected){if($Actual -cne $Expected){throw ('Expected '+$Expected+' got '+$Actual)}}
Check (Get-PawsRecoveryDecision $false $false $false '' 'https://current.example').action 'start_api'
Check (Get-PawsRecoveryDecision $true $false $true 'https://current.example' 'https://current.example').action 'blocked'
Check (Get-PawsRecoveryDecision $true $true $false '' 'https://current.example').action 'start_tunnel'
Check (Get-PawsRecoveryDecision $true $true $true 'https://new.example' 'https://current.example').action 'manual_ingress'
Check (Get-PawsRecoveryDecision $true $true $true '' 'https://current.example').action 'manual_ingress'
Check (Get-PawsRecoveryDecision $true $true $true 'https://current.example/' 'https://current.example').action 'healthy'
$testRoot=Join-Path ([IO.Path]::GetTempPath()) 'paws-synthetic-recovery'
$valid=[pscustomobject]@{Identity='UC\synthetic';ReleaseSha=('a'*40);TrustAnchor=('b'*40);ApiPort=18787;ApiLauncherPath=(Join-Path $testRoot 'start.ps1');ApiLauncherSha256=('c'*64);CloudflaredPath=(Join-Path $testRoot 'cloudflared.exe');CloudflaredSha256=('d'*64);TunnelMode='quick';PublishedOrigin='https://current.example';LogDirectory=(Join-Path $testRoot 'logs');ExpectedGates=[pscustomobject]@{afcSingle=$true;calendarActivityCommit=$false}}
$valid|Add-Member NoteProperty ApiServerRoot (Join-Path $testRoot 'server')
$valid|Add-Member NoteProperty ApiManifestPath (Join-Path $testRoot 'manifest.json')
$valid|Add-Member NoteProperty ApiManifestSha256 ('e'*64)
Assert-PawsRecoveryConfig $valid
foreach($field in @('password','token')){$bad=$valid|ConvertTo-Json|ConvertFrom-Json; $bad|Add-Member NoteProperty $field 'synthetic';$caught=$false;try{Assert-PawsRecoveryConfig $bad}catch{$caught=$true};if(-not $caught){throw 'Embedded credentials accepted'}}
foreach($origin in @('http://example.test','https://user:secret@example.test','https://example.test/path','https://example.test/?key=secret')){$bad=$valid|ConvertTo-Json|ConvertFrom-Json;$bad.PublishedOrigin=$origin;$caught=$false;try{Assert-PawsRecoveryConfig $bad}catch{$caught=$true};if(-not $caught){throw 'Unsafe origin accepted'}}
$bad=$valid|ConvertTo-Json|ConvertFrom-Json;$bad.TunnelMode='named';$caught=$false;try{Assert-PawsRecoveryConfig $bad}catch{$caught=$true};if(-not $caught){throw 'Missing named config accepted'}
$health=[pscustomobject]@{status='ok';service='paws-university-api';authority='vetmed-ops-sql';releaseSha=('a'*40);runtimeTrustAnchor=('b'*40);writeGates=[pscustomobject]@{calendarActivityCommit=$false;afcSingle=$true}}
Assert-PawsRecoveryRuntime $health $valid
$bad=$health|ConvertTo-Json|ConvertFrom-Json;$bad.releaseSha=('e'*40);$caught=$false;try{Assert-PawsRecoveryRuntime $bad $valid}catch{$caught=$true};if(-not $caught){throw 'Wrong release accepted'}
$bad=$health|ConvertTo-Json|ConvertFrom-Json;$bad.writeGates.calendarActivityCommit=$true;$caught=$false;try{Assert-PawsRecoveryRuntime $bad $valid}catch{$caught=$true};if(-not $caught){throw 'Gate drift accepted'}
$xmlText=New-PawsRecoveryTaskXml (Join-Path $testRoot 'config & approved.json') (Join-Path $testRoot 'Invoke-PawsRecovery.ps1') 'UC\synthetic' ([datetime]'2026-10-17T08:00:00')
$xml=[xml]$xmlText;$ns=New-Object Xml.XmlNamespaceManager($xml.NameTable);$ns.AddNamespace('t','http://schemas.microsoft.com/windows/2004/02/mit/task')
Check $xml.SelectSingleNode('//t:BootTrigger/t:Delay',$ns).InnerText 'PT2M'
Check $xml.SelectSingleNode('//t:CalendarTrigger/t:Repetition/t:Interval',$ns).InnerText 'PT2M'
Check $xml.SelectSingleNode('//t:Principal/t:LogonType',$ns).InnerText 'Password'
Check $xml.SelectSingleNode('//t:Principal/t:RunLevel',$ns).InnerText 'LeastPrivilege'
Check $xml.SelectSingleNode('//t:RestartOnFailure/t:Count',$ns).InnerText '3'
if($xmlText -match '<Password>|ExecutionPolicy|Bypass'){throw 'Task contains unsafe credential or policy override'}
$base=[IO.Path]::GetFullPath([IO.Path]::GetTempPath());$fixture=[IO.Path]::GetFullPath((Join-Path $base ('paws-recovery-test-'+[guid]::NewGuid().ToString('N'))))
if(-not $fixture.StartsWith($base.TrimEnd([IO.Path]::DirectorySeparatorChar)+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Unsafe fixture path'}
try{
 $server=Join-Path $fixture 'server';[void][IO.Directory]::CreateDirectory((Join-Path $server 'src'))
 foreach($p in @('src/main.js','package.json','package-lock.json')){[IO.File]::WriteAllText((Join-Path $server $p),'synthetic')}
 $manifest=@();foreach($p in @('src/main.js','package.json','package-lock.json')){$manifest+=@{path=$p;sha256=(Get-PawsFileSha256 (Join-Path $server $p)).ToLower()}}
 $manifestPath=Join-Path $fixture 'manifest.json';$manifest|ConvertTo-Json|Set-Content -LiteralPath $manifestPath -Encoding UTF8
 $files=[pscustomobject]@{ApiServerRoot=$server;ApiManifestPath=$manifestPath;ApiManifestSha256=(Get-PawsFileSha256 $manifestPath)}
 Assert-PawsRecoveryFiles $files
 [IO.File]::WriteAllText((Join-Path $server 'src/main.js'),'changed')
 $caught=$false;try{Assert-PawsRecoveryFiles $files}catch{$caught=$true};if(-not $caught){throw 'Changed runtime source accepted'}
 [IO.File]::WriteAllText((Join-Path $server 'src/main.js'),'synthetic');[IO.File]::WriteAllText((Join-Path $server 'src/unreviewed.js'),'extra')
 $caught=$false;try{Assert-PawsRecoveryFiles $files}catch{$caught=$true};if(-not $caught){throw 'Unexpected runtime source accepted'}
}finally{if(Test-Path -LiteralPath $fixture){Remove-Item -LiteralPath $fixture -Recurse -Force}}
'RECOVERY_TESTS_OK'
