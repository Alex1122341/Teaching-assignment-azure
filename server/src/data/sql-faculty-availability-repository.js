'use strict';
function decodedResponse(rows){
 let result;try{result=JSON.parse(rows[0]?.responseJson);}catch(_){throw Error('Invalid availability SQL response.');}
 if(!result||typeof result!=='object'||Array.isArray(result))throw Error('Invalid availability SQL response.');
 return result;
}
function createSqlFacultyAvailabilityRepository(db){
 if(typeof db?.query!=='function')throw new TypeError('SQL query required.');
 return Object.freeze({
  async list({actorFirebaseUid,facultyId,mode,startDate,endDate,kind,cursor,limit}){
   const rows=await db.query(
    'EXEC paws_api.ListFacultyAvailability @ActorFirebaseUid=@actorFirebaseUid, @FacultyId=@facultyId, @Mode=@mode, @StartDate=@startDate, @EndDate=@endDate, @Kind=@kind, @Cursor=@cursor, @Limit=@limit',
    {actorFirebaseUid,facultyId,mode,startDate,endDate,kind,cursor,limit}
   );
   const result=decodedResponse(rows);
   if(!Array.isArray(result.items))throw Error('Invalid availability SQL response.');
   return result;
  },
  async bulk({actorFirebaseUid,action,selection='selected',facultyIds=[],includeInactive=false,mode='upcoming',startDate=null,endDate=null,
   rosterSearch=null,rosterOffset=0}){
   const rows=await db.query(
    'EXEC paws_api.ListFacultyAvailabilityBulk @ActorFirebaseUid=@actorFirebaseUid, @Action=@action, @Selection=@selection, @FacultyIdsJson=@facultyIdsJson, @IncludeInactive=@includeInactive, @Mode=@mode, @StartDate=@startDate, @EndDate=@endDate, @RosterSearch=@rosterSearch, @RosterOffset=@rosterOffset',
    {actorFirebaseUid,action,selection,facultyIdsJson:JSON.stringify(facultyIds),includeInactive,mode,startDate,endDate,rosterSearch,rosterOffset}
   );
   return decodedResponse(rows);
  }
 });
}
module.exports={createSqlFacultyAvailabilityRepository};
