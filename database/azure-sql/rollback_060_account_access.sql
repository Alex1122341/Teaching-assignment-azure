:ON ERROR EXIT
SET NOCOUNT ON;
SET XACT_ABORT ON;
IF DB_NAME()<>N'VetMed-Ops' THROW 54062,'060 rollback requires the reviewed target.',1;
IF OBJECT_ID(N'paws.AccountAccessChange',N'U') IS NULL OR OBJECT_ID(N'paws_api.SetAccountAccess',N'P') IS NULL OR OBJECT_DEFINITION(OBJECT_ID(N'paws_api.SetAccountAccess')) NOT LIKE N'%PAWS_EFFECTIVE_ACCESS_060%' THROW 54062,'060 rollback refuses an unknown deployment.',1;
IF EXISTS(SELECT 1 FROM paws.AccountAccessChange) OR EXISTS(SELECT 1 FROM paws.AuditEvent WHERE EventType=N'account_access_change') THROW 54062,'Keep used access operations/audits; disable the write gate instead of deleting history.',1;
IF EXISTS(SELECT 1 FROM sys.database_role_members WHERE role_principal_id=DATABASE_PRINCIPAL_ID(N'paws_runtime_account_access')) THROW 54062,'Unbind runtime access role through the reviewed release procedure first.',1;
BEGIN TRANSACTION;
DROP PROCEDURE paws_api.SetAccountAccess;
DROP TABLE paws.AccountAccessChange;
ALTER TABLE paws.UserProfile DROP COLUMN AccessVersion;
IF DATABASE_PRINCIPAL_ID(N'paws_runtime_account_access') IS NOT NULL DROP ROLE paws_runtime_account_access;
COMMIT;
