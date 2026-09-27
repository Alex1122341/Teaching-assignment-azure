import unittest

from tools.reconcile_session_times import build_manifest, summarize_reconciliation


class ReconcileSessionTimesCliTests(unittest.TestCase):
    def test_manifest_contains_only_approved_corrections_and_review_evidence(self):
        rows = [{
            "SessionId": "abc",
            "Date": "2026-09-21",
            "CourseCode": "308",
            "PAWS_Topic": "Renal 2",
            "CurrentStart": "01:30:00",
            "CurrentEnd": "02:30:00",
            "TimetableTopic": "Renal 2",
            "ProposedStart": "13:30:00",
            "ProposedEnd": "14:20:00",
            "MatchMethod": "exact-date-course-type-topic",
            "CorrectionRequired": "YES",
            "Classification": "DETERMINISTIC_TIME_CORRECTION",
        }]
        manifest = build_manifest(rows, {"master": {"fileName": "master.xlsx", "sha256": "a"}})
        self.assertEqual(len(manifest["corrections"]), 1)
        self.assertEqual(manifest["corrections"][0]["oldStart"], "01:30:00")
        self.assertEqual(manifest["corrections"][0]["sourceTopic"], "Renal 2")

    def test_quality_summary_uses_literal_grid_boundaries(self):
        rows = [
            {"CurrentStart": "07:30:00", "CurrentEnd": "08:30:00", "Classification": "MATCH_ALREADY_CORRECT", "CorrectionRequired": "NO"},
            {"CurrentStart": "01:30:00", "CurrentEnd": "02:30:00", "Classification": "DETERMINISTIC_TIME_CORRECTION", "CorrectionRequired": "YES"},
            {"CurrentStart": "09:30:00", "CurrentEnd": "08:30:00", "Classification": "NO_TIMETABLE_MATCH", "CorrectionRequired": "NO"},
            {"CurrentStart": "00:00:00", "CurrentEnd": "00:00:00", "Classification": "NO_TIMETABLE_MATCH", "CorrectionRequired": "NO"},
        ]
        summary = summarize_reconciliation(rows)
        self.assertEqual(summary["totalSessions"], 4)
        self.assertEqual(summary["currentGridPositionable"], 1)
        self.assertEqual(summary["currentEarlyClock"], 1)
        self.assertEqual(summary["currentReversed"], 1)
        self.assertEqual(summary["currentMidnightSentinel"], 1)
        self.assertEqual(summary["deterministicCorrections"], 1)


if __name__ == "__main__":
    unittest.main()

