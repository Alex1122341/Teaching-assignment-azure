# Rotation / other-working-activity placement acceptance

Product: `582645499bc56849c8b0d10d0b33227389757709`, based on published main `62dfa3c120467c1c7e23440c4f8500f444322382`.

## Reused implementation and boundaries

Calendar's existing four views, activity cache/cancellation, scheduling layout, type picker, shared name formatter and detail delegation are retained. Dashboard reuses the authenticated CalendarActivity range API, academic-year parsing, bounded pagination and existing tokens/table styles. SQL053 already forces Faculty/HICC/VISC own-faculty scope. No API, SQL, rules, dependency, DOE algorithm or write-gate change is included.

CCC and dated Rotation activity ranges are projected read-only into Calendar; Rotation has an exclusive Year choice alongside Year1–4. The independent Other working activities Dashboard tab contains the remaining work categories, not CCC/Rotation/Remote work. Its meaning is work not allocated to those scheduled domains, regardless of whether a faculty member is already assigned. Locum CCC stays scheduled and truthful. Annual MASTER Rotation appointment periods are not used to invent session dates.

Missing source time displays08:30–16:30 with a Default time label; explicit recorded per-day evidence wins. Original ranges/evidence, Needs Review availability, DOE and teaching assignment writes remain unchanged. Teaching CSV/ICS exports continue to export teaching sessions only; their copy says so. Cross-domain reports are tasks23–25 and require the owner's pending requirements.

## Product review and corrections

Two independent fixed-base spec/standards reviews covered the branch. Findings were reproduced: Month hid activity5 and a multiword search failed reordered names. RED tests failed3/18; token matching and native Month details/summary overflow resolve these findings. Both reviewers rechecked5826454 and reported no further actionable findings. Synthetic screenshots also exposed an existing CSS override that made time-grid blocks relative; retaining their absolute positioning fixes overlap placement. Month event IDs/details and SWAP positioning remain intact.

## Browser evidence

The committed images use synthetic data only, extracted shipped Calendar functions and actual built modules/styles. They are component acceptance, not proof of full authenticated production acceptance. Desktop1440×900, narrow390×844. Before/after desktop use the same fixture, week, All Years, filters and top scroll position. No production request was made by this fixture.

- [Before](../ui-evidence/rotation/before-desktop.png) / [After](../ui-evidence/rotation/after-desktop.png): work ranges leave the lower duplicate lane; CCC/Rotation appear at their times in the Calendar.
- [Other work desktop](../ui-evidence/rotation/other-work-desktop.png) / [Narrow](../ui-evidence/rotation/other-work-narrow.png): wrapped filters, horizontal table scrolling, canonical long names, original dates, default and verified times.
- [Month disclosure](../ui-evidence/rotation/month-overflow.png): six matching Rotations remain accessible through the native two-more disclosure.
- Rotation excludes teaching and CCC; default08:30–16:30 and explicit09:15–12:00 details show source provenance and no write actions.
- Search combines name/activity words; category filtering, empty state, synthetic error/Retry, identity change and academic-year scope were exercised.
- Large fixture:122 ranges,1–50 and51–100 pages; search on page2 resets to the single match; no-match truthfully reports0. Node regressions also test120 records and stale responses.

Narrow Week retains its existing five-column grid; Day/List are more readable for detailed small-screen use. A native200% browser-zoom certification and full populated lazy-tab audit are outside this slice and remain unclaimed. Release acceptance must still use exact-main CI/artifacts, public hashes, real role read-only smoke and original tracker updates.

## Separate frozen-runtime promotion

Promote the shared static/API anchor to reviewed product5826454 in a separate governance commit. Static manifest increases92→93 only for `calendar-activity-placement.js`, retaining the complete prior union. The119 API/build/dependency inputs remain byte-identical; all prior approval/history/runtime receipts remain pinned historical evidence. Only the static baseline constant/comment and reporting hashes change; Git-object enforcement algorithms and artifact checks are preserved. Hosting-only release is pending; no merge or deployment is claimed by this receipt.
