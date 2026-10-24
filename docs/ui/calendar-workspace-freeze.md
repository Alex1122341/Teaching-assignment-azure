# Calendar workspace freeze promotion

Candidate only; not merged or published. Product `64477000a17ae885776f664a93480af0aaaf110f`, based on PR136 head `0baedfefc35dd35be4f146e49e3615351f35ebb7`. Prior immutable product remains `16027769c774367c65d5dd68fc1a8002a052589e` in historical evidence.

Integration limitation verified 2026-10-23: main advanced independently to `8bb40c60370bcce3d0135efd4327d42fba657903` through PR137/138, with role-period frontend/API/SQL repairs and anchor `58daab3a2401af69c2298cc1f078d78aad069ea9`. The present anchor and API-unchanged claim are relative to PR136 only. This is an accurate isolated draft stack targeting PR136's branch, not a release candidate for current main. Preserve those repairs, reconcile the stack, create an integrated product commit and independently review a fresh governance promotion before any integration/release. Do not carry6447700 unchanged into main.

This separate governance change promotes the exact product Git object. Static manifest87→89: adds `schedule-filter-view.js` and `workspace-navigation.js`; removes nothing. Only three previously protected assets change: `index.html`, `timetable.js`, `workspace.css`. API115 runtime files plus Dockerfile/server package inputs (118 protected) remain byte-identical. The source allowlist/build/public URLs and full mutable/frozen manifest union remain enforced. No verification algorithm, exception, ignored path, API origin, dependency, SQL, authorization, DOE or write gate is changed.

`beta-baseline.json` is regenerated from immutable product blobs with the existing canonical hash function; it is a candidate reporting file, not evidence of live Hosting. Combined build and all four source/artifact freezes pass at governance6381fc8; independent product/governance reviews report no outstanding concrete findings for this isolated stack. PR136 and main are not advanced by this promotion. Broader acceptance limitations are in `docs/ui-evidence/phase2/README.md`.

Final product supersedes the initial4ca3c710 candidate with one reviewed navigation focus fix: a dialog opened from docked navigation keeps the surviving header trigger as its return target after shrinking the viewport. Runtime scope and protection counts are unchanged.

The final6795773 product also shares the range-aware refresh between month selection and content-chip removal. Actual browser acceptance found that changing Month within an already subscribed Week otherwise left old results visible. The new helper preserves one render/request path and the regression is retained.

Final6447700 includes the scoped dark-theme visual correction found in actual screenshots: wordmark/faculty text and Calendar date-header surfaces now use existing workspace theme tokens; selected navigation uses the accessible existing PAWS red-tint treatment. No layout or permission change.
