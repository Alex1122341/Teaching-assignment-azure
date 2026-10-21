/* Guarded rollback: remove only the added CCC read procedure, never the CCC records. */
IF DB_NAME()<>N'VetMed-Ops' THROW 55708,'The CCC rollback requires VetMed-Ops.',1;
DECLARE @ObjectId int=OBJECT_ID(N'paws_api.ListCccSchedule',N'P');
IF @ObjectId IS NULL THROW 55708,'The CCC reader is not installed.',1;
IF OBJECT_DEFINITION(@ObjectId) NOT LIKE N'%PAWS_CCC_SCHEDULE_READ_V1%'
 THROW 55708,'The CCC reader was modified; refuse rollback.',1;
IF EXISTS(
 SELECT 1 FROM sys.database_permissions p
 WHERE p.major_id=@ObjectId AND p.class=1
   AND NOT (p.grantee_principal_id=DATABASE_PRINCIPAL_ID(N'paws_runtime_read')
            AND p.permission_name=N'EXECUTE' AND p.state=N'G')
) THROW 55708,'Unexpected CCC reader grants; refuse rollback.',1;
DROP PROCEDURE paws_api.ListCccSchedule;
GO
