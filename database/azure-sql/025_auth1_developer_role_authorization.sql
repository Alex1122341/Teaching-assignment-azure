/*
  AUTH-1 adds Developer to the existing SQL-authoritative administrative role
  allowlists. This changes no tables, grants, write gates, or procedure bodies
  other than their exact role predicates.

  The guarded module rewrite is intentional: existing AFC procedures are long,
  already-reviewed transaction boundaries. This script refuses unexpected
  module drift and only adds the canonical developer role to nine known policy
  predicates. Re-running it is safe.
*/
:ON ERROR EXIT
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() <> N'VetMed-Ops'
    THROW 52500, 'AUTH-1 Developer authorization must run in VetMed-Ops.', 1;
IF OBJECT_ID(N'paws.UserProfile', N'U') IS NULL
   OR SCHEMA_ID(N'paws_api') IS NULL
    THROW 52501, 'AUTH-1 requires the accepted UserProfile and API schema.', 1;
GO

DECLARE @Targets TABLE (
    ObjectName sysname NOT NULL PRIMARY KEY,
    ExistingPredicate nvarchar(500) NOT NULL,
    DeveloperPredicate nvarchar(500) NOT NULL
);
INSERT @Targets (ObjectName, ExistingPredicate, DeveloperPredicate)
VALUES
 (N'paws_api.RecommendAfcRequest',
  N'N''owner'', N''administrator'', N''adfa_general'', N''adfa_regular'', N''admin''',
  N'N''owner'', N''administrator'', N''adfa_general'', N''adfa_regular'', N''admin'', N''developer'''),
 (N'paws_api.RejectAfcRequest',
  N'N''owner'', N''administrator'', N''adfa_general'', N''adfa_regular'', N''admin''',
  N'N''owner'', N''administrator'', N''adfa_general'', N''adfa_regular'', N''admin'', N''developer'''),
 (N'paws_api.ApproveAfcRequest',
  N'N''owner'', N''administrator'', N''adfa_general'', N''adfa_regular'', N''admin''',
  N'N''owner'', N''administrator'', N''adfa_general'', N''adfa_regular'', N''admin'', N''developer'''),
 (N'paws_api.CreateOrGetApprovedAfcArtifact',
  N'N''owner'', N''administrator'', N''adfa_general'', N''adfa_regular'', N''admin''',
  N'N''owner'', N''administrator'', N''adfa_general'', N''adfa_regular'', N''admin'', N''developer'''),
 (N'paws_api.GetApprovedAfcArtifact',
  N'N''owner'', N''administrator'', N''adfa_general'', N''adfa_regular'', N''admin''',
  N'N''owner'', N''administrator'', N''adfa_general'', N''adfa_regular'', N''admin'', N''developer'''),
 (N'paws_api.CanActOnTeachingAssignmentPackage',
  N'N''owner'', N''administrator'', N''adfa_general'', N''adfa_regular'', N''admin''',
  N'N''owner'', N''administrator'', N''adfa_general'', N''adfa_regular'', N''admin'', N''developer'''),
 (N'paws_api.UpdateFaculty',
  N'N''admin'',N''administrator'',N''adfa_regular'',N''adfa_general'',N''owner''',
  N'N''admin'',N''administrator'',N''adfa_regular'',N''adfa_general'',N''owner'',N''developer'''),
 (N'paws_api.DeactivateFaculty',
  N'N''admin'',N''administrator'',N''adfa_regular'',N''adfa_general'',N''owner''',
  N'N''admin'',N''administrator'',N''adfa_regular'',N''adfa_general'',N''owner'',N''developer'''),
 (N'paws_api.RestoreFaculty',
  N'N''admin'',N''administrator'',N''adfa_regular'',N''adfa_general'',N''owner''',
  N'N''admin'',N''administrator'',N''adfa_regular'',N''adfa_general'',N''owner'',N''developer''');

IF (SELECT COUNT(*) FROM @Targets) <> 9
    THROW 52502, 'AUTH-1 role policy target manifest is incomplete.', 1;

BEGIN TRY
    BEGIN TRANSACTION;

    DECLARE @ObjectName sysname, @Existing nvarchar(500), @Developer nvarchar(500),
            @ObjectId int, @Definition nvarchar(max), @ExistingCount int,
            @DeveloperCount int, @AnsiNulls bit, @QuotedIdentifier bit;
    DECLARE role_policy CURSOR LOCAL FAST_FORWARD FOR
        SELECT ObjectName, ExistingPredicate, DeveloperPredicate FROM @Targets ORDER BY ObjectName;
    OPEN role_policy;
    FETCH NEXT FROM role_policy INTO @ObjectName, @Existing, @Developer;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        SET @ObjectId = OBJECT_ID(@ObjectName);
        IF @ObjectId IS NULL
            THROW 52503, 'An expected AUTH-1 SQL authorization module is missing.', 1;

        SELECT @Definition = sm.definition, @AnsiNulls = sm.uses_ansi_nulls,
               @QuotedIdentifier = sm.uses_quoted_identifier
          FROM sys.sql_modules AS sm
         WHERE sm.object_id = @ObjectId;
        IF @Definition IS NULL
            THROW 52504, 'An expected AUTH-1 SQL authorization module is not inspectable.', 1;

        SET @ExistingCount = (LEN(@Definition) - LEN(REPLACE(@Definition, @Existing, N''))) / LEN(@Existing);
        SET @DeveloperCount = (LEN(@Definition) - LEN(REPLACE(@Definition, @Developer, N''))) / LEN(@Developer);
        IF @DeveloperCount = 1 AND @ExistingCount = 0
        BEGIN
            FETCH NEXT FROM role_policy INTO @ObjectName, @Existing, @Developer;
            CONTINUE;
        END;
        IF @ExistingCount <> 1 OR @DeveloperCount <> 0
            THROW 52505, 'An AUTH-1 SQL authorization predicate differs from its reviewed baseline.', 1;

        SET @Definition = REPLACE(@Definition, @Existing, @Developer);
        IF LEFT(LTRIM(@Definition), 16) = N'CREATE PROCEDURE'
            SET @Definition = STUFF(@Definition, CHARINDEX(N'CREATE PROCEDURE', @Definition), 16, N'ALTER PROCEDURE');
        ELSE IF LEFT(LTRIM(@Definition), 15) = N'CREATE FUNCTION'
            SET @Definition = STUFF(@Definition, CHARINDEX(N'CREATE FUNCTION', @Definition), 15, N'ALTER FUNCTION');
        ELSE IF LEFT(LTRIM(@Definition), 25) = N'CREATE OR ALTER PROCEDURE'
            SET @Definition = STUFF(@Definition, CHARINDEX(N'CREATE OR ALTER PROCEDURE', @Definition), 25, N'ALTER PROCEDURE');
        ELSE IF LEFT(LTRIM(@Definition), 24) = N'CREATE OR ALTER FUNCTION'
            SET @Definition = STUFF(@Definition, CHARINDEX(N'CREATE OR ALTER FUNCTION', @Definition), 24, N'ALTER FUNCTION');
        ELSE IF LEFT(LTRIM(@Definition), 15) <> N'ALTER PROCEDURE'
            AND LEFT(LTRIM(@Definition), 14) <> N'ALTER FUNCTION'
            THROW 52506, 'An AUTH-1 module does not use a supported CREATE definition.', 1;

        IF @AnsiNulls = 1 EXEC (N'SET ANSI_NULLS ON;'); ELSE EXEC (N'SET ANSI_NULLS OFF;');
        IF @QuotedIdentifier = 1 EXEC (N'SET QUOTED_IDENTIFIER ON;'); ELSE EXEC (N'SET QUOTED_IDENTIFIER OFF;');
        EXEC sys.sp_executesql @Definition;

        IF NOT EXISTS (
            SELECT 1 FROM sys.sql_modules
             WHERE object_id = OBJECT_ID(@ObjectName)
               AND (LEN(definition) - LEN(REPLACE(definition, @Developer, N''))) / LEN(@Developer) = 1
        )
            THROW 52507, 'AUTH-1 failed to verify the updated SQL authorization predicate.', 1;

        FETCH NEXT FROM role_policy INTO @ObjectName, @Existing, @Developer;
    END;
    CLOSE role_policy;
    DEALLOCATE role_policy;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF CURSOR_STATUS('local', 'role_policy') >= 0 CLOSE role_policy;
    IF CURSOR_STATUS('local', 'role_policy') > -3 DEALLOCATE role_policy;
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
GO
