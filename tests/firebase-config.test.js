const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'..','firebase-config.js'),'utf8');
function load(value){const window={};if(value!==undefined)window.UCVM_PAWS_SESSION_BACKEND=value;vm.runInNewContext(source,{window});return window.UCVM_PAWS_SESSION_BACKEND;}
test('session backend defaults to Firestore and accepts only the SQL opt-in',()=>{assert.equal(load(),'firestore');assert.equal(load('azure-sql'),'azure-sql');assert.equal(load('firestore'),'firestore');assert.equal(load('bogus'),'invalid');});
test('public config contains no server credentials',()=>assert.doesNotMatch(source,/connection[_ -]?string|service[_ -]?account|client[_ -]?secret|private[_ -]?key/i));
