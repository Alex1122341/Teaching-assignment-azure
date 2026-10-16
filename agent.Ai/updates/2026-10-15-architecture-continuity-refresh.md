# Agent Update — 2026-10-15 PAWS Beta architecture continuity refresh

**Date:** 2026-10-15 (America/Edmonton)
**Agent:** ChatGPT / GPT-6
**Repository:** Alex1122341/Teaching-assignment-azure
**Task type:** DOCUMENTATION ONLY / NO PRODUCT CODE / NO LIVE OPERATIONS
**Starting base/main SHA:** 0d4b4d9ea2e658719e87f16ef5132b82544bc6c1
**Work branch:** docs/agent-ai-current-architecture-20261015
**PR:** opened after the documentation commit; see branch/PR listing for review status

## 1. Goal and context

Owner requested a refresh of agent.Ai to the verified current PAWS Beta architecture, UI capability inventory, real server-side roles, SQL model, annual DOE calculator/rulebook and next implementation breakpoints. Earlier high-level docs still described BETA-R1 as current, with Azure SWA/Firestore and DOE remaining Experimental-only. Do not use those historical constraints as today’s active system.

## 2. Source review and result

- Inspected protected Beta main, code for Firebase/SQL auth, role policy, write gates, Timetable/Faculty/DOE/AFC/Teaching Assignment/SWAP/Support modules, SQL migration names 001-037, current DOE source/reconciliation receipts and recent accepted rollout.
- Inspected open Draft PRs #97-#100 and their dependencies, and historical acceptance for Oct09 SWAP/Developer Support and Oct14 AFC/LAB.
- Refreshed ARCHITECTURE, DOMAINS, WORKFLOWS, ALGORITHMS, DATA_MODEL and MODULE_MAP to a current Beta model, with explicit SQL authority and deployed-vs-candidate boundaries.
- Revised AGENT and README handoff entrypoint; prefixed PROJECT_STATE, TASK_CHAIN and TEST_RELEASE with current dated snapshot while **retaining every previous chronological record**.
- Added a dated interpretation note to DECISIONS without declaring a new owner decision or erasing previous milestone-level instructions. UPDATE_TEMPLATE and prior updates remain unchanged.

## 3. Accepted live vs candidate distinctions

Documented Oct14 live API/Hosting: ca465bf1401b457ca3b74048cfaf170bedc7694a, product/trust anchor fb2c625745957fa7d9990033f15a7b1ef91974a5. Hosting https://tester-teaching.web.app, Firebase Authentication, temporary Cloudflare HTTPS tunnel, Node University API, private SQL Server ITAPPVETOPSDB01 / VetMed-Ops.

Oct14 SQL036/037 AFC Cancel and grouping release has rollback/concurrency acceptance, 803 active imported AFC postflight, name-only UI options and LAB/SRL grouped details. **No real UI create/cancel** during acceptance. Historic SWAP final approval and Developer Undo likewise lack documented live mutation acceptance.

DOE: 34 code Guideline reference entries; normalized 2026-27 Master/Guidelines **candidate Draft rev2** has 58 rules/56 course mappings/25 subject groups/25 scoped source allocations; recorded 5282-source zero-delta impact is Draft preview only. Last documented Active remained snapshot-based; no live SQL Active read in this document task.

Draft/unmerged #97 (design), #98 (Calendar activity and exact AFC source migration), #99 (ADFA DOE SWAP preview, depends #98), #100 (SQL conflicts, depends #99/#98) are **not production**. #100 Azure Beta Build #386 failed at last inspected run; recheck fresh GitHub statuses.

## 4. Trust, roles and governance

SQL paws.UserProfile.BaseRole and Faculty/Responsibility scope are authoritative for SQL business, not frontend role badges/Firestore. Formal supported server roles: developer, adfa_general, adfa_regular, faculty, hicc, visc, adc, lab. Independent domain write gates and SQL stored procedures require exact authorization; developer support and ADFAD duties have distinct business intent.

University IT production blockers: least-privileged nonpersonal SQL runtime identity, durable HTTPS ingress, approved application host, secrets/recovery/monitoring. No automatic Outlook Graph/D2L Brightspace integration exists in Beta.

## 5. Verification, tests and live effects

Documentation consistency review against source and prior release receipts only. No application/test/runtime source changes, no application tests required to establish a documentation-only content update, and no claim of a new end-to-end live test. No SQL/Firebase/Firestore writes, schema migration, source deletion, user provisioning, workflow gate change, deployment, data import, PR merge or main modification under this task.

After branch and PR creation, reviewers should inspect changed files, verify the new documentation remains distinct from accepted live release and run the GitHub documentation/CI checks applicable to the branch. A green CI alone is not permission to merge.

## 6. Exact breakpoint and next safe action

Review the docs-only PR. If accepted, **separately authorize** merge to main; documentation-only merge requires no API/Hosting/SQL redeploy. Active #97-#100 retain their independent owners, dependencies and release gates. Recheck current PR HEAD/CI and live Active DOE policy/SQL/identity before any future implementation or source mutation.

**DO NOT REDO:** SQL reset/load; historical DOE Master imports/allocations; SQL036/037; Oct14 Hosting/API release; old SWAP/Support releases. Do not silently publish the DOE Draft, modify the real database, disable DOE write gates, or execute #98's proposed AFC source deletion.
