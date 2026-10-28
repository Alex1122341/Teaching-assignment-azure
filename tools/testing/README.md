# Testing environment

This directory contains the Testing-only configuration and implementation. Automated tests remain in the repository's `tests/` directory.

- `config/`: Testing environment configuration, templates and the specific Firestore calendar index specification.
- `db/`: historical SQL Testing administration and synthetic fixture tooling.
- `host/`: university Testing host preparation, supervision and artifact checks.
- `firestore-*.js`: Testing-only Firestore adapters, isolated transport, fixture and identity helpers.
- `build-testing-release.js`, `publish-testing-hosting.js`, `testing-preflight.js`, `testing-runtime-attestation.js`, and `verify-testing-api-env.js`: Testing build, publication and verification tools.

Older JavaScript and PowerShell paths under `tools/`, `tools/testing-db/`, and `tools/testing-host/` are compatibility entry points that delegate to this directory. The configuration files under `config/` are the sole Testing configuration sources; the Production configuration remains under `config/environments/production.json`.

The current Firestore runtime is incomplete and unpublished. The calendar index specification identifies one index only and must not be used to replace the shared lab database's other indexes.
