'use strict';

const { resolveSqlDriver, parseBooleanFlag, buildSqlConnectionConfig, createSqlConnection } = require('../data/sql-connection');
const { createSqlUserRepository } = require('../data/sql-user-repository');
const { createSqlSessionRepository } = require('../data/sql-session-repository');
const { createSqlDashboardRepository } = require('../data/sql-dashboard-repository');
const { createSqlFacultyAdminRepository } = require('../data/sql-faculty-admin-repository');
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
const { createSwapApi } = require('../swap/swap-api');
const { createSqlSwapRepository } = require('../data/sql-swap-repository');
const { createSwapFunctions } = require('./swa-swap-functions');
const { createDashboardFunctions } = require('./swa-dashboard-functions');
const { createAfcRequestFunctions } = require('./swa-afc-request-functions');
const { createSwaAfcArtifactFunctions } = require('./swa-afc-artifact-functions');
const { createFirebaseVerifier } = require('../auth/firebase-admin');
const { createFirebaseSqlAuth } = require('../auth/firebase-sql-auth');
const { createWriteGates } = require('../data/write-gates');
const { createSqlTeachingAssignmentWorkflowRepository } = require('../data/sql-teaching-assignment-workflow-repository');
const { createTeachingAssignmentApi } = require('../teaching-assignment/teaching-assignment-api');
const { createTeachingAssignmentFunctions } = require('./swa-teaching-assignment-functions');
const { createSqlDoeEngineRepository } = require('../data/sql-doe-engine-repository');
const { createSqlDoeWorksheetRepository } = require('../data/sql-doe-worksheet-repository');
const { createSqlDoeAssignmentRepository } = require('../data/sql-doe-assignment-repository');
const { createSqlManualDoeRepository } = require('../data/sql-manual-doe-repository');
const { createManualDoeService } = require('../doe/manual-doe-service');
const { createSqlDoeTargetOverrideRepository } = require('../data/sql-doe-target-override-repository');
const { createSqlDoePolicyRepository } = require('../data/sql-doe-policy-repository');
const { createDoeCalculationService } = require('../doe/doe-calculation-service');
const { createDoeSessionService } = require('../doe/doe-session-service');
const { createWorksheetService } = require('../doe/doe-worksheet-service');
const { createDoeAssignmentService } = require('../doe/doe-assignment-service');
const { createDoeTargetOverrideService } = require('../doe/doe-target-override-service');
const { createDoePolicyService } = require('../doe/doe-policy-service');
const { createDoeWorkflowPreviewService } = require('../doe/doe-workflow-preview-service');
const { createDoeApi } = require('../doe/doe-api');
const { createDoeFunctions } = require('./swa-doe-functions');
const { createSupportService } = require('../support/support-service');
const {createCalendarActivityApi}=require('../calendar/calendar-activity-api');
const {createSqlCalendarActivityRepository}=require('../data/sql-calendar-activity-repository');
const {createCalendarActivityFunctions}=require('./swa-calendar-activity-functions');

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
  const facultyAdminWrite = createSqlFacultyAdminRepository(db);
  const writeGates = createWriteGates(env);
  const realVerify = createFirebaseSqlAuth({
    verifyIdToken: createFirebaseVerifier({ admin, projectId: env.FIREBASE_PROJECT_ID, serviceAccountJson: env.FIREBASE_SERVICE_ACCOUNT_JSON }),
    expectedProjectId: env.FIREBASE_PROJECT_ID
  });
  const support=createSupportService({db,verifyToken:realVerify,findUser:users.findByUid});
  const verify=support.verify;
  const doeRepository = createSqlDoeEngineRepository(db);
  const doeAssignmentRepository = createSqlDoeAssignmentRepository(db);
  const doeCalculationService = createDoeCalculationService({ repository: doeRepository });
  const doeSessionService = createDoeSessionService({
    repository: { ...doeRepository, ...doeAssignmentRepository },
    calculationService: doeCalculationService
  });
  const timetable = createSwaFunctions({ api: createDataApi({
    verifyToken: verify,
    findUser: users.findByUid,
    listSessions: sessions.list,
    updateSession: sessions.updateExisting,
    createSession: sessions.createNew,
    createSessionBatch: sessions.createBatch,
    replaceSessionAssignments: sessions.replaceAssignments,
    recalculateSessionDoe: doeSessionService.recalculate,
    health: () => db.health(),
    writeGates
  }) });
  const dashboardRoutes = createDashboardFunctions({
    api: createDashboardApi({ verifyToken: verify, findUser: users.findByUid, repository: dashboard, writeRepository: { ...afcWrite, ...facultyAdminWrite }, writeGates })
  });
  const afcRequestApi = createAfcRequestApi({
    verifyToken: verify,
    findUser: users.findByUid,
    repository: createSqlAfcRequestRepository(db),
    writeGates
  });
  const afcApprovalApi = createAfcApprovalApi({
    verifyToken: verify,
    findUser: users.findByUid,
    repository: createSqlAfcApprovalRepository(db),
    writeGates
  });
  const afcRequests = createAfcRequestFunctions({
    api: { ...afcRequestApi, ...afcApprovalApi }
  });
  const afcArtifactRoutes = createSwaAfcArtifactFunctions({
    api: createAfcApprovedArtifactApi({
      verifyToken: verify,
      findUser: users.findByUid,
      repository: createSqlAfcArtifactRepository(db),
      writeGates
    })
  });
  const teachingAssignmentRoutes = createTeachingAssignmentFunctions({api:createTeachingAssignmentApi({
    verifyToken:verify,findUser:users.findByUid,repository:createSqlTeachingAssignmentWorkflowRepository(db),writeGates
  })});
  const doeWorksheetRepository = createSqlDoeWorksheetRepository(db);
  const doeWorksheetService = createWorksheetService({ repository: doeWorksheetRepository });
  const doeTargetOverrideRepository = createSqlDoeTargetOverrideRepository(db);
  const doePolicyRepository = createSqlDoePolicyRepository(db);
  const doePolicyService = createDoePolicyService({ repository: { ...doeRepository, ...doePolicyRepository }, calculationService: doeCalculationService });
  const doeRoutes = createDoeFunctions({ api: createDoeApi({
    verifyToken: verify,
    findUser: users.findByUid,
    repository: { ...doeRepository, ...doePolicyRepository },
    calculationService: doeCalculationService,
    worksheetService: doeWorksheetService,
    workflowPreviewService: createDoeWorkflowPreviewService({ repository: { ...sessions, ...doeAssignmentRepository }, worksheetService: doeWorksheetService, calculationService: doeCalculationService }),
    assignmentService: createDoeAssignmentService({ repository: doeAssignmentRepository, calculationService: doeCalculationService }),
    manualAssignmentService: createManualDoeService({ repository: createSqlManualDoeRepository(db) }),
    targetOverrideService: createDoeTargetOverrideService({ repository: doeTargetOverrideRepository }),
    policyService: doePolicyService,
    writeGates
  }) });
  const swapRoutes = createSwapFunctions({api:createSwapApi({
    verifyToken:verify,findUser:users.findByUid,repository:createSqlSwapRepository(db),writeGates
  })});
  const calendarActivityRoutes=createCalendarActivityFunctions({api:createCalendarActivityApi({verifyToken:verify,findUser:users.findByUid,repository:createSqlCalendarActivityRepository(db),writeGates})});
  const route = async request => {
    const pathname = new URL(request.url).pathname;
    if (pathname==='/api/v1/calendar-activities'||pathname.startsWith('/api/v1/calendar-activities/')||pathname==='/api/v1/calendar-activity-imports'||pathname.startsWith('/api/v1/calendar-activity-imports/')) return calendarActivityRoutes(request);
    if (pathname === '/api/v1/swaps' || pathname.startsWith('/api/v1/swaps/')) return swapRoutes(request);
    if (pathname.startsWith('/api/v1/doe/')) return doeRoutes(request);
    if (pathname.startsWith('/api/v1/teaching-assignments/')) return teachingAssignmentRoutes(request);
    if (pathname.startsWith('/api/v1/dashboard/')) return dashboardRoutes(request);
    if (/^\/api\/v1\/afc-requests\/[^/]+\/approved-artifact\/?$/.test(pathname)) return afcArtifactRoutes(request);
    if (pathname === '/api/v1/afc-requests' || pathname.startsWith('/api/v1/afc-requests/')) return afcRequests(request);
    return timetable(request);
  };
  const handler = request => support.handle(request,route);
  handler.close = () => db.close();
  return handler;
}
module.exports={createSwaSqlRuntime};
