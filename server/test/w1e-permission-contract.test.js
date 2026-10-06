'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const contract = require('./fixtures/w1e-runtime-permission-contract.json');
const migration = fs.readFileSync(path.join(root, 'database/azure-sql/017_w1e_runtime_least_privilege.sql'), 'utf8');

test('W1E permission contract covers every SQL repository object and stored procedure', () => {
  const repositoryDir = path.join(root, 'server/src/data');
  const sources = fs.readdirSync(repositoryDir)
    .filter(name => name.startsWith('sql-') && name.endsWith('.js'))
    .map(name => fs.readFileSync(path.join(repositoryDir, name), 'utf8'))
    .join('\n');
  const objects = [...sources.matchAll(/\b(?:FROM|JOIN|UPDATE|INTO|DELETE\s+FROM)\s+(paws(?:_api)?\.[A-Za-z0-9_]+)/gi)]
    .map(match => match[1]);
  const procedures = [...sources.matchAll(/(paws_api\.[A-Za-z0-9_]+)/g)]
    .map(match => match[1]);
  const expectedObjects = [...contract.readObjects, ...contract.readProcedures, ...Object.values(contract.writeSets).flat(), ...contract.outsideW1eWriteProcedures];
  assert.deepEqual([...new Set(objects)].sort(), [...new Set(contract.readObjects)].sort());
  assert.deepEqual([...new Set(procedures)].sort(), [...new Set(expectedObjects.filter(name => name.startsWith('paws_api.')))].sort());
});

test('base runtime role has only column-scoped reads and the two approved artifact reads', () => {
  for (const object of contract.readObjects) {
    if (object.startsWith('paws.v')) {
      assert.match(migration, new RegExp(`GRANT SELECT ON OBJECT::${object.replace('.', '\\.')}\\s*\\(`, 'i'), object);
    } else {
      assert.match(migration, new RegExp(`GRANT SELECT ON OBJECT::${object.replace('.', '\\.')}\\s*\\([\\s\\S]*?\\)\\s*TO \\[paws_runtime_read\\]`, 'i'), object);
    }
  }
  assert.match(migration, /paws\.Faculty\s*\([\s\S]*?FteSourceReference, FteSourceRow, FteSourceUpdatedAtUtc\)\s*TO \[paws_runtime_read\]/i);
  assert.match(migration, /paws\.vAfcRecordUnified\s*\([\s\S]*?Purpose, LegacyPurpose[\s\S]*?TO \[paws_runtime_read\]/i);
  for (const procedure of contract.readProcedures) {
    assert.match(migration, new RegExp(`GRANT EXECUTE ON OBJECT::${procedure.replace('.', '\\.')}\\s+TO \\[paws_runtime_read\\]`, 'i'), procedure);
  }
});

test('three W1C write sets remain separate and map to exact procedures only', () => {
  const roleByDomain = {
    afcSingle: 'paws_runtime_afc_single_write',
    afcBatch: 'paws_runtime_afc_batch_write',
    sessionEdit: 'paws_runtime_session_edit_write'
  };
  for (const [domain, procedures] of Object.entries(contract.writeSets)) {
    for (const procedure of procedures) {
      assert.match(migration, new RegExp(`GRANT EXECUTE ON OBJECT::${procedure.replace('.', '\\.')}\\s+TO \\[${roleByDomain[domain]}\\]`, 'i'));
    }
  }
  assert.match(migration, /PAWS_AFC_SINGLE_WRITE_ENABLED/);
  assert.match(migration, /PAWS_AFC_BATCH_WRITE_ENABLED/);
  assert.match(migration, /PAWS_SESSION_EDIT_WRITE_ENABLED/);
  assert.doesNotMatch(migration, /CREATE\s+USER\s+\[|GRANT\s+(?:INSERT|UPDATE|DELETE)\s+ON\s+OBJECT/i);
  assert.doesNotMatch(migration, /GRANT\s+EXECUTE\s+ON\s+SCHEMA::paws/i);
  assert.doesNotMatch(migration, /(?:CREATE\s+USER|ADD\s+MEMBER|TO\s*\[)\s*UC\\sa-xinyu\.zhu1/i);
  assert.doesNotMatch(migration, /(?:GRANT|ALTER\s+ROLE)[\s\S]{0,120}(?:db_owner|CONTROL\s+DATABASE|sysadmin)/i);
});

test('W1E artifact is guarded, rerunnable, and includes read-only postflight evidence', () => {
  assert.match(migration, /IF\s+DB_NAME\(\)\s*<>\s*N'VetMed-Ops'[\s\S]*?THROW/i);
  for (const role of ['paws_runtime_read', ...Object.values({
    a: 'paws_runtime_afc_single_write', b: 'paws_runtime_afc_batch_write', c: 'paws_runtime_session_edit_write'
  })]) {
    assert.match(migration, new RegExp(`DATABASE_PRINCIPAL_ID\\(N'${role}'\\) IS NULL`, 'i'));
  }
  assert.match(migration, /sys\.database_permissions/i);
  assert.match(migration, /ROLLBACK/i);
});

test('write permission sets stay separate and W1E never binds a runtime principal', () => {
  const roleGrants = [...migration.matchAll(/GRANT EXECUTE ON OBJECT::(paws_api\.[A-Za-z0-9_]+) TO \[(paws_runtime_[a-z_]+)\]/gi)]
    .map(match => [match[1], match[2]]);
  assert.deepEqual(roleGrants.sort(), [
    ['paws_api.CreateAfcManualBatch', 'paws_runtime_afc_batch_write'],
    ['paws_api.CreateAfcRecord', 'paws_runtime_afc_single_write'],
    ['paws_api.GetApprovedAfcArtifact', 'paws_runtime_read'],
    ['paws_api.GetApprovedAfcArtifactSource', 'paws_runtime_read'],
    ['paws_api.UpdateCalendarSession', 'paws_runtime_session_edit_write']
  ].sort());
  assert.doesNotMatch(migration, /ALTER\s+ROLE[\s\S]*?ADD\s+MEMBER|CREATE\s+USER\s+\[/i);
});
