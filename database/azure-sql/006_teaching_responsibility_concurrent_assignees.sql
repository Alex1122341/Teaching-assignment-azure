/*
  PAWS Beta R4D-12 A5: explicit concurrent responsibility assignees.
  This migration is additive and assumes 005_teaching_assignment_authority_foundation.sql
  has created the paws authority tables. It deliberately performs no data backfill.
*/

IF OBJECT_ID(N'paws.TeachingResponsibilityAssignee', N'U') IS NULL
  THROW 51000, '005_teaching_assignment_authority_foundation.sql must be applied first.', 1;

IF COL_LENGTH(N'paws.TeachingResponsibilityAssignee', N'AssignmentMode') IS NULL
BEGIN
  ALTER TABLE paws.TeachingResponsibilityAssignee
    ADD AssignmentMode nvarchar(16) NOT NULL
      CONSTRAINT DF_TeachingResponsibilityAssignee_AssignmentMode DEFAULT (N'exclusive')
      WITH VALUES;
END;

IF NOT EXISTS (
  SELECT 1
  FROM sys.check_constraints
  WHERE name = N'CK_TeachingResponsibilityAssignee_AssignmentMode'
    AND parent_object_id = OBJECT_ID(N'paws.TeachingResponsibilityAssignee')
)
BEGIN
  ALTER TABLE paws.TeachingResponsibilityAssignee
    ADD CONSTRAINT CK_TeachingResponsibilityAssignee_AssignmentMode
    CHECK (AssignmentMode COLLATE Latin1_General_100_BIN2 IN (N'exclusive', N'concurrent'));
END;
