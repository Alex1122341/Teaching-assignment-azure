# Integrated office workspace immutable promotion

- Accepted main: `8bb40c60370bcce3d0135efd4327d42fba657903`.
- Final integrated product: `5d324df870344345ddb7ab59ff7ae1b54e219e6f`.
- Product was committed before this separate governance change.
- Static protection: main 87 → integrated 91; no removed asset. Four additions: `schedule-filter-view.js`, `workspace-navigation.js`, `office-workspace.js`, `faculty-route-access.js`.
- Every API runtime file (115), build definition (1) and repository dependency input (2) is byte-identical to main. No API, SQL, rule, dependency, gate, credential or business-data mutation.
- Active source and artifact comparisons still read immutable Git blobs; mutable-hash and manifest-removal attack protections stay enabled.
- Older Name, Phase1/Phase2, Role Period and Rowversion governance receipts stay pinned to their original product and acceptance commits. Their historical values are not rewritten to pretend they cover this UI.
- New integrated governance test first failed on the old anchor, then passed after promotion. Integrated/role governance: 6 passed, 0 failed. Product-focused office/page/auth/assets/main tests: 189 passed, 0 failed.

Full root/server, build/artifact verification and the final fresh independent review are subsequent release gates. A promoted local candidate is not a merge or deployment.
