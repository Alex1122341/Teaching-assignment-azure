/* Rolls back the AFC date edit runtime surface. Disable PAWS_AFC_EDIT_WRITE_ENABLED
   first. Changed dates, superseded requests, links and audit history are business
   evidence and are kept; the columns, status value and history allowlist stay. */
:ON ERROR EXIT
SET XACT_ABORT ON;
IF DB_NAME()<>N'VetMed-Ops' THROW 56490,'Wrong database.',1;
IF EXISTS(SELECT 1 FROM sys.database_role_members WHERE role_principal_id=DATABASE_PRINCIPAL_ID(N'paws_runtime_afc_edit_write'))
 THROW 56490,'Remove the runtime identity from paws_runtime_afc_edit_write before rollback.',1;
IF EXISTS(SELECT 1 FROM paws.AfcRequest WHERE ReplacesAfcRequestId IS NOT NULL AND Status IN (N'pending_report_to',N'pending_admin'))
 THROW 56490,'Decide or withdraw pending AFC date changes before rollback.',1;
BEGIN TRANSACTION;
DROP PROCEDURE paws_api.SubmitAfcDateChange;
DROP PROCEDURE paws_api.UpdateAfcDates;
DROP ROLE paws_runtime_afc_edit_write;
COMMIT;
GO
/* ApproveAfcRequest keeps the additive supersede branch; with no open date
   changes it behaves exactly like the 010 procedure. */
