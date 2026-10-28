# Independent product review and fixes

Review range: `42622acf42558e4478a3ce3018f5357b6effdedc...0aa169930036132e7f1589b156dfa4a247880015`.
Two independent read-only reviewers used AGENTS.md, the PAWS constitution and the approved effective-access design/plan. Latest PR149 HICC/LAB presentation changes were integrated before pinning this range. No product re-review is substituted for regression tests after fixes.

## Standards

1. P1: Faculty Dashboard and Teaching Assignments use independent Firebase bootstraps, so script inclusion did not actually start the new revocation guard. Fixed explicit start(auth) in both initializers. Tests execute the actual initializers: observed0 starts before,1 correct-auth start after. Office/guard/client/PR149 regression subset48/48 passed.
2. P2: SQL060 could reuse a pre-existing feature principal, granting new rights to its existing members. Fixed refusal of any existing feature principal before schema mutation, with unconditional creation of the new unbound role. Added disposable pre-bound member collision test, schema/membership/permission preservation checks and mandatory EXISTING_PRINCIPAL_REFUSED workflow marker. Source/tool/permission subset14/14 passed; updated exact-head SQL execution is still required.

No further substantive standards or smell findings were reported. These are hard contract issues, not stylistic refactoring requests.

## Spec

P2: Successful business routes permitted for both old/new roles did not independently check the SQL binding, retaining old view state until the next timer/focus check. Fixed a deduplicated authoritative self preflight for every ordinary request. Self requests do not recurse. Scope changes invalidate old pending JSON/PDF/CSV results before release. The existing60-second/focus checks remain additional detection paths, not next-request authorization.

A related compatibility regression was prevented: initial transport failures, before any private scope is verified, propagate into the existing sign-in recovery rather than erasing the login/retry UI or signing out. Background initial checks handle their rejected promises. After private scope verification, inability to verify still clears the private view. The impersonation context retains existing support restrictions; it does not gain access to the new Owner routes.

Observed RED before implementation for successful-route stale state, concurrent check deduplication and initial failure recovery;111 client/office/login/continuity tests passed after fixes. Added an actual client/self-loop regression. Full root/server/emulator/disposableSQL and separate freeze governance remain release gates; these subset counts overlap and must not be summed.

## Release prerequisite

The known server ADC_UNAVAILABLE result is not resolved by these code fixes. Trusted service credentials and actual bounded adapter reads must pass before the coordinated restrictive-rule cutover. No production role, group, announcement, audit, schema, gate, runtime or hosting change was performed by this review/fix pass.
