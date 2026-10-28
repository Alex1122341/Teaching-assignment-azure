'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { testingFixtures } = require('../tools/testing/firestore-seed');
const { createLabDashboardReader } = require('../tools/testing/firestore-dashboard');
const { createLabReadRuntime } = require('../tools/testing/firestore-read-runtime');

function dbWithFixtures({ corrupted = false } = {}) {
  const docs = new Map(testingFixtures().map(row => [row.collection + '/' + row.id, structuredClone(row.data)]));
  for (const uid of ['paws-synthetic-owner','paws-synthetic-faculty-a']) {
    const row = docs.get('paws_testing_users/' + uid);
    row.active = true; row.mustChangePassword = false;
  }
  if (corrupted) docs.get('paws_testing_faculty/a1111111-1111-4111-8111-111111111111').synthetic = false;
  const accessed = [];
  return {
    projectId:'vista-teaching-lab', databaseId:'(default)', accessed,
    collection(name) {
      assert.ok(name.startsWith('paws_testing_'), 'no legacy/shared collection permitted');
      accessed.push(name);
      let limit = Infinity, fields = null;
      const query = {
        select(...chosen) { fields = chosen; return query; },
        limit(n) { limit = n; return query; },
        async get() {
          const rows = [...docs].filter(([id]) => id.startsWith(name + '/')).slice(0, limit);
          return { docs: rows.map(([path,data]) => ({ id:path.slice(name.length+1),
            data: () => fields ? Object.fromEntries(fields.filter(k=>Object.hasOwn(data,k)).map(k=>[k,data[k]])) : data })) };
        },
        doc(id) { return { async get() {
          const data = docs.get(name+'/'+id);
          return { exists: !!data, data: () => data };
        } }; }
      };
      return query;
    }
  };
}

const project = 'paws-testing-ucvm-20261022';
const verifyIdToken = async token => {
  if (!['admin','faculty'].includes(token)) throw Error('invalid');
  return { uid: token === 'admin' ? 'paws-synthetic-owner' : 'paws-synthetic-faculty-a',
    aud: project, iss: 'https://securetoken.google.com/' + project };
};
const request = (path, token='admin') => new Request('https://testing.invalid'+path, {
  headers: token ? { authorization:'Bearer '+token } : {}
});

test('synthetic Faculty repository enforces strict lab project and read-only bounded collections', async () => {
  assert.throws(() => createLabDashboardReader({ db: { projectId:'tester-teaching', databaseId:'(default)', collection() {} } }), /project/);
  const db = dbWithFixtures();
  const store = createLabDashboardReader({ db });
  assert.equal((await store.faculty({ academicYear:'2026-27',status:'all' })).length,31);
  assert.equal((await store.faculty({ academicYear:'2026-27',status:'inactive' })).length,2);
  const own = await store.faculty({ academicYear:'2026-27',facultyId:'a1111111-1111-4111-8111-111111111111' });
  assert.equal(own.length,1);
  assert.equal(own[0].displayName,'Testwell, Avery');
  assert.doesNotMatch(JSON.stringify(own), /ucid|doeCredit|private/);
});

test('Testing Dashboard uses real PAWS authorization and prevents another Faculty read', async () => {
  const db = dbWithFixtures();
  const runtime = createLabReadRuntime({ db, verifyIdToken });
  const admin = await runtime(request('/api/v1/dashboard/faculty?status=all'));
  assert.equal(admin.status,200);
  assert.equal(admin.jsonBody.faculty.length,31);
  const self = await runtime(request('/api/v1/dashboard/faculty','faculty'));
  assert.equal(self.status,200);
  assert.deepEqual(self.jsonBody.faculty.map(x=>x.facultyId),['a1111111-1111-4111-8111-111111111111']);
  const other = await runtime(request('/api/v1/dashboard/faculty/b2222222-2222-4222-8222-222222222222','faculty'));
  assert.equal(other.status,403);
  assert.equal((await runtime(request('/api/v1/dashboard/summary','faculty'))).status,403);
  assert.equal((await runtime(request('/api/v1/dashboard/faculty?status=all','faculty'))).status,403);
  assert.equal((await runtime(request('/api/v1/dashboard/faculty',null))).status,401);
  assert.ok(db.accessed.every(name=>name.startsWith('paws_testing_')));
});

test('Admin sees real synthetic summary, instructor counts and dated roles, not made-up DOE totals', async () => {
  const runtime = createLabReadRuntime({ db:dbWithFixtures(),verifyIdToken });
  const summary = await runtime(request('/api/v1/dashboard/summary?academicYear=2026-27'));
  assert.equal(summary.status,200);
  assert.equal(summary.jsonBody.summary.facultyCount,31);
  assert.equal(summary.jsonBody.summary.activeFacultyCount,29);
  assert.ok(summary.jsonBody.summary.sessionCount >= 300);
  assert.equal('doeTotal' in summary.jsonBody.summary,false);
  const roles = await runtime(request('/api/v1/dashboard/roles?academicYear=2026-27'));
  assert.equal(roles.status,200);
  assert.deepEqual(roles.jsonBody.roles.map(x=>x.roleType).sort(),['HICC','VISC']);
  const teaching = await runtime(request('/api/v1/dashboard/teaching-summary?academicYear=2026-27'));
  assert.equal(teaching.status,200);
  assert.equal(teaching.jsonBody.teachingSummary.length,31);
  const all = JSON.stringify({roles:roles.jsonBody,teaching:teaching.jsonBody});
  assert.doesNotMatch(all, /SYN100001|doeCredit|private/);
});

test('non-synthetic data is rejected and unsupported Dashboard write routes remain closed', async () => {
  const runtime = createLabReadRuntime({ db:dbWithFixtures({corrupted:true}),verifyIdToken });
  const response = await runtime(request('/api/v1/dashboard/faculty'));
  assert.equal(response.status,503);
  assert.doesNotMatch(JSON.stringify(response), /private/i);
  assert.equal((await runtime(new Request('https://testing.invalid/api/v1/dashboard/faculty/a1111111-1111-4111-8111-111111111111',{ method:'PATCH',headers:{authorization:'Bearer admin'} }))).status,405);
  assert.equal((await runtime(request('/api/v1/dashboard/doe-overview'))).status,404);
});
