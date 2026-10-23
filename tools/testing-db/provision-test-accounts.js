'use strict';
// Creates the Testing sign-in accounts in the TESTING Firebase project and links them to Testing SQL profiles.
//
// * Synthetic personas: one Firebase user per seeded non-operator paws.UserProfile (fixed UIDs such as
//   syn-hicc, syn-visc, syn-faculty-a), sharing one password supplied by PAWS_TEST_PERSONA_PASSWORD (a
//   GitHub Environment secret; never committed).
// * Operator-class personas (developer, owner, administrator, ADFA General) never get a password
//   sign-in: anyone holding the shared password could otherwise sign straight in as a developer. They
//   are reached only by Switch Test Identity from a named operator account; an existing Firebase user
//   for them is disabled.
// * Testers / operators (optional): --operators <file.json> with [{ "email": "...", "role": "adfa_regular" }].
//   Each gets (or keeps) a Testing Firebase account and an active Testing UserProfile with that role.
//
// Refuses to run unless PAWS_ENVIRONMENT=testing passes the runtime checks, the Firebase project is not a
// production project, and the SQL database carries the matching Testing marker.
const fs = require('node:fs');
const path = require('node:path');
const { resolveEnvironment, assertDatabaseIdentity } = require('../../server/src/runtime/environment');
const { normalizeBaseRole } = require('../../server/src/auth/role-policy');

const SEED_PERSONAS = Object.freeze(['syn-developer', 'syn-owner', 'syn-admin', 'syn-adfa-general', 'syn-adc', 'syn-lab', 'syn-hicc', 'syn-visc',
  'syn-faculty-a', 'syn-faculty-b', 'syn-faculty-reportee']);
const OPERATOR_PERSONAS = Object.freeze(['syn-developer', 'syn-owner', 'syn-admin', 'syn-adfa-general']);

// Which seeded personas get a shared-password sign-in and which must stay disabled.
function accountPlan(uids) {
  const list = [...new Set(uids)].filter(uid => SEED_PERSONAS.includes(uid));
  return {
    signIn: list.filter(uid => !OPERATOR_PERSONAS.includes(uid)),
    disabled: list.filter(uid => OPERATOR_PERSONAS.includes(uid))
  };
}

async function provision(argv, env, dependencies) {
  const environment = resolveEnvironment(env);
  if (!environment.testing) throw new Error('provision-test-accounts only runs with PAWS_ENVIRONMENT=testing');
  const password = String(env.PAWS_TEST_PERSONA_PASSWORD || '');
  if (password.length < 12) throw new Error('PAWS_TEST_PERSONA_PASSWORD (12+ characters) is required');
  const operatorsAt = argv.indexOf('--operators');
  const readFile = dependencies.readFile || (file=>fs.readFileSync(file,'utf8'));
  const operators = operatorsAt >= 0 ? JSON.parse(readFile(argv[operatorsAt + 1])) : [];
  if (!Array.isArray(operators) || operators.some(o => !o || typeof o.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(o.email) || !normalizeBaseRole(o.role))) {
    throw new Error('--operators must be an array of { email, role } with supported roles');
  }

  let credential;
  if (env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    credential=JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
    if (credential?.project_id!==env.FIREBASE_PROJECT_ID || typeof credential.private_key!=='string' || typeof credential.client_email!=='string') {
      throw new Error('Testing Firebase credentials must match the explicit Testing project');
    }
  }
  const admin = dependencies.admin || require(path.join(__dirname, '../../server/node_modules/firebase-admin'));
  const options = { projectId: env.FIREBASE_PROJECT_ID };
  let db, app;
  try {
    if (env.PAWS_TESTING_SQL_PROFILE==='university-testing') {
      const connect=dependencies.connectTestingProfile || require('./connection-profile').connectTestingProfile;
      const connection=await connect(env);
      db={query:async(text,params)=>(await connection.guardedBatch(text,params)).recordset||[],close:()=>connection.pool.close()};
      const {resolveSqlTarget}=require('../../server/src/runtime/sql-environment-target');
      const expected=resolveSqlTarget(env);
      if (connection.target?.profile!==expected.profile || connection.target?.database!==expected.database || connection.target?.environmentId!==expected.environmentId || connection.target?.physicalServer!==expected.physicalServer) throw Error('Testing account SQL connector target mismatch');
      await db.query('SELECT 1 AS targetVerified;');
    } else {
      const sql = require(path.join(__dirname, '../../server/node_modules/mssql'));
      const { buildSqlConnectionConfig, createSqlConnection } = require('../../server/src/data/sql-connection');
      db = createSqlConnection({ config: buildSqlConnectionConfig({ connectionString: env.PAWS_SQL_CONNECTION_STRING, miClientId: env.PAWS_SQL_MI_CLIENT_ID, driver: 'tedious' }), sql });
      await assertDatabaseIdentity(db, environment);
    }
    const profiles = await db.query('SELECT FirebaseUid AS uid, Email AS email, DisplayName AS name FROM paws.UserProfile WHERE FirebaseUid IN (SELECT [value] FROM OPENJSON(@uids))', { uids: JSON.stringify(SEED_PERSONAS) });
    if (profiles.length!==SEED_PERSONAS.length || new Set(profiles.map(row=>row.uid)).size!==SEED_PERSONAS.length ||
      profiles.some(row=>!SEED_PERSONAS.includes(row.uid)||typeof row.email!=='string'||!/^[^\s@]+@example\.test$/i.test(row.email))) throw Error('Testing synthetic persona profiles are missing or invalid');
    if (operators.some(operator=>profiles.some(profile=>profile.email.toLowerCase()===operator.email.toLowerCase()))) throw Error('Testing named operators must be distinct from shared-password personas');
    // No Auth app or remote Auth write exists until SQL target and all input
    // profiles have passed validation. Never fall back to Production identity.
    if (credential) options.credential = admin.credential.cert(credential);
    app = admin.initializeApp(options, 'paws-testing-provisioning');
    const auth = admin.auth(app);
    const created = [];
    const plan = accountPlan(profiles.map(profile => profile.uid));
    for (const profile of profiles) {
      if (plan.disabled.includes(profile.uid)) {
        try { await auth.updateUser(profile.uid, { disabled: true }); created.push({ uid: profile.uid, signIn: 'disabled (switch-only persona)' }); }
        catch (error) { if (error.code !== 'auth/user-not-found') throw error; created.push({ uid: profile.uid, signIn: 'none (switch-only persona)' }); }
        continue;
      }
      try { await auth.updateUser(profile.uid, { email: profile.email, password, displayName: profile.name, disabled: false }); }
      catch (error) {
        if (error.code !== 'auth/user-not-found') throw error;
        await auth.createUser({ uid: profile.uid, email: profile.email, password, displayName: profile.name });
      }
      created.push({ uid: profile.uid, signIn: 'enabled' });
    }
    for (const operator of operators) {
      let user;
      try { user = await auth.getUserByEmail(operator.email); }
      catch (error) { if (error.code !== 'auth/user-not-found') throw error; user = await auth.createUser({ email: operator.email }); }
      if (SEED_PERSONAS.includes(user.uid)) throw Error('Testing named operator cannot reuse a synthetic persona UID');
      await db.query(`MERGE paws.UserProfile AS target USING (SELECT @uid AS FirebaseUid) AS source ON target.FirebaseUid = source.FirebaseUid
        WHEN MATCHED THEN UPDATE SET Email = @email, DisplayName = @name, BaseRole = @role, Active = 1, MustChangePassword = 0, UpdatedAtUtc = SYSUTCDATETIME()
        WHEN NOT MATCHED THEN INSERT (FirebaseUid, Email, DisplayName, BaseRole, FacultyId, Active, MustChangePassword) VALUES (@uid, @email, @name, @role, NULL, 1, 0);`,
      { uid: user.uid, email: operator.email, name: operator.name || operator.email, role: normalizeBaseRole(operator.role) });
      created.push({ uid: user.uid, role: normalizeBaseRole(operator.role), note: 'set a password with a Firebase reset link from the Testing project' });
    }
    const summary={ ok: true, firebaseProject: env.FIREBASE_PROJECT_ID, accounts: created };
    (dependencies.log || (message=>console.log(message)))(JSON.stringify(summary,null,2));
    return summary;
  } finally {
    try { if(db)await db.close(); } finally { if(app)await app.delete(); }
  }
}

async function main(argv,env=process.env,dependencies={}) {
  try {return await provision(argv,env,dependencies);}
  catch(error) {
    // SDK/JSON/SQL errors can embed private keys, passwords, names or paths.
    // Keep public CLI/API errors fixed rather than echoing their messages.
    const failure=new Error('Testing account provisioning failed; verify private configuration, target and authorized credentials.');
    failure.code=error.code==='ENVIRONMENT_MISCONFIGURED'?'ENVIRONMENT_MISCONFIGURED':'TESTING_ACCOUNTS_FAILED';
    throw failure;
  }
}

if (require.main === module) main(process.argv.slice(2)).catch(error => { console.error(`TESTING_ACCOUNTS_FAILED: ${error.message}`); process.exit(1); });
module.exports = { main, accountPlan, SEED_PERSONAS, OPERATOR_PERSONAS };
