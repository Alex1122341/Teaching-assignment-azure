# Session SWAP and faculty names published — 2026-10-09

PR79 merged at `789963e85223f6fd3c813bc84e7720e1bd1f3db4`; exact-main CI37957382593 and migration CI37957382676 succeeded. Runtime trust anchor `404e3bdf6a2cf3947ab76f41bb13ea9120c833a0`. Existing automatic CI ran; no new tests or local suites were added/run. Independent reviewer approval is not claimed.

SQL030/031/032 applied with SQLCMD exit0 on ITAPPVETOPSDB01 / VetMed-Ops. Source-guarded HR import completed once:97 HR names populated,24 unresolved blank,121 faculty total. No SWAP request submitted or approved during acceptance. Do not repeat the import.

Narrow SWAP procedure roles were created. Binding the existing Windows principal encountered directory lookup error15404/0x5; no access workaround or principal modification was used. The runtime already has temporary db_owner membership; its existing EXECUTE permissions on paws_api.SaveSessionSwap and paws_api.DecideSessionSwap were verified. Narrow identity binding remains deferred to the existing permission-hardening work.

University runtime on P: attested65 canonical files, then switched from PID31700 to PID10976. API runtime release matches merged SHA; all three SWAP gates true and prior gates preserved. Public runtime and SQL health both ok. Recovery launcher for previous2b48f7d runtime retained. Evidence: P:\PAWS\Runtime\Acceptance\SessionSwap-20261009.

Firebase Hosting-only deployment completed:65 assets at https://tester-teaching.web.app. Live SWAP JS exactly matches shipped artifact. Chrome restored existing ADFA Owner session; SWAP inbox loaded its scoped empty result, actual session detail exposed SWAP request, SQL-backed form loaded current assignment/candidates/availability/course lists. Timetable faculty names display without commas. Screenshot: local outputs/session-swap-release-20261009/live-swap-form.jpg (not Git).

Current data has no ADC/LAB reviewer profiles and most sessions lack explicit scoped VISC ownership. Form reports these absences; affected routes require actual office configuration. LAB group/roster data remains disabled None available. No office identities or missing HR names were guessed. No end-to-end live approval/application claim is made: acceptance was read-only.

Implementation/publication is complete under current direction. Continue only on a new instruction; preserve live requests/audit and do not rerun completed migrations/imports.
