# PAWS Task Chain

**Last updated:** 2026-09-27

## BETA-R4D-9J — Authoritative session-time reconciliation

Status: **IMPLEMENTED / LIVE PREVIEW PASSED / SQL APPLY BLOCKED**

- Branch: `feature/beta-r4d9j-session-time-reconciliation`
- Base main: `c090f73836d31ff02677b11f06a50dc8421d34af`
- 1,937 current sessions reconciled; 423 source-backed exact corrections.
- Existing SessionIds are preserved because corrections apply after canonical
  identity generation.
- Live preview: 1,937 sessions, 4,970 canonical SessionAssignments, 423/423 old
  intervals matched, zero writes.
- `PAWS_Faculty_Workload_Normalized.xlsx` is not available locally, so the full
  temporary import rebuild gate remains incomplete. Do not run `-Apply` until
  that workbook is supplied and the 1,937-ID/4,970-relationship rebuild passes.
- No protected frontend file changed; no baseline promotion or SWA deployment.

## BETA-R4D-9B — Runtime Commit C

Status: **IMPLEMENTED / MERGED / DEPLOYED**

- Fresh base main: `37b4db8a556cb12e588a0f95b08a83e793960851`
- Goal: direct browser timetable reads to the approved ACA API with Firebase
  Auth retained, no Firestore session fallback, and writes fail-closed.
- The production SWA workflow must remain manual exact-main and must not attach
  `.azure-production/api`; the API artifact may remain buildable for packaging.
- Runtime Commit C intentionally changed the protected browser client. Governance
  Commit D is the separate follow-up that promotes the frozen baseline to C.
- No Azure/Firebase/SQL mutation or deployment is part of R4D-9B.

## BETA-R4D-9C — Governance Commit D

Status: **IMPLEMENTED / MERGED / DEPLOYED**

- Parent was Runtime Commit C `4fed98d908476df7c4066062ad6435194d3b0493`; Governance Commit D is now merged and deployed.
- Governance-only changes update the immutable freeze anchor and active docs/tests.
- PR #16 remains the existing review vehicle; no replacement PR is allowed.

## BETA-R4D-9E — Runtime Commit E

Status: **IMPLEMENTED / PR #17 OPEN / GOVERNANCE PROMOTION IN PROGRESS**

- Base main: `4071f7f339418162e473d9a3c7830f625bc1fa35`.
- Branch: `feature/beta-r4d9e-calendar-period-mapping`.
- `azureSessionRow` derives `semester` and `week` from the existing academic
  date mapping; invalid dates fail closed.
- SQL/API/backend/auth/CORS behavior is unchanged.

## BETA-R4D-9H — Governance Commit J

Status: **IN PROGRESS / NOT MERGED / NOT DEPLOYED**

- Parent must be Runtime Commit I `2b10aca5b9ab26ffecdffb685bddd33ae4de70f5`.
- Governance-only changes promote the freeze anchor and update active tests/docs.
- Keep PR #19 as the only review vehicle; do not create a replacement PR.

## BETA-R4D-4 — ACA packaging + UAMI SQL adapter

Status: **R4D-4A HARDENED / CI GREEN / DRAFT PR OPEN**

- Branch: `task/beta-r4d4-aca-packaging`
- Base: `main` at `ffd870ee5faae298049df08d1bcb616832a07d87`
- Adds the official Node 22 Functions Dockerfile, deterministic API artifact
  packaging, private-file exclusions, and explicit `mssql` Azure AD default
  authentication for `PAWS_SQL_MI_CLIENT_ID`.
- Existing Firebase verification, public routes, and frontend freeze assets
  remain unchanged.
- No Azure deployment, ACR push, SQL mutation, or merge is authorized in this
  phase.

Draft PR: https://github.com/Alex1122341/Teaching-assignment-azure/pull/14

R4D-4A adds strict allowlist parsing, conflict detection, secure encryption
enforcement, stale-reference cleanup, and a no-push Docker build step to the
existing workflow. Azure Beta Build run `36289550648` passed. Next safe action:
architect review. Do not merge, deploy, push an image, or mutate
Azure/SQL/Firebase/SWA.

## P0 — Current Beta objective

Get the Azure Beta frontend reading the existing Azure SQL database.

### BETA-R0 — SQL foundation/import

Status: **COMPLETE as a loaded checkpoint**

- Azure SQL reset completed.
- canonical schema/data load completed.
- do not rerun reset/initial loader.
- PR #3 remains Draft/open as the migration foundation.

### BETA-R1 — connect frontend read path to Azure SQL

Status: **IMPLEMENTATION COMPLETE / NOT DEPLOYED**

PR #6:

- base `main` (`ea80eecc9fa2ac2b693c23979bad5c5809a26863`) — retargeted 2026-09-26
- **Runtime Commit A** `6eeb1a4ac8c9565a4afbf479277a7e2f543f9e26` (merge of `main` into the PR
  branch; parents `075852b…` + `ea80eecc…`; tree `543b00af…`)
- **Commit B (BETA-R3A-3)** — governance-only: promotes the frozen baseline from
  `86bd5aa2c8a25259f3f708e49b322220ff43a147` to `6eeb1a4ac8c9565a4afbf479277a7e2f543f9e26`
- HEAD = Commit B; the 4 BETA-R1 commits `c006c9a`, `b230718`, `4af5af8`, `075852b` preserved
- Firebase login retained
- API token verification
- SQL UserProfile authorization
- `/api/v1/sessions` → `paws.vCalendarSession`
- no Firestore session fallback
- session writes disabled
- no DOE changes
- protected runtime assets changed by Commit B: **0** (all 45 blobs identical to Commit A)
- protected path set 44 → 45 (superset; `paws-data-client.js` added)
- zero protected runtime drift required on `pull_request` and on `push` to `main`
- **PR #6 is NOT merged and NOT deployed.** Do not merge on green CI alone: architect review
  and owner approval are required, and the later merge must preserve Commit A ancestry
  (no squash, no rebase-merge)

### BETA-R2 — activation preview

Status: **NEXT**

Read-only/operator preview only:

1. build/review exact six-profile UserProfile plan;
2. verify HICC-1 exact Faculty link;
3. confirm HICC-2 exclusion;
4. inspect live `paws_swa_beta` principal state;
5. preview narrow 004 permission contract;
6. inspect SWA runtime setting names as PRESENT/ABSENT, never values;
7. verify PR #6 candidate/artifact;
8. stop before live mutation.

Expected output:

`READY-FOR-LIVE-ACTIVATION` or a precise blocker.

### BETA-R3 — live activation

Status: **NOT AUTHORIZED YET**

Only after explicit owner approval and a clean R2:

- insert approved UserProfile rows;
- create/configure runtime SQL principal if needed;
- apply reviewed read permissions;
- configure required server-side runtime settings;
- deploy exact candidate;
- run authenticated live smoke test.

Do not combine R2 preview and R3 mutation without explicit approval.

### BETA-R4 — first live SQL-backed Beta validation

Status: **PENDING R3**

Prove:

- Firebase login works;
- SQL profile lookup works;
- Beta timetable shows Azure SQL sessions;
- browser has no SQL credentials;
- no Firestore session fallback;
- writes remain fail-closed;
- errors fail closed.

## Separate/parallel Beta work

### PR #5 Faculty enrichment

Status: Draft, architecture accepted, live apply not completed at last checkpoint.

Do not let enrichment block the first timetable connection unless a required field is actually missing.

### Session reconciliation

Status: needed before destructive/session migration decisions.

Classify 1,861 Firestore vs 1,937 SQL deterministically. This does not block a read-only SQL Beta if the owner accepts the loaded SQL baseline for the read path.

### PR #3 metadata cleanup

Status: historical prose drift remains possible.

Do not rerun operations because the PR body still mentions the old empty checkpoint.

## HOLD

### PR #4 old session-read candidate

Status: HOLD / reference only.

Do not merge as-is.

PR #6 supersedes it for the current Beta-R1 implementation direction.

## Experimental/Demo track

Repository `Teaching-assignment`.

### P3.1

PR #76 remains a future-feature architecture source.

Do not require full P3.1 completion before the immediate Beta SQL connection milestone.

### DOE

Current owner decision:

- keep DOE algorithm/engine in Experimental/Demo;
- no Azure DOE migration/rewrite now;
- DOE must not block BETA-R1/R2/R3.

## Later work, not current P0

- Beta write APIs
- full Change Request SQL port
- live AFC SQL workflow/document sealing
- Published Timetable implementation
- P3.1 authority/review port
- LAB SQL port
- DOE SQL port
- complete Firestore retirement
- production hardening/hosting redesign if owner chooses it
