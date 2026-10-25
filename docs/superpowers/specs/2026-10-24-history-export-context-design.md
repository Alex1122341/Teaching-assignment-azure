# History export errors preserve browsing context

Owner direction: inspect the progress spreadsheet and continue unfinished work, selecting recommended routine options without another approval loop. This is the bounded UX-04/UX-05 correction discovered during live read-only History acceptance.

## Observed defect

At accepted main `87a7f943f40bc5bf87b54b1b0059a2593ebc3b7d`, the administrator Dashboard lists 1,758 grouped operations. Its complete export exceeds the existing bounded renderer limit and returns `HISTORY_LIMIT`. The shared export catch calls the load-failure handler, discarding already authorized rows, count, page and snapshot. No file is downloaded. The server's explicit bounded rejection is correct; silently truncating data or increasing the limit is outside this fix.

## Selected design

Preserve the current controller state when an export returns the known, non-authority-changing `HISTORY_LIMIT` or `HISTORY_EXPORT_BUSY` error. End the busy state and show the existing explicit server message. Retain rows, total, offset, facets, coverage and snapshot so the user can browse, narrow filters and retry. Other failures continue to invalidate the view. Authentication, authorization and expired-snapshot failures must never retain a usable handle. Query/page failure behavior and generation guards remain unchanged.

Alternatives rejected: raising server limits does not fix lost browser context; preserving every unknown failure weakens the current fail-closed behavior. The explicit two-code allowlist is the smallest correction.

## Verification boundary

Use the public `createHistoryController` interface for loaded-page → failed export → unchanged page/count/snapshot → further paging, and for auth/expired/stale-response negatives. Use real current History controls for read-only acceptance; no audit/role/AFC/DOE mutations. Keep user signoff, zero-row own-history coverage and unmatched roles explicit in the workbook.
