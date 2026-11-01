# PR154: DOE source classification / reserve regression — reviewed baseline promotion

- Repository: `Alex1122341/Teaching-assignment-azure`.
- Previous frozen baseline: `f1b42a3708e94eb1260454adc0a783eb934591cc`.
- Reviewed product commit: `d0275801dafff439c1afb35eecc9897730ea2e8b`.
- Academic-year MASTER source remains SHA256 `92d32ddbf38d78511f7cbf6ce4a8b65d8612c0dd0198740aea916cc06f3948f3`.

## Review and behavior

PR #154 originally changed the initial trainee reserve from `min(contract teaching DOE, trainee cap)` to `max(0, contract teaching DOE - trainee cap)` for teaching-focused/high-target streams, and implicitly selected annual mode when a contract target happened to be present. That changed historical/disabled-mode calculations, silently fell back when an annual contract was missing, and reversed the meaning of the trainee reserve reference. Such changes violate `docs/superpowers/specs/2026-10-30-master-doe-reconciliation.md` and the actual MASTER formula.

The product commit restores explicit `contractReserveCap=1` gating, proper capped initial trainee reserve, and unavailable results for missing contracts. The SQL worksheet continues to classify `ManualDoeAssignment` as adjustment rather than role. The worksheet calculates supervision reserve before signed adjustments and applies those adjustments exactly once afterward. The actual SQL source records remain authoritative; no import is replayed and no annual policy is published by this PR.

## Protected delta / governance

Between the previous accepted product baseline and this reviewed product commit:

- Shipped static assets: **none changed**; preserve current static manifest and checksums.
- Protected API paths changed: `server/src/data/sql-doe-worksheet-repository.js` and `server/src/doe/doe-worksheet-service.js` only.
- API runtime inventory, build inputs, SQL schemas, Firebase rules/indexes, authentication, and deployment credentials: **unchanged**.
- The legacy and new annual reserve modes remain separately guarded and verified.

`tests/pr154-doe-adjustments-governance.test.js` checks the product SHA, historical ancestry, exact two-file API delta, freeze verification and unchanged static hashes. No drift waivers have been introduced. The governing beta static/API freeze points to the reviewed product commit, not a self-generated mutable checksum.

## Test / release boundary

Four focused regressions were observed failing on PR154's original code (4 failed), then passed after restoring correct behavior; the related DOE suite passed 41/41. The governance test was observed failing before promotion and passed after promotion (1/1). Full GitHub PR CI, exact-main CI, University API deployment, and Firebase Hosting publication must be verified separately before describing this change as live.

Earlier RDC SQL corrections are independent data operations; they must not be replayed. The 2026-27 contract-based policy remains Draft and is not activated by a source code deploy. This promotion does not certify complete 3,938-source MASTER parity.
