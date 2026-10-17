'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process'),path=require('node:path');
test('PowerShell recovery decisions fail closed and distinguish API recovery from hostname recovery',()=>{
 const shell=process.platform==='win32'?'powershell.exe':'pwsh';
 const r=spawnSync(shell,['-NoProfile','-File',path.join(__dirname,'fixtures/startup-recovery-check.ps1')],{encoding:'utf8',timeout:30000});
 assert.equal(r.status,0,r.stdout+'\n'+r.stderr);assert.match(r.stdout,/RECOVERY_TESTS_OK/);
});
