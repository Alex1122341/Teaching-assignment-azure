# SDD ledger — plan: docs/superpowers/plans/2026-09-28-beta-r4d11a-dashboard-ui-doe-parity.md

Pre-flight: Tasks 1→2 share the stored DOE field semantics; Task 2 produces aggregate DTOs consumed lazily by Task 3. Task 1 pure helpers are independent of Task 2 SQL.

Ruling: Use the specified Azure target SHA `6adf40cd8cd89a915e23bcd505d0e3110f91b2e4` as the branch base even though the prior local checkout was on an old R4D-9 branch; the user explicitly requires current Azure main and the remote resolves that SHA.

Task 1: complete (tests: `node --test tests/dashboard-view-model.test.js tests/faculty-doe.test.js` → 8/8 pass)
Task 2: complete (server focused + full suite → 102/102 pass; routes are GET-only and administrator-only)
Task 3: complete (Dashboard parity tests 4/4; client tests 11/11; Stage 3A runtime 24/26 with two obsolete source-shape assertions)
Task 4: complete (syntax/diff checks pass; static asset manifest includes dashboard-view-model.js; freeze drift is intentional candidate-runtime drift; no deployment/merge/PR)
