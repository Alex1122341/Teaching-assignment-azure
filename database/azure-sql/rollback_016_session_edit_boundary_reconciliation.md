# Migration 016 rollback and containment note

Migration 016 is a local-only reconciliation artifact in this W1C task. It has
not been executed against VetMed-Ops or Azure SQL. There is no live schema or
procedure change to roll back.

If a separately approved future operation applies migration 016 and then
requires rollback, first disable the University API's session-edit gate and
verify `PATCH /api/v1/sessions/:id` returns `503 WRITE_DISABLED` before any
repository or procedure call. Keep the compliant procedure definition in
place. Do not restore the weaker date validation while session edits can be
reached. Any subsequent procedure rollback must be a separately reviewed and
approved migration with a fresh definition fingerprint and a matching test;
this note is not executable SQL and does not authorize such a change.

Required post-containment checks for that future operation:

1. Confirm the session-edit gate is absent, invalid, or exactly `false`.
2. Confirm the route returns the stable disabled response before repository
   invocation.
3. Read the `paws_api.UpdateCalendarSession` definition hash and verify the
   May 1 lower-inclusive / next-May-1 upper-exclusive predicate remains.
4. Do not execute the procedure as a rollback test against business data.
