const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

test('Firestore persistence is enabled through the shared initializer', () => {
  const source = read('faculty-access.js');
  assert.match(source, /enablePersistence\(\{\s*synchronizeTabs:\s*true\s*\}\)/);
});

test('the main timetable shares visible snapshots and the profile read with the approval workflow', () => {
  const page = read('timetable.js');
  const workflow = read('approval-workflow.js');
  assert.match(page, /UCVM_PAGE_DATA/);
  assert.match(page, /ucvm:sessions-updated/);
  assert.match(page, /ucvm:faculty-updated/);
  assert.match(page, /profileSnapshot/);
  assert.match(workflow, /UCVM_PAGE_DATA/);
  assert.match(workflow, /UCVM_PAGE_DATA\?\.profileSnapshot/);
  assert.doesNotMatch(workflow, /async function loadPeopleOnce/);
});

test('authenticated pages reuse the profile read when starting the role watcher', () => {
  for (const name of ['user-management.js']) {
    const source = read(name);
    const reads = source.match(/db\.doc\(`users\/\$\{u\.uid\}`\)\.get\(\)/g) || [];
    assert.equal(reads.length, 1, `${name} should fetch the signed-in profile once`);
  }
});

test('the large auxiliary settings document is loaded only when the sessional tab is opened', () => {
  const source = read('faculty-admin.js');
  assert.match(source, /function loadAuxOnce/);
  assert.match(source, /tab==='sessional'.*loadAuxOnce\(\)/);
  assert.doesNotMatch(source, /subscribeAux\(\);subscribeSessions\(\)/);
});

test('the timetable requests only the visible date range from the Azure API', () => {
  const source = read('timetable.js');
  assert.match(source, /function fetchAzureSessions\(range=\{\}\)/);
  assert.match(source, /UCVM_PAWS_DATA\.listSessions\(range\)/);
  assert.match(source, /start:range\.start,end:ymd\(addDays\(parseYmd\(range\.end\),1\)\)/);
  const start=source.indexOf('async function subscribeSessions');
  const end=source.indexOf('function refreshSessionScope',start);
  const body=source.slice(start,end);
  assert.match(body,/fetchAzureSessions/);
  assert.doesNotMatch(body,/onSnapshot|db\.collection\(SESSION_COLLECTION\)/);
});

test('administrator landing no longer aborts timetable readers with a forced redirect', () => {
  const source = read('faculty-access.js');
  assert.doesNotMatch(source, /if\(scheduleAdminLanding\(user,p\)\)return false/);
  assert.doesNotMatch(source, /location\.replace\('faculty-admin\.html'\)/);
  assert.match(source, /clearLegacyAdminLanding\(\);return true\}/);
});

test('the timetable loads the faculty directory only when an admin tool needs it', () => {
  const source = read('timetable.js');
  assert.match(source, /function ensureFacultyDirectory/);
  assert.doesNotMatch(source, /if \(UCVM\.admin\(profile\)\) subscribeFacultyDirectory\(\)/);
});

test('faculty admin enhancements reuse the page snapshots', () => {
  const source = read('faculty-admin-enhancements.js');
  assert.match(source, /UCVM_ADMIN_DATA/);
  assert.doesNotMatch(source, /collection\('faculty'\)\.onSnapshot/);
  assert.doesNotMatch(source, /collection\('sessions'\)\.onSnapshot/);
  assert.doesNotMatch(source, /db\.doc\(`users\/\$\{u\.uid\}`\)\.get\(\)/);
});

test('audit details are written directly without scanning recent logs after save',()=>{
 const access=read('faculty-access.js'),timetable=read('timetable.js'),admin=read('faculty-admin.js');
 assert.doesNotMatch(access,/patchRecent|waitClosed|new MutationObserver\(inspect\)/);
 assert.match(timetable,/UCVM_AUDIT_DETAILS\.diff/);
 assert.match(admin,/UCVM_AUDIT_DETAILS\.diff/);
});
