/* Reproduce the existing school function's metadata in disposable SQL only. */
:ON ERROR EXIT
SET NOCOUNT ON;
IF DB_NAME()<>N'VetMed-Ops' OR USER_ID(N'paws-calendar-test-runtime') IS NULL THROW 54360,'Disposable workflow required.',1;
DECLARE @Definition nvarchar(max)=OBJECT_DEFINITION(OBJECT_ID(N'paws_api.CanActOnTeachingAssignmentPackage'));
IF @Definition IS NULL THROW 54360,'Original workflow function unavailable.',1;
-- Change only the DDL verb; preserve every parameter and body byte.
SET @Definition=N'ALTER '+SUBSTRING(@Definition,CHARINDEX(N'FUNCTION',UPPER(@Definition)),LEN(@Definition));
EXEC sys.sp_executesql N'SET QUOTED_IDENTIFIER OFF; EXEC sys.sp_executesql @Definition;',N'@Definition nvarchar(max)',@Definition;
IF NOT EXISTS(SELECT 1 FROM sys.sql_modules WHERE object_id=OBJECT_ID(N'paws_api.CanActOnTeachingAssignmentPackage') AND uses_ansi_nulls=1 AND uses_quoted_identifier=0)
 THROW 54360,'Legacy quoted-identifier fixture did not reproduce school metadata.',1;
