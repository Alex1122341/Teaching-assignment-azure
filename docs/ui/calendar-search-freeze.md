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
