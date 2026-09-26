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

- `ea80eecc9fa2ac2b693c23979bad5c5809a26863` (PR #3 merged here 2026-09-26; see update `2026-09-26-pr3-merged-to-main.md`)

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

- **MERGED into `main` at `ea80eecc9fa2ac2b693c23979bad5c5809a26863`** (2026-09-26)
- branch `feature/azure-sql-cutover-foundation` (tip `edb46dc734613ea35bb211d1c98dd21bce851e33` = PR #3 HEAD, now ancestor of `main`)
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
- base `main` (`ea80eecc9fa2ac2b693c23979bad5c5809a26863`) — **RETARGETED 2026-09-26 (BETA-R3A-2)**; HEAD unchanged
- **Runtime Commit A (2026-09-26, BETA-R3A-2B):** current `main` merged INTO the PR branch —
  HEAD is now `6eeb1a4ac8c9565a4afbf479277a7e2f543f9e26`, a merge commit with parents
  `075852b150e8870b4e49e1076586cbbc82bc1bcb` and `ea80eecc9fa2ac2b693c23979bad5c5809a26863`.
  The 4 BETA-R1 commits (`c006c9a`, `b230718`, `4af5af8`, `075852b`) are preserved unchanged.
  Commit A content delta = documentation/governance only (`AGENTS.md` + 15 `agent.Ai/**`);
  runtime files, workflows, tests and tools are byte-identical. Runtime semantic change 0,
  DOE changes 0, BETA-R1 scope lost 0, PR scope vs `main` still 42 files.
- mergeable at last verification
- implementation complete; **not merged**; not deployed
- session read path: Firebase Auth → API → Azure SQL → existing timetable UI
- no Firestore fallback for the Azure session-read path
- session writes fail closed
- no DOE files changed

**Current CI for PR #6** (fresh, head `6eeb1a4ac8c9565a4afbf479277a7e2f543f9e26`, event
`pull_request`, base `main` @ `ea80eecc…`):

- Azure SQL Migration Tests run `36265424485`: SUCCESS
- Azure Beta Build run `36265424535`: SUCCESS
  - `npm test` SUCCESS; server SQL runtime authorization tests SUCCESS; `npm run test:emulator`
    (Firebase emulator regression) SUCCESS; `node tools/build-beta-release.js` SUCCESS
  - **Verify strict frozen main runtime → SKIPPED** (gated `github.event_name == 'push'`)
  - **Verify explicit Beta-R1 release-candidate drift → SUCCESS** (runs
    `node tools/verify-beta-candidate.js`; output `ok: true`, baseline `86bd5aa`,
    intentional drift only in `index.html`, `paws-data-client.js`, `timetable.js`)
  - `beta-baseline.test.js` + `azure-deployment.test.js` SUCCESS; `upload-artifact` SUCCESS
- frozen baseline `86bd5aa` unchanged; **not promoted** (Commit B not created)

**Retired CI evidence (do not reuse as post-retarget evidence):**

- Azure SQL Migration Tests run `36249819711` and Azure Beta Build run `36249819750` were
  **pre-retarget historical** runs (head `075852b`). The Azure Beta Build checkout log for
  that run showed `Merge 075852b... into edb46dc...` — PR #6 HEAD combined with the old
  PR #3 HEAD, not with current `main`.
- Correction: `tools/verify-beta-candidate.js` **IS** wired into `azure-beta-build.yml`
  (step `Verify explicit Beta-R1 release-candidate drift`); the earlier note calling it
  unwired was wrong.
- Correction: strict beta-freeze + artifact freeze did **NOT** run on the PR candidate; that
  step is SKIPPED on `pull_request`.

**Merge status:** PR #6 must **NOT** be merged yet. Merging would put BETA-R1 runtime on
`main` while the frozen baseline still points at `86bd5aa`, creating a failing intermediate
`main` build. Commit B (freeze promotion) is a separate reviewed task.

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
