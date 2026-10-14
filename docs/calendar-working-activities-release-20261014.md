# Calendar working activities — candidate acceptance and release manifest

Status: product implementation and isolated acceptance in progress. Draft PR [98](https://github.com/Alex1122341/Teaching-assignment-azure/pull/98). No merge, live migration, permission activation or publication has occurred for this module.

## Accepted scope

Actual work becomes a SQL Calendar date range with its original inclusive dates. No course, academic year, clock, weekday cadence, room or group is inferred. University travel, vacation, RSL, leave and OPA stay AFC. Duplicate, unresolved or invalid source rows stay quarantined. The approved departed-person exclusions remain bound to the exact workbook hash and source row. Course Calendar replacement is outside this operation.

The import stages server-parsed source rows, previews exact active imported AFC matches, and binds source hash, manifest, identity resolution and row versions. Commit rechecks those facts inside one transaction, writes receipt and complete recovery before-images, inserts activities and deletes only the exact counterparts. Retried identical requests return their receipt; changed or recovered outcomes fail closed.

Missing work timing produces Needs Review and blocks SWAP application even with an Owner override. Verified timing belongs only to its actual date. Shared faculty locks, final business locks and all-resulting-instructor activity snapshots preserve existing consent, stale-request and DOE boundaries.

## SQL manifest and boundary

| File | Action | Rollback |
|---|---|---|
| 038_calendar_activity_foundation.sql | Tables, lineage functions, stage/preview/read procedures | rollback_038_calendar_activity_foundation.sql |
| 039_calendar_activity_swap.sql | Availability/digest/snapshot and three existing SWAP procedure definitions | rollback_039_calendar_activity_swap.sql |
| 040_calendar_activity_commands.sql | Atomic commit, date evidence and trusted recovery procedures | rollback_040_calendar_activity_commands.sql |
| 041_calendar_activity_permissions.sql | Five narrowly scoped execute-only roles and private-table read denials | rollback_041_calendar_activity_permissions.sql |

Role memberships are never applied by those migrations. Browser runtime must not receive `paws_calendar_recovery_admin`, direct DML or helper EXECUTE. Stage, commit and time are independently disabled unless their exact environment value is `true`. The opt-in canonical faculty/public-key mapping is restricted to administrators; faculty reads are server scoped.

Existing support delegation denies these operations because its current Undo model does not capture Calendar receipts and recovery tables. Use the authorized account directly. Existing timetable CSV/ICS/Outlook exports remain teaching-session exports; working ranges stay in the separate Calendar section.

## Evidence collected

- SQL acceptance run [38643556361](https://github.com/Alex1122341/Teaching-assignment-azure/actions/runs/38643556361), product `14867babff21bc8932025c13f6cfa60b330b40d7`: foundation, atomic commands, recovery, SWAP semantics, least-privilege metadata/cascade boundary and eleven actual two-connection wait proofs passed.
- Synthetic SQL fixtures compare unchanged teaching Sessions/Assignments, DOE and Published data before and after import/recovery. Recovery preserves original AFC IDs with freshly generated versions and refuses modified Calendar activities.
- Task6 focused UI/client suite: 45 tests passed at `8f103d8`; academic short-year compatibility and artifact inventory acceptance subsequently passed (21 focused checks). Full server `npm test --prefix server`: 589 total, 588 passed, one local SQL-environment skip; actual SQL CI covers that boundary separately.
- Concurrent root/server execution first caused a parser deadline failure under resource contention. Running the server suite independently passed without changing the production parser's ten-second limit.
- Full root suite is running against the old frozen baseline. Product drift is expected to fail until the separate reviewed governance commit. No drift exemption has been added.
- Browser acceptance uses local Chrome and the demo Firebase Auth emulator, synthetic in-memory repository/parser fixtures and an explicit client hash stub for synthetic upload. This proves rendered interaction and authenticated API routing; actual source binding and SQL transactions are proved by separate parser/SQL acceptance. It is not a live Beta test.

## Release prerequisites and separate authorizations

1. Complete independent product review and fixes, accept the exact product SHA, then independently review a separate freeze promotion in this coherent PR. Static/API protection remains the union of immutable baseline and current manifests.
2. Build and attest matching API/Hosting artifacts, containing the new worker/dependencies but no workbook, staging data, recovery artifacts or secrets.
3. Obtain read-only live module-definition hashes for the three replaced SWAP procedures. Unexpected drift blocks migration until reviewed. Preserve the actual previous definitions for rollback.
4. Prove a dedicated least-privilege runtime identity and exact role memberships. Existing temporary db_owner is unresolved release debt; synthetic role acceptance is not evidence of live principal configuration.
5. Confirm private University recovery storage, Windows integrated connection, restrictive ACL and exact UTF-16LE receipt-bound export hash. The export must occur immediately after commit, because its receipt exists only after commit.
6. Present a concrete merge/SQL/API/Hosting release request with new write gates initially false. Previous PR94 release approval does not authorize this module.
7. After read/schedule/SWAP integration acceptance, regenerate the approved source preview against current live AFC/Faculty records. Counts are not assumed to be 541. Review new manual rows, retained row812 and inactive identities; obtain a separate exact source-migration confirmation.
8. Commit once through the authenticated API, export and verify recovery, then verify matched insert/delete counts, preserved retained/manual/unclassified records and unchanged teaching/DOE/Published data. Any later recovery requires its own authorization.

The module is not complete until its separately authorized release and source operation are accepted. Other tasks in the full PAWS directive remain outstanding.
