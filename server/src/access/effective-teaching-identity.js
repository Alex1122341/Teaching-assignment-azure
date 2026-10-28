'use strict';
const {normalizeBaseRole,isSelfServiceRole}=require('../auth/role-policy');
const {calgaryDate}=require('../roles/role-effective-status');
const {deriveEffectiveTeachingAccess}=require('./effective-teaching-access');

// This is a request-time SQL composition, with no role/token cache or fallback.
// Consumers still authorize their exact package in SQL; this describes only the
// signed-in person's effective teaching responsibilities alongside BaseRole.
function createEffectiveTeachingIdentity({readProfile,repository,clock=Date.now}){
 if(typeof readProfile!=='function'||typeof repository?.snapshot!=='function')throw TypeError('Profile and teaching snapshot readers required.');
 return async function read(uid,timing){
  const profile=await readProfile(uid,timing);if(!profile)return null;
  if(profile.firebaseUid!==uid)throw Error('SQL profile identity does not match the authenticated account.');
  const asOfDate=calgaryDate(new Date(clock())),year=Number(asOfDate.slice(0,4))-(asOfDate.slice(5,10)<'05-01'?1:0),academicYear=String(year)+'-'+String((year+1)%100).padStart(2,'0');
  const baseRole=normalizeBaseRole(profile.baseRole);
  let teachingAccess;
  if(isSelfServiceRole(baseRole)){
   const snapshot=await repository.snapshot(uid,{academicYear,asOfDate});
   teachingAccess=deriveEffectiveTeachingAccess({profile,academicYear,asOfDate,assignments:snapshot.assignments,authorityVersion:snapshot.authorityVersion});
  }else teachingAccess={baseRole,academicYear,effectiveRoles:baseRole&&profile.active===true&&profile.mustChangePassword===false?[baseRole]:[],responsibilities:[],scopeVersion:null};
  return {...profile,teachingAccess};
 };
}
module.exports={createEffectiveTeachingIdentity};
