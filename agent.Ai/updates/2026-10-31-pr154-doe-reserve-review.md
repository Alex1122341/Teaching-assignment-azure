# 2026-10-31 — PR154 DOE reserve review and promotion

- PR154 source head was `94bd25325a28a3e228e0598ba2ae44b7c09f2a6a`, base `cbd5fa9e9e832e99d35f456fc9bb42d53ab889e7`.
- Independent review found a reserve regression and 35 GitHub CI failures caused by protected API freeze drift.
- Isolated worktree: `Teaching-assignment-azure-worktrees/pr154-doe-review`.
- Regression tests failed 4/4 before fix; targeted DOE tests passed 41/41 after fix.
- Corrected product SHA `d0275801dafff439c1afb35eecc9897730ea2e8b`; subsequent governance commit pins this SHA with no runtime byte changes.
- PR125 remains Draft and is excluded from this release.
- No new SQL data changes, policy publication, Firebase deploy, or University API cutover are authorized by this documentation.
- Before merging: exact-HEAD CI and review. After merge: exact-main CI, runtime release attestation, static/SQL/UI smoke verification, log exact release SHA.
