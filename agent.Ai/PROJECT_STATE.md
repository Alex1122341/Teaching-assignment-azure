# PAWS Current Project State

**Last verified:** 2026-09-26  
**Repository:** `Alex1122341/Teaching-assignment-azure`

This file is intentionally concise. Detailed history belongs in `updates/`.

## 1. Immediate owner priority

**P0: connect the existing Azure Beta frontend to the existing Azure SQL database and get the Beta running.**

Not current priority:

- DOE engine migration
- DOE algorithm redesign
- new DOE engine
- full P3.1 Azure implementation
- Published Timetable implementation
- complete Firestore retirement
- broad future-domain redesign

DOE remains in the Experimental/Firebase demo track for now.

## 2. Repository tracks

### Experimental / Demo

Repository: `Alex1122341/Teaching-assignment`

Purpose:

- feature-forward development
- Firebase/Firestore demo
- DOE algorithm and engine work
- P3.1 architecture and future workflows
- synthetic/lab validation

Important P3.1 PR:

- PR #76
- branch `feature/scoped-parallel-assignment-workflow`
- accepted review HEAD `6ce74ef832d5d3a801d48d5e3cb03943c7cc47a1`
- open, Draft, mergeable at last verification

### Azure Beta

Repository: `Alex1122341/Teaching-assignment-azure`

Purpose:

- controlled real-user Beta
- Azure SQL migration/integration
- Azure runtime/release validation
- stability-sensitive feature ports

Current main:

- `71b7957a4df57e8c8dbd994f5f7c732e2f5706ad`

Frozen application baseline:

- `86bd5aa2c8a25259f3f708e49b322220ff43a147`

## 3. Current Azure SQL checkpoint

Server:

`ucvm-teaching-lab-xz-20260911.database.windows.net`

Database:

`teaching-assignment-lab`

Accepted loaded checkpoint:

| Object | Count/status |
|---|---:|
| `paws.Faculty` | 120 |
| `paws.Session` | 1,937 |
| `paws.SessionAssignment` | 4,970 |
| `paws.AfcRecord` | 791 |
| `paws.RoleAssignment` | 162 |
| `paws.vCalendarSession` | 1,937 |
| `paws.UserProfile` | 0 at last accepted checkpoint |
| `staging.ImportRow` | 6,838 |

The reset/load already completed.

**Do not rerun reset or the initial empty-database loader.**

## 4. Current Beta runtime before BETA-R1 deployment

The currently deployed Beta site still uses:

- Firebase Authentication
- Firestore project `tester-teaching` for the current deployed business runtime

Azure hosting does not by itself mean the deployed page is SQL-backed.

Saved read-only Firestore snapshot (2026-09-25) included:

- users 7
- faculty 117 (116 real + 1 synthetic placeholder)
- sessions 1,861
- faculty_groups 1
- change_requests 3
- afc_requests 2
- afc_audit 3
- session_change_log 8
- faculty_change_log 17
- account_audit 10
- public_schedule 1
- settings 5 derived documents

P3.1 future collections and LAB collections contained no Beta rows in that snapshot.

The Firestore/SQL session difference is a **net count difference**, not proof of exactly 76 missing sessions. It still requires deterministic reconciliation before any destructive session migration.

## 5. Current Beta PR state

### PR #3 — Azure SQL migration foundation

- Draft/open
- branch `feature/azure-sql-cutover-foundation`
- HEAD `edb46dc734613ea35bb211d1c98dd21bce851e33`
- mergeable at last verification
- foundation for loaded SQL schema/import tooling
- PR prose may contain historical empty-database wording; do not treat that wording as current live state

### PR #4 — old SQL session-read candidate

- Draft/open
- HEAD `d9244f5b0a841470ebf1a67b043f59c4b83ad9c2`
- mergeable false at last verification
- **HOLD / DO NOT MERGE AS-IS**
- useful implementation reference only

### PR #5 — Faculty enrichment Phase A

- Draft/open
- HEAD `a940902018315ca983ec2d6d362a1c1231247e07`
- mergeable at last verification
- `FacultyDirectoryProfile` is designed/tested but not live at last accepted checkpoint
- live apply requires a separate reviewed operator step

### PR #6 — BETA-R1 Azure SQL timetable read

- Draft/open
- branch `task/beta-r1-connect-azure-sql`
- base PR #3 exact HEAD `edb46dc...`
- HEAD `075852b150e8870b4e49e1076586cbbc82bc1bcb`
- mergeable at last verification
- implementation complete; not merged/deployed
- session read path: Firebase Auth → API → Azure SQL → existing timetable UI
- no Firestore fallback for the Azure session-read path
- session writes fail closed
- no DOE files changed

Last reported CI for PR #6:

- Azure SQL Migration Tests #46: SUCCESS
- Azure Beta Build #58: SUCCESS
- main Node tests: 290 pass / 0 fail / 29 skipped
- SQL runtime auth tests: 10/10 pass
- Firebase emulator regression: 319/319 pass
- deployment/baseline contract: 14/14 pass

## 6. BETA-R2 activation-preview result

BETA-R2 operator preview ran and stopped correctly before mutation.

Confirmed:

1. PR #6 exact HEAD/base and deployment artifact are ready.
2. six-profile + one-exclusion account structure is correct.
3. static narrow permission contract is correct except one wording mismatch ("five" vs six UserProfile columns).
4. no SQL/Azure/Firebase/Git/DOE mutation occurred.

Current blockers:

1. private reconciliation evidence does not contain the actual email/displayName values required by paws.UserProfile and the bootstrap preview tool;
2. live SQL principal state could not be inspected without interactive Entra device-code login;
3. SWA application-setting presence could not be inspected without Azure management authentication;
4. the runtime authentication mode behind paws_swa_beta remains unresolved for the SWA managed API bridge.

Reviewed account outcome:

- source Beta users: 7
- planned SQL profiles: 6
- HICC-2 excluded with `HUMAN_CONFIRMED_DELETE_ACCOUNT`
- HICC-1 requires the exact previously reviewed SQL Faculty link
- DVM viewer remains non-Faculty
- LAB viewer remains non-Faculty
- admin/global profiles have no FacultyId
- no fuzzy identity matching

## 7. Current breakpoint

BETA-R2b completed the remaining evidence collection but found an authentication blocker.

Resolved:

- six-profile private manifest completed from read-only Firestore user fields;
- bootstrap preview PASS: 6 profiles + 1 exclusion, unresolved 0, duplicates 0;
- plan SHA-256 recorded in the private/operator report;
- live SQL inspection confirmed `paws_swa_beta` is absent;
- deployed Beta still has no API: all current `/api/*` routes return platform 404;
- Azure SQL server has Entra-only authentication enabled.

Important correction from post-review web verification:

- Azure Static Web Apps managed Functions do **not** support Managed Identity;
- however SWA API application settings are supported as backend environment variables and can be configured through the Static Web App settings/CLI. The R2b inference that settings are "not applicable" until an API exists is too strong.

Current recommended minimal path, pending owner approval:

- keep the existing SWA managed API topology for Beta;
- create a dedicated Microsoft Entra service principal/app registration;
- create a contained Azure SQL user mapped to that service principal;
- apply the existing narrow `004_swa_beta_permissions.sql` contract;
- store the client ID/tenant ID/client secret only in SWA backend application settings/connection configuration;
- deploy PR #6 exact candidate;
- keep timetable writes disabled.

This avoids creating a new App Service/Function App for the immediate Beta milestone. Managed Identity can be reconsidered later for production hardening.

Stop before creating the Entra app/service principal, SQL user, settings, UserProfile inserts, or deployment until owner explicitly approves the live activation plan.
