'use strict';
// Creates the Testing sign-in accounts in the TESTING Firebase project and links them to Testing SQL profiles.
//
// * Synthetic personas: one Firebase user per seeded paws.UserProfile (fixed UIDs such as syn-owner,
//   syn-hicc, syn-faculty-a), sharing one password supplied by PAWS_TEST_PERSONA_PASSWORD (a GitHub
//   Environment secret; never committed).
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

async function main(argv, env = process.env) {
  const environment = resolveEnvironment(env);
  if (!environment.testing) throw new Error('provision-test-accounts only runs with PAWS_ENVIRONMENT=testing');
  const password = String(env.PAWS_TEST_PERSONA_PASSWORD || '');
  if (password.length < 12) throw new Error('PAWS_TEST_PERSONA_PASSWORD (12+ characters) is required');
  const operatorsAt = argv.indexOf('--operators');
  const operators = operatorsAt >= 0 ? JSON.parse(fs.readFileSync(argv[operatorsAt + 1], 'utf8')) : [];
  if (!Array.isArray(operators) || operators.some(o => !o || typeof o.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(o.email) || !normalizeBaseRole(o.role))) {
    throw new Error('--operators must be an array of { email, role } with supported roles');
  }

  const admin = require(path.join(__dirname, '../../server/node_modules/firebase-admin'));
  const options = { projectId: env.FIREBASE_PROJECT_ID };
  if (env.FIREBASE_SERVICE_ACCOUNT_JSON) options.credential = admin.credential.cert(JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON));
  const app = admin.initializeApp(options, 'paws-testing-provisioning');
  const auth = admin.auth(app);

  const sql = require(path.join(__dirname, '../../server/node_modules/mssql'));
  const { buildSqlConnectionConfig, createSqlConnection } = require('../../server/src/data/sql-connection');
  const db = createSqlConnection({ config: buildSqlConnectionConfig({ connectionString: env.PAWS_SQL_CONNECTION_STRING, miClientId: env.PAWS_SQL_MI_CLIENT_ID, driver: 'tedious' }), sql });
  try {
    await assertDatabaseIdentity(db, environment);
    const profiles = await db.query('SELECT FirebaseUid AS uid, Email AS email, DisplayName AS name FROM paws.UserProfile WHERE FirebaseUid IN (SELECT [value] FROM OPENJSON(@uids))', { uids: JSON.stringify(SEED_PERSONAS) });
    const created = [];
    for (const profile of profiles) {
      try { await auth.updateUser(profile.uid, { email: profile.email, password, displayName: profile.name, disabled: false }); }
      catch (error) {
        if (error.code !== 'auth/user-not-found') throw error;
        await auth.createUser({ uid: profile.uid, email: profile.email, password, displayName: profile.name });
      }
      created.push({ uid: profile.uid, email: profile.email });
    }
    for (const operator of operators) {
      let user;
      try { user = await auth.getUserByEmail(operator.email); }
      catch (error) { if (error.code !== 'auth/user-not-found') throw error; user = await auth.createUser({ email: operator.email }); }
      await db.query(`MERGE paws.UserProfile AS target USING (SELECT @uid AS FirebaseUid) AS source ON target.FirebaseUid = source.FirebaseUid
        WHEN MATCHED THEN UPDATE SET Email = @email, DisplayName = @name, BaseRole = @role, Active = 1, MustChangePassword = 0, UpdatedAtUtc = SYSUTCDATETIME()
        WHEN NOT MATCHED THEN INSERT (FirebaseUid, Email, DisplayName, BaseRole, FacultyId, Active, MustChangePassword) VALUES (@uid, @email, @name, @role, NULL, 1, 0);`,
      { uid: user.uid, email: operator.email, name: operator.name || operator.email, role: String(operator.role).toLowerCase() });
      created.push({ uid: user.uid, email: operator.email, role: operator.role, note: 'set a password with a Firebase reset link from the Testing project' });
    }
    console.log(JSON.stringify({ ok: true, firebaseProject: env.FIREBASE_PROJECT_ID, accounts: created }, null, 2));
  } finally {
    await db.close();
    await app.delete();
  }
}

if (require.main === module) main(process.argv.slice(2)).catch(error => { console.error(`TESTING_ACCOUNTS_FAILED: ${error.message}`); process.exit(1); });
module.exports = { main, SEED_PERSONAS };
