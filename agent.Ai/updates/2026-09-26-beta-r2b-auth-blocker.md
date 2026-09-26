# Agent Update — BETA-R2b activation readiness review

**Date:** 2026-09-26  
**Agent/model:** ChatGPT GPT-5.6 Sol  
**Repository:** `Alex1122341/Teaching-assignment-azure`  
**Task status:** REVIEW COMPLETE / LIVE ACTIVATION STILL BLOCKED

## 1. Evidence reviewed

BETA-R2b operator report confirmed:

- PR #6 exact candidate/base unchanged;
- no live mutation was performed;
- UserProfile bootstrap preview PASS;
- six profiles + one HICC-2 exclusion;
- live SQL: `paws_swa_beta` absent;
- current deployed SWA has no managed API routes yet;
- Azure SQL has `azureADOnlyAuthentication=True`.

## 2. Critical blocker

SQL username/password authentication cannot be used because the Azure SQL server is Entra-only.

The current SWA managed Functions topology also cannot use Managed Identity.

## 3. Post-review correction

Microsoft Azure documentation confirms:

- SWA managed Functions do not support Managed Identity;
- SWA backend application settings are supported and exposed to backend API code as environment variables.

Therefore the report's conclusion that the three settings are "not yet applicable" because the API has not been deployed is too strong. They can be prepared/configured on the Static Web App for the backend API.

## 4. Recommended minimal Beta path

Pending owner approval:

1. keep PR #6 SWA managed API architecture;
2. create a dedicated Microsoft Entra app registration/service principal;
3. create a contained Azure SQL user mapped to that service principal;
4. apply the narrow BETA-R1 004 permission contract;
5. configure service-principal connection parameters only in SWA backend application settings;
6. insert the reviewed six UserProfiles;
7. deploy exact PR #6 artifact;
8. run live login/session-read smoke test;
9. keep timetable writes fail-closed.

This is a Beta bridge. A separate App Service/Functions + Managed Identity can be reconsidered later for production hardening.

## 5. Live operations

None performed by this review.

Explicitly not performed:

- no Entra app registration/service principal creation;
- no SQL user creation;
- no SQL grants;
- no UserProfile inserts;
- no Azure setting changes;
- no deployment;
- no DOE changes.

## 6. Exact breakpoint

Owner must approve the runtime Entra-authentication path before BETA-R3 live activation work begins.
