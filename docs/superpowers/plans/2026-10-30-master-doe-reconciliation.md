# Current MASTER DOE Alignment Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for sequential implementation and independent final review.

**Goal:** Align authoritative current-year PAWS DOE data and supervision calculation with verified current MASTER details.

**Architecture:** Reuse existing reserve service and normalized annual policy parameter storage. The optional `contractReserveCap` parameter selects source-correct behavior without changing historical policies. Use existing auditable SQL business operations and new guarded, source-bound correction receipts for remaining data.

**Tech Stack:** Node 22, vanilla JavaScript, SQL Server, PowerShell, existing Firebase Hosting/University API.

**Spec:** `docs/superpowers/specs/2026-10-30-master-doe-reconciliation.md`.

## Global constraints

- SharePoint/current source bytes are read-only.
- Staff records, UCIDs and private recovery files remain outside Git/Hosting.
- No guessed contract DOE, identity, date or time.
- Verified detail rows take precedence over broken aggregate lookups, as explicitly approved.
- New annual policy only. Preserve Active/historical evidence and immutable freeze enforcement.

## Review focus

- Missing contract must stay unavailable despite a valid effective-target override.
- Other years and absent parameter keep existing flexible-transfer outcomes.
- A signed reduction is applied once after reserve and is never absorbed by reserve expansion.
- Stale source rows, repeated execution and duplicate identity/scope must fail closed.
- Source annotations and nonunique teaching-session matches must not silently become corrections.

### 1. Annual reserve mode (TDD)

- [x] Add failing reserve cases for contract basis, fixed cap, above-target assigned teaching and missing contract; confirm intended failures.
- [x] Implement optional validated `contractReserveCap` in `server/src/doe/doe-reserve-service.js`.
- [x] Add failing worksheet test proving contract and effective target remain distinct; pass contract through `doe-worksheet-service.js`.
- [x] Add SQL repository coverage proving the annual flag reaches reserve calculation; extend its closed parameter set. TDD also covers Draft serialization and browser patch preservation, discovered to have separate closed parameter lists.
- [x] Run focused and adjacent DOE/SWAP preview suites. Preserve defaults. Latest 32 server focused and 12 browser-controller tests pass. Earlier full server: 1,017 pass / 0 fail / 7 skips; final full verification remains a release step.

### 2. Source correction and annual policy

- [ ] Finish exact detail/source-issue comparison; review before/after images for seven teaching candidates and role corrections.
- [ ] Preview transactions with rollback; apply only source-verified operations, preserve audits and recovery receipts.
- [ ] Clone the actual Active policy into a new Draft; enable the approved annual reserve parameter, align required source exceptions/mappings and validate.
- [ ] Independently verify current-year source totals and impact; publish only a fully reviewed valid version.

### 3. Release and reconciliation evidence

- [ ] Independent product/source review, separate immutable freeze governance, full appropriate checks and exact candidate build.
- [ ] Publish accepted code/policy using existing coordinated University API/Hosting tooling; verify actual site and role-scoped behavior.
- [ ] Generate current main Graphify after any merge, with no model calls.
- [ ] Produce final applied-change and outstanding source-issue registers. Never call source parity complete while unexplained differences remain.

## Rulings during execution

- Preserve recorded date intervals when source notes do not fully specify a replacement. Recurring away notes and a start-only handoff do not justify erasing known end dates. Two such CC rows are retained for source review.
- Exclude period updates to source rows referenced by an existing approved teaching-leadership grant. Even inserting equivalent default dates can invalidate its source signature; keep that independent authorization contract intact.
- Current source explicitly removes one VISC assignee. Its exact removal is planned with private before-images, original audit retention and a fail-closed guard requiring no linked live leadership grant. No other role removals are inferred.
