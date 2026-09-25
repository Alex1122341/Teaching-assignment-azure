SET NOCOUNT ON;
SET XACT_ABORT ON;

IF USER_ID(N'paws_swa_beta') IS NULL THROW 51000, 'Expected contained database user paws_swa_beta does not exist. Provisioning is a separate approved operator action.', 1;

GRANT CONNECT TO [paws_swa_beta];
GRANT SELECT ON OBJECT::paws.UserProfile TO [paws_swa_beta];
GRANT SELECT ON OBJECT::paws.vCalendarSession TO [paws_swa_beta];
GRANT SELECT ON OBJECT::paws.SessionAssignment TO [paws_swa_beta];

DENY SELECT, INSERT, UPDATE, DELETE ON SCHEMA::staging TO [paws_swa_beta];
