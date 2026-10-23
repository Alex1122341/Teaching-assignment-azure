# Calendar workspace freeze promotion

Candidate only; not merged or published. Product `ec4a191b8798f6cada285079989144142822fb50`, based on PR136 head `0baedfefc35dd35be4f146e49e3615351f35ebb7`. Prior immutable product remains `16027769c774367c65d5dd68fc1a8002a052589e` in historical evidence.

This separate governance change promotes the exact product Git object. Static manifest87→89: adds `schedule-filter-view.js` and `workspace-navigation.js`; removes nothing. Only three previously protected assets change: `index.html`, `timetable.js`, `workspace.css`. API115 runtime files plus Dockerfile/server package inputs (118 protected) remain byte-identical. The source allowlist/build/public URLs and full mutable/frozen manifest union remain enforced. No verification algorithm, exception, ignored path, API origin, dependency, SQL, authorization, DOE or write gate is changed.

`beta-baseline.json` is regenerated from immutable product blobs with the existing canonical hash function; it is a candidate reporting file, not evidence of live Hosting. Source/artifact freeze results and independent review must be recorded before PR readiness. PR136 and main are not advanced by this promotion.

Final product supersedes the initial4ca3c710 candidate with one reviewed navigation focus fix: a dialog opened from docked navigation keeps the surviving header trigger as its return target after shrinking the viewport. Runtime scope and protection counts are unchanged.
