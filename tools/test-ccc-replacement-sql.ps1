param([Parameter(Mandatory=$true)][string]$ContainerName)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'test-calendar-activity-sql.ps1') -ContainerName $ContainerName -Through '041' -SkipAcceptance
foreach($file in @('045_calendar_away_classification.sql','046_calendar_commit_preflight.sql','047_change_history.sql','048_afc_form_upload.sql','049_ccc_full_replacement.sql','049_ccc_full_replacement_acceptance.sql')){
 Invoke-TestSql (Get-Content -LiteralPath (Join-Path $repoPath ('database/azure-sql/'+$file)) -Raw) 'VetMed-Ops'
}
