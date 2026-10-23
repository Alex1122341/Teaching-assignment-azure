'use strict';
// Builds the Testing static artifact from the SAME commit and manifest as Production.
// The only difference is paws-api-origin.js, rendered from config/environments/testing.json.
// Refuses to build while the Testing configuration is incomplete or points at Production.
const fs = require('node:fs');
const path = require('node:path');
const { loadConfig, validatePair, render } = require('./render-environment-config');

const root = path.resolve(__dirname, '..');
const out = path.join(root, '.azure-testing');
const app = path.join(out, 'app');

const errors = validatePair(loadConfig('production'), loadConfig('testing'), { complete: true });
if (errors.length && process.argv.includes('--if-provisioned') && errors.every(e => / is not provisioned$/.test(e))) {
  console.log(JSON.stringify({ ok: true, skipped: true, reason: 'TESTING_NOT_PROVISIONED', errors }));
  process.exit(0);
}
if (errors.length) {
  console.error(JSON.stringify({ ok: false, reason: 'TESTING_NOT_PROVISIONED_OR_INVALID', errors }, null, 2));
  process.exit(1);
}
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(app, { recursive: true });
const assets = JSON.parse(fs.readFileSync(path.join(root, 'tools', 'static-assets.json'), 'utf8'));
if (new Set(assets).size !== assets.length) throw Error('Static asset manifest contains duplicates.');
for (const relative of assets) {
  if (typeof relative !== 'string' || path.isAbsolute(relative) || relative.includes('..')) throw Error(`Unsafe static asset path: ${relative}`);
  const destination = path.join(app, relative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(path.join(root, relative), destination);
}
fs.writeFileSync(path.join(app, 'paws-api-origin.js'), render(loadConfig('testing')));
console.log(JSON.stringify({ ok: true, environment: 'testing', output: app, files: assets.length }));
