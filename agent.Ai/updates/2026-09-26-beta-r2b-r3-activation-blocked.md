# Agent Update — BETA-R2 / BETA-R2b preview + BETA-R3 live activation attempt

**Date:** 2026-09-26
**Agent/model:** HY3 / WorkBuddy
**Repository:** `Alex1122341/Teaching-assignment-azure`
**Task status:** BLOCKED

## 1. Goal

Close out the BETA-R2 activation preview, then execute BETA-R3: create a dedicated Entra
service principal, create the matching SQL contained user, apply the narrow 004 read contract,
configure SWA backend settings, load the six approved `paws.UserProfile` rows, deploy the exact
PR #6 candidate, and run the live smoke test.

## 2. Starting breakpoint

- base branch: `feature/azure-sql-cutover-foundation`
- base SHA: `edb46dc734613ea35bb211d1c98dd21bce851e33`
- working branch: `task/beta-r1-connect-azure-sql` (PR #6)
- starting SHA: `075852b150e8870b4e49e1076586cbbc82bc1bcb`
- PR: #6 — Draft/open, not merged
- relevant prior update: `2026-09-26-initial-continuity-baseline.md`
- live environment assumptions: Azure SQL `azureADOnlyAuthentication = True`; `paws_swa_beta` absent;
  `paws.UserProfile` empty; SWA `ucvm-teaching-lab-web` serving a static site only

## 3. Work performed

**Analysis / review**

- Verified PR #6 exact HEAD and base by SHA.
- Read `azure-beta-deploy.yml` and identified its deploy preconditions.
- Read `agent.Ai/UPDATE_TEMPLATE.md`, `PROJECT_STATE.md`, `TASK_CHAIN.md` (all on `main`).

**Live reads**

- Firestore `users/{uid}` for the 7 reviewed Beta accounts, field-masked to `email` + `name` only.
- Azure SQL `teaching-assignment-lab`: `sys.database_principals`, `sys.database_role_members`,
  `sys.database_permissions`, `sys.database_role_members`, `paws.UserProfile` count.
- Azure ARM: SQL server `azureADOnlyAuthentication`, SWA resource properties, subscription inventory.
- Unauthenticated HTTP probe of the deployed SWA host.
- Entra Graph: token scope decode, `/me/memberOf`, one app-registration creation attempt.

**Live writes**

- **None.**

**Deployment / release actions**

- **None.**

## 4. Files / components changed

- `agent.Ai/updates/2026-09-26-beta-r2b-r3-activation-blocked.md` (this file)
- `agent.Ai/PROJECT_STATE.md` (breakpoint section)
- `agent.Ai/TASK_CHAIN.md` (BETA-R2/R3 status)

No application code, SQL, workflow, or configuration was changed.

## 5. Architecture / invariants affected

Preserved existing architecture. No invariant changed. No new decision introduced.

Two pre-existing decisions were **confirmed as binding** rather than changed:

- Beta runtime SQL authentication is locked to an Entra service principal (no SQL auth, no managed
  identity, no App Service, no separate Function App).
- Beta release controls are not to be bypassed.

## 6. Data / algorithm changes

None. No identity matching, normalization, session grouping, authorization, workflow state,
concurrency, DOE, AFC, publication, or migration logic was altered. No new identity matching was
performed — the previously reviewed UID→classification mapping was used verbatim.

## 7. Tests / CI evidence

PR #6 candidate `075852b150e8870b4e49e1076586cbbc82bc1bcb`:

| Workflow | Run | Result |
|---|---|---|
| Azure SQL Migration Tests | `36249819711` | SUCCESS |
| Azure Beta Build | `36249819750` | SUCCESS |

Artifact: `azure-beta-d6d23398bf31af770ab566e56ef9385d7722a75a`, 1,213,230 bytes, unexpired.

Local read-only evidence work: UserProfile bootstrap preview PASS —
`profileRows 6`, `excludedRows 1`, `unresolved 0`, `duplicates 0`, `writesPerformed false`,
`planSha256 69211cfe160b10667ab5c13c7e6007608e37f5d7a3b4b384997fd5130bacf410`.

## 8. Live operations

### Performed

None. No SQL write, no principal creation, no GRANT/DENY, no Azure setting change, no deployment,
no Firebase mutation, no merge.

### Explicitly NOT performed

- no `paws.UserProfile` insert
- no SQL login/user creation
- no permission change
- no SWA setting change
- no deployment
- no Firebase mutation
- no DOE change
- no reset / loader rerun
- no credential persistence (no token or secret written to disk)

## 9. Current state after task

- final branch: `main` clone for continuity docs; PR #6 branch unchanged
- final SHA: PR #6 still `075852b150e8870b4e49e1076586cbbc82bc1bcb`
- PR: #6 Draft/open, not merged
- merge/deploy state: not merged, not deployed
- relevant live state reverified:

| Item | State |
|---|---|
| `azureADOnlyAuthentication` | `True` (SQL auth disabled server-side) |
| `paws_swa_beta` | ABSENT — 0 principals, 0 role memberships, 0 permissions |
| `paws.UserProfile` | 0 rows |
| SWA `ucvm-teaching-lab-web` | exists, SKU Free, `red-cliff-04871ca0f.5.azurestaticapps.net` |
| deployed `/api/*` | 404 — managed API not deployed |
| subscription resources | 4 total; no Function App, no App Service |

## 10. Blockers / unresolved questions

**B1 — Deploy is structurally impossible for this candidate.**
`azure-beta-deploy.yml` asserts `git rev-parse origin/main == EXPECTED_SHA`, requires the source
build's `head_branch == main` and `event == push`. Current `main` is
`71b7957a4df57e8c8dbd994f5f7c732e2f5706ad`; PR #6 is based on the foundation branch and its CI ran
on `pull_request`. The workflow therefore refuses `075852b1`. Per the task's own rule this is a STOP,
not a workaround. **Resolution requires merging PR #6 to `main` through the reviewed release process
with owner approval.**

**B2 — Entra service principal cannot be created by this account.**
Graph token decoded successfully and carries `Application.ReadWrite.All` in `scp`. Application
creation nevertheless returns:

```
403 Authorization_RequestDenied
"Insufficient privileges to complete the operation."
```

`/me/memberOf` returned 19 entries, **all of them groups** (distribution lists, security groups,
Teams) and **no Entra directory role**. Delegated `Application.ReadWrite.All` requires the caller to
hold Global Administrator, Application Administrator, or Cloud Application Administrator. The account
holds none, so the scope cannot be exercised.

**Resolution:** an administrator either (a) assigns the account a suitable directory role, or
(b) creates the `paws_swa_beta` app registration and service principal and supplies the client ID and
secret out-of-band. Neither is something this agent may do itself.

**B3 — `agent.Ai` is not on the PR #6 branch.**
`agent.Ai` exists only on `main` (added by `71b7957a4df5`, 2026-09-26T15:31:47Z), which is why it was
not visible from the PR #6 working tree.

**Open question:** whether the SWA managed API can authenticate to SQL at all without a managed
identity. Since the account cannot create a service principal and managed identity is excluded by
decision, B2 must be cleared before this can be tested.

## 11. Exact current breakpoint

The Beta SQL read path is fully implemented and green in CI, and the six-profile bootstrap plan is
generated and hash-pinned, but **live activation is blocked twice over**: the Beta release workflow
will not deploy a non-`main` candidate, and the operator account cannot create the Entra service
principal that the locked authentication decision requires. Neither blocker is addressable by code or
by this agent. The next agent must resume only after (1) PR #6 has been merged to `main` through the
reviewed release process, and (2) a directory role or a pre-created service principal has been
provided.

## 12. Next safe action

Once both preconditions in §11 are cleared, resume with BETA-R3 from §3:

1. confirm the `paws_swa_beta` app registration exists and obtain tenant ID, client ID, secret;
2. create the contained Entra SQL user and apply `database/azure-sql/004_swa_beta_permissions.sql`;
3. apply the six-profile plan whose SHA is
   `69211cfe160b10667ab5c13c7e6007608e37f5d7a3b4b384997fd5130bacf410`;
4. configure SWA settings;
5. deploy the exact merged `main` SHA;
6. run the smoke test.

## 13. DO NOT REDO

- Do not rerun the SQL reset or the initial empty-database loader.
- Do not re-verify PR #6's CI (both workflows green at `075852b1`).
- Do not regenerate the UserProfile plan — it is hash-pinned at `69211cfe…`; regenerate only if the
  reviewed account set changes.
- Do not attempt app-registration creation again with the same account; it fails on role, not scope.
- Do not attempt to deploy `075852b1` through `azure-beta-deploy.yml`; the workflow will refuse it.
- Do not rerun the SWA appsettings probes; the sub-resource 404s because no managed API is deployed.

## 14. Suggested next-agent prompt

> Resume PAWS BETA-R3. Preconditions now met: PR #6 (`075852b150e8870b4e49e1076586cbbc82bc1bcb`)
> is merged to `main`, and the `paws_swa_beta` Entra app registration + service principal exists with
> a client secret supplied out-of-band. Locked auth: Entra service principal only — no SQL
> authentication, no managed identity, no App Service, no separate Function App. Create the contained
> Entra SQL user, apply `database/azure-sql/004_swa_beta_permissions.sql` (stop on any guard
> 51000–51006), apply the six-profile plan with SHA
> `69211cfe160b10667ab5c13c7e6007608e37f5d7a3b4b384997fd5130bacf410`, configure the three SWA
> settings, deploy the exact merged `main` SHA, then run `/api/health`, `/api/v1/me`,
> `/api/v1/sessions` and the browser smoke test. Never print or commit the client secret.
