'use strict';

// PAWS deployment environment identity.
//
// Every runtime must declare exactly one environment. There is no default: an
// unset or unknown PAWS_ENVIRONMENT refuses to start, so a Testing deployment
// with missing configuration can never silently behave like Production (or the
// reverse).
//
// The SQL database independently declares its own identity through
// paws_env.EnvironmentIdentity (created only by the Testing database tooling).
// Production refuses a database that declares itself `testing`; Testing refuses
// any database that does not carry the exact Testing marker it was configured
// for. Configuration supplied by users or requests never participates.

const ENVIRONMENTS = Object.freeze(['production', 'testing']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Production identity anchors that a Testing runtime must never use.
// `ucvm-teaching-lab-…` is the legacy Azure lab loaded from the real workbooks.
const PRODUCTION_FIREBASE_PROJECT_IDS = Object.freeze(['tester-teaching']);
const PRODUCTION_SQL_SERVERS = Object.freeze([
  'itappvetopsdb01',
  'ucvm-teaching-lab-xz-20260911.database.windows.net'
]);

class EnvironmentConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'EnvironmentConfigurationError';
    this.code = 'ENVIRONMENT_MISCONFIGURED';
  }
}

function fail(message) { throw new EnvironmentConfigurationError(message); }

const SERVER_KEYS = Object.freeze(['server', 'datasource', 'address', 'addr', 'networkaddress']);

// Returns the single SQL server host named by a connection string, or '' when there is none OR more
// than one. Drivers disagree about which duplicate wins, so an ambiguous string is never accepted.
function sqlServerHost(connectionString) {
  const hosts = [];
  for (const segment of String(connectionString || '').split(';')) {
    const separator = segment.indexOf('=');
    if (separator < 1) continue;
    const key = segment.slice(0, separator).trim().toLowerCase().replace(/\s+/g, '');
    if (!SERVER_KEYS.includes(key)) continue;
    hosts.push(segment.slice(separator + 1).trim().replace(/^(tcp|np|lpc):/i, '').replace(/,\d+$/, '').split('\\')[0].toLowerCase());
  }
  return hosts.length === 1 ? hosts[0] : '';
}

// Hosts that resolve to "this machine" — a Testing API on the production SQL host could reach
// VetMed-Ops through any of them, so Testing never accepts them (LocalDB is allowed explicitly).
function isLoopbackSqlHost(host) {
  const value = String(host || '').toLowerCase();
  return ['.', '(local)', 'localhost', '127.0.0.1', '::1', '[::1]'].includes(value) || /^127\./.test(value);
}

// Testing may use only a dedicated Azure SQL logical server (public or private-link name) or a LocalDB
// instance on a developer machine. IP addresses, on-premises names and other hosts are refused, so a typo
// or a copied Production value can never point a Testing runtime at the University server.
const AZURE_SQL_HOST = /^[a-z0-9][a-z0-9-]{0,61}[a-z0-9](\.privatelink)?\.database\.windows\.net$/;
function isAllowedTestingSqlHost(host) {
  const value = String(host || '').toLowerCase();
  return value === '(localdb)' || AZURE_SQL_HOST.test(value);
}

function isProductionSqlServer(host) {
  const value = String(host || '').toLowerCase();
  return PRODUCTION_SQL_SERVERS.some(item => value === item || value.startsWith(item + '.'));
}

function resolveEnvironment(env = {}) {
  const name = env.PAWS_ENVIRONMENT;
  if (typeof name !== 'string' || !ENVIRONMENTS.includes(name)) {
    fail('PAWS_ENVIRONMENT must be exactly "production" or "testing"');
  }
  if (name === 'production') {
    if (env.PAWS_TESTING_ENVIRONMENT_ID !== undefined) fail('PAWS_TESTING_ENVIRONMENT_ID is not valid in production');
    if (env.PAWS_TESTING_SQL_SERVER !== undefined) fail('PAWS_TESTING_SQL_SERVER is not valid in production');
    if (env.PAWS_API_ALLOW_NON_LOOPBACK !== undefined) fail('PAWS_API_ALLOW_NON_LOOPBACK is not valid in production');
    return Object.freeze({ name, testing: false, testingEnvironmentId: null });
  }
  const testingEnvironmentId = String(env.PAWS_TESTING_ENVIRONMENT_ID || '').trim();
  if (!UUID.test(testingEnvironmentId)) fail('Testing requires PAWS_TESTING_ENVIRONMENT_ID (UUID)');
  if (PRODUCTION_FIREBASE_PROJECT_IDS.includes(String(env.FIREBASE_PROJECT_ID || '').trim())) {
    fail('Testing must not trust the production Firebase project');
  }
  const host = sqlServerHost(env.PAWS_SQL_CONNECTION_STRING);
  if (!host) fail('Testing requires exactly one explicit SQL server in PAWS_SQL_CONNECTION_STRING');
  if (isProductionSqlServer(host)) fail('Testing must not connect to a production SQL server');
  if (isLoopbackSqlHost(host)) fail('Testing must not connect to a SQL server on this machine by a loopback name');
  // Allow-list: the Testing deployment names its own SQL server; anything else is refused.
  const allowed = String(env.PAWS_TESTING_SQL_SERVER || '').trim().toLowerCase();
  if (!allowed) fail('Testing requires PAWS_TESTING_SQL_SERVER (the Testing SQL server host)');
  if (isProductionSqlServer(allowed) || isLoopbackSqlHost(allowed)) fail('PAWS_TESTING_SQL_SERVER must name the Testing SQL server');
  if (!isAllowedTestingSqlHost(allowed)) fail('PAWS_TESTING_SQL_SERVER must be a dedicated Azure SQL server (<name>.database.windows.net) or (localdb)');
  if (host !== allowed) fail('Testing SQL server does not match PAWS_TESTING_SQL_SERVER');
  return Object.freeze({ name, testing: true, testingEnvironmentId: testingEnvironmentId.toLowerCase() });
}

const IDENTITY_QUERY = `IF OBJECT_ID(N'paws_env.EnvironmentIdentity', N'U') IS NOT NULL
  SELECT Environment AS environment, CONVERT(varchar(36), EnvironmentId) AS environmentId FROM paws_env.EnvironmentIdentity;`;

async function assertDatabaseIdentity(db, environment) {
  const rows = await db.query(IDENTITY_QUERY);
  const declared = (rows || []).map(row => ({
    environment: String(row.environment || '').trim().toLowerCase(),
    environmentId: String(row.environmentId || '').trim().toLowerCase()
  }));
  if (environment.name === 'production') {
    if (declared.some(row => row.environment !== 'production')) {
      fail('The production runtime is connected to a non-production database');
    }
    return true;
  }
  if (declared.length !== 1 || declared[0].environment !== 'testing' || declared[0].environmentId !== environment.testingEnvironmentId) {
    fail('The testing runtime is not connected to its declared Testing database');
  }
  return true;
}

module.exports = {
  ENVIRONMENTS,
  PRODUCTION_FIREBASE_PROJECT_IDS,
  PRODUCTION_SQL_SERVERS,
  EnvironmentConfigurationError,
  resolveEnvironment,
  assertDatabaseIdentity,
  sqlServerHost,
  isProductionSqlServer,
  isLoopbackSqlHost,
  isAllowedTestingSqlHost
};
