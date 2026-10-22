'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createPawsDataClient}=require('../paws-data-client');
test('AFC capability refresh cannot retain an earlier write grant after a failed request',async()=>{
  let allowed=true;
  const client=createPawsDataClient({tokenProvider:async()=> 'token',fetchImpl:async()=>({ok:allowed,status:allowed?200:403,json:async()=>allowed?{writeCapabilities:{afcSingle:true,afcBatch:true,afcCancel:true}}:{error:{code:'ROLE_DENIED'}}})});
  await client.refreshAfcRecordWriteCapabilities();
  assert.equal(client.afcSingleWriteEnabled(),true);assert.equal(client.afcCancelWriteEnabled(),true);
  allowed=false;await client.refreshAfcRecordWriteCapabilities();
  assert.equal(client.afcSingleWriteEnabled(),false);assert.equal(client.afcBatchWriteEnabled(),false);assert.equal(client.afcCancelWriteEnabled(),false);
});
test('AFC cancellation submits only its exact source and version with authenticated identity',async()=>{
  const calls=[];
  const client=createPawsDataClient({tokenProvider:async()=> 'trusted-token',fetchImpl:async(url,init)=>{calls.push({url,init});return {ok:true,json:async()=>({afcRecord:{active:false}})};}});
  const record=await client.cancelDashboardAfcRecord('record/1',{sourceKind:'manual',expectedVersion:'00000000000000AB',actorFirebaseUid:'spoof'});
  assert.equal(record.active,false);assert.match(calls[0].url,/\/afc-records\/record%2F1\/cancel$/);
  assert.deepEqual(JSON.parse(calls[0].init.body),{sourceKind:'manual',expectedVersion:'00000000000000AB'});
  assert.equal(calls[0].init.headers.Authorization,'Bearer trusted-token');
});
