'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {repositoryPath}=require('../tools/build/frontend-paths');
const view=()=>require(repositoryPath(__dirname,'../schedule-filter-view.js'));
const types=[{key:'teaching:LEC',label:'Lecture'},{key:'work:ccc',label:'CCC'}];
const state=extra=>({search:'',month:null,courses:null,typeKeys:types.map(x=>x.key),types,...extra});
const sourceFunction=require('../test-support/source-function');
const vm=require('node:vm');

function changeHarness(changedRange=false){
 const fields={'search-input':{value:'clinical'},'filter-month':{value:'9'}},counts={refresh:0,render:0,populate:0};
 const context={Set,$:id=>fields[id],counts,currentUser:{uid:'synthetic'},viewMode:'week',sessionUnsubscribe:()=>{},sessionRangeKey:changedRange?'week:old:range':'week:2026-11-09:2026-11-13',
  visibleSessionRange:()=>({start:'2026-11-09',end:'2026-11-13'}),render(){counts.render++;},renderActiveContentFilters(){},refreshSessionScope(){counts.refresh++;},populateCourseFilter(){counts.populate++;}};
 vm.createContext(context);vm.runInContext(`let selectedCourses=new Set(['200','202']),courseFilterActive=true,contentFilterBatch=false;
 const selectedWeek=12,selectedSemester='fall',selectedYear='3',myTimetableOnly=true;
 const activityTypeFilter={selectedKeys:()=>['teaching:LEC','work:ccc'],setSelected(keys){if(!contentFilterBatch)render();},reset(){if(!contentFilterBatch)render();}};
 ${sourceFunction('timetable.js','changeContentFilter')}
 function snapshot(){return {courses:[...selectedCourses],active:courseFilterActive,selectedWeek,selectedSemester,selectedYear,myTimetableOnly};}
 `,context);
 return {fields,counts,change:(kind,value='')=>vm.runInContext(`changeContentFilter(${JSON.stringify(kind)},${JSON.stringify(value)})`,context),snapshot:()=>JSON.parse(JSON.stringify(vm.runInContext('snapshot()',context)))};
}
test('clear content keeps period/self scope and performs exactly one scope refresh without picker rerenders',()=>{
 const h=changeHarness();h.change('clear');
 assert.deepEqual(h.snapshot(),{courses:[],active:false,selectedWeek:12,selectedSemester:'fall',selectedYear:'3',myTimetableOnly:true});
 assert.equal(h.fields['filter-month'].value,'all');assert.equal(h.fields['search-input'].value,'');
 assert.deepEqual(h.counts,{refresh:1,render:1,populate:1});
});
test('independent removals retain the other course; month alone refreshes range',()=>{
 const h=changeHarness();h.change('course','200');assert.deepEqual(h.snapshot().courses,['202']);assert.equal(h.snapshot().active,true);
 assert.deepEqual(h.counts,{refresh:0,render:1,populate:1});
 h.change('type','teaching:LEC');assert.equal(h.counts.render,2,'picker callback does not add a second render');
 h.change('month','9');assert.equal(h.counts.refresh,1);assert.deepEqual(h.snapshot().courses,['202']);
 h.change('course','202');assert.equal(h.snapshot().active,true,'removing the final selected course means NONE, not ALL');
});

test('clearing a subscribed unchanged range still repaints Calendar and activity results',async()=>{
 // Real refresh + subscribe functions execute the already-subscribed early return.
 const fields={'search-input':{value:'clinical'},'filter-month':{value:'all'}};
 const context={Set,$:id=>fields[id],currentUser:{uid:'synthetic'},viewMode:'week',sessionUnsubscribe:()=>{},sessionRangeKey:'week:2026-11-09:2026-11-13',
  visibleSessionRange:()=>({start:'2026-11-09',end:'2026-11-13'}),rendered:0,render(){context.rendered++;},renderActiveContentFilters(){},populateCourseFilter(){}};
 vm.createContext(context);vm.runInContext(`let selectedCourses=new Set(['200']),courseFilterActive=true,contentFilterBatch=false;
 const activityTypeFilter={reset(){}};
 ${sourceFunction('timetable.js','subscribeSessions')}
 ${sourceFunction('timetable.js','refreshSessionScope')}
 ${sourceFunction('timetable.js','changeContentFilter')}
 changeContentFilter('clear');`,context);
 assert.equal(context.rendered,1,'same-range subscription must not leave old filtered sessions visible');
});
test('changed month range waits for subscription render instead of loading activities twice',()=>{
 const h=changeHarness(true);h.change('month','9');
 assert.deepEqual(h.counts,{refresh:1,render:0,populate:0});
});
test('expanding period controls repositions the selected week after a hidden/narrow layout',()=>{
 let synced=0;const node={setAttribute(){},querySelector(){return null;}};
 const context={$:()=>node,syncWeekUI(){synced++;}};vm.createContext(context);
 vm.runInContext(sourceFunction('timetable.js','setScheduleFiltersExpanded')+';setScheduleFiltersExpanded(true,false);',context);
 assert.equal(synced,1);
});

test('dated week labels use the supplied academic dates including month/year boundaries',()=>{
 const {weekLabel}=view();
 assert.equal(weekLabel(9,new Date(2026,9,19),new Date(2026,9,23)),'Week 9 (Oct 19–23)');
 assert.equal(weekLabel(2,new Date(2026,7,31),new Date(2026,8,4)),'Week 2 (Aug 31–Sep 4)');
 assert.equal(weekLabel(1,new Date(2027,0,4),new Date(2027,0,8)),'Week 1 (Jan 4–8)');
});

test('chips derive all content filters without inventing period state or combining courses',()=>{
 const s=state({search:' Clinical ',month:{value:'9',label:'October'},courses:['200','202'],typeKeys:['work:ccc']});
 const chips=view().contentChips(s);
 assert.deepEqual(chips.map(x=>[x.kind,x.value]),[['search',''],['month','9'],['course','200'],['course','202'],['type','work:ccc']]);
 assert.equal(chips[0].label,'Search: Clinical');assert.equal(chips[4].label,'Type: CCC');
 assert.equal(s.courses.length,2);assert.deepEqual(view().contentChips(state()),[]);
});

test('none is distinct from all and dynamic type labels remain literal',()=>{
 assert.deepEqual(view().contentChips(state({courses:[],typeKeys:[]})).map(x=>x.kind),['restore-courses','restore-types']);
 const label='<img src=x onerror=alert(1)> '+ 'Long subject '.repeat(20);
 assert.equal(view().contentChips(state({types:[...types,{key:'teaching:custom',label}],typeKeys:['teaching:custom']}))[0].label,'Type: '+label);
});

// Minimal DOM exercises the real renderer and its event callbacks, without a browser dependency.
class Element{
 constructor(doc){this.ownerDocument=doc;this.children=[];this.attrs={};this.dataset={};this.hidden=false;this.parentNode=null;this.textContent='';}
 append(...nodes){for(const n of nodes){n.parentNode=this;this.children.push(n);}}
 replaceChildren(...nodes){this.children=[];this.append(...nodes);}
 setAttribute(k,v){this.attrs[k]=String(v);}
 contains(node){return this===node||this.children.some(c=>c.contains(node));}
 focus(){this.ownerDocument.activeElement=this;}
}
test('renderer invokes exact removal, preserves focus and safely renders full labels',()=>{
 const doc={activeElement:null,createElement(){return new Element(doc);}};
 const host=new Element(doc),fallback=new Element(doc),calls=[];
 const renderer=view().mount(host,{onRemove:(...args)=>calls.push(args),onClear:()=>calls.push(['clear']),focusFallback:fallback});
 const s=state({courses:['200','202']});renderer.render(s);
 const first=host.children[1];first.focus();first.onclick();assert.deepEqual(calls,[['course','200']]);
 renderer.render(state({courses:['202']}));assert.equal(doc.activeElement,host.children[1]);
 assert.equal(doc.activeElement.attrs['aria-label'],'Remove Course: 202');
 host.children.at(-1).onclick();assert.deepEqual(calls.at(-1),['clear']);
 renderer.render(state());assert.equal(host.hidden,true);assert.equal(doc.activeElement,fallback);
 const label='<svg onload=alert(1)>';renderer.render(state({search:label}));
 assert.equal(host.children[1].textContent,'Search: '+label+' ×');assert.equal(host.children[1].title,'Search: '+label);
});
