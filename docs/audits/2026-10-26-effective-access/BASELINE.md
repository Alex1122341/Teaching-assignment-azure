# GOV-01 baseline — 2026-10-26

Task26 refreshed read-only; task27 security remediation is a separate unfinished feature. Owner explicitly reconfirmed Teaching-assignment-azure/Beta/SQL after the supplied Desktop instructions named the separate Pages line. Preserve both, no automatic sync. Isolated feature branch feat/effective-access-20261026; no feature commits on main.

| Boundary | Verified evidence |
|---|---|
| Current GitHub main | git ls-remote: e7d3ffec1609fef4b5b503ff92a21df6a8a4fafe |
| Installed API | Fresh public runtime endpoint: same main, shared anchor ef2d053ff9963aad972c22ec6c3fa8fc53bcb149 |
| Public frontend | Fresh18:18:43.820Z verifier:95/95 raw assets equal official main artifact12670375863; no changed public bytes |
| Artifact | ZIP SHA256658bd3e50ead7ee7c5db8d1df429435a508c13ddea7cf56b8dbbc3c550c492b5 |
| Current CI | Exact-main Build40364636235 accepted in prior same-day release; no new CI claim for security work |
| API/SQL | Fresh public SQL health ok; anonymous401, expected CORS allow/deny,27 write gates unchanged |
| Business authority | Firebase identity → University Node API → ITAPPVETOPSDB01/VetMed-Ops UserProfile |
| SQL roles | Read-only aggregate18:07:31Z:7ready adfa_general,3adfa_regular,1developer,2faculty,1hicc,1visc; no person identifiers queried |
| SQL profile schema | Fresh18:20:42Z metadata:10 existing foundation columns, no AccessVersion. Migration060 remains source-only; no live schema operation performed |
| Recovery | Prior same-day native CheckOnly exit0 and stopped candidate; not relabelled as a new reboot drill |

Current public verification retained privately at P:\PAWS\Runtime\Staging\CustomReports-20261026-713093e\gov01-public-verification-20261026.json. Earlier reports public receipt remains unchanged. This baseline is a point-in-time read, not a deployment or a completed SEC-01 matrix. No production roles, groups, schema, gates, audit, approvals, DOE, PDFs or business records changed.
