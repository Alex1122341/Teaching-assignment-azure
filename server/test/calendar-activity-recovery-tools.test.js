'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..');
const shell=process.platform==='win32'?'powershell.exe':'pwsh';
test('recovery tools reject an artifact anywhere inside the source tree before opening SQL',()=>{
 const script=path.join(root,'tools/export_calendar_activity_recovery.ps1');assert.ok(fs.existsSync(script),'Export script exists');
 const result=spawnSync(shell,['-NoProfile','-File',script,'-ActorFirebaseUid','synthetic','-ReceiptId','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','-Path',path.join(root,'output/forbidden-recovery.json')],{encoding:'utf8'});
 assert.notEqual(result.status,0);assert.match(result.stderr,/outside the repository/);assert.doesNotMatch(result.stderr,/connection string/);
});
test('recovery verifies UTF-16LE content hash before any SQL connection',()=>{
 const script=path.join(root,'tools/recover_calendar_activity_import.ps1');assert.ok(fs.existsSync(script),'Recovery script exists');
 const file=path.join(require('node:os').tmpdir(),'calendar-recovery-synthetic-'+process.pid+'.json');
 fs.writeFileSync(file,Buffer.from('{"receiptId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}','utf16le'));
 try{const result=spawnSync(shell,['-NoProfile','-File',script,'-ActorFirebaseUid','synthetic','-ReceiptId','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','-Path',file,'-ExpectedSha256','0'.repeat(64),'-ConfirmRecovery'],{encoding:'utf8'});assert.notEqual(result.status,0);assert.match(result.stderr,/artifact hash/);assert.doesNotMatch(result.stderr,/connection string/);}finally{fs.unlinkSync(file);}
});
