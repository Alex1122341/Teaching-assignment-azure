/* DBA HANDOFF ONLY — NOT EXECUTED BY APPLICATION OR HOSTING.
   Run on ITAPPVETOPSDB01/master as an authorized SQL administrator.
   Replace the UUID below with the private deployment UUID before execution.
   Creates ONLY a new VetMed-Ops-Testing, its marker, and a database-local
   administrative mapping for the existing development operator. Does not
   grant server authority, provision a Windows account, read Production data,
   seed business data, or approve a runtime identity. Keep the resulting
   database offline from the app until migrations and online acceptance.
   Any failure after CREATE DATABASE leaves it for explicit DBA review;
   rerunning refuses the existing name rather than adopting or deleting it.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;
DECLARE @environmentId uniqueidentifier=TRY_CONVERT(uniqueidentifier,N'REPLACE_WITH_PRIVATE_TESTING_UUID');
IF @environmentId IS NULL THROW 55880,'Set the reviewed private Testing UUID first.',1;
IF DB_NAME() COLLATE Latin1_General_100_BIN2<>N'master'
 OR COALESCE(UPPER(CONVERT(nvarchar(128),SERVERPROPERTY(N'ServerName'))),N'') COLLATE Latin1_General_100_BIN2<>N'ITAPPVETOPSDB01'
 THROW 55880,'Wrong University server or administrative database.',1;
IF COALESCE(HAS_PERMS_BY_NAME(NULL,NULL,N'VIEW ANY DATABASE'),0)<>1
 OR NOT (COALESCE(HAS_PERMS_BY_NAME(NULL,NULL,N'CREATE ANY DATABASE'),0)=1
 OR COALESCE(HAS_PERMS_BY_NAME(NULL,NULL,N'ALTER ANY DATABASE'),0)=1
 OR COALESCE(HAS_PERMS_BY_NAME(DB_NAME(),N'DATABASE',N'CREATE DATABASE'),0)=1)
 THROW 55880,'An authorized database-creation administrator is required.',1;
IF NOT EXISTS(SELECT 1 FROM sys.server_principals WHERE name=N'UC\sa-xinyu.zhu1' AND type=N'U')
 THROW 55880,'The approved existing Windows development login is absent.',1;
DECLARE @data nvarchar(4000)=CONVERT(nvarchar(4000),SERVERPROPERTY(N'InstanceDefaultDataPath')),
 @log nvarchar(4000)=CONVERT(nvarchar(4000),SERVERPROPERTY(N'InstanceDefaultLogPath'));
IF @data<>N'S:\MSSQLSERVER\Data\' OR @log<>N'L:\MSSQLSERVER\Logs\'
 THROW 55880,'SQL storage differs from the inventoried locations; review before proceeding.',1;
IF NOT EXISTS(SELECT 1 FROM sys.master_files f CROSS APPLY sys.dm_os_volume_stats(f.database_id,f.file_id) v
 WHERE @data LIKE v.volume_mount_point+N'%' AND v.available_bytes>=2147483648)
 OR NOT EXISTS(SELECT 1 FROM sys.master_files f CROSS APPLY sys.dm_os_volume_stats(f.database_id,f.file_id) v
 WHERE @log LIKE v.volume_mount_point+N'%' AND v.available_bytes>=2147483648)
 THROW 55880,'Verified data/log capacity of at least 2GiB is required.',1;
DECLARE @lock int;
EXEC @lock=sys.sp_getapplock @Resource=N'PAWS_UNIVERSITY_TESTING_ADMIN',@LockMode=N'Exclusive',@LockOwner=N'Session',@LockTimeout=15000,@DbPrincipal=N'public';
IF @lock<0 THROW 55880,'Testing administration is already active.',1;
BEGIN TRY
 IF DB_ID(N'VetMed-Ops-Testing') IS NOT NULL
  THROW 55880,'Testing database already exists; this script never adopts or replaces it.',1;
 DECLARE @suffix nvarchar(32)=REPLACE(CONVERT(nvarchar(36),@environmentId),N'-',N''),
  @dataFile nvarchar(4000),@logFile nvarchar(4000);
 SET @dataFile=@data+N'PAWS_Testing_'+@suffix+N'.mdf';
 SET @logFile=@log+N'PAWS_Testing_'+@suffix+N'.ldf';
 IF EXISTS(SELECT 1 FROM sys.dm_os_file_exists(@dataFile) WHERE file_exists=1)
  OR EXISTS(SELECT 1 FROM sys.dm_os_file_exists(@logFile) WHERE file_exists=1)
  THROW 55880,'Testing data files already exist.',1;
 DECLARE @create nvarchar(max)=N'CREATE DATABASE [VetMed-Ops-Testing] ON (NAME=N''PAWS_Testing_Data'',FILENAME=N'''+REPLACE(@dataFile,N'''',N'''''')+N''',SIZE=64MB,MAXSIZE=1024MB,FILEGROWTH=64MB) LOG ON (NAME=N''PAWS_Testing_Log'',FILENAME=N'''+REPLACE(@logFile,N'''',N'''''')+N''',SIZE=32MB,MAXSIZE=512MB,FILEGROWTH=64MB)';
 EXEC sys.sp_executesql @create;
 ALTER DATABASE [VetMed-Ops-Testing] SET TRUSTWORTHY OFF;
 ALTER DATABASE [VetMed-Ops-Testing] SET DB_CHAINING OFF;
 EXEC sys.sp_executesql N'USE [VetMed-Ops-Testing];
 BEGIN TRANSACTION;
 EXEC(N''CREATE SCHEMA paws_env'');
 EXEC(N''CREATE TABLE paws_env.EnvironmentIdentity (
 Environment nvarchar(16) NOT NULL CHECK(Environment=N''''testing''''),
 EnvironmentId uniqueidentifier NOT NULL PRIMARY KEY,
 CreatedAtUtc datetime2(7) NOT NULL DEFAULT SYSUTCDATETIME(),
 Note nvarchar(200) NOT NULL DEFAULT N''''PAWS Testing database: synthetic data only'''');'');
 EXEC sys.sp_executesql N''INSERT paws_env.EnvironmentIdentity(Environment,EnvironmentId) VALUES(N''''testing'''',@markerId);'',N''@markerId uniqueidentifier'',@markerId=@id;
 CREATE USER [UC\sa-xinyu.zhu1] FOR LOGIN [UC\sa-xinyu.zhu1];
 ALTER ROLE db_owner ADD MEMBER [UC\sa-xinyu.zhu1];
 REVOKE CONNECT FROM guest;
 COMMIT TRANSACTION;',N'@id uniqueidentifier',@id=@environmentId;
 EXEC sys.sp_releaseapplock @Resource=N'PAWS_UNIVERSITY_TESTING_ADMIN',@LockOwner=N'Session',@DbPrincipal=N'public';
 SELECT N'CREATED_NOT_READY' AS status,N'ITAPPVETOPSDB01' AS physicalServer,
  N'VetMed-Ops-Testing' AS databaseName,@environmentId AS environmentId,
  SYSUTCDATETIME() AS createdAtUtc;
END TRY
BEGIN CATCH
 IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;
 EXEC sys.sp_releaseapplock @Resource=N'PAWS_UNIVERSITY_TESTING_ADMIN',@LockOwner=N'Session',@DbPrincipal=N'public';
 THROW;
END CATCH;
