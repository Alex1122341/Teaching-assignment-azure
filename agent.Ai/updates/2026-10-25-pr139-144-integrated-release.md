# PR139–144 integration breakpoint — 2026-10-25

Owner requests the six PRs reach merge/publication standard. PR139 is closed as delivered through PR140 (head138fdc1 is a verified ancestor of published c2c1de4). PR140 and PR143 were already published; no stale stacked merge is needed. PR144 reviewed fixes5a2e292 passed exact-head full Build40221355164, then merged as c7ca3d9. Current executable Azure publishers are retired; compatibility artifacts remain protected.

PR141 and PR142 histories are integrated on `review/pr141-integrated-release-20261025`. Product90b8c2f includes current main, published SWAP and the reviewed Calendar cancellation fix. Three new regressions first failed, then Calendar/History/SWAP focused suite80/80 passed. Independent product Standards and Spec re-review both report no remaining blockers.

Separate governance promotes90b8c2f with92 static and119 API protected inputs; algorithms/union remain unchanged. Prior office/History/SWAP promotions remain historical receipts. See `docs/frontend-maintenance-governance-20261025.md` and the exact tracked diff. Final full candidate CI and governance review are pending; no new frontend release is claimed here. The University API remains live at c2c1de4/trust50e7e5c with all27 gates unchanged.

Next: finish freeze verification/review, update PR141's coherent integrated scope and include PR142 by preserved ancestry, run exact-head CI, merge after green, obtain exact-main official artifact, publish Hosting only, verify92 raw files plus role/API smoke and update the original progress workbook. Do not redeploy SQL/API for frontend-only work, create real SWAP approvals, or infer missing DOE/reviewer roles.

First integrated full root CI40221893560: 1,259 tests, 1,206 passed, one failed,52 skipped. The single failure was the older DVM intake receipt asserting the current manifest still had91 files. It now checks its immutable historical91-file product and independently requires every historical asset remains protected by the current union. Current92-file tamper protection and full119-input API checks remain explicit; no verifier/runtime change. Fresh final-head CI is required.
