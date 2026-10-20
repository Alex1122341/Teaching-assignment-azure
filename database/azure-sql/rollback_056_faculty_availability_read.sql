/* Guarded rollback for read-only Faculty Availability projection.
   Execute only when the API is no longer using this procedure.
   Does not mutate Faculty, Session, Calendar, AFC, Role or audit business data.
*/
IF DB_NAME()<>N'VetMed-Ops' THROW 55600,'Faculty availability rollback requires VetMed-Ops.',1;
IF OBJECT_ID(N'paws_api.ListFacultyAvailability',N'P') IS NULL
 THROW 55600,'The expected availability procedure is missing; do not improvise rollback.',1;
REVOKE EXECUTE ON OBJECT::paws_api.ListFacultyAvailability FROM paws_runtime_read;
DROP PROCEDURE paws_api.ListFacultyAvailability;
