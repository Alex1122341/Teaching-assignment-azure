# Agent Update — DOE Worksheet source recovery release

**Date:** 2026-10-08
**Agent/model:** Codex
**Repository:** Alex1122341/Teaching-assignment-azure
**Task status:** PARTIAL — directed code/data release complete; seven real contract targets await owner evidence.

## 1. Goal
Recover known Worksheet DOE lines, supervision and totals from supplied sources; show accurate calculation status without guessed data.
## 2. Starting breakpoint
Base/live API 092122c84d5a5ab49c1de19a829fe82d6650598d. Branch fix/doe-worksheet-evidence-20261008. Prior role source recovery already complete; do not rerun it.
## 3. Work performed
Reused shared teaching/role resolvers; imported owner-confirmed trainee source and PDF reserve parameters; separated recovered source calculations from unpublished annual engine policy. Reviewed product and governance with an independent reviewer. Fixed scoped SQL source reads and NULL-safe import guards. Corrected existing CI fixture/report expectations.
## 4. Files / components changed
sql-doe-worksheet-repository.js, doe-worksheet-service.js, doe-reserve-service.js, faculty-admin-doe-worksheet.js; migration 028; source preparation/import tools; explicit freeze governance and continuity docs.
## 5. Architecture / invariants affected
Existing Firebase Hosting/Auth → temporary Cloudflare ingress → University API → VetMed-Ops retained. All write gates preserved. Product/trust anchor 0e6f7a20dae9f0ba86f4157aabefda0a1fa8fb5f. Draft Annual Rule Book remains unpublished; source evidence is separately identified.
## 6. Data / algorithm changes
Exact preferred/HR crosswalk, no fuzzy identities. 116 unique supervision snapshots, 42 explicit zeros, raw aggregate 569.25 percentage points. Five missing persons explicitly confirmed zero; missing formulas calculated using source formulas. Current-year counts used under PDF fallback; no history invented. Reserve threshold35, split0.5, ceilings15/7.5, averaging window3. Annual facts/parameters take precedence over fallback snapshots.
## 7. Tests / CI evidence
PR #75 head14fae37: Azure Beta Build37849714448 and migrations37849714318 passed. Merge/exact-main d42313746f6edfca34d22055d11d7d89df720d96: build37850151374 and migrations37850151391 passed. Existing hosted root suite799 total/767 pass/32 skip/0 fail; server502 pass/0 fail; emulator799 pass/0 fail; governance53 pass/0 fail. No new/manual tests executed. Server58 runtime/foundation/package files match exact-main hashes; static worksheet SHA256 matches live Hosting.
## 8. Live operations
Migration028 applied; guarded rollback preview returned116/569.25/42, then -Apply committed identical values. SQL reread confirmed. API cutover succeeded, PID19656, loopback18787, release d423137, anchor0e6f7a2, unchanged gates and SQL healthok. Firebase static-only deploy succeeded:59files/1,881,921bytes. No annual publication/recalculation or Firestore/Functions deploy.
## 9. Current state after task
PR75 merged. Live API and Hosting released from d423137. Browser confirms Alanna teaching39.26%, role12.25%, raw/appliedsupervision1.50%, total53.01%, remaining27.00%, Calculated from recorded sources with workload/target references. All116 real faculty raw supervision available;109 full totals calculated. Five confirmed zero and Boysen/Jackson/Pfau formula recovery visible. Private screenshot/DOE list/plan retained in outputs/worksheet-recovery-20261008. Server evidence retained in C:/PAWS/Runtime/Acceptance/WorksheetDOE-20261008.
## 10. Blockers / unresolved questions
Seven real faculty lack 2026–27 formal contract targets: Andrew Mardjetko, Derrick Rancourt, Douglas Morck, Jennifer Dodd, Renate Weller, Shannon Toy, Thilo Pfau. Requested owner values/files through async question. Existing Faculty Master List has Andrew60/Jennifer30, but applicability to this academic year needs confirmation; other blanks cannot be inferred from zero supervision. Four non-person placeholders and inactive acceptance fixture lack source/target intentionally. DOE List still reports annual calculation policy unavailable because it is not published; detail explicitly identifies approved source provenance.
## 11. Exact current breakpoint
Known-source release is complete. Await seven contract-target evidence/confirmation; do not change those targets until supplied. Resume by reconciling exact Faculty identity and target source, preparing guarded narrow target recovery and reviewed release if required.
## 12. Next safe action
Use owner answer to fill only confirmed targets, then verify applied supervision/total/remaining for affected faculty.
## 13. DO NOT REDO
Do not rerun supervision import, previous role repair, schema drops, annual publication, or change write gates/credentials. Do not infer missing contract targets or historical trainee counts.
## 14. Suggested next-agent prompt
Continue from live d423137 and this update. Read owner's seven-target answer; no unrelated architecture work.