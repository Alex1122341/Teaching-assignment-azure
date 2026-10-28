# Graphify script map and lookup rule

The owner requested a Graphify map and a persistent instruction to consult it every time script relationships are investigated. This applies to the current Teaching-assignment-azure / Beta / University SQL worktree; do not modify or index a different application as its replacement.

AGENTS.md now requires Graphify-first lookup, followed by current-source verification. Read `docs/architecture/script-dependency-graph.md` for regeneration and query commands. The generated local files are `graphify-out/graph.json` and `graphify-out/SCRIPT_MAP.html`; they are Git-ignored and excluded from application deployment.

Graphify0.9.97 ran code-only AST extraction without remote model calls. Its optional SQL parser was installed into the existing user-scoped Graphify environment.845 code files produced6,442 nodes and14,342 raw edges. The graph has no dangling endpoints or exact duplicate edges; unsupported/symbol-free files and multigraph-projection loss remain documented limitations.

Verified `createSwaSqlRuntime → createLeadershipAccessApi` as a direct extracted call at `server/src/runtime/swa-sql-runtime.js:120`, then confirmed the source. The HTML tree loads, expands server/src subsystems and resets; browser console returned no error/warning. Local preview is `http://127.0.0.1:19067/`; screenshot is in the private2026-10-27 preflight directory. The viewer uses D3's official CDN and may require horizontally scrolling back after a reset.

## Existing PR148 work continues

The Graphify work does not release PR148 or finish its multi-role acceptance. Historical exact327b4aabdd5aac94b2f8564d1d13accc02854ff7 Account SQL run40610807118 /job122561576272 passed34 markers, including063 exact restore; the receipt is saved privately. Subsequent local Task4 catalog/history SQL062 changes require new isolated SQL proof. No school061/062/063, Tim grant, Auth account creation, production restart, merge or release occurred here. Task4 UI/guard/collaboration changes remain in progress in this worktree. Resume those edits; do not reimplement Tasks1–3 or treat the old SQL receipt as proof of the new SQL bytes.
