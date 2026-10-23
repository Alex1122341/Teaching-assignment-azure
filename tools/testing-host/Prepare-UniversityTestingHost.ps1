[CmdletBinding()]
param(
 [Parameter(Mandatory=$true)][string]$TemplatePath,
 [Parameter(Mandatory=$true)][string]$DbaScriptPath,
 [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{40}$')][string]$SourceSha,
 [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$ExpectedNodeSha256
)
$ErrorActionPreference='Stop'
$root='P:\PAWS\Testing'
$hostRoot='P:\PAWS\Testing\Host'
$lockPath='P:\PAWS\Testing.preparation.lock'
$lockStream=$null
function Assert-SafeAncestors([string]$Target) {
 $cursor=[IO.Path]::GetFullPath($Target)
 while($cursor) {
  if(Test-Path -LiteralPath $cursor) {
   $item=Get-Item -LiteralPath $cursor -Force
   if($item.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Linked paths are forbidden'}
   if(-not $item.PSIsContainer){throw 'Expected a directory'}
   if(Test-Path -LiteralPath (Join-Path $cursor '.git')){throw 'Git ancestor is forbidden'}
  }
  $next=[IO.Path]::GetDirectoryName($cursor)
  if($next -eq $cursor){break};$cursor=$next
 }
}
function New-PrivateDirectory([string]$Directory,[bool]$SqlBackupAccess=$false,[bool]$SqlTraverse=$false) {
 if(Test-Path -LiteralPath $Directory){throw 'Refusing existing preparation directory'}
 $acl=[Security.AccessControl.DirectorySecurity]::new()
 $acl.SetAccessRuleProtection($true,$false)
 $inherit=[Security.AccessControl.InheritanceFlags]'ContainerInherit,ObjectInherit'
 foreach($sid in @($script:currentSid,[Security.Principal.SecurityIdentifier]::new('S-1-5-18'),[Security.Principal.SecurityIdentifier]::new('S-1-5-32-544'))) {
  $rule=[Security.AccessControl.FileSystemAccessRule]::new($sid,[Security.AccessControl.FileSystemRights]::FullControl,$inherit,[Security.AccessControl.PropagationFlags]::None,[Security.AccessControl.AccessControlType]::Allow)
  $acl.AddAccessRule($rule)
 }
 if($SqlBackupAccess -or $SqlTraverse) {
  $rights=if($SqlBackupAccess){[Security.AccessControl.FileSystemRights]::Modify}else{[Security.AccessControl.FileSystemRights]::ReadAndExecute}
  $sqlInherit=if($SqlBackupAccess){$inherit}else{[Security.AccessControl.InheritanceFlags]::None}
  $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($script:sqlSid,$rights,$sqlInherit,[Security.AccessControl.PropagationFlags]::None,[Security.AccessControl.AccessControlType]::Allow))
 }
 [IO.Directory]::CreateDirectory($Directory,$acl)|Out-Null
 Assert-SafeAncestors $Directory
}
function Write-NewText([string]$File,[string]$Text) {
 $stream=[IO.File]::Open($File,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
 try{$writer=[IO.StreamWriter]::new($stream,[Text.UTF8Encoding]::new($false));try{$writer.Write($Text)}finally{$writer.Dispose()}}finally{$stream.Dispose()}
}
try {
 if($env:COMPUTERNAME -cne 'ITAPPVETOPSDB01'){throw 'Wrong approved host'}
 Assert-SafeAncestors $root
 if(Test-Path -LiteralPath $root){throw 'Refusing existing Testing root'}
 if((Get-PSDrive P).Free -lt 8GB){throw 'Insufficient P drive capacity'}
 if(@(Get-NetTCPConnection -LocalPort 18788 -State Listen -ErrorAction SilentlyContinue).Count){throw 'Testing port is occupied'}
 if(-not (Get-OdbcDriver -Platform '64-bit' | Where-Object Name -eq 'ODBC Driver 18 for SQL Server')){throw 'Required installed driver is missing'}
 $node='C:\Program Files\nodejs\node.exe'
 $signature=Get-AuthenticodeSignature -LiteralPath $node
 if($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'OpenJS Foundation'){throw 'Untrusted installed Node'}
 $nodeHash=(Get-FileHash -LiteralPath $node -Algorithm SHA256).Hash.ToLowerInvariant()
 if($nodeHash -cne $ExpectedNodeSha256){throw 'Installed Node differs from inventory'}
 $nodeVersion=& $node --version
 if($LASTEXITCODE -ne 0 -or $nodeVersion -notmatch '^v22\.'){throw 'Installed Node22 is required'}
 $template=Get-Content -LiteralPath $TemplatePath -Raw | ConvertFrom-Json
 $expected=@('computerName','windowsIdentity','apiPort','target','firebaseProjectId','allowedOrigin','gateMap','privateRoot','releaseManifestPath','releaseManifestSha256','nodeExe','nodeSha256')|Sort-Object
 if((@($template.PSObject.Properties.Name|Sort-Object) -join ',') -cne ($expected -join ',')){throw 'Unexpected host template fields'}
 if($template.computerName -cne 'ITAPPVETOPSDB01' -or $template.privateRoot -cne $hostRoot -or $template.apiPort -ne 18788 -or $template.firebaseProjectId -cne 'paws-testing-ucvm-20261022' -or $template.allowedOrigin -cne 'https://paws-testing-ucvm-20261022.web.app'){throw 'Host template differs from approved topology'}
 if($template.target.profile -cne 'university-testing' -or $template.target.physicalServer -cne 'ITAPPVETOPSDB01' -or $template.target.host -cne 'itappvetopsdb01.uc.ucalgary.ca' -or $template.target.database -cne 'VetMed-Ops-Testing'){throw 'Host template target differs from approval'}
 $gates=@($template.gateMap.PSObject.Properties)
 if($gates.Count -ne 27 -or @($gates|Where-Object{$_.Value -isnot [bool] -or $_.Value}).Count){throw 'Preparation requires all27 gates explicitly false'}
 $dba=Get-Content -LiteralPath $DbaScriptPath -Raw
 if(([regex]::Matches($dba,'REPLACE_WITH_PRIVATE_TESTING_UUID')).Count -ne 1){throw 'Unexpected DBA script placeholder'}
 $identity=[Security.Principal.WindowsIdentity]::GetCurrent()
 $script:currentSid=$identity.User
 $script:sqlSid=([Security.Principal.NTAccount]::new('NT SERVICE','MSSQLSERVER')).Translate([Security.Principal.SecurityIdentifier])
 $lockStream=[IO.File]::Open($lockPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
 if(Test-Path -LiteralPath $root){throw 'Testing root appeared during preflight'}
 New-PrivateDirectory $root $false $true
 New-PrivateDirectory (Join-Path $root 'Backups') $true
 New-PrivateDirectory (Join-Path $root 'Evidence')
 New-PrivateDirectory $hostRoot
 foreach($name in @('releases','versions','secrets')){New-PrivateDirectory (Join-Path $hostRoot $name)}
 $uuid=[guid]::NewGuid().ToString().ToLowerInvariant()
 $template.windowsIdentity=$identity.Name
 $template.target.environmentId=$uuid
 $template.nodeExe=$node;$template.nodeSha256=$nodeHash
 $template.releaseManifestPath=Join-Path $hostRoot 'releases\not-staged.json'
 $template.releaseManifestSha256=$null
 $profilePath=Join-Path $hostRoot 'host-profile.draft.json'
 Write-NewText $profilePath (($template|ConvertTo-Json -Depth 8)+[Environment]::NewLine)
 Write-NewText (Join-Path $root 'Request-UniversityTestingDatabase.sql') ($dba.Replace('REPLACE_WITH_PRIVATE_TESTING_UUID',$uuid))
 $receipt=[ordered]@{status='PREPARED_NOT_READY';sourceSha=$SourceSha;computerName=$env:COMPUTERNAME;target=$template.target;databaseVerified=$false;apiPort=18788;nodeVersion=$nodeVersion;nodeSha256=$nodeHash;gateCount=27;enabledGates=0;apiStarted=$false;tunnelStarted=$false;utc=[DateTime]::UtcNow.ToString('o')}
 Write-NewText (Join-Path $root 'Evidence\host-preparation.json') (($receipt|ConvertTo-Json -Depth 8)+[Environment]::NewLine)
 $receipt|ConvertTo-Json -Depth 8 -Compress
} catch {
 Write-Output '{"status":"NOT_READY","reason":"HOST_PREPARATION_REQUIRES_REVIEW"}'
 exit 1
} finally {
 if($null -ne $lockStream){$lockStream.Dispose();[IO.File]::Delete($lockPath)}
}
