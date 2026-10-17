'use strict';
const test=require('node:test'),assert=require('node:assert/strict');const {createController}=require('../faculty-admin-afc-forms');
const ID='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',file={name:'Synthetic.pdf',type:'application/pdf',size:9,arrayBuffer:async()=>new TextEncoder().encode('synthetic').buffer};
test('AFC Records mounts one authorized upload controller and clears it on sign-out',()=>{
 const fs=require('node:fs'),path=require('node:path'),read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
 assert.match(read('faculty-admin.html'),/id="afc-form-documents"/);assert.match(read('faculty-admin.html'),/src="faculty-admin-afc-forms.js"/);assert.match(read('faculty-admin.js'),/PAWS_AFC_FORMS/);assert.match(read('faculty-admin.js'),/afcForms\?\.clear\(\)/);assert.match(read('tools/static-assets.json'),/faculty-admin-afc-forms.js/);
});
function harness({gate=true,uploadFailure=null,defer=null}={}){let uid='actor',keys=0;const nodes=new Map(),host={innerHTML:'',querySelector:s=>{if(!nodes.has(s))nodes.set(s,{});return nodes.get(s);},querySelectorAll:()=>[]};const calls=[];
 const api={afcFormCapabilities:async()=>({upload:gate,read:true}),listAfcForms:async p=>{calls.push(['list',p]);return {documents:[],nextCursor:null};},uploadAfcForm:async p=>{calls.push(['upload',p]);if(defer)return defer;if(uploadFailure)throw uploadFailure;return {document:{documentId:ID,fileName:file.name,byteLength:9,pageCount:1,createdAtUtc:'2026-10-17',sha256:'a'.repeat(64)}};},getAfcFormDocument:async()=>({bytes:Uint8Array.from([1]),contentType:'application/pdf'})};
 const c=createController({api,host,getUser:()=>({uid}),getFaculty:()=>[{facultyId:ID,displayName:'<script>Faculty</script>',active:true}],facultyName:r=>r.displayName,randomUUID:()=> 'request-'+(++keys),download:()=>calls.push(['download'])});return {c,host,calls,setUid:v=>{uid=v;}};
}
test('AFC file preview is metadata only, escaped and never extracts absence or approval',async()=>{
 const h=harness();await h.c.open();await h.c.chooseFaculty(ID);await h.c.selectFile(file);assert.match(h.host.innerHTML,/Synthetic.pdf/);assert.match(h.host.innerHTML,/not.*approval/i);assert.doesNotMatch(h.host.innerHTML,/<script>|<iframe|<object|<embed/i);await h.c.upload();assert.equal(h.calls.filter(x=>x[0]==='upload').length,1);assert.match(h.host.innerHTML,/Uploaded and confirmed/);
});
test('invalid files, missing faculty and disabled upload gate cannot submit',async()=>{
 const h=harness();await h.c.open();await h.c.selectFile(file);await h.c.upload();assert.equal(h.calls.filter(x=>x[0]==='upload').length,0);await h.c.chooseFaculty(ID);
 for(const f of [{...file,name:'x.html'},{...file,size:2097153},{...file,type:'text/html'}]){await h.c.selectFile(f);await h.c.upload();}assert.equal(h.calls.filter(x=>x[0]==='upload').length,0);
 const off=harness({gate:false});await off.c.open();await off.c.chooseFaculty(ID);await off.c.selectFile(file);await off.c.upload();assert.equal(off.calls.filter(x=>x[0]==='upload').length,0);
});
test('ambiguous upload retries preserve exact request id and selected file',async()=>{
 const h=harness({uploadFailure:Object.assign(Error('Unavailable'),{status:503})});await h.c.open();await h.c.chooseFaculty(ID);await h.c.selectFile(file);await h.c.upload();await h.c.upload();const calls=h.calls.filter(x=>x[0]==='upload');assert.equal(calls.length,2);assert.equal(calls[0][1].requestId,calls[1][1].requestId);assert.deepEqual(calls[0][1],calls[1][1]);assert.match(h.host.innerHTML,/same upload key/i);
});
test('account changes discard pending upload success and clear private state',async()=>{
 let finish;const promise=new Promise(r=>{finish=r;});const h=harness({defer:promise});await h.c.open();await h.c.chooseFaculty(ID);await h.c.selectFile(file);const pending=h.c.upload();h.setUid('other');h.c.clear();finish({document:{documentId:ID,fileName:'PRIVATE.pdf'}});await pending;assert.equal(h.host.innerHTML,'');
});
test('reopening AFC tab during upload preserves pending success and clearing faculty removes selected document',async()=>{
 let finish;const promise=new Promise(r=>{finish=r;});const h=harness({defer:promise});await h.c.open();await h.c.chooseFaculty(ID);await h.c.selectFile(file);const pending=h.c.upload();await h.c.open();finish({document:{documentId:ID,fileName:file.name,byteLength:9,pageCount:1}});await pending;assert.match(h.host.innerHTML,/Uploaded and confirmed/);await h.c.chooseFaculty('');assert.doesNotMatch(h.host.innerHTML,/Synthetic.pdf/);
});
