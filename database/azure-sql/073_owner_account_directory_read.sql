/* Review candidate: bounded, read-only Owner account directory.
   Static dbo ownership chain; no direct Email SELECT grant, no role
   membership, EXECUTE AS, dynamic SQL, account or business data change.
   Do not apply to University SQL until independently reviewed and authorized. */
:ON ERROR EXIT
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
IF DB_NAME()<>N'VetMed-Ops'
 OR OBJECT_ID(N'paws.UserProfile',N'U') IS NULL
 OR OBJECT_ID(N'paws.Faculty',N'U') IS NULL
 OR COL_LENGTH(N'paws.UserProfile',N'Email') IS NULL
 OR COL_LENGTH(N'paws.UserProfile',N'AccessVersion') IS NULL
 OR COL_LENGTH(N'paws.Faculty',N'ActivationDate') IS NULL
 OR DATABASE_PRINCIPAL_ID(N'paws_runtime_account_access') IS NULL
 OR OBJECT_ID(N'paws_api.ListOwnerAccountDirectory') IS NOT NULL
 OR (SELECT COUNT(*) FROM sys.schemas WHERE name IN(N'paws',N'paws_api') AND principal_id=DATABASE_PRINCIPAL_ID(N'dbo'))<>2
 OR EXISTS(SELECT 1 FROM sys.objects WHERE object_id IN(OBJECT_ID(N'paws.UserProfile'),OBJECT_ID(N'paws.Faculty')) AND principal_id IS NOT NULL AND principal_id<>DATABASE_PRINCIPAL_ID(N'dbo'))
 THROW 57300,'Inspect Owner directory prerequisites, schema owners and prior deployment before applying.',1;
BEGIN TRANSACTION;
GO
CREATE PROCEDURE paws_api.ListOwnerAccountDirectory
 @ActorUid nvarchar(256), @ActorVersion varchar(64)
AS
BEGIN
 -- The trusted API derives UID from the verified Firebase token and
 -- version from its effective SQL identity. Neither comes from query input.
 SET NOCOUNT ON;
 SET XACT_ABORT ON;
 IF @@TRANCOUNT<>0 THROW 57301,'Owner directory requires its own transaction.',1;
 IF @ActorUid IS NULL OR DATALENGTH(@ActorUid)=0 OR DATALENGTH(@ActorUid)>256
  OR @ActorVersion IS NULL OR DATALENGTH(@ActorVersion)<>16
  OR @ActorVersion COLLATE Latin1_General_100_BIN2 LIKE '%[^0-9A-Fa-f]%'
  OR TRY_CONVERT(binary(8),@ActorVersion,2) IS NULL
  THROW 57302,'Active current Owner authority required.',1;
 BEGIN TRY
  BEGIN TRANSACTION;
  -- Hold the actor binding until the bounded result is read. API repeats
  -- authorization/version check before returning any directory response.
  IF NOT EXISTS(SELECT 1 FROM paws.UserProfile WITH(HOLDLOCK)
   WHERE FirebaseUid=@ActorUid
     AND FirebaseUid COLLATE Latin1_General_100_BIN2=@ActorUid COLLATE Latin1_General_100_BIN2
     AND DATALENGTH(FirebaseUid)=DATALENGTH(@ActorUid)
     AND LOWER(LTRIM(RTRIM(BaseRole))) IN(N'owner',N'adfa_general')
     AND Active=1 AND MustChangePassword=0
     AND AccessVersion=CONVERT(binary(8),@ActorVersion,2))
   THROW 57302,'Active current Owner authority required.',1;
  SELECT TOP(1001)
   u.FirebaseUid AS firebaseUid,u.DisplayName AS displayName,u.Email AS email,u.BaseRole AS baseRole,
   f.PreferredFirstName AS preferredFirstName,f.PreferredLastName AS preferredLastName,u.FacultyId AS facultyId,
   CASE WHEN LOWER(LTRIM(RTRIM(u.BaseRole))) IN(N'faculty',N'hicc',N'visc')
    AND (f.FacultyId IS NULL OR f.Active=0 OR (f.ActivationDate IS NOT NULL AND
     f.ActivationDate>CONVERT(date,SYSDATETIMEOFFSET() AT TIME ZONE 'Mountain Standard Time')))
    THEN CAST(0 AS bit) ELSE u.Active END AS active,
   u.MustChangePassword AS mustChangePassword,
   LOWER(CONVERT(varchar(16),CONVERT(binary(8),u.AccessVersion),2)) AS version
  FROM paws.UserProfile u LEFT JOIN paws.Faculty f ON f.FacultyId=u.FacultyId
  ORDER BY u.DisplayName,u.FirebaseUid;
  COMMIT TRANSACTION;
 END TRY
 BEGIN CATCH
  IF XACT_STATE()<>0 ROLLBACK TRANSACTION;
  THROW;
 END CATCH;
END;
GO
GRANT EXECUTE ON OBJECT::paws_api.ListOwnerAccountDirectory TO paws_runtime_account_access;
COMMIT TRANSACTION;
GO
