'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {configureTestingAuth,PROJECT}=require('../tools/testing/db/configure-testing-auth');
function fixture(change={}){
 let config={name:'projects/165982140501/config',signIn:{email:{enabled:false,passwordRequired:true},anonymous:{enabled:false},phoneNumber:{enabled:false}},authorizedDomains:[PROJECT+'.firebaseapp.com'],...change};
 const writes=[];return {writes,client:{async get(){return structuredClone(config);},async update(project,patch,mask){writes.push({project,patch,mask});config.signIn.email=structuredClone(patch.signIn.email);}}};
}
test('Testing Auth check is read-only and apply changes only the fixed project email fields',async()=>{
 const h=fixture();assert.equal((await configureTestingAuth({client:h.client})).status,'NOT_CONFIGURED');assert.equal(h.writes.length,0);
 const result=await configureTestingAuth({client:h.client,apply:true});assert.equal(result.status,'CONFIGURED');assert.equal(result.otherConfigurationUnchanged,true);
 assert.deepEqual(h.writes,[{project:PROJECT,patch:{signIn:{email:{enabled:true,passwordRequired:true}}},mask:'signIn.email.enabled,signIn.email.passwordRequired'}]);
});
test('wrong Firebase config resource causes zero writes and enabled config is not rewritten',async()=>{
 const wrong=fixture({name:'projects/tester-teaching/config'});await assert.rejects(configureTestingAuth({client:wrong.client,apply:true}),/Testing/);assert.equal(wrong.writes.length,0);
 const good=fixture({signIn:{email:{enabled:true,passwordRequired:true},anonymous:{enabled:false}}});assert.equal((await configureTestingAuth({client:good.client,apply:true})).changed,false);assert.equal(good.writes.length,0);
});
