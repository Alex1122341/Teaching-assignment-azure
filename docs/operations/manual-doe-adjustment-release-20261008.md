# Manual DOE adjustment release

Owner confirmed manual signed additive DOE entries, canonical existing scope suggestions, negative notes, and separate helper entry. Product anchor: 33f1742a938702643cdec946352db05875641929. Previous anchor: 0e6f7a20dae9f0ba86f4157aabefda0a1fa8fb5f.

Separate governance promotion protects 60 shipped static assets (+faculty-admin-doe-manual.js),60 API runtime files (+sql-manual-doe-repository.js and manual-doe-service.js), and the unchanged build/package inputs (63 API protected paths). No drift exceptions.

New scoped gate PAWS_DOE_MANUAL_ASSIGNMENT_WRITE_ENABLED=true also requires existing facultyAdmin gate and administrator identity. Broad doeAdmin,policy publish,recalculate remain false. Migration029 creates a signed manual table and audited revision-guarded procedure with only EXECUTE granted to paws_runtime_manual_doe_write; deploy membership explicitly. Existing source role/trainee DOE stays unchanged. Manual signed credits apply after baseline supervision reserve; summaries,detail and worksheets include active manual rows. Known tags are resolved from existing identities; ambiguous name matches keep editable scope without guessing.

Deployment: reviewed PR, exact-main CI, apply029 using authorized integrated SQL connection, versioned API source attestation/cutover with rollback to current d423137 release, then Firebase Hosting only. Reuse configured DPAPI authentication, never read secrets. Read-only UI acceptance; no invented real negotiated entries.

Prior data recovery remains: role196, supervision116/raw569.25, formal targets111; five targets intentionally deferred by owner. Do not rerun imports.
