'use strict';
// Cross-environment deployment guard. Rejects:
//   * a Testing frontend pointing at the Production API or Production Firebase project (or vice versa);
//   * an artifact whose rendered environment differs from the environment being deployed;
//   * a runtime whose /api/health/runtime reports a different environment;
//   * missing or inconsistent configuration.
//
//   node tools/verify-environment-config.js --repository
//   node tools/verify-environment-config.js --artifact <dir> --environment <production|testing>
//   node tools/verify-environment-config.js --health <runtime.json> --environment <production|testing>
const fs = require('node:fs');
const path = require('node:path');
const { loadConfig, validatePair, render } = require('./render-environment-config');

const ROOT = path.resolve(__dirname, '..');

function hostOf(origin) { try { return new URL(origin).hostname; } catch { return null; } }

function forbiddenMarkers(other) {
  const markers = [];
  if (other.apiOrigin) markers.push(hostOf(other.apiOrigin));
  if (other.firebase) markers.push(other.firebase.projectId, other.firebase.authDomain, other.firebase.apiKey);
  return markers.filter(Boolean);
}

function verifyRepository(root = ROOT) {
  const production = loadConfig('production', root);
  const testing = loadConfig('testing', root);
  const errors = validatePair(production, testing, { complete: false });
  const committed = fs.readFileSync(path.join(root, 'paws-api-origin.js'), 'utf8').replace(/\r\n/g, '\n');
  if (committed !== render(production)) errors.push('paws-api-origin.js is not the production rendering');
  return errors;
}

function verifyArtifact(dir, environment, root = ROOT) {
  const errors = [];
  const production = loadConfig('production', root);
  const testing = loadConfig('testing', root);
  const own = environment === 'production' ? production : testing;
  const other = environment === 'production' ? testing : production;
  errors.push(...validatePair(production, testing, { complete: environment === 'testing' }));
  if (errors.length) return errors;
  const file = path.join(dir, 'paws-api-origin.js');
  if (!fs.existsSync(file)) return [`${file} is missing`];
  const shipped = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  if (shipped !== render(own)) errors.push(`artifact paws-api-origin.js is not the ${environment} rendering`);
  const markers = forbiddenMarkers(other);
  const assets = JSON.parse(fs.readFileSync(path.join(root, 'tools', 'static-assets.json'), 'utf8'));
  for (const asset of assets) {
    const target = path.join(dir, asset);
    if (!fs.existsSync(target)) { errors.push(`artifact is missing ${asset}`); continue; }
    if (/\.(pdf|png|jpe?g|gif|ico|woff2?)$/i.test(asset)) continue;
    const text = fs.readFileSync(target, 'utf8');
    for (const marker of markers) if (text.includes(marker)) errors.push(`${asset} references the ${other.environment} environment (${marker})`);
  }
  return errors;
}

function verifyHealth(health, environment) {
  const errors = [];
  if (!health || health.status !== 'ok') errors.push('runtime health is not ok');
  if (!health || health.environment !== environment) errors.push(`runtime reports environment ${health && health.environment}, expected ${environment}`);
  return errors;
}

function main(argv) {
  const arg = name => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
  let errors;
  if (argv.includes('--repository')) errors = verifyRepository();
  else if (arg('--artifact')) errors = verifyArtifact(path.resolve(arg('--artifact')), arg('--environment'));
  else if (arg('--health')) errors = verifyHealth(JSON.parse(fs.readFileSync(arg('--health'), 'utf8')), arg('--environment'));
  else throw new Error('Usage: --repository | --artifact <dir> --environment <env> | --health <file> --environment <env>');
  if (!['production', 'testing', undefined].includes(arg('--environment'))) errors.unshift('invalid --environment');
  if (errors.length) { console.error(JSON.stringify({ ok: false, errors }, null, 2)); process.exit(1); }
  console.log(JSON.stringify({ ok: true }));
}

if (require.main === module) {
  try { main(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exit(1); }
}

module.exports = { verifyRepository, verifyArtifact, verifyHealth };
