# Effective authority and remediation contract

| Surface | Existing authority | Confirmed target / boundary |
|---|---|---|
| Firebase sign-in | Firebase Auth verified UID | Identity only; no client/token role elevation |
| Calendar/Dashboard/Assignments/Reports | SQL UserProfile, request-time server checks | Preserve role allowlists, own faculty scope and all existing gates |
| Account grant editing | Firestore Owner compatibility record | Active SQL Owner only, exact versioned preview, atomic SQL change+audit+persisted readback |
| Administrator | Current business capabilities | Existing business operations retained; no account grant editing |
| Developer | Current SQL support role | Retain accepted support behavior; no access-editor impersonation, no new Developer grants or Owner edits to Developer accounts |
| HICC group membership | Firestore HICC/ownerUid | SQL HICC may change own collaboration members only via server; no owner/course expansion or other Faculty private directory |
| Group/course association | Legacy group metadata | Collaboration label only; never a course-management grant |
| Information Center | Firestore compatibility Owner | Server reads for active supported SQL profiles; SQL Owner publishes; preserve existing messages |
| Account/group direct client calls | Existing Firestore rule predicates | Deny retired privileged direct paths after replacement APIs/emulator review; no UI-only enforcement |
| Disabled/password-required/missing profile | SQL denies business routes, legacy may diverge | Fail closed on business and replacement endpoints; self access explanation reveals only own status |
| Unsupported role | Existing SQL rejection | Needs review; no automatic Other Office/editor/viewer privilege mapping |

Scope of Owner edit: existing role, active flag and canonical FacultyId only. Faculty/HR appointments, DOE and workload roles remain separate. At least one usable Owner must remain; Owner self-disable/demotion denied. Role/faculty changes invalidate old previews by rowversion even A→B→A. Require reason, before/after, operation UUID, immutable actor/time and explicit incomplete outcome after ambiguous failure. No production role writes are authorized for test/acceptance.
