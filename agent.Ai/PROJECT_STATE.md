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

- `ffd870ee5faae298049df08d1bcb616832a07d87`

Frozen application baseline:

- `6eeb1a4ac8c9565a4afbf479277a7e2f543f9e26` (Runtime Commit A — BETA-R1 SQL-backed read runtime candidate)
- previous baseline `86bd5aa2c8a25259f3f708e49b322220ff43a147` is retained only as historical evidence
- the promoted baseline is **NOT YET DEPLOYED**; the live Azure beta site still predates BETA-R1

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

- merged to `main` on 2026-09-26 through normal merge commit `ffd870ee5faae298049df08d1bcb616832a07d87`
- prior main: `ea80eecc9fa2ac2b693c23979bad5c5809a26863`; PR head / Commit B: `c53cddb535947362b13e9cb3858e43b31330c923`
- Runtime Commit A `6eeb1a4ac8c9565a4afbf479277a7e2f543f9e26` and Commit B are ancestors of the merge commit
- merge tree equals Commit B tree; no merge-only runtime drift
- exact-main push CI: Azure SQL Migration Tests `36270254267` SUCCESS; Azure Beta Build `36270254345` SUCCESS
- implementation complete; **MERGED / NOT DEPLOYED**
- session read path: Firebase Auth → API → Azure SQL → existing timetable UI
- no Firestore fallback for the Azure session-read path
- session writes fail closed
- no DOE files changed

Frozen Beta runtime baseline (promoted by Commit B):

- `6eeb1a4ac8c9565a4afbf479277a7e2f543f9e26` — BETA-R1 SQL-backed read runtime candidate
- previous baseline `86bd5aa2c8a25259f3f708e49b322220ff43a147` is historical evidence only
- protected path set 44 → 45 (all 44 previous paths retained, plus `paws-data-client.js`)
- zero protected runtime drift is allowed on both `pull_request` and `push` to `main`
- **the promoted baseline is NOT YET DEPLOYED**; the live Azure beta site still predates BETA-R1

Exact-main CI for BETA-R1 merge `ffd870ee5faae298049df08d1bcb616832a07d87`:

- Azure SQL Migration Tests `36270254267`: SUCCESS (`push`, `main`)
- Azure Beta Build `36270254345`: SUCCESS (`push`, `main`)
- repository freeze: Commit A, protected `45`, drift `[]`
- built artifact freeze: Commit A, protected `45`; upload succeeded

## 6. BETA-R1 remaining live blockers

The code path exists, but real browser E2E remains blocked by live activation work.

At last checkpoint:

1. `paws.UserProfile` has no live profiles.
2. reviewed Beta profiles need deterministic provisioning.
3. runtime SQL principal/permissions need live verification/application.
4. SWA backend configuration must be reviewed/configured.
5. deployment has not happened.

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

The next safe work is **BETA-R2 activation preview**, not more feature development:

- generate/review the six-profile UserProfile apply plan;
- inspect whether `paws_swa_beta` exists and its effective permissions;
- inspect presence/absence of required SWA runtime setting names without exposing values;
- verify PR #6 deployment candidate;
- stop before every live mutation.

Only after an explicit owner-approved live activation step should profiles, principal/grants, settings or deployment be changed.
