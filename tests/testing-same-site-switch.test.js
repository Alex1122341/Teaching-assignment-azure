'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const nav = require('../frontend/scripts/paws-environment-nav');

const modes = Object.freeze({ production: { environment: 'production' }, testing: { environment: 'testing' }, modeKey: 'paws-site-mode' });
function browser(environment = 'production', pathname = '/index.html') {
  const state = new Map([['paws-support-context-v1', 'support-session']]);
  const calls = [];
  const win = {
    PAWS_SINGLE_SITE: modes,
    PAWS_ENVIRONMENT_CONFIG: { environment },
    sessionStorage: {
      getItem: key => state.has(key) ? state.get(key) : null,
      setItem: (key, value) => state.set(key, value),
      removeItem: key => state.delete(key)
    },
    location: { pathname, assign: to => calls.push(to) }
  };
  return { win, state, calls };
}

test('same-origin switch keeps the allowed page and drops support identity', () => {
  const { win, state, calls } = browser('production', '/faculty-admin.html');
  assert.equal(nav.switchMode(win, 'testing'), true);
  assert.deepEqual(calls, ['/faculty-admin.html']);
  assert.equal(state.get('paws-site-mode'), 'testing');
  assert.equal(state.has('paws-support-context-v1'), false);
});

test('same-origin return to Production never carries a query, hash, or unknown page', () => {
  const { win, calls } = browser('testing', '/../../unknown.html');
  assert.equal(nav.switchMode(win, 'production'), true);
  assert.deepEqual(calls, ['/index.html']);
  assert.equal(nav.modeDestination('/teaching-assignments.html?token=bad'), '/index.html');
});

test('unconfigured site cannot use same-origin switch', () => {
  const { win, state, calls } = browser();
  delete win.PAWS_SINGLE_SITE;
  assert.equal(nav.switchMode(win, 'testing'), false);
  assert.equal(state.has('paws-site-mode'), false);
  assert.deepEqual(calls, []);
});

test('same-site view model does not expose Testing to Faculty', () => {
  const config = { environment: 'production', environmentLabel: 'Production', peerSiteUrl: null };
  const actor = role => ({ profile: { role }, environment: { name: 'production' } });
  assert.equal(nav.viewModel(config, actor('adfa_regular'), { sameSite: true }).openTesting, true);
  assert.equal(nav.viewModel(config, actor('faculty'), { sameSite: true }).openTesting, false);
  assert.equal(nav.viewModel(config, actor('faculty'), { sameSite: true }).showBar, false);
});

test('failed navigation restores previous tab mode and never restores support session', () => {
  const { win, state } = browser();
  state.set('paws-site-mode', 'production');
  win.location.assign = () => { throw new Error('Navigation blocked'); };
  assert.equal(nav.switchMode(win, 'testing'), false);
  assert.equal(state.get('paws-site-mode'), 'production');
  assert.equal(state.has('paws-support-context-v1'), false);
});

test('boot selector chooses the Testing API and independent Firebase project before clients start', () => {
  const vm = require('node:vm');
  const { loadConfig, render, sameSiteCandidate } = require('../tools/render-environment-config');
  const production = loadConfig('production');
  const testing = {
    environment: 'testing', environmentLabel: 'TESTING ENVIRONMENT — SYNTHETIC DATA ONLY',
    releaseLabel: 'TESTING', apiOrigin: 'https://testing-api.example.org',
    siteUrl: 'https://testing-app.web.app', peerSiteUrl: production.siteUrl,
    firebase: { apiKey: 'synthetic-test-key', authDomain: 'test-project.firebaseapp.com',
      projectId: 'test-project', appId: '1:123:web:456' }
  };
  assert.equal(sameSiteCandidate(production, testing).siteUrl, production.siteUrl);
  const script = render(production, { sameSiteTesting: testing });
  const win = { sessionStorage: { getItem: key => key === 'paws-site-mode' ? 'testing' : null } };
  vm.runInNewContext(script, { window: win });
  assert.equal(win.PAWS_ENVIRONMENT_CONFIG.environment, 'testing');
  assert.equal(win.PAWS_API_ORIGIN_CONFIG.apiOrigin, testing.apiOrigin);
  assert.equal(win.PAWS_API_ORIGIN_CONFIG.firebase.projectId, 'test-project');
  assert.equal(win.PAWS_SINGLE_SITE.production.environment, 'production');
  assert.equal(win.PAWS_SINGLE_SITE.modeKey, 'paws-site-mode');
});

test('unprovisioned Testing mode cannot silently route edits to Production', () => {
  const vm = require('node:vm');
  const { loadConfig, render } = require('../tools/render-environment-config');
  const prod = loadConfig('production'), unready = loadConfig('testing');
  assert.equal(unready.apiOrigin, null);
  const win = { sessionStorage: { getItem: () => 'testing' } };
  vm.runInNewContext(render(prod, { sameSiteTesting: unready }), { window: win });
  assert.equal(win.PAWS_ENVIRONMENT_CONFIG.environment, 'unavailable');
  assert.equal(win.PAWS_API_ORIGIN_CONFIG.apiOrigin, null);
  assert.equal(win.PAWS_API_ORIGIN_CONFIG.firebase, null);
  assert.equal(win.PAWS_SINGLE_SITE, undefined);
});

test('Production boot ignores untrusted query strings and never changes Firebase without a tab choice', () => {
  const vm = require('node:vm');
  const { loadConfig, render } = require('../tools/render-environment-config');
  const win = { location: { search: '?environment=testing', hash: '#testing' }, sessionStorage: { getItem: () => null } };
  vm.runInNewContext(render(loadConfig('production')), { window: win });
  assert.equal(win.PAWS_ENVIRONMENT_CONFIG.environment, 'production');
  assert.equal(win.PAWS_API_ORIGIN_CONFIG.firebase.projectId, 'tester-teaching');
});
