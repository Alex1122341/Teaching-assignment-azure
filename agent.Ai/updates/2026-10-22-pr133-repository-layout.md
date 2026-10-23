# PR #133 repository organization

Date: 2026-10-22. Base checkpoint: `8249a331a2069d2172db304cc7dff586a7f8df02`. Same branch and same PR; no new PR, merge or release.

## Changes
- 85 source assets: 5 pages, 66 scripts, 13 styles, 1 public PDF template. Root count 96 -> 11.
- Public asset manifest, URLs and canonical contents unchanged; immutable runtime anchor remains `f78b10a`.
- Shared static builder removes two duplicated implementations and validates inputs before deleting old artifacts.
- Tests and source-function harness now resolve organized paths explicitly. No symlink/duplicate compatibility source tree or fs monkey-patch.
- Firebase release derives API-origin file path from the exact requested Git revision, supporting historical releases.
- Added root/frontend/test/docs guides; preserved historical performance report under docs/performance.

## Verification and limitations
The new layout tests initially failed four checks on the old tree. After migration, 46 targeted tests passed. A full local discovery run exposed remaining inline/source-function helper paths; these were fixed and verified by a 57-pass/1-skip targeted run (Windows does not permit symlink creation). That obsolete discovery run was stopped; do not count it as a passing full suite. Final PR CI and artifact freezes are the acceptance authority. No business-runtime bytes, API/SQL logic, access gates or production resources changed.

## Next action
Complete exact-HEAD CI, review changes and update PR evidence. Do not replay cloud provisioning or source imports. PR #125 still needs its separate non-DB Azure redesign and path rebasing before merge.
