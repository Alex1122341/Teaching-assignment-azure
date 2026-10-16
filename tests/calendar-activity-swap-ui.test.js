'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
function harness(){
 const nodes=new Map();const content={innerHTML:'',append(){}};
 const form={querySelector:selector=>node(selector)};
 function node(selector){if(selector==='.sql-swap-content')return content;if(selector==='[data-form]')return form;if(!nodes.has(selector))nodes.set(selector,{value:'',checked:false,disabled:false,hidden:true,textContent:''});return nodes.get(selector);}
 const dialog={open:false,innerHTML:'',setAttribute(){},addEventListener(){},querySelector:node,querySelectorAll:()=>[],showModal(){this.open=true;},close(){this.open=false;}};
 let writes=0;
 const window={UCVM_PAWS_DATA:{swapContext:async()=>({session:{sessionId:'session',courseCode:'206',date:'2026-11-05',startTime:'09:00',endTime:'10:00',snapshotToken:'snapshot'},canCreate:true,fields:[{key:'replacementCandidateKey',editable:true}],assignments:[{assignmentId:'outgoing',displayName:'Current',canReplace:true}],candidates:[{candidateKey:'review',displayName:'Review Faculty',available:false,availabilityStatus:'Needs Review',notifyAvailable:true},{candidateKey:'available',displayName:'Available Faculty',available:true,availabilityStatus:'Available',notifyAvailable:true}]}),swapCapabilities:async()=>({writeCapabilities:{swapRequest:true}}),createSwap:async()=>{writes++;throw Error('Unexpected write');}}};
 vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../swap-workflow-sql.js'),'utf8'),{window,document:{createElement:()=>dialog,body:{append(){}}},crypto:{randomUUID:()=> 'request'}});
 window.PAWS_SWAP.configure({getUser:()=>({uid:'synthetic'})});return {window,node,form,content,writes:()=>writes};
}
test('Needs Review appears in the rendered disabled option and cannot be submitted by a manipulated selection',async()=>{
 const h=harness();await h.window.PAWS_SWAP.openSession('session');
 assert.match(h.content.innerHTML,/<option[^>]*value="review"[^>]*disabled[^>]*>Review Faculty · Needs Review<\/option>/);
 h.node('[data-candidate]').value='review';h.node('[data-assignment]').value='outgoing';h.node('[data-candidate]').onchange();
 assert.equal(h.node('[data-notify]').disabled,true);
 await h.form.onsubmit({preventDefault(){}});assert.equal(h.writes(),0);assert.match(h.node('[data-error]').textContent,/Needs Review/);
});
