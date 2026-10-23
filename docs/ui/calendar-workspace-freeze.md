# Calendar workspace freeze promotion

Candidate only; not merged or published. Product `64477000a17ae885776f664a93480af0aaaf110f`, based on PR136 head `0baedfefc35dd35be4f146e49e3615351f35ebb7`. Prior immutable product remains `16027769c774367c65d5dd68fc1a8002a052589e` in historical evidence.

This separate governance change promotes the exact product Git object. Static manifest87→89: adds `schedule-filter-view.js` and `workspace-navigation.js`; removes nothing. Only three previously protected assets change: `index.html`, `timetable.js`, `workspace.css`. API115 runtime files plus Dockerfile/server package inputs (118 protected) remain byte-identical. The source allowlist/build/public URLs and full mutable/frozen manifest union remain enforced. No verification algorithm, exception, ignored path, API origin, dependency, SQL, authorization, DOE or write gate is changed.

`beta-baseline.json` is regenerated from immutable product blobs with the existing canonical hash function; it is a candidate reporting file, not evidence of live Hosting. Source/artifact freeze results and independent review must be recorded before PR readiness. PR136 and main are not advanced by this promotion.

Final product supersedes the initial4ca3c710 candidate with one reviewed navigation focus fix: a dialog opened from docked navigation keeps the surviving header trigger as its return target after shrinking the viewport. Runtime scope and protection counts are unchanged.

The final6795773 product also shares the range-aware refresh between month selection and content-chip removal. Actual browser acceptance found that changing Month within an already subscribed Week otherwise left old results visible. The new helper preserves one render/request path and the regression is retained.

Final6447700 includes the scoped dark-theme visual correction found in actual screenshots: wordmark/faculty text and Calendar date-header surfaces now use existing workspace theme tokens; selected navigation uses the accessible existing PAWS red-tint treatment. No layout or permission change.
