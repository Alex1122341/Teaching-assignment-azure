'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const contract = require('./fixtures/w1e-runtime-permission-contract.json');
const migration = fs.readFileSync(path.join(root, 'database/azure-sql/017_w1e_runtime_least_privilege.sql'), 'utf8');
const p2Migration = fs.readFileSync(path.join(root, 'database/azure-sql/022_teaching_assignment_workflow_permissions.sql'), 'utf8');
const p4Migration = fs.readFileSync(path.join(root, 'database/azure-sql/027_doe_runtime_permissions.sql'), 'utf8') + '\n' + fs.readFileSync(path.join(root, 'database/azure-sql/028_doe_supervision_source.sql'), 'utf8');

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
  // The P2 repository funnels writes through a closed exec(name, params)
  // helper, so recover its statically declared procedure names as well.
  procedures.push(...[...sources.matchAll(/\bexec\(\s*'([A-Za-z0-9_]+)'/g)]
    .map(match => `paws_api.${match[1]}`));
  procedures.push(...[...sources.matchAll(/\brun\(\s*'(SetRoleAppointmentPeriods)'/g)]
    .map(match => `paws_api.${match[1]}`));
  const expectedObjects = [
    ...contract.readObjects, ...contract.p2ReadObjects, ...contract.p4ReadObjects, ...contract.manualReadObjects, ...contract.rolePeriodReadObjects, ...contract.rolePeriodWriteProcedures,
    ...contract.readProcedures, ...contract.p2ReadProcedures,
    ...Object.values(contract.writeSets).flat(), ...Object.values(contract.p2WriteSets).flat(),
    ...contract.outsideW1eWriteProcedures, ...contract.swapReadProcedures, ...Object.values(contract.swapWriteSets).flat()
  ];
  assert.deepEqual([...new Set(objects)].sort(), [...new Set([...contract.readObjects, ...contract.p2ReadObjects, ...contract.p4ReadObjects, ...contract.manualReadObjects, ...contract.rolePeriodReadObjects])].sort());
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
  for (const object of contract.p2ReadObjects) {
    assert.match(p2Migration, new RegExp(`GRANT SELECT ON OBJECT::${object.replace('.', '\\.')}\\s*\\([\\s\\S]*?\\)\\s*TO \\[paws_runtime_read\\]`, 'i'), object);
  }
  for (const procedure of contract.p2ReadProcedures) {
    assert.match(p2Migration, new RegExp(`GRANT EXECUTE ON OBJECT::${procedure.replace('.', '\\.')}\\s+TO \\[paws_runtime_read\\]`, 'i'), procedure);
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

test('P2 permissions add exact workflow reads and gate-specific procedure execution without broad grants', () => {
  const roleByDomain = {
    taDraft: 'paws_runtime_ta_draft_write',
    taReview: 'paws_runtime_ta_review_write',
    taFinal: 'paws_runtime_ta_final_write',
    taPublish: 'paws_runtime_ta_publish_write'
  };
  for (const [domain, procedures] of Object.entries(contract.p2WriteSets)) {
    for (const procedure of procedures) {
      assert.match(p2Migration, new RegExp(`GRANT EXECUTE ON OBJECT::${procedure.replace('.', '\\.')}\\s+TO \\[${roleByDomain[domain]}\\]`, 'i'));
    }
  }
  assert.match(p2Migration, /IF\s+DB_NAME\(\)\s*<>\s*N'VetMed-Ops'[\s\S]*?THROW/i);
  assert.match(p2Migration, /BEGIN\s+TRANSACTION[\s\S]*?COMMIT\s+TRANSACTION/i);
  assert.match(p2Migration, /sys\.database_permissions/i);
  assert.doesNotMatch(p2Migration, /GRANT\s+(?:INSERT|UPDATE|DELETE)\s+ON\s+(?:OBJECT|SCHEMA)::/i);
  assert.doesNotMatch(p2Migration, /GRANT\s+EXECUTE\s+ON\s+SCHEMA::/i);
  assert.doesNotMatch(p2Migration, /CREATE\s+USER\s+\[|ADD\s+MEMBER|ALTER\s+ROLE/i);
  assert.doesNotMatch(p2Migration, /(?:GRANT|ALTER\s+ROLE)[\s\S]{0,120}(?:db_owner|CONTROL\s+DATABASE|sysadmin)/i);
});

test('P4 permissions are VetMed-Ops guarded, use separate empty operation roles, and cover normalized DOE reads', () => {
  assert.match(p4Migration, /DB_NAME\(\)\s*<>\s*N'VetMed-Ops'[\s\S]*?THROW/i);
  for (const object of contract.p4ReadObjects) {
    assert.match(p4Migration, new RegExp(`GRANT SELECT ON OBJECT::${object.replace('.', '\\.')}\\s+TO \\[paws_runtime_read\\]`, 'i'), object);
  }
  for (const [role, gates] of [
    ['paws_runtime_doe_admin_write', /PAWS_DOE_ADMIN_WRITE_ENABLED/],
    ['paws_runtime_doe_policy_publish', /PAWS_DOE_POLICY_PUBLISH_ENABLED/],
    ['paws_runtime_doe_recalculate', /PAWS_DOE_RECALC_WRITE_ENABLED/]
  ]) {
    assert.match(p4Migration, new RegExp(`CREATE ROLE \\[${role}\\]`, 'i'));
    assert.match(p4Migration, new RegExp(`DATABASE_PRINCIPAL_ID\\(N'${role}'\\)`, 'i'));
    assert.ok(gates, 'application write gate must be separately configured');
  }
  assert.match(p4Migration, /DOE write roles must remain empty/i);
  assert.doesNotMatch(p4Migration, /CREATE\\s+USER\\s+\\[|ALTER\\s+ROLE[\\s\\S]*ADD\\s+MEMBER|GRANT\\s+CONTROL/i);
});
