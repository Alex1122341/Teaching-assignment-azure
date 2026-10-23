'use strict';
const { repositoryPath } = require('../tools/build/frontend-paths');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(rows=[{facultyId:'first',displayName:'Example Faculty'},{facultyId:'second',displayName:'Second Faculty'}],config={}){
 const nodes=new Map(),node=()=>({value:'',innerHTML:'',textContent:'',disabled:false,hidden:false,listeners:{},addEventListener(k,fn){(this.listeners[k]??=[]).push(fn)},fire(k){for(const fn of this.listeners[k]||[])fn({target:this})}});
 const host={innerHTML:'',querySelector:s=>{if(!nodes.has(s))nodes.set(s,node());return nodes.get(s)}};
 const pending=[],rosterCalls=[],timers=new Map();let timerId=0;
 const ctx={setTimeout:fn=>{timers.set(++timerId,fn);return timerId},clearTimeout:id=>timers.delete(id)};vm.runInNewContext(fs.readFileSync(repositoryPath(process.cwd(), 'faculty-availability.js'),'utf8'),ctx);
 const view=ctx.PAWS_FACULTY_AVAILABILITY.createFacultyAvailability({host,getSelfMode:config.getSelfMode,api:{dashboardFaculty:async p=>{rosterCalls.push(p);return config.dashboardFaculty?config.dashboardFaculty(p):rows},facultyAvailability:p=>new Promise((resolve,reject)=>pending.push({p,resolve,reject}))}});
 const $=id=>host.querySelector('#availability-'+id);$('mode').value='upcoming';$('kind').value='all';
 return{view,$,pending,rosterCalls,flushRoster:async()=>{for(const fn of [...timers.values()]){timers.clear();fn();}await tick();}};
}
const tick=()=>new Promise(r=>setImmediate(r));
const result=(name='Example event')=>({items:[{eventKey:name,kind:'teaching',label:name,startDate:'2026-10-20',endDate:'2026-10-20',availability:'busy',timeStatus:'verified'}],total:1,nextCursor:null,coverage:{undatedSessions:0,undatedRoles:0}});
test('changing Faculty discards delayed responses immediately and permits a fresh query',async()=>{
 const h=fixture();await h.view.open();h.$('faculty').value='Example Faculty';h.$('search').fire('click');
 h.$('faculty').value='Second Faculty';h.$('faculty').fire('input');h.$('search').fire('click');assert.equal(h.pending.length,2);
 h.pending[1].resolve(result('Second result'));await tick();h.pending[0].resolve(result('Private old result'));await tick();
 assert.match(h.$('events').innerHTML,/Second result/);assert.doesNotMatch(h.$('events').innerHTML,/Private old/);
});
test('all filters clear old results and cursors; sign-out clears identity and coverage',async()=>{
 for(const id of ['start','end','mode','kind']){const h=fixture();await h.view.open();h.$('faculty').value='Example Faculty';h.$('search').fire('click');h.pending[0].resolve({...result(),nextCursor:'50',coverage:{undatedSessions:3,undatedRoles:2}});await tick();
 h.$(id).fire('change');assert.doesNotMatch(h.$('events').innerHTML,/Example event/);assert.equal(h.$('more').hidden,true);
 h.view.clear();assert.equal(h.$('faculty').value,'');assert.equal(h.$('faculty-options').innerHTML,'');assert.doesNotMatch(h.$('summary').innerHTML,/Coverage warning/);}
});
test('duplicate display names have distinct visible choices without exposing IDs',async()=>{
 const h=fixture([{facultyId:'private-uuid-one',displayName:'Same Name'},{facultyId:'private-uuid-two',displayName:'Same Name'}]);await h.view.open();
 const values=[...h.$('faculty-options').innerHTML.matchAll(/value="([^"]+)"/g)].map(x=>x[1]);assert.equal(new Set(values).size,2);assert.doesNotMatch(h.$('faculty-options').innerHTML,/private-uuid/);
 h.$('faculty').value=values[1];h.$('search').fire('click');assert.equal(h.pending[0].p.facultyId,'private-uuid-two');h.pending[0].resolve(result());await tick();
});
test('failed queries never render a successful no-results conclusion',async()=>{
 const h=fixture();await h.view.open();h.$('faculty').value='Example Faculty';h.$('search').fire('click');h.pending[0].reject(Error('SQL offline'));await tick();
 assert.match(h.$('status').textContent,/No free-time conclusion/);assert.doesNotMatch(h.$('events').innerHTML,/No PAWS commitments found/);
});

test('authorized server name search reaches Faculty beyond initial 200 and inactive history',async()=>{
 const h=fixture([], {dashboardFaculty:async p=>p?.search?[{facultyId:'historical-201',displayName:'Historical Faculty',email:'PRIVATE'}]:Array.from({length:200},(_,i)=>({facultyId:'id-'+i,displayName:'Initial '+i}))});
 await h.view.open();h.$('faculty').value='Historical';h.$('faculty').fire('input');await h.flushRoster();
 assert.equal(h.rosterCalls.at(-1).search,'Historical');assert.equal(h.rosterCalls.at(-1).status,'all');assert.match(h.$('faculty-options').innerHTML,/Historical Faculty/);assert.doesNotMatch(h.$('faculty-options').innerHTML,/PRIVATE/);
 h.$('faculty').value='Historical Faculty';h.$('search').fire('click');await tick();assert.equal(h.pending[0].p.facultyId,'historical-201');h.pending[0].resolve(result());await tick();
});
test('self service roster preserves own active scope',async()=>{
 const h=fixture(undefined,{getSelfMode:()=>true});await h.view.open();assert.equal(h.rosterCalls[0].status,'active');
});
test('date and kind edits cannot discard an initial roster load',async()=>{
 let resolve;const h=fixture([],{dashboardFaculty:()=>new Promise(r=>resolve=r)}),opening=h.view.open();
 h.$('kind').fire('change');h.$('mode').fire('change');h.$('start').fire('input');resolve([{facultyId:'first',displayName:'Example Faculty'}]);await opening;
 assert.match(h.$('faculty-options').innerHTML,/Example Faculty/);h.$('search').fire('click');assert.equal(h.pending.length,1);h.pending[0].resolve(result());await tick();
});
test('sign-out cancels queued and late roster responses',async()=>{
 let resolve;const h=fixture([],{dashboardFaculty:()=>new Promise(r=>resolve=r)}),opening=h.view.open();
 h.view.clear();resolve([{facultyId:'private-id',displayName:'Private Name'}]);await opening;assert.equal(h.$('faculty-options').innerHTML,'');
 h.$('faculty').value='Pending Name';h.$('faculty').fire('input');h.view.clear();await h.flushRoster();assert.equal(h.rosterCalls.length,1);assert.equal(h.$('faculty').value,'');
});
