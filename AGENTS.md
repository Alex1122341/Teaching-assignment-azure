# AGENTS.md

## Agent continuity memory

If you do not already have reliable recent PAWS project context, you MUST read `agent.Ai/AGENT.md`, `agent.Ai/PROJECT_STATE.md`, `agent.Ai/TASK_CHAIN.md`, `agent.Ai/DECISIONS.md`, and the newest file under `agent.Ai/updates/` before starting substantive work.

The `agent.Ai/` directory is documentation-only continuity memory. It has no application/runtime role.

Before completing substantive work, leave a new chronological update under `agent.Ai/updates/` using `agent.Ai/UPDATE_TEMPLATE.md`, and refresh the current-state/task files when the breakpoint changes.

For mutable facts such as PR heads, CI, live SQL counts, Azure configuration and deployed runtime, verify current evidence before acting.

## Repository and deployment source of truth

- Beta repository: `Alex1122341/Teaching-assignment-azure`.
- This repository is the controlled PAWS Beta line; `main` is deployable only after the reviewed PR merge, exact-main CI, and the directed Firebase Hosting release.
- At the 2026-10-04 stabilization start, `main` was `783777f2dd0693cbc521ebc625817872514c2ada`; do not merge or automatically synchronize the Experimental/Demo repository.
- Current controlled Beta URL is Firebase Hosting: `https://tester-teaching.web.app`. Legacy Azure Static Web Apps deployment workflows/scripts and routing config have been deleted from the current tree; their dated evidence remains in Git history. Do not revive SWA static deployment. The historical `swa-api/` and `server/src/runtime/swa-*` names still denote live University API dependencies and must not be removed by SWA-static cleanup.
- Do not commit feature work directly to `main`; use a feature branch / worktree and open a PR.
- Build the static bundle with `node tools/build-static.js`. `node tools/build-beta-release.js` still creates the combined `.azure-production/app` + `.azure-production/api` CI artifact consumed by Firebase Hosting/ACA pipelines. The Azure Static Web App routing config is no longer staged.
- A normal push never releases Firebase Hosting; P1 release is the authorized `firebase deploy --only hosting --project tester-teaching` after exact-main CI is green. Do not deploy Firestore rules, indexes, or Functions as part of Hosting release.

## Frozen runtime contract

- The immutable static/API freeze is promoted only through an explicit reviewed governance commit anchored to the accepted product commit. P1's protected static and API runtime changes require their own separately reviewed freeze promotion in the same coherent PR; never add drift exceptions or silently move the anchor.
- The active Beta architecture is Firebase Hosting → Firebase Authentication (identity) → temporary Cloudflare HTTPS ingress → University Node API → `ITAPPVETOPSDB01` / `VetMed-Ops`. SQL is the business-data authority; do not restore Firestore business reads or writes.
- **All** shipped static runtime assets are protected. The authoritative shipped-file list is `tools/static-assets.json` (81 entries); the API freeze currently protects 103 API runtime files plus its build definition and two repository inputs (106 protected paths total).
- The protected set is the union of the files named by the current manifest and by the manifest stored in the frozen baseline commit, so removing a path from the mutable manifest cannot remove it from the freeze.
- `tools/beta-freeze.js` compares each protected file against the blob stored in the frozen baseline commit (via `git cat-file`), not against any working-tree hash file. Run it with `node tools/beta-freeze.js`, or with `--artifact .azure-production/app` to validate a built or downloaded artifact.
- `tools/beta-baseline.json` is documentation and live-site reporting only. CI never trusts it as the immutable source: a coordinated edit of a runtime file plus that JSON still fails because verification reads the baseline Git objects.
- Normal CI fails if any shipped runtime asset drifts from the baseline. Existing CI freeze checks must validate both the repository and build artifact; Firebase Hosting release remains a static-only `--only hosting` action.
- Changing the baseline is explicit future release work: it requires updating the frozen baseline commit reference, the manifest-derived protection, and the documentation together, in a reviewed change. It is never an implicit side effect of a feature commit.
- The feature branch is not live until its pull request is merged, exact-main push CI passes, and the directed Firebase Hosting deployment succeeds. Never treat a candidate build as a deployment.

## Application architecture

- Frontend: vanilla HTML, CSS and JavaScript.
- Authentication: Firebase Authentication.
- **Current deployed Beta path:** Firebase Hosting -> Firebase Auth -> Cloudflare temporary ingress -> University PAWS API -> Azure SQL / `VetMed-Ops`.
- Database identity, role checks, and faculty scope are resolved server-side; no public SQL/RDP/SMB access is supported.
- P1 enables only accepted, separately gated Beta write domains: existing-session edits, session create/batch, safe assignment replacement, AFC single/batch, and self-service AFC requests. DOE editing, Faculty/Role master edits, session deletion, AFC decision/artifact writes, unrestricted SQL, and all Firestore timetable writes stay disabled.
- DOE Summary / Faculty Dashboard is in P1 scope, but unknown contract DOE, role DOE, identity, FTE, rank, and stream are never inferred.
- Do not weaken Firestore rules to make a Beta UI feature work; Beta business authorization belongs in the University API and SQL.
- Do not add Firestore fallback to a Beta read path that has been explicitly activated on Azure SQL.
- AFC original PDF uploads use their own gate and confidential storage, separately from absence and approval records. CCC replacement staging and commit use separate gates; commit requires an approved complete-year source and exact preview. Follow `docs/superpowers/specs/2026-10-17-ccc-full-replacement-design.md` before changing this workflow.

## Roles

Formal roles:
- `owner`
- `administrator`
- `other_office`
- `hicc`
- `visc`
- `faculty`

Legacy compatibility remains in place for `adfa_general`, `adfa_regular`, `admin`, `editor`, and `viewer` until migration is complete. Use the shared role helpers in `faculty-access.js` instead of inventing new role checks.

## Faculty privacy rules

For faculty-facing workflows involving other faculty members:
- Never expose another faculty member's UCID.
- Never expose another faculty member's email, DOE values, HR fields, AFC purpose/reason, or other confidential Faculty Directory data unless the user is authorized for those fields.
- AFC may be exposed to another faculty member only as binary availability: `Available` / `Unavailable`.
- Do not reveal why AFC makes a person unavailable.
- A timetable conflict may show the conflicting course and time because timetable data is already visible to authorized timetable users.
- Prefer sanitized derived documents over granting ordinary faculty read access to `/faculty`.

## Swap-request rules

- Faculty self-replacement requests list active faculty from a sanitized directory, not from login accounts alone.
- Candidate availability combines sanitized AFC availability with live timetable conflicts.
- `Sessional` and `Other` are valid replacement categories.
- `Sessional` and `Other` require a non-blank reason/note before submission.
- ADFA approval must resolve sanitized candidate keys through an admin-only mapping and re-check live availability before applying a change.
- Existing HICC group-swap behavior should not be broadened unless the task explicitly requests it.

## Testing and change discipline

- Add or update tests before implementation for behavior changes where practical.
- Run `npm test` before claiming a change is complete.
- Run the Firestore/Auth emulator suite for security-rule changes when the environment is available.
- Preserve existing audit logging, stale-request protection, DOE calculations, and approval checks.
- Avoid unrelated refactors in a feature PR.
