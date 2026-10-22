'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createSingleActions}=require('../faculty-admin-afc-records'),forms=require('../faculty-admin-afc-forms');
const F='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',D='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const file={name:'Original.pdf',size:9,type:'application/pdf',arrayBuffer:async()=>new TextEncoder().encode('synthetic').buffer};
test('Create AFC waits for optional archive and confirms the exact PDF link before clearing the form',async()=>{
 for(const linked of [true,false]){
  let busy=false,resets=0;const calls=[],nodes={};for(const [id,value]of Object.entries({'afc-faculty':F,'afc-start-date':'2026-11-01','afc-end-date':'2026-11-02','afc-reason':'vacation','afc-notes':''}))nodes[id]={value};nodes['afc-submit']={};nodes['afc-form-status']={classList:{toggle(){}}};nodes['afc-record-form']={reset(){resets++;}};
  const c=createSingleActions({api:{afcSingleWriteEnabled:()=>true,createDashboardAfcRecord:async p=>{calls.push(['create',p]);return {afcRecordId:F,documentId:D};}},$:id=>nodes[id],reasonLabels:{vacation:'Vacation'},normalizeDate:()=>({error:null}),isBusy:()=>busy,setBusy:b=>busy=b,refreshRecords:async()=>[{afcRecordId:F,documentId:linked?D:null}],refreshDashboard:async()=>{},attachment:{prepare:async faculty=>{calls.push(['prepare',faculty]);return D;},clear(){calls.push(['clear']);}}});
  await c.submit();assert.equal(calls[0][0],'prepare');assert.equal(calls[1][1].documentId,D);assert.equal(resets,linked?1:0);assert.equal(c.isUnconfirmed(),!linked);
 }
});
test('record attachment reuses confirmed upload, blocks invalid files and discards upload when faculty changes',async()=>{
 assert.equal(typeof forms.createRecordAttachment,'function');
 let faculty=F,uid='admin',uploads=0,fail=false;const nodes=new Map(),host={innerHTML:'',querySelector:s=>{if(!nodes.has(s))nodes.set(s,{});return nodes.get(s);}};
 const c=forms.createRecordAttachment({api:{afcFormCapabilities:async()=>({read:true,upload:true}),uploadAfcForm:async p=>{uploads++;if(fail)faculty='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';return {document:{documentId:D,facultyId:p.facultyId,fileName:p.fileName,byteLength:9}};}},host,getUser:()=>({uid}),getFacultyId:()=>faculty,randomUUID:()=>F});
 await c.open();await c.selectFile(file);assert.equal(await c.prepare(F),D);assert.equal(await c.prepare(F),D);assert.equal(uploads,1);assert.doesNotMatch(host.innerHTML,/data-form-upload/);
 await c.selectFile({...file,name:'bad.html'});await assert.rejects(c.prepare(F));assert.equal(uploads,1);
 c.clear();await c.open();fail=true;await c.selectFile(file);await assert.rejects(c.prepare(F));
});
test('record PDF links use a download action only for valid document bindings and N/A otherwise',()=>{
 assert.equal(typeof forms.documentAction,'function');assert.match(forms.documentAction({documentId:D}),/Download PDF/);for(const row of [{},{documentId:null},{documentId:'<script>'}]){assert.match(forms.documentAction(row),/N\/A/);assert.doesNotMatch(forms.documentAction(row),/<script>|Download PDF/);}
});
test('unconfirmed PDF upload can retry its original key without treating an AFC record as already submitted',async()=>{
 let busy=false,prepared=0,created=0;const nodes={};for(const [id,value]of Object.entries({'afc-faculty':F,'afc-start-date':'2026-11-01','afc-end-date':'2026-11-02','afc-reason':'vacation','afc-notes':''}))nodes[id]={value};nodes['afc-submit']={};nodes['afc-form-status']={classList:{toggle(){}}};
 const c=createSingleActions({api:{afcSingleWriteEnabled:()=>true,createDashboardAfcRecord:async()=>{created++;}},$:id=>nodes[id],reasonLabels:{vacation:'Vacation'},normalizeDate:()=>({}),isBusy:()=>busy,setBusy:b=>busy=b,attachment:{prepare:async()=>{prepared++;throw Object.assign(Error('Archive outcome unknown'),{status:503});}}});
 await c.submit();assert.equal(c.isUnconfirmed(),false);await c.submit();assert.equal(prepared,2);assert.equal(created,0);
});
test('faculty archive clears cached originals when identity changes or authorization is refused',async()=>{
 for(const changedIdentity of [true,false]){
  let uid='self',pending=false,resolve,reject;const host={innerHTML:'',querySelector:()=>null};
  const api={listAfcForms:async()=>{if(!pending)return {documents:[{documentId:D,fileName:'Confidential.pdf'}],nextCursor:'next'};return new Promise((a,b)=>{resolve=a;reject=b;});}};
  const c=forms.createArchiveController({api,host,getUser:()=>({uid}),getFacultyId:()=>F});
  await c.load();assert.match(host.innerHTML,/Confidential.pdf/);pending=true;const request=c.load(true);
  if(changedIdentity){uid='other';resolve({documents:[],nextCursor:null});}else reject(Object.assign(Error('Forbidden'),{status:403}));
  await request;assert.doesNotMatch(host.innerHTML,/Confidential.pdf/);
 }
});
test('document downloader drops bytes after logout and suppresses simultaneous duplicate requests',async()=>{
 let uid='self',resolve,calls=0,downloads=0;const download=forms.createDocumentDownloader({api:{getAfcFormDocument:async()=>{calls++;return new Promise(a=>resolve=a);}},getUser:()=>({uid}),download:()=>downloads++});
 const request=download(D);await download(D);assert.equal(calls,1);uid='';resolve({bytes:new Uint8Array([1])});await request;assert.equal(downloads,0);
});
test('authenticated manual AFC client sends only optional original document binding and supported record fields',async()=>{
 const {createPawsDataClient}=require('../paws-data-client');let body;
 const api=createPawsDataClient({tokenProvider:async()=>'token',fetchImpl:async(_,options)=>{body=JSON.parse(options.body);return {ok:true,json:async()=>({afcRecordId:F})};}});
 await api.createDashboardAfcRecord({facultyId:F,startDate:'2026-11-01',endDate:'2026-11-02',reasonCode:'vacation',documentId:D,actorFirebaseUid:'spoof'});
 assert.equal(body.documentId,D);assert.equal(body.actorFirebaseUid,undefined);
});
