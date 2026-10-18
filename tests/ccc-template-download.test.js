'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createPawsAzureDataClient}=require('../paws-data-client'),{createController}=require('../faculty-admin-ccc-replacement');
test('CCC template button downloads through authenticated API with no staging or commit request',async()=>{
 const calls=[],downloads=[],file={fileName:'CCC-template.xlsx',contentType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',fileBase64:Buffer.from('PK\x03\x04template').toString('base64')};
 const api=createPawsAzureDataClient({tokenProvider:async()=>'token',fetchImpl:async(url,init)=>{calls.push({url,init});return {ok:true,json:async()=>url.endsWith('/template')?file:{writeCapabilities:{cccReplaceStage:false,cccReplaceCommit:false}}};}});
 const nodes=new Map(),host={innerHTML:'',querySelector:s=>{if(!nodes.has(s))nodes.set(s,{});return nodes.get(s);}};
 const c=createController({api,host,getUser:()=>({uid:'actor'}),downloadTemplateFile:f=>downloads.push(f)});await c.open();assert.match(host.innerHTML,/Download CCC template/);await c.downloadTemplate();
 assert.equal(downloads.length,1);assert.equal(downloads[0].fileName,'CCC-template.xlsx');assert.ok(calls.every(c=>(c.init.method||'GET')==='GET'));assert.equal(calls[1].init.headers.Authorization,'Bearer token');assert.match(calls[1].url,/\/ccc-replacements\/template$/);assert.match(host.innerHTML,/YYYY-MM-DD/);
});
