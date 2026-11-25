'use strict';
const {uniqueJson}=require('./swa-report-functions');
const PREFIX='/api/v1/faculty/availability/';
const routes=Object.freeze({
 roster:['GET','roster',['includeInactive','query','cursor']],
 query:['POST','query',[]],
 page:['GET','page',['snapshot','offset']],
 export:['GET','export',['snapshot','format','filter','sort']],
 'common-time':['POST','common',[]],
 'common-time/details':['GET','commonDetail',['snapshot','date','start','end']]
});
function createFacultyAvailabilityFunctions({api}={}){
 return async request=>{
  const url=new URL(request.url);
  const header=request.headers?.get?.('authorization')||'',token=/^Bearer /i.test(header)?header.slice(7):'';
  if(url.pathname.startsWith(PREFIX)){
   const name=url.pathname.slice(PREFIX.length);
   const headers={'Cache-Control':'private, no-store'};
   const fail=(status,code,message)=>({status,headers,jsonBody:{error:{code,message}}});
   if(!Object.hasOwn(routes,name))return fail(404,'NOT_FOUND','Route not found.');
   const [method,action,keys]=routes[name];
   if(request.method!==method)return {...fail(405,'METHOD_NOT_ALLOWED',method+' required.'),headers:{...headers,Allow:method}};
   if([...url.searchParams.keys()].some(key=>!keys.includes(key)||url.searchParams.getAll(key).length!==1))
    return fail(400,'INVALID_QUERY','Invalid availability filters.');
   let input=Object.fromEntries(url.searchParams);
   if(method==='POST'){
    if((request.headers?.get?.('content-type')||'').split(';')[0].trim().toLowerCase()!=='application/json')
     return fail(415,'JSON_REQUIRED','JSON is required.');
    try{
     const raw=await request.text();
     if(Buffer.byteLength(raw)>32768)return fail(413,'AVAILABILITY_LIMIT','The availability query is too large.');
     input=uniqueJson(raw);
    }catch(_){return fail(400,'INVALID_QUERY','Invalid availability JSON.');}
   }
   try{
    const result=await api[action](token,input);
    return {status:result.status,headers,jsonBody:result.body};
   }catch(_){return fail(503,'SERVICE_UNAVAILABLE','Availability cannot be verified.');}
  }
  const match=/^\/api\/v1\/faculty\/([^/]+)\/availability$/.exec(url.pathname);
  if(!match)return {status:404,jsonBody:{error:{code:'NOT_FOUND',message:'Route not found.'}}};
  if(request.method!=='GET')return {status:405,headers:{Allow:'GET'},jsonBody:{error:{code:'METHOD_NOT_ALLOWED',message:'GET required.'}}};
  if([...url.searchParams.keys()].some(k=>!['mode','startDate','endDate','kind','cursor','limit'].includes(k)||url.searchParams.getAll(k).length!==1))
   return {status:400,jsonBody:{error:{code:'INVALID_QUERY',message:'Invalid availability filters.'}}};
  try{
   const result=await api.list(token,match[1],Object.fromEntries(url.searchParams));
   return {status:result.status,jsonBody:result.body};
  }catch(_){return {status:503,jsonBody:{error:{code:'SERVICE_UNAVAILABLE',message:'Availability cannot be verified.'}}};}
 };
}
module.exports={createFacultyAvailabilityFunctions};
