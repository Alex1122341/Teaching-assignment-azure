#!/usr/bin/env python3
"""Preview PAWS Faculty enrichment (Phase A). READ-ONLY.

Reads previously exported evidence files and prints what a future enrichment
apply *would* change. It opens no database connection, performs no write, and
has no apply switch: preview is the only mode.

    python tools/preview_faculty_enrichment.py \\
        --sql-faculty  <paws.Faculty CSV export> \\
        --firestore-faculty <Firestore /faculty evidence JSON>

Default stdout is AGGREGATE ONLY. It never prints UCIDs, FacultyIds, names,
emails, identifier-keyed maps, or per-Faculty detail lists. When identifier-level
evidence is genuinely needed, pass --private-detail-output <path> to write it to
an explicitly supplied local file. That file must never be committed.

Exit codes:
    0  preview produced and it matched the pinned evidence baseline
    1  preview refused (FailClosedError) — counters differ from the baseline
    2  usage / unreadable evidence
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from azure_sql_migration.faculty_enrichment import (  # noqa: E402
    EXPECTED_DIRECTORY_BASELINE,
    EXPECTED_FTE_BASELINE,
    EXPECTED_STREAM_COMPARISON,
    FailClosedError,
    compare_stream_values,
    preview_directory,
    preview_fte,
    privacy_safe_summary,
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--sql-faculty", required=True, help="paws.Faculty evidence export (CSV)")
    parser.add_argument("--firestore-faculty", required=True, help="Firestore /faculty evidence export (JSON)")
    parser.add_argument(
        "--existing-directory",
        default=None,
        help="optional paws.FacultyDirectoryProfile export (CSV); omit on the first Phase A run",
    )
    parser.add_argument(
        "--private-detail-output",
        default=None,
        metavar="PATH",
        help=(
            "write identifier-level evidence (UCIDs, identifier-keyed maps and per-Faculty "
            "detail lists) to this local file. Never printed to stdout and must never be committed."
        ),
    )
    parser.add_argument(
        "--skip-baseline",
        action="store_true",
        help="report counters without enforcing the pinned evidence baseline (diagnostic use only)",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    expected_fte = None if args.skip_baseline else EXPECTED_FTE_BASELINE
    expected_directory = None if args.skip_baseline else EXPECTED_DIRECTORY_BASELINE
    expected_stream = None if args.skip_baseline else EXPECTED_STREAM_COMPARISON

    try:
        fte = preview_fte(args.sql_faculty, args.firestore_faculty, expected=expected_fte)
        directory = preview_directory(
            args.sql_faculty,
            args.firestore_faculty,
            existing_profiles=args.existing_directory,
            expected=expected_directory,
        )
        stream = compare_stream_values(args.sql_faculty, args.firestore_faculty, expected=expected_stream)
    except FailClosedError as error:
        print(json.dumps({"mode": "preview", "writes": 0, "refused": True, "reason": str(error)}, indent=2))
        return 1

    # Default stdout: aggregate only, never identifier-level.
    print(json.dumps(privacy_safe_summary(fte=fte, directory=directory, stream=stream), indent=2, sort_keys=True))

    if args.private_detail_output:
        destination = Path(args.private_detail_output)
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(
            json.dumps({"fte": fte, "directory": directory, "stream": stream}, indent=2, sort_keys=True),
            encoding="utf-8",
        )
        print(
            f"identifier-level detail written to {destination} (local only; must never be committed)",
            file=sys.stderr,
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
