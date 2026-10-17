'use strict';
const test=require('node:test'),assert=require('node:assert/strict');const {createPawsAzureDataClient}=require('../paws-data-client');
test('AFC form client uses authenticated exact routes and explicit payload allowlist',async()=>{
 const calls=[],c=createPawsAzureDataClient({tokenProvider:async()=>'token',fetchImpl:async(url,init)=>{calls.push({url,init});return {ok:true,json:async()=>({documents:[]})};}});
 await c.afcFormCapabilities();await c.listAfcForms({facultyId:'faculty',limit:25,actorFirebaseUid:'spoof'});await c.uploadAfcForm({facultyId:'f',requestId:'r',fileName:'x.pdf',contentType:'application/pdf',fileBase64:'bytes',reason:'private',actorFirebaseUid:'spoof'});
 assert.match(calls[0].url,/afc-forms\/capabilities$/);assert.match(calls[1].url,/afc-forms\?facultyId=faculty&limit=25$/);assert.doesNotMatch(calls[2].init.body,/private|spoof/);assert.ok(calls.every(x=>x.init.headers.Authorization==='Bearer token'&&x.init.credentials==='omit'));
});
