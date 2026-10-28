# SEC-01 candidate verification

Product: `179fa70ebce42e252a29826d76057799d6af43a7`; independently reviewed governance: `c17f3515f8200abe1c39a541ea4fe98c6da671eb`; tested candidate: `7a7ebde6723ab715e165f8fedffdbd7ab03b0771`. Latest integrated main is42622acf. No live SEC-01 activation has occurred.

## Exact-candidate CI

Build40445289953/job121994995242 completed successfully on Node22:

| Check | Passed | Failed | Skipped |
|---|---:|---:|---:|
| Root npm test |1299|0|55|
| Server suite |934|0|8|
| Auth/Firestore emulator root suite |1335|0|19|
| Additional baseline/deployment suite |62|0|0|

These suites overlap; do not sum their counts. Build, repository static/API freeze and built-artifact static/API freeze all succeeded. Protection is96 static files and127 API runtime files plus three build/package inputs.

All six exact-candidate isolated SQL workflows passed:

- Migration40445289983.
- Calendar Activity40445289954/job121994995267, including scheduling concurrency, activity/SWAP, history, AFC forms/originals and complete CCC recovery regression.
- Faculty Availability40445289955.
- CCC40445290214.
- MASTER40445289928.
- Account Access40445290006. Product179fa70's prior run40443398849 also explicitly proves all nine markers, including pre-existing principal refusal, immutable persisted audit, ABA rejection, two-Owner concurrency and guarded rollback.

PR review artifact12708131502 is `azure-beta-cbb47b8b188f92ec04fc5cae03df054ab4aa8428` (the PR merge-ref artifact). Workflow metadata binds it to head7a7ebde. Downloaded ZIP SHA256 matches GitHub's digest exactly: `76b1fb87bb3ffe53a612ed542b404ab1a29741b393cf2c8837191aea9ef3f122`. It contains224 files under app/api, including the API inventory. Downloaded-artifact freeze verification is recorded privately. This is not an exact-main production release artifact; merging/releasing still requires the coordinated checklist and fresh exact-main evidence.

## Diagnosis and preserved evidence

- c17f351 root/server passed, but its full emulator suite found14 obsolete positive browser-Firestore expectations. Four suites now explicitly load immutable pre-SEC01 rules from19d504. Their scenarios remain executed, with historical labels. Current-rule deny probes were broadened for opaque indexes, statistics and bulk-job events. Actual local20/20 emulator probes passed; no rules or runtime changed to satisfy tests.
- Local parallel server execution hit PDF/Workbook worker deadlines. Bounded concurrency left one timeout; the affected full workbook file passed26/26 when isolated. Complete exact-candidate CI server934/942 passed with zero failures. Parser limits/timeouts were not weakened; failed local runs are retained, not relabelled green.
- Independent product review found three substantive issues: missing guard startup in two own-auth pages, unsafe reuse of a feature SQL principal, and delayed client scope refresh on otherwise-valid routes. All fixed with observed RED→GREEN regression tests. Independent governance review reported no substantive findings and independently checked all96 immutable reporting hashes.

## Browser and live boundary

Actual synthetic IAB preview covers1440x900 and390x844, Owner search/reason/preview/readback, ambiguous retry with the same operation, HICC own-group scope, Faculty own summary, long names/123 accounts, empty/error/read-only/dark states and keyboard focus.200% CSS zoom was an approximation; native browser zoom and real production role matrix remain unclaimed. Private fixtures/screenshots are not in the build. Local preview19062 is available and returns200.

Fresh public runtime/SQL and Hosting root return200. Runtime remains e7d3ffec/anchoref2d053 with27 original gates, while main has advanced to42622acf; a main merge alone is not publication evidence. The earlier95/95 full public-byte receipt remains dated to its original checkpoint.

Server credential probe returned `ADC_UNAVAILABLE`. The launcher removes FIREBASE_SERVICE_ACCOUNT_JSON and no ADC configuration was found. Legitimate HICC/Information Center replacement reads therefore still require trusted server credential configuration and actual acceptance. Keep PR148 Draft and retain current rules/runtime/frontend until that prerequisite passes. No real account/group/announcement changes, production SQL migration, gate change, API restart, merge or Hosting/rules deployment was performed.
