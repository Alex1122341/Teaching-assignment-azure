# Agent Update — name constitution release and UI start

**Date:** 2026-10-23  
**Repository:** Alex1122341/Teaching-assignment-azure  
**Task status:** Names COMPLETE; requested UI implementation in progress

## Goal and breakpoint

The Owner requested all PAWS person labels in Last name, First name format and a lasting constitution, followed by restrained office UI improvements. Names started from accepted main2664fee in an existing linked worktree. PR135 is merged at9734d2d9ba6cd927dbec3585838689f235ed0e9f; final product5a3117d, separate governancee7b05cc. UI now starts on feat/paws-office-ui-20261023 from that exact merged main.

## Work and verification

- PAWS_CONSTITUTION.md and AGENTS pointer govern person labels and new generated documents. Shared browser/server formatter parity, structured/partial/blank preferred names, placeholders, raw audit preservation and output escaping are covered.
- Standards and Spec reviewers found dependency ordering, iCalendar CN escaping, missed support/SWAP/confirmation sinks and structured PDF names. Corrected and reviewed. Governance reviewed separately.
- Automatic exact-PR-head Build39987219106 passed; automatic exact-main push Build39988089596 passed all root/server/Auth emulator/build/container/freeze steps. Root1076 tests:1024pass/0fail/52skip; server848:843pass/0fail/5skip. No local suites/install for the name phase.
- CI main artifact12517026017, azure-beta-9734d2d9ba6cd927dbec3585838689f235ed0e9f, digestsha256:a8606cf4604f5fcaa67d41c84a4d530e9859f7ad67ff1d001199cbd339ee72a8. Local exact-main build and all four source/artifact freezes passed; local artifact remains distinct from CI artifact.
- Hostingd491d9394e8eb9d7/release1792773691703000,2026-10-23T16:41:31.703Z:87/87servedrawhashesmatch,zero mismatches.
- School API9734d2d/trust5a3117d;113source/packagefilesverified,115APIinventory. Source rootP:\PAWS\Runtime\Versions\5a3117d4aec48b685e734651f4caa24d9050ba4f\server; unchanged dependencies use a junction to the accepted dependency tree. LauncherP:\PAWS\Runtime\Acceptance\Names-20261023\Start-Names-Live.ps1. Recovery config atomically updated with rollback backup;27gatesunchanged,SQL/runtime200.
- Actual publicHTTPS Faculty normal login:91HICC/CC+35VISC, only public allowlisted fields, adminRoles403. Chrome leadership list shows canonical names;88/91defaultappointments. Captured before/after name evidence under local private name-acceptance-20261023, but window sizes differ because the user resized; these are name proofs, not matched UI comparison evidence.
- RecoveryCheckOnly16:42:20Z:siteReadytrue,apiReadytrue,no processstart. Candidate18789stopped,filespreserved. Quick Cloudflare origin unchanged; no NamedTunnel or unattended Saturday proof claimed.

## Preserved boundaries

No SQL data/schema/migration/grant, dependency installation, role/Auth, Firestore, DOE calculation, gate, historical PDF, source import, audit From/To or stored signature mutation. New AFC renderer1.1.0 has golden0B762577584911DE65486E2FA19757CEFF4FC7946AA3D57BA3DC199F1494A165 and1088141bytes; old1.0.0 stored artifacts remain retrievable. PR125Testing remains separate.

## Next work and rulings

Ruling: Start UI on Teaching Schedule and HICC–CC/VISC lists — these are the current surfaces in context; no new reference was supplied — costs limited presentation adjustment if the Owner redirects later.

Ruling: The Owner's new UI brief explicitly requests local preview, functional verification and desktop/narrow screenshots — use local checks for this UI phase without installations; this differs from the earlier name-phase no-local-suite workflow.

Ruling: Execute the concrete UI brief inline under the Owner's existing instruction to proceed using recommendations and not stop for routine questions. Save inspection, six rules, three issues and a short execution plan; preserve business APIs and auth. Capture matched screenshots at fixed viewports, then implement and inspect again. Product Design preflight found no saved context; use current PAWS assets and code, create no saved global memory.
