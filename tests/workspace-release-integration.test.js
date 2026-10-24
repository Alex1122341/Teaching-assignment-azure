'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync,spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),MAIN='8bb40c60370bcce3d0135efd4327d42fba657903',UI='138fdc14508496ff95f13ccc3a6726ea028e88ef';
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'});

test('workspace release preserves both accepted main and reviewed UI ancestry',()=>{
 for(const sha of [MAIN,UI])assert.equal(spawnSync('git',['merge-base','--is-ancestor',sha,'HEAD'],{cwd:root}).status,0,sha);
});

test('office UI release makes no API SQL dependency or permission change relative to integrated main',()=>{
 const changed=git('diff','--name-only',MAIN,'--','server','swa-api','database','firestore.rules','firestore.indexes.json','package.json','package-lock.json');
 assert.equal(changed.trim(),'');
});

test('current main role period serialization fix and SQL acceptance remain byte-identical',()=>{
 for(const file of ['frontend/scripts/faculty-role-periods.js','database/azure-sql/058_role_appointment_rowversion_hex.sql','database/azure-sql/058_role_appointment_rowversion_hex_acceptance.sql']){
  const current=fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n');
  assert.equal(current,git('show',MAIN+':'+file).replace(/\r\n/g,'\n'),file);
 }
});
