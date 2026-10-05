const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const modulePath = path.resolve(__dirname, '..', 'session-guard.js');

function loadGuard() {
  assert.ok(fs.existsSync(modulePath), 'session-guard.js must exist');
  delete require.cache[modulePath];
  return require(modulePath);
}

function memoryStorage() {
  const values = new Map();
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  };
}

test('allows five reloads in one minute and blocks the sixth', () => {
  const { recordReload } = loadGuard();
  const storage = memoryStorage();
  for (let i = 0; i < 5; i++) {
    assert.equal(recordReload(storage, 1_000 + i, true).allowed, true);
  }
  const sixth = recordReload(storage, 2_000, true);
  assert.equal(sixth.allowed, false);
  assert.equal(sixth.retryAfterMs > 0, true);
});

test('does not count normal navigation as a refresh', () => {
  const { recordReload } = loadGuard();
  const storage = memoryStorage();
  for (let i = 0; i < 20; i++) {
    assert.equal(recordReload(storage, 1_000 + i, false).allowed, true);
  }
});

test('refresh allowance resets after one minute', () => {
  const { recordReload } = loadGuard();
  const storage = memoryStorage();
  for (let i = 0; i < 5; i++) recordReload(storage, 1_000 + i, true);
  assert.equal(recordReload(storage, 62_000, true).allowed, true);
});

test('one hour without activity is idle', () => {
  const { isIdle } = loadGuard();
  assert.equal(isIdle(1_000, 3_600_999), false);
  assert.equal(isIdle(1_000, 3_601_000), true);
});

test('successful authenticated bootstrap can clear the stored and visible timeout notice',()=>{
  const {clearNotice}=loadGuard(),storage=memoryStorage();
  let removed=0;
  const notice={remove(){removed++}};
  storage.setItem('ucvm_session_notice_v1','You were signed out after one hour without activity.');
  const documentObject={getElementById:id=>id==='ucvm-session-guard-notice'?notice:null};
  assert.equal(clearNotice(storage,documentObject),true);
  assert.equal(storage.getItem('ucvm_session_notice_v1'),null);
  assert.equal(removed,1);
});

test('page-default cleanup clears the timeout notice after authentication without dashboard storage access',()=>{
  const storage=memoryStorage();
  let removed=0;
  const notice={remove(){removed++}};
  const priorWindow=global.window;
  global.window={sessionStorage:storage,document:{getElementById:id=>id==='ucvm-session-guard-notice'?notice:null}};
  try {
    delete require.cache[modulePath];
    const guard=require(modulePath);
    storage.setItem('ucvm_session_notice_v1','You were signed out after one hour without activity.');
    assert.equal(guard.clearNotice(),true);
    assert.equal(storage.getItem('ucvm_session_notice_v1'),null);
    assert.equal(removed,1);
  } finally {
    delete require.cache[modulePath];
    if(priorWindow===undefined)delete global.window;
    else global.window=priorWindow;
  }
});

test('successful timetable authorization clears notice only after access bootstrap succeeds',()=>{
  const source=require('node:fs').readFileSync(require('node:path').resolve(__dirname,'..','timetable.js'),'utf8');
  const start=source.indexOf('async function bootstrapForUser');
  const end=source.indexOf('auth.onAuthStateChanged',start);
  const body=source.slice(start,end);
  const accepted=body.indexOf('if (!accessReady)');
  const cleared=body.indexOf('UCVMSessionGuard?.clearNotice');
  assert.ok(accepted>=0&&cleared>accepted,'timeout notice clears only after PAWS access is ready');
});
