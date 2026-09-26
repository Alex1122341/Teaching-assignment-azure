# PAWS Task Chain

**Last updated:** 2026-09-26

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

- HEAD `075852b150e8870b4e49e1076586cbbc82bc1bcb`
- Firebase login retained
- API token verification
- SQL UserProfile authorization
- `/api/v1/sessions` → `paws.vCalendarSession`
- no Firestore session fallback
- session writes disabled
- no DOE changes
- CI green in implementation report

### BETA-R2 — activation preview

Status: **COMPLETE (read-only)**

Delivered:

1. six-profile UserProfile plan built and hash-pinned;
2. HICC-1 exact Faculty link confirmed;
3. HICC-2 exclusion confirmed (`HUMAN_CONFIRMED_DELETE_ACCOUNT`);
4. live `paws_swa_beta` principal state inspected — ABSENT;
5. narrow 004 permission contract previewed and statically verified;
6. SWA runtime setting names inspected — not readable, because no managed API is deployed;
7. PR #6 candidate/artifact verified green;
8. no live mutation performed.

Plan SHA-256: `69211cfe160b10667ab5c13c7e6007608e37f5d7a3b4b384997fd5130bacf410`

Result: **BLOCKED** — the activation blockers were environmental, not data.

### BETA-R3 — live activation

Status: **ATTEMPTED / BLOCKED (2026-09-26)**

Three gates must be cleared:

1. **Stacked-PR promotion:** PR #6 is based on PR #3 rather than `main`. Land/reconcile PR #3 first,
   then retarget/rebase PR #6 onto current `main` and rerun exact-head CI.
2. **Frozen-runtime promotion:** PR #6 intentionally changes protected runtime assets. Main push CI
   and manual deploy both still enforce frozen baseline `86bd5aa2...`. A deliberate release-baseline
   promotion is required before the SQL-backed runtime can produce a green deployable `main` build.
3. **Entra app/service principal creation:** current operator receives Graph 403 under tenant policy.
   An administrator must create `paws_swa_beta` (or explicitly grant an approved creation path).

Also confirmed: `azureADOnlyAuthentication = True`, so SQL username/password authentication is unavailable.
The current minimal Beta runtime identity remains a dedicated Entra service principal for the SWA managed API.

No live mutation was performed. See `updates/2026-09-26-beta-r2b-r3-activation-blocked.md`.

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
