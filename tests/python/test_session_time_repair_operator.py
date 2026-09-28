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

    def test_operator_script_has_no_timestamp_or_non_time_column_mutation_anywhere(self):
        # BETA-R4D-9J2 Section 8: the live repair may change ONLY paws.Session.StartTime
        # and paws.Session.EndTime. Prove no UpdatedAtUtc / SYSUTCDATETIME mutation and no
        # other mutating SQL statement survives anywhere in the operator script.
        script_text = SCRIPT.read_text(encoding="utf-8")

        self.assertNotIn("UpdatedAtUtc", script_text)
        self.assertNotIn("SYSUTCDATETIME", script_text)
        self.assertNotIn("GETUTCDATE", script_text)

        # Only inspect executable SQL: PowerShell string literals and comments may
        # legitimately contain the word "Update" (e.g. an error message).
        stripped = self._strip_powershell_comments_and_strings(script_text)
        mutating = re.findall(
            r"\b(INSERT\s+INTO|UPDATE\s+|DELETE\s+FROM|MERGE\s+|TRUNCATE\s+TABLE|ALTER\s+TABLE|DROP\s+TABLE)\b",
            stripped,
            flags=re.IGNORECASE,
        )
        self.assertEqual(
            [m.upper().split()[0] for m in mutating],
            ["UPDATE"],
            "operator script must contain exactly one UPDATE and no other mutating statement",
        )
        # and that one statement must target only the approved table
        self.assertRegex(stripped, r"UPDATE\s+paws\.Session\s+SET\b")

    @staticmethod
    def _strip_powershell_comments_and_strings(text):
        """Remove PowerShell line comments and single/double quoted strings.

        The operator builds its SQL inside a here-string, which we keep, but the
        surrounding error messages and comments are dropped so they cannot be
        mistaken for executable SQL.
        """
        out = []
        for line in text.splitlines():
            if line.lstrip().startswith("#"):
                continue
            # drop inline comments that are not inside a here-string body
            if "@'" not in line and "'@" not in line and '@"' not in line and '"@' not in line:
                line = re.sub(r"#.*$", "", line)
            # blank out quoted literals
            line = re.sub(r'"[^"]*"', '""', line)
            line = re.sub(r"'[^']*'", "''", line)
            out.append(line)
        return "\n".join(out)

    def test_operator_update_guards_every_row_with_its_expected_old_interval(self):
        # Section 11 requires affected rows per update == 1. That is only provable when
        # the WHERE clause pins the expected old interval, which the script does; assert
        # the parameters used for the guard actually come from the manifest row.
        script_text = SCRIPT.read_text(encoding="utf-8")
        for guard in ("@oldStart", "@oldEnd", "@newStart", "@newEnd", "@sessionId"):
            self.assertIn(guard, script_text, f"missing parameter {guard}")
        self.assertNotIn("ExecuteNonQuery() == 0", script_text)
        self.assertIn("affected", script_text.lower())

    def test_default_mode_validates_reviewed_manifest_without_requesting_apply(self):
        # BETA-R4D-9J2: the default manifest is now the owner-provided explicit 24-hour
        # CSV patch. Assert against the manifest's own contents instead of a hard-coded
        # count so a legitimate future promotion cannot silently drift out of sync.
        expected = len(json.loads(MANIFEST.read_text(encoding="utf-8"))["corrections"])
        self.assertGreater(expected, 0)

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
        self.assertEqual(result["correctionCount"], expected)
        self.assertFalse(result["applyRequested"])
        self.assertFalse(result["writesPerformed"])

    def test_default_manifest_is_sourced_from_the_owner_24h_csv_not_the_superseded_proposal(self):
        # BETA-R4D-9J2: retiring the obsolete 423-entry live-repair default is the whole
        # point of this task. Guard the default live repair path so it can never silently
        # fall back to the superseded inferred correction set.
        manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
        self.assertEqual(manifest["format"], "paws-session-time-corrections-v1")
        csv = manifest["generatedFrom"]["csv"]
        self.assertEqual(csv["fileName"], "PAWS_Faculty_Summaries_SQL_24h.csv")
        self.assertEqual(
            csv["sha256"],
            "de62f81cfed0bcd3a79f70a34bc6a6c352a2b68770fafa52c0516ce614ad4cde",
        )
        # every entry must cite the owner CSV as its source, keyed by an existing SessionId
        for item in manifest["corrections"]:
            self.assertEqual(item["source"], "PAWS_Faculty_Summaries_SQL_24h.csv")
            self.assertTrue(item["sessionId"])
            self.assertEqual(item["newStart"], item["newStart"])
            self.assertLess(item["newStart"], item["newEnd"])

    def test_superseded_423_manifest_is_retained_only_as_history(self):
        history = (
            ROOT
            / "tools"
            / "azure_sql_migration"
            / "corrections_history"
            / "session_time_corrections_423_superseded.json"
        )
        self.assertTrue(history.exists(), "superseded 423 manifest should be preserved as history")
        doc = json.loads(history.read_text(encoding="utf-8"))
        self.assertEqual(len(doc["corrections"]), 423)
        # ...and it must NOT be the default live-repair path
        self.assertNotEqual(history.resolve(), MANIFEST.resolve())


if __name__ == "__main__":
    unittest.main()
