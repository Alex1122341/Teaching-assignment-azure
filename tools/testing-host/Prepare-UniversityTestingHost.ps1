# Compatibility entry point; implementation is under tools/testing.
$global:LASTEXITCODE = 0
& (Join-Path $PSScriptRoot '../testing/host/Prepare-UniversityTestingHost.ps1') @args
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
