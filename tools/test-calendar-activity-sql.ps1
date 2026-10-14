param(
 [Parameter(Mandatory=$true)][string]$ContainerName,
 [ValidateSet('038','039','040','041')][string]$Through='038',
 [string[]]$FeatureMigrations
)
$ErrorActionPreference='Stop'
function Fail-Disposable { throw 'DISPOSABLE_SQL_REQUIRED: use an explicitly labeled local synthetic test container.' }
if($ContainerName -notmatch '^paws-calendar-[a-z0-9-]+$'){Fail-Disposable}
if(-not(Get-Command docker -ErrorAction SilentlyContinue)){Fail-Disposable}
$contextName=& docker context show
if($LASTEXITCODE -ne 0){Fail-Disposable}
$contextData=(& docker context inspect $contextName | ConvertFrom-Json)
$hostEndpoint=$contextData[0].Endpoints.docker.Host
if($hostEndpoint -notmatch '^unix://' -and $hostEndpoint -notmatch '^npipe:///*\./pipe/'){Fail-Disposable}
$containerData=(& docker inspect $ContainerName | ConvertFrom-Json)
if($LASTEXITCODE -ne 0 -or $containerData[0].Config.Labels.'paws.calendar-test' -ne '1' -or -not $containerData[0].State.Running){Fail-Disposable}
if(-not $env:PAWS_SQL_TEST_PASSWORD){throw 'Synthetic container password is required through PAWS_SQL_TEST_PASSWORD.'}
$repoPath=Split-Path $PSScriptRoot -Parent
$manifest=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'calendar-activity-sql-test-manifest.json') -Raw | ConvertFrom-Json
$OutputEncoding=New-Object System.Text.UTF8Encoding($false)
function Invoke-TestSql([string]$Sql,[string]$Database='master'){
 $Sql | & docker exec -e "SQLCMDPASSWORD=$env:PAWS_SQL_TEST_PASSWORD" -i $ContainerName /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -C -I -b -v 'PAWS_API_PRINCIPAL=UC\sa-xinyu.zhu1' -d $Database -i /dev/stdin -f 65001
 if($LASTEXITCODE -ne 0){throw 'DISPOSABLE_SQL_ACCEPTANCE_FAILED'}
}
# Reset is confined to the inspected synthetic container. Never accept a Server argument.
Invoke-TestSql "IF DB_ID(N'VetMed-Ops') IS NOT NULL BEGIN ALTER DATABASE [VetMed-Ops] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [VetMed-Ops]; END; CREATE DATABASE [VetMed-Ops];"
Invoke-TestSql 'CREATE USER [paws_swa_beta] WITHOUT LOGIN; CREATE USER [paws-sql-beta-mi] WITHOUT LOGIN; CREATE USER [UC\sa-xinyu.zhu1] WITHOUT LOGIN;' 'VetMed-Ops'
foreach($relativePath in $manifest.baseline){
 Write-Output "SQL_BASELINE $relativePath"
 Invoke-TestSql (Get-Content -LiteralPath (Join-Path $repoPath $relativePath) -Raw) 'VetMed-Ops'
}
$selected=if($FeatureMigrations){@($FeatureMigrations -split ',')}else{@($manifest.features.PSObject.Properties.Name | Where-Object { [int]$_ -le [int]$Through })}
foreach($number in $selected){
 if($number -notin @('038','039','040','041')){throw 'Unsupported feature migration.'}
 $feature=$manifest.features.$number
 if(-not $feature){throw 'Feature migration manifest is incomplete.'}
 Invoke-TestSql (Get-Content -LiteralPath (Join-Path $repoPath $feature.migration) -Raw) 'VetMed-Ops'
}
foreach($number in $selected){
 $acceptance=$manifest.features.$number.acceptance
 Invoke-TestSql (Get-Content -LiteralPath (Join-Path $repoPath $acceptance) -Raw) 'VetMed-Ops'
}
