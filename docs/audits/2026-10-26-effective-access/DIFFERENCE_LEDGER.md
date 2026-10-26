# Difference ledger — GOV-01 / SEC-01

Compared with the October24 task26 baseline87a7f943/API8bb40c6: task26's old91-file receipt is historical, not an outage. Final main/API now both e7d3ffec,95 public assets, shared ef2d053 anchor. PR141/142 integrated Calendar/History corrections, PR145 Rotation/Other work and PR146/147 administrator reports have been accepted/released. Their specific read-only acceptance and human business signoff remain distinct; original workbook remains the business tracker.

| Item | Classification / next action |
|---|---|
| GOV-01 baseline | Refreshed against current main/public artifact/API/SQL; documentation-only, no deployment needed |
| SEC-01 source mismatch | CONFIRMED: User Management still loads/writes Firestore compatibility users/groups while business access is SQL |
| Owner effective access editor | New API core being implemented; not routed, migrated, merged or live |
| Next-request revocation | Existing SQL lookup rejects an inactive profile with unchanged Firebase token; new transaction/rule/client integration still requires acceptance |
| HICC collaboration | Preserve own-group behavior in replacement server API; membership will not confer course/DOE/approval rights |
| Legacy direct privilege | Existing repository rules still permit legacy grants; replacement services and closed-rule emulator proof are required before release |
| Account provisioning / password completion | Not a new capability in this role-editor slice; preserve truthful separate status and existing gates; do not imply SQL changes from Auth/compatibility writes |

No540-row activity migration,413CCC replacement, MASTER import, DOE recalculation/publication or data repair belongs in26/27. Existing audit and originalPDF records remain historical evidence; do not rewrite them. A new file, passing unit test, hidden menu or this document is not full SEC-01 acceptance.
