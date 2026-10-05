'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const script = fs.readFileSync(path.join(__dirname, '..', '..', 'tools', 'import-doe-faculty-snapshot.ps1'), 'utf8');

test('DOE importer reconciles exact UCID and treats name only as a mismatch guard without emitting identities', () => {
  assert.match(script, /Normalize-Ucid/);
  assert.match(script, /Normalize-Name/);
  assert.match(script, /databaseByUcid/);
  assert.match(script, /\$candidates\s*=\s*\[object\[\]\]/);
  assert.match(script, /sourceName -and \$databaseName -and \$sourceName -ne \$databaseName/);
  assert.match(script, /EXACT_ACTIVE_MATCHES/);
  assert.match(script, /EXACT_INACTIVE_MATCHES/);
  assert.match(script, /NO_MATCH/);
  assert.match(script, /CONFLICTS/);
  assert.match(script, /DUPLICATE_DATABASE_UCID/);
  assert.match(script, /NAME_MISMATCH/);
  assert.match(script, /NAME_COMMA_ORDER_VARIANT/);
  assert.match(script, /NAME_PUNCTUATION_VARIANT/);
  assert.match(script, /COMPUTERNAME.*ITAPPVETOPSDB01/s);
  assert.match(script, /\$TargetHost\s*=\s*'ITAPPVETOPSDB01'/i);
  assert.match(script, /Server=lpc:\$TargetHost/i);
  assert.doesNotMatch(script, /TrustServerCertificate\s*=\s*True|Server=tcp:/i);
  assert.match(script, /DOE_SOURCE_PRESENT/);
  assert.match(script, /DOE_SOURCE_MISSING/);
  assert.match(script, /\$noMatch\s*-ne\s*0/);
  assert.match(script, /\$exactInactive\s*-ne\s*0/);
  assert.match(script, /\$exactActive\s*-ne\s*@\(\$payload\.sourceRows\)\.Count/);
  assert.doesNotMatch(script, /Write-Host|Write-Output\s+\$faculty|ConvertTo-Json\s+-Depth\s+10/);
});

test('DOE importer permits Apply only after zero-conflict validation and uses one parameterized transaction', () => {
  const gate = script.indexOf("if ($conflicts -ne 0 -or $inputErrors -ne 0 -or $noMatch -ne 0");
  const transaction = script.indexOf('BEGIN TRANSACTION;', gate);
  assert.ok(gate >= 0 && transaction > gate);
  assert.match(script, /BEGIN TRANSACTION;[\s\S]*?COMMIT TRANSACTION;[\s\S]*?ROLLBACK TRANSACTION;/);
  assert.match(script, /Parameters\.Add\(\$spec\.Name, \$spec\.Type, \$spec\.Size\)/);
  assert.match(script, /OPENJSON\(@ImportJson, '\$\.targets'\)/);
  assert.match(script, /OPENJSON\(@ImportJson, '\$\.allocations'\)/);
  assert.match(script, /ActiveTeachingTargets/);
  assert.match(script, /ActiveAllocations/);
  assert.match(script, /existing 2026-27 active DOE data requires a reviewed before-state reconciliation/);
});
