'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
test('Faculty dual-role navigation and package actions follow current server capabilities without self-review',()=>{
 const {hasQueueAccess,packageActions}=require('../frontend/scripts/teaching-assignments');
 const profile={role:'faculty'},own={allowed:true,scopeVersion:'a'.repeat(64),effectiveRoles:['faculty','hicc','visc']},gates={taDraft:true,taReview:true,taFinal:true};
 assert.equal(hasQueueAccess(profile,own),true);assert.equal(hasQueueAccess(profile,{...own,scopeVersion:null}),false);
 const draft=packageActions({status:'draft',capabilities:{canActAsHicc:true,canDraft:true}},gates);
 assert.equal(draft.canEdit,true);assert.equal(draft.canReview,false);assert.equal(draft.isHicc,true);
 assert.equal(draft.canSubmit,false);assert.equal(packageActions({status:'draft',capabilities:{canDraft:true,canSubmit:true}},gates).canSubmit,true);
 const ownSubmission=packageActions({status:'visc_review',capabilities:{canActAsHicc:true,canActAsVisc:true,canReview:false}},gates);
 assert.equal(ownSubmission.canReview,false);
 assert.equal(packageActions({status:'visc_review',capabilities:{canReview:true}},gates).canReview,true);
 assert.equal(packageActions({status:'visc_approved',capabilities:{canFinalSubmit:true}},gates).canFinalSubmit,true);
 assert.equal(packageActions({status:'draft',capabilities:{canDraft:true}},{...gates,taDraft:false}).canEdit,false);
 assert.equal(packageActions({status:'draft'},gates).canEdit,false);
});
