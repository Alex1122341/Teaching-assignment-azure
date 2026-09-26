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

    async function request(path){
      const token=await tokenProvider();
      if(!token){
        const error=new Error('Authentication required.');
        error.code='UNAUTHENTICATED';
        throw error;
      }
      const response=await fetchImpl(path,{method:'GET',headers:{Authorization:'Bearer '+token,Accept:'application/json'}});
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
      }
    });
  }

  return {createPawsAzureDataClient};
});
