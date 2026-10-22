# Agent Update — PR125 University Testing database design

**Date:** 2026-10-22 (America/Edmonton)

**Repository:** Alex1122341/Teaching-assignment-azure

**Task status:** PARTIAL / revised written-design review pending

## Goal and breakpoint

Owner first approved VET-C31293 for temporary Testing; documentation commit36aa93c8f3f1d2c2969fe3e6985c62a5ff0ab050 saved inventory and an all-local DB draft. Before written review, Owner clarified online Testing must use ITAPPVETOPSDB01 and selected an independent Testing database. Preserve API/tunnel desktop direction and separate Firebase; online LocalDB is superseded. Product099 CI remains source-bound historical evidence.

## Work performed

Created/self-reviewed revised written design docs/superpowers/specs/2026-10-22-pr125-university-testing-design.md. Proposed new DB name VetMed-Ops-Testing, not claimed existing. Identified current code blocks all Testing on University SQL and reset/seed/many migration guards require VetMed-Ops. Design binds exact server/database/UUID, per-connection/admin-batch checks, effective SQL permissions, strict TLS, Testing-only in-memory migration adaptations with Production source unchanged, same-instance/two-DB synthetic acceptance and real authenticated deployment. No account default requirement reintroduced; use suitable existing Windows identity, actual connectivity/grants measured later.

## Checks and limitations

Read-only repository inspection only; two remote metadata probes stopped before connecting SQL because the pinned launcher's connection is not a recognized direct literal. They returned inventory_unavailable, not SQL access-denied or DB absence. Do not infer server auth mode, DB existence, capacity, permissions or current desktop connectivity from those probes. No business SQL query/write or login/config change occurred.

The initial documentation commit had five Markdown hard-break trailing-space warnings; this revision removes those spaces and runs a full documentation diff whitespace check. Source/runtime/workflow/freeze bytes remain unchanged. No new unit/integration suite run for this documentation stage.

## Files and live actions

Revised current-state/decision/task docs, marked previous LocalDB design superseded, added this update and the University DB design. No software installation, local/remote database creation/reset/migration, role/grant, Firebase setting, gate change, PR push/merge or release.

## Next action

Owner reviews the new written design. Written approval permits writing-plans; implementation awaits concrete plan review under brainstorming. Retain sequential execution and final independent review already selected in history. During planning use guarded existing University admin tooling to inventory canonical SQL configuration and availability without dumping credentials; the failed literal-extraction probe is not a blocker that requires Owner intervention by itself.

## Do not redo

No Azure provisioning, public SQL exposure, runner installation, Production copy/reset/import/DOE publish or27gate change. Do not implement the superseded online-LocalDB draft, remove the SQL server denylist globally, allow arbitrary DB names, or blanket-replace VetMed-Ops across Production migrations. Do not claim new profile accepted/live based on older099 CI.
