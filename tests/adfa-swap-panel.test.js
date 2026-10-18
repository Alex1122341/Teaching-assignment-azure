'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const session={sessionId:'session',snapshotToken:'snapshot',date:'2026-11-05',startTime:'09:00',endTime:'10:00'};
const assignments=[{assignmentId:'assignment',displayName:'Outgoing synthetic',canReplace:true}];
const candidates=[{candidateKey:'incoming',displayName:'Incoming synthetic',availabilityStatus:'Available'}];
const total=(currentDoe,remainingDoe)=>({status:'calculated',contractDoe:18,currentDoe,targetDoe:20,remainingDoe});
const preview={status:'calculated',assignment:{displayName:'Outgoing synthetic',teachingRole:'Primary',persistedDoeCredit:0.42},outgoing:{current:total(12,8),projected:total(10,10),deltaDoe:-2},incoming:{current:total(5,15),projected:total(7,13),deltaDoe:2},sessionDoeCredit:2,availability:{status:'Available',conflicts:[]},checkedAtUtc:'2026-10-14T12:00:00Z'};
function host(){const nodes=new Map();return{innerHTML:'',querySelector(selector){if(!nodes.has(selector))nodes.set(selector,{value:'',textContent:'',disabled:false,onclick:null,oninput:null});return nodes.get(selector);}};}

test('ADFA shows the requested outgoing metrics and separate contract/current/remaining/projected replacement columns',async()=>{
 const {createController}=require('../adfa-swap-panel'),view=host();
 const initial={...preview,outgoing:{current:preview.outgoing.current,projected:null,deltaDoe:null}};
 const controller=createController({host:view,api:{swapFacultyPreview:async args=>args.candidateKey?preview:initial},session,assignments,candidates});
 await controller.open('assignment');
 const before=view.innerHTML.split('</section>')[0];
 assert.match(before,/Current DOE/);assert.match(before,/Course DOE/);assert.match(before,/Projected DOE \(after SWAP\)/);assert.match(before,/Select a replacement/);
 assert.match(before,/0\.42%/);
 assert.equal(await controller.select('incoming'),true);
 const outgoing=view.innerHTML.split('</section>')[0];
 assert.match(outgoing,/12\.00%/);assert.match(outgoing,/10\.00%/);
 const headers=[...view.innerHTML.matchAll(/<th(?:\s[^>]*)?>(.*?)<\/th>/g)].map(m=>m[1]);
 assert.deepEqual(headers,['Replacement faculty','Availability','Contract DOE','Current DOE','Remaining DOE','Projected DOE','Action']);
 const body=view.innerHTML.match(/<tbody>([\s\S]*?)<\/tbody>/)[1];
 const cells=[...body.matchAll(/<td(?:\s[^>]*)?>([\s\S]*?)<\/td>/g)].map(m=>m[1]);
 assert.match(cells[2],/18\.00%/);assert.match(cells[3],/5\.00%/);assert.match(cells[4],/15\.00%/);assert.doesNotMatch(cells[4],/13\.00%/);assert.match(cells[5],/7\.00%/);
});

test('availability explains public conflicts and marks restricted or unconfirmed details without revealing AFC reasons',async()=>{
 const {createController}=require('../adfa-swap-panel'),view=host();
 let value={...preview,availability:{status:'Unavailable',conflicts:[{courseCode:'<SYN206>',startTime:'09:00:00',endTime:'10:00:00'}],reason:'PRIVATE VACATION',afcPurpose:'PRIVATE PURPOSE'}};
 const controller=createController({host:view,api:{swapFacultyPreview:async()=>value},session,assignments,candidates});
 await controller.open('assignment');
 assert.match(view.innerHTML,/Timetable conflict/);assert.match(view.innerHTML,/&lt;SYN206&gt;/);assert.match(view.innerHTML,/09:00–10:00/);assert.doesNotMatch(view.innerHTML,/PRIVATE|<SYN206>/);
 value={...value,availability:{...value.availability,conflicts:[]}};await controller.open('assignment');
 assert.match(view.innerHTML,/Details restricted/);assert.doesNotMatch(view.innerHTML,/PRIVATE/);
 value={...value,availability:{...value.availability,status:'Needs Review'}};await controller.open('assignment');
 assert.match(view.innerHTML,/Availability could not be confirmed/);assert.doesNotMatch(view.innerHTML,/PRIVATE/);
});

// Break caught: ADFA sees only a dropdown/placeholder rather than server-provided DOE totals.
test('ADFA candidate panel renders current and projected DOE beside live availability',async()=>{
 const {createController}=require('../adfa-swap-panel');
 const view=host(),controller=createController({host:view,api:{swapFacultyPreview:async()=>preview},session,assignments,candidates,isCurrent:()=>true,onSelect(){}});
 await controller.open('assignment');
 assert.match(view.innerHTML,/Current assignment/);
 assert.match(view.innerHTML,/0\.42%/);
 assert.match(view.innerHTML,/Current DOE/);
 assert.match(view.innerHTML,/Projected DOE/);
 assert.match(view.innerHTML,/5\.00%/);
 assert.match(view.innerHTML,/7\.00%/);
 assert.match(view.innerHTML,/Available/);
 assert.match(view.innerHTML,/Check availability/);
 assert.match(view.innerHTML,/Change \+2\.00 percentage points/);
});

// Break caught: selecting a cached Available row after its real availability changed.
test('selecting a candidate rechecks availability and refuses a new Needs Review result',async()=>{
 const {createController}=require('../adfa-swap-panel');let value=preview,chosen='';
 const controller=createController({host:host(),api:{swapFacultyPreview:async()=>value},session,assignments,candidates,isCurrent:()=>true,onSelect:key=>{chosen=key;}});
 await controller.open('assignment');
 value={...preview,availability:{status:'Needs Review',conflicts:[]}};
 assert.equal(await controller.select('incoming'),false);
 assert.equal(chosen,'');
 value=preview;
 assert.equal(await controller.select('incoming'),true);
 assert.equal(chosen,'incoming');
 value={...preview,availability:{status:'Needs Review',conflicts:[]}};
 assert.equal(await controller.verifySelection('incoming'),false);
 assert.equal(chosen,'');
});

// Break caught: opening a dialog requests DOE worksheets for the entire faculty directory.
test('search and paging load only the visible six candidates',async()=>{
 const {createController}=require('../adfa-swap-panel'),calls=[],view=host();
 const faculty=Array.from({length:13},(_,i)=>({candidateKey:'key-'+i,displayName:'Person '+String(i).padStart(2,'0')}));
 const controller=createController({host:view,api:{swapFacultyPreview:async args=>{calls.push(args);return preview;}},session,assignments,candidates:faculty,isCurrent:()=>true});
 await controller.open('assignment');
 assert.equal(calls.filter(row=>row.candidateKey).length,6);
 assert.match(view.innerHTML,/Person 05/);assert.doesNotMatch(view.innerHTML,/Person 06/);
 await controller.filter('',1);
 assert.match(view.innerHTML,/Person 06/);assert.doesNotMatch(view.innerHTML,/Person 05/);
 await controller.filter('Person 12');
 assert.match(view.innerHTML,/Person 12/);assert.doesNotMatch(view.innerHTML,/Person 11/);
});

test('an incomplete availability response cannot select a candidate',async()=>{
 const {createController}=require('../adfa-swap-panel');let selected='';
 const controller=createController({host:host(),api:{swapFacultyPreview:async()=>({...preview,availability:{}})},session,assignments,candidates,onSelect:key=>{selected=key;}});
 await controller.open('assignment');assert.equal(await controller.select('incoming'),false);assert.equal(selected,'');
});

test('selection is visible and authorized timetable conflict details are escaped',async()=>{
 const {createController}=require('../adfa-swap-panel'),view=host();
 const value={...preview,availability:{status:'Unavailable',conflicts:[{courseCode:'<SYN101>',date:'2026-11-05',startTime:'09:30',endTime:'10:30'}]}};
 const controller=createController({host:view,api:{swapFacultyPreview:async()=>value},session,assignments,candidates});
 await controller.open('assignment');await controller.select('incoming');
 assert.match(view.innerHTML,/Selected replacement/);assert.match(view.innerHTML,/Incoming synthetic/);
 assert.match(view.innerHTML,/&lt;SYN101&gt;/);assert.doesNotMatch(view.innerHTML,/<SYN101>/);
});

test('clearing the outgoing assignment clears candidates and pending selection',async()=>{
 const {createController}=require('../adfa-swap-panel'),view=host();let selected='';
 const controller=createController({host:view,api:{swapFacultyPreview:async()=>preview},session,assignments,candidates,onSelect:key=>{selected=key;}});
 await controller.open('assignment');await controller.select('incoming');await controller.open('');
 assert.equal(selected,'');assert.doesNotMatch(view.innerHTML,/Incoming synthetic/);
 assert.match(view.innerHTML,/Select a current faculty assignment/);
});

test('a stale assignment preview clears cached faculty values and offers a session reload',async()=>{
 const {createController}=require('../adfa-swap-panel'),view=host();let stale=false,calls=0,reloads=0;
 const controller=createController({host:view,api:{swapFacultyPreview:async()=>{calls++;if(stale)throw Object.assign(Error('PRIVATE ERROR'),{status:409});return preview;}},session,assignments,candidates,onReload:()=>{reloads++;}});
 await controller.open('assignment');await controller.select('incoming');stale=true;const before=calls;
 await controller.open('assignment');
 assert.equal(calls-before,1);assert.match(view.innerHTML,/session changed/i);
 assert.doesNotMatch(view.innerHTML,/5\.00%|7\.00%|PRIVATE ERROR|Selected replacement/);
 view.querySelector('[data-adfa-reload]').onclick();assert.equal(reloads,1);
});

test('failed selection clears projected outgoing DOE and reports unavailable without inventing zero',async()=>{
 const {createController}=require('../adfa-swap-panel'),view=host();let failed=false,selected='';
 const controller=createController({host:view,api:{swapFacultyPreview:async()=>{if(failed)throw Object.assign(Error('PRIVATE ERROR'),{status:503});return preview;}},session,assignments,candidates,onSelect:key=>{selected=key;}});
 await controller.open('assignment');await controller.select('incoming');failed=true;
 assert.equal(await controller.verifySelection('incoming'),false);assert.equal(selected,'');
 assert.match(view.innerHTML,/Preview unavailable/);assert.doesNotMatch(view.innerHTML,/10\.00%|Selected replacement|PRIVATE ERROR|0\.00%/);
 await controller.open('assignment');assert.match(view.innerHTML,/service is unavailable/);assert.doesNotMatch(view.innerHTML,/12\.00%|5\.00%|7\.00%/);
});

test('leaving the dialog ignores pending preview results and sends no further requests',async()=>{
 const {createController}=require('../adfa-swap-panel'),view=host();let current=true,release,calls=0;
 const controller=createController({host:view,api:{swapFacultyPreview:async()=>{calls++;await new Promise(resolve=>{release=resolve;});return preview;}},session,assignments,candidates,isCurrent:()=>current});
 const pending=controller.open('assignment');current=false;release();await pending;
 assert.equal(calls,1);assert.equal(await controller.select('incoming'),false);assert.equal(calls,1);assert.doesNotMatch(view.innerHTML,/12\.00%/);
});
