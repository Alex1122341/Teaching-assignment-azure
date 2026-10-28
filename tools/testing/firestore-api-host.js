'use strict';

// University Testing host entry point for the Firestore trial. No Production
// SQL connection, no Firebase client-side Admin credential, and no deployment
// side effects on import. The listener is bound to loopback port 18788.
const { createLabReadRuntime } = require('./firestore-read-runtime');
const { startTestingHttpServer } = require('./firestore-http');
const TEST_AUTH = 'paws-testing-ucvm-20261022';
const TEST_DB = 'vista-teaching-lab';

function hostConfig(env = process.env) {
  if (env.PAWS_ENVIRONMENT !== 'testing' || env.PAWS_API_HOST !== '127.0.0.1' ||
      env.PAWS_API_PORT !== '18788' || env.PAWS_TESTING_FIRESTORE_PROJECT !== TEST_DB ||
      env.PAWS_TESTING_AUTH_PROJECT !== TEST_AUTH ||
      !['true','false'].includes(env.PAWS_TESTING_ALLOW_SAME_SITE) ||
      !/^[0-9a-f]{40}$/i.test(env.PAWS_TESTING_RELEASE_SHA || '')) {
    throw new Error('Invalid Testing Firestore host settings');
  }
  let auth, lab;
  try {
    auth = JSON.parse(env.PAWS_TESTING_AUTH_SERVICE_ACCOUNT_JSON);
    lab = JSON.parse(env.PAWS_TESTING_LAB_SERVICE_ACCOUNT_JSON);
  } catch (_) { throw new Error('Testing Firebase credentials unavailable'); }
  const isAccount = (value,project) => value && value.project_id===project &&
    typeof value.client_email==='string' && value.client_email.endsWith('.iam.gserviceaccount.com') &&
    typeof value.private_key==='string' && value.private_key.includes('BEGIN PRIVATE KEY') &&
    value.private_key.includes('END PRIVATE KEY');
  if (!isAccount(auth,TEST_AUTH) || !isAccount(lab,TEST_DB) ||
      auth.client_email===lab.client_email ||
      auth.private_key===lab.private_key) throw new Error('Testing Firebase credential target rejected');
  return Object.freeze({ auth, lab, allowSameSite: env.PAWS_TESTING_ALLOW_SAME_SITE==='true', releaseSha:env.PAWS_TESTING_RELEASE_SHA });
}

async function startHost({ env = process.env, adminSdk, startServer = startTestingHttpServer } = {}) {
  const config = hostConfig(env);
  const admin = adminSdk || require('../../server/node_modules/firebase-admin');
  const authName = 'paws-testing-auth-host', labName = 'paws-testing-lab-host';
  const authApp = admin.initializeApp({ credential:admin.credential.cert(config.auth), projectId:TEST_AUTH },authName);
  let labApp, server;
  try {
    labApp = admin.initializeApp({ credential:admin.credential.cert(config.lab), projectId:TEST_DB },labName);
    const db = labApp.firestore();
    if (db.projectId !== TEST_DB || db.databaseId !== '(default)') throw new Error('Firestore database target rejected');
    const auth = authApp.auth();
    const runtime = createLabReadRuntime({db, verifyIdToken: token => auth.verifyIdToken(token,true)});
    server = await startServer({runtime,port:18788,allowSameSite:config.allowSameSite});
    return { server, releaseSha:config.releaseSha, close:async()=>{
      await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
      await Promise.allSettled([authApp.delete(),labApp.delete()]);
    } };
  } catch (_) {
    if (server) await new Promise(resolve=>server.close(resolve));
    await Promise.allSettled([authApp.delete(),labApp?.delete()]);
    throw new Error('Testing Firestore listener startup failed');
  }
}

if (require.main===module) {
  startHost().then(host=>{
    console.log(JSON.stringify({ status:'LISTENING', environment:'testing', port:18788,backend:'firestore',releaseSha:host.releaseSha }));
    const shutdown=()=>host.close().then(()=>process.exit(0),()=>process.exit(1));
    process.once('SIGINT',shutdown);process.once('SIGTERM',shutdown);
  },()=>{console.error('TESTING_FIRESTORE_HOST_NOT_READY');process.exitCode=1;});
}
module.exports={ hostConfig, startHost, TEST_AUTH, TEST_DB };
