SET NOCOUNT ON;
SET XACT_ABORT ON;

IF USER_ID(N'paws_swa_beta') IS NULL
    THROW 51000, 'Expected contained database user paws_swa_beta does not exist. Provisioning is a separate approved operator action.', 1;

DECLARE @PrincipalId int = USER_ID(N'paws_swa_beta');
DECLARE @PrincipalSid varbinary(85);
DECLARE @PrincipalType char(1);

SELECT @PrincipalSid = principal.sid, @PrincipalType = principal.type
FROM sys.database_principals AS principal
WHERE principal.principal_id = @PrincipalId;

IF @PrincipalType = N'X'
    THROW 51004, 'paws_swa_beta must be a dedicated user, not an EXTERNAL_GROUP principal.', 1;

IF EXISTS (
    SELECT 1 FROM sys.databases
    WHERE database_id = DB_ID() AND owner_sid = @PrincipalSid
) THROW 51005, 'paws_swa_beta must not be the database owner.', 1;

IF EXISTS (
    SELECT 1 FROM sys.database_role_members
    WHERE member_principal_id = @PrincipalId
) THROW 51001, 'paws_swa_beta must not inherit any database role.', 1;

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
) THROW 51006, 'public has a grant that can broaden paws_swa_beta access to paws or staging.', 1;

IF EXISTS (SELECT 1 FROM sys.schemas WHERE principal_id = @PrincipalId)
   OR EXISTS (SELECT 1 FROM sys.objects WHERE principal_id = @PrincipalId)
    THROW 51003, 'paws_swa_beta must not own schemas or objects.', 1;

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
) THROW 51002, 'paws_swa_beta has permissions outside the reviewed Beta-R1 contract.', 1;

GRANT CONNECT TO [paws_swa_beta];
GRANT SELECT ON OBJECT::paws.UserProfile
    (FirebaseUid, DisplayName, BaseRole, FacultyId, Active, MustChangePassword)
    TO [paws_swa_beta];
GRANT SELECT ON OBJECT::paws.vCalendarSession TO [paws_swa_beta];
GRANT SELECT ON OBJECT::paws.SessionAssignment (SessionId, FacultyId) TO [paws_swa_beta];

-- BETA-R4D-10A: Dashboard read contract. Column-scoped SELECT only; the
-- previously denied schema-wide DML stays denied below, so these grants widen
-- read surface without widening mutation surface.
GRANT SELECT ON OBJECT::paws.Faculty
    (FacultyId, RecordType, PreferredFirstName, PreferredLastName, DisplayName,
     Ucid, Email, Stream, Rank, Fte, ReportsToFacultyId, Active)
    TO [paws_swa_beta];

DENY INSERT, UPDATE, DELETE, EXECUTE ON SCHEMA::paws TO [paws_swa_beta];
DENY SELECT, INSERT, UPDATE, DELETE, EXECUTE ON SCHEMA::staging TO [paws_swa_beta];
