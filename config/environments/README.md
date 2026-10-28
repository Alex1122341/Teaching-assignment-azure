# Environment configuration (non-secret)

One codebase, two deployments. These files are the **only** place the browser's API origin, Firebase web
configuration and the peer environment link are defined. `tools/render-environment-config.js` renders the
selected file into the shipped `paws-api-origin.js` at build time; the committed `paws-api-origin.js` is always
the rendering of `production.json` (enforced by `tests/dual-environment-config.test.js`).

Nothing here is secret: Firebase web config is public by design. SQL connection strings, service-account keys,
`PAWS_TESTING_ENVIRONMENT_ID` and write gates are server-side deployment settings (GitHub repository secrets /
variables), never frontend files.

`testing.json` contains `null` until the Testing resources are provisioned (see
`docs/dual-environment/03-setup-and-deployment.md`). `tools/verify-environment-config.js` refuses to build a
Testing artifact while any required value is missing or points at Production.

| Field | Production | Testing |
|---|---|---|
| `environment` | `production` | `testing` |
| `apiOrigin` | University API ingress | Testing API (separate host) |
| `firebase.projectId` | `tester-teaching` | a separate Firebase project |
| `siteUrl` | production Hosting URL | Testing Hosting URL |
| `peerSiteUrl` | Testing site (null hides the button) | production site |

## Provisioning Testing

`testing.template.json` shows every value `testing.json` needs once the Testing resources exist. Copy the
values from the Testing Firebase project (Project settings → Your apps → Web app config) and the Testing
Container App ingress URL. The validator rejects any value that still contains a `<placeholder>`, a
Production host or Firebase value, an IP address or `localhost`.

When `testing.json` is filled in, set `production.json` `peerSiteUrl` to the Testing `siteUrl` in the same
reviewed change. That changes the shipped `paws-api-origin.js`, so it needs its own freeze promotion.

Run `node tools/testing-preflight.js` to see exactly what is still missing, and `--live` to probe the
deployed Testing API and site.
