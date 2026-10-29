'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const script=path.resolve(__dirname,'../../tools/test-account-access-sql.ps1');
const pwsh=process.env.PAWS_PWSH_PATH||'pwsh';

test('SQL060 refuses an existing feature principal before any schema mutation or permission grant',()=>{
 const fs=require('node:fs'),sql=fs.readFileSync(path.resolve(__dirname,'../../database/azure-sql/060_account_access.sql'),'utf8');
 const guard=sql.indexOf("IF DATABASE_PRINCIPAL_ID(N'paws_runtime_account_access') IS NOT NULL THROW 54000");
 assert.ok(guard>=0&&guard<sql.indexOf('BEGIN TRANSACTION;'));
 assert.doesNotMatch(sql,/IF DATABASE_PRINCIPAL_ID\(N'paws_runtime_account_access'\) IS NULL CREATE ROLE/);
 const acceptance=fs.readFileSync(script,'utf8');assert.match(acceptance,/EXISTING_PRINCIPAL_REFUSED/);assert.match(acceptance,/ADD MEMBER access060_collision_member/);
});

test('access SQL acceptance refuses a production server before resolving Docker or opening SQL',t=>{
 const result=spawnSync(pwsh,['-NoProfile','-NonInteractive','-File',script,'-ContainerName','ITAPPVETOPSDB01'],{encoding:'utf8',timeout:15000});
 if(result.error?.code==='ENOENT'){t.skip('PowerShell unavailable for guarded-tool probe');return;}
 assert.notEqual(result.status,0);assert.match(result.stdout+result.stderr,/DISPOSABLE_SQL_REQUIRED/);
});
