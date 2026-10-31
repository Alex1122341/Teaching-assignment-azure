# Verified DOE reconciliation — separate freeze promotion

Accepted product: `079655e1d81c7240a70d6b2f70b669ba308111b0`.
Previous immutable anchor: `09ae583238f5be04627ea41c8895614b82c97e19`.
Environment: PAWS Beta / University SQL / Firebase Hosting.

Independent whole-branch product review of `beca0d9..811101e` found one Important issue and no Critical/Minor issues. The single TDD fix pass retains nonblocking CCC validation warnings with stored approved amounts, including matching annual exceptions; 52 related tests passed after the reproductions failed first. Stored allocations remain unchanged. The source/publication and live-release checks are separate evidence, not waived by review.

This governance change changes no runtime bytes. Exactly two static files and four API modules differ from the previous anchor: the existing DOE Worksheet script/style, SQL Worksheet repository, DOE assignment service, reference calculator and reference Rule Book. The independently reviewed optional contract-reserve product is already in the previous anchor and remains preserved. No manifests, API paths, package inputs, Docker definition, SQL/schema, Firestore rules/indexes, permissions or write gates change.

Full protection remains 96 static assets and 133 API runtime files plus three repository/build inputs, with the immutable current/baseline manifest union. Every static hash is derived from the accepted product's Git blobs; the two changed static hashes are the only report differences. API enforcement shares that immutable product anchor. No exception or mutable hash-file trust is introduced. The previous MASTER contract-reserve governance test now verifies its original five-file delta, all hashes, manifests and full protection against immutable `a7cc4d3`/`09ae583` evidence. Earlier governance remains intact.

No policy publication, annual recalculation, new SQL operation or deployment is authorized by changing the anchor. Existing source exceptions, unknown credits/counts and the 19 blank-DOE CC source records remain explicit. The private earlier 111-operation audit and recovery receipts are not release assets and must not be replayed or committed. See `docs/doe-reconciliation-verification.md` for verification limits. Ordinary code release may proceed after genuine local acceptance under the owner's GitHub-quota exception; blocked annual activation remains Draft.

Before release: independently review this governance delta, run source and built-artifact freezes plus the required root/server tests, verify the complete staged University API artifact and unchanged credentials/gates/ingress, merge the reviewed PR, regenerate Graphify from exact merged main, verify the exact-main package, then coordinate API and Hosting-only publication with rollback evidence. Authenticate and compare the actual deployed UI/report. A source hash or synthetic screenshot does not establish live acceptance.
