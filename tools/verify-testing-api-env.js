'use strict';
// Validates the Testing API (Container App) environment before a Testing revision is activated.
//
//   node tools/verify-testing-api-env.js --aca-env <file.json>     # `az containerapp show ... --query properties.template.containers[0].env`
//   node tools/verify-testing-api-env.js --env-file <file.env>     # KEY=VALUE lines (for example a filled copy of the template)
//
// It never prints values, only variable names and the resulting gate map, so its output is safe for CI logs.
// Checks, in addition to the runtime's own resolveEnvironment():
//   * the Firebase project and allowed browser origin are exactly the committed Testing configuration;
//   * the SQL connection string is a plain (password-free, managed-identity) value that can be verified;
//   * secrets are secret references, not plain values;
//   * every business write gate is set explicitly to "true" or "false";
//   * no unknown PAWS_* variable (typos would silently leave a gate closed);
//   * nothing points at a Production identity, site, API or SQL server.
const fs = require('node:fs');
const path = require('node:path');
const { resolveEnvironment } = require('../server/src/runtime/environment');
const { GATE_ENV } = require('../server/src/data/write-gates');
const { loadConfig } = require('./render-environment-config');

const ROOT = path.resolve(__dirname, '..');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KNOWN = new Set([
  'PAWS_ENVIRONMENT', 'PAWS_TESTING_ENVIRONMENT_ID', 'PAWS_TESTING_SQL_SERVER', 'PAWS_SQL_CONNECTION_STRING', 'PAWS_SQL_MI_CLIENT_ID',
  'PAWS_SQL_DRIVER', 'PAWS_SQL_ALLOW_SELF_SIGNED', 'PAWS_API_HOST', 'PAWS_API_PORT', 'PAWS_API_ALLOW_NON_LOOPBACK', 'PAWS_API_ALLOWED_ORIGINS',
  'PAWS_API_MAX_BODY_BYTES', 'PAWS_RELEASE_SHA', 'PAWS_RUNTIME_TRUST_ANCHOR', ...Object.values(GATE_ENV)
]);
const SECRET_ONLY = new Set(['FIREBASE_SERVICE_ACCOUNT_JSON']);
const PLAIN_REQUIRED = new Set(['PAWS_ENVIRONMENT', 'PAWS_TESTING_ENVIRONMENT_ID', 'PAWS_TESTING_SQL_SERVER', 'PAWS_SQL_CONNECTION_STRING', 'FIREBASE_PROJECT_ID', 'PAWS_API_ALLOWED_ORIGINS']);

function parseEnvFile(text) {
  const entries = [];
  for (const line of String(text).split(/\r?\n/)) {
    if (!line.trim() || /^\s*#/.test(line)) continue;
    const at = line.indexOf('=');
    if (at < 1) throw new Error(`Invalid line in env file: ${line.slice(0, 40)}`);
    entries.push({ name: line.slice(0, at).trim(), value: line.slice(at + 1) });
  }
  return entries;
}

// entries: [{ name, value } | { name, secretRef }] as returned by the Container App API.
function verifyTestingApiEnv(entries, { root = ROOT } = {}) {
  const errors = [];
  if (!Array.isArray(entries)) return { errors: ['environment must be an array of { name, value | secretRef }'], gates: null };
  const env = {}, secretRefs = new Set(), seen = new Set();
  for (const entry of entries) {
    const name = entry && typeof entry.name === 'string' ? entry.name : '';
    if (!name) { errors.push('an entry has no name'); continue; }
    if (seen.has(name)) errors.push(`${name} is set more than once`);
    seen.add(name);
    if (entry.secretRef !== undefined) secretRefs.add(name);
    else env[name] = entry.value === undefined || entry.value === null ? '' : String(entry.value);
  }
  for (const name of Object.keys(env)) if (/<[^>]*>/.test(env[name])) errors.push(`${name} still contains a <placeholder>`);
  for (const name of SECRET_ONLY) if (name in env) errors.push(`${name} must be a Container App secret reference, not a plain value`);
  for (const name of PLAIN_REQUIRED) if (secretRefs.has(name)) errors.push(`${name} must be a plain value so it can be verified (it carries no secret)`);
  for (const name of [...seen].filter(n => n.startsWith('PAWS_'))) if (!KNOWN.has(name)) errors.push(`${name} is not a PAWS setting (typo?)`);
  if (/password|pwd\s*=/i.test(env.PAWS_SQL_CONNECTION_STRING || '')) errors.push('PAWS_SQL_CONNECTION_STRING must not contain a password; use the Testing managed identity');

  try { const environment = resolveEnvironment(env); if (!environment.testing) errors.push('PAWS_ENVIRONMENT must be testing'); }
  catch (error) { errors.push(error.message); }

  if (!UUID.test(env.PAWS_SQL_MI_CLIENT_ID || '')) errors.push('PAWS_SQL_MI_CLIENT_ID must be the Testing managed identity client id (UUID)');
  if (env.PAWS_SQL_DRIVER !== 'tedious') errors.push('PAWS_SQL_DRIVER must be tedious in the container');
  if (env.PAWS_API_HOST !== '0.0.0.0' || env.PAWS_API_ALLOW_NON_LOOPBACK !== 'true') errors.push('the container must bind PAWS_API_HOST=0.0.0.0 with PAWS_API_ALLOW_NON_LOOPBACK=true');
  if ('PAWS_SQL_ALLOW_SELF_SIGNED' in env && env.PAWS_SQL_ALLOW_SELF_SIGNED !== 'false') errors.push('PAWS_SQL_ALLOW_SELF_SIGNED must be absent or false for Azure SQL');

  let testing = null, production = null;
  try { testing = loadConfig('testing', root); production = loadConfig('production', root); } catch (error) { errors.push(`cannot read committed environment configuration: ${error.message}`); }
  if (testing && production) {
    if (!testing.firebase || !testing.siteUrl) errors.push('config/environments/testing.json is not provisioned (firebase, siteUrl)');
    else {
      if (env.FIREBASE_PROJECT_ID !== testing.firebase.projectId) errors.push('FIREBASE_PROJECT_ID is not the committed Testing Firebase project');
      if (env.PAWS_API_ALLOWED_ORIGINS !== testing.siteUrl) errors.push('PAWS_API_ALLOWED_ORIGINS must be exactly the committed Testing siteUrl');
    }
    const productionMarkers = [production.siteUrl, production.apiOrigin, production.firebase && production.firebase.projectId].filter(Boolean);
    for (const [name, value] of Object.entries(env)) {
      for (const marker of productionMarkers) if (value && value.includes(marker)) errors.push(`${name} references Production (${marker})`);
    }
  }

  const gates = {};
  for (const [gate, name] of Object.entries(GATE_ENV)) {
    if (!(name in env)) errors.push(`${name} must be set explicitly to true or false`);
    else if (!['true', 'false'].includes(env[name])) errors.push(`${name} must be exactly true or false`);
    gates[gate] = env[name] === 'true';
  }
  return { errors, gates };
}

function main(argv) {
  const arg = name => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
  let entries;
  if (arg('--aca-env')) entries = JSON.parse(fs.readFileSync(arg('--aca-env'), 'utf8'));
  else if (arg('--env-file')) entries = parseEnvFile(fs.readFileSync(arg('--env-file'), 'utf8'));
  else throw new Error('Usage: --aca-env <file.json> | --env-file <file.env>');
  const { errors, gates } = verifyTestingApiEnv(entries);
  if (errors.length) { console.error(JSON.stringify({ ok: false, errors }, null, 2)); process.exit(1); }
  console.log(JSON.stringify({ ok: true, environment: 'testing', gates }));
}

if (require.main === module) {
  try { main(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exit(1); }
}

module.exports = { verifyTestingApiEnv, parseEnvFile, KNOWN };
