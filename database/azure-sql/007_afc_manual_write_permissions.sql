-- B1 proposal only. Do not apply this file to live SQL during B1.
-- Bind the actual runtime principal at the separately approved B1D gate.
:setvar PAWS_API_PRINCIPAL "paws-sql-beta-mi"

IF USER_ID(N'$(PAWS_API_PRINCIPAL)') IS NULL
    THROW 51301, 'The B1 runtime principal must already exist before permissions are applied.', 1;

-- The unified view is the only manual/imported AFC read surface added by B1.
GRANT SELECT ON OBJECT::paws.vAfcRecordUnified TO [$(PAWS_API_PRINCIPAL)];

-- The stored procedure is the only AFC business write surface. No table DML
-- grant and no schema-wide EXECUTE grant is permitted here.
GRANT EXECUTE ON OBJECT::paws_api.CreateAfcRecord TO [$(PAWS_API_PRINCIPAL)];
