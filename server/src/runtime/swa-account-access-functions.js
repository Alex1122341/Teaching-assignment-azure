'use strict';
const {uniqueJson}=require('./swa-report-functions');
const PREFIX='/api/v1/access/';
function createAccountAccessFunctions({api,collaboration}){
 return async request=>{
  const headers={'Cache-Control':'private, no-store'};
  const error=(status,code,message)=>({status,headers,jsonBody:{error:{code,message}}});
  try{
   const url=new URL(request.url),path=url.pathname.startsWith(PREFIX)?url.pathname.slice(PREFIX.length):'';
   let methods,query=[],handler;
   switch(path){
    case 'self':methods=['GET'];handler=token=>api.self(token);break;
    case 'catalog':methods=['GET'];handler=token=>api.catalog(token);break;
    case 'accounts':methods=['GET'];query=['search','offset'];handler=(token,input)=>api.list(token,input);break;
    case 'preview':methods=['POST'];handler=(token,input)=>api.preview(token,input);break;
    case 'commit':methods=['POST'];handler=(token,input)=>api.commit(token,input);break;
    case 'history':methods=['GET'];query=['targetUid','offset'];handler=(token,input)=>api.history(token,input);break;
    case 'groups':methods=['GET','POST'];handler=(token,input)=>request.method==='GET'?collaboration.groups(token):collaboration.saveGroup(token,null,input);break;
    case 'announcements':methods=['GET','POST'];handler=(token,input)=>request.method==='GET'?collaboration.announcements(token):collaboration.publishAnnouncement(token,input);break;
    case 'legacy-audit':methods=['GET'];query=['cursor'];handler=(token,input)=>collaboration.legacyAudit(token,input);break;
    default:{
     const match=/^groups\/([^/]+)(\/members)?$/.exec(path);
     if(!match)return error(404,'NOT_FOUND','Access route not found.');
     const id=decodeURIComponent(match[1]);if(!/^[A-Za-z0-9_-]{1,128}$/.test(id))return error(400,'INVALID_GROUP_CHANGE','Invalid group identifier.');
     methods=['PATCH'];handler=(token,input)=>match[2]?collaboration.updateMembers(token,id,input):collaboration.saveGroup(token,id,input);
    }
   }
   if(!methods.includes(request.method))return {...error(405,'METHOD_NOT_ALLOWED',methods.join(' or ')+' required.'),headers:{...headers,Allow:methods.join(', ')}};
   for(const key of url.searchParams.keys())if(!query.includes(key)||url.searchParams.getAll(key).length!==1)return error(400,'INVALID_ACCESS_QUERY','Unsupported access parameters.');
   let input=Object.fromEntries(url.searchParams);
   if(input.offset!==undefined){
    if(!/^(0|[1-9][0-9]*)$/.test(input.offset)||!Number.isSafeInteger(Number(input.offset))||Number(input.offset)%50)return error(400,'INVALID_ACCESS_QUERY','Provide a valid page offset.');
    input.offset=Number(input.offset);
   }
   if(request.method!=='GET'){
    if(String(request.headers?.get?.('content-type')||'').split(';')[0].trim().toLowerCase()!=='application/json')return error(415,'JSON_REQUIRED','JSON is required.');
    try{
     if(typeof request.text!=='function')return error(400,'INVALID_ACCESS_CHANGE','Raw JSON is required.');
     const raw=await request.text();if(Buffer.byteLength(raw)>32768)return error(413,'ACCESS_LIMIT','The change is too large.');
     input=uniqueJson(raw);
    }catch(_){return error(400,'INVALID_ACCESS_CHANGE','Invalid or duplicate JSON properties.');}
   }
   const auth=request.headers?.get?.('authorization'),token=auth&&/^Bearer /i.test(auth)?auth.slice(7):'';
   const result=await handler(token,input);
   return {status:result.status,headers,jsonBody:result.body};
  }catch(_){return error(503,'ACCESS_UNAVAILABLE','Effective access is temporarily unavailable.');}
 };
}
module.exports={createAccountAccessFunctions};
