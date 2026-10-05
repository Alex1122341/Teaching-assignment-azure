[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$InputPath,
    [ValidateSet('DryRun', 'Apply')][string]$Mode = 'DryRun'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$TargetHost = 'ITAPPVETOPSDB01'
$Database = 'VetMed-Ops'
$AcademicYear = '2026-27'
$VersionLabel = 'Faculty Master List DOE snapshot 2026-10-04'
$AcceptedWorkbookName = 'PAWS_DOE_Import_2026-27.xlsx'
$AcceptedWorkbookSha256 = '07D6E48F86D2F5213D14CE4964A765C90A6C4175486F074D18855BD4D810D90A'
$SourceReference = 'Faculty Master List.xlsx / DOE Summary / 2026-27 current DOE snapshot / PAWS_DOE_Import_2026-27.xlsx SHA256 07D6E48F86D2F5213D14CE4964A765C90A6C4175486F074D18855BD4D810D90A'
$CategoryCodes = @('scholarly_activity', 'ppvm_cost_share', 'clinical_unsorted', 'clinical_teaching', 'clinical_activity_ppvm', 'research', 'contract_admin', 'service_admin', 'other', 'onboarding')

if ($env:COMPUTERNAME -ne $TargetHost) { throw 'The DOE import must run locally on ITAPPVETOPSDB01.' }

function Normalize-Ucid([object]$Value) {
    if ($null -eq $Value) { return '' }
    return ([string]$Value).Trim()
}

function Normalize-Name([object]$Value) {
    if ($null -eq $Value) { return '' }
    $text = ([string]$Value).Normalize([System.Text.NormalizationForm]::FormKC).Trim()
    return [System.Text.RegularExpressions.Regex]::Replace($text, '\s+', ' ').ToLowerInvariant()
}

function Normalize-NameWithoutPunctuation([object]$Value) {
    $name = Normalize-Name $Value
    return [System.Text.RegularExpressions.Regex]::Replace($name, '[\p{P}\p{S}]', '')
}

function Reverse-CommaName([object]$Value) {
    $name = Normalize-Name $Value
    $parts = @($name.Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ })
    if ($parts.Count -lt 2) { return '' }
    return Normalize-Name (($parts[1..($parts.Count - 1)] + $parts[0]) -join ' ')
}

function New-Connection {
    $connection = [System.Data.SqlClient.SqlConnection]::new("Server=lpc:$TargetHost;Initial Catalog=$Database;Integrated Security=SSPI;Encrypt=False;Connect Timeout=20;Application Name=PAWS-DOE-Snapshot-Import;")
    $connection.Open()
    return $connection
}

function Invoke-Query([System.Data.SqlClient.SqlConnection]$Connection, [string]$Sql) {
    $command = $Connection.CreateCommand()
    $command.CommandText = $Sql
    try {
        $reader = $command.ExecuteReader()
        $rows = [System.Collections.Generic.List[object]]::new()
        while ($reader.Read()) {
            $item = [ordered]@{}
            for ($i = 0; $i -lt $reader.FieldCount; $i++) {
                $value = if ($reader.IsDBNull($i)) { $null } else { $reader.GetValue($i) }
                $item[$reader.GetName($i)] = $value
            }
            $rows.Add([pscustomobject]$item)
        }
        $reader.Dispose()
        return ,$rows.ToArray()
    } finally { $command.Dispose() }
}

$payload = Get-Content -LiteralPath $InputPath -Raw | ConvertFrom-Json
if ([string]$payload.academicYear -ne $AcademicYear) { throw 'DOE source academic year is not 2026-27.' }
if ([string]$payload.sourceFileName -ne $AcceptedWorkbookName -or [string]$payload.sourceFileSha256 -ne $AcceptedWorkbookSha256) { throw 'DOE source file identity does not match the accepted sanitized workbook.' }
if (@($payload.sourceRows).Count -ne 115) { throw 'DOE source row count does not match the accepted 115-row snapshot.' }
$inputErrors = [int]$payload.validationErrors
$sourceCounts = @{}
foreach ($row in @($payload.sourceRows)) {
    $ucid = Normalize-Ucid $row.ucid
    if (-not $ucid -or $ucid -notmatch '^\d+$') { $inputErrors++ }
    if ($ucid) { $sourceCounts[$ucid] = 1 + [int]$sourceCounts[$ucid] }
    if ($null -ne $row.teachingDoe -and ([double]$row.teachingDoe -lt 0 -or [double]$row.teachingDoe -gt 100)) { $inputErrors++ }
    foreach ($allocation in @($row.allocations)) {
        if ($allocation.categoryCode -notin $CategoryCodes -or [double]$allocation.allocationDoe -lt 0 -or [double]$allocation.allocationDoe -gt 100) { $inputErrors++ }
    }
}
$duplicateSourceCount = @($sourceCounts.Values | Where-Object { $_ -gt 1 }).Count
$inputErrors += $duplicateSourceCount

$connection = New-Connection
try {
    $facultyRows = Invoke-Query $connection "SELECT FacultyId, Ucid, DisplayName, Active FROM paws.Faculty;"
    $databaseByUcid = @{}
    $activeFacultyCount = 0
    foreach ($faculty in $facultyRows) {
        if ($faculty.Active -eq $true) { $activeFacultyCount++ }
        $ucid = Normalize-Ucid $faculty.Ucid
        if (-not $ucid) { continue }
        if (-not $databaseByUcid.ContainsKey($ucid)) { $databaseByUcid[$ucid] = [System.Collections.Generic.List[object]]::new() }
        $databaseByUcid[$ucid].Add($faculty)
    }

    $exactActive = 0; $exactInactive = 0; $noMatch = 0; $conflicts = $duplicateSourceCount
    $duplicateDatabaseUcid = 0; $nameMismatch = 0
    $commaOrderVariant = 0; $punctuationVariant = 0
    $targets = [System.Collections.Generic.List[object]]::new()
    $allocations = [System.Collections.Generic.List[object]]::new()
    foreach ($source in @($payload.sourceRows)) {
        $ucid = Normalize-Ucid $source.ucid
        $candidates = @()
        if ($ucid -and $databaseByUcid.ContainsKey($ucid)) {
            $candidates = [object[]]$databaseByUcid[$ucid].ToArray()
        }
        if ($candidates.Count -eq 0) { $noMatch++; continue }
        if ($candidates.Count -ne 1) {
            if ($candidates.Count -gt 1) { $duplicateDatabaseUcid++ }
            $conflicts++
            continue
        }
        $faculty = $candidates[0]
        $sourceName = Normalize-Name $source.sourceName
        $databaseName = Normalize-Name $faculty.DisplayName
        if ($sourceName -and $databaseName -and $sourceName -ne $databaseName) {
            if ((Reverse-CommaName $source.sourceName) -eq $databaseName -or (Reverse-CommaName $faculty.DisplayName) -eq $sourceName) {
                $commaOrderVariant++
            } elseif ((Normalize-NameWithoutPunctuation $source.sourceName) -eq (Normalize-NameWithoutPunctuation $faculty.DisplayName)) {
                $punctuationVariant++
            }
            $nameMismatch++; $conflicts++; continue
        }
        if ($faculty.Active -ne $true) { $exactInactive++; continue }

        $exactActive++
        $targets.Add([pscustomobject]@{
            facultyId = ([guid]$faculty.FacultyId).ToString()
            academicYear = $AcademicYear
            teachingDoe = if ($null -eq $source.teachingDoe) { $null } else { [double]$source.teachingDoe }
        })
        foreach ($allocation in @($source.allocations)) {
            $allocations.Add([pscustomobject]@{
                facultyId = ([guid]$faculty.FacultyId).ToString()
                academicYear = $AcademicYear
                categoryCode = [string]$allocation.categoryCode
                allocationDoe = [double]$allocation.allocationDoe
            })
        }
    }

    $nonTeachingCount = $allocations.Count
    $targetCount = @($targets | Where-Object { $null -ne $_.teachingDoe }).Count
    $summary = [ordered]@{
        SOURCE_ROWS = @($payload.sourceRows).Count
        EXACT_ACTIVE_MATCHES = $exactActive
        EXACT_INACTIVE_MATCHES = $exactInactive
        NO_MATCH = $noMatch
        CONFLICTS = $conflicts
        DUPLICATE_DATABASE_UCID = $duplicateDatabaseUcid
        NAME_MISMATCH = $nameMismatch
        NAME_COMMA_ORDER_VARIANT = $commaOrderVariant
        NAME_PUNCTUATION_VARIANT = $punctuationVariant
        TEACHING_TARGET_ROWS = $targetCount
        NON_TEACHING_ALLOCATION_ROWS = $nonTeachingCount
        VALIDATION_ERRORS = $inputErrors
        ACTIVE_FACULTY = $activeFacultyCount
        DOE_SOURCE_PRESENT = $exactActive
        DOE_SOURCE_MISSING = [Math]::Max(0, $activeFacultyCount - $exactActive)
    }
    [pscustomobject]$summary | ConvertTo-Json -Compress

    if ($Mode -eq 'DryRun') { return }
    if ($conflicts -ne 0 -or $inputErrors -ne 0 -or $noMatch -ne 0 -or $exactInactive -ne 0 -or $exactActive -ne @($payload.sourceRows).Count) {
        throw 'DOE import refused: every source row must have one exact active Faculty match with no conflicts or validation errors.'
    }

    $tables = Invoke-Query $connection "SELECT OBJECT_ID(N'paws.DoeFacultyAllocation', N'U') AS AllocationTableId, OBJECT_ID(N'paws.DoePolicyVersion', N'U') AS PolicyTableId, OBJECT_ID(N'paws.DoeFacultyTarget', N'U') AS TargetTableId;"
    if ($null -eq $tables[0].AllocationTableId -or $null -eq $tables[0].PolicyTableId -or $null -eq $tables[0].TargetTableId) { throw 'Required DOE schema migrations have not been applied.' }
    $existingVersion = Invoke-Query $connection "SELECT PolicyVersionId, SourceReference FROM paws.DoePolicyVersion WHERE AcademicYear = N'2026-27' AND VersionLabel = N'Faculty Master List DOE snapshot 2026-10-04';"
    $before = Invoke-Query $connection "SELECT (SELECT COUNT_BIG(DoeFacultyTargetId) FROM paws.DoeFacultyTarget WHERE AcademicYear=N'2026-27' AND Active=1) AS ActiveTeachingTargets, (SELECT COUNT_BIG(DoeFacultyAllocationId) FROM paws.DoeFacultyAllocation WHERE AcademicYear=N'2026-27' AND Active=1) AS ActiveAllocations, (SELECT COUNT_BIG(PolicyVersionId) FROM paws.DoePolicyVersion WHERE AcademicYear=N'2026-27') AS PolicyVersions;"
    if ($existingVersion.Count -eq 0 -and ([long]$before[0].ActiveTeachingTargets -ne 0 -or [long]$before[0].ActiveAllocations -ne 0)) {
        throw 'DOE import refused: existing 2026-27 active DOE data requires a reviewed before-state reconciliation.'
    }
    if ($existingVersion.Count -gt 0 -and [string]$existingVersion[0].SourceReference -ne $SourceReference) {
        throw 'DOE import refused: the snapshot version label already points to different source provenance.'
    }

    $importJson = [ordered]@{ targets = $targets.ToArray(); allocations = $allocations.ToArray() } | ConvertTo-Json -Depth 8 -Compress
    $command = $connection.CreateCommand()
    $command.CommandTimeout = 120
    $command.CommandText = @"
SET NOCOUNT ON;
SET XACT_ABORT ON;
BEGIN TRY
  BEGIN TRANSACTION;
  DECLARE @PolicyVersionId uniqueidentifier;
  SELECT @PolicyVersionId = PolicyVersionId
    FROM paws.DoePolicyVersion WITH (UPDLOCK, HOLDLOCK)
   WHERE AcademicYear = @AcademicYear AND VersionLabel = @VersionLabel;
  IF @PolicyVersionId IS NULL
  BEGIN
    SET @PolicyVersionId = NEWID();
    INSERT paws.DoePolicyVersion (PolicyVersionId, AcademicYear, VersionLabel, SourceReference, Active)
    VALUES (@PolicyVersionId, @AcademicYear, @VersionLabel, @SourceReference, 1);
  END
  ELSE
  BEGIN
    IF EXISTS (SELECT 1 FROM paws.DoePolicyVersion WHERE PolicyVersionId=@PolicyVersionId AND SourceReference<>@SourceReference)
      THROW 51440, 'Existing policy version source reference differs.', 1;
    UPDATE paws.DoePolicyVersion SET Active=1, UpdatedAtUtc=SYSUTCDATETIME() WHERE PolicyVersionId=@PolicyVersionId;
  END;

  CREATE TABLE #Targets (FacultyId uniqueidentifier NOT NULL PRIMARY KEY, AcademicYear nvarchar(32) NOT NULL, TeachingDoe decimal(12,6) NULL);
  INSERT #Targets (FacultyId, AcademicYear, TeachingDoe)
  SELECT FacultyId, AcademicYear, TeachingDoe
    FROM OPENJSON(@ImportJson, '$.targets') WITH (
      FacultyId uniqueidentifier '$.facultyId', AcademicYear nvarchar(32) '$.academicYear', TeachingDoe decimal(12,6) '$.teachingDoe'
    );
  CREATE TABLE #Allocations (FacultyId uniqueidentifier NOT NULL, AcademicYear nvarchar(32) NOT NULL, CategoryCode nvarchar(64) NOT NULL, AllocationDoe decimal(12,6) NOT NULL, PRIMARY KEY (FacultyId, AcademicYear, CategoryCode));
  INSERT #Allocations (FacultyId, AcademicYear, CategoryCode, AllocationDoe)
  SELECT FacultyId, AcademicYear, CategoryCode, AllocationDoe
    FROM OPENJSON(@ImportJson, '$.allocations') WITH (
      FacultyId uniqueidentifier '$.facultyId', AcademicYear nvarchar(32) '$.academicYear', CategoryCode nvarchar(64) '$.categoryCode', AllocationDoe decimal(12,6) '$.allocationDoe'
    );

  UPDATE target SET ContractTeachingDoe=source.TeachingDoe, Source=@SourceReference, PolicyVersionId=@PolicyVersionId, UpdatedAtUtc=SYSUTCDATETIME()
    FROM paws.DoeFacultyTarget target JOIN #Targets source ON source.FacultyId=target.FacultyId AND source.AcademicYear=target.AcademicYear
   WHERE target.Active=1;
  INSERT paws.DoeFacultyTarget (DoeFacultyTargetId, FacultyId, AcademicYear, ContractTeachingDoe, Source, PolicyVersionId, Active)
  SELECT NEWID(), source.FacultyId, source.AcademicYear, source.TeachingDoe, @SourceReference, @PolicyVersionId, 1
    FROM #Targets source
   WHERE NOT EXISTS (SELECT 1 FROM paws.DoeFacultyTarget target WHERE target.FacultyId=source.FacultyId AND target.AcademicYear=source.AcademicYear AND target.Active=1);

  UPDATE allocation SET Active=0, UpdatedAtUtc=SYSUTCDATETIME()
    FROM paws.DoeFacultyAllocation allocation
    JOIN #Targets target ON target.FacultyId=allocation.FacultyId AND target.AcademicYear=allocation.AcademicYear
   WHERE allocation.Active=1
     AND NOT EXISTS (SELECT 1 FROM #Allocations source WHERE source.FacultyId=allocation.FacultyId AND source.AcademicYear=allocation.AcademicYear AND source.CategoryCode=allocation.CategoryCode);
  UPDATE allocation SET AllocationDoe=source.AllocationDoe, SourceReference=@SourceReference, PolicyVersionId=@PolicyVersionId, UpdatedAtUtc=SYSUTCDATETIME()
    FROM paws.DoeFacultyAllocation allocation JOIN #Allocations source ON source.FacultyId=allocation.FacultyId AND source.AcademicYear=allocation.AcademicYear AND source.CategoryCode=allocation.CategoryCode
   WHERE allocation.Active=1;
  INSERT paws.DoeFacultyAllocation (DoeFacultyAllocationId, FacultyId, AcademicYear, CategoryCode, AllocationDoe, SourceReference, PolicyVersionId, Active)
  SELECT NEWID(), source.FacultyId, source.AcademicYear, source.CategoryCode, source.AllocationDoe, @SourceReference, @PolicyVersionId, 1
    FROM #Allocations source
   WHERE NOT EXISTS (SELECT 1 FROM paws.DoeFacultyAllocation allocation WHERE allocation.FacultyId=source.FacultyId AND allocation.AcademicYear=source.AcademicYear AND allocation.CategoryCode=source.CategoryCode AND allocation.Active=1);
  COMMIT TRANSACTION;
  SELECT @PolicyVersionId AS PolicyVersionId,
         (SELECT COUNT_BIG(DoeFacultyTargetId) FROM paws.DoeFacultyTarget WHERE AcademicYear=@AcademicYear AND Active=1 AND ContractTeachingDoe IS NOT NULL) AS ActiveTeachingTargets,
         (SELECT COUNT_BIG(DoeFacultyAllocationId) FROM paws.DoeFacultyAllocation WHERE AcademicYear=@AcademicYear AND Active=1) AS ActiveAllocations;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
"@
    foreach ($spec in @(
        @{ Name = '@AcademicYear'; Type = [System.Data.SqlDbType]::NVarChar; Size = 32; Value = $AcademicYear },
        @{ Name = '@VersionLabel'; Type = [System.Data.SqlDbType]::NVarChar; Size = 64; Value = $VersionLabel },
        @{ Name = '@SourceReference'; Type = [System.Data.SqlDbType]::NVarChar; Size = 512; Value = $SourceReference },
        @{ Name = '@ImportJson'; Type = [System.Data.SqlDbType]::NVarChar; Size = -1; Value = $importJson }
    )) {
        $parameter = $command.Parameters.Add($spec.Name, $spec.Type, $spec.Size)
        $parameter.Value = $spec.Value
    }
    try {
        $reader = $command.ExecuteReader()
        if ($reader.Read()) {
            [pscustomobject]@{
                IMPORT_STATUS = 'APPLIED'
                POLICY_VERSION_ID = [string]$reader['PolicyVersionId']
                ACTIVE_TEACHING_TARGETS = [long]$reader['ActiveTeachingTargets']
                ACTIVE_NON_TEACHING_ALLOCATIONS = [long]$reader['ActiveAllocations']
                BEFORE_ACTIVE_TEACHING_TARGETS = [long]$before[0].ActiveTeachingTargets
                BEFORE_ACTIVE_NON_TEACHING_ALLOCATIONS = [long]$before[0].ActiveAllocations
            } | ConvertTo-Json -Compress
        }
        $reader.Dispose()
    } finally { $command.Dispose() }
} finally { $connection.Dispose() }
