# Agent Update — History year search, CCC template and record-linked AFC originals

**Date:** 2026-10-18  
**Agent/model:** Codex  
**Repository:** Alex1122341/Teaching-assignment-azure  
**Task status:** COMPLETE (technical implementation and release); human acceptance retained

## 1. Goal

Compact, keyword-searchable academic-year History; downloadable CCC header-only workbook; optional original PDF inside Create AFC, precise record binding, per-record downloads/N/A and faculty-own archive access.

## 2. Starting breakpoint

- Base main/live: 27d339bfa18f2204993896c6a5625763ae83c5cd / anchor9eb2dafea78674013a6c7fd894cdb1b6f2342c3f / SQL048–049.
- Worktree: startup-recovery-20261017; branch feat/history-year-afc-record-pdfs-20261017.
- Final reviewed head:3984425a01fc33f74d4a4231a2e8899caaa856ca; PR116.
- Previous update:2026-10-17-afc-ccc-released-excel-acceptance.md.

## 3. Work performed

- Implemented and independently reviewed product and separate freeze promotion; fixed review and full-suite integration findings with regression tests.
- Merged PR116 under standing owner authorization, checked exact-main CI, downloaded exact-main artifact and compared all176 raw files with accepted candidate.
- Prepared/attested93 school runtime files; applied050/051, staged API, verified gates/SQL, cut over API, deployed Hosting only and verified79 public protected assets.
- Updated original progress workbook and school/desktop recovery configuration; CheckOnly healthy. Human signatures preserved.

## 4. Files / components changed

History UI/client and server projection/year/query/export; CCC template route/client; AFC record UI/profile helper, APIs/repositories, SQL050/051; separately reviewed static/API freeze and corresponding tests/docs. The profile controller remains58907 LF bytes below its existing60000-byte bound.

## 5. Architecture / invariants affected

Firebase Hosting/Auth → temporary Cloudflare ingress → University API → VetMed-Ops SQL preserved.95 runtime API files/98 protected API paths and79 static paths pinned to accepted product d7e4887cb413667fef0d992105148defb19f856c. No drift exceptions or widened bounds.

## 6. Data / algorithm changes

- History six compact columns:Time;Type / Domain;Session / Faculty;Change From→To;Start / End;By whom. Long content expands. Academic year is mandatory; keywords filter the complete retained authorized set before100-row paging/export. Optional changed-on filters no longer hide older business-year events behind365 days. Explicit malformed year evidence cannot infer scope; all intermediate overlap years appear.
- CCC one-sheet header-only XLSX:Faculty ID,Faculty Name,Start Date,End Date,Course Code,Label. Format instructions agree with strict parser. Download is read-only.
- Optional admin PDF upload inside Create AFC. SQL exact same-faculty/same-uploader document binding and record/audit write are one transaction. Unknown write outcome remains protected against duplicates. Legacy/unlinked records show N/A. Faculty/HICC/VISC may list/download only their own linked faculty's originals, with server revalidation and private/no-store response.
- Public History search uses only authorized projected fields; no raw payload/UID/email leakage.

## 7. Tests / CI evidence

- Final local npm test968 total/916pass/0fail/52 environment skips; server702/699pass/0fail/3skip.
- Final head3984425:Azure Beta Build39133433368; Azure SQL39133433306; Calendar SQL39133433323 all success.
- Exact-main55813f8:Build39134175843,SQL39134175883 success. Root968/916pass/52skip;API702/698pass/4skip;emulator968/949pass/19skip;final build/freeze65/65;all0fail.
- Candidate/main176 raw files identical; main ZIP SHA256 e1fbd4e3ee707dd3cd078ae57b203081249864592547711a7ccc24d7c89751cf.
- Chrome synthetic actual client/API/parser:239 rows,139 keyword matches,101–139 page,CSV140 lines with header,old2024 year,desktop/390px; actual6719-byte CCC XLSX read back1 sheet/1 row/6 columns. Genuine synthetic PDF worker/archive/download and scope tests passed. Native file chooser/real approved PDF remains human acceptance.
- Separate product and governance independent reviews Ready. Review corrections covered retained dates, malformed-year evidence, intermediate-year facets, optional AFC-helper fallback and extracted profile renderer parity.

## 8. Live operations

### Performed

- Merged PR116 to55813f81b8fe2d7a1f6fd95178e79a993e3953c5.
- SQL050_afc_record_documents and051_record_document_history applied once.31 existing table fingerprints and business/audit counts unchanged;0 new document links/role memberships.
- Fresh pre-apply counts:AFC263,manual AFC13,Calendar540,import receipts1,recovery540,audits37,DOE audits33. No fabricated test business rows written live.
-93-file runtime attestation; staged18789 then closed; live18787 API55813f8/anchord7e4887 SQLhealthy. All27 prior gates equal, CCC commitfalse.
- Firebase Hosting-only deploy from exact-main app.79/79 protected public bytes match; CORS and unauthenticated refusal verified. Public origin charge-concerning-hypothesis-represents.trycloudflare.com.
- Recovery school config+desktop public copy repinned to new launcher/93-file manifest; CheckOnly RUNTIME_AND_ORIGIN_MATCH/siteReady=true. No task installation/reboot performed.
- Original PAWS任务进度.xlsx updated:28 checks=14pass/13open/1N/A. Added H02/F03/C08 technical passes; corrected F02 for faculty-own download. Native ZIP parts, styles, formulas, validations, existing manual cells independently preserved/checked.

### Explicitly NOT performed

No540-record migration replay,actual CCC replacement,real PDF upload,synthetic live AFC creation,DOE policy publication/recalculation,Firewall/Firestore changes or scheduled-task installation. CCC commitfalse; real approved complete-year source still required.

## 9. Current state after task

- PR116 merged; main55813f8,product/freezed7e4887,SQL050/051/API/Hosting LIVE.
- Technical implementation and release complete. H01/F02/C07/O01 and existing manual acceptance remain open.
- Source worktree retains local continuity closeout updates after merge; carry these into a future docs PR rather than modifying main directly.

## 10. Blockers / unresolved questions

Actual multi-role human acceptance,approved real PDF/native picker,approved complete-year CCC source and actual replacement,scheduled-task credential registration and real restart remain. New Chrome tab shows no restored sign-in; no credentials were invented or extracted to bypass it. Existing user tab left untouched. Prior CCC old-target faculty GUID display remains a deferred minor.

## 11. Exact current breakpoint

Released and verified. Original Excel is current. School acceptance evidence is under P:\PAWS\Runtime\Acceptance\HistoryRecords-20261018; local acceptance/proof/builders under the scoped paws-progress-workbook-20261015 temp directory. Do not rerun schema/migration scripts. Resume with human acceptance or the next explicitly selected task.

## 12. Next safe action

Use the original workbook's13 pending checks for real-user acceptance. Obtain approved complete-year CCC source and exact preview before enabling a one-off commit. Use a real authorized signed-in session for H01/F02.

## 13. DO NOT REDO

Do not replay540 migration or reapply050/051 blindly. Do not create another feature PR for the already merged product. Do not count synthetic tests as human sign-off. Do not install restart task without the required local credential step.

## 14. Rulings and release-tool corrections

- Continue explicitly selected Beta worktree and standing merge/release authorization; preserve reused worktree and avoid repeated approval menus. Cost if wrong:scope/deployment selection; actual repo/PR verified before mutations.
- Retained business-year History has no hidden changed-on cutoff; bounded authorized snapshot still fails explicitly when too broad. Cost:large-query users may need narrower filters.
- Keep60000-byte controller limit by extracting AFC rendering into existing AFC feature module. Cost:parity tests must follow the actual delegation; updated regression assertions cover it.
- School release preflight query UNION/FOR JSON initially failed before DDL; wrapped derived table, reran guards and obtained31-table invariant proof. No business writes from failed attempt.
- Recovery wrapper initially treated null/stale LASTEXITCODE as failure after successful in-process CheckOnly and restored backup. Corrected to child PowerShell exit code plus parsed health; verified success and repinned config. No security/gate change.
- Artifact renderer exported and rendered previews but hit known Windows native teardown exit fault. Independent OOXML verification confirmed requested values/caches,28/14/13 counts,all unrelated manual cells/native parts. Before/after previews visually inspected.
