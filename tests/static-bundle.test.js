'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildStaticBundle } = require('../tools/build/static-bundle');
const { assetSourcePath, frontendRelativePath, repositoryPath, ROOT } = require('../tools/build/frontend-paths');

function fixture(t, manifest = ['index.html', 'app.js']) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'paws-static-layout-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'tools'), { recursive: true });
  fs.writeFileSync(path.join(root, 'tools/static-assets.json'), JSON.stringify(manifest));
  for (const asset of ['index.html', 'app.js']) {
    const file = assetSourcePath(root, asset);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, asset === 'index.html' ? '<script src="app.js"></script>' : 'globalThis.ready = true;');
  }
  return root;
}

function previousArtifact(root) {
  const output = path.join(root, '.deploy-static');
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, 'keep.txt'), 'previous accepted artifact');
  return output;
}

function assertPreserved(output) {
  assert.equal(fs.readFileSync(path.join(output, 'keep.txt'), 'utf8'), 'previous accepted artifact');
}

test('source locations are descriptive while public names stay unchanged', () => {
  assert.equal(frontendRelativePath('index.html'), 'frontend/pages/index.html');
  assert.equal(frontendRelativePath('timetable.js'), 'frontend/scripts/timetable.js');
  assert.equal(frontendRelativePath('timetable.css'), 'frontend/styles/timetable.css');
  assert.equal(frontendRelativePath('absence-from-campus-app.pdf'), 'frontend/assets/absence-from-campus-app.pdf');
  assert.equal(repositoryPath(ROOT, 'timetable.js'), assetSourcePath(ROOT, 'timetable.js'));
  assert.equal(repositoryPath(ROOT, 'server/package.json'), path.join(ROOT, 'server/package.json'));
});

test('shared builder emits only declared assets and is repeatable', t => {
  const root = fixture(t);
  fs.writeFileSync(path.join(root, 'frontend/scripts/private.txt'), 'do not publish');
  const first = buildStaticBundle({ root });
  assert.deepEqual(fs.readdirSync(first.output).sort(), ['app.js', 'index.html']);
  assert.equal(first.files, 2);
  for (const asset of ['app.js', 'index.html']) assert.deepEqual(fs.readFileSync(path.join(first.output, asset)), fs.readFileSync(assetSourcePath(root, asset)));
  fs.writeFileSync(path.join(first.output, 'stale.txt'), 'stale');
  assert.deepEqual(buildStaticBundle({ root }), first);
  assert.equal(fs.existsSync(path.join(first.output, 'stale.txt')), false);
  const combined = buildStaticBundle({ root, output: path.join(root, '.azure-production/app') });
  for (const asset of ['app.js', 'index.html']) assert.deepEqual(fs.readFileSync(path.join(first.output, asset)), fs.readFileSync(path.join(combined.output, asset)));
});

test('missing source fails before deleting the previous artifact', t => {
  const root = fixture(t);
  const output = previousArtifact(root);
  fs.unlinkSync(assetSourcePath(root, 'app.js'));
  assert.throws(() => buildStaticBundle({ root }), /Required static asset is missing/);
  assertPreserved(output);
});

test('malformed or duplicate manifests fail before deleting artifacts', t => {
  for (const manifest of [[], ['index.html', 'index.html'], ['../escape.js'], ['a/b.js'], ['C:\\escape.js'], ['.env'], [null], ['unknown.exe']]) {
    const root = fixture(t, manifest);
    const output = previousArtifact(root);
    assert.throws(() => buildStaticBundle({ root }), /manifest|Unsafe|Unsupported/);
    assertPreserved(output);
  }
});

test('an unapproved output cannot delete the repository or another folder', t => {
  const root = fixture(t);
  for (const output of [root, path.join(root, 'frontend'), path.join(root, '..', 'outside')]) {
    assert.throws(() => buildStaticBundle({ root, output }), /approved artifact directory/);
  }
  assert.ok(fs.existsSync(assetSourcePath(root, 'index.html')));
});

test('symlink source and output escapes fail closed', t => {
  const root = fixture(t);
  const external = fs.mkdtempSync(path.join(os.tmpdir(), 'paws-static-outside-'));
  t.after(() => fs.rmSync(external, { recursive: true, force: true }));
  fs.writeFileSync(path.join(external, 'secret.js'), 'not public');
  const target = assetSourcePath(root, 'app.js');
  fs.unlinkSync(target);
  try { fs.symlinkSync(path.join(external, 'secret.js'), target); }
  catch (error) { if (['EPERM', 'EACCES'].includes(error.code)) { t.skip('Host does not allow symlink creation; Linux CI exercises this guard.'); return; } throw error; }
  assert.throws(() => buildStaticBundle({ root }), /symbolic link/);
  fs.unlinkSync(target);
  fs.writeFileSync(target, 'safe');
  fs.symlinkSync(external, path.join(root, '.deploy-static'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => buildStaticBundle({ root }), /symbolic link/);
  assert.equal(fs.readFileSync(path.join(external, 'secret.js'), 'utf8'), 'not public');
});


test('combined build rejects missing source before removing a previous release', t => {
  const root = fixture(t);
  const output = path.join(root, '.azure-production');
  fs.mkdirSync(output, { recursive: true });
  const receipt = path.join(output, 'previous-release.txt');
  fs.writeFileSync(receipt, 'accepted release');
  fs.unlinkSync(assetSourcePath(root, 'app.js'));
  const entry = fs.readFileSync(path.join(ROOT, 'tools/build-beta-release.js'), 'utf8');
  const vm = require('node:vm');
  const context = {
    process: { execPath: process.execPath }, console,
    require(name) {
      if (name === './build/frontend-paths') return { ROOT: root };
      if (name === './build/static-bundle') return require('../tools/build/static-bundle');
      return require(name);
    }
  };
  assert.throws(() => vm.runInNewContext(entry, context), /Required static asset is missing/);
  assert.equal(fs.existsSync(receipt), true, 'validation must happen before deleting release output');
  assert.equal(fs.readFileSync(receipt, 'utf8'), 'accepted release');
});


test('release source lookup follows each immutable Git revision rather than the working tree', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'paws-layout-history-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const { execFileSync } = require('node:child_process');
  const { sourcePathAtCommit } = require('../tools/build/frontend-paths');
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init');
  fs.writeFileSync(path.join(root, 'index.html'), 'original public page');
  git('add', '.');
  git('-c', 'user.name=PAWS Test', '-c', 'user.email=paws-test@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-m', 'historical root layout');
  const historical = git('rev-parse', 'HEAD');
  fs.mkdirSync(path.join(root, 'frontend/pages'), { recursive: true });
  fs.renameSync(path.join(root, 'index.html'), path.join(root, 'frontend/pages/index.html'));
  fs.writeFileSync(path.join(root, 'frontend/README.md'), 'Organized source layout');
  git('add', '-A');
  git('-c', 'user.name=PAWS Test', '-c', 'user.email=paws-test@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-m', 'organized layout');
  const organized = git('rev-parse', 'HEAD');
  fs.unlinkSync(path.join(root, 'frontend/README.md'));
  assert.equal(sourcePathAtCommit(root, historical, 'index.html'), 'index.html');
  assert.equal(sourcePathAtCommit(root, organized, 'index.html'), 'frontend/pages/index.html');
  assert.equal(sourcePathAtCommit(root, organized, 'server/package.json'), 'server/package.json');
  assert.equal(git('show', `${historical}:${sourcePathAtCommit(root, historical, 'index.html')}`), git('show', `${organized}:${sourcePathAtCommit(root, organized, 'index.html')}`));
});
