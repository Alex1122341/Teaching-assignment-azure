# AFC record management and LAB detail release

## Product scope

The Dashboard refreshes authenticated AFC creation/cancellation capabilities after sign-in. Faculty labels show names; internal keys remain in request values. Duplicate names use rank/stream for selection and ambiguous bulk names are rejected. The default AFC list contains active records, with archived records still accessible.

Delete cancels the exact manual/imported record by setting Active to false. It retains purpose, notes, dates and the row. Administrator authorization is checked by both API and SQL. A rowversion token rejects stale active records; cancellation and its before/after audit are atomic. An already cancelled retry creates no second audit. A separate exact-true gate defaults closed.

LAB detail groups already authorized LAB/SRL rows by course, date, year and academic year. Native tables show instructors, rooms and total source intervals. Group rotations are Not provided; no segmented times, groups or roster link are fabricated. Each row keeps its existing Edit Session, Manage Instructors and SWAP flow and pending status.

## Directed release prerequisites

1. Review the product and separate immutable static/API freeze promotion in this PR. Preserve both commits; the product anchor must remain reachable. Require exact merged-main CI before release.
2. Apply `database/azure-sql/036_afc_record_cancel.sql` with sqlcmd error stopping against the approved VetMed-Ops database. This creates the narrow cancellation role but grants no membership. Do not rerun source imports or earlier migrations.
3. Compile and exercise the procedure in the accepted SQL environment. Run `036_afc_record_cancel_acceptance.sql` and require `AFC_CANCEL_ROLLBACK_ACCEPTANCE_OK`. It creates only a synthetic manual fixture inside a transaction and rolls back its records/audits. Also check imported cancellation, stale-version rejection, denied faculty access, and concurrent cancellation in staging before activation; local API tests do not prove live SQL acceptance.
4. Inspect the exact runtime identity and existing permissions. Bind only `paws_runtime_afc_cancel_write` to that identity after authorization, with no direct table DML or schema-wide execution. Confirm the existing read role can read VersionToken from the unified view. Do not use a broader principal to make acceptance pass.
5. Stage and verify the exact source-attested University API runtime. Keep cancellation disabled initially. Confirm authenticated `/api/v1/dashboard/afc-records/write-capabilities` and list reads. Enable `PAWS_AFC_CANCEL_WRITE_ENABLED=true` only after SQL acceptance and runtime role verification. Preserve other gate values.
6. Build the same generated static allowlist artifact and perform the directed Firebase Hosting-only release to tester-teaching. Do not release new static code alone against the old API: the new capability endpoint and VersionToken require the coordinated API/schema release. Do not deploy Firestore rules, indexes or Functions.
7. In Chrome confirm name-only labels, enabled creation when the server grants it, cancellation confirmation/history, stale refresh, grouped LAB rows, corresponding per-row actions and narrow-screen scrolling. Use approved synthetic data for mutation acceptance.

## Rollback

Disable the cancellation gate and remove only the new narrow role membership. Restore the previously verified API/static release if needed. Retain rowversion columns, cancelled history and audits; do not hard-delete business data or rewrite cancellation history. Keep the previous runtime and Hosting artifacts available until acceptance closes.

## Evidence boundary

This change is a feature-branch candidate. Local browser preview uses synthetic display data. No live login, record mutation, SQL migration, role binding, gate activation, merge or deployment has been performed by this task. The SQL acceptance script has not been executed; it remains a release prerequisite.
