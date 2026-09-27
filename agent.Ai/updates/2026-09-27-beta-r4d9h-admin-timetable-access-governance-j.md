# BETA-R4D-9H — Administrator timetable access / Governance Commit J

## What was wrong

The owner could authenticate but the timetable stayed locked on
**"Checking your timetable access..."** before landing on the Dashboard.

`faculty-access.js` `scheduleAdminLanding()` ran inside `UCVM.ready()`. For
`owner / administrator / adfa_general / adfa_regular / admin` on `index.html` it armed a
900 ms `setTimeout` calling `location.replace('faculty-admin.html')` and then made
`ready()` return `false`.

`timetable.js` reads a `false` return as *abort login*:

```js
if (!await UCVM.ready(user, profile)) return;
```

so it returned before setting `currentUser`, before `subscribeSessions()`, and before
`setAppLocked(false)`. The gate never cleared and the user was redirected.

## What changed (Runtime Commit I)

`2b10aca5b9ab26ffecdffb685bddd33ae4de70f5`

- Automatic administrator landing removed. `UCVM.ready()` returns `true` for every
  authorized account.
- Preserved unchanged: blocked `SessionGuard` → `false`; inactive account → throw;
  `mustChangePassword` → `password.html` + `false`; `linkFacultyIdentity()`.
- Dashboard stays reachable explicitly — `faculty-dashboard-btn` and `UCVM.admin()`
  are untouched, and no second automatic redirect was added.
- New `clearLegacyAdminLanding()` clears `sessionStorage['ucvm-admin-default-landing']`
  and resets `window.__ucvmAdminLandingScheduled` on every `ready()`. The retired marker
  is only ever cleared, never written, so a stale key needs no manual clearing.
- `installLandingReset()` neutered so no auth-state listener can re-arm a redirect.
- `scheduleAdminLanding()` retained as a no-op returning `false` (stale/restored callers
  cannot navigate; no reload loop).
- New `tests/faculty-access-admin-landing.test.js` (22 tests) executes the real
  `ready()` in an isolated VM over task cases A–L. **Fails 15/22 against the pre-fix
  source**, passes 22/22 after. `tests/read-efficiency.test.js` previously *froze* the
  buggy behaviour; that assertion is replaced.

## Baseline promotion (Governance Commit J)

```
f74443d945a9f6c917e7e634eb2e7825f02c7ab0   (Runtime Commit G)
  -> 2b10aca5b9ab26ffecdffb685bddd33ae4de70f5   (Runtime Commit I)
```

Protected runtime blobs changed by J: **0 of 45**. Protected path count stays **45**.
`protectedPaths()` remains the union of the current manifest and the frozen-baseline
manifest, so the addition is monotonic.

`faculty-access.js` was already in `tools/static-assets.json` and
`protectedPaths()` was already the union, so its new hash is added to
`tools/beta-baseline.json`:

```
faculty-access.js   7a220377120596efe816558c837a02e2bad4f0e25c54c18a2d15a0b9b2eea711
```

The other protected hashes (`index.html`, `timetable.js`, `timetable.css`,
`faculty-admin.html`, `faculty-admin.js`, `paws-data-client.js`) are unchanged from
Runtime G.

`f74443d945a9f6c917e7e634eb2e7825f02c7ab0` was deliberately **not** global-replaced: it
survives as historical record in `agent.Ai/updates/2026-09-27-beta-r4d9g-runtime-g-governance-h.md`.
Likewise `45e0e93daa2cba7c172f1c89e3c05406ce093364` (Runtime Commit E) still appears only
in the historical Commit F and Commit H update files.

No drift whitelist added. The freeze was not weakened, no protected file removed, no
verification step disabled, no deployment gate bypassed.

## Verification after promotion

```
node tools/verify-beta-candidate.js
  -> {"ok":true,"baselineCommit":"2b10aca5b9ab26ffecdffb685bddd33ae4de70f5","protected":45,"drift":[]}
node tools/beta-freeze.js --artifact .azure-production/app
  -> {"ok":true,"baselineCommit":"2b10aca5b9ab26ffecdffb685bddd33ae4de70f5","protected":45}
node --test tests/beta-baseline.test.js tests/azure-deployment.test.js
  -> 23 pass / 0 fail
```

## Disclosure

No SQL change. No Azure SQL schema/data/permission change. No ACA revision change. No
Firebase configuration or IAM change. No API authorization broadening. No Dashboard
(Firestore) migration — `faculty-admin.js` untouched. `sessionBackend()` remains
`azure-sql`; `sessionWritesEnabled()` remains `false`. R4D-9G visibility behaviour is
untouched.
