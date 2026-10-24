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

## Final review corrections — 2026-10-24

The initial promotion above remains historical at governance `2998f1a`. The independent review found two Important defects; they were reproduced and fixed with real-source regressions. Final corrected product is `a6c5092020cfda4c87873591b3c8d5edbeba5e72`, committed before this second separate promotion. Protection remains 91 static / 115 API + 3 build/input files. API/SQL/rules/dependencies still match main exactly. The original initial-office acceptance is retained as an immutable historical test; Git-object verification and both anti-tamper checks are unchanged. Final combined focused tests:216 passed,0 failed.

## Supplemental search acceptance correction

Product `fcc36231cd0b0c02a2b9b0871ffdf64fcc0e8788` changes only two aggregate search predicates in faculty-admin.js to include the existing shared formatter's displayed label. Source aliases, identity, type/status filters, API and SQL are preserved. Eleven real-source search regressions first showed five failures, then all passed; the matching page/auth/name checks total57 passed. This separate promotion retains the prior a6c5092/4de4a3e review receipt as history, protects all91 static/115 API files, and changes no enforcement algorithm. Previous d441daf CI/artifact evidence does not certify the new candidate; complete fresh verification before release.
