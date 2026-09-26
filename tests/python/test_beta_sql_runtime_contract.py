import pathlib
import re
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]


class BetaR1SqlRuntimeContractTests(unittest.TestCase):
    def test_api_permission_script_is_read_only_and_column_scoped(self):
        sql = (ROOT / "database" / "azure-sql" / "004_swa_beta_permissions.sql").read_text(encoding="utf-8")
        self.assertIn("paws_swa_beta", sql)
        self.assertIn("paws.UserProfile", sql)
        self.assertIn("MustChangePassword", sql)
        self.assertIn("paws.vCalendarSession", sql)
        self.assertIn("paws.SessionAssignment", sql)
        self.assertRegex(sql, r"DENY INSERT, UPDATE, DELETE, EXECUTE ON SCHEMA::paws")
        self.assertRegex(sql, r"DENY SELECT, INSERT, UPDATE, DELETE, EXECUTE ON SCHEMA::staging")
        self.assertNotRegex(sql, r"GRANT\s+(?:INSERT|UPDATE|DELETE|CONTROL|ALTER)", re.I)
        self.assertNotRegex(sql, r"GRANT\s+SELECT\s+ON\s+SCHEMA::paws", re.I)

    def test_session_repository_reads_the_canonical_calendar_view(self):
        source = (ROOT / "server" / "src" / "data" / "sql-session-repository.js").read_text(encoding="utf-8")
        self.assertIn("paws.vCalendarSession", source)
        self.assertNotIn("staging.", source)
        self.assertNotRegex(source, r"\b(?:INSERT|UPDATE|DELETE)\b", re.I)

    def test_userprofile_bootstrap_tool_has_no_database_apply_transport(self):
        source = (ROOT / "tools" / "preview_beta_userprofile_bootstrap.js").read_text(encoding="utf-8")
        self.assertIn("preview-only", source)
        self.assertIn("HUMAN_CONFIRMED_DELETE_ACCOUNT", source)
        self.assertNotIn("mssql", source)
        self.assertNotIn("Invoke-Sqlcmd", source)


if __name__ == "__main__":
    unittest.main()
