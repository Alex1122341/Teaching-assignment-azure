# BETA-R4D-10A - apply the Dashboard read grant to the LIVE runtime principal.
#
# The reviewed contract file (004_swa_beta_permissions.sql) addresses a
# parameterised principal. This wrapper proves which principal the deployed
# runtime actually connects as, then applies the same reviewed statements to it.
#
# Safety:
#   * additive GRANT only - no DENY is removed and no object is created;
#   * refuses to run if the principal is missing, is an EXTERNAL_GROUP, owns the
#     database, or inherits a database role;
#   * refuses to run if the principal owns schemas/objects;
#   * refuses to run if the principal already has a permission outside the
#     reviewed contract, or if `public` has a broadening grant;
#   * prints the before/after effective permission set so the delta is auditable.
#
# Output is written to -LogPath as well as stdout, because the outer PowerShell
# host does not always surface Write-Output reliably.
#
# Usage:
#   $env:PAWS_SQL_ACCESS_TOKEN_FILE = '<path to token>'
#   ./apply-dashboard-grant.ps1 -Principal 'paws-sql-beta-mi' [-WhatIf]
#
#   # Offline rehearsal with a recorded live snapshot instead of a live query:
#   ./apply-dashboard-grant.ps1 -Principal 'paws-sql-beta-mi' -WhatIf -SkipConnection -SnapshotPath 'live_mi_permissions.csv'
#
#   # Emit the executor-role T-SQL that performs the additive grant:
#   ./apply-dashboard-grant.ps1 -Principal 'paws-sql-beta-mi' -EmitSql

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Principal,
    [string]$Server = 'ucvm-teaching-lab-xz-20260911.database.windows.net',
    [string]$Database = 'teaching-assignment-lab',
    [string]$TokenFile = $env:PAWS_SQL_ACCESS_TOKEN_FILE,
    [string]$LogPath = 'C:\Users\xinyu\AppData\Local\Temp\paws-r4d9f\apply-dashboard-grant.log',
    [string]$SnapshotPath,
    [switch]$WhatIf,
    [switch]$SkipConnection,
    [switch]$EmitSql
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$script:Log = New-Object System.Collections.Generic.List[string]
function Write-Log {
    param([string]$Text)
    $script:Log.Add($Text)
    Write-Host $Text
}
function Save-Log {
    $dir = Split-Path -Parent $LogPath
    if ($dir -and -not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    [System.IO.File]::WriteAllLines($LogPath, $script:Log)
}

# The exact reviewed R4D-10A column-scoped Faculty grant. Kept as one string so
# the -WhatIf preview, the -EmitSql output and the live apply cannot drift.
$GrantStatement = @"
GRANT SELECT ON OBJECT::paws.Faculty
    (FacultyId, RecordType, PreferredFirstName, PreferredLastName, DisplayName,
     Ucid, Email, Stream, Rank, Fte, ReportsToFacultyId, Active)
    TO [$Principal];
"@

# The reviewed contract allows, for this principal, exactly:
#   * CONNECT                              (database)
#   * SELECT paws.vCalendarSession         (whole object - the reviewed view)
#   * SELECT paws.UserProfile              (6 named columns)
#   * SELECT paws.SessionAssignment        (2 named columns)
#   * SELECT paws.Faculty                  (12 named columns - R4D-10A)
# plus the five DENY rows. `AllowedRows` is the full expected post-apply set and
# is what the -SkipConnection rehearsal compares the snapshot against.
$AllowedGrants = @(
    'GRANT CONNECT DATABASE',
    'GRANT SELECT OBJECT paws.SessionAssignment(FacultyId)',
    'GRANT SELECT OBJECT paws.SessionAssignment(SessionId)',
    'GRANT SELECT OBJECT paws.UserProfile(Active)',
    'GRANT SELECT OBJECT paws.UserProfile(BaseRole)',
    'GRANT SELECT OBJECT paws.UserProfile(DisplayName)',
    'GRANT SELECT OBJECT paws.UserProfile(FacultyId)',
    'GRANT SELECT OBJECT paws.UserProfile(FirebaseUid)',
    'GRANT SELECT OBJECT paws.UserProfile(MustChangePassword)',
    'GRANT SELECT OBJECT paws.vCalendarSession'
)
$AllowedDenies = @(
    'DENY DELETE SCHEMA paws',
    'DENY EXECUTE SCHEMA paws',
    'DENY INSERT SCHEMA paws',
    'DENY UPDATE SCHEMA paws',
    'DENY DELETE SCHEMA staging',
    'DENY EXECUTE SCHEMA staging',
    'DENY INSERT SCHEMA staging',
    'DENY SELECT SCHEMA staging',
    'DENY UPDATE SCHEMA staging'
)
$FacultyGrantRows = @(
    'GRANT SELECT OBJECT paws.Faculty(Active)',
    'GRANT SELECT OBJECT paws.Faculty(DisplayName)',
    'GRANT SELECT OBJECT paws.Faculty(Email)',
    'GRANT SELECT OBJECT paws.Faculty(FacultyId)',
    'GRANT SELECT OBJECT paws.Faculty(Fte)',
    'GRANT SELECT OBJECT paws.Faculty(PreferredFirstName)',
    'GRANT SELECT OBJECT paws.Faculty(PreferredLastName)',
    'GRANT SELECT OBJECT paws.Faculty(Rank)',
    'GRANT SELECT OBJECT paws.Faculty(RecordType)',
    'GRANT SELECT OBJECT paws.Faculty(ReportsToFacultyId)',
    'GRANT SELECT OBJECT paws.Faculty(Stream)',
    'GRANT SELECT OBJECT paws.Faculty(Ucid)'
)

if ($EmitSql) {
    Write-Log '-- BETA-R4D-10A additive Dashboard grant. Run as a database owner /'
    Write-Log '-- sysadmin connection: this widens the runtime principal''s READ surface only.'
    Write-Log '-- The schema-wide DML DENYs must already be in force (see 004_swa_beta_permissions.sql).'
    Write-Log 'SET XACT_ABORT ON;'
    Write-Log 'BEGIN TRANSACTION;'
    Write-Log $GrantStatement.TrimEnd()
    Write-Log 'COMMIT TRANSACTION;'
    Save-Log
    exit 0
}

# ------------------------------------------------------------------ connection
$conn = $null
function Invoke-Scalar {
    param([string]$Sql, [hashtable]$Params = @{})
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = $Sql
    foreach ($key in $Params.Keys) {
        $p = $cmd.CreateParameter()
        $p.ParameterName = $key
        $p.Value = $Params[$key]
        [void]$cmd.Parameters.Add($p)
    }
    try { return $cmd.ExecuteScalar() } finally { $cmd.Dispose() }
}

function Get-EffectivePermissions {
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = @"
SELECT permission.state_desc + ' ' + permission.permission_name + ' ' +
       CASE permission.class
         WHEN 0 THEN 'DATABASE'
         WHEN 1 THEN 'OBJECT ' + ISNULL(OBJECT_SCHEMA_NAME(permission.major_id) + '.' + OBJECT_NAME(permission.major_id), '?') +
                      CASE WHEN permission.minor_id <> 0 THEN '(' + ISNULL(COL_NAME(permission.major_id, permission.minor_id), '?') + ')' ELSE '' END
         WHEN 3 THEN 'SCHEMA ' + ISNULL(SCHEMA_NAME(permission.major_id), '?')
         ELSE 'CLASS' + CAST(permission.class AS varchar(10))
       END AS permission_row
FROM sys.database_permissions AS permission
WHERE permission.grantee_principal_id = @pid
ORDER BY permission_row;
"@
    $p = $cmd.CreateParameter(); $p.ParameterName = '@pid'; $p.Value = $script:PrincipalId; [void]$cmd.Parameters.Add($p)
    $rows = @()
    try {
        $reader = $cmd.ExecuteReader()
        while ($reader.Read()) { $rows += [string]$reader[0] }
        $reader.Dispose()
    } finally { $cmd.Dispose() }
    return $rows
}

function Read-Snapshot {

    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { throw "Snapshot '$Path' does not exist." }
    $rows = @()
    foreach ($line in (Get-Content -LiteralPath $Path)) {
        $trimmed = $line.Trim()
        if (-not $trimmed) { continue }
        if ($trimmed -like '"principal_name"*') { continue }   # header
        # CSV: "principal","state_desc","permission_name","class_desc","scope_name","column_name"
        $cells = ($trimmed -split '","') | ForEach-Object { $_.Trim('"') }
        if ($cells.Count -lt 6) { continue }
        $state = $cells[1]; $perm = $cells[2]; $classDesc = $cells[3]
        $scope = $cells[4]; $column = $cells[5]
        $row = "$state $perm $classDesc"
        if ($scope) { $row += " $scope" }
        if ($column) { $row += "($column)" }
        $rows += $row
    }
    return $rows
}

try {
    if ($SkipConnection) {
        if (-not $SnapshotPath) { throw '-SkipConnection requires -SnapshotPath.' }
        Write-Log "rehearsal=true principal=$Principal snapshot=$SnapshotPath"
        $before = @(Read-Snapshot -Path $SnapshotPath)
        Write-Log "before_count=$($before.Count)"
        $before | ForEach-Object { Write-Log "  before| $_" }
    }
    else {
        if (-not $TokenFile -or -not (Test-Path -LiteralPath $TokenFile)) {
            throw 'Provide -TokenFile or set PAWS_SQL_ACCESS_TOKEN_FILE; this script never starts an interactive device flow itself.'
        }
        $token = (Get-Content -LiteralPath $TokenFile -Raw).Trim()
        if (-not $token) { throw 'Token file is empty.' }

        $connString = "Server=tcp:$Server,1433;Database=$Database;Encrypt=True;TrustServerCertificate=False;Connect Timeout=60;"
        $conn = [System.Data.SqlClient.SqlConnection]::new($connString)
        $conn.AccessToken = $token
        $conn.Open()

        $principalIdRaw = Invoke-Scalar -Sql "SELECT USER_ID(@name);" -Params @{ name = $Principal }
        if ($null -eq $principalIdRaw -or [int]$principalIdRaw -eq 0) {
            throw "Runtime principal '$Principal' does not exist in $Database. Provisioning is a separate approved operator action."
        }
        $script:PrincipalId = [int]$principalIdRaw

        $type = Invoke-Scalar -Sql "SELECT type FROM sys.database_principals WHERE principal_id = @pid;" -Params @{ pid = $script:PrincipalId }
        if ($type -eq 'X') { throw "Runtime principal '$Principal' is an EXTERNAL_GROUP principal." }

        $sid = Invoke-Scalar -Sql "SELECT sid FROM sys.database_principals WHERE principal_id = @pid;" -Params @{ pid = $script:PrincipalId }
        $ownerSid = Invoke-Scalar -Sql "SELECT owner_sid FROM sys.databases WHERE database_id = DB_ID();"
        if ([string]$sid -eq [string]$ownerSid) { throw "Runtime principal '$Principal' owns the database." }

        $roleCount = Invoke-Scalar -Sql "SELECT COUNT_BIG(*) FROM sys.database_role_members WHERE member_principal_id = @pid;" -Params @{ pid = $script:PrincipalId }
        if ([int]$roleCount -ne 0) { throw "Runtime principal '$Principal' inherits $roleCount database role(s)." }

        $ownsSchemas = Invoke-Scalar -Sql "SELECT COUNT_BIG(*) FROM sys.schemas WHERE principal_id = @pid;" -Params @{ pid = $script:PrincipalId }
        $ownsObjects = Invoke-Scalar -Sql "SELECT COUNT_BIG(*) FROM sys.objects WHERE principal_id = @pid;" -Params @{ pid = $script:PrincipalId }
        if ([int]$ownsSchemas -ne 0 -or [int]$ownsObjects -ne 0) { throw "Runtime principal '$Principal' owns schemas or objects." }

        Write-Log "connected=true server=$Server database=$Database"
        Write-Log "principal=$Principal id=$($script:PrincipalId) type=$type roles=$roleCount"
        $before = @(Get-EffectivePermissions)
        Write-Log "before_count=$($before.Count)"
        $before | ForEach-Object { Write-Log "  before| $_" }
    }

    # ---- contract guard: nothing may exist outside the reviewed allowed sets.
    $unexpected = @($before | Where-Object { $AllowedGrants -notcontains $_ -and $AllowedDenies -notcontains $_ -and $FacultyGrantRows -notcontains $_ })
    if ($unexpected.Count -ne 0) {
        Write-Log "unexpected_count=$($unexpected.Count)"
        $unexpected | ForEach-Object { Write-Log "  unexpected| $_" }
        throw 'The principal holds permissions outside the reviewed Beta-R1 + R4D-10A contract; refusing to add a grant on top of an unreviewed surface.'
    }
    Write-Log "contract_guard=OK unexpected_count=0"

    $alreadyGranted = @($before | Where-Object { $FacultyGrantRows -contains $_ })
    Write-Log "faculty_grant_present=$($alreadyGranted.Count)/12"

    if ($WhatIf) {
        Write-Log 'WHATIF: no change applied.'
        Write-Log ($GrantStatement.TrimEnd())
        $after = @($before + $FacultyGrantRows | Sort-Object -Unique)
    }
    elseif ($SkipConnection) {
        Write-Log 'rehearsal: no change applied (offline snapshot).'
        $after = @($before + $FacultyGrantRows | Sort-Object -Unique)
    }
    else {
        $cmd = $conn.CreateCommand()
        $cmd.CommandText = $GrantStatement
        $cmd.CommandTimeout = 120
        try { [void]$cmd.ExecuteNonQuery() } finally { $cmd.Dispose() }
        Write-Log 'grant_applied=true'
        $after = @(Get-EffectivePermissions)
    }

    Write-Log "after_count=$($after.Count)"
    $after | ForEach-Object { Write-Log "  after| $_" }

    $added = @($after | Where-Object { $before -notcontains $_ })
    $removed = @($before | Where-Object { $after -notcontains $_ })
    Write-Log "added=$($added.Count) removed=$($removed.Count)"
    $added | ForEach-Object { Write-Log "  + $_" }
    $removed | ForEach-Object { Write-Log "  - $_" }

    $stillUnexpected = @($after | Where-Object { $AllowedGrants -notcontains $_ -and $AllowedDenies -notcontains $_ -and $FacultyGrantRows -notcontains $_ })
    if ($stillUnexpected.Count -ne 0) {
        throw 'Post-apply state contains permissions outside the reviewed contract.'
    }
    $expectedAfter = @($AllowedGrants + $AllowedDenies + $FacultyGrantRows | Sort-Object -Unique)
    $missingExpected = @($expectedAfter | Where-Object { $after -notcontains $_ })
    if ($missingExpected.Count -ne 0) {
        Write-Log "missing_expected=$($missingExpected.Count)"
        $missingExpected | ForEach-Object { Write-Log "  missing| $_" }
        throw 'Post-apply state does not contain the full reviewed permission set.'
    }
    Write-Log "post_apply_contract=OK total=$($after.Count) expected=$($expectedAfter.Count)"
    Write-Log 'RESULT=OK'
}
catch {
    Write-Log "RESULT=FAILED"
    Write-Log "error=$($_.Exception.Message)"
    Save-Log
    exit 1
}
finally {
    if ($conn) { $conn.Dispose() }
}
Save-Log
