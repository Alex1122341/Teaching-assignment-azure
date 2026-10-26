# Progress ledger reconciliation — 2026-10-24

## Scope and authority

The owner's local workbook is `PAWS任务进度.xlsx`, with 39 task rows and 43 acceptance rows. Its previous status date was October 21. This reconciliation continues the explicitly selected **Teaching-assignment-azure / Beta** work. The downloaded `Teaching-assignment-main` folder is preserved; its separate Pages/Firestore instructions do not replace this repository's University SQL architecture.

Task 26 / GOV-01 is the read-only baseline reconciliation. Unimplemented features, deployed technical checks and user acceptance remain separate. No business write or user signoff is implied by this document.

## Verified current baseline

| Item | Evidence |
|---|---|
| Repository main | `87a7f943f40bc5bf87b54b1b0059a2593ebc3b7d`, re-read from GitHub branch API October 24 |
| PR 140 | Merged; current GitHub metadata confirms its accepted release receipt |
| Main push CI | Run `40113620342`, exact SHA above, completed / success, freshly read |
| Official artifact | `12567194271`, ZIP SHA256 `9b716c23eb2012cf242f47983aa53900cd8104208ea9c0e10f1e9cd1a181f061`; digest verified at publication locally and on the school server |
| Hosting | `https://tester-teaching.web.app`; release `1792861391972000`, version `2c7005ce99b6dbab` recorded at publication |
| Fresh served-file check | October 24, 17:34:27 UTC: **91/91** raw hashes match that exact main artifact |
| API release | `8bb40c60370bcce3d0135efd4327d42fba657903` |
| API trust anchor | `58daab3a2401af69c2298cc1f078d78aad069ea9` |
| Read boundary | Firebase identity → University API effective SQL role/scope → `ITAPPVETOPSDB01` / `VetMed-Ops` |
| Health and gates | SQL `ok`; anonymous `/api/v1/me` 401; correct Hosting CORS; 27 gates unchanged |

The static and API release SHAs deliberately differ: PR 140 updated only frontend assets and the recovered HTTPS ingress. The API remains the preceding accepted release. This is not evidence of a failed backend update.

## Corrections to stale task entries

- **05**: HICC–CC / VISC public directories were delivered and live-tested in PR 132; they are no longer “not started”. Keep actual business signoff separate.
- **04 / 07**: searching the VISC directory does not establish Calendar-by-VISC filtering or a VISC-filtered Faculty Lookup. Leave those distinct feature gaps open.
- **06**: the existing administrator Roles & Appointments tab and period fixes do not establish a public Active Roles projection. Record partial delivery and retain the privacy/scope gap.
- **32 / 33**: PR 140 delivered the three-route workspace and shared layout. Full populated lazy-tab coverage, native 200% zoom and the entire master-plan scope remain open.
- **39**: PR 140 has exact-main CI, verified artifact and Hosting-only publication evidence. The broader release program remains partially accepted.
- **12–14 / 16 / 18–19 / 22**: retain successful historical migrations and data receipts. Do not replay the 540-row migration, 413-position CCC replacement, MASTER imports or DOE publication to refresh a status cell.

## Authority matrix and outstanding risk

| Surface | Current authority | Acceptance boundary |
|---|---|---|
| Calendar, Dashboard, Assignments | Authenticated University API; server-side SQL role/scope | Normal Faculty/admin live login and scoped reads were accepted for the PR 140 release |
| Public leadership directories | Allowlisted University API projection | No confidential directory/DOE fields delivered; historical real Faculty acceptance retained |
| My History / Calendar Changes / Dashboard History | Scoped SQL audit/DOE API | Current read-only browser acceptance recorded separately below |
| Legacy User Management | Firestore account profile and group controller | SQL Faculty identity can retain a legacy HICC group screen; **SEC-01 remains open** |

The legacy role-source inconsistency was observed during PR 140 acceptance. Its code is unchanged from prior main. Hiding navigation does not fix authorization, and the route must not be reported as wholly denied. A separate reviewed consolidation must preserve explicitly authorized HICC group behavior, use effective authority consistently, and test direct-route/API denial. No group, account, role, rule or permission has been changed by this audit.

## Next work and human-only dependencies

1. Continue tasks 09–11 with real read-only history search, paging and downloads; keep user signoff open.
2. Prioritize task 27's legacy role-source consolidation before claiming a complete role matrix.
3. Tasks 15 / 17 require reviewed replacement capability and exact approved datasets; current data must remain intact.
4. Task 12 real approved PDF upload and task O01 unattended restart require their own controlled acceptance. A manual recovery health check is not a reboot drill.
5. PR 125 Testing still needs the independently provisioned school Testing database; do not use production as a substitute.

No runtime source, SQL, gate, permission or deployment was changed by this reconciliation.

## Real History acceptance and bounded correction

Subsequent read-only acceptance used existing normal Faculty/admin accounts on the published origin. No synthetic record was inserted into SQL.

- Faculty own History: zero recorded rows in the selected year; CSV and Excel both downloaded and read back with the expected 13 headers. This does not establish an affected/removed-faculty positive sample.
- Faculty Calendar Changes: two existing rows; course keyword `315`, empty search, Reset and keyboard Enter expansion verified. CSV contains both rows with 13 headers.
- Admin Dashboard History: 1,758 grouped operations; the 101–200 page loads. The 2024–25 filter produces 111 operations, with a verified 101–111 final page. CSV has all 111 operations; Excel has 111 operation rows plus 444 change-detail rows.
- Cross-year `Role Periods` keyword: 149 operations; CSV has exactly 149 operation rows and every operation title matches. Downloads cover the filtered result, not only the first 100 visible records.
- Complete 1,758-operation export: explicit `HISTORY_LIMIT` response, no file. The old controller then clears its loaded list. The bounded candidate preserves state for `HISTORY_LIMIT`/413 or `HISTORY_EXPORT_BUSY`/429 only; authority/expiry/unknown errors remain fail closed. See the separate design, plan and governance receipt. Do not claim unlimited export.
- Actual synthetic component comparison (205 operations) reproduces old zero-row clearing and verifies the corrected second page retains 100 rows and `101–200 of 205`. Screenshots and downloaded private files stay outside Git. Both accounts were signed out and the actual login gate re-verified.

The original progress workbook was atomically updated and read back: 107 targeted cells, 39 tasks, 43 checks, 16 passed / 26 open / one not applicable. Styles, formulas, native tables, validations, conditional rules and panes are preserved; export introduces only insignificant floating precision in several unchanged row heights (less than 0.00001 point). Original bytes are privately backed up. User signoff remains unfilled. The workbook records the History fix as an unreleased candidate.
