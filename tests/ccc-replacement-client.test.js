'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{createPawsDataClient}=require('../frontend/scripts/paws-data-client.js');
test('CCC client sends authenticated closed source/preview/complete-year bindings',async()=>{
 const calls=[],client=createPawsDataClient({tokenProvider:async()=>'token',fetchImpl:async(url,init)=>{calls.push({url,init});return {ok:true,json:async()=>({})};}});
 await client.cccReplacementCapabilities();await client.stageCccReplacement({requestId:'r',academicYear:'2026-27',dataset:'ccc-calendar',sourceSha256:'hash',fileName:'CCC.xlsx',fileBase64:'bytes',actorFirebaseUid:'spoof',rows:['private']});await client.getCccReplacement('id');await client.previewCccReplacement('id',{expectedVersion:'v',actorFirebaseUid:'spoof'});await client.commitCccReplacement('id',{expectedVersion:'v',manifestSha256:'m',sourceSha256:'s',academicYear:'2026-27',dataset:'ccc-calendar',idempotencyKey:'key',confirm:true,completeDataset:true,targetIds:['private']});
 assert.match(calls[0].url,/\/ccc-replacements\/capabilities$/);assert.match(calls[3].url,/\/id\/preview$/);assert.match(calls[4].url,/\/id\/commit$/);assert.doesNotMatch(JSON.stringify(calls),/spoof|private/);assert.ok(calls.every(c=>c.init.headers.Authorization==='Bearer token'&&c.init.credentials==='omit'));assert.equal(JSON.parse(calls[4].init.body).completeDataset,true);
});
