# Agent Update — Faculty UI / structured annual Rule Book

**Date:** 2026-10-08
**Repository:** Alex1122341/Teaching-assignment-azure
**Status:** IMPLEMENTED; controlled release pending

## Goal and authorization

Owner requested Lookup/Edit fidelity and DOE Rule Book architecture/functionality from the public Teaching-assignment faculty-admin reference. Owner accepted retaining negotiated signed manual DOE separately from policy baseline and instructed “做好了就发”. This explicitly authorizes completion/publication without further stage approval requests.

## Starting breakpoint

Base/live product e1005a909eca0c18df19f3a8f23b722d01084896, branch feat/faculty-ui-rulebook-parity-20261008. Previous manual DOE release remains live; source imports and deferred target decisions must not rerun.

## Implementation / reviews

Sectioned profile and supported-field editor, AFC current/past folds, keyboard results and detail generation invalidation. Structured rule/mapping/reference/reserve editors; annual lifecycle, persisted impact evidence and pinned read-only preview before recalculation. Backend Clone Draft, mandatory approved structured rule references and corrected SQL conflict/error paths. Hydrated set selectors serialized centrally so Clone/Copy preserves semantics.

Task and broad reviews accepted with repaired focus/full-width/cache, nested incomplete row removal and selector-copy findings. No new/local tests run. Existing inventory/UI fixtures synchronized. Syntax and static builds inspected.

## Governance

Accepted product anchor: 0f9ce1c4c9a748283cffc76394f22247a9f17451. Separate freeze promotion covers 62 shipped static assets,60 API runtime files and63 API protected paths, with no drift exceptions. Reporting hash file has23 entries. Repository immutable-blob checks pass. Firebase static build62 assets. ACA artifact checks use build-beta-release output; Hosting-only bundle intentionally omits ACA config.

## Live preflight / authorized release configuration

Live API observed e1005a9 / trust33f1742 / listener128 on127.0.0.1:18787. SQL user UC\sa-xinyu.zhu1 has preexisting db_owner; three existing DOE runtime role memberships absent. Manual allocations0, normalized facts0. Annual legacy FTE source snapshot Active has0 rules; normalized P4 Rule Book Draft has6 rules. UI must clearly label Draft and empty legacy snapshot.

At controlled API cutover enable existing DOE admin/publish/recalculate gates and bind existing operation roles to the already configured principal. Preserve all other gates, credentials, firewall, authentication and SQL trust. This does not reduce preexisting db_owner privilege. No automatic annual publication, business allocation edit or bulk recalculation during deployment. Formal reserve/source values and remaining blank targets unchanged.

## Remaining / rollback

Review governance, PR + CI, merge and exact-main CI, source-attested versioned API cutover with previous ManualDOE launcher rollback, Firebase Hosting-only release, live Lookup/Edit/Rule Book screenshots, final durable evidence.
