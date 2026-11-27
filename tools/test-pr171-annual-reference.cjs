'use strict';
// Four non-personal, generic rules from the verified 2026-27 Active Revision 2
// source, read-only on 2026-11-25. No source Faculty, assignments, exceptions,
// actual balances, or private MASTER rows are copied. Synthetic IDs and facts.
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {createSqlDoeEngineRepository}=require('../server/src/data/sql-doe-engine-repository');
const {createDoeCalculationService}=require('../server/src/doe/doe-calculation-service');
const year='2026-27';
const stepped='(min(1, floor(trainees)) + min(1, ceil(max(0, trainees - 1)))) * rate';
const rules=[
 {key:'ccc_shift_2026_27',category:'rotation',activity:'CCC: 0.5% per confirmed shift',mode:'formula',formula:'shifts * rate - halfDayDeduction',rate:0.5,field:'roleType',value:'CCC',inputs:['halfDayDeduction','shifts']},
 {key:'supervision_im_2026_27',category:'supervision',activity:'IM: 0 trainees=0%; 1=0.5%; >1=1%',mode:'formula',formula:stepped,rate:0.5,field:'activityType',value:'IM',inputs:['trainees']},
 {key:'supervision_vetm_506_2026_27',category:'supervision',activity:'VETM 506: 0 trainees=0%; 1=0.5%; >1=1%',mode:'formula',formula:stepped,rate:0.5,field:'activityType',value:'VETM 506',inputs:['trainees']},
 {key:'supervision_graduate_primary_2026_27',category:'supervision',activity:'Graduate Primary Supervisor',mode:'per_trainee',formula:null,rate:3,field:'activityType',value:'Graduate Primary Supervisor',inputs:['trainees']}
];
async function runAnnualReference(db){
 // Caller has already checked the disposable container and unique marker.
 assert.equal(process.env.GITHUB_ACTIONS,'true');
 const marker=process.env.PAWS_BROWSER_TEST_MARKER;
 assert.match(marker||'',/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i);
 const mark=await db.query('SELECT CONVERT(varchar(36),Marker) AS marker FROM dbo.PawsBrowserDisposableMarker WHERE Marker=@marker',{marker});
 assert.equal(mark.length,1);assert.equal(mark[0].marker.toLowerCase(),marker.toLowerCase());
 const policy=randomUUID();
 await db.query(`
 UPDATE paws.DoePolicyVersion SET Active=0,Status=N'archived' WHERE AcademicYear=@year AND Status=N'active';
 INSERT paws.DoePolicyVersion(PolicyVersionId,AcademicYear,VersionLabel,SourceReference,Active,Status,Revision)
 VALUES(@policy,@year,N'Synthetic subset of 2026-27 Active Revision 2',N'Read-only verified generic policy formula/parameter subset 2026-11-25',1,N'active',2);
 `,{policy,year});
 for(const rule of rules){
  const ruleId=randomUUID();
  await db.query(`
   INSERT paws.DoePolicyRule(RuleId,PolicyVersionId,AcademicYear,RuleKey,Category,ActivityType,RuleLabel,Priority,CalculationMode,FormulaText,ResultKind,Enabled,ReviewStatus)
   VALUES(@ruleId,@policy,@year,@key,@category,@activity,@activity,100,@mode,@formula,N'credit',1,N'approved');
   INSERT paws.DoeRuleParameter(ParameterId,RuleId,Name,ValueNumber) VALUES(NEWID(),@ruleId,N'rate',@rate);
   INSERT paws.DoeRuleSelector(SelectorId,RuleId,FieldName,Operator,ValueType,ValueText) VALUES(NEWID(),@ruleId,@field,N'equals',N'text',@value);
  `,{ruleId,policy,year,key:rule.key,category:rule.category,activity:rule.activity,mode:rule.mode,formula:rule.formula,rate:rule.rate,field:rule.field,value:rule.value});
  for(const input of rule.inputs)await db.query("INSERT paws.DoeRuleInput(RuleInputId,RuleId,InputName,Required) VALUES(NEWID(),@ruleId,@input,1)",{ruleId,input});
 }
 const repository=createSqlDoeEngineRepository(db);
 const bundle=await repository.loadActivePolicy(year);
 assert.equal(String(bundle.version.policyVersionId).toLowerCase(),policy);
 assert.equal(Number(bundle.version.revision),2);
 assert.equal(bundle.rules.length,4);
 const calculator=createDoeCalculationService({repository});
 const cases=[
  {rule:rules[0],facts:{shifts:24,halfDayDeduction:0.25},expected:11.75},
  {rule:rules[0],facts:{shifts:0,halfDayDeduction:0},expected:0},
  {rule:rules[0],facts:{shifts:2,halfDayDeduction:0.25},expected:0.75},
  {rule:rules[0],facts:{shifts:2},missing:true},
  ...rules.slice(1,3).flatMap(rule=>[[0,0],[1,0.5],[2,1],[5,1]].map(([trainees,expected])=>({rule,facts:{trainees},expected})).concat([{rule,facts:{},missing:true}])),
  {rule:rules[3],facts:{trainees:2},expected:6},
  {rule:rules[3],facts:{trainees:0},expected:0},
  {rule:rules[3],facts:{},missing:true}
 ];
 const checked=[];
 for(const row of cases){
  const facts={category:row.rule.category,[row.rule.field]:row.rule.value,...row.facts};
  if(row.missing){
   await assert.rejects(calculator.preview({academicYear:year,facts}),e=>e.code==='REQUIRED_INPUT_MISSING');
   checked.push({rule:row.rule.key,facts,expected:'REQUIRED_INPUT_MISSING',status:'passed'});
  }else{
   const result=await calculator.preview({academicYear:year,facts});
   assert.equal(result.ruleKey,row.rule.key);assert.equal(result.status,'calculated');
   assert.equal(Number(result.resultDoe),row.expected);
   checked.push({rule:row.rule.key,facts,expected:row.expected,actual:Number(result.resultDoe),status:'passed'});
  }
 }
 console.log('PR171_ANNUAL_REFERENCE_SUBSET_OK '+JSON.stringify({rules:rules.length,cases:checked.length}));
 return {source:'2026-27 Active Revision 2, generic non-personal rule subset read 2026-11-25',rules:rules.length,cases:checked,limitations:'Rule-level preview only: no full annual policy, exception, reserve, per-person balance, MASTER reconciliation, actual University runtime identity or persisted annual totals.'};
}
module.exports={runAnnualReference};
