import json
import shutil
import subprocess
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "tools" / "repair_paws_session_times.ps1"
MANIFEST = ROOT / "tools" / "azure_sql_migration" / "session_time_corrections.json"


class SessionTimeRepairOperatorTests(unittest.TestCase):
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
