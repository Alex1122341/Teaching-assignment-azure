'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const origin=require('../paws-api-origin');

test('recovered Beta ingress uses the verified October17 tunnel for authenticated profile reads',async()=>{
 assert.equal(origin.apiOrigin,'https://charge-concerning-hypothesis-represents.trycloudflare.com');
 const {createPawsAzureDataClient}=require('../paws-data-client');const calls=[];
 const client=createPawsAzureDataClient({tokenProvider:async()=>'synthetic',fetchImpl:async(url,init)=>{calls.push({url,init});return{ok:true,json:async()=>({profile:{role:'faculty'}})};}});
 await client.currentUser();assert.equal(calls[0].url,origin.apiOrigin+'/api/v1/me');assert.equal(calls[0].init.headers.Authorization,'Bearer synthetic');assert.equal(calls[0].init.credentials,'omit');
});
