'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const script=path.resolve(__dirname,'../../tools/test-account-access-sql.ps1');
const pwsh=process.env.PAWS_PWSH_PATH||'pwsh';

test('access SQL acceptance refuses a production server before resolving Docker or opening SQL',t=>{
 const result=spawnSync(pwsh,['-NoProfile','-NonInteractive','-File',script,'-ContainerName','ITAPPVETOPSDB01'],{encoding:'utf8',timeout:15000});
 if(result.error?.code==='ENOENT'){t.skip('PowerShell unavailable for guarded-tool probe');return;}
 assert.notEqual(result.status,0);assert.match(result.stdout+result.stderr,/DISPOSABLE_SQL_REQUIRED/);
});
