-- B1 proposal only. Do not apply this file to live SQL during B1.
-- Bind the actual runtime principal at the separately approved B1D gate.
:setvar PAWS_API_PRINCIPAL "paws-sql-beta-mi"

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF USER_ID(N'$(PAWS_API_PRINCIPAL)') IS NULL
    THROW 51301, 'The B1 runtime principal must already exist before permissions are applied.', 1;

DECLARE @PrincipalId int = USER_ID(N'$(PAWS_API_PRINCIPAL)');
DECLARE @PrincipalSid varbinary(85);
DECLARE @PrincipalType char(1);
SELECT @PrincipalSid = sid, @PrincipalType = type
FROM sys.database_principals
WHERE principal_id = @PrincipalId;

IF @PrincipalType = N'X'
    THROW 51302, 'The B1 runtime principal must be a dedicated user, not an external group.', 1;
IF EXISTS (SELECT 1 FROM sys.databases WHERE database_id = DB_ID() AND owner_sid = @PrincipalSid)
    THROW 51303, 'The B1 runtime principal must not own the database.', 1;
IF EXISTS (SELECT 1 FROM sys.database_role_members WHERE member_principal_id = @PrincipalId)
    THROW 51304, 'The B1 runtime principal must not inherit a database role.', 1;

IF SCHEMA_ID(N'paws') IS NULL OR EXISTS (
    SELECT 1 FROM sys.schemas WHERE name = N'paws' AND USER_NAME(principal_id) <> N'dbo'
)
    THROW 51305, 'The paws schema must exist and be owned by dbo.', 1;
IF SCHEMA_ID(N'paws_api') IS NULL OR EXISTS (
    SELECT 1 FROM sys.schemas WHERE name = N'paws_api' AND USER_NAME(principal_id) <> N'dbo'
)
    THROW 51306, 'The paws_api schema must exist and be owned by dbo.', 1;
IF OBJECT_ID(N'paws.vAfcRecordUnified', N'V') IS NULL
    THROW 51307, 'The unified AFC view must exist before its grant is applied.', 1;
IF OBJECT_ID(N'paws_api.CreateAfcRecord', N'P') IS NULL
    THROW 51308, 'The AFC write procedure must exist before its grant is applied.', 1;

IF EXISTS (SELECT 1 FROM sys.schemas WHERE principal_id = @PrincipalId)
    OR EXISTS (SELECT 1 FROM sys.objects WHERE principal_id = @PrincipalId)
    THROW 51309, 'The B1 runtime principal must own no schemas or objects.', 1;

-- The only direct database-level permission in the reviewed contract is the
-- ordinary CONNECT grant. Every other database permission fails closed.
IF EXISTS (
    SELECT 1
    FROM sys.database_permissions
    WHERE grantee_principal_id = @PrincipalId
      AND NOT (class = 0 AND permission_name = N'CONNECT' AND state = N'G')
)
    THROW 51310, 'The B1 runtime principal has an unexpected database-level permission.', 1;

-- Existing Beta permissions are column-scoped object reads plus the four paws
-- mutation DENYs and five staging DENYs. No positive schema grant is allowed.
IF EXISTS (
    SELECT 1
    FROM sys.database_permissions
    WHERE grantee_principal_id = @PrincipalId
      AND class = 3
      AND NOT (
          state = N'D'
          AND (
              (SCHEMA_NAME(major_id) = N'paws' AND permission_name IN (N'INSERT', N'UPDATE', N'DELETE', N'EXECUTE'))
              OR (SCHEMA_NAME(major_id) = N'staging' AND permission_name IN (N'SELECT', N'INSERT', N'UPDATE', N'DELETE', N'EXECUTE'))
          )
      )
)
    THROW 51311, 'The B1 runtime principal has an unexpected schema-level permission.', 1;

-- Reject direct write/execute capability before either B1 GRANT. The exact
-- B1 grants are idempotently allowed so this file remains rerun-safe.
IF EXISTS (
    SELECT 1
    FROM sys.database_permissions
    WHERE grantee_principal_id = @PrincipalId
      AND class = 1
      AND state IN (N'G', N'W')
      AND (
          permission_name IN (N'INSERT', N'UPDATE', N'DELETE', N'ALTER', N'CONTROL', N'TAKE OWNERSHIP')
          OR (permission_name = N'EXECUTE' AND NOT (
              major_id = OBJECT_ID(N'paws_api.CreateAfcRecord')
              AND OBJECT_SCHEMA_NAME(major_id) = N'paws_api'
              AND state = N'G'
          ))
          OR OBJECT_SCHEMA_NAME(major_id) = N'staging'
      )
)
    THROW 51312, 'The B1 runtime principal has an unexpected object write or execute permission.', 1;

IF EXISTS (
    SELECT 1
    FROM sys.database_permissions
    WHERE grantee_principal_id = @PrincipalId
      AND class = 1
      AND state IN (N'G', N'W')
      AND OBJECT_SCHEMA_NAME(major_id) = N'paws_api'
      AND NOT (
          major_id = OBJECT_ID(N'paws_api.CreateAfcRecord')
          AND permission_name = N'EXECUTE'
          AND state = N'G'
      )
)
    THROW 51313, 'The B1 runtime principal has an unexpected paws_api object grant.', 1;

IF EXISTS (
    SELECT 1
    FROM sys.database_permissions
    WHERE grantee_principal_id = @PrincipalId
      AND class = 1
      AND state = N'W'
      AND major_id = OBJECT_ID(N'paws.vAfcRecordUnified')
      AND permission_name = N'SELECT'
)
    THROW 51318, 'The unified AFC read grant must not carry grant option.', 1;

IF EXISTS (
    SELECT 1
    FROM sys.database_principals AS public_principal
    INNER JOIN sys.database_permissions AS permission
      ON permission.grantee_principal_id = public_principal.principal_id
    WHERE public_principal.name = N'public'
      AND permission.state IN (N'G', N'W')
      AND (
          (permission.class = 0 AND NOT (permission.permission_name = N'CONNECT' AND permission.state = N'G'))
          OR (permission.class = 3 AND SCHEMA_NAME(permission.major_id) IN (N'paws', N'paws_api', N'staging'))
          OR (permission.class = 1 AND OBJECT_SCHEMA_NAME(permission.major_id) IN (N'paws', N'paws_api', N'staging'))
      )
)
    THROW 51314, 'public has an unexpected grant affecting the B1 SQL boundary.', 1;

IF (
    SELECT COUNT(DISTINCT permission_name)
    FROM sys.database_permissions
    WHERE grantee_principal_id = @PrincipalId
      AND class = 3
      AND major_id = SCHEMA_ID(N'paws')
      AND state = N'D'
      AND permission_name IN (N'INSERT', N'UPDATE', N'DELETE', N'EXECUTE')
) <> 4
    THROW 51315, 'The four existing paws mutation DENYs must remain in force.', 1;

IF (
    SELECT COUNT(DISTINCT permission_name)
    FROM sys.database_permissions
    WHERE grantee_principal_id = @PrincipalId
      AND class = 3
      AND major_id = SCHEMA_ID(N'staging')
      AND state = N'D'
      AND permission_name IN (N'SELECT', N'INSERT', N'UPDATE', N'DELETE', N'EXECUTE')
) <> 5
    THROW 51316, 'The five existing staging DENYs must remain in force.', 1;

-- Verify the ownership chain before the grants are added. B1 never silently
-- changes an operator-owned schema or object.
IF EXISTS (
    SELECT 1
    FROM sys.objects AS o
    INNER JOIN sys.schemas AS s ON s.schema_id = o.schema_id
    WHERE (
        (s.name = N'paws_api' AND o.name = N'CreateAfcRecord')
        OR (s.name = N'paws' AND o.name IN (N'AfcManualRecord', N'AuditEvent', N'Faculty', N'AfcRecord', N'vAfcRecordUnified'))
    )
      AND COALESCE(USER_NAME(o.principal_id), USER_NAME(s.principal_id)) <> N'dbo'
)
    THROW 51317, 'An AFC procedure or target object has an incompatible owner.', 1;

-- All guards above execute before either new B1 GRANT.
BEGIN TRY
    BEGIN TRANSACTION;
    GRANT SELECT ON OBJECT::paws.vAfcRecordUnified TO [$(PAWS_API_PRINCIPAL)];
    GRANT EXECUTE ON OBJECT::paws_api.CreateAfcRecord TO [$(PAWS_API_PRINCIPAL)];
    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
