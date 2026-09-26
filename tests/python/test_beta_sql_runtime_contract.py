import pathlib
import re
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]

class BetaSqlRuntimeContractTests(unittest.TestCase):
    def test_permission_script_is_existing_principal_read_only(self):
        sql = (ROOT / "database/azure-sql/004_swa_beta_permissions.sql").read_text(encoding="utf-8")
        self.assertIn("paws_swa_beta", sql)
        self.assertRegex(sql, r"USER_ID\(N'paws_swa_beta'\).*THROW")
        self.assertIn("GRANT SELECT ON OBJECT::paws.UserProfile (FirebaseUid, DisplayName, BaseRole, FacultyId, Active)", sql)
        self.assertIn("GRANT SELECT ON OBJECT::paws.SessionAssignment (SessionId, FacultyId)", sql)
        self.assertIn("GRANT SELECT ON OBJECT::paws.vCalendarSession", sql)
        self.assertRegex(sql, r"DENY SELECT, INSERT, UPDATE, DELETE, EXECUTE ON SCHEMA::staging TO \[paws_swa_beta\]")
        self.assertIn("sys.database_role_members", sql)
        self.assertIn("sys.database_permissions", sql)
        self.assertGreaterEqual(sql.count("THROW"), 3)
        self.assertNotRegex(sql, r"GRANT\s+(?:INSERT|UPDATE|DELETE|CONTROL|ALTER)|db_owner|CREATE USER", re.I)
        self.assertNotIn("paws.Faculty TO [paws_swa_beta]", sql)

    def test_preview_is_no_write_and_redacts_private_values(self):
        source = (ROOT / "tools/preview_beta_sql_runtime.ps1").read_text(encoding="utf-8")
        self.assertIn("[switch]$Apply", source)
        self.assertRegex(source, r"if \(\$Apply\).*throw", re.I | re.S)
        for name in ["PAWS_SQL_CONNECTION_STRING", "FIREBASE_PROJECT_ID", "FIREBASE_SERVICE_ACCOUNT_JSON"]:
            self.assertIn(name, source)
        self.assertNotRegex(source, r"Invoke-Sqlcmd|sqlcmd|CREATE USER|ALTER USER|Set-AzStaticWebApp|Password", re.I)
        self.assertIn("FirebaseProjectConsistent", source)

    def test_docs_keep_bootstrap_and_oauth_defect_explicit(self):
        docs = (ROOT / "docs/beta-azure-sql-runtime.md").read_text(encoding="utf-8")
        self.assertIn("UserProfile INSERT is not granted", docs)
        self.assertIn("oauth:grant-type", docs)
        self.assertIn("verified as corrected", docs)
        self.assertIn("PR #3", docs)

if __name__ == "__main__":
    unittest.main()
