# Calendar search responsiveness immutable promotion

- Previous accepted product: `486ea030c5eaef4ddb7508a4d50799687487057f`.
- Final integrated product: `b7d98616888cb7b2b648a627ae287b9a08bb5b99`.
- Product was committed before this separate governance change.
- Static protection: 91 → 92. One addition: `calendar-search.js`. Two content changes: `index.html` (script tag before `timetable.js`), `timetable.js` (debounced search binding, scoped activity cache, delegated session clicks). No asset was removed or renamed; the other 89 protected paths are byte-identical to the previous product.
- Every API runtime file (115), build definition (1) and repository dependency input (2) is byte-identical to the previous product. No SQL, rule, dependency, gate, credential or business-data mutation.
- Active source and artifact comparisons still read immutable Git blobs; mutable-hash and manifest-removal attack protections stay enabled. The historical receipt tests that used the *current* protected set to compare two older commits now read the manifest of the older commit instead, because a newly added asset does not exist there; their historical assertions and pinned SHAs are unchanged.
- Older Name, Calendar workspace, AFC, DOE, office and ingress governance receipts stay pinned to their original product and acceptance commits. Their historical values are not rewritten to pretend they cover this UI.

## Measured effect

`node tools/bench-calendar-search.js` executes the extracted production functions of both the frozen baseline and the working tree in the same instrumented harness:

| Metric | Before (`486ea03`) | After |
|---|---:|---:|
| Search renders for 10 rapid keystrokes | 10 | 1 |
| Activity API requests during that burst | 11 | 1 |
| `filteredSessions` work for the burst, 1,861 sessions | ~8.9 ms | ~0.9 ms |
| Bind 1,000 rendered rows: linear session scans | 1,000 | 0 |
| Bind 1,000 rows: elapsed | ~154 ms | ~1.0 ms |
| Click listeners for 1,000 rows | 1,000 | 1 |

The 250 ms trailing edge is a deliberate latency trade: the final result of a typing burst appears 250 ms after the last keystroke instead of immediately, in exchange for one render and zero extra requests instead of ten of each. Enter applies immediately.

## Verification at the promoted head

- `npm test` (root, `node --test tests/*.test.js`): 1,204 tests, 1,152 passed, 0 failed, 52 skipped.
- Governance trio (`beta-baseline`, `beta-api-freeze`, `office-workspace-governance`): 72 passed, 0 failed.
- `node tools/beta-freeze.js`: ok, 92 protected.
- `node tools/beta-api-freeze.js`: ok, 115 runtime files plus 3 inputs.
- `node tools/verify-beta-candidate.js`: ok.
- `node tools/build-static.js`: 92 files, 2,350,673 bytes. `node tools/beta-freeze.js --artifact .azure-production/app` and `node tools/beta-api-freeze.js --artifact .azure-production/api` both ok.

Full exact-head CI, the release artifact and the independent review are subsequent gates. A promoted local candidate is not a merge or deployment.

## Review corrections — cancellation and click fallback

Independent review of PR #141 found two defects in product `b7d9861`. Both were reproduced with failing tests before the fix. Corrected product is `02388d60519eb7429633a1e748c1fb6e192a1b54`, committed before this second separate promotion; governance is `26edea6`.

1. **Cancelled requests were cached as authoritative empty rows.** `createCalendarActivityView()` reported a superseded request as `[]`, which is indistinguishable from a legitimately empty range, so an abandoned Week A response could be served as "Week A has no activities" for the whole TTL. `loadRange()`/`loadFacultyRange()` now take `onCancel:'empty'|'throw'`; the timetable cache passes `'throw'` and receives an `AbortError`-shaped cancellation that the cache never stores. Every other caller keeps the historical `[]` contract.
2. **Session clicks went dead if the module failed to load.** `scheduledSessionBlockController()` returned null and nothing was bound. The page now falls back to `createInlineSessionBlockController()`, which keeps the delegated single-listener contract instead of restoring per-row listeners.

Protection stays at 92 static assets — no addition, no removal — with three content changes (`calendar-activities.js`, `calendar-search.js`, `timetable.js`) and 89 byte-identical assets. API runtime (115) plus 3 inputs are unchanged.

### Evidence

`node tools/bench-calendar-search.js` now executes three revisions (baseline `486ea03`, previous PR head `b7d9861`, working tree) against the same stubs:

| Metric | Baseline | Previous PR head | Corrected |
|---|---:|---:|---:|
| Initial activity load (requests) | 1 | 1 | 1 |
| Extra activity requests for 10 keystrokes after warm-up | 10 | 0 | 0 |
| Search renders for 10 rapid keystrokes | 10 | 1 | 1 |
| Cache reads (direct) / hits (derived) | 11 / 0 | 11 / 10 | 11 / 10 |
| Bind 1 000 rows: elapsed ms (direct) | ~173–183 | ~2–5 | ~0.7–1.2 |
| Bind 1 000 rows: linear scans / listeners (direct) | 1 000 / 1 000 | 0 / 1 | 0 / 1 |
| **A → B → A correctness** | pass | **fail** | **pass** |

All timings are Node/V8 runs of production functions against stub collaborators, not browser timings.

### Verification at the promoted head

- Cancellation suite (`tests/calendar-search-cancellation.test.js`, 13 tests, real view + real cache): 9 failed against `b7d9861`, 13/13 pass now.
- Degraded-mode tests (module absent): 5 added, all pass; the full Calendar search set is 18 + 23 + 13 = 54 tests.
- Root suite: 1 222 tests, 1 170 passed, 0 failed, 52 skipped.
- `beta-freeze` 92 ok, `beta-api-freeze` 115 + 3 ok, `verify-beta-candidate` ok, `.deploy-static` 92 files / 2 354 996 bytes, both artifact freezes ok.

A promoted candidate is not a merge or deployment; exact-head CI and the external review follow.
