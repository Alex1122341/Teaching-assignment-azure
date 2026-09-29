-- B1 proposal-only proof. Run only in an isolated review database or at B1D.
:setvar PAWS_API_PRINCIPAL "paws-sql-beta-mi"

SET NOCOUNT ON;

DECLARE @PrincipalId int = USER_ID(N'$(PAWS_API_PRINCIPAL)');
DECLARE @PrincipalSid varbinary(85);
DECLARE @PrincipalType char(1);
IF @PrincipalId IS NULL THROW 51310, 'Runtime principal is absent.', 1;

SELECT @PrincipalSid = sid, @PrincipalType = type
FROM sys.database_principals
WHERE principal_id = @PrincipalId;

IF @PrincipalType = N'X'
    THROW 51325, 'Runtime principal must be a dedicated user, not an external group.', 1;
IF EXISTS (SELECT 1 FROM sys.databases WHERE database_id = DB_ID() AND owner_sid = @PrincipalSid)
    THROW 51326, 'Runtime principal must not own the database.', 1;
IF EXISTS (SELECT 1 FROM sys.database_role_members WHERE member_principal_id = @PrincipalId)
    THROW 51311, 'Runtime principal inherits a database role.', 1;

-- The old owning_principal_id test was not an ownership proof. Ownership is
-- checked through schema principals and object principals, including the
-- underlying paws schema used by the cross-schema ownership chain.
IF EXISTS (SELECT 1 FROM sys.schemas WHERE principal_id = @PrincipalId)
    OR EXISTS (SELECT 1 FROM sys.objects WHERE principal_id = @PrincipalId)
    THROW 51312, 'Runtime principal owns schemas or objects.', 1;
IF SCHEMA_ID(N'paws') IS NULL OR EXISTS (
    SELECT 1 FROM sys.schemas WHERE name = N'paws' AND USER_NAME(principal_id) <> N'dbo'
)
    THROW 51327, 'paws schema ownership is not dbo.', 1;
IF SCHEMA_ID(N'paws_api') IS NULL OR EXISTS (
    SELECT 1 FROM sys.schemas WHERE name = N'paws_api' AND USER_NAME(principal_id) <> N'dbo'
)
    THROW 51318, 'paws_api schema ownership is not dbo.', 1;
IF OBJECT_ID(N'paws.vAfcRecordUnified', N'V') IS NULL
    OR OBJECT_ID(N'paws_api.CreateAfcRecord', N'P') IS NULL
    THROW 51328, 'Required B1 AFC objects are absent.', 1;
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
    THROW 51319, 'AFC procedure or target object ownership is incompatible with the chain.', 1;

-- Fail closed on direct database and schema permissions. The existing
-- reviewed contract permits CONNECT, four paws mutation DENYs, and five
-- staging DENYs; no other direct database/schema permission is expected.
IF EXISTS (
    SELECT 1 FROM sys.database_permissions
    WHERE grantee_principal_id = @PrincipalId
      AND NOT (class = 0 AND permission_name = N'CONNECT' AND state = N'G')
)
    THROW 51329, 'Unexpected direct database-level permission.', 1;
IF EXISTS (
    SELECT 1 FROM sys.database_permissions
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
    THROW 51330, 'Unexpected direct schema-level permission.', 1;

-- No unexpected mutation-capable grant may be present. The only permitted
-- direct object EXECUTE is the exact B1 procedure; all existing read grants
-- remain column-scoped grants from the reviewed R4D-10A/10A2 contract.
IF EXISTS (
    SELECT 1 FROM sys.database_permissions
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
    THROW 51331, 'Unexpected object mutation or execute grant.', 1;
IF EXISTS (
    SELECT 1 FROM sys.database_permissions
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
    THROW 51332, 'Unexpected paws_api object grant.', 1;
IF EXISTS (
    SELECT 1 FROM sys.database_permissions
    WHERE grantee_principal_id = @PrincipalId
      AND class = 1
      AND state IN (N'G', N'W')
      AND major_id = OBJECT_ID(N'paws.AfcManualRecord')
      AND permission_name = N'SELECT'
)
    THROW 51322, 'Runtime principal has direct manual AFC table SELECT.', 1;
IF EXISTS (
    SELECT 1 FROM sys.database_permissions
    WHERE grantee_principal_id = @PrincipalId
      AND class = 1
      AND state IN (N'G', N'W')
      AND major_id = OBJECT_ID(N'paws.AfcManualRecord')
      AND permission_name IN (N'INSERT', N'UPDATE', N'DELETE')
)
    THROW 51315, 'Runtime principal has direct manual AFC table DML.', 1;

-- public must not broaden paws, paws_api, staging, or database-wide mutation /
-- execute access for the runtime principal.
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
    THROW 51333, 'public has an unexpected grant affecting the B1 SQL boundary.', 1;

IF (
    SELECT COUNT(DISTINCT permission_name)
    FROM sys.database_permissions
    WHERE grantee_principal_id = @PrincipalId
      AND class = 3
      AND major_id = SCHEMA_ID(N'paws')
      AND state = N'D'
      AND permission_name IN (N'INSERT', N'UPDATE', N'DELETE', N'EXECUTE')
) <> 4
    THROW 51323, 'The four paws schema mutation DENY rows are not all present.', 1;
IF (
    SELECT COUNT(DISTINCT permission_name)
    FROM sys.database_permissions
    WHERE grantee_principal_id = @PrincipalId
      AND class = 3
      AND major_id = SCHEMA_ID(N'staging')
      AND state = N'D'
      AND permission_name IN (N'SELECT', N'INSERT', N'UPDATE', N'DELETE', N'EXECUTE')
) <> 5
    THROW 51324, 'The five staging DENY rows are not all present.', 1;

IF NOT EXISTS (
    SELECT 1 FROM sys.database_permissions
    WHERE grantee_principal_id = @PrincipalId
      AND state = N'G'
      AND class = 1
      AND major_id = OBJECT_ID(N'paws.vAfcRecordUnified')
      AND permission_name = N'SELECT'
)
    THROW 51316, 'Unified AFC SELECT grant is missing.', 1;
IF NOT EXISTS (
    SELECT 1 FROM sys.database_permissions
    WHERE grantee_principal_id = @PrincipalId
      AND state = N'G'
      AND class = 1
      AND major_id = OBJECT_ID(N'paws_api.CreateAfcRecord')
      AND permission_name = N'EXECUTE'
)
    THROW 51317, 'Exact AFC procedure EXECUTE grant is missing.', 1;

PRINT N'LEAST_PRIVILEGE_WRITE_PROOF_OK';
