'use strict';
const path=require('node:path');
const {execFileSync}=require('node:child_process');
// These retired browser workflows are historical evidence. Current Beta rules
// are exercised independently by effective-access-rules-emulator.test.js.
const HISTORICAL_RULES_COMMIT='19d5042473917bc96434b141ab1f9a41f8e8eb1e';
function historicalFirestoreRules(){
 return execFileSync('git',['show',`${HISTORICAL_RULES_COMMIT}:firestore.rules`],{cwd:path.resolve(__dirname,'../..'),encoding:'utf8'});
}
module.exports={HISTORICAL_RULES_COMMIT,historicalFirestoreRules};
