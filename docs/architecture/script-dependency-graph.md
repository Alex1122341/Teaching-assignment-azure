# Script relationships — Graphify first

Before investigating how PAWS scripts relate, consult the Graphify index. This applies to imports, function calls, frontend-to-API connections, SQL repositories, build/release scripts and the impact of a proposed change. Then verify the referenced files and lines in current source.

## Local index

- Machine-readable relationships: `graphify-out/graph.json`.
- Interactive file/symbol tree: `graphify-out/SCRIPT_MAP.html`.
- The output is local, generated and Git-ignored. It is never part of Firebase Hosting or the API artifact. Another checkout must generate its own copy.
- This index belongs to `Alex1122341/Teaching-assignment-azure` / Beta / University SQL. It does not describe the separate Pages / Firestore application.
- The HTML tree groups symbols by file and uses D3 v7 from `d3js.org`; its visible totals are not the full raw graph node count. Use `graph.json` for the complete extracted relation list. After expanding far to the right, scroll horizontally back to the root if Reset View leaves the container offset.

## Generate or refresh

Use the installed Graphify CLI with its SQL extra (`graphifyy[sql]`). Run from the repository root:

```powershell
graphify extract . --code-only --no-cluster --max-workers 4 --force
graphify tree --graph graphify-out/graph.json --output graphify-out/SCRIPT_MAP.html --root . --label 'PAWS Beta script relationships'
```

Code-only extraction is local AST analysis; do not enable semantic extraction, remote model labeling or upload source just to refresh this index. `.graphifyignore` and the repository ignore rules exclude private inputs, dependencies, generated packages and scratch work. Review extraction warnings, including unsupported or symbol-free files. Regenerate after changes relevant to the relationship being investigated. Record the checkout SHA and dirty-source status with any acceptance evidence derived from a generated graph.

## Find a relationship

```powershell
graphify explain 'createLeadershipAccessApi' --all --graph graphify-out/graph.json
graphify query 'leadership access' --seed 'createLeadershipAccessApi' --budget 1500 --graph graphify-out/graph.json
graphify path 'createSwaSqlRuntime' 'createLeadershipAccessApi' --graph graphify-out/graph.json
graphify affected 'createLeadershipAccessApi' --depth 2 --graph graphify-out/graph.json
```

Use the exact node ID printed by Graphify if a label is ambiguous. Imports and calls are directed; an undirected path is a navigation aid, not proof of execution order.

## Confirm against source

The graph is a locator, not the authorization or release authority. Dynamic imports, browser globals, HTML script tags, runtime strings, stored-procedure names and SQL Server dialect constructs may be incomplete. Check source with `rg`, especially `tools/static-assets.json`, `tools/runtime-bundles.json`, HTML entry points and `server/src/runtime/swa-sql-runtime.js`. Never infer that an unmapped script is unused, remove a runtime dependency from the allowlist, broaden permissions, or promote a freeze solely because of the graph.

The 2026-10-27 extraction scanned845 code files and produced6,442 nodes /14,342 raw edges.102 files yielded no modeled symbols, including SQL Server permission scripts and some small browser wrappers. The multigraph diagnostic found no dangling endpoints or exact duplicate edges, but a simple directed-graph projection would collapse1,488 different same-endpoint relationships. Preserve the raw JSON; do not use a projected count to claim complete call coverage. The dated receipt is `docs/audits/2026-10-27-graphify-script-map.json`.
