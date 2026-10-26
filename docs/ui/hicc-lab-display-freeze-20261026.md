# HICC-CC and LAB Calendar display trust-anchor promotion (2026-10-26)

- Previous Beta static/API trust anchor: `ef2d053ff9963aad972c22ec6c3fa8fc53bcb149`.
- Reviewed product commit: `19d5042473917bc96434b141ab1f9a41f8e8eb1e`.
- Product branch base: `e7d3ffec1609fef4b5b503ff92a21df6a8a4fafe`.
- Modified static assets: `leadership-directory.js`, `lab-session-detail.js`, `timetable.js` (3 files). No added/removed shipped assets; count remains **95**.
- API/SQL/authentication/permissions/DOE/AFC runtime and database bytes remain unchanged. Frozen API inventory remains 124 protected files, subject to exact CI verification.
- The role listing prefers same-title HICC over equivalent-status CC, and confirmed active HICC over an undated CC, for display only. Active CC is never suppressed by inactive or future HICC.
- Day/Week/Month Calendar groups overlapping or adjacent same-title/course/date/year LAB records into a display-only block using the earliest and latest source times. Underlying Session IDs and the existing LAB detail/edit/SWAP remain independent. Group badges preserve pending SWAP status if any member is pending.
- LAB group rendering is bypassed in multi-session selection mode. List view remains a source-row list.
- No authorization expansion, no SQL Session mutation and no live deployment.
- Independent acceptance required before merge/deployment.

## Checks

- Targeted behavior tests: `node --test tests/calendar-lab-hicc-presentation.test.js tests/lab-session-detail.test.js tests/leadership-directory-search.test.js tests/leadership-directory-view.test.js`.
- Complete root suite and Firebase emulator suite: GitHub CI.
- Freeze: `node tools/beta-freeze.js`, `node tools/beta-api-freeze.js` and corresponding artifact checks.
- Manual authenticated Day/Week/Month and HICC list acceptance remains pending.
