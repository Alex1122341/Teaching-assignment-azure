'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSqlConnection } = require('../src/data/sql-connection');

function fakeSql(log) {
  class Request {
    constructor() { this.inputs = {}; }
    input(name, value) { this.inputs[name] = value; return this; }
    async query(text) { log.push({ text, inputs: this.inputs }); return { recordset: [] }; }
  }
  class ConnectionPool { async connect() { return this; } request() { return new Request(); } }
  class Transaction { on() {} async begin() {} async commit() {} async rollback() {} }
  return { ConnectionPool, Transaction, Request, ISOLATION_LEVEL: { SERIALIZABLE: 'serializable' } };
}

test('support operation id is bound through a typed uniqueidentifier local that fails loudly when malformed', async () => {
  const log = [];
  const db = createSqlConnection({ connectionString: 'Server=x;Database=y;', sql: fakeSql(log) });
  const operationId = '3f0c9a52-7d1e-4b6a-9c2f-0a1b2c3d4e5f';
  await db.transaction(async () => { await db.query('SELECT 1 AS inside'); }, { supportOperationId: operationId });
  const inside = log.find(entry => entry.text.endsWith('SELECT 1 AS inside'));
  assert.ok(inside, 'support query issued');
  assert.equal(inside.inputs.pawsInternalSupportOperation, operationId);
  assert.match(inside.text, /^DECLARE @pawsInternalSupportOperationValue uniqueidentifier=CONVERT\(uniqueidentifier,@pawsInternalSupportOperation\);\nEXEC sys\.sp_set_session_context @key=N'paws_support_operation',@value=@pawsInternalSupportOperationValue;\n/);
  assert.doesNotMatch(inside.text, /TRY_CONVERT/);
});

test('queries outside a support operation clear the session context and bind no operation id', async () => {
  const log = [];
  const db = createSqlConnection({ connectionString: 'Server=x;Database=y;', sql: fakeSql(log) });
  await db.query('SELECT 2 AS outside');
  const outside = log.find(entry => entry.text.endsWith('SELECT 2 AS outside'));
  assert.equal(outside.text, "EXEC sys.sp_set_session_context @key=N'paws_support_operation',@value=NULL;\nSELECT 2 AS outside");
  assert.ok(!('pawsInternalSupportOperation' in outside.inputs));
  await assert.rejects(db.query('SELECT 3', { pawsInternalSupportOperation: 'x' }), /Reserved SQL parameter/);
});

test('support-service binds the operation id with CONVERT, not TRY_CONVERT', () => {
  const source = require('node:fs').readFileSync(require.resolve('../src/support/support-service'), 'utf8');
  assert.match(source, /DECLARE @opValue uniqueidentifier=CONVERT\(uniqueidentifier,@op\)/);
  assert.doesNotMatch(source, /TRY_CONVERT\(uniqueidentifier,@op\)/);
});
