'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const baseline=require('../tools/beta-baseline.json');

test('beta identity is pinned to the verified live Azure site',()=>{
  assert.equal(baseline.sourceCommit,'86bd5aa2c8a25259f3f708e49b322220ff43a147');
  assert.equal(baseline.siteUrl,'https://red-cliff-04871ca0f.5.azurestaticapps.net');
});

test('separation changes do not alter the live beta runtime snapshot',()=>{
  for(const [name,expected] of Object.entries(baseline.sha256)){
    const canonical=fs.readFileSync(path.join(root,name),'utf8').replace(/\r\n/g,'\n');
    const actual=crypto.createHash('sha256').update(canonical,'utf8').digest('hex');
    assert.equal(actual,expected,name);
  }
});
