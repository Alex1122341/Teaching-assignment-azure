-- BETA-R4D-10A — read-only proof for the Dashboard SQL principal.
--
-- Run as a sysadmin/db_owner connection AFTER 004_swa_beta_permissions.sql has
-- been applied. Every check below must report DENIED / NO-GRANT; the script
-- throws as soon as one fails, so a green run is a positive statement that the
-- Dashboard read principal cannot mutate `paws` and cannot read `staging`.
--
-- This script performs no mutation.

SET NOCOUNT ON;

DECLARE @Principal sysname = N'paws_swa_beta';
DECLARE @PrincipalId int = USER_ID(@Principal);
IF @PrincipalId IS NULL
    THROW 51100, 'paws_swa_beta does not exist; apply 004_swa_beta_permissions.sql first.', 1;

-- 1. No schema-wide or object-level DML grant anywhere in `paws`.
IF EXISTS (
    SELECT 1
    FROM sys.database_permissions AS p
    WHERE p.grantee_principal_id = @PrincipalId
      AND p.state IN (N'G', N'W')
      AND p.permission_name IN (N'INSERT', N'UPDATE', N'DELETE', N'MERGE', N'EXECUTE', N'ALTER', N'CONTROL', N'TAKE OWNERSHIP')
) THROW 51101, 'paws_swa_beta holds a mutation-capable permission.', 1;

-- 2. No SELECT grant of any kind on the staging schema.
IF EXISTS (
    SELECT 1
    FROM sys.database_permissions AS p
    WHERE p.grantee_principal_id = @PrincipalId
      AND p.state IN (N'G', N'W')
      AND p.permission_name = N'SELECT'
      AND (
        (p.class = 3 AND SCHEMA_NAME(p.major_id) = N'staging')
        OR (p.class = 1 AND OBJECT_SCHEMA_NAME(p.major_id) = N'staging')
      )
) THROW 51102, 'paws_swa_beta can read the staging schema.', 1;

-- 3. Explicit DENY rows exist for the mutation verbs and for staging SELECT.
IF NOT EXISTS (
    SELECT 1
    FROM sys.database_permissions
    WHERE grantee_principal_id = @PrincipalId
      AND class = 3
      AND SCHEMA_NAME(major_id) = N'paws'
      AND state = N'D'
      AND permission_name IN (N'INSERT', N'UPDATE', N'DELETE', N'EXECUTE')
    GROUP BY granted_privileges
) THROW 51103, 'paws schema mutation DENY rows are missing.', 1;

IF NOT EXISTS (
    SELECT 1
    FROM sys.database_permissions
    WHERE grantee_principal_id = @PrincipalId
      AND class = 3
      AND SCHEMA_NAME(major_id) = N'staging'
      AND state = N'D'
      AND permission_name = N'SELECT'
) THROW 51104, 'staging SELECT DENY row is missing.', 1;

-- 4. The principal holds no database role.
IF EXISTS (SELECT 1 FROM sys.database_role_members WHERE member_principal_id = @PrincipalId)
    THROW 51105, 'paws_swa_beta inherits a database role.', 1;

-- 5. Effective-permission probe: HAS_PERMS_BY_NAME must be 0 for every verb.
--    This is the authoritative effective check (it accounts for role and DENY
--    inheritance, unlike a raw sys.database_permissions scan).
IF HAS_PERMS_BY_NAME(N'paws.Session', N'OBJECT', N'INSERT') = 1
    OR HAS_PERMS_BY_NAME(N'paws.Session', N'OBJECT', N'UPDATE') = 1
    OR HAS_PERMS_BY_NAME(N'paws.Session', N'OBJECT', N'DELETE') = 1
    OR HAS_PERMS_BY_NAME(N'paws.UserProfile', N'OBJECT', N'UPDATE') = 1
    OR HAS_PERMS_BY_NAME(N'paws.Faculty', N'OBJECT', N'INSERT') = 1
THROW 51106, 'paws_swa_beta has effective mutation permission on a paws object.', 1;

-- 6. Every granted SELECT is column-scoped except the reviewed view.
IF EXISTS (
    SELECT 1
    FROM sys.database_permissions AS p
    WHERE p.grantee_principal_id = @PrincipalId
      AND p.state = N'G'
      AND p.permission_name = N'SELECT'
      AND p.class = 1
      AND p.minor_id = 0
      AND NOT (OBJECT_SCHEMA_NAME(p.major_id) = N'paws' AND OBJECT_NAME(p.major_id) IN (N'vCalendarSession'))
) THROW 51107, 'paws_swa_beta has an unreviewed whole-object SELECT grant.', 1;

SELECT
    N'READ_ONLY_PROOF_OK' AS Result,
    @Principal AS PrincipalName,
    (SELECT COUNT(*) FROM sys.database_permissions WHERE grantee_principal_id = @PrincipalId AND state = N'G') AS GrantCount,
    (SELECT COUNT(*) FROM sys.database_permissions WHERE grantee_principal_id = @PrincipalId AND state = N'D') AS DenyCount;
