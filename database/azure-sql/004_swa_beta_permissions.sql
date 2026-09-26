SET NOCOUNT ON;
SET XACT_ABORT ON;

IF USER_ID(N'paws_swa_beta') IS NULL THROW 51000, 'Expected contained database user paws_swa_beta does not exist. Provisioning is a separate approved operator action.', 1;

DECLARE @PrincipalId int = USER_ID(N'paws_swa_beta');

IF EXISTS (
    SELECT 1
    FROM sys.database_role_members
    WHERE member_principal_id = @PrincipalId
) THROW 51001, 'paws_swa_beta must not inherit any database role.', 1;

IF EXISTS (
    SELECT 1
    FROM sys.database_permissions AS permission
    WHERE permission.grantee_principal_id = @PrincipalId
      AND (
        (permission.class = 0 AND NOT (permission.permission_name = N'CONNECT' AND permission.state = N'G'))
        OR (permission.class = 3 AND NOT (
            permission.state = N'D'
            AND (
                (SCHEMA_NAME(permission.major_id) = N'paws' AND permission.permission_name IN (N'INSERT', N'UPDATE', N'DELETE', N'EXECUTE'))
                OR (SCHEMA_NAME(permission.major_id) = N'staging' AND permission.permission_name IN (N'SELECT', N'INSERT', N'UPDATE', N'DELETE', N'EXECUTE'))
            )
        ))
        OR (permission.class = 1 AND NOT (
            permission.state = N'G'
            AND permission.permission_name = N'SELECT'
            AND (
                (OBJECT_SCHEMA_NAME(permission.major_id) = N'paws' AND OBJECT_NAME(permission.major_id) = N'vCalendarSession' AND permission.minor_id = 0)
                OR (OBJECT_SCHEMA_NAME(permission.major_id) = N'paws' AND OBJECT_NAME(permission.major_id) = N'UserProfile' AND COL_NAME(permission.major_id, permission.minor_id) IN (N'FirebaseUid', N'DisplayName', N'BaseRole', N'FacultyId', N'Active'))
                OR (OBJECT_SCHEMA_NAME(permission.major_id) = N'paws' AND OBJECT_NAME(permission.major_id) = N'SessionAssignment' AND COL_NAME(permission.major_id, permission.minor_id) IN (N'SessionId', N'FacultyId'))
            )
        ))
        OR permission.class NOT IN (0, 1, 3)
      )
) THROW 51002, 'paws_swa_beta has permissions outside the reviewed Phase 1 contract.', 1;

GRANT CONNECT TO [paws_swa_beta];
GRANT SELECT ON OBJECT::paws.UserProfile (FirebaseUid, DisplayName, BaseRole, FacultyId, Active) TO [paws_swa_beta];
GRANT SELECT ON OBJECT::paws.vCalendarSession TO [paws_swa_beta];
GRANT SELECT ON OBJECT::paws.SessionAssignment (SessionId, FacultyId) TO [paws_swa_beta];

DENY INSERT, UPDATE, DELETE, EXECUTE ON SCHEMA::paws TO [paws_swa_beta];
DENY SELECT, INSERT, UPDATE, DELETE, EXECUTE ON SCHEMA::staging TO [paws_swa_beta];
