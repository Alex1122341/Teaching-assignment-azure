'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createDashboardApi } = require('../src/data/dashboard-api');
const { createDashboardFunctions } = require('../src/runtime/swa-dashboard-functions');
const { createSqlAfcWriteRepository } = require('../src/data/sql-afc-write-repository');

const record = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const faculty = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const document = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const requestId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const payload = { facultyId: faculty, documentId: document, requestId };
const enabled = { afcBatch: true, afcFormUpload: true };

function fixture({ role = 'administrator', gates = enabled, query = async () => [] } = {}) {
  const queries = [];
  const writeRepository = createSqlAfcWriteRepository({ query: async (sql, params) => {
    queries.push({ sql, params });
    return query(sql, params);
  } });
  const api = createDashboardApi({
    verifyToken: async token => {
      if (token !== 'valid') throw Error('invalid token');
      return { uid: 'signed-in-admin' };
    },
    findUser: async () => ({ active: true, baseRole: role, facultyId: faculty }),
    repository: {}, writeGates: gates, writeRepository
  });
  const handler = createDashboardFunctions({ api });
  const call = (options = {}) => handler({
    url: 'https://example.invalid/api/v1/dashboard/afc-records/' + (options.record ?? record) + '/document',
    method: options.method || 'POST',
    headers: { get: () => options.bearer ?? 'Bearer valid' },
    json: options.json || (async () => options.body ?? payload)
  });
  return { queries, call };
}

test('linking a saved AFC batch row uses the verified actor and stable record/file identities on replay', async () => {
  let alreadyLinked = false;
  const { call, queries } = fixture({ query: async () => {
    const receipt = { afcRecordId: record, facultyId: faculty, documentId: document, idempotentReplay: alreadyLinked };
    alreadyLinked = true;
    return [{ ...receipt, fileName: 'private.pdf' }];
  } });
  for (const replay of [false, true]) {
    const res = await call({ body: { ...payload, actorFirebaseUid: 'foreign-user' } });
    assert.equal(res.status, 200);
    assert.equal(res.headers['Cache-Control'], 'private, no-store');
    assert.deepEqual(res.jsonBody, { afcRecordId: record, facultyId: faculty, documentId: document, idempotentReplay: replay });
  }
  for (const { sql, params } of queries) {
    assert.match(sql, /EXEC paws_api\.LinkAfcBatchRecordDocument\b/);
    assert.deepEqual(params, { afcRecordId: record, facultyId: faculty, documentId: document, requestId, actorFirebaseUid: 'signed-in-admin' });
  }
  assert.equal(queries.length, 2);
});

test('batch PDF association enforces method, authentication, administrator role, both write gates and valid IDs', async () => {
  for (const [config, options, status] of [
    [{}, { method: 'GET' }, 405],
    [{}, { bearer: '' }, 401],
    [{ role: 'faculty' }, {}, 403],
    [{ gates: { afcBatch: true } }, {}, 503],
    [{ gates: { afcFormUpload: true } }, {}, 503],
    [{}, { json: () => { throw Error('malformed'); } }, 400],
    [{}, { record: 'invalid' }, 400],
    ...Object.keys(payload).map(key => [{}, { body: { ...payload, [key]: 'invalid' } }, 400])
  ]) {
    const { call, queries } = fixture(config);
    const res = await call(options);
    assert.equal(res.status, status);
    assert.equal(queries.length, 0);
    assert.equal(res.headers['Cache-Control'], 'private, no-store');
  }
});

test('association exposes scoped SQL outcomes without disclosing SQL or archive data', async () => {
  for (const [number, status] of [[57101,403],[57102,404],[57103,404],[57104,409],[57105,400],[50000,503]]) {
    const { call } = fixture({ query: async () => { throw Object.assign(Error('private SQL diagnostic'), { number }); } });
    const res = await call();
    assert.equal(res.status, status);
    assert.doesNotMatch(JSON.stringify(res.jsonBody), /private SQL diagnostic/);
  }
  for (const rows of [[], [{ afcRecordId: document, facultyId: faculty, documentId: document }]]) {
    const { call } = fixture({ query: async () => rows });
    assert.equal((await call()).status, 503);
  }
});

test('administrator AFC list enables late attachment only for eligible rows with both permissions', async () => {
  const { createSqlDashboardRepository } = require('../src/data/sql-dashboard-repository');
  const rows = [
    { afcRecordId: record, sourceKind: 'manual', active: 1, canAttachBatchOriginal: 1 },
    { afcRecordId: document, sourceKind: 'manual', active: 1, documentId: document, canAttachBatchOriginal: 0 },
    { afcRecordId: faculty, sourceKind: 'import', active: 1, canAttachBatchOriginal: 0 }
  ];
  for (const [role, gates, expected] of [
    ['owner', enabled, [true, false, false]],
    ['administrator', { afcBatch: true }, [false, false, false]],
    ['administrator', { afcFormUpload: true }, [false, false, false]],
    ['faculty', enabled, null]
  ]) {
    const queries = [];
    const api = createDashboardApi({
      verifyToken: async () => ({ uid: 'verified' }),
      findUser: async () => ({ active: true, facultyId: faculty, baseRole: role }),
      writeGates: gates,
      repository: createSqlDashboardRepository({ query: async sql => { queries.push(sql); return rows; } })
    });
    const res = await api.afcRecords('token');
    if (expected) {
      assert.equal(res.status, 200);
      assert.deepEqual(res.body.afcRecords.map(row => row.canAttachBatchOriginal), expected);
      assert.match(queries[0], /LEFT JOIN paws\.vAfcBatchOriginalEligible eligible ON u\.SourceKind=N'manual' AND eligible\.AfcRecordId=u\.AfcRecordId AND eligible\.FacultyId=u\.FacultyId/);
      assert.match(queries[0], /eligible\.AfcRecordId IS NOT NULL AND original\.DocumentId IS NULL/);
      assert.doesNotMatch(JSON.stringify(res.body), /batchRequestId/i);
    } else {
      assert.equal(res.status, 403);
      assert.equal(queries.length, 0);
    }
  }
});
