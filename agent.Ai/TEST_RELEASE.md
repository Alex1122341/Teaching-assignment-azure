# PAWS Test and Release Guide

## 1. Core rule

**Green CI is evidence, not deployment authorization.**

A PR may be complete and green while:

- not merged;
- not deployed;
- not live-provisioned;
- not connected to live runtime settings.

Always report these states separately.

## 2. Current BETA-R1 evidence

PR #6 implementation report recorded:

- Azure SQL Migration Tests #46: SUCCESS
- Azure Beta Build #58: SUCCESS
- Node tests: 290 pass, 0 fail, 29 skipped
- server SQL-runtime authorization tests: 10/10
- Firebase emulator regression: 319/319
- deployment/baseline contract tests: 14/14
- combined app/API artifact built
- no deployment

Verify again if PR #6 HEAD moves.

## 3. Freeze/baseline

Frozen application baseline:

`f74443d945a9f6c917e7e634eb2e7825f02c7ab0`

This is Runtime Commit E, the BETA-R4D-9E ACA-direct SQL-backed read runtime candidate with deterministic calendar period mapping. It is the reviewed frozen runtime and is **NOT YET DEPLOYED**.

Protected static assets are driven by `tools/static-assets.json` (45 entries; the previous 44-path set plus `paws-data-client.js`). Both `pull_request` and `push` to `main` allow zero protected runtime drift.

`tools/beta-freeze.js` compares against immutable Git blobs from the frozen baseline.

Do not bypass freeze protection merely to get a feature deployed.

When the approved Beta release intentionally changes protected runtime files, the baseline/release process must be updated deliberately.

## 4. Build artifacts

Historical static-only release used a static artifact.

BETA-R1 candidate builds:

```text
.azure-production/
  app/
  api/
```

The API artifact is part of the candidate and must be tested/bound to the exact release.

## 5. Minimum acceptance for BETA-R1 live activation

Before calling the SQL-backed Beta connected:

1. approved UserProfiles exist;
2. authenticated API verifies Firebase token;
3. `/api/v1/me` returns the expected SQL profile;
4. `/api/v1/sessions` successfully reads Azure SQL;
5. page visibly renders SQL-backed timetable data;
6. no session Firestore fallback;
7. browser contains no SQL credential;
8. session mutation remains disabled;
9. DOE remains unchanged;
10. exact deployed SHA/artifact is recorded.

## 6. Live operator evidence

After any live activation, the agent update must record:

- exact deployed frontend/API SHA/artifact;
- SQL profile count after apply;
- SQL principal name/type (not secret);
- permission categories;
- setting names configured (not values);
- smoke-test account category;
- success/failure;
- rollback/forward action if needed.

Never place secret values in the update.

## 7. Exact-ref discipline

When a task names a PR HEAD, inspect that HEAD.

Do not use default branch code as a substitute.

Important refs at the continuity baseline:

- Beta main `e15a532...`
- PR #3 `edb46dc...`
- PR #4 `d9244f5...`
- PR #5 `a940902...`
- PR #6 `075852b...`
- Experimental PR #76 `6ce74ef...`

Mutable facts must be reverified before action.

## 8. Merge discipline

No merge without explicit owner approval.

A Draft PR is not approval.

A green build is not approval.

A successful preview is not approval for live mutation.

## 9. Deployment discipline

Normal pushes do not release Beta.

Use the reviewed manual exact-SHA release path.

Record deployment in `agent.Ai/updates/` immediately after completion.

## 10. DOE regression boundary

Current owner instruction is stronger than a generic regression rule:

**do not modify DOE at all during the Beta connection work.**

If a proposed “small fix” touches DOE files, stop and ask whether scope changed.
