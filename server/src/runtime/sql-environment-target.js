'use strict';

// Connection targets are deployment configuration, never request/persona input.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UNIVERSITY_SERVER = 'ITAPPVETOPSDB01';
const TESTING_DATABASE = 'VetMed-Ops-Testing';
const PRODUCTION_DATABASE = 'VetMed-Ops';
// Exact existing University Windows endpoint; no suffix/wildcard match.
const UNIVERSITY_HOSTS = Object.freeze(['itappvetopsdb01', 'itappvetopsdb01.uc.ucalgary.ca']);
const HOST_KEYS = new Set(['server', 'datasource', 'address', 'addr', 'networkaddress']);
const DATABASE_KEYS = new Set(['database', 'initialcatalog']);

class EnvironmentConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'EnvironmentConfigurationError';
    this.code = 'ENVIRONMENT_MISCONFIGURED';
  }
}
const fail = message => { throw new EnvironmentConfigurationError(message); };

function connectionOptions(connectionString) {
  if (typeof connectionString !== 'string' || !connectionString.trim() || /[\x00-\x1f]/.test(connectionString)) {
    fail('SQL requires an explicit, unambiguous connection string');
  }
  const values = new Map();
  for (const part of connectionString.split(';')) {
    if (!part.trim()) continue;
    const at = part.indexOf('=');
    if (at < 1) fail('SQL connection contains an invalid option');
    const key = part.slice(0, at).toLowerCase().replace(/\s+/g, '');
    const logical = HOST_KEYS.has(key) ? 'server' : DATABASE_KEYS.has(key) ? 'database' : key;
    if (values.has(logical)) fail('SQL requires exactly one value per option; duplicate aliases are ambiguous');
    values.set(logical, part.slice(at + 1).trim());
  }
  return values;
}

function parseSqlTarget(connectionString) {
  const options = connectionOptions(connectionString);
  const server = options.get('server'), database = options.get('database');
  if (!server || !database) fail('SQL requires exactly one explicit server and database');
  if (/[{}'"\[\]]/.test(server + database)) fail('SQL target contains an ambiguous quoted value');
  const normal = server.replace(/^(tcp|np|lpc):/i, '').replace(/,\d+$/, '');
  const host = normal.split('\\')[0].toLowerCase();
  return { host, database };
}

function resolveSqlTarget(env = {}) {
  const name = env.PAWS_ENVIRONMENT;
  if (name !== 'testing' && name !== 'production') fail('PAWS_ENVIRONMENT must be exactly "production" or "testing"');
  if (name === 'production') {
    for (const key of ['PAWS_TESTING_ENVIRONMENT_ID', 'PAWS_TESTING_SQL_SERVER', 'PAWS_TESTING_DATABASE', 'PAWS_TESTING_SQL_PROFILE', 'PAWS_TESTING_LOCAL_ODBC']) {
      if (env[key] !== undefined) fail(`${key} is not valid in production`);
    }
    const parsed = parseSqlTarget(env.PAWS_SQL_CONNECTION_STRING);
    if (parsed.database !== PRODUCTION_DATABASE) fail('Production SQL must select the Production database');
    return Object.freeze({ profile: 'production', ...parsed,
      physicalServer: UNIVERSITY_HOSTS.includes(parsed.host) ? UNIVERSITY_SERVER : null, environmentId: null });
  }
  const profile = env.PAWS_TESTING_SQL_PROFILE;
  if (profile === undefined && env.PAWS_TESTING_DATABASE === undefined) {
    // Preserve the explicitly isolated legacy/local acceptance interfaces. They
    // still go through environment.js's original host/marker deny/allow lists.
    const host = parseSqlTarget(env.PAWS_SQL_CONNECTION_STRING).host;
    if (host === 'itappvetopsdb01' || host.startsWith('itappvetopsdb01.')) fail('University Testing requires an explicit university-testing profile');
    return null;
  }
  if (profile !== 'university-testing') fail('PAWS_TESTING_SQL_PROFILE must be university-testing for University SQL');
  const parsed = parseSqlTarget(env.PAWS_SQL_CONNECTION_STRING);
  const options = connectionOptions(env.PAWS_SQL_CONNECTION_STRING);
  if (!UNIVERSITY_HOSTS.includes(parsed.host) || !UNIVERSITY_HOSTS.includes(String(env.PAWS_TESTING_SQL_SERVER || '').toLowerCase())) {
    fail('University Testing requires the exact approved SQL host');
  }
  if (parsed.host !== String(env.PAWS_TESTING_SQL_SERVER).toLowerCase()) fail('University SQL server does not match PAWS_TESTING_SQL_SERVER');
  if (!/^(tcp:)?[a-z0-9.-]+(?:,1433)?$/i.test(options.get('server'))) fail('University SQL requires the reviewed endpoint without instance or protocol overrides');
  if (parsed.database !== TESTING_DATABASE || env.PAWS_TESTING_DATABASE !== TESTING_DATABASE) fail('University Testing requires the exact independent Testing database');
  const environmentId = String(env.PAWS_TESTING_ENVIRONMENT_ID || '');
  if (!UUID.test(environmentId)) fail('University Testing requires PAWS_TESTING_ENVIRONMENT_ID (UUID)');
  if (!/^[a-z][a-z0-9-]{4,29}$/.test(env.FIREBASE_PROJECT_ID || '') || env.FIREBASE_PROJECT_ID === 'tester-teaching') fail('University Testing requires its own non-production Firebase project');
  if (env.PAWS_SQL_DRIVER !== 'msnodesqlv8' || env.PAWS_SQL_MI_CLIENT_ID !== undefined) fail('University Testing requires Windows integrated SQL authentication');
  if (env.PAWS_TESTING_LOCAL_ODBC !== undefined) fail('University Testing must not use a local ODBC override');
  if (env.PAWS_SQL_ALLOW_SELF_SIGNED !== undefined && env.PAWS_SQL_ALLOW_SELF_SIGNED !== 'false') fail('University Testing requires strict remote TLS');
  if (options.has('encrypt') && options.get('encrypt').toLowerCase() !== 'true') fail('University SQL encryption must remain enabled');
  if (options.has('trustservercertificate') && options.get('trustservercertificate').toLowerCase() !== 'false') fail('University SQL certificate validation must remain enabled');
  const allowedOptions = new Set(['server', 'database', 'encrypt', 'trustservercertificate', 'port']);
  if ([...options.keys()].some(key => !allowedOptions.has(key))) fail('University SQL connection option is not allowed');
  if (options.has('port') && options.get('port') !== '1433') fail('University SQL requires the reviewed port');
  if ((env.PAWS_API_HOST !== undefined && env.PAWS_API_HOST !== '127.0.0.1') || env.PAWS_API_ALLOW_NON_LOOPBACK !== undefined) fail('University Testing API must remain loopback-only');
  return Object.freeze({ profile, ...parsed, physicalServer: UNIVERSITY_SERVER, environmentId: environmentId.toLowerCase() });
}

function compileTargetGuard(target) {
  if (!target || !['production', 'university-testing'].includes(target.profile)) fail('SQL target guard requires a resolved deployment target');
  if (target.database !== (target.profile === 'production' ? PRODUCTION_DATABASE : TESTING_DATABASE)) fail('SQL target guard database is not allowed');
  if (target.profile === 'university-testing' && (target.physicalServer !== UNIVERSITY_SERVER || !UUID.test(target.environmentId || ''))) fail('SQL target guard requires the University identity and UUID');
  const params = Object.freeze({ pawsTargetDatabase: target.database, pawsTargetServer: target.physicalServer,
    pawsTargetEnvironmentId: target.environmentId });
  // This prefix executes in the SAME request/transaction as business SQL, so
  // reconnects, pool expansion and marker changes cannot reuse a cached pass.
  // Dynamic SQL defers marker-table binding for legitimate unmarked Production.
  const text = `/* PAWS_SQL_TARGET_GUARD_V1 */
IF DB_NAME() COLLATE Latin1_General_100_BIN2 <> @pawsTargetDatabase COLLATE Latin1_General_100_BIN2
  THROW 55880, 'SQL environment target rejected.', 1;
IF @pawsTargetServer IS NOT NULL AND
   COALESCE(UPPER(CONVERT(nvarchar(128),SERVERPROPERTY(N'ServerName'))),N'') COLLATE Latin1_General_100_BIN2 <> @pawsTargetServer COLLATE Latin1_General_100_BIN2
  THROW 55880, 'SQL environment target rejected.', 1;
DECLARE @pawsTargetRows bigint=0, @pawsTargetMatches bigint=0;
IF OBJECT_ID(N'[paws_env].[EnvironmentIdentity]',N'U') IS NOT NULL
BEGIN
  EXEC sys.sp_executesql
    N'SELECT @rowCount=COUNT_BIG(*), @matchCount=COALESCE(SUM(CONVERT(bigint,CASE
      WHEN @identity IS NULL AND Environment=N''production'' THEN 1
      WHEN @identity IS NOT NULL AND Environment=N''testing'' AND EnvironmentId=CONVERT(uniqueidentifier,@identity) THEN 1
      ELSE 0 END)),0) FROM [paws_env].[EnvironmentIdentity];',
    N'@identity nvarchar(36), @rowCount bigint OUTPUT, @matchCount bigint OUTPUT',
    @identity=@pawsTargetEnvironmentId, @rowCount=@pawsTargetRows OUTPUT, @matchCount=@pawsTargetMatches OUTPUT;
END;
IF (@pawsTargetEnvironmentId IS NOT NULL AND (@pawsTargetRows<>1 OR @pawsTargetMatches<>1)) OR
   (@pawsTargetEnvironmentId IS NULL AND @pawsTargetRows<>@pawsTargetMatches)
  THROW 55880, 'SQL environment target rejected.', 1;
`;
  return Object.freeze({ text, params });
}

module.exports = { parseSqlTarget, resolveSqlTarget, compileTargetGuard, EnvironmentConfigurationError,
  UNIVERSITY_SERVER, UNIVERSITY_HOSTS, TESTING_DATABASE, PRODUCTION_DATABASE };
