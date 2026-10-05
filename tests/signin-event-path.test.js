'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const frozen = '6cd77eb53d532b1f2279777452d45e55182b49ee';
const readWorking = name => fs.readFileSync(path.join(root, name), 'utf8');
const readFrozen = name => execFileSync('git', ['show', `${frozen}:${name}`], {
  cwd: root,
  encoding: 'utf8'
});

function functionSource(source, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = source.match(new RegExp(`^  function ${escaped}\\([^\\n]*\\)\\s*\\{[\\s\\S]*?^  \\}`, 'm'));
  assert.ok(match, `production function ${name} exists`);
  return match[0];
}

function createHarness(source, html) {
  const telemetry = [];
  const elements = new Map();

  class TestEventTarget {
    constructor(id = '') {
      this.id = id;
      this.className = '';
      this.listeners = new Map();
      this.disabled = false;
      this.textContent = '';
      this.value = '';
      const classes = new Set();
      this.classList = {
        add: name => classes.add(name),
        remove: name => classes.delete(name),
        contains: name => classes.has(name),
        toggle: (name, force) => {
          const shouldAdd = force === undefined ? !classes.has(name) : Boolean(force);
          shouldAdd ? classes.add(name) : classes.delete(name);
          return shouldAdd;
        }
      };
    }

    addEventListener(type, listener) {
      const listeners = this.listeners.get(type) || [];
      listeners.push(listener);
      this.listeners.set(type, listeners);
      // Test-only addEventListener instrumentation: metadata only, no event data.
      telemetry.push({ id: this.id, className: this.className, type, count: listeners.length });
    }

    dispatchEvent(event) {
      if (this.disabled) return true;
      event.target ||= this;
      for (const listener of this.listeners.get(event.type) || []) listener.call(this, event);
      return !event.defaultPrevented;
    }
  }

  const ids = new Set([...source.matchAll(/\$\('([^']+)'\)/g)].map(match => match[1]));
  for (const match of html.matchAll(/\bid="([^"]+)"/g)) ids.add(match[1]);
  for (const id of ids) elements.set(id, new TestEventTarget(id));

  let openLoginCalls = 0;
  let modalVisible = false;
  const noOp = () => {};
  const sandbox = {
    EventTarget: TestEventTarget,
    addEventListener: TestEventTarget.prototype.addEventListener.bind(new TestEventTarget('window')),
    $: id => elements.get(id) || null,
    document: {
      body: new TestEventTarget('body'),
      querySelectorAll: () => [],
      documentElement: new TestEventTarget('html')
    },
    window: { location: {} },
    location: { protocol: 'https:' },
    initializeScheduleFilters() {},
    render: noOp,
    resetFilters: noOp,
    moveCalendar: noOp,
    setInitialAcademicPeriod: noOp,
    renderWeekControls: noOp,
    syncWeekUI: noOp,
    refreshSessionScope: noOp,
    switchCalendarView: noOp,
    renderList: noOp,
    loadCccEvents: noOp,
    populateCourseFilter: noOp,
    roleIsFaculty: () => false,
    setViewButtons: noOp,
    requireLocalhost: () => false,
    authInitialized: true,
    auth: {},
    toast() {},
    showModal() { modalVisible = true; },
    openEmailLoginModal() {},
    openPhoneLoginModal() {},
    closeModal() {},
    openAuthSetupModal() {},
    openAccountModal() {},
    openBulkSessionForm() {},
    openSessionForm() {},
    startSessionSelection() {},
    cancelSessionSelection() {},
    reviewSelectedSessions() {},
    openCourseList() {},
    openExportDialog() {},
    openOutlookInviteDialog() {},
    resetTestData() {},
    initializeLiveSchedule() {},
    openUserManager() {},
    UCVM: { canOpenFacultyDashboard: () => false },
    currentUser: null,
    console: { error() {}, warn() {}, log() {} }
  };
  sandbox.__recordOpenLogin = () => { openLoginCalls += 1; };
  sandbox.globalThis = sandbox;
  const bind = functionSource(source, 'bindControls');
  const open = functionSource(source, 'openLoginModal').replace('function openLoginModal()', 'function openLoginModalOriginal()');
  const context = vm.createContext(sandbox);
  vm.runInContext(`${open}\nfunction openLoginModal(){ __recordOpenLogin(); return openLoginModalOriginal(); }\n${bind}\nbindControls();`, context, { timeout: 1000 });

  return { elements, telemetry, get openLoginCalls() { return openLoginCalls; }, get modalVisible() { return modalVisible; } };
}

for (const [label, read] of [['frozen runtime', readFrozen], ['current branch', readWorking]]) {
  test(`${label}: Sign in keeps one click listener on the visible auth-gate node`, () => {
    const source = read('timetable.js');
    const html = read('index.html');
    assert.match(html, /<button[^>]*id="gate-sign-in"[^>]*>Sign in<\/button>/);
    const harness = createHarness(source, html);
    const button = harness.elements.get('gate-sign-in');

    const registrations = harness.telemetry.filter(entry => entry.id === 'gate-sign-in' && entry.type === 'click');
    assert.equal(button.disabled, false);
    assert.equal(registrations.length, 1, 'bindControls registers one handler on the gate button');
    assert.equal(registrations[0].count, 1);

    const originalNode = button;
    // These are the auth-state render functions that hide/reveal the gate controls.
    const showSignedOut = functionSource(source, 'showSignedOutGate');
    const showRestore = functionSource(source, 'showSessionRestoreGate');
    const context = vm.createContext({ $: id => harness.elements.get(id) || null });
    vm.runInContext(`${showRestore}\n${showSignedOut}\nshowSessionRestoreGate(); showSignedOutGate();`, context);
    assert.strictEqual(harness.elements.get('gate-sign-in'), originalNode, 'auth gate render does not replace the button');
    assert.equal(button.classList.contains('hidden'), false, 'signed-out render reveals the same button node');

    button.dispatchEvent({ type: 'click' });
    assert.equal(harness.openLoginCalls, 1, 'the real registered callback invokes openLoginModal');
    assert.equal(harness.modalVisible, true, 'initialized-auth path opens the login modal');
  });
}
