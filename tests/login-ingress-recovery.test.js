'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const origin=require('../frontend/scripts/paws-api-origin.js');

test('recovered Beta ingress uses the verified October23 maintenance tunnel for authenticated profile reads',async()=>{
 assert.equal(origin.apiOrigin,'https://cultures-please-skirt-tba.trycloudflare.com');
 const {createPawsDataClient}=require('../frontend/scripts/paws-data-client.js');const calls=[];
 const client=createPawsDataClient({tokenProvider:async()=>'synthetic',fetchImpl:async(url,init)=>{calls.push({url,init});return{ok:true,json:async()=>({profile:{role:'faculty'}})};}});
 await client.currentUser();assert.equal(calls[0].url,origin.apiOrigin+'/api/v1/me');assert.equal(calls[0].init.headers.Authorization,'Bearer synthetic');assert.equal(calls[0].init.credentials,'omit');
});
