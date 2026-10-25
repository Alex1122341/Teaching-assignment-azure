'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function harness(){
 const nodes=new Map(),content={innerHTML:'',append(){}},dialog={open:false,innerHTML:'',setAttribute(){},addEventListener(){},showModal(){this.open=true;},close(){this.open=false;},replaceChildren(){content.innerHTML='';}};
 function node(selector){if(selector==='.sql-swap-content')return content;if(!nodes.has(selector))nodes.set(selector,{value:'',checked:false,disabled:false,hidden:true,textContent:'',innerHTML:'',setAttribute(){},focus(){}});return nodes.get(selector);}
 dialog.querySelector=node;dialog.querySelectorAll=selector=>{
  const controls=['approve','reject','push_back'].filter(key=>content.innerHTML.includes(`data-decision="${key}"`)).map(key=>{const value=node(`[data-decision="${key}"]`);value.dataset={decision:key};return value;});
  return selector==='[data-decision]'?controls:selector.includes('[data-decision]')?[...controls,node('[data-confirm-action]')]:[];
 };content.querySelector=node;content.querySelectorAll=dialog.querySelectorAll;
 let uid='synthetic',calls=0,fail=null;
 const rows=[{requestId:'mine',courseCode:'206',date:'2026-11-05',academicYear:'2026-27',topic:'Healthy Animals',revision:2,status:'pending',nextStage:'lab',isMine:true,canDecide:false,requesterName:'de la Cruz, Mary Jane',changes:{topic:'New topic'}},{requestId:'decision',courseCode:'315',date:'2026-11-06',academicYear:'2026-27',revision:1,status:'pending',nextStage:'adfa',isMine:false,canDecide:true,requesterName:'Hall, David',changes:{room:'Room A'}},{requestId:'done',courseCode:'206',revision:1,status:'applied',isMine:false,canDecide:false,changes:{topic:'Earlier change'}}];
 const detail={request:{...rows[0],requestId:'request',sessionId:'session',note:'Reason',original:{topic:'Original topic'},changes:{topic:'New <topic>'}},capabilities:{canDecide:true,canRevise:false,canWithdraw:false,decisions:['approve','reject','push_back']},workflow:{available:true,verified:true,currentStage:'lab',finalStage:'adfa',complete:false,stages:[{key:'adc',label:'ADC / DVM review',status:'approved',actorName:'Hall, David'},{key:'lab',label:'LAB review',status:'current'},{key:'adfa',label:'ADFA final approval',status:'waiting'}]},history:[{revision:2,stage:'adc',decision:'approve',actorName:'Hall, David',comment:'Checked <schedule>',createdAtUtc:'2026-10-24T18:00:00Z'}],revisions:[{revision:2,actorName:'de la Cruz, Mary Jane',createdAtUtc:'2026-10-24T17:00:00Z'}]};
 const gates={swapRequest:true,swapDecision:true,swapApply:true};
 const window={PAWS_FACULTY_NAME:require('../frontend/scripts/faculty-name'),PAWS_ADFA_SWAP:require('../frontend/scripts/adfa-swap-panel'),UCVM_PAWS_DATA:{swapQueue:async()=>({requests:rows}),swapDetail:async()=>detail,swapCapabilities:async()=>({canPreviewDoe:gates.canPreviewDoe===true,writeCapabilities:gates}),swapContext:async()=>({session:{sessionId:'session',snapshotToken:'snapshot'}}),decideSwap:async()=>{calls++;if(fail)throw fail;return {};}}};
 vm.runInNewContext(fs.readFileSync(require('../tools/build/frontend-paths').repositoryPath(__dirname,'../swap-workflow-sql.js'),'utf8'),{window,document:{createElement:()=>dialog,body:{append(){}}},crypto:{randomUUID:()=> 'request'}});
 window.PAWS_SWAP.configure({getUser:()=>({uid})});
 return {window,content,node,rows,detail,gates,calls:()=>calls,setUser:next=>{uid=next;},fail:value=>{fail=value;}};
}
test('approval queue searches and filters only the returned SQL scope, with visible counts and reset',async()=>{
 const h=harness();await h.window.PAWS_SWAP.openQueue();assert.match(h.content.innerHTML,/SWAP|approval/i);assert.match(h.content.innerHTML,/data-queue-view/);
 assert.match(h.node('[data-queue-results]').innerHTML,/Healthy Animals/);assert.match(h.node('[data-queue-count]').textContent,/3/);
 h.node('[data-queue-view]').value='decisions';h.node('[data-queue-view]').onchange();assert.match(h.node('[data-queue-results]').innerHTML,/315/);assert.doesNotMatch(h.node('[data-queue-results]').innerHTML,/Healthy Animals/);
 h.node('[data-queue-reset]').onclick();h.node('[data-queue-search]').value='de la cruz';h.node('[data-queue-search]').oninput();assert.match(h.node('[data-queue-results]').innerHTML,/Healthy Animals/);assert.doesNotMatch(h.node('[data-queue-results]').innerHTML,/315/);
 h.node('[data-queue-search]').value='no match';h.node('[data-queue-search]').oninput();assert.match(h.node('[data-queue-results]').innerHTML,/No requests match/);h.node('[data-queue-reset]').onclick();assert.match(h.node('[data-queue-count]').textContent,/3/);
});
test('approval detail joins immutable From/To, a serial progress matrix and named revision history',async()=>{
 const h=harness();await h.window.PAWS_SWAP.openDetail('request');
 assert.match(h.content.innerHTML,/aria-label="Approval flow"/);assert.match(h.content.innerHTML,/data-stage="adc" data-state="approved"/);assert.match(h.content.innerHTML,/data-stage="lab" data-state="current"/);assert.match(h.content.innerHTML,/data-stage="adfa" data-state="waiting"/);
 assert.match(h.content.innerHTML,/Original topic/);assert.match(h.content.innerHTML,/New &lt;topic&gt;/);assert.match(h.content.innerHTML,/Hall, David/);assert.match(h.content.innerHTML,/Checked &lt;schedule&gt;/);assert.match(h.content.innerHTML,/Approve LAB/);assert.doesNotMatch(h.content.innerHTML,/Approve.*apply/);
});
test('decisions require reviewed confirmation, a rejection reason and one in-flight write',async()=>{
 const h=harness();await h.window.PAWS_SWAP.openDetail('request');
 await h.node('[data-decision="reject"]').onclick();assert.equal(h.calls(),0);assert.match(h.node('[data-error]').textContent,/reason/);
 h.node('[data-comment]').value='Topic checked';await h.node('[data-decision="approve"]').onclick();assert.equal(h.calls(),0);assert.match(h.node('[data-action-review]').innerHTML,/Confirm: Approve LAB/);
 const confirm=h.node('[data-confirm-action]').onclick;await Promise.all([confirm(),confirm()]);assert.equal(h.calls(),1);
});
test('editing the decision note or switching user invalidates the pending confirmation',async()=>{
 const h=harness();await h.window.PAWS_SWAP.openDetail('request');await h.node('[data-decision="approve"]').onclick();const confirm=h.node('[data-confirm-action]').onclick;
 h.node('[data-comment]').value='New reason';h.node('[data-comment]').oninput();await confirm();assert.equal(h.calls(),0);
 h.setUser('other');await h.node('[data-confirm-action]').onclick();assert.equal(h.calls(),0);
});
test('an uncertain decision response cannot be retried blindly into the next office stage',async()=>{
 const h=harness();h.fail(Object.assign(Error('Unknown commit result'),{status:503}));await h.window.PAWS_SWAP.openDetail('request');await h.node('[data-decision="approve"]').onclick();await h.node('[data-confirm-action]').onclick();assert.equal(h.calls(),1);
 await h.node('[data-decision="approve"]').onclick();assert.equal(h.calls(),1);assert.match(h.node('[data-error]').textContent,/Unknown commit/);
});
test('final application gate and SQL decision capability stay authoritative',async()=>{
 const h=harness();h.detail.request.nextStage='adfa';h.gates.swapApply=false;await h.window.PAWS_SWAP.openDetail('request');
 assert.match(h.content.innerHTML,/data-decision="approve" disabled/);await h.node('[data-decision="approve"]').onclick();assert.equal(h.calls(),0);
 h.detail.capabilities.canDecide=false;await h.window.PAWS_SWAP.openDetail('request');assert.doesNotMatch(h.content.innerHTML,/data-decision=/);
});
test('revoked access clears the already displayed detail after a failed action',async()=>{
 const h=harness();h.fail(Object.assign(Error('Denied'),{status:403}));await h.window.PAWS_SWAP.openDetail('request');await h.node('[data-decision="approve"]').onclick();await h.node('[data-confirm-action]').onclick();
 assert.match(h.content.innerHTML,/details have been cleared/);assert.doesNotMatch(h.content.innerHTML,/Original topic|Hall, David/);
});
test('read-only approval DOE summary reuses numeric formatting and binary availability without confidential reasons',()=>{
 const panel=require('../frontend/scripts/adfa-swap-panel');
 const current={status:'calculated',contractDoe:0,currentDoe:5,remainingDoe:15};
 const html=panel.renderReview({status:'calculated',assignment:{displayName:'Hall, David',persistedDoeCredit:0.42},outgoing:{current,projected:{...current,currentDoe:4.58}},incoming:{current,projected:{...current,currentDoe:5.42}},availability:{status:'Unavailable',reason:'PRIVATE_AFC_REASON',conflicts:[]}},'de la Cruz, Mary Jane');
 assert.match(html,/0\.00%/);assert.match(html,/5\.42%/);assert.match(html,/0\.42%/);assert.match(html,/Unavailable/);assert.doesNotMatch(html,/PRIVATE_AFC_REASON|data-adfa-select/);
});
test('ADFA approval detail loads its existing read-only DOE API only against the original request snapshot',async()=>{
 const h=harness();h.gates.canPreviewDoe=true;h.detail.request={...h.detail.request,assignmentId:'assignment',snapshotToken:'snapshot',changes:{replacementCandidateKey:'candidate'},replacementDisplayName:'Hall, David'};
 let previews=0;h.window.UCVM_PAWS_DATA.swapFacultyPreview=async()=>{previews++;return {status:'needs_review',availability:{status:'Needs Review'}};};
 await h.window.PAWS_SWAP.openDetail('request');assert.equal(previews,1);assert.match(h.node('[data-approval-doe]').innerHTML,/Needs Review/);
 await h.node('[data-decision="approve"]').onclick();assert.equal(h.calls(),0);assert.match(h.node('[data-error]').textContent,/DOE|availability/i);
 h.detail.request.snapshotToken='old';await h.window.PAWS_SWAP.openDetail('request');assert.equal(previews,1);assert.match(h.node('[data-approval-doe]').textContent,/changed|snapshot/i);
});
