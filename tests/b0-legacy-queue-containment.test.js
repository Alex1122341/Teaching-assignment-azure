const { repositoryPath } = require('../tools/build/frontend-paths');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = repositoryPath(__dirname, '..');
const read = name => fs.readFileSync(repositoryPath(root, name), 'utf8');

test('Azure SQL asset loading skips all legacy approval dependencies', async () => {
  const loaded = [];
  const listeners = new Map();
  const context = {
    console,
    setTimeout,
    clearTimeout,
    document: {
      readyState: 'loading',
      head: { appendChild: node => loaded.push(node.src) },
      createElement: () => ({})
    },
    addEventListener: (name, callback) => listeners.set(name, callback),
    UCVM_PAWS_DATA: { sessionBackend: () => 'vetmed-ops' }
  };
  context.window = context;

  vm.runInNewContext(read('asset-loader.js'), context);
  assert.equal(await context.UCVM_ASSETS.ensureApprovalWorkflow(), false);
  assert.deepEqual(loaded, []);
  assert.equal(listeners.has('load'), true);
});

function assetLoaderHarness(client) {
  const loaded = [];
  const context = {
    console,
    setTimeout,
    clearTimeout,
    addEventListener: () => {},
    document: {
      readyState: 'loading',
      head: { appendChild: node => { loaded.push(node.src); node.onload(); } },
      createElement: () => ({})
    }
  };
  if (client !== undefined) context.UCVM_PAWS_DATA = client;
  context.window = context;
  vm.runInNewContext(read('asset-loader.js'), context);
  return { context, loaded };
}

test('asset loader fails closed for missing, unknown, and throwing backends', async () => {
  const cases = [
    ['missing client', undefined],
    ['missing method', {}],
    ['throwing method', { sessionBackend: () => { throw new Error('backend unavailable'); } }],
    ['unknown backend', { sessionBackend: () => 'unknown' }],
    ['empty backend', { sessionBackend: () => '  ' }],
    ['non-canonical case', { sessionBackend: () => 'Firestore' }]
  ];
  for (const [label, client] of cases) {
    const h = assetLoaderHarness(client);
    assert.equal(await h.context.UCVM_ASSETS.ensureApprovalWorkflow(), false, label);
    assert.deepEqual(h.loaded, [], label);
  }
});

test('asset loader does not restore legacy approval/Firestore writers for any backend', async () => {
  const h = assetLoaderHarness({ sessionBackend: () => ' firestore ' });
  assert.equal(await h.context.UCVM_ASSETS.ensureApprovalWorkflow(), false);
  assert.deepEqual(h.loaded, []);
});

function approvalBoundaryScenario(client) {
  let initCalls = 0;
  let firestoreTouches = 0;
  let domTouches = 0;
  let listenerCalls = 0;
  const nodes = new Map();
  const document = {
    getElementById: id => { domTouches += 1; return nodes.get(id); },
    createElement: () => { domTouches += 1; return {}; },
    head: { appendChild: () => { domTouches += 1; } }
  };
  const context = {
    console,
    document,
    addEventListener: () => { listenerCalls += 1; },
    UCVM: { init: () => { initCalls += 1; throw new Error('UCVM.init must not run'); } },
    firebase: new Proxy({}, { get() { firestoreTouches += 1; throw new Error('Firestore must not be touched'); } })
  };
  if (client !== undefined) context.UCVM_PAWS_DATA = client;
  context.window = context;
  assert.doesNotThrow(() => vm.runInNewContext(read('approval-workflow.js'), context));
  return { context, nodes, initCalls, firestoreTouches, domTouches, listenerCalls };
}

test('approval workflow fails closed for every non-firestore backend state', () => {
  const cases = [
    ['vetmed-ops', { sessionBackend: () => 'vetmed-ops' }],
    ['missing client', undefined],
    ['missing method', {}],
    ['throwing method', { sessionBackend: () => { throw new Error('backend unavailable'); } }],
    ['unknown backend', { sessionBackend: () => 'unknown' }]
  ];
  for (const [label, client] of cases) {
    const result = approvalBoundaryScenario(client);
    assert.equal(result.initCalls, 0, label);
    assert.equal(result.firestoreTouches, 0, label);
    assert.equal(result.domTouches, 0, label);
    assert.equal(result.listenerCalls, 0, label);
    assert.equal(result.nodes.get('approval-queue-btn'), undefined, label);
    assert.equal(result.nodes.get('my-requests-btn'), undefined, label);
  }
});

function afcBoundaryScenario(client) {
  let initCalls = 0;
  let firestoreTouches = 0;
  let decisionCalls = 0;
  const listeners = new Map();
  const panel = { innerHTML: '' };
  const context = {
    console,
    document: { getElementById: id => id === 'afc-panel' ? panel : null },
    addEventListener: (name, callback) => {
      const callbacks = listeners.get(name) || [];
      callbacks.push(callback);
      listeners.set(name, callbacks);
    },
    dispatchEvent: event => { for (const callback of listeners.get(event.type) || []) callback(event); },
    UCVM: { init: () => { initCalls += 1; throw new Error('UCVM.init must not run'); } },
    firebase: new Proxy({}, { get() { firestoreTouches += 1; throw new Error('Firestore must not be touched'); } }),
    UCVM_AFC_ACTIONS: { decide: () => { decisionCalls += 1; } }
  };
  if (client !== undefined) context.UCVM_PAWS_DATA = client;
  context.window = context;
  vm.runInNewContext(read('afc-workflow.js'), context);
  context.window.UCVM_AFC.mount({ panelId: 'afc-panel' });
  context.dispatchEvent({ type: 'ucvm:afc-open' });
  return { context, panel, initCalls, firestoreTouches, decisionCalls };
}

test('AFC uses the same safe unavailable facade for missing and unknown backends', async () => {
  const cases = [
    ['vetmed-ops', { sessionBackend: () => 'vetmed-ops' }],
    ['missing client', undefined],
    ['missing method', {}],
    ['throwing method', { sessionBackend: () => { throw new Error('backend unavailable'); } }],
    ['unknown backend', { sessionBackend: () => 'unknown' }]
  ];
  for (const [label, client] of cases) {
    const result = afcBoundaryScenario(client);
    assert.equal(result.context.window.UCVM_AFC.unavailable, true, label);
    assert.equal(result.initCalls, 0, label);
    assert.equal(result.firestoreTouches, 0, label);
    assert.equal(result.decisionCalls, 0, label);
    assert.match(result.panel.innerHTML, /PAWS University API/, label);
    assert.doesNotMatch(result.panel.innerHTML, /Submit AFC request|afc-form/i, label);
    await assert.rejects(result.context.window.UCVM_AFC.submit({}), /PAWS University API/);
  }
});

test('approval-workflow fails closed before UCVM or Firestore initialization on Azure SQL', () => {
  let initCalls = 0;
  let firestoreTouches = 0;
  let createdNodes = 0;
  const context = {
    UCVM_PAWS_DATA: { sessionBackend: () => 'vetmed-ops' },
    UCVM: { init: () => { initCalls += 1; throw new Error('UCVM.init must not run'); } },
    firebase: new Proxy({}, { get() { firestoreTouches += 1; throw new Error('Firestore must not be touched'); } }),
    document: {
      createElement: () => { createdNodes += 1; throw new Error('legacy UI must not be created'); },
      head: { appendChild: () => { createdNodes += 1; } }
    }
  };
  context.window = context;

  assert.doesNotThrow(() => vm.runInNewContext(read('approval-workflow.js'), context));
  assert.equal(initCalls, 0);
  assert.equal(firestoreTouches, 0);
  assert.equal(createdNodes, 0);
  assert.equal(context.document.getElementById?.('approval-queue-btn'), undefined);
  assert.equal(context.document.getElementById?.('my-requests-btn'), undefined);
});

function azureAfcPanelHarness() {
  const listeners = new Map();
  const elements = new Map();
  let documentRef;
  let keydown;
  const makeElement = id => {
    const element = {
      id,
      hidden: id === 'afc-panel',
      attributes: {},
      classList: { toggle() {} },
      setAttribute(name, value) { this.attributes[name] = value; },
      focus() { documentRef.activeElement = this; },
      querySelectorAll: () => [],
      contains: () => false,
      innerHTML: ''
    };
    elements.set(id, element);
    return element;
  };
  for (const id of ['my-teaching-btn', 'afc-request-btn', 'my-change-history-btn', 'afc-panel', 'afc-panel-content', 'afc-panel-title', 'afc-panel-close']) makeElement(id);
  const panel = elements.get('afc-panel');
  const request = elements.get('afc-request-btn');
  const history = elements.get('my-change-history-btn');
  const teaching = elements.get('my-teaching-btn');
  const close = elements.get('afc-panel-close');
  panel.querySelectorAll = () => [close];
  panel.contains = target => target === close;
  const background = { inert: false };
  documentRef = {
    getElementById: id => elements.get(id) || null,
    activeElement: request,
    body: { children: [background, panel] },
    addEventListener: (name, callback) => { if (name === 'keydown') keydown = callback; }
  };
  const context = {
    document: documentRef,
    Event: class { constructor(type) { this.type = type; } },
    dispatchEvent: event => { for (const callback of listeners.get(event.type) || []) callback(event); },
    addEventListener: (name, callback) => {
      const callbacks = listeners.get(name) || [];
      callbacks.push(callback);
      listeners.set(name, callbacks);
    },
    UCVM_PAWS_DATA: { sessionBackend: () => 'vetmed-ops' },
    PAWS_CHANGE_HISTORY: { mount: (_container, options) => { context.historyOptions = options; return { destroy() { context.historyDestroyed = true; } }; } },
    UCVM: { logs: () => { throw new Error('Legacy history must not be touched'); } },
    UCVM_AFC_ACTIONS: { decide: () => { context.decideCalls += 1; } },
    decideCalls: 0,
    window: null
  };
  context.window = context;
  context.window.UCVM_PAGE_DATA = { profile: () => ({ uid: 'faculty-1', role: 'faculty' }) };
  context.window.firebase = new Proxy({}, { get() { throw new Error('Firestore must not be touched'); } });
  vm.runInNewContext(read('afc-workflow.js'), context);
  vm.runInNewContext(read('afc-timetable-panel.js'), context);
  return { context, elements, documentRef, request, history, teaching, panel, keydown: () => keydown };
}

test('Azure SQL AFC facade keeps panel navigation but exposes no legacy request path', async () => {
  const h = azureAfcPanelHarness();
  assert.equal(h.context.window.UCVM_AFC.unavailable, true);
  h.context.window.UCVM_AFC.mount({ panelId: 'afc-panel-content', mode: 'timetable' });
  await assert.rejects(h.context.window.UCVM_AFC.submit({}), /PAWS University API/);

  h.request.onclick();
  assert.equal(h.panel.hidden, false);
  assert.match(h.elements.get('afc-panel-content').innerHTML, /PAWS University API/);
  assert.doesNotMatch(h.elements.get('afc-panel-content').innerHTML, /afc-form|Submit AFC request/i);
  assert.equal(h.context.decideCalls, 0);

  h.history.onclick();
  assert.equal(h.context.historyOptions.scope, 'mine');
  assert.equal(h.context.historyOptions.api, h.context.UCVM_PAWS_DATA);

  h.teaching.onclick();
  assert.equal(h.context.historyDestroyed, true);
  assert.equal(h.panel.hidden, true);
  assert.equal(h.documentRef.activeElement, h.request);

  h.request.onclick();
  const escape = { key: 'Escape' };
  h.keydown()(escape);
  assert.equal(h.panel.hidden, true);
});

test('Azure SQL data client remains read-only and exposes the existing read surfaces', () => {
  const source = read('paws-data-client.js');
  assert.match(source, /sessionBackend:\(\)=> 'vetmed-ops'/);
  assert.match(source, /sessionWritesEnabled:\(\)=> false/);
  for (const route of ['/api/v1/sessions', '/api/v1/dashboard\/summary', '/api/v1/dashboard\/faculty']) assert.match(source, new RegExp(route));
});
