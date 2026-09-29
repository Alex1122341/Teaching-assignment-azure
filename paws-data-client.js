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

  function defaultTokenProvider(){
    if(typeof firebase==='undefined'||!firebase.auth)return Promise.resolve('');
    const user=firebase.auth().currentUser;
    return user?user.getIdToken():Promise.resolve('');
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

    async function request(path){
      const token=await tokenProvider();
      if(!token){
        const error=new Error('Authentication required.');
        error.code='UNAUTHENTICATED';
        throw error;
      }
      const response=await fetchImpl(apiOrigin+path,{method:'GET',headers:{Authorization:'Bearer '+token,Accept:'application/json'},credentials:'omit'});
      const body=await safeJson(response);
      if(!response.ok){
        const error=new Error(body?.error?.message||'The PAWS data service is unavailable.');
        error.code=body?.error?.code||('HTTP_'+response.status);
        error.status=response.status;
        throw error;
      }
      return body;
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
      }
    });
  }

  return {createPawsAzureDataClient};
});
