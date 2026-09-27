# PAWS Current Project State

**Last verified:** 2026-09-27
**Repository:** `Alex1122341/Teaching-assignment-azure`

## 0. BETA-R4D-4A hardening breakpoint

The R4D-4 feature branch `task/beta-r4d4-aca-packaging` starts from the
verified Azure-Beta `main` SHA `ffd870ee5faae298049df08d1bcb616832a07d87`.
It prepares a Node.js 22 Functions-on-Container-Apps image and a UAMI-aware
SQL adapter only. No image has been pushed, no Azure resource has been
created or changed, and no SQL/Firebase/SWA/GitHub live mutation has been
performed. R4D-4A hardening is implemented on the branch and Draft PR #14 is
open. GitHub Azure Beta Build run `36289550648` passed, including the Linux
Docker build step:
https://github.com/Alex1122341/Teaching-assignment-azure/pull/14

This file is intentionally concise. Detailed history belongs in `updates/`.

## 0A. R4D-8B / R4D-9E breakpoint

R4D-8B authenticated proof is complete for both approved ADFA General
accounts. The ACA API returns 1,937 SQL-backed sessions; Account A also has a
deterministic ordered SQL TOP 3 source check. R4D-9E Runtime Commit E adds the
existing academic semester/week mapping to normalized SQL rows so calendar views
accept them; SQL/API/auth/CORS behavior remains unchanged. Runtime E is being
implemented on a feature branch from main `37b4db8a556cb12e588a0f95b08a83e793960851`:
the browser data client will call the exact ACA origin directly, while the
manual SWA deployment remains static-only. Governance Commit F must promote
the frozen baseline separately after review. No frontend deployment has been
performed and no tokens, UIDs, or credentials are stored here.

## 0B. BETA-R4D-9J session-time reconciliation breakpoint

R4D-9J is implemented on `feature/beta-r4d9j-session-time-reconciliation`
from fresh main `c090f73836d31ff02677b11f06a50dc8421d34af`. The source-backed
reconciliation covers all 1,937 live Azure SQL sessions and identifies 423
exact `SessionId` time corrections from `ucvm_timetable_master_2026-09-27.xlsx`;
ambiguous/unmatched records fail closed. The persistent correction layer runs
after stable SessionId generation. A read-only live preview confirmed all 423
old intervals, 1,937 sessions, 4,970 canonical SessionAssignment relationships,
and zero writes. `staging.TeachingAssignmentRaw` historically has 4,974 source
rows; it is not the canonical assignment count.

No live SQL update has been applied yet because
`PAWS_Faculty_Workload_Normalized.xlsx` was unavailable in the owner's normal
project/download/import folders, so the requested full temporary import rebuild
could not be repeated. No frontend file changed and no SWA deployment is needed.
Review is tracked in Draft PR #20.

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

- `4071f7f339418162e473d9a3c7830f625bc1fa35` (pre-R4D-9E main)

Frozen application baseline:

- `2b10aca5b9ab26ffecdffb685bddd33ae4de70f5` (Runtime Commit I — BETA-R4D-9H admin timetable access: automatic administrator Dashboard landing removed so authorized ADFA/admin accounts stay in the timetable)
- previous baselines `f74443d945a9f6c917e7e634eb2e7825f02c7ab0` (Runtime Commit G) and `6eeb1a4ac8c9565a4afbf479277a7e2f543f9e26` are retained only as historical evidence
- Governance Commit F is pending review; deployment remains a separate exact-main step.

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
- base `main` (`ea80eecc9fa2ac2b693c23979bad5c5809a26863`) — retargeted 2026-09-26 (BETA-R3A-2)
- **Runtime Commit A** `6eeb1a4ac8c9565a4afbf479277a7e2f543f9e26` merged current `main` INTO the
  PR branch (merge commit; parents `075852b…` + `ea80eecc…`; tree `543b00af…`)
- **Commit B (BETA-R3A-3)** — governance-only frozen-baseline promotion, parent = Commit A
- HEAD = Commit B (tip of `task/beta-r1-connect-azure-sql`)
- mergeable at last verification
- implementation complete; **NOT merged**; **NOT deployed**
- session read path: Firebase Auth → API → Azure SQL → existing timetable UI
- no Firestore fallback for the Azure session-read path
- session writes fail closed
- no DOE files changed
- the 4 BETA-R1 commits `c006c9a`, `b230718`, `4af5af8`, `075852b` are preserved unchanged

Frozen Beta runtime baseline (promoted by Commit B):

- `6eeb1a4ac8c9565a4afbf479277a7e2f543f9e26` — BETA-R1 SQL-backed read runtime candidate
- previous baseline `86bd5aa2c8a25259f3f708e49b322220ff43a147` is historical evidence only
- protected path set 44 → 45 (all 44 previous paths retained, plus `paws-data-client.js`)
- zero protected runtime drift is allowed on both `pull_request` and `push` to `main`
- **the promoted baseline is NOT YET DEPLOYED**; the live Azure beta site still predates BETA-R1

Current CI for PR #6 (fresh, `pull_request`, base `main` @ `ea80eecc…`):

- Approved Commit A: Azure SQL Migration Tests `36265424485` SUCCESS;
  Azure Beta Build `36265424535` SUCCESS (head `6eeb1a4…`)
- Commit B CI: recorded in the BETA-R3A-3 report (new run IDs only)
- retired evidence: runs `36249819711` / `36249819750` are pre-retarget historical
  (checkout `Merge 075852b… into edb46dc…`) — do not reuse

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
