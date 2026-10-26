# Difference ledger — GOV-01 / SEC-01

Compared with the October24 task26 baseline87a7f943/API8bb40c6: task26's old91-file receipt is historical, not an outage. Final main/API now both e7d3ffec,95 public assets, shared ef2d053 anchor. PR141/142 integrated Calendar/History corrections, PR145 Rotation/Other work and PR146/147 administrator reports have been accepted/released. Their specific read-only acceptance and human business signoff remain distinct; original workbook remains the business tracker.

| Item | Classification / next action |
|---|---|
| GOV-01 baseline | Refreshed against current main/public artifact/API/SQL; documentation-only, no deployment needed |
| SEC-01 source mismatch | CONFIRMED: User Management still loads/writes Firestore compatibility users/groups while business access is SQL |
| Owner effective access editor | API/runtime/client/UI implemented on PR148; SQL060 is disposable-tested, not installed in production. Independent review/freeze/final checks remain |
| Next-request revocation | Existing SQL lookup rejects an inactive profile with unchanged Firebase token; new transaction/rule/client integration still requires acceptance |
| HICC collaboration | Scoped replacement API, sanitized names/choices and atomic group/audit adapter implemented; actual emulator proof passes. Server credential prerequisite not met |
| Legacy direct privilege | Candidate rules close business/client privileges;19 combined emulator tests passed. Live rules remain unchanged pending coordinated accepted cutover |
| Calendar helper reads | Active optional identity/directory reads moved to existing scoped SQL APIs. Availability entry reuses the existing lazy Availability component |
| Server Firestore identity | Read-only probe returned ADC_UNAVAILABLE. Required before actual adapter acceptance/cutover; separate from Windows SQL service-account exception |
| Account provisioning / password completion | Not a new capability in this role-editor slice; preserve truthful separate status and existing gates; do not imply SQL changes from Auth/compatibility writes |

No540-row activity migration,413CCC replacement, MASTER import, DOE recalculation/publication or data repair belongs in26/27. Existing audit and originalPDF records remain historical evidence; do not rewrite them. A new file, passing unit test, hidden menu or this document is not full SEC-01 acceptance.
