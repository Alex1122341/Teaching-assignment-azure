import json
import re
import shutil
import subprocess
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "tools" / "repair_paws_session_times.ps1"
MANIFEST = ROOT / "tools" / "azure_sql_migration" / "session_time_corrections.json"


class SessionTimeRepairOperatorTests(unittest.TestCase):
    def test_session_update_only_mutates_approved_time_columns_with_exact_old_value_guard(self):
        script_text = SCRIPT.read_text(encoding="utf-8")
        matches = re.findall(
            r"UPDATE\s+paws\.Session\s+SET\s+(.*?)\s+WHERE\s+(.*?);",
            script_text,
            flags=re.IGNORECASE | re.DOTALL,
        )
        self.assertEqual(len(matches), 1, "Expected exactly one paws.Session UPDATE statement")

        set_clause, where_clause = matches[0]
        normalized_set = " ".join(set_clause.split())
        normalized_where = " ".join(where_clause.split())

        self.assertEqual(normalized_set, "StartTime = @newStart, EndTime = @newEnd")
        self.assertNotIn("UpdatedAtUtc", set_clause)
        self.assertEqual(
            normalized_where,
            "SessionId = @sessionId AND StartTime = @oldStart AND EndTime = @oldEnd",
        )

    def test_default_mode_validates_reviewed_manifest_without_requesting_apply(self):
        completed = subprocess.run(
            [
                shutil.which("powershell.exe") or shutil.which("pwsh") or "pwsh",
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
                str(SCRIPT),
                "-ManifestPath",
                str(MANIFEST),
                "-ValidateManifestOnly",
            ],
            cwd=ROOT,
            check=True,
            capture_output=True,
            text=True,
        )
        result = json.loads(completed.stdout)
        self.assertEqual(result["correctionCount"], 423)
        self.assertFalse(result["applyRequested"])
        self.assertFalse(result["writesPerformed"])


if __name__ == "__main__":
    unittest.main()
