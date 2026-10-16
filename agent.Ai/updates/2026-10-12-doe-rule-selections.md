# Agent Update — Selection-based DOE rule maintenance

**Date:** 2026-10-12
**Agent/model:** Codex
**Repository:** Alex1122341/Teaching-assignment-azure
**Task status:** PARTIAL — implementation reviewed, release pending

## 1. Goal
Make common Add/Edit Rule maintenance choice-based for Workload Guidelines users, preserving the calculation engine and lifecycle.

## 2. Starting breakpoint
- Base main: a9b80615f07761964eef12c50a024ea9167eddf8 (PR92 released).
- Branch: feat/doe-rule-selections-20261012.
- Product anchor: 277c3cdfb1b9aa4cb9002f686a76a29a73a7f57b.
- Prior update: 2026-10-12-guided-add-rule-working-draft.md.

## 3. Work performed
- Common selector conditions use human labels and single/multiple choice controls.
- Actual course/subject mappings and authorized faculty directory supply canonical options.
- Calculation mode changes update owned inputs/parameters; custom metadata is preserved and duplicate inputs avoided.
- Explicit precedence selection replaces numeric priority in the common form.
- Technical identifiers, JSON, formulas and unsupported complex conditions remain under Advanced.
- Existing automatic working Draft and folded Active banner are retained.
- Review found two mode-switch issues; both fixed and closure accepted.

## 4. Files / components changed
faculty-admin-doe-rulebook.js/.css; faculty-admin-doe-policy.js; faculty-admin.js. Separate governance promotion anchors static runtime to the product commit.

## 5. Architecture / invariants affected
Existing Firebase Hosting / authenticated University API / SQL architecture retained. No permission expansion.

## 6. Data / algorithm changes
No engine, API, SQL, stored Active policy or publication workflow changes. Explicit user choices serialize to the existing schema. No invented rates, identities or date comparison rules.

## 7. Tests / CI evidence
No local suites added or run. Syntax checks for three modified JS files and build-beta-release succeeded. Static repository/artifact freeze: 69 paths pass. Browser local fixture: fixed-to-hour mode switch, LAB single choice, LEC/LAB multi choice, Save Draft, preserved OSCE fixed zero and priority 1000; no console warnings/errors. Reviewer closure accepted. CI pending.

## 8. Live operations
None yet. Candidate preview saves only in-memory local fixtures. API runtime unchanged from a9b8061/anchor22a4734.

## 9. Current state after task
Product commit complete; separate static freeze promotion / PR / exact-main CI / Hosting release pending.

## 10. Blockers / unresolved questions
None. Complex rules continue using Advanced.

## 11. Exact current breakpoint
Complete governance commit, create reviewed PR, wait for CI, merge, wait exact-main CI, deploy Hosting-only artifact and verify live choices without saving production example rules.

## 12. Next safe action
Commit governance documentation and create PR.

## 13. DO NOT REDO
Do not rerun MASTER correction imports, policy publication or prior API cutover. Preserve inherited dirty files and older untracked updates.
