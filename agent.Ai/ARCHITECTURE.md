# PAWS Beta Architecture — current authoritative overview

**Review baseline:** 2026-10-15 (America/Edmonton), Beta main 0d4b4d9ea2e658719e87f16ef5132b82544bc6c1. This is a documentation snapshot, not a deployment claim. **Last documented live API + Hosting release:** ca465bf1401b457ca3b74048cfaf170bedc7694a (2026-10-14), frozen product/trust anchor fb2c625745957fa7d9990033f15a7b1ef91974a5. Recheck mutable refs and the actual live process before a change.

## 1. Two repositories, no implicit synchronization

- **Beta / controlled real-user track:** Alex1122341/Teaching-assignment-azure (this repository). Prioritize safety, exact releases, stable data, SQL authority.
- **Experimental / feature-forward track:** Alex1122341/Teaching-assignment. Investigate reusable code, but port through separately scoped, reviewed work. Never automatically merge its main or PRs into Beta.
- The old BETA-R1 / Azure Static Web Apps / Firestore runtime descriptions in historical updates record previous phases, **not today's active deployment**.

## 2. Active Beta deployment and data flow

~~~mermaid
flowchart TD
  U[Developer / ADFAD / Faculty / HICC / VISC / ADC / LAB]
  F[Firebase Hosting: tester-teaching.web.app]
  UI[Vanilla HTML / CSS / JavaScript]
  AUTH[Firebase Authentication: ID token]
  T[Temporary Cloudflare HTTPS Quick Tunnel]
  NODE[University PAWS Node.js API: Windows loopback host]
  RBAC[Firebase token verification + paws.UserProfile role and scope]
  BIZ[Modules: Sessions / Faculty / AFC / SWAP / Teaching Assignments / DOE / Support]
  DB[SQL Server ITAPPVETOPSDB01 / VetMed-Ops: paws and paws_api]
  OLD[Limited legacy Firebase / Firestore account and group tooling]
  U --> F --> UI
  UI <--> AUTH
  UI --> T --> NODE --> RBAC --> BIZ --> DB
  UI -. legacy account/group use only .-> OLD
~~~

- Browser never connects directly to SQL and never receives database credentials. All activated SQL-backed business domains fail closed rather than falling back to Firestore.
- Main user-facing Beta: https://tester-teaching.web.app. Historic Azure SWA static workflows, standalone deploy script and routing config were retired from the current tree as obsolete; only their dated Git history remains. The current static release target is Firebase Hosting; Azure API/SQL tooling remains in use or available independently.
- Frontend: index.html/timetable.js, faculty-admin.html/js, teaching-assignments.html/js, user-management.html/js, password.html/js, paws-data-client.js and supporting modules.
- Backend composition: server/src/runtime/university-api.js, university-http-server.js, swa-sql-runtime.js. The API uses authenticated scoped commands and SQL views/stored procedures; it is a modular monolith.
- Current configured API origin is the temporary Cloudflare Quick Tunnel in paws-api-origin.js. A university-owned HTTPS hostname, managed ingress, certificate and production deployment decision are still required.
- SQL Server is the **university-hosted VetMed-Ops SQL Server**, not automatically an Azure SQL Database merely because the repository is named Teaching-assignment-azure.
- Runtime Windows identity remains a hardening issue: recorded pre-cutover principal was broad/db_owner. Require dedicated institution-managed least-privilege identity and exact grants before production and before expanding high-risk operations. Do not remove legitimate DBA access.

## 3. Trust and role boundaries

1. Firebase Auth authenticates a user; Firebase UID is matched exactly to SQL paws.UserProfile.
2. SQL UserProfile.BaseRole, Active, MustChangePassword and FacultyId establish SQL API authorization; UI controls, Firebase claims and Firestore user roles cannot grant SQL business access.
3. Role-policy aliases: owner to adfa_general; administrator/admin to adfa_regular. Supported roles: developer, adfa_general, adfa_regular, faculty, hicc, visc, adc, lab. Retired other_office and viewer do not authorize SQL business access.
4. Faculty/HICC/VISC read their own Faculty-linked SQL data; special HICC/VISC actions additionally require scoped current TeachingResponsibility/Group assignee. ADC/LAB are office contribution roles, not final assignment authority.
5. SQL stored procedures, scoped views, transactions, expected revisions, immutable audit and exact-true domain write gates enforce write authority; hiding UI is not a security boundary.
6. Developer support is available only to actual developer SQL roles; delegated contexts are time-bound and audited and keep effective target permissions/gates. Do not treat Developer as an automatic substitute for business approval.

## 4. Primary domain boundaries

- **Session** is a canonical working teaching activity; SessionAssignment is the authoritative final Faculty assignment, including changes applied by ADFAD/SWAP. A Session may involve multiple Faculty.
- **TeachingResponsibility** is stable and distinct from person, role label, and temporal assignee. Assignment is based on academic year, course/subject, group and effective assignee.
- **TeachingAssignmentGroup** is distinct from legacy Firestore faculty_groups (old swap/member structure).
- **Contribution != final assignment.** ADC/LAB/HICC suggestions are not authoritative. VISC reviews HICC packages; ADFAD finalizes. **Finalization != explicit publication.**
- Published teaching assignments are an immutable year/release snapshot. Faculty must not silently see unapproved working proposal data in place of published data.
- **AFC** historical/manual records, self-service request, approval, approved artifact and availability are distinct. Other faculty only receive Available/Unavailable, not AFC reasons.
- **SWAP/change request** is independent of the HICC/VISC Teaching Assignment lifecycle and must revalidate time, source, authorization, revision and availability at apply.
- **DOE** is an independent policy/calculation domain. Targets, source worksheet lines, signed manual adjustments, reserve application, annual policy lifecycle and recorded values have separate authority/provenance.

## 5. Deployed vs candidate inventory

**Merged and last documented published by 2026-10-14:** timetable SQL reads, scoped Faculty Dashboard, Session create/edit/assignment APIs subject to gates, teaching-assignment SQL workflow, DOE worksheet and annual rulebook UI/API, manual DOE/target operations subject to gates, role/appointment effective periods, AFC requests and admin records, SQL SWAP, Tasks, Developer Support, and grouped LAB/SRL. Oct14 release updated AFC name-only labels, creation/cancellation controls and grouped LAB table. Read acceptance does not prove every write was exercised in live UI.

**Not in main / not live at this checkpoint:** Draft PR #97 (design), #98 (working Calendar activities with exact source/AFC migration), #99 (ADFA SWAP DOE and availability comparison), #100 (SQL scheduling conflict Tasks). #99 depends on #98; #100 is stacked on both. No merge, deploy, SQL import/delete, or gate enablement follows from their green tests or draft state. #100 Beta Build last seen failed during development.

**Not an implemented integration:** automatic Outlook Microsoft Graph invites/calendar writes or Brightspace/D2L API synchronization. A CSV/ICS/Outlook export entry is not automated external-system mutation.

## 6. Controlled release architecture

- Work on feature branches/worktrees and reviewed PRs, not on Beta main.
- Immutable freeze: tools/beta-freeze.js and tools/static-assets.json protect shipped static and API modules against the pinned product/trust anchor; any intended byte change requires separately reviewed freeze promotion. No bypass/whitelist.
- Implementation → independent review → PR CI → authorized merge → exact-main CI → versioned API/runtime/SQL verification → separately authorized Firebase Hosting-only release → authenticated live acceptance.
- Hosting workflow's old DOE-off gate blocked Oct14 run; an separately authorized Hosting-only CLI deployed the accepted artifact. **Do not disable approved DOE gates just to make that old workflow pass.**
- Production blockers: nonpersonal service identity/least privilege, stable university ingress and host, secure secrets, monitored service recovery/backup, formal IT/privacy/security review.
- Keep previous version/rollback evidence. Never rerun completed SQL migrations/source imports simply to resume a conversation.

## 7. Evidence links

Root AGENTS.md; agent.Ai/PROJECT_STATE.md and TASK_CHAIN.md; agent.Ai/updates/2026-10-14-afc-lab-release.md; docs/afc-record-management-lab-release-20261013.md; docs/doe-source-rationalization-20261011.md; docs/current-doe-rulebook-import-20261011.md; server/src/auth/role-policy.js; server/src/data/write-gates.js. Mutable facts must be reverified against live GitHub/runtime/SQL.
