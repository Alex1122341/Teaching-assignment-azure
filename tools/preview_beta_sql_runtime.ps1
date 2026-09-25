[CmdletBinding()]
param(
    [string]$Server = 'ucvm-teaching-lab-xz-20260911.database.windows.net',
    [string]$Database = 'teaching-assignment-lab',
    [string]$Principal = 'paws_swa_beta',
    [string]$FirebaseProjectId = 'tester-teaching',
    [string]$ExpectedFirebaseProjectId = 'tester-teaching',
    [switch]$Apply
)

$ErrorActionPreference = 'Stop'
if ($Apply) { throw 'Apply is prohibited during Phase 1 code completion. This command is preview-only.' }

$preview = [ordered]@{
    Mode = 'PreviewOnly'
    WritesPerformed = $false
    Target = [ordered]@{ Server = $Server; Database = $Database }
    Principal = $Principal
    Permissions = @(
        'GRANT CONNECT',
        'GRANT SELECT ON paws.UserProfile',
        'GRANT SELECT ON paws.vCalendarSession',
        'GRANT SELECT ON paws.SessionAssignment',
        'DENY SELECT, INSERT, UPDATE, DELETE ON staging schema'
    )
    StaticWebAppSettingNames = @(
        'PAWS_SQL_CONNECTION_STRING',
        'FIREBASE_PROJECT_ID',
        'FIREBASE_SERVICE_ACCOUNT_JSON'
    )
    FirebaseProjectId = $FirebaseProjectId
    ExpectedFirebaseProjectId = $ExpectedFirebaseProjectId
    FirebaseProjectConsistent = ($FirebaseProjectId -ceq $ExpectedFirebaseProjectId)
    SeparateOperatorActions = @(
        'Create the contained database principal',
        'Provision reviewed paws.UserProfile rows',
        'Configure Static Web App application settings'
    )
}

$preview | ConvertTo-Json -Depth 6
if (-not $preview.FirebaseProjectConsistent) { exit 2 }
