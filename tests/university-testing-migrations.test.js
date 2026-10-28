'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const adapterFile = path.join(root, 'tools/testing/db/university-migration-adapter.js');
const connectorFile = path.join(root, 'tools/testing/db/connection-profile.js');
const adapter = fs.existsSync(adapterFile) ? require(adapterFile) : {};
const connector = fs.existsSync(connectorFile) ? require(connectorFile) : {};
const { resolveSqlTarget } = require('../server/src/runtime/sql-environment-target');
const reset = require('../tools/testing/db/reset-testing-db');
const UUID = '7e570000-0000-4000-8000-00000000c0de';
const env = {
  PAWS_ENVIRONMENT: 'testing', PAWS_TESTING_SQL_PROFILE: 'university-testing',
  PAWS_TESTING_SQL_SERVER: 'itappvetopsdb01', PAWS_TESTING_DATABASE: 'VetMed-Ops-Testing',
  PAWS_TESTING_ENVIRONMENT_ID: UUID, FIREBASE_PROJECT_ID: 'paws-testing', PAWS_SQL_DRIVER: 'msnodesqlv8',
  PAWS_SQL_CONNECTION_STRING: 'Server=ITAPPVETOPSDB01;Database=VetMed-Ops-Testing;Encrypt=true;TrustServerCertificate=false'
};
const target = resolveSqlTarget(env);
const canonical = text => text.replace(/\r\n/g, '\n');
const hash = text => crypto.createHash('sha256').update(canonical(text)).digest('hex');
function api(object, name) { assert.equal(typeof object[name], 'function', `${name} must implement the approved Testing migration boundary`); return object[name]; }
function files() {
  const migrations = fs.readdirSync(path.join(root, 'database/azure-sql')).filter(file => /^\d{3}_.*\.sql$/.test(file) && !/(rollback|_proof|_acceptance)/.test(file));
  return [...migrations.map(file => ({file, path:path.join(root,'database/azure-sql',file)})),
    ...['seed-base.sql','seed-ta.sql','seed-readers.sql'].map(file => ({file,path:path.join(root,'tools/testing/db',file)}))];
}

test('enumerated forward migrations adapt only recognized database guards and preserve source files', () => {
  const adapt = api(adapter, 'adaptUniversitySql');
  const manifest = JSON.parse(fs.readFileSync(path.join(root,'tools/testing/db/university-guard-manifest.json'),'utf8'));
  assert.equal(manifest.normalization, 'utf8-lf');
  assert.deepEqual(Object.keys(manifest.files).sort(), files().map(entry=>entry.file).sort());
  for (const entry of files()) {
    const text = fs.readFileSync(entry.path,'utf8'), sourceSha256 = hash(text);
    const result = adapt({file:entry.file,text,sourceSha256,target});
    assert.equal(result.sourceSha256, sourceSha256, entry.file);
    assert.equal(result.transformedSha256, hash(result.text), entry.file);
    const count = (canonical(text).match(/DB_NAME\s*\(\s*\)\s*(?:<>|!=|=)\s*N?'VetMed-Ops'/gi)||[]).length;
    assert.equal(result.guardCount, count, entry.file);
    assert.equal(result.text, canonical(text).replace(/(DB_NAME\s*\(\s*\)\s*(?:<>|!=|=)\s*N?)'VetMed-Ops'/gi, "$1'VetMed-Ops-Testing'"), entry.file);
    assert.equal(hash(fs.readFileSync(entry.path,'utf8')), sourceSha256, 'never edit '+entry.file);
    assert.equal(manifest.files[entry.file].sourceSha256, sourceSha256);
  }
});

test('an unknown guard source or hash cannot execute a migration', () => {
  const adapt = api(adapter,'adaptUniversitySql');
  const file='057_ccc_schedule_read.sql', text=fs.readFileSync(path.join(root,'database/azure-sql',file),'utf8');
  assert.throws(()=>adapt({file,text,sourceSha256:'0'.repeat(64),target}),/source|manifest/i);
  const changed=text+'\nUSE [VetMed-Ops];';
  assert.throws(()=>adapt({file,text:changed,sourceSha256:hash(changed),target}),/source|manifest|scope/i);
  assert.throws(()=>adapt({file:'unreviewed.sql',text,sourceSha256:hash(text),target}),/source|manifest/i);
  assert.throws(()=>adapt({file,text,sourceSha256:hash(text),target:{...target,database:'VetMed-Ops'}}),/target|Testing/i);
});

test('migration inventory cannot silently omit or add an approved input',()=>{
  const check=api(adapter,'assertUniversityInventory'),names=files().map(row=>row.file);
  assert.doesNotThrow(()=>check(names));
  assert.throws(()=>check(names.slice(1)),/inventory|manifest/i);
  assert.throws(()=>check([...names,'999_unknown.sql']),/inventory|manifest/i);
  assert.throws(()=>check([...names,names[0]]),/inventory|manifest/i);
});

test('scope scanner rejects context switches, cross-database statements and linked-server access', () => {
  const check=api(adapter,'assertScopedSql');
  for(const text of ['USE [VetMed-Ops]; DROP TABLE paws.Session;', 'SELECT * FROM [VetMed-Ops].paws.Session;',
    "EXEC(N'USE [VetMed-Ops]; DROP TABLE paws.Session;');", "EXEC(N'USE master\nSELECT 1;');",
    "EXEC(N'-- deferred SQL\nUSE master;');", "EXEC(N'USE master -- context switch\nSELECT 1;');", "EXEC(N'USE '+@db);", "EXEC(N'DECLARE @n int; USE master;');", "EXEC(N'; USE master;');", 'SELECT * FROM otherdb.dbo.Faculty;',
    "SELECT * FROM OPENQUERY(other_server,'SELECT 1');", 'CREATE SYNONYM paws.Private FOR otherdb.dbo.Secret;']) {
    assert.throws(()=>check(text),/scope|database|context|linked|synonym/i);
  }
  assert.doesNotThrow(()=>check("-- USE [Other];\nSELECT N'Use the selected course' AS message FROM paws.Course;"));
});

function fakeDriver(extra={}) {
  const state={databaseName:'VetMed-Ops-Testing',physicalServer:'ITAPPVETOPSDB01',canViewDefinition:1,
    userObjects:0,userSchemas:0,hasMarker:1,marker:[{environment:'testing',environmentId:UUID}],...extra};
  const calls=[],destructiveBatchCalls=[];
  let config;
  const sql={ConnectionPool:class {
    constructor(value){config=value;}
    async connect(){return this;}
    async close(){}
    request(){const params={};return {
      input(key,value){params[key]=value;return this;},
      async batch(text){
        calls.push({text,params:{...params}});
        const effectiveText=text+'\n'+(params.pawsTestingSql||'');
        extra.beforeBatch?.(effectiveText,state);
        if(params.pawsTargetDatabase!==state.databaseName || params.pawsTargetServer!==state.physicalServer) throw Object.assign(Error('SQL target rejected'),{number:55880});
        if(text.includes('PAWS_TESTING_LOCK_ACQUIRE')){state.resetLockHeld=!extra.lockDenied;return {recordset:[{acquired:extra.lockDenied?-1:1}]};}
        if(text.includes('PAWS_TESTING_LOCK_RELEASE')){state.resetLockHeld=false;return {recordset:[]};}
        if(text.includes('PAWS_TESTING_LOCK_REQUIRED')&&state.resetLockHeld!==true)throw Object.assign(Error('Reset lock lost'),{number:55880});
        if(text.includes('PAWS_TESTING_INSPECT_STATE'))return {recordset:[{...state}]};
        if(text.includes('PAWS_TESTING_INSPECT_MARKER'))return {recordset:state.marker};
        if(text.includes('PAWS_TESTING_INITIALISE')){
          if(state.canViewDefinition!==1||state.userObjects||state.userSchemas||state.hasMarker)throw Error('Database is not provably empty');
          destructiveBatchCalls.push(text);state.hasMarker=1;state.marker=[{environment:'testing',environmentId:UUID}];return {recordset:[]};
        }
        if(text.includes('PAWS_SQL_TARGET_GUARD_V1') && (state.marker.length!==1||state.marker[0].environment!=='testing'||state.marker[0].environmentId!==params.pawsTargetEnvironmentId)) throw Object.assign(Error('SQL marker rejected'),{number:55880});
        if(/DROP TABLE|CREATE TABLE/.test(effectiveText))destructiveBatchCalls.push(effectiveText);
        return {recordset:[{n:1}]};
      }
    };}
  }};
  return {sql,state,calls,destructiveBatchCalls,get config(){return config;}};
}

test('University connector selects Windows strict TLS and rechecks the target on each administrative batch', async()=>{
  const connect=api(connector,'connectTestingProfile'),h=fakeDriver();
  const c=await connect(env,{sql:h.sql});
  try{
    assert.equal(c.target.database,'VetMed-Ops-Testing');
    assert.equal(h.config.options.encrypt,true);assert.equal(h.config.options.trustServerCertificate,false);
    assert.equal(h.config.options.trustedConnection,true);
    assert.equal((await c.guardedBatch('SELECT 1 AS n')).recordset[0].n,1);
    assert.match(h.calls.at(-1).text,/PAWS_SQL_TARGET_GUARD_V1/);
    h.state.marker=[{environment:'testing',environmentId:'7e570000-0000-4000-8000-0000000000aa'}];
    await assert.rejects(c.guardedBatch('DROP TABLE paws.TestOnly;'),/marker|target|environment/i);
    assert.equal(h.destructiveBatchCalls.length,0);
    await assert.rejects(c.guardedBatch('SELECT 1',{pawsTargetDatabase:'VetMed-Ops'}),/reserved/i);
  }finally{await c.pool.close();}
});

test('guarded module DDL remains first in its own parameter-bound SQL batch',async()=>{
  const h=fakeDriver(),c=await api(connector,'connectTestingProfile')(env,{sql:h.sql});
  try {
    const ddl='CREATE VIEW paws.TestView AS SELECT 1 AS n;';
    await c.guardedBatch(ddl);
    const call=h.calls.at(-1);
    assert.match(call.text,/PAWS_SQL_TARGET_GUARD_V1[\s\S]*EXEC sys\.sp_executesql @pawsTestingSql/);
    assert.equal(call.params.pawsTestingSql,ddl,'module DDL must not have a prepended statement inside its batch');
    await assert.rejects(c.guardedBatch('SELECT @x',{'x; DROP TABLE paws.T':1}),/parameter/i);
  } finally {await c.pool.close();}
});

test('a mismatched marker cannot reset and all legacy pool entrypoints remain guarded', async()=>{
  const connect=api(connector,'connectTestingProfile'),h=fakeDriver({marker:[{environment:'production',environmentId:UUID}]});
  const c=await connect(env,{sql:h.sql});
  try{
    const state=await c.inspectState();
    assert.throws(()=>reset.decideAction(state,UUID),/different environment/i);
    await assert.rejects(c.pool.request().batch('DROP TABLE paws.TestOnly;'),/marker|target|environment/i);
    assert.equal(h.destructiveBatchCalls.length,0);
  }finally{await c.pool.close();}
});

test('fixed initialization checks emptiness again and cannot bypass a hidden or changed target', async()=>{
  const connect=api(connector,'connectTestingProfile');
  for(const extra of [{canViewDefinition:0},{userObjects:1},{userSchemas:1},{databaseName:'VetMed-Ops'},{physicalServer:'OTHER'}]){
    const h=fakeDriver({hasMarker:0,marker:[],...extra}), c=await connect(env,{sql:h.sql});
    try{await assert.rejects(c.initializeMarker(),/empty|target|environment/i);assert.equal(h.destructiveBatchCalls.length,0);}finally{await c.pool.close();}
  }
  const h=fakeDriver({hasMarker:0,marker:[]}),c=await connect(env,{sql:h.sql});
  try{
    assert.equal(reset.decideAction(await c.inspectState(),UUID,{initialiseEmpty:true}),'initialise');
    await c.initializeMarker();assert.equal(h.state.hasMarker,1);
    assert.match(h.calls.at(-1).text,/BEGIN TRANSACTION/);
    assert.match(h.calls.at(-1).text,/ROLLBACK/);
    assert.match(h.calls.at(-1).text,/COMMIT/);
    await c.guardedBatch('SELECT 1');
  }finally{await c.pool.close();}
});

test('real reset orchestration rejects wrong markers and unprovable empty databases before any destructive batch', async()=>{
  for(const extra of [
    {marker:[{environment:'production',environmentId:UUID}]},
    {marker:[{environment:'testing',environmentId:'7e570000-0000-4000-8000-0000000000aa'}]},
    {hasMarker:0,marker:[],canViewDefinition:0},
    {hasMarker:0,marker:[],userObjects:1},
    {hasMarker:0,marker:[],userSchemas:1}
  ]) {
    const h=fakeDriver(extra);
    await assert.rejects(reset.main(['--confirm-reset','--initialise-empty'],env,()=>{},{sql:h.sql}),/different environment|VIEW DEFINITION|not empty/);
    assert.ok(h.calls.some(call=>call.text.includes('PAWS_TESTING_INSPECT_STATE')),'rejection must reach the actual metadata decision');
    assert.equal(h.destructiveBatchCalls.length,0);
  }
});

test('reset rechecks a marker changed after inspection before it can drop any object',async()=>{
  const h=fakeDriver({beforeBatch(text,state){
    if (/DROP TABLE/.test(text)) state.marker=[{environment:'production',environmentId:UUID}];
  }});
  await assert.rejects(reset.main(['--confirm-reset'],env,()=>{},{sql:h.sql,beforeDestructive:async()=>true}),/target|marker|environment/i);
  assert.ok(h.calls.some(call=>/DROP TABLE/.test(call.params.pawsTestingSql||'')),'must exercise the actual reset drop attempt');
  assert.equal(h.destructiveBatchCalls.length,0);
});

test('direct University CLI reset cannot bypass the verified backup and stopped-host orchestration',async()=>{
 const h=fakeDriver();
 await assert.rejects(reset.main(['--confirm-reset'],env,()=>{},{sql:h.sql}),/orchestration|backup|administration/i);
 assert.equal(h.destructiveBatchCalls.length,0);
});

test('administrative reset lock is serialized and rechecked after a lost SQL session',async()=>{
 const h=fakeDriver(),c=await api(connector,'connectTestingProfile')(env,{sql:h.sql});
 try{
  const lock=api(c,'withResetLock');
  await lock(async scoped=>{
   await assert.rejects(c.withResetLock(async()=>{}),/lock|reset/i);
   await scoped.guardedBatch('SELECT 1');assert.match(h.calls.at(-1).text,/APPLOCK_MODE[\s\S]*PAWS_TESTING_LOCK_REQUIRED|PAWS_TESTING_LOCK_REQUIRED[\s\S]*APPLOCK_MODE/i);
   h.state.resetLockHeld=false;
   await assert.rejects(scoped.guardedBatch('DROP TABLE paws.TestOnly;'),/target|lock|environment/i);
   assert.equal(h.destructiveBatchCalls.length,0);
  });
  assert.equal(h.state.resetLockHeld,false);
  assert.equal(h.calls.at(-1).text.includes('PAWS_TESTING_LOCK_RELEASE'),true);
 }finally{await c.pool.close();}
 const denied=fakeDriver({lockDenied:true}),d=await connector.connectTestingProfile(env,{sql:denied.sql});let callbacks=0;
 try{await assert.rejects(api(d,'withResetLock')(async()=>{callbacks++;}),/lock|reset|environment/i);assert.equal(callbacks,0);}finally{await d.pool.close();}
});
