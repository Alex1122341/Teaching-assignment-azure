import json
import tempfile
import unittest
from pathlib import Path

from tools.azure_sql_migration.identity import stable_id
from tools.azure_sql_migration.normalize import canonical_session_key
from tools.azure_sql_migration.session_time_corrections import (
    CorrectionManifestError,
    apply_corrections,
    load_correction_manifest,
)


ORIGINAL = {
    "academic_year": "2026-27",
    "curriculum_year": "Year 2",
    "course": "308",
    "topic": "Clinical Pathology - Renal 2",
    "session_type": "LEC",
    "date": "2026-09-21",
    "start": "01:30:00",
    "end": "02:30:00",
}
SESSION_ID = stable_id("session", canonical_session_key(ORIGINAL))


def session_payload(**overrides):
    payload = {
        "sessionId": SESSION_ID,
        "academicYear": "2026-27",
        "curriculumYear": "Year 2",
        "courseCode": "308",
        "courseName": "Fundamentals",
        "topic": "Clinical Pathology - Renal 2",
        "sessionType": "LEC",
        "date": "2026-09-21",
        "start": "01:30:00",
        "end": "02:30:00",
    }
    payload.update(overrides)
    return payload


def correction(**overrides):
    item = {
        "sessionId": SESSION_ID,
        "oldStart": "01:30:00",
        "oldEnd": "02:30:00",
        "newStart": "13:30:00",
        "newEnd": "14:20:00",
        "source": "ucvm_timetable_master_2026-09-27.xlsx",
        "sourceDate": "2026-09-21",
        "sourceCourse": "308",
        "sourceTopic": "Clinical Pathology - Renal 2",
        "sourceMatchMethod": "exact-date-course-type-topic",
    }
    item.update(overrides)
    return item


class CorrectionManifestTests(unittest.TestCase):
    def write_manifest(self, corrections):
        temp = tempfile.TemporaryDirectory()
        path = Path(temp.name) / "corrections.json"
        path.write_text(json.dumps({"format": "paws-session-time-corrections-v1", "corrections": corrections}), encoding="utf-8")
        return temp, path

    def test_session_without_override_is_unchanged(self):
        row = session_payload()
        actual = apply_corrections([row], {})
        self.assertEqual(actual, [row])

    def test_known_session_gets_only_source_backed_times(self):
        actual = apply_corrections([session_payload()], {SESSION_ID: correction()})[0]
        self.assertEqual(actual["start"], "13:30:00")
        self.assertEqual(actual["end"], "14:20:00")
        self.assertEqual(
            {k: actual[k] for k in actual if k not in {"start", "end"}},
            {k: session_payload()[k] for k in session_payload() if k not in {"start", "end"}},
        )

    def test_session_id_is_derived_from_original_key_before_correction(self):
        corrected = apply_corrections([session_payload()], {SESSION_ID: correction()})[0]
        self.assertEqual(corrected["sessionId"], stable_id("session", canonical_session_key(ORIGINAL)))
        changed_key = {**ORIGINAL, "start": corrected["start"], "end": corrected["end"]}
        self.assertNotEqual(corrected["sessionId"], stable_id("session", canonical_session_key(changed_key)))

    def test_unknown_correction_session_fails_closed(self):
        with self.assertRaisesRegex(CorrectionManifestError, "unknown SessionId"):
            apply_corrections([], {SESSION_ID: correction()})

    def test_duplicate_correction_entry_fails(self):
        temp, path = self.write_manifest([correction(), correction()])
        self.addCleanup(temp.cleanup)
        with self.assertRaisesRegex(CorrectionManifestError, "duplicate SessionId"):
            load_correction_manifest(path)

    def test_invalid_corrected_interval_fails(self):
        temp, path = self.write_manifest([correction(newStart="15:00:00", newEnd="14:00:00")])
        self.addCleanup(temp.cleanup)
        with self.assertRaisesRegex(CorrectionManifestError, "new interval"):
            load_correction_manifest(path)

    def test_times_are_canonicalized_to_hh_mm_ss(self):
        temp, path = self.write_manifest([correction(oldStart="01:30", oldEnd="02:30", newStart="13:30", newEnd="14:20")])
        self.addCleanup(temp.cleanup)
        loaded = load_correction_manifest(path)
        self.assertEqual(loaded[SESSION_ID]["oldStart"], "01:30:00")
        self.assertEqual(loaded[SESSION_ID]["newEnd"], "14:20:00")

    def test_midnight_sentinel_stays_unchanged_without_explicit_entry(self):
        midnight = session_payload(start="00:00:00", end="00:00:00")
        self.assertEqual(apply_corrections([midnight], {})[0]["start"], "00:00:00")
        self.assertEqual(apply_corrections([midnight], {})[0]["end"], "00:00:00")

    def test_stale_old_time_fails_without_changing_other_fields(self):
        with self.assertRaisesRegex(CorrectionManifestError, "old time mismatch"):
            apply_corrections([session_payload(topic="Do not mutate", start="01:15:00")], {SESSION_ID: correction()})

    def test_every_correction_must_match_an_existing_session(self):
        second = "00000000-0000-0000-0000-000000000001"
        with self.assertRaisesRegex(CorrectionManifestError, second):
            apply_corrections([session_payload()], {SESSION_ID: correction(), second: correction(sessionId=second)})


if __name__ == "__main__":
    unittest.main()

