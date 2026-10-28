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
