# DVM SWAP intake freeze promotion

Accepted source base: `87a7f943f40bc5bf87b54b1b0059a2593ebc3b7d`.
Reviewed product: `2d896b82fcfc914ecabab152f3d4ad8e96d72aeb` (initial `d7c7594` plus structured-name correction).
Prior immutable anchor: `486ea030c5eaef4ddb7508a4d50799687487057f`.

The product changes exactly two protected assets: `swap-workflow-sql.js` and `swap-workflow-sql.css`. The unchanged 91-file manifest and its immutable union remain protected. All115 API runtime files, build definition, two repository inputs, SQL, rules, roles, dependencies and write gates are byte-identical. Existing office governance is now explicitly checked against its original `bb424dd` Git receipt, with its original product and historical search/origin evidence unchanged. Current baseline assertions pin this new product, not a mutable hash file.

Independent product review: Spec0; Standards found one structured-name issue, corrected RED→GREEN in2d896b8 and independently rechecked with no unresolved findings. Focused SWAP31pass and shared name suites11pass. New promotion guard observed RED against the old anchor before promotion. Separate governance review and complete verification are required before release.

This is a UI intake release. DVM two-stage authority, email delivery, multi-session atomic requests and a persistent administrative checklist are not enabled or certified. No production request, approval, role change or migration is needed. PR142 and the SEC-01 audit remain separate branches; publishing this feature first requires later PR142 integration to preserve this anchor and both accepted runtime changes.
