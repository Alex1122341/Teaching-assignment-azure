# PAWS office workspace and integrated release design

## Owner direction and scope

The owner requests direct continuous execution through merge/release readiness, with recommended routine choices made by the agent. Continue the chosen compact PAWS direction without another approval loop. Complete guarded shared navigation for Faculty Dashboard and Teaching Assignments, integrate latest main with UI phases1/2, and prove a coherent release candidate. Reports/Overview, new analytics, business workflows and the two credential/account-management routes are not redesigned in this slice; intentional existing URLs and controls remain valid.

## Source and reuse

Work in the existing isolated Beta worktree on a new branch. Main is8bb40c60370bcce3d0135efd4327d42fba657903; Phase2 PR139 is138fdc14508496ff95f13ccc3a6726ea028e88ef and includes Phase1 PR136. Fetch main with an explicit remote-tracking refspec because this clone is deliberately narrow. Preserve all main role-period frontend/API/SQL repairs, both UI histories and immutable receipts. Current main governance stays authoritative until an integrated product is committed and a separate reviewed promotion is created.

Reuse the real Workspace Navigation layout/focus controller, existing UCalgary tokens and name formatter. Add optional title/shell/background parameters without changing Schedule defaults. One office adapter supplies actual Calendar/Dashboard links, existing header actions and the already guarded User Management link. Page tabs, table controllers and all workflow controls remain page-local. Use shared role helpers for new navigation visibility, matching the existing page access contract; never infer new access from a visible link.

Dashboard retains enterSelfMode/enterAdminMode, lazy tabs, own-faculty scope, caches, role-period version checks and native dialogs. Assignments retains queue/contributions/published/releases/publication views, original capability/state-machine checks and published-vs-working distinctions. Lock/sign-out hides/disables the navigation; identity switching cannot leave old privileged entries visible. No confidential preload, mock routes, business persistence, new dependency or backend authorization change.

## Presentation and behavior

Use the existing64px rail /224px expanded navigation and narrow drawer; preserve content width, visible focus, Escape, return focus and scroll containment. Keep UCalgary red/gold/navy, light/dark tokens, Last name, First name,13px readable tables,36px controls, consistent action placement and tabular/right-aligned numeric data. Compact dashboard toolbars and assignment headings without flattening the queue workflow into a mock table. Search/counts/loading/error remain driven by original controllers. Calendar is always normal home; authorized direct routes remain intentional. No native credential action is exercised by automated acceptance.

## Acceptance and release boundary

TDD covers merged-main ancestry/API/SQL preservation, default Schedule compatibility, office module mount/idempotence/visibility/lock/focus, existing handlers and guards. Inspect actual generated routes with synthetic before/after desktop/narrow screenshots, long/large/empty/loading/error states and keyboard/zoom behavior. Separately verify authenticated Faculty/admin reads and negative401/403 through the authorized current API/browser, using supplied accounts without publishing credentials or real private screenshots.

Run matching targeted and full root/server/security-emulator checks when required/available, combined build, exact-source/artifact freezes, independent whole-branch product/governance review and current-main comparison. Missing mandatory execution evidence is a readiness blocker, not a pass. School-server checks are read-only; no SQL change, migration, business write, permission change, merge or deployment is necessary to establish readiness. Prepare exact artifact hashes, rollout/rollback and live acceptance checklist. The current request sets readiness as the goal; do not equate that with a completed production publication.


Implementation ruling: Dashboard explicitly prohibits loading legacy faculty-access.js. Reuse its capability contract through a pure faculty-route-access.js projection with matrix parity; legacy helper delegates when that projection is present. Office pages load only the pure module, navigation and adapter. Preserve the existing legacy/Firestore bans. Three explicit local presentation modules increase Dashboard script elements27→30; controller sync hooks require a bounded60300-byte limit (prior60000, actual60172). No dependency, data fan-out or business authority is added.
