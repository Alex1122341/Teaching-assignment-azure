# Integrated SWAP and approval workspace

## Authority and inspected reference

The Owner explicitly asks to fuse the prior approval flow from `UCVM-Teaching-Assignment/Teaching-assignment` into the current Beta SWAP. Reference HEAD inspected: `cc7cd33120275d3ac18da84310bc968d1fa32d74`, especially `web/js/approvals/{approval-routing,approval-lifecycle,approval-office-view,approval-workflow}.js`. Reference code is a source for behavior and presentation, not permission to restore Firestore business writes or its obsolete deployment setup.

Continue PR143 from `fae18b483378229a666c2903d0bafcd3a1fe0009`, base main87a7f943. PR142 History remains separate. Standing Owner direction selects recommended routine options and inline execution without repeated design questions. This document records the implementer's choices, not new approval-role grants.

## Findings and approach

Both reference and current SQL already enforce relevant offices ADC → LAB → ADFA. Beta additionally preserves optional replacement consent and scoped VISC before office reviews. The reference has a real approval queue, scoped From/To presentation, decision readiness, push-back/resubmission, withdrawal, audit and final apply. Beta currently hides this behind a simple inbox/list and raw status/history. Its detail DTO omits persisted route flags, original snapshot, actor labels and request ownership needed for a useful integrated view.

Chosen: port the reference interaction model onto existing SQL request/decision endpoints and extend only read projections. Alternatives rejected: enabling the reference Firestore listeners/writes (wrong business authority), or drawing a guessed approval chain in the browser (could misrepresent authority or old revisions). Preserve the existing conservative SQL rule that revisions require fresh approvals; do not import Firestore's scope-preserving approval rules without a separate state-machine change.

## Integrated experience

- Existing global SWAP entry opens **SWAP & Approvals**. One searchable, compact queue: All in scope, Needs my decision, My requests, Completed; filters by request status and keyword across returned public fields. Display result counts, reset, refresh, course/date/type, requester label, current stage and updated time. Never broaden the SQL queue's scope or use browser role claims.
- Request detail shows session/year, kind, requester, revision, immutable original From/To proposal, note, serial approval steps and current waiting office. Only persisted `NeedsAdc/NeedsLab/NeedsVisc/NotifyReplacement` and current-revision decisions determine steps. Earlier approvals appear in history but cannot complete a new revision. Unknown/inconsistent routes say verification needed; never invent approval success.
- Reuse existing revise, withdraw, approve/accept, reject and push-back endpoints with expectedRevision. Name the current stage on actions and explain final application versus an intermediate approval. Reject/push-back require a comment; Owner/Developer override stays explicit and reasoned. Protect repeated clicks, identity change, stale409 and closed/late responses. Final SQL apply remains transactional, gated, audited and availability/DOE checked.
- Review history is a compact table with timestamp, revision, office/event, decision, actor and comment. Show names through shared Last name, First name formatting; no UID/email/UCID/HR/AFC reason/other private DOE. Current display labels do not rewrite historical source records.
- Creation retains PR143's three intents and two-step review plus ADFA DOE/candidate panel. After save, navigate to this same approval detail; no disconnected second workflow.

## Read contract and privacy

Add migration059 replacing only existing `GetSessionSwap` and `GetSessionSwapQueue` read procedures, retaining execute grants, authorization predicates and all underlying request/decision/revision rows. No business DML, role/grant change, write-procedure change or existing migration edit. Return an allowlisted original snapshot (public schedule and outgoing name only), persisted routing bits, named public actor labels, revision/decision records, queue ownership and decision capabilities. Never return raw SnapshotJson/PayloadJson, profile email/UID, Faculty IDs/UCID/DOE or AFC details. Actor names use linked structured faculty components when available; unlinked email-like labels become a neutral placeholder.

The API builds a sanitized presentation from this contract. Missing059 supports the existing minimum detail with an explicit incomplete-route notice; it does not fabricate missing states or grant actions. API authorization, SQL row scope and write gates remain authoritative. Final decisions recheck SQL even if an earlier displayed capability is stale. Queue returned rows may be large; filtering stays local to the already-authorized response and does not introduce extra data delivery.

## Boundaries and gaps

This completes the integration of the reference approval flow and the new SWAP intake. It does not create an ADFAD→DVM alternative policy, student/CC grants, real email delivery, multi-session atomic requests or an audited external-task checklist: these do not exist in the inspected reference either. Existing HICC behavior, production data, approvals, audit, DOE, immutable PDFs, gates and pending request routing stay intact. Do not submit real requests/approvals or run live DDL as an acceptance probe.

## Verification and release

Use previously agreed seams: page workflow, authenticated API/projection, SQL authorization/concurrency. TDD covers actual public calls, current-revision route/terminal states, stale/disabled/write-gated actions, search/reset/counts, actor/snapshot privacy, double submit and identity switches. Add isolated SQL acceptance for059 and rollback rehearsal against a labeled disposable target only; inability to run it is an explicit release limitation. Browser uses generated assets and synthetic cases (ADC pending, LAB waiting, ADFA final, push-back/resubmit, withdrawn/applied, long names and denied fields) at desktop/narrow widths.

Commit reviewed product separately from immutable freeze promotion. Preserve full union inventories and historical governance receipts. Run root/server focused/full checks as required, sequential builds/freezes and independent whole-branch product/governance review. Update original ledger and exact-head cloud CI prompt. No release claim until official checks and required SQL/API/role acceptance are proved; no manual Actions dispatch/poll here.
