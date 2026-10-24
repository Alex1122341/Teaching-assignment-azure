# Calendar workspace — Phase 2 evidence

Captured 2026-10-23 from the actual generated static assets. Product: `64477000a17ae885776f664a93480af0aaaf110f`; governance: `6381fc87c1f08ff81c9f885ee5ae2a3449dcf3cb`. Candidate only, not a live release. This is an isolated stack on PR136, not integrated current main `8bb40c60370bcce3d0135efd4327d42fba657903`. PR137/138's role-period fixes and main's newer governance must be preserved during a separately verified integration. API-unchanged evidence below is relative to PR136.

## Comparable views

Each `before-WIDTH.jpg` / `candidate-WIDTH.jpg` pair uses a 900px-high CSS viewport, light theme, synthetic administrator, All Years, Fall Week 12 (November 9–13, 2026), all courses/types/months, Week view, ten synthetic sessions, filters expanded and page scroll at the top. Tasks is closed. Navigation adapts to width by design. Before is the PR136 Phase 1 generated bundle; candidate is this phase's generated bundle. The yellow preview banner and fixture selector belong to the private read-only harness, not the shipped application.

| Width | Before | Candidate |
|---|---|---|
| 1920 | [Before](before-1920.jpg) | [Candidate](candidate-1920.jpg) |
| 1440 | [Before](before-1440.jpg) | [Candidate](candidate-1440.jpg) |
| 1366 | [Before](before-1366.jpg) | [Candidate](candidate-1366.jpg) |
| 1280 | [Before](before-1280.jpg) | [Candidate](candidate-1280.jpg) |
| 1024 | [Before](before-1024.jpg) | [Candidate](candidate-1024.jpg) |
| 768 | [Before](before-768.jpg) | [Candidate](candidate-768.jpg) |
| 390 | [Before](before-390.jpg) | [Candidate](candidate-390.jpg) |

Screenshots use the browser's explicit viewport clip, avoiding the earlier screenshot API's scaling/cropping mismatch. Final candidates were recaptured after the dark-theme correction. No screenshot was retouched.

Additional screenshots show active search chips, expanded navigation, a Faculty role fixture, dark theme, both panels, and existing leadership dialogs with long names/text, 600 appointments, empty, loading and error states. All names and records in this folder are synthetic. No real reference-page screenshot, account credential or production data is included.

## Actual browser checks

- Search `clinical`: ten sessions become four; clearing content restores ten without leaving Fall Week 12.
- Month October in the November week: zero sessions plus a Month chip. Removing it restores the actual subscribed week. The shared range-aware handler fixes a real stale-render defect.
- Courses 200 and 202 produce independent chips. Removing 200 keeps 202; removing the last course produces explicit NONE and zero sessions. Restore returns ALL. Activity types have the same ALL/NONE distinction.
- Previous/Next and Arrow/Home/End operate original week buttons and keep the selected dated week visible. Day/Week/Month/List continue using the original views.
- Drawer Escape, focus trap and trigger return checked. Opening HICC from docked navigation at 1920, narrowing to 1024, then closing the dialog leaves the dialog non-inert and returns focus to Open navigation. The 390px path also works.
- Both navigation and Tasks use overlays at 1440 rather than shrinking Calendar. At 1920 both docked, actual Calendar width was 1336px with explicit clipping; both panels stayed inside the viewport.
- Final overflow measurements are in [final-viewport-metrics.json](final-viewport-metrics.json). At every width, document scrollWidth equals clientWidth. Scrollbars account for the usual 15px viewport/client difference; narrow timetable scrolling stays inside its card. Week navigation remains one row.
- Existing leadership search/sort/clear/refresh and long/large/empty/loading/error rendering remain usable. Browser console errors: none in the inspected final candidate.

## Regression record

On governance6381fc8, final focused Calendar/navigation/landing/auth/responsive/views/export/activity-type checks passed95/95. The first completed1101-test root run returned1044 pass,4 fail,53 skip. These were deterministic test compatibility failures: the Phase1 governance test incorrectly treated its old product as today's active anchor; the active static inventory still expected87 rather than89; extracted auth/sign-in VM harnesses lacked the new shell collaborator and browser window event interface. The corrections keep Phase1 pinned to immutable PR136 receipt0baedfef, retain active source/artifact freeze enforcement, require both added modules, preserve role visibility assertions and real Sign in callback/node/listener checks. No runtime or anchor change was made to address them.

**Final complete corrected run:** Node22.20.0, `npm test -- --test-concurrency=4`:1101 tests,1048 passed,0 failed,53 skipped,0 cancelled, exit0,607655ms. Invocation HEAD6381fc8 plus the four test-only corrections subsequently committed as `4a55fafe8ef01a74c57597b282c5c1bfef4b2555`; protected runtime remains product6447700. The intervening session-interrupted attempt has no accepted verdict. [Structured receipt](acceptance.json). This local result is for the isolated stack and does not prove integration with main or live authorization. Server/emulator suites were not rerun for this frontend-only slice; their PR136 results are historical dependency evidence, not current Phase2 execution.

## Scope and limits

The loopback preview at `http://127.0.0.1:19041/after/` loads actual generated sources but replaces authentication/data startup with synthetic read-only fixtures. Business writes are disabled and out-of-scope routes are blocked **only in that private harness**. The Dashboard navigation node remains visible for role-layout inspection but clicking it shows a preview notice; the private server refuses other HTML routes. Production handlers remain intact. The harness is not shipped, not added to the static allowlist, and does not prove server authorization.

Faculty/admin screenshots demonstrate presentation visibility, not authenticated permission acceptance. Current real-role/API 401/403 checks, all supported role combinations, native 200% text zoom, production latency and the remaining four page adapters are still unverified in this phase. Existing role/landing/auth regression tests and unchanged API bytes support preservation, not a claim that live acceptance is complete.

No navigation business fetch or badge preload was introduced. Tests verify one coherent render/request path for content changes; 600 synthetic appointments remain in the existing bounded dialog. Generated allowlist bytes compared with Phase1:87 files/2,296,119 raw bytes →89 files/2,320,535 bytes, a24,416-byte increase. Node gzip level9 applied separately to every file estimates6,864 additional bytes; the two new modules themselves are9,096 raw/3,578 gzip bytes. This is an artifact-size comparison, not the actual initial-route transfer size or a production latency benchmark; existing lazy boundaries remain. Local interaction responsiveness was inspected qualitatively. No backend, SQL, DOE, audit, write gate, permission or dependency changed.
