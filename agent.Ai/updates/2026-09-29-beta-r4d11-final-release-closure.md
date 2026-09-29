# BETA-R4D-11 Final Release Closure

**Date:** 2026-09-29
**Status:** COMPLETE / LIVE ACCEPTED / CLOSED

## Scope

This update closes the BETA-R4D-11 release and synchronizes Agent.Ai continuity documentation. It is documentation-only. No runtime JavaScript, HTML, workflow YAML, Dockerfile, SQL schema, migration script, freeze tool, baseline JSON, application configuration, Azure resource, Firebase data, or deployment was changed by this update.

## Release identity and evidence

- Deployed release SHA: `dcf0607c027a08e5341710a449091fca4c7aa106`.
- Build #134 / run `36574888135` passed on exact main.
- Tested artifact: `azure-beta-dcf0607c027a08e5341710a449091fca4c7aa106`.
- Artifact ID: `11036059566`.
- Artifact digest: `sha256:2adbfbdcd94ec580d8f5ee84878dab4ebee66d82091ae65b2c5feb4675c00103`.
- ACR Publish #9 / run `36575614909` published immutable ACR image digest `sha256:a9d9021fec23439fa33bd4f67cc958cec8d2737d0cb9afa90f85912948b12503`.
- ACA Deploy #2 / run `36582044521` activated the exact-digest release.
- Active ACA revision: `paws-sql-beta-api-260926--rdcf0607c027a`.
- Static Deploy #7 / run `36582983859` completed the static cutover.

Repository main may advance after this update for documentation-only continuity work. That is distinct from the deployed release SHA and must not be called a new deployment without a separately authorized release.

## Authenticated acceptance

- ADFA authenticated acceptance passed.
- Faculty authenticated acceptance passed.
- Faculty scope proved exact `153/153` `SessionId` set equality against the SQL expected set.
- Admin summary, teaching-summary, roles, and DOE overview boundary calls returned 403.
- Cross-faculty detail returned 403 (`ROLE_DENIED`).
- Session writes remained disabled and fail closed.
- No Firestore business-data fallback was used for the migrated timetable/dashboard path.
- Stored SQL DOE evidence was presented within the boundary `DOE_PRESENTATION_PARITY=YES`; `FULL_DOE_ENGINE_PARITY=NO`. The Experimental DOE engine was not claimed as migrated.

## Architecture boundary

`Browser → Firebase Authentication → Firebase ID token → PAWS Azure Container Apps API → Azure SQL`

The frontend is hosted by Azure Static Web Apps. Business timetable/dashboard reads use the Azure SQL/API path. The canonical accepted counts are Faculty 120, Session 1,937, SessionAssignment 4,970, RoleAssignment 162, and AFC 791. The live Beta has an active faculty-scoped UserProfile for the accepted faculty account; private identity keys and a total UserProfile count are intentionally not recorded.

## Safe failures retained

ACA Deploy #1 / run `36581374421` is recorded as SAFE FAILURE BEFORE MUTATION. Its OIDC identity lacked `Microsoft.App/containerApps/read`; `activationPerformed=false`; no revision or image mutation occurred. Remediation was the exact target Container Apps Contributor role. Private service-principal object identifiers are excluded.

The earlier ACR G1 failure remains historical safe-failure evidence: no image build/push occurred, the absence-classification defect was fixed, and the single-publish/no-overwrite invariant remained intact.

## Chronological closure summary

- **G1:** The ACR Publish #8 absent-tag classifier failed safely; no image build or push occurred. The defect was corrected without weakening the single-publish/no-overwrite invariant.
- **G2–G3:** The ACR guard implementation and continuity review completed; the guard was corrected and the release path remained documentation/runtime scoped as authorized.
- **G4–G6:** The exact-main release candidate was built and verified, the immutable artifact was published, and ACA activation was attempted first as a safe pre-mutation failure and then succeeded by exact digest after the narrow target-scoped RBAC remediation.
- **G7:** Static Deploy #7 completed the exact Build #134 artifact cutover; unauthenticated live smoke, SQL health, and runtime/freeze evidence remained healthy.
- **G8A–G8B:** ADFA authenticated acceptance passed, including the read-only dashboard/DOE presentation and authorization boundaries. The initial Faculty acceptance gate was a safe account-selection blocker because no valid faculty-scoped profile was available and the Xinyu account was correctly `adfa_general`.
- **G8B–G8C:** A controlled existing Firebase test identity was reconciled to exactly one Faculty row and one UserProfile row. The initial `MustChangePassword=1` gate caused `PASSWORD_CHANGE_REQUIRED`; the separately authorized one-row repair changed only that flag to `0` plus normal `UpdatedAtUtc` maintenance. Faculty authenticated acceptance then passed with exact `153/153` SessionId set equality and no other SQL/Firebase/Azure/main mutation.

These historical safe failures and the final successes are intentionally distinct; the closure does not reinterpret any failed gate as a deployment or an identity defect.

## Continuity outcome

BETA-R4D-11 is complete, live accepted, and closed. No architecture decision changed, so `DECISIONS.md` was intentionally not modified. No R4D-12 is invented. Next task: **AWAITING OWNER / ARCHITECT SCOPING**.
