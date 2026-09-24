import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


class AzureSqlPowerShellCompatibilityTests(unittest.TestCase):
    def test_sha256_helper_supports_windows_powershell_51(self):
        access = (ROOT / "tools" / "azure_sql_migration" / "sql_access.ps1").read_text(encoding="utf-8")
        self.assertNotIn("[Convert]::ToHexString", access)
        self.assertIn("[BitConverter]::ToString", access)


if __name__ == "__main__":
    unittest.main()
