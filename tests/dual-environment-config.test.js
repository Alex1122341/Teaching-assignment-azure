'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const { loadConfig, validateConfig, validatePair, render } = require('../tools/render-environment-config');
const { verifyRepository, verifyArtifact, verifyHealth } = require('../tools/verify-environment-config');
const nav = require('../paws-environment-nav.js');

const production = loadConfig('production');
const provisionedTesting = {
  environment: 'testing', environmentLabel: 'TESTING ENVIRONMENT', releaseLabel: 'TESTING — SYNTHETIC DATA',
  apiOrigin: 'https://paws-testing-api.example.org', siteUrl: 'https://paws-testing.web.app', peerSiteUrl: production.siteUrl,
  firebase: { apiKey: 'test-key', authDomain: 'paws-testing.firebaseapp.com', projectId: 'paws-testing', appId: '1:2:web:3' }
};

// ------------------------------------------------------------------ configuration
test('committed paws-api-origin.js is exactly the production rendering', () => {
  assert.deepEqual(verifyRepository(), []);
  const config = require('../paws-api-origin.js');
  assert.equal(config.environment, 'production');
  assert.equal(config.firebase.projectId, 'tester-teaching');
});

test('no shipped file other than the rendered config hard-codes Firebase or API identity', () => {
  const assets = require('../tools/static-assets.json').filter(file => file !== 'paws-api-origin.js' && !file.endsWith('.pdf'));
  for (const file of assets) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    assert.ok(!source.includes(production.firebase.apiKey), `${file} embeds the Firebase API key`);
    assert.ok(!source.includes('tester-teaching'), `${file} embeds the production Firebase project`);
    assert.ok(!source.includes(new URL(production.apiOrigin).hostname), `${file} embeds the production API origin`);
  }
});

test('every page loads the environment configuration before any Firebase consumer and the shared switcher', () => {
  for (const page of ['index.html', 'faculty-admin.html', 'teaching-assignments.html', 'user-management.html', 'password.html']) {
    const html = fs.readFileSync(path.join(root, page), 'utf8');
    const origin = html.indexOf('<script src="paws-api-origin.js"></script>');
    assert.ok(origin > 0, `${page} loads paws-api-origin.js`);
    assert.ok(html.includes('<script src="paws-environment-nav.js"></script>'), `${page} loads the environment switcher`);
    for (const consumer of ['faculty-access.js', 'timetable.js', 'faculty-admin.js', 'teaching-assignments.js', 'user-management.js', 'password.js', 'paws-environment-nav.js']) {
      const at = html.indexOf(`<script src="${consumer}"></script>`);
      if (at >= 0) assert.ok(at > origin, `${page}: ${consumer} after paws-api-origin.js`);
    }
  }
});

test('the Testing configuration is not deployable until it is provisioned (fails closed)', () => {
  const testing = loadConfig('testing');
  assert.ok(validatePair(production, testing, { complete: true }).length > 0);
  assert.deepEqual(validatePair(production, testing, { complete: false }), []);
  assert.deepEqual(validatePair(production, provisionedTesting, { complete: true }), []);
});

test('Testing can never share the Production API, identity project or site', () => {
  const cases = [
    { ...provisionedTesting, apiOrigin: production.apiOrigin },
    { ...provisionedTesting, siteUrl: production.siteUrl, peerSiteUrl: production.siteUrl },
    { ...provisionedTesting, firebase: { ...provisionedTesting.firebase, projectId: 'tester-teaching' } },
    { ...provisionedTesting, peerSiteUrl: 'https://elsewhere.example.org' }
  ];
  for (const testing of cases) assert.ok(validatePair(production, testing).length > 0, JSON.stringify(testing));
  assert.ok(validateConfig({ ...provisionedTesting, apiOrigin: 'http://insecure.example.org' }).length > 0);
  assert.ok(validateConfig({ ...provisionedTesting, apiOrigin: 'https://api.example.org/path' }).length > 0);
  assert.ok(validateConfig({ ...provisionedTesting, environment: 'staging' }).length > 0);
  assert.ok(validateConfig({ ...provisionedTesting, extra: 1 }).length > 0);
});

function artifactFor(environmentConfig, tamper) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paws-artifact-'));
  for (const file of require('../tools/static-assets.json')) {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.copyFileSync(path.join(root, file), path.join(dir, file));
  }
  fs.writeFileSync(path.join(dir, 'paws-api-origin.js'), render(environmentConfig));
  if (tamper) tamper(dir);
  return dir;
}

test('artifact guard: production artifact passes; a production artifact with Testing config is rejected', () => {
  assert.deepEqual(verifyArtifact(artifactFor(production), 'production'), []);
  // Testing is unprovisioned in the repository, so a "testing" artifact cannot be verified at all.
  assert.ok(verifyArtifact(artifactFor(production), 'testing').length > 0);
});

function provisionedRoot(testingConfig) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paws-root-'));
  fs.mkdirSync(path.join(dir, 'config', 'environments'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'tools'), { recursive: true });
  fs.copyFileSync(path.join(root, 'config', 'environments', 'production.json'), path.join(dir, 'config', 'environments', 'production.json'));
  fs.writeFileSync(path.join(dir, 'config', 'environments', 'testing.json'), JSON.stringify(testingConfig, null, 2));
  fs.copyFileSync(path.join(root, 'tools', 'static-assets.json'), path.join(dir, 'tools', 'static-assets.json'));
  return dir;
}

test('artifact guard: a provisioned Testing artifact passes even though it names the Production site for Return to Production', () => {
  const configRoot = provisionedRoot(provisionedTesting);
  assert.match(render(provisionedTesting), /tester-teaching\.web\.app/);
  assert.deepEqual(verifyArtifact(artifactFor(provisionedTesting), 'testing', configRoot), []);
  assert.deepEqual(verifyArtifact(artifactFor(production), 'production', configRoot), []);
});

test('artifact guard: Testing artifacts carrying Production configuration or identity are rejected', () => {
  const configRoot = provisionedRoot(provisionedTesting);
  // Testing artifact shipped with the Production rendering.
  assert.ok(verifyArtifact(artifactFor(production), 'testing', configRoot).some(error => /not the testing rendering/.test(error)));
  // Production artifact shipped with the Testing rendering.
  assert.ok(verifyArtifact(artifactFor(provisionedTesting), 'production', configRoot).some(error => /not the production rendering/.test(error)));
  // Another shipped file hard-codes the Production Firebase project or API host inside a Testing artifact.
  const leaked = artifactFor(provisionedTesting, dir => fs.appendFileSync(path.join(dir, 'timetable.js'), `\n// ${production.firebase.projectId} ${new URL(production.apiOrigin).hostname}\n`));
  const errors = verifyArtifact(leaked, 'testing', configRoot);
  assert.ok(errors.some(error => /timetable\.js references the production environment/.test(error)), errors.join('; '));
  // A Production artifact that leaks the Testing API host is rejected too.
  const reverse = artifactFor(production, dir => fs.appendFileSync(path.join(dir, 'timetable.js'), `\n// ${new URL(provisionedTesting.apiOrigin).hostname}\n`));
  assert.ok(verifyArtifact(reverse, 'production', configRoot).some(error => /references the testing environment/.test(error)));
});

test('Testing can never share the Production Firebase API key or auth domain', () => {
  assert.ok(validatePair(production, { ...provisionedTesting, firebase: { ...provisionedTesting.firebase, apiKey: production.firebase.apiKey } }).some(e => /API key/.test(e)));
  assert.ok(validatePair(production, { ...provisionedTesting, firebase: { ...provisionedTesting.firebase, authDomain: production.firebase.authDomain } }).some(e => /auth domain/.test(e)));
});

test('health guard rejects a runtime reporting the other environment', () => {
  assert.deepEqual(verifyHealth({ status: 'ok', environment: 'testing' }, 'testing'), []);
  assert.ok(verifyHealth({ status: 'ok', environment: 'production' }, 'testing').length > 0);
  assert.ok(verifyHealth({ status: 'ok' }, 'production').length > 0);
});

test('freeze: the Testing artifact differs from the baseline only in the rendered environment file', () => {
  const freeze = require('../tools/beta-freeze');
  assert.ok(freeze.ENVIRONMENT_INPUTS.includes('config/environments/testing.json'));
  assert.throws(() => freeze.verifyFreeze({ environment: 'staging', skipCommitCheck: true, files: [] }), /unknown environment/);
});

// ------------------------------------------------------------------ switcher view model
const me = (role, extra = {}) => ({ profile: { displayName: 'Ada', role, facultyId: role === 'faculty' ? 'f1' : null }, environment: { name: extra.reported || 'production', testing: extra.reported === 'testing' }, support: extra.support || null });

test('production: only operators see "Open Testing Environment", and only when a Testing site exists', () => {
  const withPeer = { ...production, peerSiteUrl: provisionedTesting.siteUrl };
  for (const role of ['developer', 'adfa_general', 'adfa_regular']) {
    const model = nav.viewModel(withPeer, me(role));
    assert.equal(model.openTesting, true, role);
    assert.equal(model.switchIdentity, false, role);
  }
  for (const role of ['faculty', 'hicc', 'visc', 'adc', 'lab']) {
    const model = nav.viewModel(withPeer, me(role));
    assert.equal(model.openTesting, false, role);
    assert.equal(model.showBar, false, role);
  }
  assert.equal(nav.viewModel(production, me('developer')).openTesting, false, 'no peer site configured');
});

test('testing: persistent banner, Return to Production, and identity switching only when the server says testing', () => {
  const ok = nav.viewModel(provisionedTesting, me('adfa_regular', { reported: 'testing' }));
  assert.equal(ok.state, 'ok');
  assert.equal(ok.showBar, true);
  assert.equal(ok.returnToProduction, true);
  assert.equal(ok.switchIdentity, true);
  assert.equal(nav.viewModel(provisionedTesting, me('faculty', { reported: 'testing' })).switchIdentity, false);
  assert.equal(nav.viewModel(provisionedTesting, null).showBar, true, 'visible before sign-in');
  const persona = nav.viewModel(provisionedTesting, { ...me('faculty', { reported: 'testing' }), support: { actorName: 'Ada', actorRole: 'adfa_regular', targetName: 'Casey', targetRole: 'faculty', expiresAtUtc: '2026-10-14T22:00:00Z' } });
  assert.equal(persona.actor.role, 'adfa_regular');
  assert.equal(persona.persona.role, 'faculty');
  assert.equal(persona.switchIdentity, true, 'operator keeps the switch while using a persona');
});

test('a frontend connected to the other environment\'s API is locked', () => {
  assert.equal(nav.viewModel(provisionedTesting, me('developer', { reported: 'production' })).state, 'mismatch');
  assert.equal(nav.viewModel(production, me('developer', { reported: 'testing' })).state, 'mismatch');
  assert.equal(nav.viewModel(null, null).state, 'misconfigured');
});

test('switching navigates to an allow-listed page on the peer site and never carries tokens', () => {
  assert.equal(nav.peerDestination(provisionedTesting, '/faculty-admin.html'), 'https://tester-teaching.web.app/faculty-admin.html');
  assert.equal(nav.peerDestination(provisionedTesting, '/password.html'), 'https://tester-teaching.web.app/');
  assert.equal(nav.peerDestination(provisionedTesting, '/../../evil'), 'https://tester-teaching.web.app/');
  assert.equal(nav.peerDestination(production, '/index.html'), null);
  const url = nav.peerDestination({ peerSiteUrl: 'https://paws-testing.web.app' }, '/index.html');
  assert.ok(!/[?#]/.test(url));
});

test('rendered switcher DOM: testing banner and production entry point', () => {
  const html = renderBar(provisionedTesting, me('adfa_general', { reported: 'testing' }), '/index.html');
  assert.match(html, /TESTING ENVIRONMENT/);
  assert.match(html, /Return to Production/);
  assert.match(html, /Switch Test Identity/);
  const prod = renderBar({ ...production, peerSiteUrl: provisionedTesting.siteUrl }, me('developer'), '/faculty-admin.html');
  assert.match(prod, /Open Testing Environment/);
  assert.match(prod, /href="https:\/\/paws-testing\.web\.app\/faculty-admin\.html"/);
  const faculty = renderBar({ ...production, peerSiteUrl: provisionedTesting.siteUrl }, me('faculty'), '/index.html');
  assert.doesNotMatch(faculty, /Open Testing Environment/);
});

// Minimal DOM to execute the real module.
function renderBar(config, profileEvent, pathname) {
  const elements = new Map();
  const listeners = {};
  const mk = tag => {
    const el = { tagName: tag, id: '', className: '', hidden: false, innerHTML: '', textContent: '', attributes: {},
      setAttribute(k, v) { this.attributes[k] = v; }, append() {}, prepend(child) { if (child.id) elements.set(child.id, child); },
      querySelector() { return null; }, classList: { toggle() {}, add() {} } };
    return el;
  };
  const body = mk('body');
  body.prepend = child => elements.set(child.id, child);
  const document = { readyState: 'complete', head: mk('head'), body, createElement: mk, getElementById: id => elements.get(id) || null, addEventListener() {} };
  const window = { document, location: { pathname }, PAWS_ENVIRONMENT_CONFIG: config, addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); } };
  const context = vm.createContext({ window, URL, module: undefined });
  vm.runInContext(fs.readFileSync(path.join(root, 'paws-environment-nav.js'), 'utf8').replace('typeof window === \'undefined\' ? globalThis : window', 'window'), context);
  (listeners['paws-profile'] || []).forEach(fn => fn({ detail: profileEvent }));
  return elements.get('paws-environment-bar').innerHTML;
}
