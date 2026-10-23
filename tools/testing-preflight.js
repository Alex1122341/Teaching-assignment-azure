'use strict';
// Testing infrastructure preflight: what exists, what is missing, and the exact next step.
//
//   node tools/testing-preflight.js                         # offline: committed configuration only
//   node tools/testing-preflight.js --api-env aca-env.json  # plus the Container App environment (az containerapp show ... env)
//   node tools/testing-preflight.js --live                  # plus probes of the deployed Testing API and site
//
// Exit code 0 only when nothing failed. Skipped checks (not yet applicable) are listed with their reason.
// Never invents resource names or credentials; it only reports what the committed files and the live
// endpoints say.
const fs = require('node:fs');
const path = require('node:path');
const { loadConfig, validateConfig, validatePair, render } = require('./render-environment-config');
const { verifyTestingApiEnv } = require('./verify-testing-api-env');

const ROOT = path.resolve(__dirname, '..');
const GUIDE = 'docs/dual-environment/03-setup-and-deployment.md';

const STEPS = Object.freeze({
  firebase: `Create the Testing Firebase project and web app, then copy its web config into config/environments/testing.json (${GUIDE} §2.1).`,
  siteUrl: `Create the Testing Firebase Hosting site and set siteUrl to its https://<site>.web.app origin (${GUIDE} §2.1).`,
  apiOrigin: `Prepare the independent School Testing HTTPS tunnel and record its actual origin (${GUIDE}; current University procedure: docs/dual-environment/12-university-testing-operations.md).`,
  peer: `In the same reviewed change, set production.json peerSiteUrl to the Testing siteUrl, regenerate paws-api-origin.js and promote the freeze (${GUIDE} §5).`,
  apiEnv: `Validate the private Windows profile with --profile university-testing and supply non-secret settings (${GUIDE}; current University operations §Task5).`,
  live: `Deploy Testing (PAWS Testing Deploy workflow) and re-run with --live (${GUIDE} §6).`
});

function offlineChecks({ root = ROOT, apiEnv = null, profile } = {}) {
  const checks = [];
  const add = (id, status, detail, action) => checks.push({ id, status, detail, ...(action ? { action } : {}) });
  let production, testing;
  try { production = loadConfig('production', root); testing = loadConfig('testing', root); }
  catch (error) { add('config.read', 'fail', error.message, 'Restore config/environments/*.json'); return { checks, production: null, testing: null }; }

  const shape = validateConfig(testing, { environment: 'testing', complete: false });
  add('config.testing.shape', shape.length ? 'fail' : 'pass', shape.length ? shape.join('; ') : 'testing.json is well-formed', shape.length ? 'Fix the listed fields in config/environments/testing.json' : null);
  for (const [field, step] of [['firebase', STEPS.firebase], ['siteUrl', STEPS.siteUrl], ['apiOrigin', STEPS.apiOrigin]]) {
    add(`config.testing.${field}`, testing[field] ? 'pass' : 'fail', testing[field] ? `${field} is set` : `${field} is not provisioned`, testing[field] ? null : step);
  }
  const pair = validatePair(production, testing, { complete: false }).filter(error => !/peerSiteUrl/.test(error));
  add('config.isolation', pair.length ? 'fail' : 'pass', pair.length ? pair.join('; ') : 'Testing shares no API, site or identity value with Production', pair.length ? 'Use only Testing resources in testing.json' : null);
  if (testing.siteUrl) {
    const linked = production.peerSiteUrl === testing.siteUrl;
    add('config.production.peer', linked ? 'pass' : 'fail', linked ? 'Production links to the Testing site' : 'production.json peerSiteUrl does not name the Testing site', linked ? null : STEPS.peer);
  } else add('config.production.peer', 'skip', 'waits for the Testing siteUrl');

  if (apiEnv) {
    const { errors, gates } = verifyTestingApiEnv(apiEnv, { root, profile });
    add('api.environment', errors.length ? 'fail' : 'pass', errors.length ? errors.join('; ') : `Testing environment accepted; open gates: ${Object.entries(gates).filter(([, on]) => on).length}/${Object.keys(gates).length}`, errors.length ? STEPS.apiEnv : null);
  } else add('api.environment', 'skip', 'Private Testing environment not supplied (--api-env)', STEPS.apiEnv);
  return { checks, production, testing };
}

async function fetchWithTimeout(fetchImpl, url, init = {}, ms = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try { return await fetchImpl(url, { ...init, signal: controller.signal, redirect: 'manual' }); }
  finally { clearTimeout(timer); }
}

async function liveChecks({ production, testing, fetchImpl = fetch, expectedSha, expectedGates, trustAnchor, skipSite=false }) {
  const checks = [];
  const add = (id, status, detail, action) => checks.push({ id, status, detail, ...(action ? { action } : {}) });
  const complete = validatePair(production, testing, { complete: true }).length === 0;
  if (!complete) { add('live', 'skip', 'configuration is not complete', STEPS.live); return checks; }
  const probe = async (id, fn, action) => {
    try { const detail = await fn(); add(id, 'pass', detail); }
    catch (error) { add(id, 'fail', error.message, action); }
  };
  const api = testing.apiOrigin, site = testing.siteUrl;
  await probe('live.api.runtime', async () => {
    const response = await fetchWithTimeout(fetchImpl, `${api}/api/health/runtime`);
    if (response.status !== 200) throw new Error(`GET /api/health/runtime returned ${response.status}`);
    const body = await response.json();
    if (body.status !== 'ok' || body.environment !== 'testing') throw new Error(`runtime reports status=${body.status} environment=${body.environment}`);
    if (!body.writeGates || typeof body.writeGates !== 'object') throw new Error('runtime does not report its write gates');
    if(expectedSha&&(body.releaseSha!==expectedSha||body.service!=='paws-university-api'||body.authority!=='vetmed-ops-sql'))throw Error('Testing API runtime/source SHA mismatch');
    if(trustAnchor&&body.runtimeTrustAnchor!==trustAnchor)throw Error('Testing API runtime trust anchor mismatch');
    if(expectedGates&&require('./testing-runtime-attestation').canonicalDigest(body.writeGates)!==require('./testing-runtime-attestation').canonicalDigest(expectedGates))throw Error('Testing API runtime gate fingerprint mismatch');
    return `Testing API ${body.releaseSha || '(no release)'}; ${Object.values(body.writeGates).filter(Boolean).length} gates open`;
  }, 'Check the private School Testing supervisor receipt, University SQL connectivity and target identity');
  await probe('live.api.sql', async () => {
    const response = await fetchWithTimeout(fetchImpl, `${api}/api/health/sql`);
    if (response.status !== 200) throw new Error(`GET /api/health/sql returned ${response.status}`);
    return 'Testing SQL reachable';
  }, 'Check the Testing SQL firewall / private endpoint and the runtime identity database user');
  await probe('live.api.anonymous', async () => {
    const response = await fetchWithTimeout(fetchImpl, `${api}/api/v1/me`);
    if (response.status !== 401) throw new Error(`anonymous /api/v1/me returned ${response.status}, expected 401`);
    return 'anonymous requests are refused';
  });
  await probe('live.api.cors', async () => {
    const preflight = origin => fetchWithTimeout(fetchImpl, `${api}/api/health/runtime`, { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'authorization' } });
    const own = await preflight(site);
    if (own.status !== 204 || own.headers.get('access-control-allow-origin') !== site) throw new Error(`Testing site preflight returned ${own.status}`);
    const foreign = await preflight(production.siteUrl);
    if (foreign.status !== 403) throw new Error('the Testing API does not explicitly refuse the Production site');
    return 'only the Testing site may call the Testing API';
  }, 'Set PAWS_API_ALLOWED_ORIGINS to exactly the Testing siteUrl');
  if(!skipSite)await probe('live.site.config', async () => {
    const response = await fetchWithTimeout(fetchImpl, `${site}/paws-api-origin.js?preflight=${Date.now()}`);
    if (response.status !== 200) throw new Error(`GET ${site}/paws-api-origin.js returned ${response.status}`);
    const served = (await response.text()).replace(/\r\n/g, '\n');
    if (served !== render(testing)) throw new Error('the Testing site does not serve the Testing rendering of this commit');
    return 'Testing site serves the Testing configuration';
  }, STEPS.live);
  return checks;
}

async function preflight({ root = ROOT, apiEnv = null, live = false, fetchImpl, profile } = {}) {
  const offline = offlineChecks({ root, apiEnv, profile });
  const checks = [...offline.checks];
  if (live && offline.production && offline.testing) checks.push(...await liveChecks({ production: offline.production, testing: offline.testing, fetchImpl }));
  const failed = checks.filter(check => check.status === 'fail');
  return { ok: failed.length === 0, provisioned: Boolean(offline.testing && offline.testing.apiOrigin && offline.testing.siteUrl && offline.testing.firebase), failed: failed.length, checks };
}

if (require.main === module) {
  Promise.resolve().then(()=>{
   const argv = process.argv.slice(2),at = argv.indexOf('--api-env'),profileAt=argv.indexOf('--profile');
   const apiEnv = at >= 0 ? JSON.parse(fs.readFileSync(argv[at + 1], 'utf8')) : null;
   return preflight({ apiEnv, live: argv.includes('--live'),profile:profileAt>=0?argv[profileAt+1]:undefined });
  }).then(result => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.ok ? 0 : 1);
  }, () => { console.error('Testing private preflight configuration could not be read or validated.'); process.exit(1); });
}

module.exports = { preflight, offlineChecks, liveChecks, STEPS };
