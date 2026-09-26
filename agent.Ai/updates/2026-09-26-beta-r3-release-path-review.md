# Agent Update — BETA-R3 release-path review

**Date:** 2026-09-26  
**Agent/model:** ChatGPT GPT-5.6 Sol  
**Repository:** `Alex1122341/Teaching-assignment-azure`  
**Task status:** READ-ONLY REVIEW / BLOCKERS CORRECTED

## 1. Goal

Review the BETA-R3 live-activation report and verify whether the stated blockers are sufficient and correctly framed.

## 2. Evidence reviewed

- BETA-R3 operator report
- PR #6 exact HEAD `075852b150e8870b4e49e1076586cbbc82bc1bcb`
- `.github/workflows/azure-beta-build.yml`
- `.github/workflows/azure-beta-deploy.yml`
- `tools/beta-freeze.js`
- `tools/verify-beta-candidate.js`
- baseline/deployment tests
- current PR topology (#3 stacked foundation, #6 stacked runtime)

## 3. Corrections

### Entra app-creation root cause wording

The Graph 403 proves the current operator cannot create the app under current tenant policy.

Do not state that only Global/Application/Cloud Application Administrator can ever create apps. Microsoft
supports additional roles and, depending on tenant policy, some non-admin users. Operational resolution
remains: administrator creates the app/service principal or explicitly grants an approved creation path.

### Additional deployment blocker found

Merging PR #6 to main is necessary but not sufficient.

PR #6 intentionally changes protected runtime assets. The push build runs strict `beta-freeze.js` against
the old baseline `86bd5aa2...`, and the deploy workflow hard-codes the same baseline.

Therefore an explicit frozen-baseline promotion is required before a SQL-backed main can produce a green
deployable build.

## 4. Required release order

Recommended release lane:

1. review/update PR #3 metadata and merge the SQL foundation to main with owner approval;
2. retarget/rebase PR #6 onto the new main and rerun exact-head CI;
3. create a deliberate release-baseline promotion commit/PR that pins the protected runtime baseline to
   the reviewed BETA-R1 runtime commit and updates freeze/deploy/tests/docs coherently;
4. merge only after exact-head checks pass;
5. use the successful `push` build from exact current main for manual deployment.

Do not bypass main-only or freeze controls.

## 5. Identity lane

In parallel, an Entra administrator should create the dedicated Beta app/service principal
`paws_swa_beta` or grant an approved ability for the operator to create it.

No human/SA account should become the application runtime identity.

## 6. Live operations

None performed.

No SQL/Azure/Firebase/DOE/application-code mutation was made in this review.

## 7. Exact breakpoint

BETA-R3 remains blocked until both the Entra identity lane and the release-promotion/frozen-baseline lane
are cleared.
