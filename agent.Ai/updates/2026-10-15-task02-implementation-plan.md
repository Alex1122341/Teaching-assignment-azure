# Task02 implementation plan ready

Date: 2026-10-15. Repository: Alex1122341/Teaching-assignment-azure.

Starting branch feat/scheduling-conflict-tasks-20261015 at6b11be1. Owner approved written design and ADFA-only review. Preserved earlier choice of native sequential implementation followed by fresh independent review; do not ask for execution method again. No grilling.

Read writing-plans skill and inspected actual schema, SQL runner/workflow, API/runtime/gate and UI interfaces. Added docs/superpowers/plans/2026-10-15-scheduling-conflict-tasks-implementation.md, five independently testable slices: scoped SQL detection, durable review/races, API/client, existing sidebar, whole-feature acceptance/governance. Self-reviewed spec coverage, interface consistency and edge conditions. Existing Session/Assignment lack rowversion, while AFC/Calendar have versions; plan adds narrow source versions to distinguish restored identical source facts. No product code changed.

Updated spec approval status and current-state/task-chain headers. Documentation check: git diff --check and staged diff --check; no behavioral tests run for this documentation-only change. Prior accepted ADFA/Calendar evidence is not repeated or newly claimed.

No live reads/writes, migration, permission/gate change, release, merge or remote PR mutation. Untracked server/test/fixtures/calendar-activity-race-wait-observe.sql remains untouched.

Breakpoint: concrete plan awaits owner review under writing-plans execution handoff. On approval read executing-plans and implement sequentially with TDD at UI/API/actual-SQL seams, then independent review. Do not redo design approval or earlier accepted work. Dedicated least-privilege identity and release/data approvals remain separate prerequisites.
