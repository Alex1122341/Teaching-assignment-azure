'use strict';
// Renders config/environments/<environment>.json into the shipped paws-api-origin.js.
//
// The rendered file is the browser's single source for the API origin, the Firebase web
// configuration and the environment identity. It is fixed at build time: nothing at runtime
// (URL, storage, user input) can change which API or identity project a deployment uses.
//
//   node tools/render-environment-config.js --check                 # committed file == production rendering
//   node tools/render-environment-config.js --environment testing --output <file>
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const ENVIRONMENTS = Object.freeze(['production', 'testing']);
const PRODUCTION_FIREBASE_PROJECT_IDS = Object.freeze(['tester-teaching']);
const FIREBASE_REQUIRED = Object.freeze(['apiKey', 'authDomain', 'projectId', 'appId']);
const FIREBASE_ALLOWED = Object.freeze([...FIREBASE_REQUIRED, 'storageBucket', 'messagingSenderId', 'measurementId']);
const KEYS = Object.freeze(['environment', 'environmentLabel', 'releaseLabel', 'apiOrigin', 'siteUrl', 'peerSiteUrl', 'firebase']);

function configPath(environment, root = ROOT) {
  if (!ENVIRONMENTS.includes(environment)) throw new Error(`Unknown environment: ${environment}`);
  if (environment === 'testing') return path.join(root, 'tools', 'testing', 'config', 'environment.json');
  return path.join(root, 'config', 'environments', `${environment}.json`);
}

function loadConfig(environment, root = ROOT) {
  return JSON.parse(fs.readFileSync(configPath(environment, root), 'utf8'));
}

function bareHttpsOrigin(value, field, errors) {
  if (value === null) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !['', '/'].includes(url.pathname) || url.search || url.hash || url.username || url.password || url.origin !== value) {
      errors.push(`${field} must be a bare HTTPS origin`);
      return null;
    }
    return url.origin;
  } catch {
    errors.push(`${field} must be a bare HTTPS origin`);
    return null;
  }
}

const PLACEHOLDER = /<[^>]*>|REPLACE[_ ]?ME|REPLACE_WITH|PLACEHOLDER|CHANGE[_ ]?ME|\bTODO\b|\bTBD\b/i;
function hostOf(origin) { try { return origin ? new URL(origin).hostname.toLowerCase() : null; } catch { return null; } }
function flatStrings(value, prefix = '') {
  if (typeof value === 'string') return [[prefix || 'value', value]];
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, item]) => flatStrings(item, prefix ? `${prefix}.${key}` : key));
}

// Validates one configuration. `complete` requires every value needed to deploy.
function validateConfig(config, { environment, complete = true } = {}) {
  const errors = [];
  if (!config || typeof config !== 'object' || Array.isArray(config)) return ['configuration must be an object'];
  const unknown = Object.keys(config).filter(key => !KEYS.includes(key));
  if (unknown.length) errors.push(`unknown keys: ${unknown.join(', ')}`);
  if (!ENVIRONMENTS.includes(config.environment)) errors.push('environment must be production or testing');
  if (environment && config.environment !== environment) errors.push(`environment must be ${environment}`);
  for (const field of ['environmentLabel', 'releaseLabel']) {
    if (typeof config[field] !== 'string' || !config[field].trim() || config[field].length > 80) errors.push(`${field} is required`);
  }
  bareHttpsOrigin(config.apiOrigin ?? null, 'apiOrigin', errors);
  bareHttpsOrigin(config.siteUrl ?? null, 'siteUrl', errors);
  bareHttpsOrigin(config.peerSiteUrl ?? null, 'peerSiteUrl', errors);
  if (config.firebase !== null && config.firebase !== undefined) {
    if (typeof config.firebase !== 'object' || Array.isArray(config.firebase)) errors.push('firebase must be an object');
    else {
      const extra = Object.keys(config.firebase).filter(key => !FIREBASE_ALLOWED.includes(key));
      if (extra.length) errors.push(`unknown firebase keys: ${extra.join(', ')}`);
      for (const key of FIREBASE_REQUIRED) if (typeof config.firebase[key] !== 'string' || !config.firebase[key].trim()) errors.push(`firebase.${key} is required`);
    }
  }
  if (complete) {
    for (const field of ['apiOrigin', 'siteUrl']) if (!config[field]) errors.push(`${field} is not provisioned`);
    if (!config.firebase) errors.push('firebase is not provisioned');
  }
  if (config.siteUrl && config.peerSiteUrl && config.siteUrl === config.peerSiteUrl) errors.push('peerSiteUrl must differ from siteUrl');
  // Unfilled template values and non-public hosts are never deployable.
  for (const [field, value] of flatStrings(config)) {
    if (PLACEHOLDER.test(value)) errors.push(`${field} still contains a placeholder`);
  }
  for (const field of ['apiOrigin', 'siteUrl', 'peerSiteUrl']) {
    const host = hostOf(config[field]);
    if (host && (host === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(host) || host.startsWith('['))) errors.push(`${field} must be a public DNS name, not ${host}`);
  }
  if (config.apiOrigin && config.siteUrl && hostOf(config.apiOrigin) === hostOf(config.siteUrl)) errors.push('apiOrigin and siteUrl must be different hosts');
  if (config.environment === 'testing' && config.firebase && PRODUCTION_FIREBASE_PROJECT_IDS.includes(config.firebase.projectId)) {
    errors.push('testing must not use the production Firebase project');
  }
  return errors;
}

// Cross-environment rules: Testing can never share an API, identity project or site with Production.
function validatePair(production, testing, { complete = true } = {}) {
  const errors = [
    ...validateConfig(production, { environment: 'production', complete: true }).map(e => `production: ${e}`),
    ...validateConfig(testing, { environment: 'testing', complete }).map(e => `testing: ${e}`)
  ];
  if (testing.apiOrigin && testing.apiOrigin === production.apiOrigin) errors.push('testing apiOrigin points at the production API');
  if (testing.siteUrl && testing.siteUrl === production.siteUrl) errors.push('testing siteUrl is the production site');
  if (testing.firebase && production.firebase && testing.firebase.projectId === production.firebase.projectId) errors.push('testing shares the production Firebase project');
  if (testing.firebase && production.firebase && testing.firebase.apiKey === production.firebase.apiKey) errors.push('testing shares the production Firebase API key');
  if (testing.firebase && production.firebase && testing.firebase.authDomain === production.firebase.authDomain) errors.push('testing shares the production Firebase auth domain');
  if (testing.apiOrigin && production.siteUrl && testing.apiOrigin === production.siteUrl) errors.push('testing apiOrigin points at the production site');
  // Compare hosts too: another port or path on a Production host is still Production.
  const productionHosts = [production.apiOrigin, production.siteUrl].map(hostOf).filter(Boolean);
  if (production.firebase) productionHosts.push(`${production.firebase.projectId}.web.app`, `${production.firebase.projectId}.firebaseapp.com`, String(production.firebase.authDomain || '').toLowerCase());
  for (const field of ['apiOrigin', 'siteUrl']) {
    const host = hostOf(testing[field]);
    if (host && productionHosts.some(item => item && (host === item || host.endsWith('.' + item)))) errors.push(`testing ${field} is a Production host (${host})`);
  }
  if (testing.firebase && production.firebase) {
    for (const key of ['appId', 'messagingSenderId', 'storageBucket', 'measurementId']) {
      if (testing.firebase[key] && testing.firebase[key] === production.firebase[key]) errors.push(`testing shares the production Firebase ${key}`);
    }
    if (String(testing.firebase.authDomain || '').toLowerCase().includes(String(production.firebase.projectId).toLowerCase() + '.')) errors.push('testing auth domain belongs to the production Firebase project');
  }
  if (production.peerSiteUrl && production.peerSiteUrl !== testing.siteUrl) errors.push('production peerSiteUrl must be the testing siteUrl');
  if (testing.peerSiteUrl !== production.siteUrl) errors.push('testing peerSiteUrl must be the production siteUrl');
  return errors;
}

const literal = value => JSON.stringify(value);

function render(config) {
  const errors = validateConfig(config, { complete: config.environment === 'production' });
  if (errors.length) throw new Error(`Invalid ${config && config.environment} configuration: ${errors.join('; ')}`);
  const firebase = config.firebase
    ? `Object.freeze({\n${FIREBASE_ALLOWED.filter(key => config.firebase[key] !== undefined).map(key => `      ${key}: ${literal(config.firebase[key])}`).join(',\n')}\n    })`
    : 'null';
  return `(function (root, factory) {
  'use strict';
  const config = factory();
  if (typeof module === 'object' && module.exports) module.exports = config;
  if (root) {
    root.PAWS_API_ORIGIN_CONFIG = config;
    root.PAWS_ENVIRONMENT_CONFIG = config;
  }
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';

  // GENERATED by tools/render-environment-config.js from config/environments/${config.environment}.json.
  // Do not edit by hand. The environment is fixed per deployment at build time.
  return Object.freeze({
    environment: ${literal(config.environment)},
    environmentLabel: ${literal(config.environmentLabel)},
    // TEMPORARY BETA INGRESS. Replace this single origin when institutional ingress is approved.
    apiOrigin: ${literal(config.apiOrigin)},
    releaseLabel: ${literal(config.releaseLabel)},
    siteUrl: ${literal(config.siteUrl)},
    peerSiteUrl: ${literal(config.peerSiteUrl)},
    firebase: ${firebase}
  });
});
`;
}

function main(argv) {
  const arg = name => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
  if (argv.includes('--check')) {
    const expected = render(loadConfig('production'));
    const actual = fs.readFileSync(path.join(ROOT, 'frontend', 'scripts', 'paws-api-origin.js'), 'utf8').replace(/\r\n/g, '\n');
    if (actual !== expected) { console.error('paws-api-origin.js is not the rendering of config/environments/production.json'); process.exit(1); }
    console.log(JSON.stringify({ ok: true, environment: 'production' }));
    return;
  }
  const environment = arg('--environment');
  const output = arg('--output');
  if (!environment || !output) throw new Error('Usage: --environment <production|testing> --output <file> | --check');
  const config = loadConfig(environment);
  if (environment === 'testing') {
    const errors = validatePair(loadConfig('production'), config, { complete: true });
    if (errors.length) throw new Error(`Testing configuration is not deployable: ${errors.join('; ')}`);
  }
  fs.writeFileSync(output, render(config));
  console.log(JSON.stringify({ ok: true, environment, output }));
}

if (require.main === module) {
  try { main(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exit(1); }
}

module.exports = { ENVIRONMENTS, PRODUCTION_FIREBASE_PROJECT_IDS, configPath, loadConfig, validateConfig, validatePair, render };
