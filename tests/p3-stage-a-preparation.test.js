'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildCandidate } = require('../tools/p3-stage-a/build-candidate');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

function createFixture() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'p3-stage-a-repo-'));
  const write = (relative, content) => {
    const target = path.join(repo, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  };
  write('server/package.json', JSON.stringify({
    name: 'paws-beta-sql-runtime',
    engines: { node: '22.x' },
    dependencies: { 'pdf-lib': '1.17.1' },
  }));
  write('server/package-lock.json', JSON.stringify({
    packages: {
      '': { dependencies: { 'pdf-lib': '1.17.1' } },
      'node_modules/pdf-lib': { version: '1.17.1' },
    },
  }));
  write('server/src/runtime/university-api.js', 'module.exports = {};\n');
  write('server/src/data/sql-afc-request-repository.js', 'module.exports = {};\n');
  write('server/src/data/sql-afc-approval-repository.js', 'module.exports = {};\n');
  write('server/src/data/sql-afc-artifact-repository.js', 'module.exports = {};\n');
  write('server/src/afc/afc-request-api.js', 'module.exports = {};\n');
  write('server/src/afc/afc-approval-api.js', 'module.exports = {};\n');
  write('server/src/afc/afc-approved-artifact-api.js', 'module.exports = {};\n');
  write('server/src/afc/afc-approved-artifact-renderer.js', 'module.exports = {};\n');
  write('server/src/afc/assets/absence-from-campus-app.pdf', '%PDF fixture');
  write('server/.env', 'secret=must-not-ship');
  write('server/src/auth/service-account.json', '{"private_key":"must-not-ship"}');
  write('server/node_modules/not-runtime.js', 'must-not-ship');
  return { repo, write };
}

test('candidate inventory is deterministic, pinned to Node 22/pdf-lib, and excludes secrets', () => {
  const first = createFixture();
  const second = createFixture();
  const firstOutput = path.join(os.tmpdir(), `p3-stage-a-out-${process.pid}-${Date.now()}`);
  const secondOutput = path.join(os.tmpdir(), `p3-stage-a-out-${process.pid}-${Date.now()}-second`);
  try {
    const a = buildCandidate({ repoRoot: first.repo, outputDir: firstOutput, baseSha: 'b6e74ff5ff34ef5f3b2541f8a3528341ff38f943' });
    const b = buildCandidate({ repoRoot: second.repo, outputDir: secondOutput, baseSha: 'b6e74ff5ff34ef5f3b2541f8a3528341ff38f943' });
    assert.equal(a.digest, b.digest);
    assert.match(a.digest, /^[0-9a-f]{64}$/);
    assert.equal(a.nodeVersion, '22.x');
    assert.equal(a.pdfLibVersion, '1.17.1');
    assert.ok(a.files.includes('server/src/runtime/university-api.js'));
    assert.ok(a.files.includes('server/src/afc/assets/absence-from-campus-app.pdf'));
    assert.ok(!a.files.some(file => /(^|\/)(\.env|node_modules|service-account\.json)(\/|$)/i.test(file)));
    assert.equal(fs.existsSync(path.join(firstOutput, 'server', 'src', 'runtime', 'university-api.js')), true);
  } finally {
    for (const fixture of [first, second]) fs.rmSync(fixture.repo, { recursive: true, force: true });
    for (const output of [firstOutput, secondOutput]) fs.rmSync(output, { recursive: true, force: true });
  }
});

test('deployment artifact is opt-in, checks exact package and Node 22, and guards rollback', () => {
  const script = read('tools/p3-stage-a/Deploy-UniversityRuntimeStageA.ps1');
  assert.match(script, /\[switch\]\s*\$Apply/i);
  assert.match(script, /ExpectedPackageSha256/i);
  assert.match(script, /22\.x|Major\s*-eq\s*22/i);
  assert.match(script, /backup|rollback/i);
  assert.match(script, /Start-Process|restart|smoke/i);
  assert.match(script, /configuration|\.env/i);
  assert.match(script, /TrustServerCertificate|PAWS_SQL_ALLOW_SELF_SIGNED/i);
});

test('Stage A runbook defines every A0-A8 gate and keeps stable ingress separate from temporary Beta access', () => {
  const runbook = read('tools/p3-stage-a/RUNBOOK.md');
  for (let i = 0; i <= 8; i++) assert.match(runbook, new RegExp(`A${i}\\b`));
  assert.match(runbook, /PASS/i);
  assert.match(runbook, /STOP/i);
  assert.match(runbook, /ROLLBACK/i);
  assert.match(runbook, /forward[- ]recovery/i);
  assert.match(runbook, /loopback|VPN/i);
  assert.match(runbook, /stable public ingress[\s\S]*HOLD|HOLD[\s\S]*stable public ingress/i);
  assert.match(runbook, /temporary Quick Tunnel/i);
  assert.match(runbook, /immutable|preserv/i);
});
