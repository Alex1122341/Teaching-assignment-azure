'use strict';

const { resolveSqlDriver, parseBooleanFlag, buildSqlConnectionConfig, createSqlConnection } = require('../data/sql-connection');
const { createSqlUserRepository } = require('../data/sql-user-repository');
const { createSqlSessionRepository } = require('../data/sql-session-repository');
const { createSqlDashboardRepository } = require('../data/sql-dashboard-repository');
const { createSqlDoeTargetRepository } = require('../data/sql-doe-target-repository');
const { createSqlAfcWriteRepository } = require('../data/sql-afc-write-repository');
const { createSqlAfcRequestRepository } = require('../data/sql-afc-request-repository');
const { createSqlAfcApprovalRepository } = require('../data/sql-afc-approval-repository');
const { createSqlAfcArtifactRepository } = require('../data/sql-afc-artifact-repository');
const { createAfcRequestApi } = require('../afc/afc-request-api');
const { createAfcApprovalApi } = require('../afc/afc-approval-api');
const { createAfcApprovedArtifactApi } = require('../afc/afc-approved-artifact-api');
const { createDataApi } = require('../data/data-api');
const { createDashboardApi } = require('../data/dashboard-api');
const { createSwaFunctions } = require('./swa-functions');
const { createDashboardFunctions } = require('./swa-dashboard-functions');
const { createAfcRequestFunctions } = require('./swa-afc-request-functions');
const { createSwaAfcArtifactFunctions } = require('./swa-afc-artifact-functions');
const { createFirebaseVerifier } = require('../auth/firebase-admin');
const { createFirebaseSqlAuth } = require('../auth/firebase-sql-auth');

function createSwaSqlRuntime({ env = process.env, admin = require('firebase-admin'), sql } = {}) {
  const driver = resolveSqlDriver(env.PAWS_SQL_DRIVER);
  const allowSelfSigned = parseBooleanFlag(env.PAWS_SQL_ALLOW_SELF_SIGNED, 'PAWS_SQL_ALLOW_SELF_SIGNED');
  const connectionConfig = buildSqlConnectionConfig({
    connectionString: env.PAWS_SQL_CONNECTION_STRING,
    miClientId: env.PAWS_SQL_MI_CLIENT_ID,
    driver,
    allowSelfSigned
  });
  const sqlClient = sql || require(driver === 'msnodesqlv8' ? 'mssql/msnodesqlv8' : 'mssql');
  const db = createSqlConnection({ config: connectionConfig, sql: sqlClient });
  const users = createSqlUserRepository(db);
  const sessions = createSqlSessionRepository(db);
  const dashboard = {
    ...createSqlDashboardRepository(db),
    ...createSqlDoeTargetRepository(db)
  };
  const afcWrite = createSqlAfcWriteRepository(db);
  const verify = createFirebaseSqlAuth({
    verifyIdToken: createFirebaseVerifier({ admin, projectId: env.FIREBASE_PROJECT_ID, serviceAccountJson: env.FIREBASE_SERVICE_ACCOUNT_JSON }),
    expectedProjectId: env.FIREBASE_PROJECT_ID
  });
  const timetable = createSwaFunctions({ api: createDataApi({ verifyToken: verify, findUser: users.findByUid, listSessions: sessions.list, updateSession: sessions.updateExisting, health: () => db.health() }) });
  const dashboardRoutes = createDashboardFunctions({
    api: createDashboardApi({ verifyToken: verify, findUser: users.findByUid, repository: dashboard, writeRepository: afcWrite })
  });
  const afcRequestApi = createAfcRequestApi({
    verifyToken: verify,
    findUser: users.findByUid,
    repository: createSqlAfcRequestRepository(db)
  });
  const afcApprovalApi = createAfcApprovalApi({
    verifyToken: verify,
    findUser: users.findByUid,
    repository: createSqlAfcApprovalRepository(db)
  });
  const afcRequests = createAfcRequestFunctions({
    api: { ...afcRequestApi, ...afcApprovalApi }
  });
  const afcArtifactRoutes = createSwaAfcArtifactFunctions({
    api: createAfcApprovedArtifactApi({
      verifyToken: verify,
      findUser: users.findByUid,
      repository: createSqlAfcArtifactRepository(db)
    })
  });
  const handler = async request => {
    const pathname = new URL(request.url).pathname;
    if (pathname.startsWith('/api/v1/dashboard/')) return dashboardRoutes(request);
    if (/^\/api\/v1\/afc-requests\/[^/]+\/approved-artifact\/?$/.test(pathname)) return afcArtifactRoutes(request);
    if (pathname === '/api/v1/afc-requests' || pathname.startsWith('/api/v1/afc-requests/')) return afcRequests(request);
    return timetable(request);
  };
  handler.close = () => db.close();
  return handler;
}
module.exports={createSwaSqlRuntime};
