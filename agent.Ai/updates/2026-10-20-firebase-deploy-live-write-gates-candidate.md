# PAWS Firebase Hosting default release gate repair — 2026-10-20

## Why

The existing University API at `6bc6a640986e2aebf4b3084cde43addedd8a9593` reported enabled DOE Admin / DOE Policy Publish / DOE Recalculate gates. Normal Firebase Hosting release workflow enforces disabled DOE gates, contradicting the current authorized runtime. Never change operational gates merely to satisfy outdated pipeline assertions.

## Scope / isolation

Workflow-only removal of hard-coded `DOE=false` assertions in full-release pre/post health checks. Preserve exact matching API release SHA, full boolean write gate validation, complete gate fingerprint equality before/after Hosting, healthy University SQL, Firebase CORS and anonymous denial, successful immutable main build artifact, and static-only separate API-byte-identity attestation. Regression tests specifically prohibit reintroducing the outdated DOE-off gate. There are no shipped runtime, database, SQL schema, secrets, IAM, Firebase project, or site changes.

## Release boundary

Source and tests only. The School-hosted University API is still the previous release until separately upgraded and live-attested. Do not deploy Firebase until the exact matching API is online and all 27 reported gates match the preupgrade snapshot. No database migrations or imported data should be replayed.

## Validation

Require PR CI, exact-main green build and manual review before using this workflow for the Hosting-only deploy. Record artifacts and before/after gate hashes and avoid calling source merge a live deployment.
