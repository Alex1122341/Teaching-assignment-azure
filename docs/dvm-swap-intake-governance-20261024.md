# DVM SWAP intake freeze promotion

Accepted source base: `87a7f943f40bc5bf87b54b1b0059a2593ebc3b7d`.
Reviewed product: `2d896b82fcfc914ecabab152f3d4ad8e96d72aeb` (initial `d7c7594` plus structured-name correction).
Prior immutable anchor: `486ea030c5eaef4ddb7508a4d50799687487057f`.

The product changes exactly two protected assets: `swap-workflow-sql.js` and `swap-workflow-sql.css`. The unchanged 91-file manifest and its immutable union remain protected. All115 API runtime files, build definition, two repository inputs, SQL, rules, roles, dependencies and write gates are byte-identical. Existing office governance is now explicitly checked against its original `bb424dd` Git receipt, with its original product and historical search/origin evidence unchanged. Current baseline assertions pin this new product, not a mutable hash file.

Independent product review: Spec0; Standards found one structured-name issue, corrected RED→GREEN in2d896b8 and independently rechecked with no unresolved findings. Focused SWAP31pass and shared name suites11pass. New promotion guard observed RED against the old anchor before promotion. Separate governance review and complete verification are required before release.

This is a UI intake release. DVM two-stage authority, email delivery, multi-session atomic requests and a persistent administrative checklist are not enabled or certified. No production request, approval, role change or migration is needed. PR142 and the SEC-01 audit remain separate branches; publishing this feature first requires later PR142 integration to preserve this anchor and both accepted runtime changes.

## Local component acceptance

The generated-assets synthetic preview runs at `http://127.0.0.1:19045/after/`; `/before/` serves the exact main87 controller/CSS with the same fixture. No real Auth, SQL, email, request or decision service is connected. Private screenshots and fixture server remain outside the repository.

- Actual in-app browser1280×900 and420×840: initial comparison screenshots; Topic checkbox enables its textarea; escaped Topic From/To and note review; first review makes no request, second creates one synthetic pending request. No live operation.
- LEC→SRL selection appears as the sole type change in review. No candidate or time field is included. Limited permissions leave Topic disabled with its office explanation.
- Narrow review has dialog scrollWidth367 equal to clientWidth367 at viewport420, no horizontal overflow. Long compound names and topic text wrap. Tab from the focused review reaches the inbox action. Loading failure offers Reload. Browser error/warn log is empty.
- Native200% zoom could not be established using the available in-app keyboard shortcut; it remains unverified rather than claimed from viewport resizing. Browser viewport override is reset afterward.
- Product review: Spec0 and corrected Standards0. Separate governance READY. SWAP31passed; shared formatter11passed; governance7passed. Full local root and final source/artifact verification are recorded in the final continuity update; local output is not an official CI artifact.

## Reporting hash correction

The first full local run had1179tests:1125pass/1fail/53skip. Its only failure was the existing `beta-baseline.json hashes are derived from the frozen baseline commit` assertion. Both changed source files had CRLF in the Windows working tree, while immutable product2d896b8 has LF; normalized bodies compare equal. Initial reporting hashes had been taken from raw working-tree bytes. The reporting JSON was corrected using `freeze.normalize(freeze.readBaselineFile({file}))`, matching the existing contract. Targeted hash assertion then passed1/1. No runtime, immutable product, manifest or verifier change; full corrected rerun is required.
