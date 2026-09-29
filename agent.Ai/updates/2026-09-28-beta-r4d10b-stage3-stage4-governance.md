# Agent Update — BETA-R4D-10B Stage 3 (accepted) and Stage 4 baseline promotion

**Date:** 2026-09-28
**Repository:** `Alex1122341/Teaching-assignment-azure`
**Branch:** `feature/beta-r4d10b-dashboard-api-client-auth`
**Task status:** Stage 3 ACCEPTED by Architect; Stage 4 governance promotion COMPLETE / AWAITING ARCHITECT REVIEW

## 1. Accepted Stage 3 runtime candidate

`25e8f483b7d2455c0f96b00c82f3fde30760ac17`

Five commits above authoritative main `db777d721ccff5665bc103fba89482a356dc0041`:

| commit | stage |
|---|---|
| `535c0b2` | Stage 2 — Dashboard API client + `/me` auth cutover |
| `5d182fd` | Stage 3A — core Dashboard reads cut over to the Azure SQL API |
| `aaf785b` | Stage 3B — legacy Dashboard Firestore surface retired from the page |
| `048a879` | Stage 3C — dormant Firestore implementation deleted; zero-Firestore controller |
| `25e8f48` | Stage 3C1 — retired role policy aligned with the server |

## 2. Dashboard runtime architecture (final)

```
Firebase App (app-compat)
Firebase Auth (auth-compat)   <- authentication only
session-guard.js
paws-data-client.js
faculty-admin.js
        |
        v
PAWS Azure API  ->  Azure SQL
```

- `faculty-admin.html` loads exactly **5 script elements** (2 Firebase CDN + 3 local).
- No `firebase-firestore-compat.js`, no `faculty-access.js`, no legacy Dashboard modules, no inline flag.
- `faculty-admin.js` is 19,928 bytes / 44 named functions with **zero** `firebase.firestore`,
  `db.collection`, `db.doc`, `FieldValue`, `enablePersistence`, `onSnapshot`, Firestore collection-name
  or `UCVM.` helper references.
- Dashboard business data comes from `GET /api/v1/dashboard/summary|faculty|faculty/:id` only.
- Admin flow: `/me` -> parallel `dashboardSummary()` + `dashboardFaculty()` -> KPIs/Lookup ->
  lazy cached `dashboardFacultyById()`. Initial detail calls = 0.
- Self-service flow: `/me` -> `dashboardFaculty()` -> own-row check -> `dashboardFacultyById(own id)`.
- Legacy Dashboard tabs, write/import/editor controls and all Firestore fallbacks are retired.

## 3. Authorization contract (unchanged, now aligned on both sides)

- ADMIN: `owner`, `administrator`, `adfa_general`, `adfa_regular`, `admin`
- SELF-SERVICE: `faculty`, `hicc`, `visc`
- DENIED: `other_office` (retired), `viewer`, `editor`, unsupported roles

The frontend `dashboardAdmin()` allow-list now equals the server `ADMIN_ROLES` set exactly, guarded by
`tests/faculty-admin-role-policy-parity.test.js`, which parses the server policy rather than duplicating it.

## 4. Stage 4 governance promotion

- previous frozen baseline: `2b10aca5b9ab26ffecdffb685bddd33ae4de70f5`
- **promoted frozen baseline: `25e8f483b7d2455c0f96b00c82f3fde30760ac17`** (the reviewed runtime candidate, not the governance commit)
- `tools/beta-freeze.js` `BASELINE_COMMIT` -> the candidate
- `tools/beta-baseline.json` `sourceCommit` -> the candidate; all 7 recorded sha256 values recomputed from the
  Git blobs **at the candidate commit** using the same LF canonicalisation as `beta-freeze.js`
- `tools/static-assets.json` unchanged at 45 shipped assets
- `verifyFreeze` -> `{baselineCommit: 25e8f483…, protected: 45, drift: [], ok: true}`
- `beta-freeze.js --artifact .azure-production/app` -> `{ok: true, protected: 45}`
- protected runtime delta from the candidate: **zero**

## 5. Verification snapshot

- governance-focused tests: 56/56
- frontend full suite: 486 total / 454 pass / 3 fail / 29 skipped
- server suite: 96/96
- remaining frontend failures: 2 faculty-swap source-contract anchors that use an LF-only literal against a
  CRLF Windows checkout (the contract holds on the LF blob at the frozen candidate), and 1 host-only
  hosting-boundary failure because PowerShell 7 is not installed on this machine

## 6. Release readiness

- `GOVERNANCE_PROMOTION = PASS`
- `RELEASE_READY = NO` — see the Stage 4 report; the two faculty-swap source-contract test failures remain
  unresolved locally and were not waived.

## 7. Not done here

No merge, no PR, no deployment, no ACA/SQL/Firebase/Azure change, no runtime behaviour change.
