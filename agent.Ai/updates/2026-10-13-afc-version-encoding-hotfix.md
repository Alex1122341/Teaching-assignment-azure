# Agent Update — AFC SQL encoding release correction

Date: 2026-10-13. Repository: Alex1122341/Teaching-assignment-azure. Status: PARTIAL, authorized release in progress.

## Goal / breakpoint

Owner approved merging PR94 and coordinated release. PR94 merged b9dc273aaccd0e92b7d5219886153e9558fc5532; exact-main Beta38450811584 and SQL tooling38450811553 succeeded. Downloaded artifact digest3f601082fef32d30a8c725004eefc72d8d4dbed67fa0ca5d77c2b7201e681a18 matched GitHub; static71/API67 artifact freezes passed. Candidate65 University source/package files attested on P drive.

## Root cause / work

SQL036 compiled/rolled back with sqlcmd -I -b, then applied while cancellation remained disabled. Manual rollback acceptance failed: direct timestamp/rowversion conversion returned8 raw bytes. Read-only SQL comparison proved explicit binary(8) casting produces16 hex characters; encoding regression failed before correction.

Branch fix/afc-version-encoding-20261013 adds037 and retains applied036. New migration reproduces the unified view except two explicit binary casts. Columns/order, records, procedure, ownership and grants are preserved. Manual acceptance reads the Dashboard's view token;037 adds encoding acceptance. Release docs specify both migrations and -I -b.

## Tests / review

Read-only review: no Important/Critical findings. SQL rollback preview passed AFC_VERSION_ENCODING_REGRESSION_OK, AFC_CANCEL_ROLLBACK_ACCEPTANCE_OK and AFC037_COMPILE_AND_MANUAL_ROLLBACK_OK. Rollback restored the old view and left0 manual rows,803 active imported rows and0 cancellation audits. Full npm test is running; hotfix final-head/exact-main hosted CI remains required.

## Live state / invariants

SQL036 applied,037 only rollback-previewed. No business fixture persisted. Public API remains a9b80615f07761964eef12c50a024ea9167eddf8/trust22a4734b3ebcdb1aa4ccd6349e8c69adb9436b7d at18787/PID4804. Candidateb9 runs18789 with cancellation false. Unrelated older18788 must remain untouched. No new Hosting, role binding or cancellation activation yet.

No protected runtime, dependency, freeze, API validation, audit or permission changes in the hotfix. Trust remains fb2c625745957fa7d9990033f15a7b1ef91974a5. Existing temporary Beta identity/permissions are preserved.

## Next safe action

Commit reviewed SQL-only fix; PR/CI/merge/exact-main CI. Apply037, run manual/imported/stale/faculty-denied and lock rollback acceptance, verify narrow role membership, activate only cancellation. Guarded exact-source API cutover with prior launcher rollback, then exact tested Hosting-only artifact release and Chrome acceptance. Owner authorization already covers this correction/release; do not ask again.

## DO NOT REDO

No source reimport, old migration repetition, invented accounts/groups/times, hard deletion or unrelated18788 stop. Preserve prior launcher/runtime. Private evidence: P:\PAWS\Runtime\Acceptance\AfcLab-20261013 and local output/afc-release.
