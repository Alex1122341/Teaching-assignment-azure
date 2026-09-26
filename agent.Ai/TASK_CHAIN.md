# PAWS Task Chain

**Last updated:** 2026-09-26

## P0 — Current Beta objective

Get the Azure Beta frontend reading the existing Azure SQL database.

### BETA-R0 — SQL foundation/import

Status: **COMPLETE as a loaded checkpoint**

- Azure SQL reset completed.
- canonical schema/data load completed.
- do not rerun reset/initial loader.
- PR #3 **MERGED into `main` at `ea80eecc9fa2ac2b693c23979bad5c5809a26863`** (2026-09-26); migration foundation now on `main`.

### BETA-R1 — connect frontend read path to Azure SQL

Status: **IMPLEMENTATION COMPLETE / NOT DEPLOYED**

PR #6:

- HEAD `6eeb1a4ac8c9565a4afbf479277a7e2f543f9e26` — **Runtime Commit A** (2026-09-26,
  BETA-R3A-2B): current `main` merged INTO the PR branch as a merge commit with parents
  `075852b` + `ea80eecc`. Documentation/governance content only; runtime/workflow/test/tool
  files byte-identical; baseline NOT promoted.
- base RETARGETED to `main` (`ea80eecc9fa2ac2b693c23979bad5c5809a26863`) on 2026-09-26 (BETA-R3A-2)
- the 4 BETA-R1 commits `c006c9a`, `b230718`, `4af5af8`, `075852b` preserved unchanged
- Firebase login retained
- API token verification
- SQL UserProfile authorization
- `/api/v1/sessions` → `paws.vCalendarSession`
- no Firestore session fallback
- session writes disabled
- no DOE changes
- **Fresh post-Commit-A CI green:** Azure SQL Migration Tests `36265424485` SUCCESS;
  Azure Beta Build `36265424535` SUCCESS (head `6eeb1a4`, `pull_request`, base `main`).
  Candidate step behavior: `Verify strict frozen main runtime` **SKIPPED** (push-only gate);
  `Verify explicit Beta-R1 release-candidate drift` **SUCCESS** — this step runs
  `node tools/verify-beta-candidate.js`.
- **Retired evidence:** runs `36249819711` / `36249819750` are pre-retarget historical
  (head `075852b`, checkout `Merge 075852b into edb46dc`). Corrections: `verify-beta-candidate.js`
  IS wired into CI; strict beta-freeze did NOT run on the PR candidate.
- **PR #6 is NOT merged and must not be merged in this state** — Commit B (freeze promotion)
  is a separate, separately reviewed task.

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

- 2026-09-26 (PR #9, unmerged draft): BETA-R2/R2b read-only activation preview completed; BETA-R3 live activation **BLOCKED** on (1) deploy requires reviewed PR #6 merge + push to `main`, (2) Entra SP / `paws_swa_beta` app registration creation `403` (account lacks directory role). See update `2026-09-26-beta-r3a2-pr6-main-integration.md`.

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
