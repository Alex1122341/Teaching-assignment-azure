# Agent Update — BETA-A1 ADFA General priority change

**Date:** 2026-09-26  
**Agent/model:** GPT-5.6 Sol  
**Repository:** `Alex1122341/Teaching-assignment-azure`  
**Task status:** PARTIAL / READ-ONLY VERIFICATION

## 1. Goal

Switch the immediate Beta priority away from Azure SQL activation and toward verifying the approved ADFA General test account on the currently deployed Firebase Authentication + Firestore Beta.

## 2. Starting breakpoint

- current main: `ea80eecc9fa2ac2b693c23979bad5c5809a26863`
- PR #3: merged
- PR #6: open / Draft / base `main`
- PR #6 head at verification: `c53cddb535947362b13e9cb3858e43b31330c923`
- Runtime Commit A: `6eeb1a4ac8c9565a4afbf479277a7e2f543f9e26`
- current deployed Beta target: `https://red-cliff-04871ca0f.5.azurestaticapps.net`
- current Beta data/auth target for BETA-A1: Firebase project `tester-teaching`

## 3. Work performed

Read-only analysis:

- verified PR #3 is merged and PR #6 remains Draft;
- verified current `main` protected application runtime has no runtime-file change from the pre-SQL frozen Firebase/Firestore baseline for the inspected protected runtime;
- inspected current ADFA General role and password-gate source behavior;
- confirmed ADFA General is handled as an administrative/global role and skips Faculty identity linking;
- confirmed `mustChangePassword=true` intentionally redirects to `password.html`;
- searched available connected tools for a Firebase management connector; none is available;
- attempted public host retrieval from available web/runtime tools; this environment could not directly fetch the Azure hostname.

No live Firebase/Auth/Firestore account data was mutated or claimed verified without evidence.

## 4. Files/components changed

Documentation-only continuity update:

- `agent.Ai/PROJECT_STATE.md`
- `agent.Ai/TASK_CHAIN.md`
- `agent.Ai/DECISIONS.md`
- this update file

No application/runtime files changed.

## 5. Architecture/invariants affected

Strategic priority changed only.

Current P0:

**ADFA General access to existing Firebase/Firestore Beta.**

Deferred:

- Azure SQL cutover;
- Commit B;
- PR #6 merge;
- Entra service principal;
- SQL UserProfile activation.

No runtime architecture was changed by this documentation update.

## 6. Data/algorithm changes

None.

No identity mapping, authorization code, workflow state, DOE, AFC, publication or migration logic changed.

## 7. Verification evidence

Repository evidence:

- current main: `ea80eecc9fa2ac2b693c23979bad5c5809a26863`;
- PR #3: merged;
- PR #6: Draft, unmerged;
- current source role helper maps `adfa_general` to global admin behavior;
- admin/global users skip Faculty directory identity linking;
- current password gate redirects when `mustChangePassword=true`.

Live Firebase checks still require an authenticated Firebase Console/browser/operator path that is not available through the current connected toolset.

## 8. Live operations

### Performed

None.

### Explicitly NOT performed

- no Firebase mutation;
- no Firestore write;
- no account/password change;
- no Authorized Domain change;
- no Firestore Rules change;
- no Azure change;
- no SQL write;
- no Entra service principal;
- no deployment;
- no merge;
- no DOE change.

## 9. Current state after task

The source/release state is preserved.

BETA-A1 remains blocked on live read-only evidence for:

- approved Authentication account existence;
- matching `users/{uid}` profile values;
- Authorized Domains state;
- actual browser login and navigation smoke.

## 10. Blockers

The current ChatGPT tool environment has GitHub/files/web access but no connected Firebase Administration/Auth/Firestore management connector and no authenticated interactive browser session for the approved test account.

Do not convert this tooling limitation into an application mutation.

## 11. Exact current breakpoint

Resume BETA-A1 at the live Firebase/browser read-only check. Use the approved operator account without exposing credentials. Verify Auth account, Firestore profile, Authorized Domain, then run the normal login smoke. If any one profile/config value is wrong, stop before changing it and report the exact minimal correction.

## 12. Next safe action

Perform the approved ADFA General account/profile/domain/login verification through Firebase Console plus the Azure Beta browser, with no mutations.

## 13. DO NOT REDO

- do not rerun SQL reset/loader;
- do not deploy PR #6;
- do not modify Runtime Commit A;
- do not advance Commit B;
- do not create SQL/Entra principals;
- do not insert SQL UserProfiles;
- do not touch DOE.
