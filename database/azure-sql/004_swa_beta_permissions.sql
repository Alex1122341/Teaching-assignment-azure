SET NOCOUNT ON;
SET XACT_ABORT ON;

-- BETA-R4D-10A: the runtime principal name is parameterised. The reviewed
-- contract originally addressed a contained user named `paws_swa_beta`, but the
-- deployed Beta runtime authenticates as the application managed identity
-- `paws-sql-beta-mi` (confirmed live: it is an EXTERNAL_USER, holds the reviewed
-- permission set, and `paws_swa_beta` does not exist in the database).
--
-- Run this file with sqlcmd and bind the principal that actually connects:
--     sqlcmd -v PAWS_API_PRINCIPAL="paws-sql-beta-mi" -i 004_swa_beta_permissions.sql
-- The default remains `paws_swa_beta` so an unparameterised run is unchanged.
:setvar PAWS_API_PRINCIPAL "paws_swa_beta"

IF USER_ID(N'$(PAWS_API_PRINCIPAL)') IS NULL
    THROW 51000, 'Expected contained database user does not exist. Provisioning is a separate approved operator action.', 1;

DECLARE @PrincipalId int = USER_ID(N'$(PAWS_API_PRINCIPAL)');
DECLARE @PrincipalSid varbinary(85);
DECLARE @PrincipalType char(1);

SELECT @PrincipalSid = principal.sid, @PrincipalType = principal.type
FROM sys.database_principals AS principal
WHERE principal.principal_id = @PrincipalId;

IF @PrincipalType = N'X'
    THROW 51004, 'The runtime principal must be a dedicated user, not an EXTERNAL_GROUP principal.', 1;

IF EXISTS (
    SELECT 1 FROM sys.databases
    WHERE database_id = DB_ID() AND owner_sid = @PrincipalSid
) THROW 51005, 'The runtime principal must not be the database owner.', 1;

IF EXISTS (
    SELECT 1 FROM sys.database_role_members
    WHERE member_principal_id = @PrincipalId
) THROW 51001, 'The runtime principal must not inherit any database role.', 1;

IF EXISTS (
    SELECT 1
    FROM sys.database_permissions AS permission
    INNER JOIN sys.database_principals AS public_principal
      ON public_principal.principal_id = permission.grantee_principal_id
     AND public_principal.name = N'public'
    WHERE permission.state IN (N'G', N'W')
      AND (
        (permission.class = 0 AND NOT (permission.permission_name = N'CONNECT' AND permission.state = N'G'))
        OR (permission.class = 3 AND SCHEMA_NAME(permission.major_id) IN (N'paws', N'staging'))
        OR (permission.class = 1 AND OBJECT_SCHEMA_NAME(permission.major_id) IN (N'paws', N'staging'))
      )
) THROW 51006, 'public has a grant that can broaden the runtime principal''s access to paws or staging.', 1;

IF EXISTS (SELECT 1 FROM sys.schemas WHERE principal_id = @PrincipalId)
   OR EXISTS (SELECT 1 FROM sys.objects WHERE principal_id = @PrincipalId)
    THROW 51003, 'The runtime principal must not own schemas or objects.', 1;

IF EXISTS (
    SELECT 1
    FROM sys.database_permissions AS permission
    WHERE permission.grantee_principal_id = @PrincipalId
      AND (
        (permission.class = 0 AND NOT (permission.permission_name = N'CONNECT' AND permission.state = N'G'))
        OR (permission.class = 3 AND NOT (
          permission.state = N'D' AND (
            (SCHEMA_NAME(permission.major_id) = N'paws' AND permission.permission_name IN (N'INSERT', N'UPDATE', N'DELETE', N'EXECUTE'))
            OR (SCHEMA_NAME(permission.major_id) = N'staging' AND permission.permission_name IN (N'SELECT', N'INSERT', N'UPDATE', N'DELETE', N'EXECUTE'))
          )
        ))
        OR (permission.class = 1 AND NOT (
          permission.state = N'G'
          AND permission.permission_name = N'SELECT'
          AND (
            (OBJECT_SCHEMA_NAME(permission.major_id) = N'paws' AND OBJECT_NAME(permission.major_id) = N'vCalendarSession' AND permission.minor_id = 0)
            OR (
              OBJECT_SCHEMA_NAME(permission.major_id) = N'paws'
              AND OBJECT_NAME(permission.major_id) = N'UserProfile'
              AND COL_NAME(permission.major_id, permission.minor_id) IN (N'FirebaseUid', N'DisplayName', N'BaseRole', N'FacultyId', N'Active', N'MustChangePassword')
            )
            OR (
              OBJECT_SCHEMA_NAME(permission.major_id) = N'paws'
              AND OBJECT_NAME(permission.major_id) = N'SessionAssignment'
              AND COL_NAME(permission.major_id, permission.minor_id) IN (N'SessionId', N'FacultyId')
            )
            -- BETA-R4D-10A: least-privilege Dashboard read columns. Only the
            -- roster and detail fields the read API projects are granted; FTE and
            -- reporting relations stay readable, DOE/creditable-hour and source
            -- provenance columns deliberately do not.
            OR (
              OBJECT_SCHEMA_NAME(permission.major_id) = N'paws'
              AND OBJECT_NAME(permission.major_id) = N'Faculty'
              AND COL_NAME(permission.major_id, permission.minor_id) IN (
                N'FacultyId', N'RecordType', N'PreferredFirstName', N'PreferredLastName',
                N'DisplayName', N'Ucid', N'Email', N'Stream', N'Rank', N'Fte',
                N'ReportsToFacultyId', N'Active'
              )
            )
          )
        ))
        OR permission.class NOT IN (0, 1, 3)
      )
) THROW 51002, 'The runtime principal has permissions outside the reviewed Beta-R1 + R4D-10A contract.', 1;

GRANT CONNECT TO [$(PAWS_API_PRINCIPAL)];
GRANT SELECT ON OBJECT::paws.UserProfile
    (FirebaseUid, DisplayName, BaseRole, FacultyId, Active, MustChangePassword)
    TO [$(PAWS_API_PRINCIPAL)];
GRANT SELECT ON OBJECT::paws.vCalendarSession TO [$(PAWS_API_PRINCIPAL)];
GRANT SELECT ON OBJECT::paws.SessionAssignment (SessionId, FacultyId) TO [$(PAWS_API_PRINCIPAL)];

-- BETA-R4D-10A: Dashboard read contract. Column-scoped SELECT only; the
-- schema-wide DML denies stay in force below, so these grants widen the read
-- surface without widening the mutation surface.
--
-- This grant is what makes the /dashboard/faculty routes work at all: without
-- it the SQL principal has no read access to paws.Faculty and those routes fail
-- with a permission error rather than returning data.
GRANT SELECT ON OBJECT::paws.Faculty
    (FacultyId, RecordType, PreferredFirstName, PreferredLastName, DisplayName,
     Ucid, Email, Stream, Rank, Fte, ReportsToFacultyId, Active)
    TO [$(PAWS_API_PRINCIPAL)];

DENY INSERT, UPDATE, DELETE, EXECUTE ON SCHEMA::paws TO [$(PAWS_API_PRINCIPAL)];
DENY SELECT, INSERT, UPDATE, DELETE, EXECUTE ON SCHEMA::staging TO [$(PAWS_API_PRINCIPAL)];
