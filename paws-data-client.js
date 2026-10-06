(function(root,factory){
  'use strict';
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root){
    root.createPawsAzureDataClient=api.createPawsAzureDataClient;
    root.UCVM_PAWS_DATA=api.createPawsAzureDataClient();
  }
})(typeof window==='undefined'?globalThis:window,function(root){
  'use strict';

  const originConfig=root&&root.PAWS_API_ORIGIN_CONFIG
    ?root.PAWS_API_ORIGIN_CONFIG
    :typeof module==='object'&&module.exports?require('./paws-api-origin.js'):null;
  const API_ORIGIN=originConfig&&originConfig.apiOrigin;

  function validateApiOrigin(origin){
    let parsed;
    try{parsed=new URL(origin)}catch(_){throw new Error('The PAWS API origin is invalid.')}
    if(parsed.protocol!=='https:'||parsed.pathname!=='/'||parsed.search||parsed.hash){
      throw new Error('The PAWS API origin must be an HTTPS origin without a path.')
    }
    return parsed.origin;
  }

  // BETA-R4D-12B2A1: the caller may ask for a forced refresh. The Firebase SDK stays
  // responsible for holding and persisting the credential; nothing is cached here.
  function defaultTokenProvider(options){
    if(typeof firebase==='undefined'||!firebase.auth)return Promise.resolve('');
    const user=firebase.auth().currentUser;
    if(!user)return Promise.resolve('');
    return user.getIdToken(options&&options.forceRefresh===true);
  }

  async function safeJson(response){
    try{return await response.json()}catch(_){return{}}
  }

  function createPawsAzureDataClient({
    fetchImpl=(typeof fetch==='function'?fetch.bind(globalThis):null),
    tokenProvider=defaultTokenProvider
  }={}){
    if(!fetchImpl)throw new Error('fetch is required');

    const apiOrigin=validateApiOrigin(API_ORIGIN);
    let writeCapabilities=Object.freeze({});

    // Translates a response into the existing error contract: {status, code, message}.
    async function settle(response){
      const body=await safeJson(response);
      if(!response.ok){
        const error=new Error(body?.error?.message||'The PAWS data service is unavailable.');
        error.code=body?.error?.code||('HTTP_'+response.status);
        error.status=response.status;
        if(Array.isArray(body?.rows))error.rows=body.rows;
        throw error;
      }
      return body;
    }

    async function authenticatedResponse(path,{method='GET',body:requestBody,accept='application/json'}={}){
      const url=apiOrigin+path;
      const buildInit=token=>{
        const headers={Authorization:'Bearer '+token,Accept:accept};
        const init={method,headers,credentials:'omit'};
        if(requestBody!==undefined){headers['Content-Type']='application/json';init.body=JSON.stringify(requestBody)}
        return init;
      };

      const token=await tokenProvider({forceRefresh:false});
      if(!token){
        const error=new Error('Authentication required.');
        error.code='UNAUTHENTICATED';
        throw error;
      }
      const response=await fetchImpl(url,buildInit(token));

      // BETA-R4D-12B2A1 continuity rule: only an explicit HTTP 401 may trigger a forced
      // token refresh and exactly one replay of the same request. 403/404/5xx and
      // transport failures are never replayed, so a non-idempotent write can never be
      // duplicated after an ambiguous partial success. There is no loop and no timer.
      if(response.status!==401)return response;

      let refreshed;
      try{
        refreshed=await tokenProvider({forceRefresh:true});
      }catch(cause){
        const error=new Error('The PAWS session token could not be refreshed.');
        error.code='TOKEN_REFRESH_FAILED';
        error.cause=cause;
        throw error;
      }
      if(!refreshed){
        const error=new Error('The PAWS session could not be re-verified.');
        error.code='SESSION_REAUTH_REQUIRED';
        error.status=401;
        throw error;
      }

      const retryResponse=await fetchImpl(url,buildInit(refreshed));
      if(retryResponse.status===401){
        const body=await safeJson(retryResponse);
        const error=new Error(body?.error?.message||'The PAWS session could not be re-verified.');
        error.code='SESSION_REAUTH_REQUIRED';
        error.status=401;
        throw error;
      }
      return retryResponse;
    }

    async function request(path,options={}){
      return settle(await authenticatedResponse(path,options));
    }

    async function requestBinary(path,options={}){
      const response=await authenticatedResponse(path,{...options,accept:'application/pdf'});
      if(!response.ok)return settle(response);
      const contentType=String(response.headers?.get?.('content-type')||'').split(';',1)[0].trim().toLowerCase();
      if(contentType!=='application/pdf'){
        const error=Error('The PAWS data service returned an invalid artifact response.');
        error.code='INVALID_ARTIFACT_RESPONSE';error.status=response.status;throw error;
      }
      if(typeof response.arrayBuffer!=='function'){
        const error=Error('The PAWS data service returned an invalid artifact response.');
        error.code='INVALID_ARTIFACT_RESPONSE';error.status=response.status;throw error;
      }
      return{
        bytes:new Uint8Array(await response.arrayBuffer()),
        contentType:'application/pdf',
        contentDisposition:String(response.headers?.get?.('content-disposition')||'')
      };
    }

    function requestPath(id,action=''){
      const value=String(id??'').trim();
      if(!value)throw new Error('afcRequestId is required.');
      return '/api/v1/afc-requests/'+encodeURIComponent(value)+(action?'/'+action:'');
    }

    function pickFields(value,allowed){
      const input=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
      const output={};
      for(const key of allowed){
        if(Object.prototype.hasOwnProperty.call(input,key))output[key]=input[key];
      }
      return output;
    }

    async function afcRequestResult(path,options){
      const body=await request(path,options);
      return body.afcRequest&&typeof body.afcRequest==='object'&&!Array.isArray(body.afcRequest)?body.afcRequest:{};
    }

    return Object.freeze({
      sessionBackend:()=> 'vetmed-ops',
      // Old schedule mutation controls stay closed. API write entry points use
      // their own explicit capabilities below.
      sessionWritesEnabled:()=> false,
      sessionEditEnabled:()=> writeCapabilities.sessionEdit===true,
      sessionCreateEnabled:()=> writeCapabilities.sessionCreate===true,
      afcSingleWriteEnabled:()=> writeCapabilities.afcSingle===true,
      afcBatchWriteEnabled:()=> writeCapabilities.afcBatch===true,
      async refreshWriteCapabilities(){
        const body=await request('/api/v1/afc-requests/write-capabilities');
        const value=body&&typeof body.writeCapabilities==='object'?body.writeCapabilities:{};
        writeCapabilities=Object.freeze({
          sessionEdit:value.sessionEdit===true,
          sessionCreate:value.sessionCreate===true,
          afcSingle:value.afcSingle===true,
          afcBatch:value.afcBatch===true,
          requestLifecycle:value.requestLifecycle===true,
          decisions:value.decisions===true,
          approvedArtifactCreation:value.approvedArtifactCreation===true
        });
        return writeCapabilities;
      },
      async createSession(session={}){
        const body=await request('/api/v1/sessions',{method:'POST',body:pickFields(session,['academicYear','curriculumYear','courseCode','sessionType','date','startTime','endTime','topic','room','assignments'])});
        return body.session&&typeof body.session==='object'&&!Array.isArray(body.session)?body.session:{};
      },
      async createSessionBatch({requestId,sessions=[]}={}){
        const body=await request('/api/v1/sessions/batch',{method:'POST',body:{requestId:String(requestId??''),sessions:Array.isArray(sessions)?sessions.map(session=>pickFields(session,['academicYear','curriculumYear','courseCode','sessionType','date','startTime','endTime','topic','room','assignments'])):[]}});
        return {sessions:Array.isArray(body.sessions)?body.sessions:[],idempotentReplay:body.idempotentReplay===true};
      },
      async replaceSessionAssignments(sessionId,assignments=[]){
        const id=String(sessionId??'').trim();
        if(!id)throw new Error('sessionId is required.');
        const body=await request('/api/v1/sessions/'+encodeURIComponent(id)+'/assignments',{method:'PATCH',body:{assignments:Array.isArray(assignments)?assignments.map(row=>pickFields(row,['facultyId','teachingRole'])):[]}});
        return body.session&&typeof body.session==='object'&&!Array.isArray(body.session)?body.session:{};
      },
      async currentUser(){
        const body=await request('/api/v1/me');
        return body.profile;
      },
      async listSessions({start=null,end=null}={}){
        const query=new URLSearchParams();
        if(start)query.set('start',String(start));
        if(end)query.set('end',String(end));
        const suffix=query.toString()?'?'+query.toString():'';
        const body=await request('/api/v1/sessions'+suffix);
        return Array.isArray(body.sessions)?body.sessions:[];
      },
      async patchSession(sessionId, patch){
        const id=String(sessionId??'').trim();
        if(!id)throw new Error('sessionId is required.');
        const body=await request('/api/v1/sessions/'+encodeURIComponent(id),{method:'PATCH',body:pickFields(patch,['date','startTime','endTime','courseCode','sessionType','topic','room'])});
        return body.session&&typeof body.session==='object'&&!Array.isArray(body.session)?body.session:{};
      },
      async dashboardSummary({academicYear=null}={}){
        const query=new URLSearchParams();
        if(String(academicYear??'').trim())query.set('academicYear',String(academicYear));
        const suffix=query.toString()?'?'+query.toString():'';
        const body=await request('/api/v1/dashboard/summary'+suffix);
        return body.summary&&typeof body.summary==='object'&&!Array.isArray(body.summary)?body.summary:{};
      },
      async dashboardFaculty({academicYear=null,search=null,limit=null}={}){
        const query=new URLSearchParams();
        if(String(academicYear??'').trim())query.set('academicYear',String(academicYear));
        if(String(search??'').trim())query.set('search',String(search));
        if(String(limit??'').trim())query.set('limit',String(limit));
        const suffix=query.toString()?'?'+query.toString():'';
        const body=await request('/api/v1/dashboard/faculty'+suffix);
        return Array.isArray(body.faculty)?body.faculty:[];
      },
      async dashboardFacultyById(facultyId,{academicYear=null}={}){
        const id=String(facultyId??'').trim();
        if(!id)throw new Error('facultyId is required.');
        const query=new URLSearchParams();
        if(String(academicYear??'').trim())query.set('academicYear',String(academicYear));
        const suffix=query.toString()?'?'+query.toString():'';
        return request('/api/v1/dashboard/faculty/'+encodeURIComponent(id)+suffix);
      },
      async dashboardTeachingSummary({academicYear=null}={}){
        const query=new URLSearchParams();
        if(String(academicYear??'').trim())query.set('academicYear',String(academicYear));
        const suffix=query.toString()?'?'+query.toString():'';
        const body=await request('/api/v1/dashboard/teaching-summary'+suffix);
        return Array.isArray(body.teachingSummary)?body.teachingSummary:[];
      },
      async dashboardRoles({academicYear=null}={}){
        const query=new URLSearchParams();
        if(String(academicYear??'').trim())query.set('academicYear',String(academicYear));
        const suffix=query.toString()?'?'+query.toString():'';
        const body=await request('/api/v1/dashboard/roles'+suffix);
        return Array.isArray(body.roles)?body.roles:[];
      },
      async dashboardDoeOverview({academicYear=null}={}){
        const query=new URLSearchParams();
        if(String(academicYear??'').trim())query.set('academicYear',String(academicYear));
        const suffix=query.toString()?'?'+query.toString():'';
        const body=await request('/api/v1/dashboard/doe-overview'+suffix);
        return body.doeOverview&&typeof body.doeOverview==='object'&&!Array.isArray(body.doeOverview)?body.doeOverview:{};
      },
      async dashboardAfcRecords({search=null,reason=null,active=null,limit=null}={}){
        const query=new URLSearchParams();
        if(String(search??'').trim())query.set('search',String(search));
        if(String(reason??'').trim())query.set('reason',String(reason));
        if(active===true||active===false)query.set('active',String(active));
        if(String(limit??'').trim())query.set('limit',String(limit));
        const suffix=query.toString()?'?'+query.toString():'';
        const body=await request('/api/v1/dashboard/afc-records'+suffix);
        return Array.isArray(body.afcRecords)?body.afcRecords:[];
      },
      async createDashboardAfcRecord(payload={}){
        const input=payload&&typeof payload==='object'?payload:{};
        const body=await request('/api/v1/dashboard/afc-records',{method:'POST',body:{
          facultyId:String(input.facultyId??'').trim(),
          startDate:String(input.startDate??'').trim(),
          endDate:String(input.endDate??'').trim(),
          reasonCode:String(input.reasonCode??'').trim(),
          notes:input.notes===undefined||input.notes===null?'':String(input.notes)
        }});
        return body.afcRecord&&typeof body.afcRecord==='object'?body.afcRecord:{};
      },
      async createDashboardAfcManualBatch(payload={}){
        const input=payload&&typeof payload==='object'?payload:{};
        const rows=Array.isArray(input.rows)?input.rows.map(row=>({
          facultyId:String(row?.facultyId??'').trim(),
          startDate:String(row?.startDate??'').trim(),
          endDate:String(row?.endDate??'').trim(),
          purpose:typeof row?.purpose==='string'?row.purpose:''
        })):[];
        const body=await request('/api/v1/dashboard/afc-records/batch',{method:'POST',body:{
          requestId:String(input.requestId??'').trim(),
          rows
        }});
        return {requestId:body.requestId||String(input.requestId??''),idempotentReplay:body.idempotentReplay===true,rows:Array.isArray(body.rows)?body.rows:[]};
      },
      async listAfcRequests(){
        const body=await request('/api/v1/afc-requests');
        return Array.isArray(body.afcRequests)?body.afcRequests:[];
      },
      async afcWriteCapabilities(){
        const capabilities=await this.refreshWriteCapabilities();
        return {requestLifecycle:capabilities.requestLifecycle===true,decisions:capabilities.decisions===true,approvedArtifactCreation:capabilities.approvedArtifactCreation===true};
      },
      async submitAfcRequest(payload={}){
        const body=pickFields(payload,[
          'startDate','endDate','reason','purposeDestination','coverage','contactAddress','contactPhone',
          'termsAccepted','termsVersion','termsSource','applicantSignature'
        ]);
        return afcRequestResult('/api/v1/afc-requests',{method:'POST',body});
      },
      async withdrawAfcRequest(afcRequestId){
        return afcRequestResult(requestPath(afcRequestId,'withdraw'),{method:'POST'});
      },
      async recommendAfcRequest(afcRequestId,payload={}){
        const body=pickFields(payload,['signature']);
        return afcRequestResult(requestPath(afcRequestId,'recommend'),{method:'POST',body});
      },
      async rejectAfcRequest(afcRequestId,payload={}){
        const body=pickFields(payload,['signature','rejectionReason']);
        return afcRequestResult(requestPath(afcRequestId,'reject'),{method:'POST',body});
      },
      async approveAfcRequest(afcRequestId,payload={}){
        const body=pickFields(payload,['signature']);
        return afcRequestResult(requestPath(afcRequestId,'approve'),{method:'POST',body});
      },
      async getApprovedAfcArtifact(afcRequestId){
        return requestBinary(requestPath(afcRequestId,'approved-artifact'));
      },
      async createApprovedAfcArtifact(afcRequestId){
        return requestBinary(requestPath(afcRequestId,'approved-artifact'),{method:'POST'});
      }
    });
  }

  return {createPawsAzureDataClient};
});
