'use strict';
// Strict frozen Beta runtime verification.
//
// BETA-R3A-3 (Commit B) promoted the frozen baseline to Runtime Commit A, so the
// BETA-R1 candidate IS the frozen runtime. The old intentional-drift exception
// model (index.html / paws-data-client.js / timetable.js) is REMOVED: there is no
// whitelist and no Beta-R1 special case. ANY protected runtime drift fails.
//
// This wrapper delegates to tools/beta-freeze.js, which reads immutable Git
// objects from the baseline commit, so a coordinated edit of a runtime file plus
// tools/beta-baseline.json (or the static asset manifest) still fails.
const freeze=require('./beta-freeze');
const result=freeze.verifyFreeze();
if(!result.ok){
  console.error('frozen Beta runtime check FAILED: protected runtime drift is forbidden');
  console.error(JSON.stringify({
    ok:false,
    baselineCommit:result.baselineCommit,
    protected:result.protected,
    drift:result.drift
  },null,2));
  process.exit(1);
}
console.log(JSON.stringify({
  ok:true,
  baselineCommit:result.baselineCommit,
  protected:result.protected,
  drift:[]
},null,2));
