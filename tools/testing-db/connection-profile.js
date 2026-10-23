'use strict';
// Administrative tools never expose an unguarded arbitrary SQL entrypoint.
const path = require('node:path');
const { resolveEnvironment } = require('../../server/src/runtime/environment');
const { resolveSqlTarget, compileTargetGuard, EnvironmentConfigurationError } = require('../../server/src/runtime/sql-environment-target');
const { buildSqlConnectionConfig } = require('../../server/src/data/sql-connection');
const { assertScopedSql } = require('./university-migration-adapter');

const BASE_GUARD = `IF DB_NAME() COLLATE Latin1_General_100_BIN2 <> @pawsTargetDatabase COLLATE Latin1_General_100_BIN2
 OR COALESCE(UPPER(CONVERT(nvarchar(128),SERVERPROPERTY(N'ServerName'))),N'') COLLATE Latin1_General_100_BIN2 <> @pawsTargetServer COLLATE Latin1_General_100_BIN2
 THROW 55880, 'SQL environment target rejected.', 1;
`;
const STATE_SQL = `/* PAWS_TESTING_INSPECT_STATE */
SELECT DB_NAME() AS databaseName,
 CONVERT(nvarchar(128),SERVERPROPERTY(N'ServerName')) AS physicalServer,
 HAS_PERMS_BY_NAME(DB_NAME(),N'DATABASE',N'VIEW DEFINITION') AS canViewDefinition,
 (SELECT COUNT(*) FROM sys.objects WHERE is_ms_shipped=0) AS userObjects,
 (SELECT COUNT(*) FROM sys.schemas WHERE schema_id BETWEEN 5 AND 16383) AS userSchemas,
 CASE WHEN OBJECT_ID(N'paws_env.EnvironmentIdentity',N'U') IS NULL THEN 0 ELSE 1 END AS hasMarker;`;
const INITIALISE_SQL = `/* PAWS_TESTING_INITIALISE */
SET XACT_ABORT ON;
BEGIN TRY
 BEGIN TRANSACTION;
 IF COALESCE(HAS_PERMS_BY_NAME(DB_NAME(),N'DATABASE',N'VIEW DEFINITION'),0)<>1
  OR EXISTS(SELECT 1 FROM sys.objects WHERE is_ms_shipped=0)
  OR EXISTS(SELECT 1 FROM sys.schemas WHERE schema_id BETWEEN 5 AND 16383)
  OR SCHEMA_ID(N'paws_env') IS NOT NULL
  THROW 55880, 'Testing database is not provably empty.', 1;
 EXEC(N'CREATE SCHEMA paws_env');
 EXEC(N'CREATE TABLE paws_env.EnvironmentIdentity (
  Environment nvarchar(16) NOT NULL CHECK(Environment=N''testing''),
  EnvironmentId uniqueidentifier NOT NULL PRIMARY KEY,
  CreatedAtUtc datetime2(7) NOT NULL DEFAULT SYSUTCDATETIME(),
  Note nvarchar(200) NOT NULL DEFAULT N''PAWS Testing database: synthetic data only'');');
 EXEC sys.sp_executesql N'INSERT paws_env.EnvironmentIdentity(Environment,EnvironmentId) VALUES(N''testing'',CONVERT(uniqueidentifier,@id));',
  N'@id nvarchar(36)', @id=@pawsTargetEnvironmentId;
 COMMIT TRANSACTION;
END TRY
BEGIN CATCH
 IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;
 THROW;
END CATCH;`;

async function connectTestingProfile(env, dependencies = {}) {
  const environment = resolveEnvironment(env), target = resolveSqlTarget(env);
  if (!environment.testing || target?.profile !== 'university-testing') throw new EnvironmentConfigurationError('Administrative connector requires University Testing profile');
  const guard = compileTargetGuard(target);
  const sql = dependencies.sql || require(path.join(__dirname,'../../server/node_modules/mssql/msnodesqlv8'));
  const config = { ...buildSqlConnectionConfig({connectionString:env.PAWS_SQL_CONNECTION_STRING,driver:'msnodesqlv8'}),
    connectionTimeout:15000, requestTimeout:90000, pool:{max:1,min:1,idleTimeoutMillis:30000} };
  const native = new sql.ConnectionPool(config);
  try { await native.connect(); } catch (error) { await native.close().catch(()=>{}); throw error; }
  let resetLockActive=false;
  const lockResource='PAWS_TESTING_RESET';
  const LOCK_GUARD=`/* PAWS_TESTING_LOCK_REQUIRED */
IF COALESCE(APPLOCK_MODE(N'public',@pawsTestingResetResource,N'Session'),N'NoLock')<>N'Exclusive'
 THROW 55880, 'Testing reset session lock is not held.', 1;
`;
  async function execute(prefix, text, params = {}, internal = {}, checkLock = true) {
    if (Object.keys(params).some(key=>/^paws(?:Target|Testing)/i.test(key))) throw new Error('SQL target parameters are reserved');
    const request = native.request();
    for (const [key,value] of Object.entries({...guard.params,pawsTestingResetResource:lockResource,...params,...internal})) request.input(key,value);
    try { return await request.batch(prefix+(resetLockActive&&checkLock?LOCK_GUARD:'')+text); }
    catch(error) {
      if (error.number===55880 || error.originalError?.info?.number===55880) throw new EnvironmentConfigurationError('SQL environment target or marker rejected');
      throw error;
    }
  }
  async function guardedBatch(text, params = {}) {
    assertScopedSql(text);
    const declarations=[];
    for (const [key,value] of Object.entries(params)) {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) throw new Error('Invalid SQL parameter name');
      let type;
      if (value==null || typeof value==='string') type='nvarchar(max)';
      else if (typeof value==='boolean') type='bit';
      else if (typeof value==='number' && Number.isFinite(value)) type=Number.isSafeInteger(value)?'bigint':'float';
      else if (value instanceof Date && Number.isFinite(value.getTime())) type='datetime2(7)';
      else if (Buffer.isBuffer(value)) type='varbinary(max)';
      else throw new Error('Unsupported SQL parameter value');
      declarations.push('@'+key+' '+type);
    }
    const bindings=Object.keys(params).map(key=>'@'+key+'=@'+key);
    // CREATE VIEW/PROCEDURE/FUNCTION must start their own batch. The outer
    // guard and parameterized inner batch still execute in one SQL request.
    const statement='EXEC sys.sp_executesql @pawsTestingSql'+(declarations.length
      ? ", N'"+declarations.join(',')+"', "+bindings.join(',') : '')+';';
    return execute(guard.text,statement,params,{pawsTestingSql:text});
  }
  const pool = {close:()=>native.close(),request(){
    const params={};
    return {input(name,...values){params[name]=values.at(-1);return this;},
      batch:text=>guardedBatch(text,params),query:text=>guardedBatch(text,params)};
  }};
  async function inspectState() {
    const state=(await execute(BASE_GUARD,STATE_SQL)).recordset?.[0];
    if (!state) throw new EnvironmentConfigurationError('SQL environment metadata unavailable');
    const marker=state.hasMarker ? (await execute(BASE_GUARD,`/* PAWS_TESTING_INSPECT_MARKER */ SELECT Environment AS environment, CONVERT(varchar(36),EnvironmentId) AS environmentId FROM paws_env.EnvironmentIdentity;`)).recordset : [];
    return {...state,marker};
  }
  const connection={sql,pool,target,guardedBatch,inspectState,
    initializeMarker:()=>execute(BASE_GUARD,INITIALISE_SQL)};
  connection.withResetLock=async callback=>{
    if(resetLockActive||typeof callback!=='function')throw Error('Testing reset lock is already active or callback is invalid');
    resetLockActive=true;
    let acquired=false;
    try{
      const result=await execute(BASE_GUARD,`/* PAWS_TESTING_LOCK_ACQUIRE */
DECLARE @acquired int;
EXEC @acquired=sys.sp_getapplock @Resource=@pawsTestingResetResource,@LockMode=N'Exclusive',@LockOwner=N'Session',@LockTimeout=15000,@DbPrincipal=N'public';
SELECT @acquired AS acquired;`,{},{},false);
      if(!Number.isInteger(result.recordset?.[0]?.acquired)||result.recordset[0].acquired<0)throw Error('Testing reset lock could not be acquired');
      acquired=true;
      return await callback(connection);
    }finally{
      try{
        if(acquired)await execute(BASE_GUARD,`/* PAWS_TESTING_LOCK_RELEASE */
EXEC sys.sp_releaseapplock @Resource=@pawsTestingResetResource,@LockOwner=N'Session',@DbPrincipal=N'public';`,{},{},false);
      }finally{resetLockActive=false;}
    }
  };
  return connection;
}
module.exports={connectTestingProfile};
