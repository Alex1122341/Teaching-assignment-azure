'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildSqlConnectionConfig, createSqlConnection } = require('../src/data/sql-connection');

const endpoint = 'Server=tcp:sql.example.test,1433;Database=teaching-assignment-lab;Encrypt=true;TrustServerCertificate=false;';

test('managed identity mode builds an Azure AD default configuration', () => {
  const config = buildSqlConnectionConfig({
    connectionString: endpoint,
    miClientId: '00000000-0000-4000-8000-000000000001'
  });

  assert.equal(config.server, 'sql.example.test');
  assert.equal(config.port, 1433);
  assert.equal(config.database, 'teaching-assignment-lab');
  assert.deepEqual(config.authentication, {
    type: 'azure-active-directory-default',
    options: { clientId: '00000000-0000-4000-8000-000000000001' }
  });
  assert.equal(config.options.encrypt, true);
  assert.equal(config.options.trustServerCertificate, false);
});

test('managed identity mode rejects password-bearing endpoint configuration', () => {
  assert.throws(
    () => buildSqlConnectionConfig({
      connectionString: `${endpoint}User ID=legacy;Password=secret;`,
      miClientId: '00000000-0000-4000-8000-000000000001'
    }),
    /must not contain SQL credentials/i
  );
});

test('managed identity mode fails closed when endpoint configuration is incomplete', () => {
  assert.throws(
    () => buildSqlConnectionConfig({
      connectionString: 'Database=teaching-assignment-lab;',
      miClientId: '00000000-0000-4000-8000-000000000001'
    }),
    /server.*database/i
  );
});

test('managed identity mode rejects a malformed client ID', () => {
  assert.throws(
    () => buildSqlConnectionConfig({ connectionString: endpoint, miClientId: 'not-a-guid' }),
    /PAWS_SQL_MI_CLIENT_ID must be a UUID/i
  );
});

test('legacy mode preserves the original connection string', () => {
  assert.equal(buildSqlConnectionConfig({ connectionString: endpoint }), endpoint);
});

test('connection pool receives the managed identity configuration', async () => {
  let received;
  const sql = {
    ConnectionPool: class {
      constructor(config) { received = config; }
      async connect() { return this; }
      request() { return { input() {}, async query() { return { recordset: [] }; } }; }
    }
  };
  await createSqlConnection({
    connectionString: endpoint,
    miClientId: '00000000-0000-4000-8000-000000000001',
    sql
  }).query('SELECT 1');
  assert.equal(received.authentication.options.clientId, '00000000-0000-4000-8000-000000000001');
  assert.equal(received.options.encrypt, true);
});

test('missing SQL endpoint configuration fails closed', () => {
  assert.throws(
    () => buildSqlConnectionConfig({ miClientId: '00000000-0000-4000-8000-000000000001' }),
    /PAWS_SQL_CONNECTION_STRING is required/
  );
});
