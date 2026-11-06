# Beta Special Leave and surname-sorted Faculty Lookup

**Date** 2026-11-06  
**Beta PR** [#164](https://github.com/Alex1122341/Teaching-assignment-azure/pull/164)  
**Source** [Testing PR #115](https://github.com/UCVM-Teaching-Assignment/Teaching-assignment/pull/115) at `e8d7320619e363dbc1b1f84d84b53e15d71e724c`

Faculty Lookup sorts by surname and then given name after applying filters. It uses the existing PAWS name format and keeps identity and selection keys intact.

The administrator's Available Special Leave choice saves a manual AFC and its deductions together. Each academic year uses the same FTE deduction and its own Teaching, Service and Research split. An explicit Service allocation is a distinct source category. Existing combined Service / Admin allocations are not split. Missing contract values keep a deduction pending until an administrator confirms the sources and applies it. The source FTE, contract allocations and assigned teaching remain intact.

The date-specific Lookup panel shows original, deducted and effective amounts. A later conflicting deduction is held on the affected dates, and held dates require administrator review. Withdrawal and date edits retain the AFC archive and PDF link. Newly added dates require review. The admin history records the academic-year allocations. Faculty self-service keeps the existing approval route and does not accept deduction details.

Migration 068 adds the deduction table and integrates the Available distinction into Calendar-aware SWAP, scheduling findings and Faculty Availability. Actual teaching conflicts and ordinary AFC continue to block availability. Install and verify the migration before switching the University API and Firebase Hosting. Roll back the application first if necessary and retain the additive SQL data for reconciliation. Keep this as a PR until authenticated browser acceptance is documented.
