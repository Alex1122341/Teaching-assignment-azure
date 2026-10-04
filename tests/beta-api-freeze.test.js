'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const freeze = require('../tools/beta-api-freeze');
const staticFreeze = require('../tools/beta-freeze');

const files = ['server/src/a.js', 'swa-api/index.js'];
const buildDefinitions = ['deploy/aca/Dockerfile'];
const repositoryInputs = ['server/package.json', 'server/package-lock.json'];
const baseline = {
  'server/src/a.js': Buffer.from('const a = 1;\n'),
  'swa-api/index.js': Buffer.from('const index = 1;\n'),
  'deploy/aca/Dockerfile': Buffer.from('FROM reviewed\n'),
  'server/package.json': Buffer.from('{"dependencies":{"pdf-lib":"1.17.1"}}\n'),
  'server/package-lock.json': Buffer.from('{"packages":{"":{"dependencies":{"pdf-lib":"1.17.1"}}}}\n')
};

function verify(current = baseline, options = {}) {
  return freeze.verifyFreeze({
    root,
    baselineCommit: 'test-baseline',
    skipCommitCheck: true,
    files,
    buildDefinitionFiles: buildDefinitions,
    repositoryInputFiles: repositoryInputs,
    readBaselineFile: ({ file }) => {
      if (!Object.prototype.hasOwnProperty.call(baseline, file)) throw new Error('missing baseline');
      return baseline[file];
    },
    readWorking: ({ file }) => {
      if (!Object.prototype.hasOwnProperty.call(current, file)) throw new Error('missing');
      return current[file];
    },
    ...options
  });
}

function makeArtifact(contents = baseline, extra = []) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'paws-api-freeze-'));
  for (const file of files) {
    const destination = path.join(directory, freeze.artifactRuntimeName(file));
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, contents[file]);
  }
  for (const file of extra) {
    const destination = path.join(directory, file);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, 'extra');
  }
  const inventory = [...files.map(freeze.artifactRuntimeName), ...extra].sort();
  fs.writeFileSync(path.join(directory, 'artifact-inventory.json'), JSON.stringify(inventory, null, 2) + '\n');
  return directory;
}

test('API freeze shares the static immutable baseline and protects the complete current runtime', () => {
  assert.equal(freeze.BASELINE_COMMIT, staticFreeze.BASELINE_COMMIT);
  assert.equal(freeze.currentRuntimeFiles({ root }).length, 32);
  assert.ok(freeze.currentRuntimeFiles({ root }).includes('server/src/data/sql-doe-target-repository.js'));
  assert.ok(freeze.currentRuntimeFiles({ root }).includes('server/src/afc/afc-request-api.js'));
  assert.ok(freeze.currentRuntimeFiles({ root }).includes('server/src/afc/afc-approval-api.js'));
  assert.ok(freeze.currentRuntimeFiles({ root }).includes('server/src/afc/afc-approved-artifact-api.js'));
  assert.ok(freeze.currentRuntimeFiles({ root }).includes('server/src/afc/afc-approved-artifact-renderer.js'));
  assert.ok(freeze.currentRuntimeFiles({ root }).includes('server/src/data/sql-afc-artifact-repository.js'));
  assert.ok(freeze.currentRuntimeFiles({ root }).includes('server/src/runtime/swa-afc-artifact-functions.js'));
  assert.ok(freeze.currentRuntimeFiles({ root }).includes('server/src/afc/assets/absence-from-campus-app.pdf'));
  assert.ok(freeze.currentRuntimeFiles({ root }).includes('server/src/data/sql-afc-request-repository.js'));
  assert.ok(freeze.currentRuntimeFiles({ root }).includes('server/src/data/sql-afc-approval-repository.js'));
  assert.ok(freeze.currentRuntimeFiles({ root }).includes('server/src/runtime/swa-afc-request-functions.js'));
  assert.deepEqual(freeze.BUILD_DEFINITION_FILES, ['deploy/aca/Dockerfile']);
  assert.deepEqual(freeze.REPOSITORY_INPUT_FILES, repositoryInputs);
});

test('unchanged API source and Dockerfile pass against the matching baseline', () => {
  assert.equal(verify().ok, true);
});

test('changed server runtime file is detected', () => {
  const current = { ...baseline, 'server/src/a.js': Buffer.from('changed') };
  assert.deepEqual(verify(current).drift, [{ surface: 'runtime', file: 'server/src/a.js', reason: 'content-drift' }]);
});

test('changed swa-api index is detected', () => {
  const current = { ...baseline, 'swa-api/index.js': Buffer.from('changed') };
  assert.deepEqual(verify(current).drift, [{ surface: 'runtime', file: 'swa-api/index.js', reason: 'content-drift' }]);
});

test('new and removed server runtime files fail closed', () => {
  const added = verify(baseline, { files: [...files, 'server/src/new.js'] });
  assert.ok(added.drift.some(item => item.file === 'server/src/new.js' && item.reason === 'missing-at-baseline'));
  const removed = verify({ 'swa-api/index.js': baseline['swa-api/index.js'], 'deploy/aca/Dockerfile': baseline['deploy/aca/Dockerfile'] });
  assert.ok(removed.drift.some(item => item.file === 'server/src/a.js' && item.reason === 'missing-in-verified-copy'));
});

test('Dockerfile drift is detected separately from API source drift', () => {
  const current = { ...baseline, 'deploy/aca/Dockerfile': Buffer.from('FROM unreviewed\n') };
  assert.deepEqual(verify(current).drift, [{ surface: 'buildDefinition', file: 'deploy/aca/Dockerfile', reason: 'content-drift' }]);
});

test('server package manifests and lockfile are frozen repository inputs, not duplicate SWA artifact files', () => {
  const current = { ...baseline, 'server/package-lock.json': Buffer.from('changed lock') };
  assert.deepEqual(verify(current).drift, [
    { surface: 'repositoryInput', file: 'server/package-lock.json', reason: 'content-drift' }
  ]);
  const artifact = makeArtifact();
  try {
    const result = verify(baseline, { artifact });
    assert.equal(result.ok, true);
    assert.equal(result.runtimeFiles.length, 2);
    assert.equal(result.repositoryInputFiles.length, 2);
    assert.equal(result.protected, 5);
    assert.equal(fs.existsSync(path.join(artifact, 'server/package.json')), false);
  } finally { fs.rmSync(artifact, { recursive: true, force: true }); }
});

test('line-ending normalization does not create false repository drift', () => {
  const current = { ...baseline, 'server/src/a.js': Buffer.from('const a = 1;\r\n') };
  assert.equal(verify(current).ok, true);
});

test('artifact with unchanged files and accurate inventory passes', () => {
  const artifact = makeArtifact();
  try {
    assert.equal(verify(baseline, { artifact }).ok, true);
  } finally { fs.rmSync(artifact, { recursive: true, force: true }); }
});

test('artifact missing, changed, unexpected, and inventory mismatch are detected', () => {
  const missing = makeArtifact();
  fs.rmSync(path.join(missing, 'server/src/a.js'));
  try { assert.ok(verify(baseline, { artifact: missing }).drift.some(item => item.reason === 'missing-in-verified-copy')); }
  finally { fs.rmSync(missing, { recursive: true, force: true }); }

  const changed = makeArtifact({ ...baseline, 'swa-api/index.js': Buffer.from('changed') });
  try { assert.ok(verify(baseline, { artifact: changed }).drift.some(item => item.file === 'index.js' && item.reason === 'content-drift')); }
  finally { fs.rmSync(changed, { recursive: true, force: true }); }

  const extra = makeArtifact(baseline, ['unexpected.js']);
  try { assert.ok(verify(baseline, { artifact: extra }).drift.some(item => item.reason === 'unexpected-artifact-file')); }
  finally { fs.rmSync(extra, { recursive: true, force: true }); }

  const inventory = makeArtifact();
  fs.writeFileSync(path.join(inventory, 'artifact-inventory.json'), '[]\n');
  try { assert.ok(verify(baseline, { artifact: inventory }).drift.some(item => item.reason === 'artifact-inventory-mismatch')); }
  finally { fs.rmSync(inventory, { recursive: true, force: true }); }
});

test('artifact line endings remain canonicalized and Dockerfile stays repository-only', () => {
  const artifact = makeArtifact({ ...baseline, 'server/src/a.js': Buffer.from('const a = 1;\r\n') });
  try {
    const result = verify(baseline, { artifact });
    assert.equal(result.ok, true);
    assert.equal(result.drift.some(item => item.file === 'Dockerfile'), false);
  } finally { fs.rmSync(artifact, { recursive: true, force: true }); }
});
