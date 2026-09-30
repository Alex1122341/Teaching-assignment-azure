# BETA-R4D-12B1G — Baseline Promotion / PR Integration

**Date:** 2026-09-29
**Branch:** `feature/beta-r4d12b1-afc-dashboard-write-foundation`
**Accepted B1 candidate:** `68bda43a71034089a57d3369128e5dafd80f06eb`
**Required governance parent:** `68bda43a71034089a57d3369128e5dafd80f06eb`
**Origin/main before merge:** `68cd57074bbcf7916da6a031a238175d5530ae0b`
**Status before merge:** B1 IMPLEMENTED / B1R+B1R2 ACCEPTED / BASELINE PROMOTED / PR PENDING / NOT LIVE

## Governance implementation

- Promoted `68bda43...` as the single static/API freeze trust anchor.
- Updated `tools/beta-freeze.js` to BETA-R4D-12B1G and the exact candidate SHA.
- Updated `tools/beta-baseline.json` sourceCommit and regenerated its recorded
  hashes from Git blobs at the candidate commit using canonical line endings.
- Kept `tools/static-assets.json` unchanged at 46 protected paths.
- Updated baseline/governance tests to use the candidate and previous B0
  baseline, preserve immutable-anchor and attack tests, and recognize the new
  protected API write repository.
- Updated the active static release evidence baseline to the candidate without
  changing deployment behavior.
- Updated active continuity documents. Historical B0/B1R references remain
  historical and were not globally rewritten.

## Required governance boundary

Candidate-to-governance product-runtime diff: must be empty.
Candidate-to-governance SQL migration/business diff: must be empty.
No files under `database/azure-sql/`, `server/src/`, static protected runtime,
`faculty-admin.html`, `faculty-admin.js`, `paws-data-client.js`,
`swa-api/index.js`, or `deploy/aca/Dockerfile` are allowed in the governance
commit. No business tests are allowed except baseline/governance expectations.

## Evidence targets

- Static freeze: PASS, baseline `68bda43...`, protected 46, drift `[]`.
- API freeze: PASS, baseline `68bda43...`, runtime set 17, Dockerfile drift `[]`.
- Candidate verifier: PASS with static drift `[]` and API drift `[]`.
- Main must remain `68cd570...` before merge.
- One governance-only commit is pushed on this branch.
- One PR goes to `main`; integration must use a merge commit only.
- PR integration does not deploy B1. B1D remains queued and must not start
  automatically.

## Safety

Migration 007, permission apply, live proof, live AFC creation, SQL grant
mutation, Firestore/Firebase/Auth/Rules mutation, Azure mutation, deployment,
A2B, Work Queue, B2A, B2B, and DOE changes: none.
