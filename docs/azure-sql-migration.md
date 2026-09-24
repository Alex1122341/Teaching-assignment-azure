# PAWS Azure SQL authoritative workbook migration

This runbook covers Phase 1 of the PAWS Firestore-to-Azure SQL cutover. It builds a private, content-addressed import package from the three approved workbooks, produces a read-only inventory of the current lab database, and then performs a guarded destructive clean rebuild only after the inventory and package hashes have been reviewed.

## Safety boundary

Target lab resources:

- SQL server: `ucvm-teaching-lab-xz-20260911.database.windows.net`
- database: `teaching-assignment-lab`

The clean rebuild is limited to user-created application objects inside this database. It must not delete the Azure SQL logical server, subscription/resource group, Entra administrator, server network configuration, system databases, or database security principals.

The supplied workbooks and generated import package are private. **Do not commit** the workbooks, `azure-sql-import-private/`, JSONL files, device tokens, connection tokens, or any other credential material.

Firestore is not a source for this import. Do not compare against it, backfill from it, or use it to fill workbook gaps.

All non-empty workbook rows are preserved in generic `staging` evidence. Business-source rows are additionally preserved in typed `staging.*Raw` tables. Invalid or unresolved records remain in staging and in the validation report; they are not silently discarded, guessed, or linked to the wrong Faculty.

Canonical real-Faculty names come only from the Faculty Master `Preferred FULL Name (Last, First)` column and are rendered in PAWS as `First, Last`.

## 1. Build the private import package

From a checkout of the approved migration branch, install the migration dependency:

```powershell
python -m pip install -r tools/requirements-azure-sql-migration.txt
```

Build the package outside the repository:

```powershell
python tools/build_azure_sql_import.py `
  --workload "C:\path\PAWS_Faculty_Workload_Normalized.xlsx" `
  --afc "C:\path\AFC Tracker Lookup (1).xlsx" `
  --faculty "C:\path\Partial Faculty Master List - September 21, 2026.xlsx" `
  --output-root "..\azure-sql-import-private"
```

The command prints the content-addressed package directory and `sourceManifestSha256`. Review `manifest.json`, `normalization_summary.json`, and `validation_issues.jsonl` before touching Azure.

For the approved 2026-09-24 source set, preflight must account for:

- 116 Faculty business rows from `Key`, plus the `Key!A119` formula summary preserved only in generic raw staging;
- 116 Education & Experience rows;
- 14 Joint Appointments;
- 4,974 Teaching Assignment rows;
- 1,937 canonical Sessions;
- 162 Role Assignment rows;
- 43 Courses;
- 24 DOE Rules;
- 14 Account Roles;
- 798 AFC source records.

Known invalid/unresolved rows must be visible in the validation report rather than coerced into valid data.

## 2. Produce the read-only reset plan

Run the planner first. It authenticates through Microsoft Entra device flow and performs catalog reads only.

```powershell
powershell -ExecutionPolicy Bypass -File tools/plan_paws_azure_sql_reset.ps1 `
  -Server "ucvm-teaching-lab-xz-20260911.database.windows.net" `
  -Database "teaching-assignment-lab"
```

The final JSON contains:

- server/database;
- ordered user-created object inventory;
- object count;
- `inventorySha256`.

Review every listed object. If an object is not clearly part of this dedicated PAWS lab database, stop before Apply and investigate it.

Legacy objects such as `dbo.FirestoreDocument` and `dbo.FirestoreImportRun` may appear and are expected to be removed by a successful clean rebuild.

## 3. Destructive Apply

Apply is destructive. It removes the reviewed user-created application objects in `teaching-assignment-lab`, rebuilds the `staging` and `paws` schemas, bulk-loads the exact reviewed package, verifies postconditions, and commits only after required invariants pass.

Use the exact hash values from the reviewed package and read-only plan:

```powershell
powershell -ExecutionPolicy Bypass -File tools/import_paws_azure_sql.ps1 `
  -PackagePath "..\azure-sql-import-private\<content-addressed-package>" `
  -ExpectedSourceManifestSha256 "<manifest sha256>" `
  -ExpectedInventorySha256 "<reviewed inventory sha256>" `
  -Confirmation "RESET teaching-assignment-lab"
```

The angle-bracket values are runtime values copied from the generated evidence. Do not replace them in source code and do not paste access tokens into source files, chat, PR comments, or logs.

Apply fails before destructive SQL if:

- the database name is not exactly `teaching-assignment-lab`;
- the typed confirmation is not exactly `RESET teaching-assignment-lab`;
- the package source-manifest hash differs;
- a package file/count differs from `manifest.json`;
- the live object inventory differs from the reviewed inventory hash.

Within the transaction, any exception triggers rollback. A success JSON is emitted only after post-load checks pass and the transaction commits.

## 4. Required post-load evidence

A successful result must demonstrate:

- no legacy Firestore mirror tables remain;
- generic raw and typed staging counts match the package manifest;
- normalized Session and SessionAssignment counts match the package manifest;
- SQL foreign-key/check/unique constraints remain enabled and trusted;
- the completed `staging.ImportBatch` stores the exact source manifest hash;
- invalid or unresolved source rows remain visible in staging/validation evidence;
- `paws.vCalendarSession` is built from canonical `paws.Session` + Preferred Faculty display names rather than a duplicate writable calendar table.

Phase 1 does not switch the PAWS frontend to Azure SQL. That happens only after the separate API and frontend cutover phases pass their own acceptance gates.