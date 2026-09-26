"""Schema contract for the Phase A paws.FacultyDirectoryProfile migration."""

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SQL_FILE = ROOT / "database" / "azure-sql" / "004_faculty_directory_profile.sql"

APPROVED_COLUMNS = [
    "FacultyId",
    "Campus",
    "OfficeLocation",
    "LabLocation",
    "SourceImportBatchId",
    "CreatedAtUtc",
    "UpdatedAtUtc",
]

# Deferred to architect / domain review — must not appear in the Phase A table.
DEFERRED_COLUMNS = [
    "OfficeSpaceDetails",
    "CurrentTitle",
    "AppointmentType",
    "EducationRank",
    "LegacyDepartment",
    "TeachingAreaEmphasis",
    "ClinicianDiagnostician",
    "EducationSummary",
    "BoardSpecialties",
    "TenureDate",
    "TotalYearsExperience",
    "AwayFromCampusRecords",
]


def read_sql() -> str:
    return SQL_FILE.read_text(encoding="utf-8")


def sql_code(sql: str) -> str:
    """Return the executable DDL with `--` comment lines removed.

    The header comment deliberately names the deferred attributes so reviewers
    can see what Phase A excludes; those names must not make the structural
    assertions fail, so comments are stripped before structural checks.
    """
    lines = [line for line in sql.splitlines() if not line.lstrip().startswith("--")]
    return "\n".join(lines)


def table_body(sql: str) -> str:
    match = re.search(
        r"CREATE TABLE paws\.FacultyDirectoryProfile \((?P<body>.*?)\n\);",
        sql_code(sql),
        re.DOTALL,
    )
    if match is None:
        raise AssertionError("paws.FacultyDirectoryProfile CREATE TABLE block not found")
    return match.group("body")


def column_names(body: str) -> list[str]:
    """Column names only — CONSTRAINT lines are table-level, not columns."""
    names = []
    for line in body.splitlines():
        stripped = line.strip().rstrip(",")
        if not stripped or stripped.upper().startswith("CONSTRAINT"):
            continue
        names.append(stripped.split()[0])
    return names


class FacultyDirectoryProfileSchemaContractTests(unittest.TestCase):
    def test_migration_file_exists_and_is_additive(self):
        sql = read_sql()
        self.assertIn("CREATE TABLE paws.FacultyDirectoryProfile", sql)
        code = sql_code(sql).upper()
        for destructive in ["DROP TABLE", "DROP VIEW", "ALTER TABLE", "TRUNCATE", "DELETE FROM"]:
            self.assertNotIn(destructive, code)

    def test_table_has_only_the_approved_columns(self):
        self.assertEqual(column_names(table_body(read_sql())), APPROVED_COLUMNS)

    def test_deferred_columns_are_absent_from_the_table(self):
        body = table_body(read_sql())
        for column in DEFERRED_COLUMNS:
            self.assertNotIn(column, body, f"{column} must stay deferred")

    def test_primary_key_and_faculty_foreign_key(self):
        body = table_body(read_sql())
        self.assertRegex(body, r"FacultyId\s+uniqueidentifier\s+NOT NULL\s+CONSTRAINT\s+PK_FacultyDirectoryProfile\s+PRIMARY KEY")
        self.assertRegex(
            body,
            r"CONSTRAINT\s+FK_FacultyDirectoryProfile_Faculty\s+FOREIGN KEY\s*\(FacultyId\)\s*REFERENCES\s+paws\.Faculty\s*\(FacultyId\)",
        )

    def test_nullability_matches_the_approved_contract(self):
        body = table_body(read_sql())
        self.assertRegex(body, r"Campus\s+nvarchar\(50\)\s+NULL")
        self.assertRegex(body, r"OfficeLocation\s+nvarchar\(120\)\s+NULL")
        self.assertRegex(body, r"LabLocation\s+nvarchar\(120\)\s+NULL")
        self.assertRegex(body, r"SourceImportBatchId\s+uniqueidentifier\s+NULL")
        self.assertRegex(body, r"CreatedAtUtc\s+datetime2\(7\)\s+NOT NULL")
        self.assertRegex(body, r"UpdatedAtUtc\s+datetime2\(7\)\s+NOT NULL")

    def test_timestamps_use_repository_default_convention(self):
        body = table_body(read_sql())
        self.assertRegex(
            body,
            r"CONSTRAINT\s+DF_FacultyDirectoryProfile_CreatedAt\s+DEFAULT\s+SYSUTCDATETIME\(\)",
        )
        self.assertRegex(
            body,
            r"CONSTRAINT\s+DF_FacultyDirectoryProfile_UpdatedAt\s+DEFAULT\s+SYSUTCDATETIME\(\)",
        )

    def test_no_sql_password_or_overbroad_principal(self):
        code = sql_code(read_sql()).casefold()
        self.assertNotIn("password", code)
        self.assertNotIn("db_owner", code)
        self.assertNotIn("create login", code)

    def test_phase_a_ddl_is_not_wired_into_the_phase_1_loader(self):
        """The loader's behaviour must be unchanged by this migration."""
        loader = (ROOT / "tools" / "load_paws_azure_sql_empty.ps1").read_text(encoding="utf-8")
        self.assertNotIn("004_faculty_directory_profile.sql", loader)


if __name__ == "__main__":
    unittest.main()
