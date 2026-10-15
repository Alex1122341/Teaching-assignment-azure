'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const engine=require('../server/src/domain/doe-policy-engine');

function book(){
  const context={window:{}};
  vm.runInNewContext(fs.readFileSync('faculty-admin-doe-rulebook.js','utf8'),context,{filename:'faculty-admin-doe-rulebook.js'});
  return context.window.UCVM_FACULTY_DOE_RULEBOOK.create({editable:()=>true});
}
function lecture(){
  return {
    ruleKey:'teaching_lecture_2026_27',category:'teaching',calculationMode:'per_hour',
    resultKind:'credit',priority:100,enabled:true,
    selectors:[{field:'teachingRole',operator:'equals',valueText:'Lecture'}],
    inputs:[{inputName:'hours',required:true,source:'SessionAssignment.CreditedHours'}],
    parameters:[{name:'rate',valueNumber:0.3,valueText:null}]
  };
}
function fields(value,basis){
  return {querySelector:selector=>{
    if(selector==='[data-doe-session-weight]')return{value:String(value)};
    if(selector==='[data-doe-session-basis]')return{value:basis};
    return null;
  }};
}
test('Rule Book groups Lectures & Labs and displays the actual per-hour weight',()=>{
  const view=book(),rule=lecture(),details=view.describeRule(rule);
  assert.equal(details.group,'Lectures & Labs');
  assert.equal(details.quickSession,true);
  assert.match(details.rate,/Weight 0\.3% per credited hour/);
});
test('Admin weight/basis converts per-hour lecture into a safe existing fixed per-session rule',()=>{
  const view=book(),old=lecture(),current=JSON.parse(JSON.stringify(old));
  view.applySessionWeight(current,old,fields(1.25,'per_session'),true);
  assert.equal(current.calculationMode,'fixed');
  assert.equal(current.parameters.find(x=>x.name==='fixed').valueNumber,1.25);
  assert.equal(current.parameters.some(x=>x.name==='rate'),false);
  assert.equal(current.inputs.some(x=>x.inputName==='hours'),false);
  const result=engine.calculate({version:{academicYear:'2026-27'},rules:[current],exceptions:[]},
    {category:'teaching',teachingRole:'Lecture',hours:4,academicYear:'2026-27'});
  assert.equal(result.resultDoe,1.25);
});
test('Changing back to per-hour uses a supplied credited-hours fact',()=>{
  const view=book(),old=lecture(),current=JSON.parse(JSON.stringify(old));
  view.applySessionWeight(current,old,fields(0.35,'per_hour'),true);
  assert.equal(current.calculationMode,'per_hour');
  const result=engine.calculate({version:{academicYear:'2026-27'},rules:[current],exceptions:[]},
    {category:'teaching',teachingRole:'Lecture',hours:2,academicYear:'2026-27'});
  assert.equal(result.resultDoe,0.7);
});
test('Rate editors reject invalid weights and never accept negative teaching credit',()=>{
  const view=book(),old=lecture();
  for(const bad of ['','-0.1','Infinity','NaN']){
    assert.throws(()=>view.applySessionWeight(JSON.parse(JSON.stringify(old)),old,fields(bad,'per_hour'),true),/Weight must/);
  }
  assert.equal(view.describeRule({...old,category:'research'}).quickSession,false);
});

test('Simple list shows editable Weight / Credit Per and keeps Restrictions collapsed',()=>{
  const view=book(),rule={...lecture(),ruleLabel:'Lectures'};
  const row=view.renderSimpleRow(rule,0);
  assert.match(row,/data-doe-inline-weight/);
  assert.match(row,/data-doe-inline-basis/);
  assert.match(row,/option value="per_hour" selected/);
  assert.match(row,/Session \/ Faculty assignment/);
  const grouped=view.renderGroupedRows([{row:rule,index:0}]);
  assert.match(grouped,/<details class="doe-excel-rule-group" open>/);
  assert.match(grouped,/<summary><strong>Lectures &amp; Labs<\/strong>/);
  assert.match(grouped,/<details class="doe-excel-rule-advanced"><summary>Advanced Settings<\/summary>/);
  assert.match(grouped,/Applies when:/);
  assert.match(grouped,/Priority:/);
  assert.doesNotMatch(grouped,/data-doe-inline-weight[^>]*value="[^"]*"[^>]*disabled/);
});
test('Active Rule Book displays read-only weight and rate basis fields',()=>{
  const context={window:{}};
  vm.runInNewContext(fs.readFileSync('faculty-admin-doe-rulebook.js','utf8'),context,{filename:'faculty-admin-doe-rulebook.js'});
  const view=context.window.UCVM_FACULTY_DOE_RULEBOOK.create({editable:()=>false});
  const row=view.renderSimpleRow(lecture(),0);
  assert.match(row,/data-doe-inline-weight[^>]*disabled/);
  assert.match(row,/data-doe-inline-basis[^>]*disabled/);
});
test('Non-session teaching rates use stable units and cannot switch calculation mode via simple edit',()=>{
  const view=book(),rotation={ruleKey:'clinical_participant_2026_27',ruleLabel:'Rotation Participant',
    category:'rotation',resultKind:'credit',calculationMode:'per_week',reviewStatus:'approved',
    priority:300,referenceId:'approved-guideline',selectors:[{field:'roleType',operator:'equals',valueText:'Rotation Participant'}],
    inputs:[{inputName:'weeks',required:true,source:'source.weekCount'}],
    parameters:[{name:'rate',valueNumber:2.5,valueText:null}]};
  const details=view.describeRule(rotation);
  assert.equal(details.simple,true);
  assert.equal(details.unit,'Week');
  const row=view.renderSimpleRow(rotation,7);
  assert.match(row,/>Week<\/span>/);
  assert.doesNotMatch(row,/data-doe-inline-basis/);
  const next=view.applySimpleRate(rotation,{weight:'2.75'});
  assert.equal(rotation.parameters[0].valueNumber,2.5);
  assert.equal(next.parameters[0].valueNumber,2.75);
  assert.deepEqual(JSON.parse(JSON.stringify(next.selectors)),JSON.parse(JSON.stringify(rotation.selectors)));
  assert.equal(next.priority,300);
  assert.equal(next.referenceId,rotation.referenceId);
  assert.throws(()=>view.applySimpleRate(rotation,{weight:'3',mode:'per_shift'}),/Advanced Settings/);
});
test('Simplified updates retain scope and source when switching from per hour to per session',()=>{
  const view=book(),source={...lecture(),referenceId:'guidelines-2026-27',reviewStatus:'approved',
    selectors:[{field:'sessionType',operator:'equals',valueText:'LEC'},{field:'courseCode',operator:'equals',valueText:'VTMD201'}],
    inputs:[{inputName:'hours',required:true,source:'SessionAssignment.CreditedHours'}]};
  const changed=view.applySimpleRate(source,{weight:'1.25',mode:'fixed'});
  assert.equal(changed.calculationMode,'fixed');
  assert.deepEqual(JSON.parse(JSON.stringify(changed.selectors)),JSON.parse(JSON.stringify(source.selectors)));
  assert.equal(changed.referenceId,'guidelines-2026-27');
  assert.equal(changed.reviewStatus,'approved');
  assert.equal(changed.priority,100);
  assert.equal(changed.parameters[0].name,'fixed');
  assert.equal(changed.parameters[0].valueNumber,1.25);
  assert.equal(changed.inputs.length,0);
  assert.equal(source.inputs.length,1);
  assert.throws(()=>view.applySimpleRate(source,{weight:-1,mode:'fixed'}),/nonnegative/);
  assert.throws(()=>view.applySimpleRate(source,{weight:'',mode:'fixed'}),/nonnegative/);
});
test('Advanced-only and non-teaching rules cannot be edited with the simple Weight control',()=>{
  const view=book();
  const base=lecture();
  for(const changed of [
    {...base,category:'research'},
    {...base,resultKind:'target'},
    {...base,calculationMode:'formula',formulaText:'hours * rate'},
    {...base,parameters:[{name:'rate',valueNumber:0.3},{name:'cap',valueNumber:5}]},
    {...base,tiers:[{fromValue:0,toValue:10,rate:0.3}]}
  ]){
    assert.equal(view.describeRule(changed).simple,false);
    assert.throws(()=>view.applySimpleRate(changed,{weight:'0.5'}),/Advanced Settings/);
    assert.doesNotMatch(view.renderSimpleRow(changed,0),/data-doe-inline-weight/);
  }
});
