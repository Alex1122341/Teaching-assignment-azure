# AGENTS.md

## Agent continuity memory

If you do not already have reliable recent PAWS project context, you MUST read `agent.Ai/AGENT.md`, `agent.Ai/PROJECT_STATE.md`, `agent.Ai/TASK_CHAIN.md`, `agent.Ai/DECISIONS.md`, and the newest file under `agent.Ai/updates/` before starting substantive work.

The `agent.Ai/` directory is documentation-only continuity memory. It has no application/runtime role.

Before completing substantive work, leave a new chronological update under `agent.Ai/updates/` using `agent.Ai/UPDATE_TEMPLATE.md`, and refresh the current-state/task files when the breakpoint changes.

For mutable facts such as PR heads, CI, live SQL counts, Azure configuration and deployed runtime, verify current evidence before acting.

## Repository and deployment source of truth

- Beta repository: `Alex1122341/Teaching-assignment-azure`.
- This repository is the frozen Azure beta line; `main` is deployable only through the manual exact-SHA beta release workflow.
- The application baseline is `4fed98d` (Runtime Commit C, the reviewed ACA-direct SQL-backed read runtime); do not merge or automatically synchronize the test repository.
- The beta URL is `https://red-cliff-04871ca0f.5.azurestaticapps.net`.
- Do not commit feature work directly to `main`; use a feature branch / worktree and open a PR.
- Build the static bundle with `node tools/build-static.js`.
- A normal push never releases Azure beta; release requires the successful `Azure Beta Build` run for the exact current `main` SHA.

## Frozen runtime contract

- The Azure beta application is frozen at commit `4fed98d908476df7c4066062ad6435194d3b0493`. That immutable commit (Runtime Commit C) is the content trust anchor.
- This baseline represents the **BETA-R4D-9B ACA-direct SQL-backed read runtime**. It is the reviewed frozen runtime, but it is **NOT YET DEPLOYED** — the deployed Azure beta site still predates this runtime until the later manual deployment task succeeds.
- **All** shipped static runtime assets are protected, not just a five-file subset. The authoritative shipped-file list is `tools/static-assets.json` (45 entries).
- The protected set is the union of the files named by the current manifest and by the manifest stored in the frozen baseline commit, so removing a path from the mutable manifest cannot remove it from the freeze.
- `tools/beta-freeze.js` compares each protected file against the blob stored in the frozen baseline commit (via `git cat-file`), not against any working-tree hash file. Run it with `node tools/beta-freeze.js`, or with `--artifact .azure-production/app` to validate a built or downloaded artifact.
- `tools/beta-baseline.json` is documentation and live-site reporting only. CI never trusts it as the immutable source: a coordinated edit of a runtime file plus that JSON still fails because verification reads the baseline Git objects.
- Normal CI fails if any shipped runtime asset drifts from the baseline. `Azure Beta Build` runs the freeze check for both the repository and the built artifact; `Azure Beta Deploy` revalidates the requested SHA and the downloaded artifact independently before any Azure upload.
- Changing the baseline is explicit future release work: it requires updating the frozen baseline commit reference, the manifest-derived protection, and the documentation together, in a reviewed change. It is never an implicit side effect of a feature commit.
- Task 6 (Azure authorization, deployment-token configuration and the first gated release) is separate and has NOT been completed.

## Application architecture

- Frontend: vanilla HTML, CSS and JavaScript.
- Authentication: Firebase Authentication.
- **Current deployed Beta runtime:** still uses Firestore project `tester-teaching` for existing business data until an approved Azure SQL candidate is actually deployed.
- **Current BETA-R4D-9B candidate (PR #16):** Firebase Auth -> ACA-direct PAWS API -> Azure SQL for profile/session reads; session writes fail closed; not yet merged/deployed at the continuity baseline.
- Azure hosting alone does not prove Azure SQL persistence.
- DOE remains in the Experimental/Firebase demo track for now and must not block the immediate Beta database-connection work.
- Do not weaken Firestore rules merely to make a UI feature work in the still-Firestore runtime.
- Do not add Firestore fallback to a Beta read path that has been explicitly activated on Azure SQL.

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
