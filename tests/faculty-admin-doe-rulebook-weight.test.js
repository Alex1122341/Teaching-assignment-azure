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
