'use strict';
const { repositoryPath } = require('../tools/build/frontend-paths');
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function worksheetView(){
  const context={window:{}};
  vm.runInNewContext(fs.readFileSync(repositoryPath(process.cwd(), 'faculty-admin-doe-worksheet.js'),'utf8'),context,{filename:'faculty-admin-doe-worksheet.js'});
  return context.window.UCVM_FACULTY_DOE_WORKSHEET.create({
    api:{},escapeHtml:v=>String(v??'').replace(/[&<>"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch])),
    formatDoe:v=>v===null?'Needs Review':Number(v).toFixed(2)+'%',
    finiteDoe:v=>v===null||v===undefined||v===''?null:Number(v),
    getFaculty:()=>[],getAcademicYear:()=> '2026-27',editAction:()=>'',onView:()=>{}
  });
}
const teaching=(type,role,hours,credit)=>({category:'teaching',sourceEntityType:'legacy_session_assignment',
  roleType:role,facts:{sessionType:type},creditedHours:hours,resultDoe:credit,status:'recorded'});
const other=(category,role,resultDoe,facts={})=>({category,sourceEntityType:'legacy_role_assignment',
  roleType:role,facts,resultDoe,status:'recorded'});
test('Lookup derives the provided Excel sample from individual source lines, not hardcoded numbers',()=>{
  const lines=[
    teaching('LEC','Lecture',7.5,2.25),
    teaching('SRL','SRL',6,1.8),
    teaching('LAB','Lab Primary',24,5.04),
    teaching('LAB','Lab Secondary',27,5.13),
    other('role','Rotation Participant',1.75,{weeks:0.7}),
    other('supervision','Fourth-Year Preceptor',4.5,{trainees:6})
  ];
  const view=worksheetView();
  const data=view.buildLookupBreakdown({academicYear:'2026-27',status:'calculated',lines,
    totals:{rawSupervisionDoe:4.5,appliedSupervisionDoe:4.5,assignedTeachingDoe:20.47}});
  assert.equal(data.without,15.97);
  assert.equal(data.withTrainees,20.47);
  assert.equal(data.rawSupervision,4.5);
  assert.equal(data.groups[0].items[0].quantity,7.5);
  assert.equal(data.groups[0].items[2].quantity,24);
  assert.equal(data.groups.find(g=>g.title==='Clinical Rotations').items[0].quantity,0.7);
  const html=view.renderLookupBreakdown({academicYear:'2026-27',status:'calculated',lines,
    totals:{rawSupervisionDoe:4.5,appliedSupervisionDoe:4.5,assignedTeachingDoe:20.47}});
  assert.match(html,/Total Without Trainees/);
  assert.match(html,/15\.97%/);
  assert.match(html,/20\.47%/);
  assert.match(html,/Fourth-Year Preceptor/);
});
test('Research and Service credit cannot enter classified Assigned Teaching DOE',()=>{
  const view=worksheetView();
  const data=view.buildLookupBreakdown({status:'calculated',lines:[
    teaching('LEC','Lecture',2,0.6),
    other('research','Research',15),
    other('service_admin','Service',10)
  ],totals:{rawSupervisionDoe:0,appliedSupervisionDoe:0,assignedTeachingDoe:25.6}});
  assert.equal(data.without,0.6);
  assert.equal(data.withTrainees,null);
  assert.equal(data.excluded.length,2);
  assert.equal(data.legacyTotal,25.6);
});
test('Ambiguous HICC/Coordinator blocks a false subtotal while approved manual credit remains classified',()=>{
  const view=worksheetView();
  const data=view.buildLookupBreakdown({status:'calculated',lines:[
    teaching('LEC','Lecture',2,0.6),
    other('role','Course Coordinator / HICC (legacy ambiguous)',7),
    {sourceEntityType:'manual_doe_assignment',category:'role',roleType:'Special Project',resultDoe:-0.5,status:'manual'}
  ],totals:{rawSupervisionDoe:0,appliedSupervisionDoe:0,assignedTeachingDoe:7.1}});
  assert.equal(data.without,null);
  assert.equal(data.withTrainees,null);
  assert.equal(data.unclassified.length,1);
  assert.equal(data.groups.find(g=>g.title==='Approved Manual DOE').items[0].amount,-0.5);
});

test('CCC role takes precedence over a stale course-coordination category',()=>{
  const data=worksheetView().buildLookupBreakdown({lines:[other('course_coordination','CCC',11.75,{shifts:24})],totals:{appliedSupervisionDoe:0}});
  assert.equal(data.groups.find(g=>g.title==='Clinical Rotations').items.find(r=>r.key==='ccc').amount,11.75);
  assert.equal(data.groups.find(g=>g.title==='Course Coordination').items[0].rows,0);
});

test('structured teaching type and activity win over misleading rule labels',()=>{
  for(const [type,role,activity,key] of [['LAB','Lab Primary','Lab Primary','lab_primary'],['LAB','Lab Secondary','Lab Secondary','lab_secondary'],['LEC','Lecture','Lecture','lecture'],['SRL','SRL','SRL','srl']]) {
    const line={...teaching(type,role,2,.4),activityType:activity,ruleKey:'legacy_srl_lab_secondary_lecture'};
    const data=worksheetView().buildLookupBreakdown({lines:[line],totals:{}});
    assert.equal(data.groups[0].items.find(r=>r.key===key).rows,1,activity);
  }
});

test('seven structured supervision activities do not depend on free-text rule labels',()=>{
  const entries=[['Undergraduate Supervision','undergrad'],['VETM 506','vetm506'],['IM','im'],['4th Year Preceptor','preceptor'],['Graduate Primary Supervisor','grad_primary'],['Graduate Co-supervisor','grad_co'],['Postdoctoral Fellow','postdoc']];
  for(const [activity,key] of entries) {
    const line={...other('supervision','',1,{trainees:1}),activityType:activity,ruleKey:'legacy_vetm506_im_undergrad'};
    const data=worksheetView().buildLookupBreakdown({lines:[line],totals:{}});
    assert.equal(data.groups.at(-1).items.find(r=>r.key===key).rows,1,activity);
  }
});

test('conflicting structured lab or supervision activities remain unclassified',()=>{
  for(const line of [ {...teaching('LAB','Lab Primary',2,.4),activityType:'Lab Secondary'}, {...other('supervision','VETM 506',.5),activityType:'IM'} ]) {
    assert.equal(worksheetView().buildLookupBreakdown({lines:[line],totals:{}}).unclassified.length,1);
  }
});

test('approved signed manual allocations reconcile without invented quantities or label-based subcategories',()=>{
  const lines=[teaching('LEC','Lecture',2,.6), ...[2,-.5].map(resultDoe=>({sourceEntityType:'manual_doe_assignment',category:'role',roleType:'Early Career / Special Project',scopeText:'unverified free text',resultDoe,status:'manual'}))];
  const data=worksheetView().buildLookupBreakdown({lines,totals:{appliedSupervisionDoe:1,assignedTeachingDoe:3.1},status:'calculated'});
  const manual=data.groups.find(g=>g.title==='Approved Manual DOE').items[0];
  assert.equal(manual.amount,1.5);
  assert.equal(manual.quantity,2);
  assert.equal(manual.unit,'records');
  assert.equal(data.without,2.1);
  assert.equal(data.withTrainees,3.1);
  assert.equal(data.unclassified.length,0);
  const excluded=worksheetView().buildLookupBreakdown({lines:[{...lines[1],category:'research'}],totals:{}});
  assert.equal(excluded.excluded.length,1);
});
test('Quantity is unavailable if source fact does not provide it; never invert DOE to make up hours',()=>{
  const view=worksheetView();
  const html=view.renderLookupBreakdown({academicYear:'2026-27',status:'calculated',lines:[
    teaching('LEC','Lecture',null,0.6)
  ],totals:{rawSupervisionDoe:0,appliedSupervisionDoe:0,assignedTeachingDoe:0.6}});
  assert.match(html,/Source quantity unavailable/);
  assert.match(html,/0\.60%/);
  assert.doesNotMatch(html,/2 hrs/);
});

test('A stored credit with a source discrepancy remains Needs Review rather than completing Excel totals',()=>{
  const view=worksheetView();
  const suspect={...teaching('LEC','Lecture',2,0.6),status:'stored-calculation-mismatch',requiresReview:true};
  const data=view.buildLookupBreakdown({status:'needs_review',lines:[suspect],
    totals:{rawSupervisionDoe:0,appliedSupervisionDoe:0,assignedTeachingDoe:null}});
  assert.equal(data.without,null);
  assert.equal(data.withTrainees,null);
});

test('Canonical undergraduate supervision stays separate from graduate and co-supervised trainees',()=>{
  const view=worksheetView();
  const data=view.buildLookupBreakdown({status:'calculated',lines:[
    other('supervision','Undergraduate Supervision',1,{trainees:2}),
    other('supervision','Undergraduate co-supervised intern',0.5,{trainees:1}),
    other('supervision','Graduate Primary Supervisor',2,{trainees:1}),
    other('supervision','Graduate Co-supervisor',1,{trainees:1})
  ],totals:{rawSupervisionDoe:4.5,appliedSupervisionDoe:4.5}});
  const trainees=data.groups.find(group=>group.title==='Trainees & Supervision').items;
  assert.equal(trainees.find(row=>row.key==='undergrad').amount,1.5);
  assert.equal(trainees.find(row=>row.key==='undergrad').quantity,3);
  assert.equal(trainees.find(row=>row.key==='grad_primary').amount,2);
  assert.equal(trainees.find(row=>row.key==='grad_co').amount,1);
});

test('A generic intern label does not override explicit graduate co-supervision',()=>{
  const view=worksheetView();
  const data=view.buildLookupBreakdown({status:'calculated',lines:[
    other('supervision','Graduate Co-supervised Intern',0.5,{trainees:1})
  ],totals:{rawSupervisionDoe:0.5,appliedSupervisionDoe:0.5}});
  const trainees=data.groups.find(group=>group.title==='Trainees & Supervision').items;
  assert.equal(trainees.find(row=>row.key==='undergrad').amount,null);
  assert.equal(trainees.find(row=>row.key==='grad_co').amount,0.5);
});

test('Legacy teaching quantity uses the same explicit DOE override as the authoritative calculator',()=>{
  const view=worksheetView();
  const line={...teaching('LEC','Lecture',2,0.3),doeQuantity:1};
  const data=view.buildLookupBreakdown({status:'calculated',lines:[line],totals:{rawSupervisionDoe:0,appliedSupervisionDoe:0}});
  assert.equal(data.groups[0].items.find(row=>row.key==='lecture').quantity,1);
  const zero=view.buildLookupBreakdown({status:'calculated',lines:[{...line,doeQuantity:0}],totals:{}});
  assert.equal(zero.groups[0].items.find(row=>row.key==='lecture').quantity,0);
});

test('Rotation coordination quantity uses the calculator input uniqueRotationTypes',()=>{
  const view=worksheetView();
  const data=view.buildLookupBreakdown({status:'calculated',lines:[{
    category:'rotation',sourceEntityType:'doe_assignment',roleType:'Designated Rotation Coordinator',
    inputs:{uniqueRotationTypes:3},resultDoe:6,status:'calculated'
  }],totals:{rawSupervisionDoe:0,appliedSupervisionDoe:0}});
  const item=data.groups.find(group=>group.title==='Clinical Rotations').items.find(row=>row.key==='rotation_coordination');
  assert.equal(item.quantity,3);
  assert.equal(item.amount,6);
});
