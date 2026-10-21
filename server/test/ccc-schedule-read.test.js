'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createCccScheduleApi}=require('../src/ccc/ccc-schedule-api');
const {createCccScheduleFunctions}=require('../src/runtime/swa-ccc-schedule-functions');
const {createSqlCccScheduleRepository}=require('../src/data/sql-ccc-schedule-repository');
const facultyId='11111111-1111-4111-8111-111111111111';
const source={date:'2026-10-21',endDate:'2026-10-21',blockLabel:'Block 5',courseCode:'292',facultyName:'Alexandre Ellis',halfDay:1,ucid:'secret',doe:99,privateNotes:'secret'};
function harness(profile={active:true,mustChangePassword:false,baseRole:'faculty',facultyId}){
 let calls=0;
 const api=createCccScheduleApi({
  verifyToken:async token=>{if(token!=='token')throw Error('invalid');return{uid:'actor'};},
  findUser:async()=>profile,
  repository:{list:async args=>{calls++;assert.equal(args.actorFirebaseUid,'actor');return{entries:[source]};}}
 });
 return{api,calls:()=>calls};
}
test('every accepted signed-in role can read cross-faculty CCC names, including faculty self roles',async()=>{
 for(const role of ['faculty','hicc','visc','adc','lab','owner','administrator','adfa_general','adfa_regular','developer']){
  const h=harness({active:true,mustChangePassword:false,baseRole:role,facultyId});
  const r=await h.api.list('token',{academicYear:'2026-27'});
  assert.equal(r.status,200,role);
  assert.equal(h.calls(),1);
  assert.deepEqual(r.body.entries,[{date:'2026-10-21',endDate:'2026-10-21',blockLabel:'Block 5',courseCode:'292',facultyName:'Alexandre Ellis',halfDay:true}]);
  assert.doesNotMatch(JSON.stringify(r.body),/secret|doe|ucid|private|facultyId/i);
 }
});
test('unauthenticated, inactive, unsupported and unlinked faculty stop before SQL',async()=>{
 for(const [profile,token,status] of [
  [null,'token',403],[{active:false,baseRole:'faculty',facultyId},'token',403],
  [{active:true,mustChangePassword:true,baseRole:'owner'},'token',403],
  [{active:true,baseRole:'faculty'},'token',403],
  [{active:true,baseRole:'other_office'},'token',403],
  [{active:true,baseRole:'owner'},'',401],
  [{active:true,baseRole:'owner'},'bad',401]
 ]){
  const h=harness(profile);
  assert.equal((await h.api.list(token,{academicYear:'2026-27'})).status,status);
  assert.equal(h.calls(),0);
 }
});
test('closed academic-year input and no arbitrary scope/filter fields',async()=>{
 const h=harness();
 for(const query of [{},{academicYear:'2026-28'},{academicYear:'2026-2027'},{academicYear:'2026-27',facultyKey:facultyId},{academicYear:'2026-27',includeFacultyKeys:true},{academicYear:'2099-00'},{academicYear:'2026-27',doe:true}])
  assert.equal((await h.api.list('token',query)).status,400);
 assert.equal(h.calls(),0);
});
test('HTTP route disallows writes, duplicate parameters and secret filters',async()=>{
 const r=createCccScheduleFunctions({api:harness().api});
 const request=(p,method='GET',token='token')=>r({url:'https://local.test'+p,method,headers:{get:()=>token?'Bearer '+token:''}});
 const schedule=await request('/api/v1/ccc-schedule?academicYear=2026-27');
 assert.equal(schedule.status,200);
 assert.deepEqual(schedule.headers,{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});
 const deniedMethod=await request('/api/v1/ccc-schedule?academicYear=2026-27','POST');
 assert.equal(deniedMethod.status,405);assert.equal(deniedMethod.headers['Cache-Control'],'private, no-store');
 assert.equal((await request('/api/v1/ccc-schedule?academicYear=2026-27&academicYear=2027-28')).status,400);
 assert.equal((await request('/api/v1/ccc-schedule?academicYear=2026-27&facultyId=private')).status,400);
 assert.equal((await request('/api/v1/ccc-schedule')).status,400);
 assert.equal((await request('/api/v1/ccc-schedule?academicYear=2026-27','GET','')).status,401);
});
test('database adapter uses only the actor-bound read stored procedure',async()=>{
 const called=[];
 const db={query:async(sql,args)=>{called.push({sql,args});return [{responseJson:JSON.stringify({entries:[source]})}]}};
 const result=await createSqlCccScheduleRepository(db).list({actorFirebaseUid:'actor',academicYear:'2026-27'});
 assert.equal(result.entries.length,1);
 assert.match(called[0].sql,/^EXEC paws_api.ListCccSchedule/);
 assert.equal(called[0].args.actorFirebaseUid,'actor');
 assert.doesNotMatch(called[0].sql,/\b(INSERT|DELETE|UPDATE|MERGE|SELECT)\b/i);
});
test('invalid SQL payload, private SQL exception and corrupt row fail closed',async()=>{
 const make=repository=>createCccScheduleApi({verifyToken:async()=>({uid:'actor'}),findUser:async()=>({active:true,baseRole:'owner'}),repository});
 for(const list of [async()=>({entries:[{...source,date:'2026-02-30'}]}),async()=>({entries:[{...source,halfDay:'yes'}]}),async()=>({entries:[...Array(2501)].map(()=>source)}),async()=>{throw Error('secret SQL');}]){
  const r=await make({list}).list('token',{academicYear:'2026-27'});
  assert.equal(r.status,503);assert.doesNotMatch(JSON.stringify(r),/secret|SQL/);
 }
 assert.equal((await make({list:async()=>{throw Object.assign(Error('secret'),{number:55701});}}).list('token',{academicYear:'2026-27'})).status,403);
});
test('SQL migration isolates CCC and derives half day only from explicit evidence',()=>{
 const sql=fs.readFileSync(path.resolve(__dirname,'../../database/azure-sql/057_ccc_schedule_read.sql'),'utf8');
 assert.match(sql,/a\.Category=N'ccc'/);
 assert.match(sql,/a\.StaffingKind=N'unassigned'/);
 assert.match(sql,/paws\.CalendarActivityDayTime/);
 assert.match(sql,/tm\.EvidenceCount=1/);
 assert.match(sql,/paws_runtime_read/);
 assert.doesNotMatch(sql,/\b(?:paws\.RoleAssignment|paws\.AfcRecord|paws\.DoeRuleBook)\b/i);
});
