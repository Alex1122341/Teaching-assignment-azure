[CmdletBinding()]
param(
 [Parameter(Mandatory=$true)][ValidateSet('Stage','Start','Check','Stop')][string]$Action,
 [Parameter(Mandatory=$true)][string]$ConfigPath
)
$ErrorActionPreference='Stop'
try {
 $config=Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
 if(-not [System.IO.Path]::IsPathRooted($config.nodeExe)){throw 'Invalid Node path'}
 $signature=Get-AuthenticodeSignature -LiteralPath $config.nodeExe
 if($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'OpenJS Foundation'){throw 'Untrusted Node binary'}
 if((Get-FileHash -LiteralPath $config.nodeExe -Algorithm SHA256).Hash.ToLowerInvariant() -ne $config.nodeSha256){throw 'Node hash mismatch'}
 $version=& $config.nodeExe --version
 if($version -notmatch '^v22\.'){throw 'Node22 required'}
 & $config.nodeExe (Join-Path $PSScriptRoot 'host-cli.js') --action $Action --config $ConfigPath
 exit $LASTEXITCODE
} catch {
 Write-Output '{"status":"NOT_READY","reason":"HOST_CONFIGURATION_INVALID"}'
 exit 1
}
