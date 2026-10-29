'use strict';
const {normalizeBaseRole,isSelfServiceRole}=require('../auth/role-policy');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const invalid=message=>Object.assign(Error(message),{status:400,code:'INVALID_ACCESS_CHANGE'});
const scope=profile=>({role:normalizeBaseRole(profile.baseRole),active:profile.active===true,facultyId:profile.facultyId||null});
function normalizeAccessPatch(changes,current){
 if(!changes||typeof changes!=='object'||Array.isArray(changes)||!Object.keys(changes).length||Object.keys(changes).some(key=>!['role','active','facultyId'].includes(key)))throw invalid('Only role, active and linked faculty may be changed.');
 if(Object.hasOwn(changes,'active')&&typeof changes.active!=='boolean')throw invalid('Active must be true or false.');
 if(Object.hasOwn(changes,'role')&&(typeof changes.role!=='string'||!normalizeBaseRole(changes.role)||normalizeBaseRole(changes.role)==='developer'))throw invalid('Choose an existing supported non-Developer role.');
 if(Object.hasOwn(changes,'facultyId')&&changes.facultyId!==null&&(typeof changes.facultyId!=='string'||!UUID.test(changes.facultyId)))throw invalid('Choose a canonical linked faculty record.');
 const before=scope(current);
 const after={...before,...changes,role:changes.role===undefined?before.role:normalizeBaseRole(changes.role)};
 if(isSelfServiceRole(after.role)&&!after.facultyId)throw invalid('A faculty-facing role requires a linked faculty record.');
 return after;
}
module.exports={normalizeAccessPatch,scope,invalid};
