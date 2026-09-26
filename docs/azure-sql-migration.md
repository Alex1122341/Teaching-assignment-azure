# PAWS Azure SQL authoritative workbook migration

This runbook covers Phase 1 of the PAWS Firestore-to-Azure SQL cutover. The three approved workbooks are the sole initialization source.

This migration has two distinct checkpoints, and they must not be confused:

- **Historical pre-load checkpoint** — a verified-empty Azure SQL lab database (`objectCount = 0`) that gated the destructive reset and the guarded schema/data load. It is preserved below as evidence that the load started from an empty database. It is **not** the current database state.
- **Current post-load live state** — the guarded, non-destructive schema/data load has **completed**. `staging.ImportBatch` records the approved source manifest and a completed status, and the canonical `paws.*` tables hold the counts listed under [Current post-load live state](#current-post-load-live-state).

## Current post-load live state

The 2026-09-24 load has finished successfully. The accepted live state is:

```text
importStatus:         complete
sourceManifestSha256: e549a5d5aed4846a3f4860284049e77d258e1a5c236f80d4ea858cec5eab1cc4
```

| Table | Live rows |
| --- | --- |
| `paws.Faculty` | 120 |
| `paws.Session` | 1,937 |
| `paws.SessionAssignment` | 4,970 |
| `paws.AfcRecord` | 791 |
| `paws.RoleAssignment` | 162 |
| `paws.vCalendarSession` | 1,937 |
| `staging.ImportRow` | 6,838 |

Validation issues recorded for this source set: 14 (itemised in section 1).

The canonical `paws.Faculty` count of 120 is the normalized table size. The 116 Faculty Master business rows quoted in section 1 are the typed/source accounting (`staging.FacultyRaw`, `paws.FacultyProfessionalProfile`); they are a different measure and are not in conflict with the live canonical count.

Because the load is complete, the empty-database guard described in sections 2 and 3 now **fails by design**. Re-running the loader preview against the loaded database will report a non-empty inventory and refuse to continue. That refusal is the intended fail-closed behaviour, not a defect.

## Safety boundary

Target lab resources:

- SQL server: `ucvm-teaching-lab-xz-20260911.database.windows.net`
- database: `teaching-assignment-lab`

The supplied workbooks and generated import package are private. **Do not commit** the workbooks, generated JSONL package contents, device tokens, SQL access tokens, or any other credential material.

Firestore is not a source for this import. Do not compare against it, backfill from it, or use it to fill workbook gaps.

All non-empty workbook rows are preserved as generic `staging` evidence. Business-source rows are additionally preserved in typed `staging.*Raw` tables. Invalid records and explicitly excluded former-Faculty records stay in staging/validation evidence; they are not silently guessed into canonical relationships.

Canonical real-Faculty names come only from the Faculty Master `Preferred FULL Name (Last, First)` column and are rendered in PAWS as `First, Last`.

## 1. Build the private import package

Install the migration dependency from the approved migration branch:

```powershell
python -m pip install -r tools/requirements-azure-sql-migration.txt
```

Build the package outside the repository:

```powershell
python tools/build_azure_sql_import.py `
  --workload "C:\path\PAWS_Faculty_Workload_Normalized.xlsx" `
  --afc "C:\path\AFC Tracker Lookup (1).xlsx" `
  --faculty "C:\path\Partial Faculty Master List - September 21, 2026.xlsx" `
  --output-root "C:\path\PAWS Azure Import Package"
```

For the approved 2026-09-24 source set, the source manifest SHA-256 is:

```text
e549a5d5aed4846a3f4860284049e77d258e1a5c236f80d4ea858cec5eab1cc4
```

The package must account for:

- 6,838 non-empty raw workbook rows;
- 116 Faculty Master business rows;
- 116 Education & Experience rows;
- 14 Joint Appointments;
- 4,974 Teaching Assignment source rows;
- 1,937 canonical Sessions;
- **4,970 canonical SessionAssignments**;
- 162 Role Assignment rows;
- 43 Courses;
- 24 DOE Rules;
- 14 Account Roles;
- 798 AFC raw records;
- 791 canonical AFC records.

### Former Faculty: Erin Zachar

`Zachar, Erin` is no longer Faculty and is explicitly excluded from canonical PAWS business data.

For this approved source set:

- 4 Teaching Assignment source rows remain in typed/raw staging evidence but are excluded from `paws.SessionAssignment`;
- 4 AFC source rows remain in typed/raw staging evidence but are excluded from `paws.AfcRecord`;
- Erin must not appear in canonical `paws.Faculty`, `paws.SessionAssignment`, or `paws.RoleAssignment`;
- the 8 exclusions are reported as `TEACHING_FORMER_FACULTY_EXCLUDED` and `AFC_FORMER_FACULTY_EXCLUDED`, not as unresolved identity guesses.

The complete validation report for this source set contains 14 issues:

- 4 `TEACHING_FORMER_FACULTY_EXCLUDED`;
- 4 `AFC_FORMER_FACULTY_EXCLUDED`;
- 2 `AFC_END_BEFORE_START`;
- 1 `AFC_FACULTY_MISSING`;
- 1 `AFC_PURPOSE_MISSING`;
- 2 `FACULTY_EMAIL_INVALID` for source placeholder value `TBC`; the raw value remains staging evidence while canonical Faculty email is `NULL`.

## 2. Read-only Azure inventory

The read-only planner is:

```powershell
powershell -ExecutionPolicy Bypass -File tools/plan_paws_azure_sql_reset.ps1 `
  -Server "ucvm-teaching-lab-xz-20260911.database.windows.net" `
  -Database "teaching-assignment-lab"
```

It authenticates through Microsoft Entra device flow and performs catalog reads only.

Before the 2026-09-24 reset, the reviewed inventory contained exactly 18 legacy PAWS application objects. The exact destructive reset tool used for that reviewed scope is `tools/reset_paws_azure_sql_exact.ps1`; it is pinned to that inventory and requires the typed confirmation `RESET teaching-assignment-lab`.

That reset has already been completed for the current migration. Do not re-run it against a changed inventory.

### Historical pre-load checkpoint

The independent post-reset inventory below is **historical pre-load evidence only**. It recorded the database as empty immediately before the schema/data load and is the value the loader required as its gate. It is **not** the current database state — the load has since completed, so the live inventory is no longer empty (see [Current post-load live state](#current-post-load-live-state)).

```text
objectCount: 0
inventorySha256: 4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945
```

This is the SHA-256 of the canonical empty inventory `[]`.

## 3. Guarded empty-database preview

The current loader is `tools/load_paws_azure_sql_empty.ps1`.

It is intentionally not a reset tool. It contains no application-object removal path and refuses to continue unless:

- the server is exactly the reviewed PAWS lab server;
- the database is exactly `teaching-assignment-lab`;
- the package source manifest is exactly `e549a5d5aed4846a3f4860284049e77d258e1a5c236f80d4ea858cec5eab1cc4`;
- package line counts and validation issue counts match the approved source set;
- the live database inventory has `objectCount = 0`;
- the live inventory hash is exactly `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945`.

These were the gate conditions for the completed load. The two inventory conditions describe the **historical pre-load checkpoint**; against the current post-load database they no longer hold, and the loader is expected to refuse.

Run preview first:

```powershell
powershell -ExecutionPolicy Bypass -File tools/load_paws_azure_sql_empty.ps1 `
  -PackagePath "C:\path\PAWS Azure Import Package\e549a5d5aed4846a3f4860284049e77d258e1a5c236f80d4ea858cec5eab1cc4"
```

Preview performs local package validation plus live read-only Azure inventory validation. It does not create schemas or load data.

## 4. Apply the schema and data load

Only after preview returns `mode: preview` with the approved source and empty-inventory hashes, run:

```powershell
powershell -ExecutionPolicy Bypass -File tools/load_paws_azure_sql_empty.ps1 `
  -PackagePath "C:\path\PAWS Azure Import Package\e549a5d5aed4846a3f4860284049e77d258e1a5c236f80d4ea858cec5eab1cc4" `
  -Apply
```

Apply:

1. starts one Azure SQL transaction;
2. executes `database/azure-sql/001_foundation.sql`;
3. executes `database/azure-sql/002_calendar_view.sql`;
4. bulk-loads generic raw rows and typed staging rows;
5. bulk-loads canonical `paws.*` rows;
6. verifies expected counts and canonical exclusion of Erin Zachar;
7. runs SQL constraint verification;
8. marks `staging.ImportBatch` complete;
9. commits only after all checks pass.

Any exception before commit rolls the transaction back. The loader does not apply the application-permissions script yet; managed-identity permissions belong to the later App Service/API phase.

## 5. Post-load evidence

The completed load satisfied the following evidence contract. These conditions were the acceptance criteria for Apply and are the checks to re-verify if the load is ever rebuilt:

- 6,838 generic raw rows;
- 4,974 Teaching Assignment raw rows;
- 1,937 canonical Sessions;
- 4,970 canonical SessionAssignments;
- 798 AFC raw rows;
- 791 canonical AFC records;
- Erin Zachar absent from canonical Faculty/SessionAssignment/RoleAssignment data;
- all 14 validation issues preserved as evidence;
- enabled SQL constraints report no violations;
- `paws.vCalendarSession` returns 1,937 canonical sessions;
- `staging.ImportBatch` stores the exact source-manifest SHA and completed status.

The accepted live counts for the completed load are recorded under [Current post-load live state](#current-post-load-live-state).

Phase 1 does not switch the PAWS frontend to Azure SQL. Firebase Authentication remains, and the later API/frontend cutover will move business-data reads and writes behind the Azure App Service API.
