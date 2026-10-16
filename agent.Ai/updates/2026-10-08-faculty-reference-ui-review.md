# Agent Update — Faculty reference UI and DOE rulebook review

**Date:** 2026-10-08
**Repository:** Alex1122341/Teaching-assignment-azure
**Task status:** READ-ONLY REVIEW

## Goal
Owner requests Faculty Lookup/Edit UI close to https://alex1122341.github.io/Teaching-assignment/faculty-admin.html and its DOE Rules architecture, logic and functions.

## Starting breakpoint
Live release e1005a909eca0c18df19f3a8f23b722d01084896; manual signed additive DOE published. Local docs branch docs/manual-doe-release-evidence-20261008.

## Work performed
Read reference live pages and official repository source. Inspected Lookup, Edit and DOE Rules; downloaded selected public reference source to untracked outputs/faculty-reference-20261008. No product edits, database writes or deployment.

## Findings and design direction
Reference uses grouped identity/appointment/education/location/internal notes editor; split-pane Lookup, collapsible course activity and source/provenance DOE sections. Rulebook has annual policy lifecycle, grouped rule table, category tabs, course/VISC mappings, structured guideline references, reserve editor, validation/preview/history/publication/recalculation. Current SQL backend already has much lifecycle infrastructure; current UI exposes JSON rather than those controls. Adapt reference behavior to SQL authority and existing authorization/audit/revision guards. Do not merge Demo repository wholesale or restore Firestore business writes.
Reference hosted page is explicitly synthetic/non-authoritative; visible Demo reserve20/15/20 differs from repository formal seed35/15/7.5 with split0.5 and3-year averaging, matching current Guidelines-backed operational sources. Do not import Demo rates or fixtures.

## Pending clarification
Async question asks whether to retain owner-confirmed manual signed adjustments over automatic policy baseline (recommended), or replace them with reference automatic rematch/recalculate assignment flow. No answer yet. Brainstorming architectural design/spec/plan gates remain incomplete; no implementation started.

## Next action
Resolve manual-versus-auto interaction, present concrete architectural design, obtain required design/spec/plan review under brainstorming skill, then implementation/review/controlled release. Existing five deferred targets remain blank; do not rerun source imports.
