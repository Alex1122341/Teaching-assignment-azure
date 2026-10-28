# Agent Update — Own effective identity and scoped workflow integration

**Date:** 2026-10-27 (Calgary)  
**Repository:** Alex1122341/Teaching-assignment-azure  
**Status:** PARTIAL; hardened SQL061–063 acceptance pending

## Verified breakpoint

Follow same PR148/feat/effective-access-20261026 in the PAWS-DOE-Preview worktree. Previous eba55eb exact Account SQL run40605457721/job122543708622 passed27 markers, including concurrency, recorded VISC area/date boundaries and exact rollback. It does not prove the later approval-binding hardening or063 workflow changes. Prior source/live/candidate/ledger paths remain in2026-10-27-service-acceptance-and-multiple-roles.md. No live operations in this continuation.

## Consumer work implemented

Commit978039c added request-time Calgary/year identity composition. Commitc8f1a46 mounts it for access/self and Teaching Assignments, reusing the already versioned account profile reader (now includes linked Faculty active status) rather than creating a second profile/identity read implementation. Unrelated business readers keep their existing base-role privacy behavior. Self JSON adds own effectiveRoles, year, dated canonical responsibilities and separate scopeVersion without replacing BaseRole or AccessVersion. Same normal token loses extra roles on the next request after scope removal; missing SQL authority returns503, no Firestore/cache fallback.

Teaching Assignments accepts trusted effective HICC/VISC alongside Faculty but does not grant global/office edit rights. Work queue uses a single SQL union of current HICC/VISC/administrative package authority, not a browser-selected actionKind. Rows have per-package capabilities, including separate self-review restrictions. Nested package/history reads recheck SQL package ownership and revision after awaits; API also rechecks profile/scope fingerprint before releasing results. Self-review and exact-authority errors use fixed403 messages without raw SQL details. Runtime wiring, API and SQL-seam tests observed failing cases before implementation.

Latest full local server after self/workflow changes:998total,991pass,0fail,7skip (multiple-roles-server-self-workflow.log). One later error-mapping test and SQL changes followed; final fresh full run still needed. Focused newest workflow/account/identity tests47/47 pass; earlier full server983/0/7 and focused81 are historical. Root remains the known unfinished immutable-runtime freeze gate; do not claim a fully green candidate or advance cb4298c.

## Newly reproduced authority gap and fix under acceptance

Review found that merely changing a scope fingerprint clears pending results but does not prevent a future read from automatically inheriting an expanded responsibility definition. Added real SQL test first:6fd5526/run40608758073 fails54160, "Changed definition automatically widened an existing approved course grant." This is a reproduced new-role grant issue, not a production database incident; no061/062 has been installed live.

Hardened source links now additionally bind the approved semantic responsibility scope and exact assignee identity/year/dates/mode, not just the business appointment source. New value signatures permit no-op metadata versions while denying expanded course/area/window changes until an Owner previews a new grant. Epochs still detect A→B→A and empty-list revocation. The Owner command computes these bindings inside its transaction and preserves them with complete prior/current grant values and original operation IDs in recovery/audit receipts. Updated every synthetic source-link seed and guarded rollback. Actual hardened SQL proof is pending at this checkpoint; the earlier27-marker receipt must not be reused for these changed migration bytes.

Ruling: bind approved scope/window values in addition to versions — versions invalidate old intents but alone do not constrain future access after definition edits — legitimate definition/date changes require a fresh explicit grant preview; legacy same-kind BaseRole paths remain as before.

## SQL063 under acceptance

Wrote guarded dynamic-current-academic-year actual SQL acceptance before implementation. c8f1a46/run40608110192 produced expected54360 "Scoped multi-role SQL workflow authority is missing." The new migration reuses EffectiveTeachingAssignments for exact canonical package authority, preserves025 Developer/global scope and concurrent-assignee rules, denies mixed/unowned current-session scopes, and keeps unknown session VISC routing denied. It captures/restores exact original module definitions for recovery. Teaching proposal authors/submitters cannot review themselves; an independent existing VISC reviewer can complete review/final-submit. Scoped HICC contribution context remains local, never changes UserProfile.BaseRole. Ownership/package identity changes update authority epoch; ordinary workflow status/revision writes do not, so a successful write does not revoke its own response.

New rollback refuses changed module evidence or used workflow/SWAP history and restores original modules exactly only on an unused fresh target. Reverse order is063→062→061; lower-layer rollbacks refuse a retained newer workflow layer. Test runner now requires34 markers across060/061/062/063 and fresh unused recovery. Actual063 execution is pending; do not call source tests SQL proof.

## Remaining work

1. Collect/fix hardened061–063 exact-head SQL run, including approved-definition and assignee-window non-expansion, mixed package, independent review, current-date expiry, SWAP routing and exact used/unused recovery. Run latest full server and record counts.
2. Finish Task3 SWAP awaited identity binding/read negative tests and any remaining SQL/client capability integration. SQL profile source deliberately reused account-access-repository; no duplicated UserProfile reader needed.
3. Task4 Owner leadership choices/preview/commit/history routes and UI, own role summary, scope-aware client guard/role helpers, effective HICC collaboration with exact existing ownership; normal Tim browser acceptance. No ownership transfer.
4. Task5 actual canonical Tim505/Bovine mapping preview/recovery/application as the specifically requested configuration, independent whole-branch review and separately reviewed freeze promotion. Source-link FK can intentionally block deleting a referenced business appointment; reconcile MASTER Undo/delete before release.
5. Fresh exact-head/main full/emulator/SQL/artifacts, coordinated API/Hosting/separate restrictive rules, public read/deny/recovery and original workbook technical progress. Human signoffs stay unsigned.

## Live and user authorization

No real grants, source appointments, teaching data, collaboration ownership, Auth accounts, server restart, gate activation, migration061/062/063, Hosting/rules publication or merge. Owner permits an additional suitable Faculty account if necessary, then handing over credentials; none has been created. Do not invent alternate reviewer grants to force a successful production fixture. Actual Tim retains the old single Faculty base-role behavior until the full accepted release/configuration. No Codex memory modification.
