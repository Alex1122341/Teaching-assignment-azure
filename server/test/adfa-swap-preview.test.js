'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createSwapApi}=require('../src/swap/swap-api');
const {createSwapFunctions}=require('../src/runtime/swa-swap-functions');
const SESSION='11111111-1111-4111-8111-111111111111';
const ASSIGNMENT='22222222-2222-4222-8222-222222222222';
const CANDIDATE='33333333-3333-4333-8333-333333333333';
const SNAPSHOT='a'.repeat(64);
function request(values={}){
 return new Request('http://local/api/v1/swaps/faculty-preview?'+new URLSearchParams({sessionId:SESSION,assignmentId:ASSIGNMENT,candidateKey:CANDIDATE,snapshotToken:SNAPSHOT,...values}),{headers:{authorization:'Bearer synthetic'}});
}

// Break caught: routing an ordinary faculty/office user into the privileged DOE preview.
test('non-ADFA users cannot read another faculty member DOE through the SWAP preview',async()=>{
 for(const baseRole of ['faculty','hicc','visc','adc','lab','other_office']){
  const api=createSwapApi({verifyToken:async()=>({uid:'synthetic'}),findUser:async()=>({active:true,baseRole}),repository:{}});
  const response=await createSwapFunctions({api})(request());
  assert.equal(response.status,403,baseRole);
  assert.equal(response.jsonBody.error.code,'ROLE_DENIED');
 }
});
