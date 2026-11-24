/* Remove the linking command. Saved AFC rows, original PDFs and their existing links remain readable. */
:ON ERROR EXIT
SET XACT_ABORT ON;
IF DB_NAME() <> N'VetMed-Ops' THROW 57100, 'Unexpected AFC database.', 1;
DROP PROCEDURE IF EXISTS paws_api.LinkAfcBatchRecordDocument;
GO
