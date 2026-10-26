'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {execFileSync, spawnSync} = require('node:child_process');

function repository(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'paws-language-audit-'));
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  fs.mkdirSync(path.join(root, 'tools'));
  fs.copyFileSync(path.join(__dirname, '../tools/audit-language.js'), path.join(root, 'tools/audit-language.js'));
  execFileSync('git', ['init', '--quiet'], {cwd: root});
  execFileSync('git', ['config', 'core.autocrlf', 'false'], {cwd: root});
  return {
    add(name, content) {
      fs.writeFileSync(path.join(root, name), content);
      execFileSync('git', ['add', '--', name], {cwd: root});
    },
    remove(name) { fs.unlinkSync(path.join(root, name)); },
    audit(...args) {
      const result = spawnSync(process.execPath, ['tools/audit-language.js', '--json', ...args], {cwd: root, encoding: 'utf8'});
      return {status: result.status, report: JSON.parse(result.stdout)};
    }
  };
}

test('language inventory includes tracked text regardless of extension and full Han Unicode', t => {
  const repo = repository(t);
  for (const name of ['Dockerfile', 'startup.sh', 'recovery.psm1', 'firestore.rules', 'screen.tsx']) repo.add(name, '# 中文\n');
  repo.add('rare.txt', '\u{20000}\n');
  repo.add('payload.bin', Buffer.from([0, 255, 1, 2]));
  const {status, report} = repo.audit();
  assert.equal(status, 0);
  assert.deepEqual(report.findings.map(item => item.file).sort(), ['Dockerfile', 'firestore.rules', 'rare.txt', 'recovery.psm1', 'screen.tsx', 'startup.sh'].sort());
  assert.equal(report.scanned, 6);
  assert.equal(report.skippedBinary, 1);
  assert.equal(repo.audit('--fail-on-cjk').status, 1);
});

test('language inventory fails visibly when a tracked file cannot be read', t => {
  const repo = repository(t);
  repo.add('missing.md', 'English text');
  repo.remove('missing.md');
  const {status, report} = repo.audit();
  assert.equal(status, 1);
  assert.equal(report.scanned, 0);
  assert.equal(report.errors[0].file, 'missing.md');
  assert.equal(report.errors[0].code, 'ENOENT');
});
