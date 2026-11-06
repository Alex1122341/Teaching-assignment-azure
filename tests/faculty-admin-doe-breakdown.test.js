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

test('Lookup shows Training Actual, Training Reserve and Applied Trainee DOE as distinct server values',()=>{
  const view=worksheetView();
  const worksheet={academicYear:'2026-27',status:'calculated',lines:[teaching('LEC','Lecture',2,.6)],
    reserve:{initialTraineeReserve:5,appliedSupervision:10},
    totals:{rawSupervisionDoe:25,appliedSupervisionDoe:10,assignedTeachingDoe:10.6}};
  const data=view.buildLookupBreakdown(worksheet);
  assert.equal(data.trainingReserve,5);
  const html=view.renderLookupBreakdown(worksheet);
  assert.match(html,/<th>Training Actual<\/th><td><\/td><td>25\.00%<\/td>/);
  assert.match(html,/<th>Training Reserve<\/th><td><\/td><td>5\.00%<\/td>/);
  assert.match(html,/<th>Applied Trainee DOE<\/th><td><\/td><td>10\.00%<\/td>/);
  assert.doesNotMatch(html,/Trainee Actual \(Raw\)|Trainee Applied after Reserve/);
});

test('Lookup preserves zero and shows missing Training Reserve as Needs Review without estimating it',()=>{
  const view=worksheetView();
  const base={status:'calculated',lines:[teaching('LEC','Lecture',1,.3)],
    totals:{rawSupervisionDoe:0,appliedSupervisionDoe:0,assignedTeachingDoe:.3}};
  assert.match(view.renderLookupBreakdown({...base,reserve:{initialTraineeReserve:0}}),/<th>Training Reserve<\/th><td><\/td><td>0\.00%<\/td>/);
  assert.match(view.renderLookupBreakdown(base),/<th>Training Reserve<\/th><td><\/td><td>Needs Review<\/td>/);
});
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
  assert.match(html,/Total \(Without Trainees\)/);
  assert.match(html,/15\.97%/);
  assert.match(html,/20\.47%/);
  assert.match(html,/4th Year Preceptor/);
});

test('Lookup renders the Excel item titles and server teaching reserve rows in workbook order',()=>{
  const html=worksheetView().renderLookupBreakdown({academicYear:'2026-27',status:'calculated',lines:[],
    reserve:{initialAssignedTeachingReserve:7.5,assignedTeachingReserveWithBalance:11,initialTraineeReserve:7.5},
    totals:{rawSupervisionDoe:4,appliedSupervisionDoe:4}});
  for(const title of ['Courses - 0.75 - 15 Units','HICC Development (per Unit)','Year 2 (2026-27)',
    'Coordination of Designated Clinical Rotations','Undergrad: Summer Students, Interns','Undergrad: VETM 506',
    'Undergrad: IM','4th Year Preceptor','Number of Trainees','Total + Trainees']) assert.ok(html.includes(title),title);
  assert.match(html,/<th>Assigned Teaching Reserve<\/th><td><\/td><td>7\.50%<\/td>/);
  assert.match(html,/<th>Assigned Teaching Reserve \+ Balance \(if Trainees are under\)<\/th><td><\/td><td>11\.00%<\/td>/);
  assert.ok(html.indexOf('Total (Without Trainees)') < html.indexOf('Trainees &amp; Supervision'));
});

test('Excel breakdown folds each business group independently while retaining visible teaching and trainee totals',()=>{
  const html=worksheetView().renderLookupBreakdown({academicYear:'2026-27',status:'calculated',
    lines:[teaching('LEC','Lecture',2,.6)],reserve:{initialAssignedTeachingReserve:5,initialTraineeReserve:5},
    totals:{rawSupervisionDoe:0,appliedSupervisionDoe:0,assignedTeachingDoe:.6}});
  const groups=[...html.matchAll(/<details class="doe-excel-group"><summary>(.*?)<\/summary>([\s\S]*?)<\/details>/g)];
  assert.equal(groups.length,8);
  assert.deepEqual(groups.map(group=>group[1]),[
    'Lectures &amp; Labs · 1 source line','Course Coordination · 0 source lines',
    'DVM HICC Course Development · 0 source lines','VISC Coordination · 0 source lines',
    'Clinical Rotations · 0 source lines','Other · 0 source lines','Approved Manual DOE · 0 source lines',
    'Trainees &amp; Supervision · 0 source lines'
  ]);
  assert.match(groups[0][2],/<td>Lectures<\/td><td>2 hrs<\/td><td>0\.60%<\/td>/);
  const visible=html.replace(/<details class="doe-excel-group">[\s\S]*?<\/details>/g,'');
  for(const label of ['Assigned Teaching Reserve','Total (Without Trainees)','Training Actual','Training Reserve','Applied Trainee DOE','Total + Trainees'])assert.ok(visible.includes(label),label);
});

test('trainee group count reflects one source snapshot rather than seven expanded credit rows',()=>{
  const html=worksheetView().renderLookupBreakdown({academicYear:'2026-27',status:'calculated',lines:[{
    sourceEntityType:'supervision_source_snapshot',category:'supervision',resultDoe:3,status:'source_snapshot',
    facts:{sourceRef:{columns:'D,F,H,K,N,P,R'},counts:[1,0,0,0,1,0,0],categoryCredits:[1,0,0,0,2,0,0]}
  }],totals:{rawSupervisionDoe:3,appliedSupervisionDoe:3}});
  assert.match(html,/<summary>Trainees &amp; Supervision · 1 source line<\/summary>/);
});

test('View source opens closed calculation ancestors and focuses the exact provenance row',async()=>{
  const worksheet={facultyId:'faculty-1',academicYear:'2026-27',lines:[{...other('role','HICC',null),lineId:'role-1'}],totals:{}};
  const context={window:{}};
  vm.runInNewContext(fs.readFileSync(repositoryPath(process.cwd(),'faculty-admin-doe-worksheet.js'),'utf8'),context);
  const view=context.window.UCVM_FACULTY_DOE_WORKSHEET.create({api:{doeWorksheet:async()=>worksheet},escapeHtml:v=>String(v??''),formatDoe:v=>v===null?'Needs Review':v+'%',finiteDoe:v=>v==null?null:Number(v),getFaculty:()=>[],getAcademicYear:()=> '2026-27',editAction:()=>'',onView:()=>{}});
  const anchor=view.buildSourceIssues(worksheet)[0].anchor;
  const outer={open:false,parentElement:null}, inner={open:false,parentElement:{closest:()=>outer}};
  let focused=false,scrolled=false,prevented=false,handler;
  const row={closest:()=>inner,focus(){focused=true;},scrollIntoView(){scrolled=true;}};
  const panel={isConnected:true,innerHTML:'',addEventListener(type,fn){if(type==='click')handler=fn;},querySelector(selector){assert.equal(selector,'#'+anchor);return row;}};
  await view.loadDetail('faculty-1','2026-27',panel,()=>true);
  assert.equal(typeof handler,'function');
  handler({target:{closest:()=>({getAttribute:()=> '#'+anchor})},preventDefault(){prevented=true;}});
  assert.equal(inner.open,true);assert.equal(outer.open,true);
  assert.equal(focused,true);assert.equal(scrolled,true);assert.equal(prevented,true);
});

test('Lookup displays seven source-confirmed trainee rows without adding the snapshot twice',()=>{
  const view=worksheetView();
  const line={sourceEntityType:'supervision_source_snapshot',category:'supervision',resultDoe:17.5,status:'source_snapshot',
    facts:{sourceRef:{columns:'D,F,H,K,N,P,R'},counts:[2,0,0,0,2,1,5],categoryCredits:[2,0,0,0,6,2,7.5]}};
  const fixture={academicYear:'2026-27',status:'calculated',lines:[teaching('LEC','Lecture',1.5,.45),line],
    reserve:{initialTraineeReserve:7.5},totals:{rawSupervisionDoe:17.5,appliedSupervisionDoe:7.5}};
  const result=view.buildLookupBreakdown(fixture);
  const items=new Map(result.groups.at(-1).items.map(item=>[item.key,item]));
  assert.equal(items.get('grad_primary').quantity,2);
  assert.equal(items.get('grad_primary').amount,6);
  assert.equal(items.get('vetm506').amount,0);
  assert.equal(items.get('supervision_unknown').rows,0);
  assert.equal(result.withTrainees,7.95);
  const inconsistent={...line,resultDoe:18};
  const fallback=view.buildLookupBreakdown({...fixture,lines:[inconsistent]});
  assert.equal(fallback.groups.at(-1).items.find(x=>x.key==='supervision_unknown').amount,18);
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
test('Lookup places the explicitly named positive allocation under Special Activities once',()=>{
  const lines=[{sourceEntityType:'manual_doe_assignment',category:'adjustment',roleType:'Special Project',
    scopeText:'Special Activities',resultDoe:3.5,status:'manual'}];
  const result=worksheetView().buildLookupBreakdown({lines,status:'calculated',totals:{appliedSupervisionDoe:0}});
  assert.equal(result.groups.find(group=>group.title==='Other').items[1].quantity,3.5);
  assert.equal(result.groups.find(group=>group.title==='Approved Manual DOE').items[0].rows,0);
  assert.equal(result.without,3.5);
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

test('source issues identify classified unresolved lines with honest amounts and scoped source anchors',()=>{
  const worksheet={facultyId:'faculty-1',displayName:'Sample, Avery',academicYear:'2026-27',status:'needs_review',
    lines:[{...other('role','HICC',null,{sourceRef:{sheet:'HICCs',row:18,column:'E'}}),lineId:'role-1',scopeText:'VTMD 304',calculatedDoe:6,reviewReason:'source-allocation-missing',requiresReview:true}],
    errors:[{lineId:'role-1',message:'The approved source allocation is missing.'}],totals:{}};
  const view=worksheetView(), issues=view.buildSourceIssues(worksheet);
  assert.equal(issues.length,1);
  assert.equal(issues[0].faculty,'Sample, Avery');
  assert.equal(issues[0].scope,'VTMD 304');
  assert.equal(issues[0].expected,null);
  assert.equal(issues[0].recorded,null);
  assert.equal(issues[0].reference,6);
  assert.equal(issues[0].delta,null);
  assert.equal(issues[0].sourceCell,'HICCs!E18');
  const html=view.renderSourceIssues(worksheet);
  assert.match(html,/The approved source allocation is missing/);
  assert.match(html,/Full-year \/ calculator reference/);
  assert.match(html,/N\/A/);
  assert.match(html,new RegExp('href="#'+issues[0].anchor+'"'));
  assert.notEqual(issues[0].anchor,view.buildSourceIssues({...worksheet,academicYear:'2027-28'})[0].anchor);
});

test('issue comparisons use explicit approved expectations, not an automatic full-year proration',()=>{
  const view=worksheetView();
  const worksheet={lines:[{...other('role','Course Coordinator',1.75),expectedDoe:1.75,calculatedDoe:3.5,requiresReview:true,hasTemporalWindow:true}]};
  const issue=view.buildSourceIssues(worksheet)[0];
  assert.equal(issue.recorded,1.75);
  assert.equal(issue.expected,1.75);
  assert.equal(issue.reference,3.5);
  assert.equal(issue.delta,0);
  assert.equal(view.buildSourceIssues({lines:[{...worksheet.lines[0],expectedDoe:undefined}]})[0].delta,null);
  const calculatedOnly={...worksheet.lines[0],sourceEntityType:'legacy_role_assignment',storedDoe:null,overrideDoe:null,legacyResultDoe:null};
  assert.equal(view.buildSourceIssues({lines:[calculatedOnly]})[0].recorded,null);
});

test('unclassified and explicitly excluded records are actionable and all source text is escaped',()=>{
  const view=worksheetView();
  const html=view.renderSourceIssues({facultyId:'<bad>',displayName:'<img onerror=bad>',academicYear:'2026-27',lines:[
    {...other('role','<script>bad</script>',2),scopeText:'<b>scope</b>',facts:{sourceRef:{sheet:'<sheet>',column:'D',row:12}}},
    other('research','Research',5)
  ]});
  assert.match(html,/Unclassified Teaching source/);
  assert.match(html,/Excluded from Teaching/);
  assert.match(html,/&lt;script&gt;/);
  assert.match(html,/&lt;sheet&gt;!D12/);
  assert.doesNotMatch(html,/<img|<script|<b>/);
  assert.equal(view.renderSourceIssues({lines:[]}), '');
});

test('rendered worksheet source links reveal a focusable actual provenance row',async()=>{
  const worksheet={facultyId:'faculty-1',academicYear:'2026-27',lines:[{...other('role','HICC',null),lineId:'role-1',scopeText:'VTMD 304'}],totals:{}};
  const context={window:{}};
  vm.runInNewContext(fs.readFileSync(repositoryPath(process.cwd(),'faculty-admin-doe-worksheet.js'),'utf8'),context);
  const view=context.window.UCVM_FACULTY_DOE_WORKSHEET.create({api:{doeWorksheet:async()=>worksheet},escapeHtml:v=>String(v??''),formatDoe:v=>v===null?'Needs Review':v+'%',finiteDoe:v=>v==null?null:Number(v),getFaculty:()=>[],getAcademicYear:()=> '2026-27',editAction:()=>'',onView:()=>{}});
  const panel={isConnected:true,innerHTML:''};
  await view.loadDetail('faculty-1','2026-27',panel,()=>true);
  const anchor=view.buildSourceIssues(worksheet)[0].anchor;
  assert.match(panel.innerHTML,new RegExp('id="'+anchor+'" tabindex="-1"'));
  assert.match(panel.innerHTML,new RegExp('href="#'+anchor+'"'));
});
