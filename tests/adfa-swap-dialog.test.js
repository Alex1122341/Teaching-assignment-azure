'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const totals=n=>({status:'calculated',currentDoe:n,targetDoe:20,remainingDoe:20-n});
function harness(canPreviewDoe=true,initialStatus='Available',options={}){
 const nodes=new Map(),panel={innerHTML:'',querySelector:selector=>node('panel '+selector)},content={innerHTML:'',append(){}},form={querySelector:selector=>node(selector)};
 function node(selector){if(selector==='.sql-swap-content')return content;if(selector==='[data-form]')return form;if(selector==='[data-adfa-panel]')return panel;if(!nodes.has(selector))nodes.set(selector,{value:'',checked:false,disabled:false,hidden:true,textContent:''});return nodes.get(selector);}
 const dialog={open:false,innerHTML:'',setAttribute(){},addEventListener(){},querySelector:node,querySelectorAll:()=>[],showModal(){this.open=true;},close(){this.open=false;}};
 let status='Available',writes=0,previewWait=null;const payloads=[];
 const window={PAWS_ADFA_SWAP:require('../frontend/scripts/adfa-swap-panel.js'),UCVM_PAWS_DATA:{swapCapabilities:async()=>({canPreviewDoe,writeCapabilities:{swapRequest:true}}),swapContext:async()=>({session:{sessionId:'session',snapshotToken:'snapshot',courseCode:'206',date:'2026-11-05',startTime:'09:00',endTime:'10:00',topic:'Original topic',sessionType:'LEC'},canCreate:true,fields:options.fields||[{key:'replacementCandidateKey',editable:true}],assignments:[{assignmentId:'assignment',displayName:'Outgoing synthetic',canReplace:true}],candidates:[{candidateKey:'incoming',displayName:'Incoming synthetic',availabilityStatus:initialStatus,available:initialStatus==='Available',notifyAvailable:true}]}),swapFacultyPreview:async()=>({status:'calculated',assignment:{displayName:'Outgoing synthetic',teachingRole:'Primary',persistedDoeCredit:0.42},outgoing:{current:totals(12),projected:totals(10)},incoming:{current:totals(5),projected:totals(7)},availability:{status,conflicts:[]}}),createSwap:async()=>{writes++;throw Error('Unexpected write');}}};
 vm.runInNewContext(fs.readFileSync(require('../tools/build/frontend-paths').repositoryPath(__dirname,'../swap-workflow-sql.js'),'utf8'),{window,document:{createElement:()=>dialog,body:{append(){}}},crypto:{randomUUID:()=> 'request'}});
 window.PAWS_SWAP.configure({getUser:()=>({uid:'synthetic'})});
 const original=window.UCVM_PAWS_DATA.swapFacultyPreview;window.UCVM_PAWS_DATA.swapFacultyPreview=async(...args)=>{if(previewWait)await previewWait;return original(...args);};
 const create=window.UCVM_PAWS_DATA.createSwap;window.UCVM_PAWS_DATA.createSwap=async payload=>{payloads.push(JSON.parse(JSON.stringify(payload)));return create(payload);};
 return{window,panel,content,node,form,payloads,writes:()=>writes,setStatus:value=>{status=value;},holdPreview:()=>{let release;previewWait=new Promise(resolve=>{release=resolve;});return()=>{previewWait=null;release();};}};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('ADFA opens the real candidate DOE panel and a stale availability result blocks submission',async()=>{
 const h=harness();await h.window.PAWS_SWAP.openSession('session');await settle();
 assert.match(h.panel.innerHTML,/Projected DOE/);
 assert.match(h.panel.innerHTML,/5\.00%/);
 const button={dataset:{adfaSelect:'incoming'},disabled:false};button.closest=()=>button;
 h.panel.onclick({target:button});await settle();assert.equal(h.node('[data-candidate]').value,'incoming');
 h.setStatus('Needs Review');await h.form.onsubmit({preventDefault(){}});
 assert.equal(h.writes(),0);assert.match(h.node('[data-error]').textContent,/review|changed/i);
});
test('ordinary faculty keep their scoped form without another faculty DOE panel',async()=>{
 const h=harness(false);await h.window.PAWS_SWAP.openSession('session');await settle();
 assert.equal(h.panel.innerHTML,'');assert.doesNotMatch(h.content.innerHTML,/Current DOE|Projected DOE/);
});

test('switching to the standard request cancels a pending faculty-only submission',async()=>{
 const h=harness();await h.window.PAWS_SWAP.openSession('session');await settle();
 const button={dataset:{adfaSelect:'incoming'},disabled:false};button.closest=()=>button;h.panel.onclick({target:button});await settle();
 const release=h.holdPreview(),pending=h.form.onsubmit({preventDefault(){}});
 h.node('[data-standard-request]').onclick();release();await pending;
 assert.equal(h.writes(),0);
});

test('fresh Available selection replaces an old Needs Review context before submission',async()=>{
 const h=harness(true,'Needs Review');await h.window.PAWS_SWAP.openSession('session');await settle();
 const button={dataset:{adfaSelect:'incoming'},disabled:false};button.closest=()=>button;h.panel.onclick({target:button});await settle();
 assert.equal(h.node('[data-candidate]').value,'incoming');await h.form.onsubmit({preventDefault(){}});
 assert.equal(h.writes(),0);await h.form.onsubmit({preventDefault(){}});
 assert.equal(h.writes(),1);assert.equal(h.node('[data-notify]').disabled,false);
});

test('opening standard schedule editing preserves the current replacement request draft',async()=>{
 const h=harness();await h.window.PAWS_SWAP.openSession('session');await settle();
 const button={dataset:{adfaSelect:'incoming'},disabled:false};button.closest=()=>button;h.panel.onclick({target:button});await settle();
 h.node('[data-note]').value='Synthetic reason <keep>';h.node('[data-notify]').checked=true;
 h.node('[data-standard-request]').onclick();
 assert.match(h.content.innerHTML,/<option value="assignment" selected/);
 assert.match(h.content.innerHTML,/<option value="incoming" selected/);
 assert.match(h.content.innerHTML,/data-notify checked/);assert.match(h.content.innerHTML,/Synthetic reason &lt;keep&gt;/);
});

test('standard mode without a replacement clears the default outgoing assignment',async()=>{
 const h=harness();await h.window.PAWS_SWAP.openSession('session');await settle();
 h.node('[data-standard-request]').onclick();assert.doesNotMatch(h.content.innerHTML,/<option value="assignment" selected/);
});

test('switching a revision to standard mode cannot restore a replacement cleared by fresh review',async()=>{
 const h=harness();h.setStatus('Needs Review');
 h.window.UCVM_PAWS_DATA.swapDetail=async()=>({request:{requestId:'request',sessionId:'session',assignmentId:'assignment',revision:2,changes:{replacementCandidateKey:'incoming'},note:'Synthetic revision'},capabilities:{canRevise:true,editableFields:['replacementCandidateKey']}});
 await h.window.PAWS_SWAP.openDetail('request');await h.node('[data-revise]').onclick();await settle();await settle();
 assert.equal(h.node('[data-candidate]').value,'');h.node('[data-standard-request]').onclick();
 assert.doesNotMatch(h.content.innerHTML,/<option value="incoming" selected|<option value="assignment" selected/);
});

test('three clear request choices preserve server field authority in topic mode',async()=>{
 const h=harness(false,'Available',{fields:[{key:'replacementCandidateKey',editable:true},{key:'topic',editable:false,office:'adc',reason:'Only ADC may revise this field.'},{key:'sessionType',editable:false,office:'adc'}]});
 await h.window.PAWS_SWAP.openSession('session');
 assert.match(h.content.innerHTML,/Topic change/);assert.match(h.content.innerHTML,/Session type change/);
 h.node('[data-request-kind="topic"]').onclick();
 assert.match(h.content.innerHTML,/data-field="topic"[^>]*disabled/);
 assert.doesNotMatch(h.content.innerHTML,/data-assignment|data-field="sessionType"/);
 assert.match(h.content.innerHTML,/inbox/i);assert.equal(h.writes(),0);
});

test('explicit topic inclusion reviews escaped From/To before submitting only selected fields',async()=>{
 const h=harness(false,'Available',{fields:[{key:'topic',editable:true},{key:'room',editable:true}]});
 await h.window.PAWS_SWAP.openSession('session');h.node('[data-request-kind="topic"]').onclick();
 assert.match(h.content.innerHTML,/data-change="topic"/);
 h.node('[data-field="topic"]').value='New <topic>';h.node('[data-note]').value='A <reason>';
 await h.form.onsubmit({preventDefault(){}});assert.equal(h.writes(),0);assert.match(h.node('[data-error]').textContent,/select|change/i);
 const check=h.node('[data-change="topic"]');check.checked=true;check.onchange();
 await h.form.onsubmit({preventDefault(){}});
 assert.equal(h.writes(),0);assert.match(h.node('[data-review]').innerHTML,/Original topic/);assert.match(h.node('[data-review]').innerHTML,/New &lt;topic&gt;/);
 await h.form.onsubmit({preventDefault(){}});
 assert.equal(h.writes(),1);assert.deepEqual(h.payloads[0].changes,{topic:'New <topic>'});assert.equal(h.payloads[0].note,'A <reason>');assert.equal(h.payloads[0].assignmentId,null);
});

test('switching intent keeps an incompatible draft until its selected fields are cleared',async()=>{
 const h=harness(false,'Available',{fields:[{key:'room',editable:true},{key:'topic',editable:true}]});await h.window.PAWS_SWAP.openSession('session');
 const box=h.node('[data-change="room"]');box.checked=true;box.onchange();h.node('[data-field="room"]').value='New room';h.node('[data-note]').value='Keep note';
 h.node('[data-request-kind="topic"]').onclick();assert.match(h.node('[data-error]').textContent,/draft.*kept/i);assert.equal(h.node('[data-field="room"]').value,'New room');
 box.checked=false;box.onchange();h.node('[data-request-kind="topic"]').onclick();
 assert.doesNotMatch(h.content.innerHTML,/data-field="room"/);assert.equal(h.node('[data-note]').value,'Keep note');assert.equal(h.writes(),0);
});

test('including either time field includes both and omits unchecked schedule values',async()=>{
 const h=harness(false,'Available',{fields:[{key:'startTime',editable:true},{key:'endTime',editable:true},{key:'room',editable:true}]});await h.window.PAWS_SWAP.openSession('session');
 h.node('[data-field="room"]').value='Unchecked bad value';const start=h.node('[data-change="startTime"]');start.checked=true;start.onchange();
 assert.equal(h.node('[data-change="endTime"]').checked,true);h.node('[data-field="startTime"]').value='10:00';h.node('[data-field="endTime"]').value='11:00';
 await h.form.onsubmit({preventDefault(){}});await h.form.onsubmit({preventDefault(){}});
 assert.deepEqual(h.payloads[0].changes,{startTime:'10:00',endTime:'11:00'});
});

test('changing a note after review requires another confirmation and user switches invalidate it',async()=>{
 const h=harness(false,'Available',{fields:[{key:'topic',editable:true}]});await h.window.PAWS_SWAP.openSession('session');
 const box=h.node('[data-change="topic"]');box.checked=true;box.onchange();h.node('[data-field="topic"]').value='New topic';
 await h.form.onsubmit({preventDefault(){}});h.node('[data-note]').value='Revised note';h.form.oninput();
 assert.equal(h.node('[data-review]').hidden,true);await h.form.onsubmit({preventDefault(){}});assert.equal(h.writes(),0);
 h.window.PAWS_SWAP.configure({getUser:()=>({uid:'other-user'})});await h.form.onsubmit({preventDefault(){}});assert.equal(h.writes(),0);
});

test('revision keeps protected fields but can remove an editable proposal',async()=>{
 const h=harness(false,'Available',{fields:[{key:'topic',editable:true},{key:'room',editable:false}]});let saved;
 h.window.UCVM_PAWS_DATA.swapDetail=async()=>({request:{requestId:'request',sessionId:'session',revision:3,changes:{room:'Protected room',topic:'Proposed topic'},note:'Revision note'},capabilities:{canRevise:true,editableFields:['topic']}});
 h.window.UCVM_PAWS_DATA.reviseSwap=async(id,payload)=>{saved=JSON.parse(JSON.stringify(payload));throw Error('synthetic stop');};
 await h.window.PAWS_SWAP.openDetail('request');await h.node('[data-revise]').onclick();
 h.node('[data-request-kind="type"]').onclick();assert.match(h.content.innerHTML,/data-field="room"/);
 const box=h.node('[data-change="topic"]');assert.equal(box.checked,true);box.checked=false;box.onchange();
 await h.form.onsubmit({preventDefault(){}});await h.form.onsubmit({preventDefault(){}});
 assert.deepEqual(saved.changes,{room:'Protected room'});assert.equal(saved.expectedRevision,3);assert.equal(saved.note,'Revision note');
});

test('final confirmation rechecks replacement availability and blocks a changed result',async()=>{
 const h=harness();await h.window.PAWS_SWAP.openSession('session');await settle();const button={dataset:{adfaSelect:'incoming'},disabled:false};button.closest=()=>button;h.panel.onclick({target:button});await settle();
 await h.form.onsubmit({preventDefault(){}});assert.equal(h.writes(),0);h.setStatus('Needs Review');await h.form.onsubmit({preventDefault(){}});assert.equal(h.writes(),0);
});

test('duplicate confirm events make one in-flight request',async()=>{
 const h=harness(false,'Available',{fields:[{key:'topic',editable:true}]});await h.window.PAWS_SWAP.openSession('session');const box=h.node('[data-change="topic"]');box.checked=true;box.onchange();h.node('[data-field="topic"]').value='New topic';await h.form.onsubmit({preventDefault(){}});
 let calls=0,release;h.window.UCVM_PAWS_DATA.createSwap=()=>{calls++;return new Promise((resolve,reject)=>{release=()=>reject(Error('synthetic stop'));});};
 const first=h.form.onsubmit({preventDefault(){}});await settle();await h.form.onsubmit({preventDefault(){}});assert.equal(calls,1);release();await first;
});
