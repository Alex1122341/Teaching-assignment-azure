'use strict';
// Trusted, operator-run cloud configuration only. No browser endpoint, user
// creation, password change, service key, Production selector or raw response.
const crypto=require('node:crypto');
const PROJECT='paws-testing-ucvm-20261022';
const NAMES=new Set(['projects/'+PROJECT+'/config','projects/165982140501/config']);
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
function otherDigest(config){
 const copy=structuredClone(config);if(copy.signIn)delete copy.signIn.email;
 return crypto.createHash('sha256').update(JSON.stringify(canonical(copy))).digest('hex');
}
function assertConfig(config){
 if(!config||!NAMES.has(config.name)||!config.signIn||typeof config.signIn!=='object')throw Error('Testing Auth resource is not verified');
}
async function configureTestingAuth({client,apply=false}){
 const before=await client.get();assertConfig(before);
 const configured=before.signIn.email?.enabled===true&&before.signIn.email.passwordRequired===true;
 let after=before,changed=false;
 if(apply&&!configured){
  await client.update(PROJECT,{signIn:{email:{enabled:true,passwordRequired:true}}},'signIn.email.enabled,signIn.email.passwordRequired');
  after=await client.get();assertConfig(after);changed=true;
 }
 const untouched=otherDigest(before)===otherDigest(after);
 const ready=after.signIn.email?.enabled===true&&after.signIn.email.passwordRequired===true;
 if(apply&&(!ready||!untouched))throw Error('Testing Auth configuration needs review');
 return {status:ready?'CONFIGURED':'NOT_CONFIGURED',projectId:PROJECT,changed,emailPasswordEnabled:ready,
  passwordRequired:after.signIn.email?.passwordRequired===true,otherConfigurationUnchanged:untouched,
  anonymousEnabled:after.signIn.anonymous?.enabled===true,phoneEnabled:after.signIn.phoneNumber?.enabled===true,
  accountsCreated:0,keysCreated:0,utc:new Date().toISOString()};
}
async function operatorClient(){
 // Cached Firebase CLI authorization stays in the official CLI's in-memory
 // credential path; never serialize an account object or use ADC/Prod keys.
 if(process.env.FIREBASE_TOKEN||process.env.GOOGLE_APPLICATION_CREDENTIALS||Object.keys(process.env).some(key=>/^FIREBASE_.*(?:URL|CLIENT_ID|CLIENT_SECRET)$/.test(key)))throw Error('Testing Auth requires the existing ordinary CLI account without credential or endpoint overrides');
 const base='firebase-tools/lib/';
 require(base+'logger').logger.silent=true;
 const auth=require(base+'auth'),account=auth.getGlobalDefaultAccount();
 if(!account?.user||!account?.tokens)throw Error('Existing Firebase CLI login is required');
 await require(base+'requireAuth').requireAuth({project:PROJECT,nonInteractive:true,user:account.user,tokens:account.tokens},true);
 const api=require(base+'gcp/identityPlatform');
 return {get:()=>api.getConfig(PROJECT),update:(project,patch,mask)=>{
  if(project!==PROJECT)throw Error('Only the fixed Testing project can be configured');
  return api.updateConfig(PROJECT,patch,mask);
 }};
}
async function main(argv){
 if(argv.some(arg=>arg!=='--apply')||argv.length>1)throw Error('Unsupported Testing Auth argument');
 return configureTestingAuth({client:await operatorClient(),apply:argv.includes('--apply')});
}
if(require.main===module)main(process.argv.slice(2)).then(result=>console.log(JSON.stringify(result))).catch(()=>{console.error('{"status":"NOT_READY","reason":"TESTING_AUTH_CONFIGURATION_REJECTED"}');process.exitCode=1;});
module.exports={configureTestingAuth,PROJECT};
