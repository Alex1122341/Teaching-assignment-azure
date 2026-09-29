-- B1 proposal-only proof. Run only in an isolated review database or at B1D.
:setvar PAWS_API_PRINCIPAL "paws-sql-beta-mi"

SET NOCOUNT ON;

DECLARE @principalId int = USER_ID(N'$(PAWS_API_PRINCIPAL)');
IF @principalId IS NULL THROW 51310, 'Runtime principal is absent.', 1;

IF EXISTS (SELECT 1 FROM sys.database_role_members WHERE member_principal_id = @principalId)
    THROW 51311, 'Runtime principal inherits a database role.', 1;
IF EXISTS (SELECT 1 FROM sys.database_principals WHERE principal_id = @principalId AND owning_principal_id IS NOT NULL)
    THROW 51312, 'Runtime principal owns a database object.', 1;
IF EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'paws_api' AND USER_NAME(principal_id) <> N'dbo')
    THROW 51318, 'paws_api schema ownership is not dbo.', 1;
IF EXISTS (
    SELECT 1
    FROM sys.objects AS o
    INNER JOIN sys.schemas AS s ON s.schema_id = o.schema_id
    WHERE s.name = N'paws_api'
      AND o.name = N'CreateAfcRecord'
      AND COALESCE(USER_NAME(o.principal_id), USER_NAME(s.principal_id)) <> N'dbo'
)
    THROW 51319, 'CreateAfcRecord ownership is not compatible with paws_api.', 1;
IF EXISTS (SELECT 1 FROM sys.database_permissions WHERE grantee_principal_id = @principalId AND state IN ('G', 'W') AND class_desc = 'DATABASE' AND permission_name = 'CONTROL')
    THROW 51313, 'Runtime principal has broad database control.', 1;
IF EXISTS (SELECT 1 FROM sys.database_permissions WHERE grantee_principal_id = @principalId AND state IN ('G', 'W') AND class_desc = 'SCHEMA' AND permission_name = 'EXECUTE' AND major_id = SCHEMA_ID(N'paws_api'))
    THROW 51314, 'Runtime principal has schema-wide paws_api EXECUTE.', 1;
IF EXISTS (
    SELECT 1
    FROM sys.database_permissions
    WHERE grantee_principal_id = @principalId
      AND state IN ('G', 'W')
      AND permission_name IN ('INSERT', 'UPDATE', 'DELETE', 'EXECUTE')
      AND class_desc = 'SCHEMA'
      AND major_id = SCHEMA_ID(N'paws')
)
    THROW 51320, 'Runtime principal has a broad paws schema mutation grant.', 1;
IF EXISTS (
    SELECT 1
    FROM sys.database_permissions
    WHERE grantee_principal_id = @principalId
      AND state IN ('G', 'W')
      AND permission_name = 'SELECT'
      AND ((class_desc = 'SCHEMA' AND major_id = SCHEMA_ID(N'staging'))
        OR (class_desc = 'OBJECT_OR_COLUMN' AND OBJECT_SCHEMA_NAME(major_id) = N'staging'))
)
    THROW 51321, 'Runtime principal can read staging.', 1;
IF EXISTS (SELECT 1 FROM sys.database_permissions WHERE grantee_principal_id = @principalId AND state IN ('G', 'W') AND class_desc = 'OBJECT_OR_COLUMN' AND major_id = OBJECT_ID(N'paws.AfcManualRecord') AND permission_name IN ('INSERT', 'UPDATE', 'DELETE'))
    THROW 51315, 'Runtime principal has direct manual AFC table DML.', 1;
IF EXISTS (SELECT 1 FROM sys.database_permissions WHERE grantee_principal_id = @principalId AND state IN ('G', 'W') AND class_desc = 'OBJECT_OR_COLUMN' AND major_id = OBJECT_ID(N'paws.AfcManualRecord') AND permission_name = 'SELECT')
    THROW 51322, 'Runtime principal has direct manual AFC table SELECT.', 1;
IF (
    SELECT COUNT(DISTINCT permission_name)
    FROM sys.database_permissions
    WHERE grantee_principal_id = @principalId
      AND class_desc = 'SCHEMA'
      AND major_id = SCHEMA_ID(N'paws')
      AND state = 'D'
      AND permission_name IN ('INSERT', 'UPDATE', 'DELETE', 'EXECUTE')
) <> 4
    THROW 51323, 'The four paws schema mutation DENY rows are not all present.', 1;
IF NOT EXISTS (
    SELECT 1
    FROM sys.database_permissions
    WHERE grantee_principal_id = @principalId
      AND class_desc = 'SCHEMA'
      AND major_id = SCHEMA_ID(N'staging')
      AND state = 'D'
      AND permission_name = 'SELECT'
)
    THROW 51324, 'staging SELECT DENY row is missing.', 1;
IF NOT EXISTS (SELECT 1 FROM sys.database_permissions WHERE grantee_principal_id = @principalId AND state IN ('G', 'W') AND class_desc = 'OBJECT_OR_COLUMN' AND major_id = OBJECT_ID(N'paws.vAfcRecordUnified') AND permission_name = 'SELECT')
    THROW 51316, 'Unified AFC SELECT grant is missing.', 1;
IF NOT EXISTS (SELECT 1 FROM sys.database_permissions WHERE grantee_principal_id = @principalId AND state IN ('G', 'W') AND class_desc = 'OBJECT_OR_COLUMN' AND major_id = OBJECT_ID(N'paws_api.CreateAfcRecord') AND permission_name = 'EXECUTE')
    THROW 51317, 'Exact AFC procedure EXECUTE grant is missing.', 1;

PRINT N'LEAST_PRIVILEGE_WRITE_PROOF_OK';
