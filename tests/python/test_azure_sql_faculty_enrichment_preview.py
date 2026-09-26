"""Preview contract for the Phase A Faculty enrichment tooling.

Everything here runs on synthetic fixtures. No live database, no Firestore, no
private evidence file is touched, and nothing is written anywhere.
"""

import csv
import io
import json
import re
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))

from azure_sql_migration import faculty_enrichment as fe  # noqa: E402

MODULE = ROOT / "tools" / "azure_sql_migration" / "faculty_enrichment.py"
CLI = ROOT / "tools" / "preview_faculty_enrichment.py"

SQL_HEADER = [
    "FacultyId",
    "RecordType",
    "PreferredFirstName",
    "PreferredLastName",
    "DisplayName",
    "Ucid",
    "Email",
    "Stream",
    "Rank",
    "Fte",
    "ReportsToFacultyId",
    "ReportsToRaw",
    "Active",
    "SourceImportBatchId",
    "SourceRow",
    "CreatedAtUtc",
    "UpdatedAtUtc",
]


def sql_row(faculty_id, ucid, fte="", record_type="faculty", active="True", first="A", last="B"):
    return {
        "FacultyId": faculty_id,
        "RecordType": record_type,
        "PreferredFirstName": first,
        "PreferredLastName": last,
        "DisplayName": f"{first}, {last}",
        "Ucid": ucid,
        "Email": "",
        "Stream": "Teaching & Research",
        "Rank": "Professor",
        "Fte": fte,
        "ReportsToFacultyId": "",
        "ReportsToRaw": "",
        "Active": active,
        "SourceImportBatchId": "batch",
        "SourceRow": "1",
        "CreatedAtUtc": "2026-09-24T00:00:00",
        "UpdatedAtUtc": "2026-09-24T00:00:00",
    }


def fs_doc(ucid, fte=None, campus="Main Campus", office="HSC 100", lab=None, **extra):
    doc = {"ucid": ucid, "fte": fte, "campus": campus, "officeLocation": office, "labLocation": lab}
    doc.update(extra)
    return doc


def write_csv(rows):
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=SQL_HEADER)
    writer.writeheader()
    for row in rows:
        writer.writerow(row)
    return buffer.getvalue()


class PreviewFixtureMixin:
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.tmp = Path(self._tmp.name)

    def tearDown(self):
        self._tmp.cleanup()

    def sql_file(self, rows):
        path = self.tmp / "sql_faculty.csv"
        path.write_text(write_csv(rows), encoding="utf-8")
        return path

    def fs_file(self, docs):
        path = self.tmp / "fs_faculty.json"
        path.write_text(json.dumps({"count": len(docs), "slim": docs}), encoding="utf-8")
        return path


class FtePreviewTests(PreviewFixtureMixin, unittest.TestCase):
    def test_exact_normalized_ucid_match_is_the_only_identity_key(self):
        """A matching name/email must NOT create a match when the UCID differs."""
        rows = [sql_row("f1", "10000001", first="Ann", last="Lee")]
        docs = [fs_doc("99999999", fte="0.5", name="Ann, Lee", email="ann@example.test")]
        counters = fe.preview_fte(self.sql_file(rows), self.fs_file(docs), expected=None)["counters"]
        self.assertEqual(counters["MatchedFaculty"], 0)
        self.assertEqual(counters["Unmatched"], 1)
        self.assertEqual(counters["FteWritableCandidates"], 0)

    def test_ucid_matching_ignores_case_and_whitespace(self):
        rows = [sql_row("f1", "  10000001 ")]
        docs = [fs_doc("10000001", fte="0.5")]
        counters = fe.preview_fte(self.sql_file(rows), self.fs_file(docs), expected=None)["counters"]
        self.assertEqual(counters["MatchedFaculty"], 1)
        self.assertEqual(counters["FteWritableCandidates"], 1)

    def test_non_null_sql_fte_is_never_a_candidate(self):
        rows = [sql_row("f1", "10000001", fte="0.8000"), sql_row("f2", "10000002", fte="")]
        docs = [fs_doc("10000001", fte="0.5"), fs_doc("10000002", fte="0.5")]
        counters = fe.preview_fte(self.sql_file(rows), self.fs_file(docs), expected=None)["counters"]
        self.assertEqual(counters["FteAlreadyPresent"], 1)
        self.assertEqual(counters["FteBackfillCandidates"], 1)
        self.assertEqual(counters["FteWritableCandidates"], 1)

    def test_placeholder_rows_cannot_receive_enrichment(self):
        rows = [
            sql_row("f1", "", record_type="vacancy"),
            sql_row("f2", "", record_type="other_pool"),
            sql_row("f3", "10000003", fte=""),
        ]
        docs = [fs_doc("", fte="0.5"), fs_doc("10000003", fte="0.5")]
        counters = fe.preview_fte(self.sql_file(rows), self.fs_file(docs), expected=None)["counters"]
        self.assertEqual(counters["ExcludedPlaceholder"], 2)
        self.assertEqual(counters["MatchedFaculty"], 1)
        self.assertEqual(counters["FteWritableCandidates"], 1)

    def test_inactive_rows_cannot_receive_enrichment(self):
        rows = [sql_row("f1", "10000001", active="False"), sql_row("f2", "10000002")]
        docs = [fs_doc("10000001", fte="0.5"), fs_doc("10000002", fte="0.5")]
        counters = fe.preview_fte(self.sql_file(rows), self.fs_file(docs), expected=None)["counters"]
        self.assertEqual(counters["ExcludedPlaceholder"], 1)
        self.assertEqual(counters["MatchedFaculty"], 1)

    def test_malformed_nonblank_source_fte_is_reported_and_not_writable(self):
        rows = [sql_row("f1", "10000001"), sql_row("f2", "10000002"), sql_row("f3", "10000003")]
        docs = [fs_doc("10000001", fte="not-a-number"), fs_doc("10000002", fte=None), fs_doc("10000003", fte="0.5")]
        preview = fe.preview_fte(self.sql_file(rows), self.fs_file(docs), expected=None)
        counters = preview["counters"]
        self.assertEqual(counters["FteBackfillCandidates"], 3)
        self.assertEqual(counters["InvalidSourceFte"], 1)
        self.assertEqual(counters["FteWritableCandidates"], 2)
        self.assertEqual(counters["FteDefaultedToOne"], 1)
        self.assertEqual(preview["invalidSourceUcids"], ["10000001"])

    def test_fte_invariants_hold(self):
        rows = [sql_row("f1", "10000001", fte="0.5"), sql_row("f2", "10000002"), sql_row("f3", "10000003")]
        docs = [fs_doc("10000001", fte="0.5"), fs_doc("10000002", fte="0.5"), fs_doc("10000003", fte=None)]
        counters = fe.preview_fte(self.sql_file(rows), self.fs_file(docs), expected=None)["counters"]
        self.assertEqual(
            counters["MatchedFaculty"],
            counters["FteAlreadyPresent"] + counters["FteBackfillCandidates"],
        )
        self.assertEqual(
            counters["FteBackfillCandidates"],
            counters["FteWritableCandidates"] + counters["InvalidSourceFte"],
        )

    def test_mismatched_expected_counts_fail_closed(self):
        rows = [sql_row("f1", "10000001")]
        docs = [fs_doc("10000001", fte="0.5")]
        with self.assertRaises(fe.FailClosedError):
            fe.preview_fte(self.sql_file(rows), self.fs_file(docs), expected=fe.EXPECTED_FTE_BASELINE)

    def test_duplicate_firestore_ucid_fails_closed(self):
        rows = [sql_row("f1", "10000001")]
        docs = [fs_doc("10000001", fte="0.5"), fs_doc("10000001", fte="0.8")]
        with self.assertRaises(fe.FailClosedError):
            fe.preview_fte(self.sql_file(rows), self.fs_file(docs), expected=None)

    def test_preview_reports_zero_writes(self):
        rows = [sql_row("f1", "10000001")]
        docs = [fs_doc("10000001", fte="0.5")]
        preview = fe.preview_fte(self.sql_file(rows), self.fs_file(docs), expected=None)
        self.assertEqual(preview["mode"], "preview")
        self.assertEqual(preview["writes"], 0)

    def test_negative_source_fte_is_rejected(self):
        rows = [sql_row("f1", "10000001")]
        docs = [fs_doc("10000001", fte="-1")]
        preview = fe.preview_fte(self.sql_file(rows), self.fs_file(docs), expected=None)
        self.assertEqual(preview["counters"]["InvalidSourceFte"], 1)


class DirectoryPreviewTests(PreviewFixtureMixin, unittest.TestCase):
    def test_directory_insert_candidates_and_null_sources(self):
        rows = [sql_row("f1", "10000001"), sql_row("f2", "10000002")]
        docs = [fs_doc("10000001", campus="Main Campus", office="HSC 100", lab=None), fs_doc("10000002", campus="", office="HSC 200")]
        columns = fe.preview_directory(self.sql_file(rows), self.fs_file(docs), expected=None)["columns"]
        self.assertEqual(columns["Campus"]["InsertCandidates"], 1)
        self.assertEqual(columns["Campus"]["NullSourceValues"], 1)
        self.assertEqual(columns["OfficeLocation"]["InsertCandidates"], 2)
        self.assertEqual(columns["LabLocation"]["NullSourceValues"], 2)

    def test_existing_non_null_value_is_a_conflict_not_an_overwrite(self):
        rows = [sql_row("f1", "10000001")]
        docs = [fs_doc("10000001", campus="Spy Hill")]
        existing = [{"FacultyId": "f1", "Campus": "Foothills"}]
        columns = fe.preview_directory(
            self.sql_file(rows), self.fs_file(docs), existing_profiles=existing, expected=None
        )["columns"]
        self.assertEqual(columns["Campus"]["Conflicts"], 1)
        self.assertEqual(columns["Campus"]["UpdateCandidates"], 0)
        self.assertEqual(columns["Campus"]["InsertCandidates"], 0)

    def test_existing_null_value_becomes_an_update_candidate(self):
        rows = [sql_row("f1", "10000001")]
        docs = [fs_doc("10000001", campus="Spy Hill")]
        existing = [{"FacultyId": "f1", "Campus": ""}]
        columns = fe.preview_directory(
            self.sql_file(rows), self.fs_file(docs), existing_profiles=existing, expected=None
        )["columns"]
        self.assertEqual(columns["Campus"]["UpdateCandidates"], 1)
        self.assertEqual(columns["Campus"]["Conflicts"], 0)

    def test_identical_existing_value_is_unchanged(self):
        rows = [sql_row("f1", "10000001")]
        docs = [fs_doc("10000001", campus="Spy Hill")]
        existing = [{"FacultyId": "f1", "Campus": "spy hill"}]
        columns = fe.preview_directory(
            self.sql_file(rows), self.fs_file(docs), existing_profiles=existing, expected=None
        )["columns"]
        self.assertEqual(columns["Campus"]["Unchanged"], 1)

    def test_placeholders_and_unmatched_are_excluded_from_directory_candidates(self):
        rows = [sql_row("f1", "", record_type="sessional_pool"), sql_row("f2", "10000002")]
        docs = [fs_doc("10000002", campus="Main Campus")]
        columns = fe.preview_directory(self.sql_file(rows), self.fs_file(docs), expected=None)["columns"]
        self.assertEqual(columns["Campus"]["InsertCandidates"], 1)
        self.assertEqual(columns["Campus"]["Unmatched"], 0)

    def test_directory_preview_reports_zero_writes(self):
        rows = [sql_row("f1", "10000001")]
        docs = [fs_doc("10000001")]
        preview = fe.preview_directory(self.sql_file(rows), self.fs_file(docs), expected=None)
        self.assertEqual(preview["mode"], "preview")
        self.assertEqual(preview["writes"], 0)

    def test_mismatched_directory_baseline_fails_closed(self):
        rows = [sql_row("f1", "10000001")]
        docs = [fs_doc("10000001")]
        with self.assertRaises(fe.FailClosedError):
            fe.preview_directory(
                self.sql_file(rows), self.fs_file(docs), expected=fe.EXPECTED_DIRECTORY_BASELINE
            )


class StreamComparisonTests(PreviewFixtureMixin, unittest.TestCase):
    def rows(self):
        return [
            sql_row("f1", "10000001"),
            sql_row("f2", "10000002"),
            sql_row("f3", "10000003"),
        ]

    def test_reports_distinct_values_on_both_sides_without_declaring_a_mapping(self):
        docs = [
            fs_doc("10000001", stream="teaching"),
            fs_doc("10000002", stream="teaching & research"),
            fs_doc("10000003", stream="teaching"),
        ]
        rows = self.rows()
        rows[0]["Stream"] = "Teaching-Focused"
        rows[1]["Stream"] = "Teaching & Research"
        rows[2]["Stream"] = "Teaching-Focused"
        result = fe.compare_stream_values(self.sql_file(rows), self.fs_file(docs), expected=None)
        self.assertFalse(result["migrated"])
        self.assertFalse(result["declaresMapping"])
        self.assertEqual(result["writes"], 0)
        self.assertEqual(result["sqlDistinct"], {"Teaching & Research": 1, "Teaching-Focused": 2})
        self.assertEqual(result["firestoreDistinct"], {"teaching": 2, "teaching & research": 1})
        self.assertEqual(
            result["observedPairs"],
            [
                {"source": "teaching", "target": "Teaching-Focused", "count": 2},
                {"source": "teaching & research", "target": "Teaching & Research", "count": 1},
            ],
        )

    def test_missing_source_stream_is_counted_not_guessed(self):
        rows = [sql_row("f1", "10000001"), sql_row("f2", "10000002")]
        docs = [fs_doc("10000001", stream=None), fs_doc("10000002", stream="teaching")]
        result = fe.compare_stream_values(self.sql_file(rows), self.fs_file(docs), expected=None)
        self.assertEqual(result["sourceMissing"], 1)
        self.assertEqual(result["firestoreDistinct"], {"teaching": 1})
        self.assertNotIn("", result["firestoreDistinct"])

    def test_unmatched_rows_do_not_inflate_source_missing(self):
        """A canonical row with no Firestore match is unmatched, not source-missing."""
        rows = [sql_row("f1", "10000001"), sql_row("f2", "10000002")]
        docs = [fs_doc("10000001", stream="teaching")]
        result = fe.compare_stream_values(self.sql_file(rows), self.fs_file(docs), expected=None)
        self.assertEqual(result["sourceMissing"], 0)
        self.assertEqual(sum(result["sqlDistinct"].values()), 2)

    def test_one_source_value_against_two_sql_values_is_flagged_ambiguous(self):
        rows = self.rows()
        rows[0]["Stream"] = "Teaching-Focused"
        rows[1]["Stream"] = "Teaching & Research"
        rows[2]["Stream"] = "Teaching-Focused"
        docs = [fs_doc("10000001", stream="teaching"), fs_doc("10000002", stream="teaching"), fs_doc("10000003", stream="teaching")]
        result = fe.compare_stream_values(self.sql_file(rows), self.fs_file(docs), expected=None)
        self.assertEqual(result["ambiguousSourceValues"], ["teaching"])

    def test_placeholder_rows_are_excluded_from_the_comparison(self):
        rows = [sql_row("f1", "", record_type="vacancy"), sql_row("f2", "10000002")]
        docs = [fs_doc("10000002", stream="teaching")]
        result = fe.compare_stream_values(self.sql_file(rows), self.fs_file(docs), expected=None)
        self.assertEqual(sum(result["sqlDistinct"].values()), 1)

    def test_mismatched_stream_baseline_fails_closed(self):
        docs = [fs_doc("10000001", stream="teaching")]
        with self.assertRaises(fe.FailClosedError):
            fe.compare_stream_values(
                self.sql_file([sql_row("f1", "10000001")]),
                self.fs_file(docs),
                expected=fe.EXPECTED_STREAM_COMPARISON,
            )


class FteBusinessDefaultTests(PreviewFixtureMixin, unittest.TestCase):
    """Authoritative PAWS rule: blank/null source FTE means 1.0 (100% FTE).

    Only a MALFORMED non-blank value is invalid. A missing value is never
    treated as unknown or invalid.
    """

    def resolve(self, value):
        return fe.resolve_source_fte(value)

    def test_null_source_defaults_to_one(self):
        self.assertEqual(self.resolve(None), (fe.Decimal("1.0"), True))

    def test_empty_string_source_defaults_to_one(self):
        self.assertEqual(self.resolve(""), (fe.Decimal("1.0"), True))

    def test_whitespace_source_defaults_to_one(self):
        for whitespace in [" ", "\t", "   ", "\r\n"]:
            self.assertEqual(self.resolve(whitespace), (fe.Decimal("1.0"), True), repr(whitespace))

    def test_explicit_half_is_preserved(self):
        self.assertEqual(self.resolve("0.5"), (fe.Decimal("0.5"), False))

    def test_explicit_point_eight_is_preserved(self):
        self.assertEqual(self.resolve("0.8"), (fe.Decimal("0.8"), False))

    def test_explicit_one_is_preserved_as_one(self):
        for explicit in ["1", "1.0", " 1.0 "]:
            self.assertEqual(self.resolve(explicit), (fe.Decimal("1.0"), False), explicit)

    def test_malformed_nonblank_does_not_default_to_one(self):
        for malformed in ["not-a-number", "abc", "1.0.0", "0,5", "--", "N/A"]:
            value, defaulted = self.resolve(malformed)
            self.assertIsNone(value, malformed)
            self.assertFalse(defaulted, malformed)

    def test_negative_explicit_value_is_not_defaulted(self):
        value, defaulted = self.resolve("-1")
        self.assertIsNone(value)
        self.assertFalse(defaulted)

    def test_null_default_flows_through_the_preview_as_writable(self):
        rows = [sql_row("f1", "10000001")]
        docs = [fs_doc("10000001", fte=None)]
        preview = fe.preview_fte(self.sql_file(rows), self.fs_file(docs), expected=None)
        self.assertEqual(preview["counters"]["FteWritableCandidates"], 1)
        self.assertEqual(preview["counters"]["FteDefaultedToOne"], 1)
        self.assertEqual(preview["counters"]["InvalidSourceFte"], 0)
        self.assertEqual(preview["writableFteByUcid"], {"10000001": "1.0"})
        self.assertEqual(preview["defaultedToUcids"], ["10000001"])

    def test_explicit_values_flow_through_the_preview_unchanged(self):
        rows = [sql_row("f1", "10000001"), sql_row("f2", "10000002")]
        docs = [fs_doc("10000001", fte="0.5"), fs_doc("10000002", fte="0.8")]
        preview = fe.preview_fte(self.sql_file(rows), self.fs_file(docs), expected=None)
        self.assertEqual(preview["writableFteByUcid"], {"10000001": "0.5", "10000002": "0.8"})
        self.assertEqual(preview["counters"]["FteDefaultedToOne"], 0)

    def test_existing_non_null_sql_fte_is_never_overwritten_even_when_source_is_blank(self):
        rows = [sql_row("f1", "10000001", fte="0.6000")]
        docs = [fs_doc("10000001", fte=None)]
        preview = fe.preview_fte(self.sql_file(rows), self.fs_file(docs), expected=None)
        self.assertEqual(preview["counters"]["FteAlreadyPresent"], 1)
        self.assertEqual(preview["counters"]["FteWritableCandidates"], 0)
        self.assertEqual(preview["counters"]["FteDefaultedToOne"], 0)
        self.assertEqual(preview["writableUcids"], [])
        self.assertEqual(preview["writableFteByUcid"], {})

    def test_existing_non_null_sql_fte_is_never_overwritten_by_an_explicit_source(self):
        rows = [sql_row("f1", "10000001", fte="0.8000")]
        docs = [fs_doc("10000001", fte="0.5")]
        preview = fe.preview_fte(self.sql_file(rows), self.fs_file(docs), expected=None)
        self.assertEqual(preview["counters"]["FteAlreadyPresent"], 1)
        self.assertEqual(preview["counters"]["FteWritableCandidates"], 0)
        self.assertEqual(preview["writableFteByUcid"], {})

    def test_defaulted_rows_stay_inside_the_writable_subset(self):
        rows = [sql_row("f1", "10000001"), sql_row("f2", "10000002"), sql_row("f3", "10000003")]
        docs = [fs_doc("10000001", fte=None), fs_doc("10000002", fte=""), fs_doc("10000003", fte="bogus")]
        counters = fe.preview_fte(self.sql_file(rows), self.fs_file(docs), expected=None)["counters"]
        self.assertEqual(counters["FteBackfillCandidates"], 3)
        self.assertEqual(counters["FteWritableCandidates"], 2)
        self.assertEqual(counters["FteDefaultedToOne"], 2)
        self.assertEqual(counters["InvalidSourceFte"], 1)
        self.assertLessEqual(counters["FteDefaultedToOne"], counters["FteWritableCandidates"])


class NoWriteGuaranteeTests(unittest.TestCase):
    DML_PATTERNS = [
        r"\bINSERT\s+INTO\b",
        r"\bUPDATE\s+\w+\s+SET\b",
        r"\bDELETE\s+FROM\b",
        r"\bMERGE\s+INTO\b",
        r"\bEXEC(?:UTE)?\s+\w",
        r"\bCREATE\s+TABLE\b",
        r"\bALTER\s+TABLE\b",
        r"\bDROP\s+TABLE\b",
    ]

    def test_preview_module_contains_no_sql_write_statement(self):
        source = MODULE.read_text(encoding="utf-8")
        for pattern in self.DML_PATTERNS:
            self.assertIsNone(re.search(pattern, source, re.IGNORECASE), pattern)

    def test_preview_module_opens_no_database_connection(self):
        source = MODULE.read_text(encoding="utf-8").casefold()
        for driver in ["pyodbc", "pymssql", "sqlalchemy", "mssql", "connect(", "cursor(", "commit("]:
            self.assertNotIn(driver, source, driver)

    def test_preview_module_exposes_no_apply_entrypoint(self):
        for name in dir(fe):
            self.assertIsNone(re.search(r"(?i)apply|write|execute", name), name)

    def test_cli_has_no_apply_switch_and_no_write_statement(self):
        source = CLI.read_text(encoding="utf-8")
        for pattern in self.DML_PATTERNS:
            self.assertIsNone(re.search(pattern, source, re.IGNORECASE), pattern)
        self.assertNotIn("--apply", source)
        self.assertIn("--skip-baseline", source)

    def test_preview_only_reads_files(self):
        source = MODULE.read_text(encoding="utf-8")
        for forbidden in ["open(", "write_text(", "write_bytes(", "os.remove", "shutil."]:
            self.assertNotIn(forbidden, source, forbidden)


if __name__ == "__main__":
    unittest.main()
