# Office workspace acceptance — 2026-10-24

## Candidate and reuse

Integrated main `8bb40c60370bcce3d0135efd4327d42fba657903` with PR139, then extended the existing Calendar navigation to Dashboard and Teaching Assignments. Original page controllers, native History dialog, profile selection, academic year, queue filters and real route handlers are retained. The pure capability projection matches existing page admission; it is presentation only. Dashboard keeps its explicit ban on the legacy Firestore helper. No API, SQL, permission, dependency or write-gate changes.

Rules: Calendar stays home; original UCalgary red/gold/navy and shared tokens; names use the shared Last name, First name formatter; 36px office controls; locally scrolling dense numeric tables; optional technical detail and metrics use native disclosures.

## Rendered checks

Generated artifacts, synthetic records, real controllers: before is immutable `47f8764`; after is this product. Both routes captured under the same data, filters and scroll at 1440×900, 1280×900, 768×900 and 390×900. Private evidence is under `PAWS-DOE-Preview/office-release-evidence-20261023` outside the repository; no real faculty screenshots are committed.

- Dashboard whole-page width before: 1203px at 768/390; after: exactly viewport width at all four sizes. Assignments has no whole-page overflow at these sizes.
- Dashboard search `müller` produces six results from 24; selection opens the existing profile. Queue filter Waiting for VISC produces two of six packages; selection loads the existing detail view.
- Long compound names; 600 faculty; 120 packages; empty, loading and error states rendered. Synthetic error console messages are expected only in deliberately failed fixtures.
- Dark theme exposed hard-coded light headings/branding/toolbars. A failing regression was added before token overrides, then passed; actual dark screenshots show readable branding, titles, filters and selected tabs.
- History native dialog fits 390px (346px width). It stays open and usable while resizing 1440→390; Escape closes it and returns focus to History. Drawer Escape returns focus to its opener. No fake routes or new global data requests.
- Rendered synthetic role matrix: Faculty/HICC/VISC self-mode; regular/general administrator management; Developer Dashboard without Assignments; Other Office/anonymous/inactive denial. Unit role matrix additionally checks formal/legacy aliases and required password-change lock.

Native browser 200% zoom is **not verified**: the connected browser exposes viewport sizing only. Narrow reflow is verified separately and is not represented as native zoom. Automated WCAG certification is not claimed.

## Real identity, read-only University API

After the Saturday restart, normal Faculty/admin acceptance was repeated against verified new ingress gibson-strand-telecharger-governor.trycloudflare.com and product486ea03. Both entered Calendar; all own/administrative/actual-other-Faculty checks in the table below passed again (Faculty other detail403ROLE_DENIED). Admin Dashboard and one-package queue loaded; Faculty Published view showed the existing immutable release and management tabs were absent. Accounts signed out afterward. Public HTTPS CORS preflight independently returned204/exact Hosting ACAO, while an untrusted Origin returned403/no ACAO. These current checks supersede the outage boundary for the API, but remain private candidate acceptance rather than a Hosting deployment or actual published-origin UI smoke test. No runtime/database/gate/CORS/ACL change or business mutation.

Normal authorized Faculty and administrator Firebase sign-in was exercised against the generated candidate through a loopback-only GET/HEAD bridge to the current University API. The bridge preserves the bearer identity, rejects writes, pins the upstream origin, and leaves production CORS/permissions unchanged. It is private acceptance tooling, never a shipped asset. This verifies controller rendering and API authorization, not production Hosting publication or unchanged-origin CORS delivery.

| Check | Faculty | Administrator |
|---|---|---|
| Normal login destination | Calendar | Calendar |
| Anonymous `/me` | 401 | 401 |
| Roster | 1 own record | 119 authorized records |
| Own detail | Allowed | Not applicable to unlinked office identity |
| Other faculty detail | 403 ROLE_DENIED | Authorized management roster |
| Administrative roles | 403 ROLE_DENIED | 198 authorized records |
| Assignment work queue | 403 WORK_QUEUE_DENIED | 1 scoped package |
| Published Faculty view | Read-only published release | Existing queue and navigation work |

Faculty Dashboard displays only self-mode controls; the Assignments controller selects Published for faculty and hides management tabs. Accounts were signed out after acceptance. No credentials, tokens, IDs, private data exports, SQL mutations, approvals or publication actions are saved in this receipt.

Existing Calendar legacy optional enrichment logged a Firestore permission denial while authoritative SQL Calendar/Dashboard reads succeeded. The unchanged account-profile source label also differs from the linked Faculty canonical name. These baseline issues are recorded for separate diagnosis; no access was broadened or identity data guessed to suppress them. Office pages load neither that legacy helper nor Firestore SDK.

## Verification boundary

### Supplemental aggregate search acceptance

At d441daf, the actual generated Teaching Summary and Roles tables displayed structured names but searched only raw displayName, so searching `müller` returned no rows despite six visible matching people. Product fcc3623 includes the same shared formatter label in each predicate, retaining old aliases and existing filters. Eleven real-source tests reproduced five failures before correction and passed afterward; matching page/auth/name checks total57 passed. A focused independent review of d441daf..8133ecd found no actionable Critical/Important/Minor issues.

The corrected generated page at localhost19042 was exercised with synthetic records at1280×720 and390×900. Both aggregate searches return six matching `Müller, Élodie` rows; HICC yields none and VISC returns the six correct role rows. No warning/error console entries appeared. The mobile page stays within its viewport and the dense table scrolls locally. Private matched desktop screenshots: summary-name-search-before/after.jpg and roles-name-search-before/after.jpg; the390px screenshot is supplemental reflow evidence. The correction adds70 bytes to the generated static bundle (91files,2338302bytes), no extra request or dependency. This does not expand the earlier real-role or native-zoom acceptance claims.

Targeted office/page/auth/assets/main integration suite: 188 passed before dark fix; new dark regression RED→GREEN and nine wiring tests passed. Full final suite, immutable promotion and independent review are recorded in the subsequent release receipt. This document does not claim merge or deployment.
