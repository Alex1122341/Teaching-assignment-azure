(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root){
    root.createPawsAzureDataClient=api.createPawsAzureDataClient;
    root.UCVM_PAWS_DATA=api.createPawsAzureDataClient();
  }
})(typeof window==='undefined'?globalThis:window,function(){
  'use strict';

  const API_ORIGIN='https://paws-sql-beta-api-260926.wonderfulglacier-ff8c7a3b.eastus2.azurecontainerapps.io';

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

    // Translates a response into the existing error contract: {status, code, message}.
    async function settle(response){
      const body=await safeJson(response);
      if(!response.ok){
        const error=new Error(body?.error?.message||'The PAWS data service is unavailable.');
        error.code=body?.error?.code||('HTTP_'+response.status);
        error.status=response.status;
        throw error;
      }
      return body;
    }

    async function request(path,{method='GET',body:requestBody}={}){
      const url=apiOrigin+path;
      const buildInit=token=>{
        const headers={Authorization:'Bearer '+token,Accept:'application/json'};
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
      if(response.status!==401)return settle(response);

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
      return settle(retryResponse);
    }

    return Object.freeze({
      sessionBackend:()=> 'azure-sql',
      sessionWritesEnabled:()=> false,
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
      }
    });
  }

  return {createPawsAzureDataClient};
});
