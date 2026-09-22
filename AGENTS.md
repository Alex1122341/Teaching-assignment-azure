# AGENTS.md

## Repository and deployment source of truth

- Beta repository: `Alex1122341/Teaching-assignment-azure`.
- This repository is the frozen Azure beta line; `main` is deployable only through the manual exact-SHA beta release workflow.
- The application baseline is `86bd5aa`; do not merge or automatically synchronize the test repository.
- The beta URL is `https://red-cliff-04871ca0f.5.azurestaticapps.net`.
- Do not commit feature work directly to `main`; use a feature branch / worktree and open a PR.
- Build the static bundle with `node tools/build-static.js`.
- A normal push never releases Azure beta; release requires the successful `Azure Beta Build` run for the exact current `main` SHA.
- The full separation boundary, deployment flow, required variables/secrets, rollback sequence and known blockers are documented in `docs/azure-separation.md`. Prefer that document for anything cross-repository.

## Frozen runtime contract

- The Azure beta application is frozen at commit `86bd5aa2c8a25259f3f708e49b322220ff43a147`. That immutable commit is the content trust anchor.
- **All** shipped static runtime assets are protected, not just a five-file subset. The authoritative shipped-file list is `tools/static-assets.json` (44 entries).
- The protected set is the union of the files named by the current manifest and by the manifest stored in the frozen baseline commit, so removing a path from the mutable manifest cannot remove it from the freeze.
- `tools/beta-freeze.js` compares each protected file against the blob stored in the frozen baseline commit (via `git cat-file`), not against any working-tree hash file. Run it with `node tools/beta-freeze.js`, or with `--artifact .deploy-static` to validate a built or downloaded artifact.
- `tools/beta-baseline.json` is documentation and live-site reporting only. CI never trusts it as the immutable source: a coordinated edit of a runtime file plus that JSON still fails because verification reads the baseline Git objects.
- Normal CI fails if any shipped runtime asset drifts from the baseline. `Azure Beta Build` runs the freeze check for both the repository and the built artifact; `Azure Beta Deploy` revalidates the requested SHA and the downloaded artifact independently before any Azure upload.
- Changing the baseline is explicit future release work: it requires updating the frozen baseline commit reference, the manifest-derived protection, and the documentation together, in a reviewed change. It is never an implicit side effect of a feature commit.
- Task 6 (Azure authorization, deployment-token configuration and the first gated release) is COMPLETE: the `beta` environment holds `AZURE_STATIC_WEB_APPS_API_TOKEN`, and **Azure Beta Deploy** run `35646315010` released `e15a53240a6b6a688d95299539a5628ac2b54144` with every verification step green. Re-running a release follows the same manual exact-SHA sequence; see `docs/azure-separation.md`.

## Application architecture

- Frontend: vanilla HTML, CSS and JavaScript.
- Authentication: Firebase Authentication.
- Database: Cloud Firestore project `tester-teaching`.
- The current production architecture is Spark-compatible and does not depend on deployed Cloud Functions.
- Security decisions must be enforced by Firestore rules and by minimizing what data is delivered to the browser.
- Do not weaken Firestore rules merely to make a UI feature work.

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
