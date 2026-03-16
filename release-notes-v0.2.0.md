## Changes

- **Kuzu connection cache** — MCP tools (context, query, impact, cypher, rename, indexDbGraph) now use a single cached connection per DB path per process, fixing "Could not set lock on file" when the same graph is queried repeatedly or concurrently. Cache is invalidated on re-index and clean.
- **Install docs** — `docs/INSTALL_NOTES.md` explains slow installs, Windows workarounds (e.g. `npm install --ignore-scripts`), Kuzu cleanup warnings, and using `SYSMLLSP_SERVER_PATH` for an external LSP.
- **CLI** — `npm run analyze` now correctly runs the built CLI (`dist/bin/cli.js`).

Restart the MCP server after upgrading to pick up the cache fix.
