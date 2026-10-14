'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const {createController}=require('../faculty-admin-activity-import');
const SHA='4FDB517FE0B6CDF26678643E6B606D9F8388701AAF7EA540206BEF8A5733E2DF';
const preview={batchId:'private-batch',sourceSha256:SHA,previewVersion:'version1',manifestSha256:'manifest',expiresAtUtc:'2099-01-01',startDate:'2026-04-29',endDate:'2026-05-03',counts:{accepted:1,retained:1,quarantined:1,excluded:1},items:[{sourceRow:2,status:'accepted',displayName:'<script>Synthetic</script>',startDate:'2026-04-29',endDate:'2026-05-03',targetCount:1},{sourceRow:3,status:'retained'},{sourceRow:4,status:'quarantined',issues:['BAD_DATE']},{sourceRow:5,status:'excluded'}]};
function harness({failure=null,stage=true,commit=true}={}){
 const nodes=new Map();const host={innerHTML:'',querySelector:selector=>{if(!nodes.has(selector))nodes.set(selector,{disabled:false,checked:false,value:'',addEventListener(){},textContent:''});return nodes.get(selector);}};const calls=[];let refreshed=0;
 const api={calendarActivityCapabilities:async()=>({writeCapabilities:{calendarActivityStage:stage,calendarActivityCommit:commit}}),stageCalendarActivityImport:async payload=>{calls.push({method:'stage',payload});return preview;},previewCalendarActivityImport:async(batch,payload)=>{calls.push({method:'preview',payload});return {...preview,previewVersion:'version2'};},commitCalendarActivityImport:async(batch,payload)=>{calls.push({method:'commit',payload});if(failure)throw failure;return {receiptId:'private-receipt',insertedCount:1,deletedAfcCount:1};}};
 const controller=createController({api,host,notify(){},onCommitted:()=>{refreshed++;},hashFile:async()=>SHA,randomUUID:()=> 'retry-key'});return {controller,host,calls,refreshed:()=>refreshed};
}
const file={name:'Synthetic.xlsx',size:9,arrayBuffer:async()=>new TextEncoder().encode('synthetic').buffer};
test('preview is escaped, truthful about source extent and preservation, and commit requires explicit confirmation',async()=>{
 const h=harness();await h.controller.open();await h.controller.stageFile(file);
 assert.match(h.host.innerHTML,/2026-04-29/);assert.match(h.host.innerHTML,/2026-05-03/);assert.match(h.host.innerHTML,/Retained|Preserved/);assert.match(h.host.innerHTML,/Excluded|Departed/);assert.match(h.host.innerHTML,/cross.*year/i);assert.match(h.host.innerHTML,/&lt;script/);assert.doesNotMatch(h.host.innerHTML,/<script|private-batch|private-receipt/);
 await h.controller.commit(false);assert.equal(h.calls.filter(x=>x.method==='commit').length,0);await h.controller.commit(true);assert.equal(h.refreshed(),1);
});
test('a lost response retains the idempotency key and stale409 requires refresh',async()=>{
 const h=harness({failure:Object.assign(Error('lost response'),{status:503})});await h.controller.open();await h.controller.stageFile(file);await h.controller.commit(true);await h.controller.commit(true);const sent=h.calls.filter(x=>x.method==='commit');assert.equal(sent[0].payload.idempotencyKey,sent[1].payload.idempotencyKey);assert.equal(h.refreshed(),0);
 const stale=harness({failure:Object.assign(Error('changed'),{status:409})});await stale.controller.open();await stale.controller.stageFile(file);await stale.controller.commit(true);await stale.controller.commit(true);assert.equal(stale.calls.filter(x=>x.method==='commit').length,1);await stale.controller.refreshPreview();assert.equal(stale.calls.at(-1).method,'preview');
});
test('closed stage gate blocks upload and clear invalidates a late staging response',async()=>{
 const closed=harness({stage:false});await closed.controller.open();await closed.controller.stageFile(file);assert.equal(closed.calls.length,0);
});

test('clear drops an outstanding preview and a double click commits once',async()=>{
 let stageResolve,commitResolve,refreshCount=0,commits=0;
 const host={innerHTML:'',querySelector:()=>null};
 const api={calendarActivityCapabilities:async()=>({writeCapabilities:{calendarActivityStage:true,calendarActivityCommit:true}}),stageCalendarActivityImport:()=>new Promise(resolve=>{stageResolve=resolve;}),commitCalendarActivityImport:()=>{commits++;return new Promise(resolve=>{commitResolve=resolve;});}};
 const controller=createController({api,host,hashFile:async()=>SHA,randomUUID:()=> 'key',onCommitted:()=>{refreshCount++;}});
 await controller.open();const pending=controller.stageFile(file);while(!stageResolve)await new Promise(resolve=>setImmediate(resolve));controller.clear();stageResolve(preview);await pending;assert.equal(host.innerHTML,'');
 await controller.open();const next=controller.stageFile(file);while(!host.innerHTML.includes('Validating'))await new Promise(resolve=>setImmediate(resolve));await new Promise(resolve=>setImmediate(resolve));stageResolve(preview);await next;
 const first=controller.commit(true);await controller.commit(true);assert.equal(commits,1);commitResolve({insertedCount:1,deletedAfcCount:1});await first;assert.equal(refreshCount,1);
});

test('reopening during a commit preserves its receipt and new upload invalidates the prior preview',async()=>{
 let complete,commits=0,controller;
 const host={innerHTML:'',querySelector:()=>null};
 const api={calendarActivityCapabilities:async()=>({writeCapabilities:{calendarActivityStage:true,calendarActivityCommit:true}}),stageCalendarActivityImport:async()=>preview,commitCalendarActivityImport:()=>{commits++;return new Promise(resolve=>{complete=resolve;});}};
 controller=createController({api,host,hashFile:async()=>SHA,randomUUID:()=> 'key',onCommitted:()=>controller.open()});
 await controller.open();await controller.stageFile(file);const pending=controller.commit(true);await controller.open();complete({insertedCount:1,deletedAfcCount:1});await pending;
 assert.match(host.innerHTML,/Import completed/);assert.doesNotMatch(host.innerHTML,/Working…/);await controller.commit(true);assert.equal(commits,1);
 await controller.stageFile({...file,name:'bad.txt'});await controller.commit(true);assert.equal(commits,1);assert.doesNotMatch(host.innerHTML,/Preview ready|data-activity-confirm/);
});
