# Verified DOE reconciliation implementation plan

> For agentic workers: use superpowers:executing-plans sequentially; one fresh independent whole-branch review, then separate freeze-governance review. Owner directs immediate implementation after verification; do not request another routine approval.

**Goal:** Fix reproduced legacy-calculation and classification gaps while retaining approved allocations and making unresolved source records actionable.

**Architecture:** Reuse the current calculator, existing annual formula rules, worksheet source precedence, approved exception mechanism, authorized manual source type, Lookup renderer and review components. No competing formula mode, generalized proration schema or permission expansion.

**Tech stack:** Node 22 / vanilla JavaScript / University SQL / Firebase Hosting. Beta is SQL; separate Firestore Testing is outside this change.

**Spec:** Owner's 2026-10-30 verify-first directive and [verification register](doe-reconciliation-verification.md).

## Constraints and rulings

- SharePoint/source workbook read-only. Preserve exact identities, source records, audit events, explicit allocations and historic rules.
- Percentage points throughout; no balancing entries or missing-to-zero conversion.
- No automatic policy activation/recalculation. Unknown Residents, HICC eligibility, count/role/time inputs remain unresolved.
- Existing contract-reserve approval takes precedence over the older report's proposal. Absent-mode policies retain previous behavior.
- Use existing annual CCC category `rotation`, not a new engine category. SQL has zero active normalized annual facts, so no category DML is needed now.
- A literal approved VISC group remains one group; slash labels do not imply counts. A date window does not imply a proration fraction.
- Staff-level verification/recovery files stay private. Public documents carry reproducible structural evidence and references.

## Review focus

- Signed manual reductions apply once and never silently become non-teaching or disappear from totals.
- Explicit zero versus null, omitted, invalid or partial input; fractional averaged trainee inputs follow the same annual formula.
- CCC explicit deduction is applied once even when recorded credit already contains it. Contradictory count/deduction evidence must not be guessed.
- Approved dated/source exceptions remain authoritative; a full-year reference is distinct from the expected allocated value.
- UI source links, copied cells and issue labels are escaped, stay in the authorized faculty/year context, and never finalize unresolved totals.

## Task 1 — Legacy calculator parity (TDD)

Files: `server/src/domain/doe-calculator.js`, `server/src/domain/doe-rule-book.js`; tests `server/test/doe-calculator.test.js` and adjacent role/projection suites.

- [x] Add failing cases for VETM 506 / IM at 0, fractional below 1, 1, above 1, 2, 3 and 10 using complete seven-category evidence; compare to the existing approved formula.
- [x] Add failing partial/missing/negative supervision cases. Preserve real zero and do not invent Residents evidence.
- [x] Add failing CCC explicit deduction / half-day cases, stored-credit precedence and invalid evidence. Carry already available source deduction into `calculateRoleRule` / resolver; inspect repository transport before editing.
- [x] Add failing VISC/rotation coordination zero-versus-null cases and low teaching-focused reserve-reference tests (5 / 7.5 / 45).
- [x] Implement the smallest parity corrections; add two reference rows and clarify CCC reference. Do not create a new policy-engine mode.
- [x] Run focused and adjacent tests, record RED/GREEN and confirm approved source allocations are unchanged.

## Task 2 — CCC and structured classification (TDD)

Files: `server/src/doe/doe-assignment-service.js`, `frontend/scripts/faculty-admin-doe-worksheet.js`; tests `server/test/doe-assignment-service.test.js`, `tests/faculty-admin-doe-breakdown.test.js` and review-controller tests.

- [ ] Test explicit CCC role against its existing rotation-category annual rule, and ensure frontend does not call it Course Coordination because of stale category text.
- [ ] Test structured Lab Primary/Secondary and seven supervision activities against misleading legacy label words. Unknown/conflicting inputs stay visible for review.
- [ ] Test approved `manual_doe_assignment` in a separate manual allocation group (including a signed reduction); record counts as counts, never infer hours/trainee quantities from DOE. Explicit non-teaching classification still excludes records.
- [ ] Implement and verify worksheet subtotal equality for identical complete inputs, with incomplete applicable records keeping finalized totals unavailable.

## Task 3 — Actionable source issues and navigation (TDD)

Files: existing worksheet renderer and its source repository only as necessary; no new permissions/API domain. Reuse `data-table`, `table-wrap`, `warn-box`, reference bubbles and existing review navigation.

- [ ] Test record-level issue rows: faculty, role/course, allocated/recorded/reference amount, delta where meaningful, reason, available source cell and source record link.
- [ ] Distinguish approved expected allocation from full-year reference; unknown expected/actual/delta remain unavailable.
- [ ] Add stable source-line anchors within the current authorized worksheet and one-click navigation that reveals the actual affected source; precise copyable sheet/cell when no workbook URL is available. Do not invent a SharePoint link.
- [ ] Include classified-but-unresolved lines as well as unclassified/non-teaching warnings; keep counts, loading/error states, keyboard behavior and escaping coverage.
- [ ] Check actual/synthetic comparable before/after screenshots at desktop and narrower widths; real source values remain private.

## Task 4 — Complete source-record and workbook audit

- [ ] Audit CC rows with blank DOE and graduate names in DOE column against actual current roles using exact verified identity/scope; distinguish already-present allocations from genuinely missing source records. Do not interpret a broken aggregate as a deletion instruction.
- [ ] Preserve unprovided credits; create only independently verified missing business assignments through the existing source-refresh mechanism if its precise staging/atomic acceptance is safe and authorized. Otherwise retain a precise unresolved record, not a guessed price.
- [ ] Re-derive teaching components from Transform/OTHER using real Primary/Secondary markers and separate exams/course-zero/ambiguous Lab records; do not import ambiguous rows by position or inferred price.
- [ ] Produce private faculty/category comparison (`Excel verified | PAWS before | PAWS after | delta | status`), source-error/cached-value register and exact remaining decisions. Keep known source allocation examples and historical corrections; no repeat import.

## Task 5 — Review, freeze and coordinated release

- [ ] Update verification outcomes, DOE mapping and database documentation; preserve dated historical evidence.
- [ ] Run appropriate full/focused checks with genuine results; never count skipped or failed checks as passed. GitHub quota local-acceptance authorization remains in force.
- [ ] Obtain fresh independent product review. Commit accepted product; promote its full immutable static/API union in a separate governance commit, retain every previous promotion as historical evidence, and obtain independent governance review.
- [ ] Build exact governed candidate; verify every source/artifact byte. Replace the obsolete private 040bb79 candidate only with verified owned-process handling; do not touch the production listener before release acceptance.
- [ ] Merge the reviewed PR only when its ordinary code gates pass. Regenerate Graphify raw/tree/overview from exact merged main, no model calls. Build/verify exact-main artifact, preserve all live write gates/credentials/tunnel, update recovery config with before/atomic rollback evidence, then coordinate University API and Hosting-only release.
- [ ] Verify live API/SQL, anonymous denial, exact CORS, gate digest, static bytes, authenticated reports and actual new source-issue UI. Keep the new annual policy Draft if its source/publication guard still fails; code release is not policy activation.

## Execution state

Phase-1 code reproducers and live policy/source verification completed before implementation. Task 1 implemented: RED calculator/repository cases reproduced, then 37/37 focused and adjacent tests passed (0 skipped). Reference calculator version is now 2026-27-v2; annual policy activation is unchanged. Continue Task 2. Previous candidate and data operations are preserved; all new operations require their own exact evidence.
