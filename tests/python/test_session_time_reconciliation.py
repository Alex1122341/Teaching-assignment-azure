import unittest

from tools.azure_sql_migration.session_time_reconciliation import reconcile_sessions


def current(session_id="s1", topic="Renal 2", start="01:30:00", end="02:30:00"):
    return {"SessionId": session_id, "Date": "2026-09-21", "CourseCode": "308", "SessionType": "LEC", "PAWS_Topic": topic, "CurrentStart": start, "CurrentEnd": end}


def source(topic="Renal 2", start="13:30:00", end="14:20:00"):
    return {"Date": "2026-09-21", "CourseCode": "308", "SessionType": "LEC", "TimetableTopic": topic, "TimetableStart": start, "TimetableEnd": end}


class SessionTimeReconciliationTests(unittest.TestCase):
    def test_unique_exact_match_emits_deterministic_correction(self):
        row = reconcile_sessions([current()], [source()])[0]
        self.assertEqual(row["Classification"], "DETERMINISTIC_TIME_CORRECTION")
        self.assertEqual((row["ProposedStart"], row["ProposedEnd"]), ("13:30:00", "14:20:00"))

    def test_unique_exact_match_with_same_time_is_already_correct(self):
        row = reconcile_sessions([current(start="13:30:00", end="14:20:00")], [source()])[0]
        self.assertEqual(row["Classification"], "MATCH_ALREADY_CORRECT")
        self.assertEqual(row["CorrectionRequired"], "NO")

    def test_multiple_exact_candidates_fail_closed(self):
        row = reconcile_sessions([current()], [source(), source(start="14:30:00", end="15:20:00")])[0]
        self.assertEqual(row["Classification"], "MULTIPLE_TIMETABLE_MATCHES")
        self.assertEqual(row["CorrectionRequired"], "NO")

    def test_duplicate_source_rows_with_same_interval_are_one_authoritative_event(self):
        row = reconcile_sessions([current()], [source(), source()])[0]
        self.assertEqual(row["Classification"], "DETERMINISTIC_TIME_CORRECTION")

    def test_multiple_current_sessions_for_one_source_event_are_ambiguous(self):
        rows = reconcile_sessions([current("s1"), current("s2", start="02:30:00", end="03:30:00")], [source()])
        self.assertEqual([row["Classification"] for row in rows], ["SOURCE_AMBIGUOUS", "SOURCE_AMBIGUOUS"])
        self.assertTrue(all(row["CorrectionRequired"] == "NO" for row in rows))

    def test_no_match_is_reported_without_fuzzy_matching(self):
        row = reconcile_sessions([current(topic="Renal II")], [source(topic="Renal 2")])[0]
        self.assertEqual(row["Classification"], "NO_TIMETABLE_MATCH")

    def test_midnight_can_change_only_with_unique_exact_source(self):
        row = reconcile_sessions([current(start="00:00:00", end="00:00:00")], [source()])[0]
        self.assertEqual(row["Classification"], "UNKNOWN_TIME_CONFIRMED_BY_TIMETABLE")


if __name__ == "__main__":
    unittest.main()
