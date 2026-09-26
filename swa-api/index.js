'use strict';
const {app}=require('@azure/functions');
const {createSwaSqlRuntime}=require('./server/src/runtime/swa-sql-runtime');
let runtime;
const handle=request=>(runtime||(runtime=createSwaSqlRuntime()))(request);
app.http('paws-health-sql',{methods:['GET'],authLevel:'anonymous',route:'health/sql',handler:handle});
app.http('paws-current-user',{methods:['GET'],authLevel:'anonymous',route:'v1/me',handler:handle});
app.http('paws-sessions',{methods:['GET'],authLevel:'anonymous',route:'v1/sessions',handler:handle});
