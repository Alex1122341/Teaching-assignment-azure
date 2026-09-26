"""Faculty enrichment preview — Phase A (read-only, evidence-file driven).

This module computes what a *future* enrichment apply would change. It performs
no I/O beyond reading evidence files that were exported earlier, opens no
database connection, and contains no write statement of any kind. Preview is
the only mode; there is no apply path in this module.

Identity policy (locked):
  * the ONLY join key is an exact normalized UCID match
    (NFC + trim + whitespace-collapse + casefold);
  * names, emails, and Firestore document ids are never identity keys;
  * non-canonical rows (RecordType != 'faculty') are excluded from matching and
    can never receive enrichment;
  * an existing non-null SQL value is never overwritten.

Everything fails closed: if the computed counters differ from the pinned
evidence baseline the caller gets FailClosedError instead of a preview.
"""

from __future__ import annotations

import csv
import io
import json
import unicodedata
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any, Iterable

# --------------------------------------------------------------------------- #
# Baseline pinned from the collected Faculty enrichment evidence.
# --------------------------------------------------------------------------- #

FTE_COUNTERS = (
    "MatchedFaculty",
    "FteAlreadyPresent",
    "FteBackfillCandidates",
    "FteWritableCandidates",
    "InvalidSourceFte",
    "Unmatched",
    "ExcludedPlaceholder",
)

EXPECTED_FTE_BASELINE = {
    "MatchedFaculty": 114,
    "FteAlreadyPresent": 12,
    "FteBackfillCandidates": 102,
    "FteWritableCandidates": 100,
    "InvalidSourceFte": 2,
    "Unmatched": 2,
    "ExcludedPlaceholder": 4,
}

# Directory targets approved for Phase A. The right-hand value is the Firestore
# evidence key that carries the value.
DIRECTORY_TARGETS = (
    ("Campus", "campus"),
    ("OfficeLocation", "officeLocation"),
    ("LabLocation", "labLocation"),
)

DIRECTORY_COUNTERS = (
    "MatchedFaculty",
    "InsertCandidates",
    "UpdateCandidates",
    "Unchanged",
    "NullSourceValues",
    "Unmatched",
    "Conflicts",
)

EXPECTED_DIRECTORY_BASELINE = {
    "Campus": {
        "MatchedFaculty": 114,
        "InsertCandidates": 114,
        "UpdateCandidates": 0,
        "Unchanged": 0,
        "NullSourceValues": 0,
        "Unmatched": 2,
        "Conflicts": 0,
    },
    "OfficeLocation": {
        "MatchedFaculty": 114,
        "InsertCandidates": 113,
        "UpdateCandidates": 0,
        "Unchanged": 0,
        "NullSourceValues": 1,
        "Unmatched": 2,
        "Conflicts": 0,
    },
    # The collected evidence exports only a hasLabLocation presence flag for 36
    # matched rows and carries NO labLocation value. Zero candidates is the
    # honest result; a fresh export that includes the value is required first.
    "LabLocation": {
        "MatchedFaculty": 114,
        "InsertCandidates": 0,
        "UpdateCandidates": 0,
        "Unchanged": 0,
        "NullSourceValues": 114,
        "Unmatched": 2,
        "Conflicts": 0,
    },
}

CANONICAL_RECORD_TYPE = "faculty"


class FailClosedError(RuntimeError):
    """Raised when a preview disagrees with the pinned evidence baseline."""


# --------------------------------------------------------------------------- #
# Normalization / value helpers
# --------------------------------------------------------------------------- #


def normalize_ucid(value: Any) -> str:
    """Exact UCID normalization: NFC + trim + whitespace-collapse + casefold."""
    text = unicodedata.normalize("NFC", str(value if value is not None else ""))
    return " ".join(text.split()).casefold()


def is_present(value: Any) -> bool:
    return value is not None and str(value).strip() != ""


def parse_fte(value: Any) -> Decimal | None:
    """Return a Decimal for a usable source FTE, else None (invalid/missing)."""
    if not is_present(value):
        return None
    try:
        parsed = Decimal(str(value).strip())
    except (InvalidOperation, ValueError):
        return None
    if not parsed.is_finite() or parsed < 0:
        return None
    return parsed


def _text(value: Any) -> str:
    return "" if value is None else str(value).strip()


def _is_true(value: Any) -> bool:
    return str(value if value is not None else "").strip().casefold() in {"true", "1", "yes"}


# --------------------------------------------------------------------------- #
# Evidence loading
# --------------------------------------------------------------------------- #


def load_sql_faculty(source: Path | str | Iterable[dict]) -> list[dict]:
    """Load the paws.Faculty evidence dump (CSV path, or already-parsed rows)."""
    if not isinstance(source, (str, Path)):
        return [dict(row) for row in source]
    raw = Path(source).read_bytes().decode("utf-8-sig")
    return [dict(row) for row in csv.DictReader(io.StringIO(raw))]


def load_firestore_faculty(source: Path | str | Iterable[dict]) -> list[dict]:
    """Load the Firestore /faculty evidence dump (JSON path, or parsed docs).

    Accepts either the inventory envelope {"slim": [...]} or a bare list.
    """
    if not isinstance(source, (str, Path)):
        return [dict(row) for row in source]
    payload = json.loads(Path(source).read_text(encoding="utf-8"))
    if isinstance(payload, dict):
        payload = payload.get("slim") or []
    return [dict(row) for row in payload]


def load_directory_profile(source: Path | str | Iterable[dict] | None) -> list[dict]:
    """Load existing paws.FacultyDirectoryProfile rows (CSV path or rows).

    Phase A is the first writer of this table, so callers normally pass None and
    every candidate is an insert.
    """
    if source is None:
        return []
    if not isinstance(source, (str, Path)):
        return [dict(row) for row in source]
    raw = Path(source).read_bytes().decode("utf-8-sig")
    return [dict(row) for row in csv.DictReader(io.StringIO(raw))]


# --------------------------------------------------------------------------- #
# Matching
# --------------------------------------------------------------------------- #


def index_firestore_by_ucid(docs: Iterable[dict]) -> tuple[dict[str, dict], list[str]]:
    """Build the UCID -> document index.

    Returns (index, duplicate_ucids). A duplicate normalized UCID is an
    ambiguous identity and is reported rather than silently resolved.
    """
    index: dict[str, dict] = {}
    duplicates: list[str] = []
    for doc in docs:
        key = normalize_ucid(doc.get("ucid"))
        if not key:
            continue
        if key in index:
            duplicates.append(key)
            continue
        index[key] = doc
    return index, sorted(set(duplicates))


def split_faculty_rows(sql_rows: Iterable[dict]) -> tuple[list[dict], list[dict]]:
    """Split into (canonical faculty rows, excluded placeholder rows)."""
    canonical: list[dict] = []
    excluded: list[dict] = []
    for row in sql_rows:
        record_type = _text(row.get("RecordType")).casefold()
        if record_type != CANONICAL_RECORD_TYPE:
            excluded.append(row)
            continue
        if not _is_true(row.get("Active")):
            excluded.append(row)
            continue
        canonical.append(row)
    return canonical, excluded


def _assert_no_duplicates(duplicates: list[str]) -> None:
    if duplicates:
        raise FailClosedError(
            "Ambiguous identity: duplicate normalized UCID(s) in the Firestore "
            f"evidence ({len(duplicates)}). Preview refused."
        )


# --------------------------------------------------------------------------- #
# FTE preview
# --------------------------------------------------------------------------- #


def preview_fte(
    sql_faculty: Path | str | Iterable[dict],
    firestore_faculty: Path | str | Iterable[dict],
    *,
    expected: dict[str, int] | None = EXPECTED_FTE_BASELINE,
) -> dict:
    """Preview the Fte backfill. Never overwrites a non-null SQL Fte."""
    sql_rows = load_sql_faculty(sql_faculty)
    fs_docs = load_firestore_faculty(firestore_faculty)
    index, duplicates = index_firestore_by_ucid(fs_docs)
    _assert_no_duplicates(duplicates)

    canonical, excluded = split_faculty_rows(sql_rows)

    matched: list[tuple[dict, dict]] = []
    unmatched: list[dict] = []
    for row in canonical:
        doc = index.get(normalize_ucid(row.get("Ucid")))
        if doc is None:
            unmatched.append(row)
        else:
            matched.append((row, doc))

    already_present = 0
    backfill_candidates: list[tuple[str, Decimal]] = []
    invalid_source: list[str] = []

    for row, doc in matched:
        if is_present(row.get("Fte")):
            already_present += 1
            continue
        ucid = _text(row.get("Ucid"))
        source_fte = parse_fte(doc.get("fte"))
        if source_fte is None:
            invalid_source.append(ucid)
        else:
            backfill_candidates.append((ucid, source_fte))

    counters = {
        "MatchedFaculty": len(matched),
        "FteAlreadyPresent": already_present,
        # The backfill gap: every matched row whose SQL Fte is still NULL.
        "FteBackfillCandidates": len(matched) - already_present,
        # Of that gap, the rows a future apply could actually write.
        "FteWritableCandidates": len(backfill_candidates),
        "InvalidSourceFte": len(invalid_source),
        "Unmatched": len(unmatched),
        "ExcludedPlaceholder": len(excluded),
    }

    _assert_invariants(counters)

    preview = {
        "mode": "preview",
        "target": "paws.Faculty.Fte",
        "writes": 0,
        "counters": counters,
        "writableUcids": sorted(ucid for ucid, _ in backfill_candidates),
        "invalidSourceUcids": sorted(invalid_source),
        "duplicateFirestoreUcid": duplicates,
        "expected": dict(expected) if expected else None,
        "matchesExpected": counters == expected if expected else None,
    }
    if expected is not None and counters != expected:
        raise FailClosedError(
            "FTE preview does not match the pinned evidence baseline. "
            f"actual={counters} expected={dict(expected)}"
        )
    return preview


def _assert_invariants(counters: dict[str, int]) -> None:
    if counters["MatchedFaculty"] != counters["FteAlreadyPresent"] + counters["FteBackfillCandidates"]:
        raise FailClosedError("FTE invariant violated: matched != present + backfill gap")
    if counters["FteBackfillCandidates"] != counters["FteWritableCandidates"] + counters["InvalidSourceFte"]:
        raise FailClosedError("FTE invariant violated: gap != writable + invalid source")


# --------------------------------------------------------------------------- #
# Directory preview
# --------------------------------------------------------------------------- #


def preview_directory(
    sql_faculty: Path | str | Iterable[dict],
    firestore_faculty: Path | str | Iterable[dict],
    *,
    existing_profiles: Path | str | Iterable[dict] | None = None,
    expected: dict[str, dict[str, int]] | None = EXPECTED_DIRECTORY_BASELINE,
) -> dict:
    """Preview Campus / OfficeLocation / LabLocation enrichment.

    Never overwrites an existing non-null directory value; a differing existing
    value is reported as a conflict for review instead of an update.
    """
    sql_rows = load_sql_faculty(sql_faculty)
    fs_docs = load_firestore_faculty(firestore_faculty)
    index, duplicates = index_firestore_by_ucid(fs_docs)
    _assert_no_duplicates(duplicates)

    canonical, _excluded = split_faculty_rows(sql_rows)
    existing_rows = load_directory_profile(existing_profiles)
    existing_by_faculty = {
        _text(row.get("FacultyId")): row for row in existing_rows if _text(row.get("FacultyId"))
    }

    columns: dict[str, dict[str, int]] = {}
    detail: dict[str, dict[str, list[str]]] = {}

    for column, source_key in DIRECTORY_TARGETS:
        counters = {name: 0 for name in DIRECTORY_COUNTERS}
        detail[column] = {"inserts": [], "updates": [], "conflicts": [], "nullSource": []}
        for row in canonical:
            doc = index.get(normalize_ucid(row.get("Ucid")))
            if doc is None:
                counters["Unmatched"] += 1
                continue
            counters["MatchedFaculty"] += 1
            source_value = _text(doc.get(source_key))
            if not source_value:
                counters["NullSourceValues"] += 1
                detail[column]["nullSource"].append(_text(row.get("Ucid")))
                continue
            existing = existing_by_faculty.get(_text(row.get("FacultyId")))
            if existing is None:
                counters["InsertCandidates"] += 1
                detail[column]["inserts"].append(_text(row.get("Ucid")))
                continue
            current = _text(existing.get(column))
            if not current:
                counters["UpdateCandidates"] += 1
                detail[column]["updates"].append(_text(row.get("Ucid")))
            elif current.casefold() == source_value.casefold():
                counters["Unchanged"] += 1
            else:
                counters["Conflicts"] += 1
                detail[column]["conflicts"].append(_text(row.get("Ucid")))
        columns[column] = counters

    preview = {
        "mode": "preview",
        "target": "paws.FacultyDirectoryProfile",
        "writes": 0,
        "columns": columns,
        "detail": detail,
        "duplicateFirestoreUcid": duplicates,
        "expected": expected,
        "matchesExpected": columns == expected if expected else None,
    }
    if expected is not None and columns != expected:
        raise FailClosedError(
            "Directory preview does not match the pinned evidence baseline. "
            f"actual={columns} expected={expected}"
        )
    return preview


# --------------------------------------------------------------------------- #
# Stream distinct-value comparison (NOT a migration)
# --------------------------------------------------------------------------- #

# Phase A does NOT migrate Stream. This comparison only reports which distinct
# values exist on each side and how they co-occur. It deliberately declares no
# mapping and recommends no transform: the architect owns that decision.
STREAM_SOURCE_KEY = "stream"

EXPECTED_STREAM_COMPARISON = {
    "sqlDistinct": {"Teaching & Research": 76, "Teaching-Focused": 40},
    "firestoreDistinct": {"teaching & research": 73, "teaching": 40},
    "observedPairs": [
        {"source": "teaching", "target": "Teaching-Focused", "count": 40},
        {"source": "teaching & research", "target": "Teaching & Research", "count": 73},
    ],
    "sourceMissing": 1,
    "ambiguousSourceValues": [],
}


def compare_stream_values(
    sql_faculty: Path | str | Iterable[dict],
    firestore_faculty: Path | str | Iterable[dict],
    *,
    expected: dict | None = EXPECTED_STREAM_COMPARISON,
) -> dict:
    """Report distinct Stream values on both sides and their co-occurrence.

    No mapping is declared, applied, or recommended. `ambiguousSourceValues`
    lists any single source value that co-occurs with more than one SQL value,
    which is the only case that would need an architect decision.
    """
    sql_rows = load_sql_faculty(sql_faculty)
    fs_docs = load_firestore_faculty(firestore_faculty)
    index, duplicates = index_firestore_by_ucid(fs_docs)
    _assert_no_duplicates(duplicates)

    canonical, _excluded = split_faculty_rows(sql_rows)

    sql_distinct: dict[str, int] = {}
    fs_distinct: dict[str, int] = {}
    pair_counts: dict[tuple[str, str], int] = {}
    source_missing = 0

    for row in canonical:
        sql_value = _text(row.get("Stream"))
        sql_distinct[sql_value] = sql_distinct.get(sql_value, 0) + 1
        doc = index.get(normalize_ucid(row.get("Ucid")))
        if doc is None:
            continue
        source_value = _text(doc.get(STREAM_SOURCE_KEY))
        if not source_value:
            source_missing += 1
            continue
        fs_distinct[source_value] = fs_distinct.get(source_value, 0) + 1
        pair_counts[(source_value, sql_value)] = pair_counts.get((source_value, sql_value), 0) + 1

    observed_pairs = [
        {"source": source, "target": target, "count": count}
        for (source, target), count in sorted(pair_counts.items())
    ]
    targets_per_source: dict[str, set[str]] = {}
    for (source, target) in pair_counts:
        targets_per_source.setdefault(source, set()).add(target)
    ambiguous = sorted(source for source, targets in targets_per_source.items() if len(targets) > 1)

    actual = {
        "sqlDistinct": dict(sorted(sql_distinct.items())),
        "firestoreDistinct": dict(sorted(fs_distinct.items())),
        "observedPairs": observed_pairs,
        "sourceMissing": source_missing,
        "ambiguousSourceValues": ambiguous,
    }

    preview = {
        "mode": "comparison",
        "migrated": False,
        "writes": 0,
        "declaresMapping": False,
        **actual,
        "expected": expected,
        "matchesExpected": actual == expected if expected else None,
    }
    if expected is not None and actual != expected:
        raise FailClosedError(
            "Stream comparison does not match the pinned evidence baseline. "
            f"actual={actual} expected={expected}"
        )
    return preview
