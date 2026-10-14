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

function sqlServerHost(connectionString) {
  for (const segment of String(connectionString || '').split(';')) {
    const separator = segment.indexOf('=');
    if (separator < 1) continue;
    const key = segment.slice(0, separator).trim().toLowerCase().replace(/\s+/g, '');
    if (!['server', 'datasource', 'address', 'addr', 'networkaddress'].includes(key)) continue;
    return segment.slice(separator + 1).trim().replace(/^tcp:/i, '').replace(/,\d+$/, '').split('\\')[0].toLowerCase();
  }
  return '';
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
    if (env.PAWS_API_ALLOW_NON_LOOPBACK !== undefined) fail('PAWS_API_ALLOW_NON_LOOPBACK is not valid in production');
    return Object.freeze({ name, testing: false, testingEnvironmentId: null });
  }
  const testingEnvironmentId = String(env.PAWS_TESTING_ENVIRONMENT_ID || '').trim();
  if (!UUID.test(testingEnvironmentId)) fail('Testing requires PAWS_TESTING_ENVIRONMENT_ID (UUID)');
  if (PRODUCTION_FIREBASE_PROJECT_IDS.includes(String(env.FIREBASE_PROJECT_ID || '').trim())) {
    fail('Testing must not trust the production Firebase project');
  }
  const host = sqlServerHost(env.PAWS_SQL_CONNECTION_STRING);
  if (!host) fail('Testing requires an explicit SQL server in PAWS_SQL_CONNECTION_STRING');
  if (isProductionSqlServer(host)) fail('Testing must not connect to a production SQL server');
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
  isProductionSqlServer
};
