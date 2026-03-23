# Plan: LSP Client Fixes, Indexing & Graph Worker

**Indexing / LSP plan:** Phases 1–4 **complete** (v0.7.0). **Phase 5** (long-lived graph worker) is **implemented in this repo** (daemon, gateway, CLI, MCP). See **docs/DESIGN_LONG_LIVED_WORKER.md** and **docs/PLAN_IMPLEMENT_LONG_LIVED_WORKER.md**.

**Released:** v0.8.0 — long-lived graph worker, gateway, CI, README/docs refresh. v0.7.0 — LSP in `lsp/`, MCP for Cursor, npm publish. (Earlier: v0.4.3.)

## Current Status

✅ **Completed:**
- Fixed LSP client: added `--stdio` flag, Windows spawn (`cmd /c`), timeouts, error handling
- Created `lsp/` folder with dedicated npm install for isolated LSP server init
- Added MCP fallback: when LSP returns no symbols, automatically tries MCP `getSymbols` (shared client per index run)
- Added LSP capabilities: `hierarchicalDocumentSymbolSupport`, `workspaceFolders`
- Added SymbolInformation support: normalize flat list with `containerName` to DocumentSymbol-like shape
- Added LSP SymbolKind fallback: map numeric `kind` to label when `detail` is missing
- Enhanced symbol mapping: added MCP-style kind strings ("Part Definition", etc.) with normalized lookup
- Analyzed MCP client template patterns
- **✅ Phase 1 Complete:** LSP client returns symbols; graph has symbol nodes and edges (IN_DOCUMENT, IN_PACKAGE)
- **✅ Phase 2 Complete:** LSP notification handler (e.g. `window/logMessage` when `DEBUG_LSP_NOTIFICATIONS=1`); indexed `modelbase-development/models/`; `graph-map.md` generated with full nodes and interconnection table
- **✅ CLI exit fix:** (1) Explicit graph store close in `cmdAnalyze` (try/finally). (2) After successful analyze, CLI calls `process.exit(0)` so the process exits before Node/Kuzu teardown (avoids Windows access violation). Verified: `node scripts/index-and-map.mjs test/fixtures/sysml` completes with exit 0 and writes `graph-map.md`.
- **✅ v0.7.0:** Independent LSP (`lsp/`, `setup-lsp`), MCP server for Cursor (docs, `.cursor/mcp.json`), npm publish (repository, files, prepublishOnly), root README and repo About.
- **✅ Phase 5 (worker):** TCP daemon owns merged `graph.kuzu`; CLI/MCP use **gateway** when `worker.port` or **`SYSMLEGRAPH_WORKER_URL`** is set; `worker start` / `stop` / `status`; `graph export` / `graph map` and npm scripts delegate to the CLI (gateway-aware). See **docs/INSTALL.md**.

## Plan

### Phase 1: Test & Verify — ✅ Done

1. Rebuild and test LSP client; run index-and-map.
2. Verify `graph-map.md` has symbol nodes and edges.
3. Debug LSP/MCP via `scripts/debug-lsp-symbols.mjs` if needed.

### Phase 2: Notification Handlers & Larger Models — ✅ Done

4. **LSP notification handler** — Handler added in `lsp-client.ts`; `window/logMessage` and `window/showMessage` logged when `DEBUG_LSP_NOTIFICATIONS=1`.
5. **Real SysML files** — Indexed `modelbase-development/models/` (4 files); map shows Action, Block, Package, PartDef, PartUsage, RequirementDef and IN_DOCUMENT/IN_PACKAGE edges.

### Phase 3: Robustness — ✅ Done

6. **Connection retry logic** — LSP: `getDocumentSymbolsFromLsp` retries `createLspClient()` once after 1.5s on failure. MCP: `getSymbolsFromMcp` retries the getSymbols call once after 1s on failure; still returns [] if unavailable.
7. **Better error reporting** — When **`DEBUG_SYSMLEGRAPH_SYMBOLS=1`**, log to stderr per file whether symbols came from LSP or MCP (and count for MCP). LSP errors still fall through to MCP; no custom error types added.

### Phase 4: Validation & Documentation — ✅ Done

8. **Validate the requested file** — `scripts/validate-sysml-file.mjs` calls MCP `validate`; reports syntax errors and semantic issues; exit 0 if valid/no issues, 1 otherwise. Init/read failures handled with clear errors.
9. **Documentation** — v0.4.3: fixes in `MCP_INTERACTION_GUIDE.md`, "no edges" and §6. **Phase 4:** MCP_INTERACTION_GUIDE §8 Troubleshooting (no edges, LSP not found, Kuzu lock, validate script); §9 Summary includes validate.

### Phase 5: Long-lived graph worker — ✅ Core implemented

**Problem:** Kuzu file lock allows only one process per DB. CLI and MCP could each open the DB in-process → conflict when used together.

**Design doc:** **docs/DESIGN_LONG_LIVED_WORKER.md** — goals, transport (TCP localhost), protocol (same NDJSON as `graph-worker`), lifecycle, errors, statecharts, interaction evaluation.

**Implementation plan:** **docs/PLAN_IMPLEMENT_LONG_LIVED_WORKER.md**

**Shipped in repo:**

- **`src/worker/dispatch.ts`** — shared dispatch for stdio worker and daemon.
- **`src/worker/daemon.ts`** — TCP on `127.0.0.1`, `worker.port` + PID, global **serialized** `dispatch`, `shutdown` RPC, SIGINT/SIGTERM.
- **`src/worker/socket-client.ts`** — `SYSMLEGRAPH_WORKER_URL` or `worker.port`; `ensureLongLivedClient`, `requestLongLived`, `closeLongLivedClient`; **`SYSMLEGRAPH_WORKER_STRICT=1`** fail-fast.
- **`src/worker/gateway.ts`** — long-lived → stdio worker (`SYSMLEDGRAPH_USE_WORKER=1`) → in-process; **`closeGraphClient`**.
- **MCP** (`server.ts`) + **mcp/index.ts** — all graph tools/resources via gateway; `SYSMEDGRAPH_STORAGE_ROOT` respected.
- **CLI** — `worker start [--detach]`, `worker stop`, `worker status`; `analyze` / `list` / `clean` use gateway when `worker.port` or URL is set.
- **Docs:** **docs/INSTALL.md** (worker section); **npm run test:daemon** (`vitest.e2e.config.ts`); **`npm run worker:daemon`**.

**Scripts / export:** **`sysmledgraph graph export`** and **`graph map`** (and `npm run export-graph` / `generate-map`) go through the **gateway**, so they use the long-lived worker when `worker.port` or **`SYSMLEGRAPH_WORKER_URL`** is set. Thin **`scripts/export-graph.mjs`** / **`generate-map.mjs`** delegate to the CLI.

**Success criteria (Phase 5):**

- [x] Only the daemon process opens `graph.kuzu` when clients use long-lived mode (`worker.port` or URL) for that storage root.
- [x] CLI and MCP can use the same daemon concurrently (mutating ops serialized in daemon).
- [x] `worker start` / `stop` / `status` implemented (see INSTALL; full exit-code matrix in design §9.4 partially).
- [x] No regression when daemon is not configured (in-process unchanged).

## MCP server for Cursor AI

So Cursor AI can use the graph, the repo runs as an **MCP server** (stdio). See **docs/MCP_SERVER_FOR_CURSOR.md** for the full plan.

- **Entrypoint:** `mcp/index.ts` → `dist/mcp/index.js`; bin `sysmledgraph-mcp` and `npm run mcp`.
- **Cursor:** Add **sysmledgraph** to `.cursor/mcp.json` (command `node`, args `dist/mcp/index.js`, cwd `.`). Example added in this repo’s `.cursor/mcp.json`.
- **Tools:** indexDbGraph, list_indexed, clean_index, cypher, query, context, impact, rename, generate_map. Resources: sysmledgraph://context, sysmledgraph://schema.
- **Prereq:** Index at least one path (CLI or indexDbGraph); same storage as CLI. Kuzu lock: only one process per DB (see Troubleshooting in MCP_INTERACTION_GUIDE). **Optional:** run **`sysmledgraph worker start --detach`** and use the same storage root so CLI + MCP use the TCP worker (**docs/INSTALL.md**, **docs/DESIGN_LONG_LIVED_WORKER.md**).

## Success Criteria

- ✅ `graph-map.md` shows symbol nodes (Package, PartDef, Action, etc.) not just Document
- ✅ Interconnection table has edges (IN_DOCUMENT, IN_PACKAGE)
- ✅ Indexing writes data correctly (LSP + optional MCP fallback)
- ✅ Validation script: `node scripts/validate-sysml-file.mjs <path>` (exit 0/1)
- ✅ MCP server runnable via `npx sysmledgraph-mcp`; Cursor can use tools when configured (see MCP_SERVER_FOR_CURSOR.md)

### Phase 5 (worker)

- [x] Long-lived TCP worker + gateway + MCP/CLI wiring (see Phase 5 section above).
- [x] Scripts `export-graph` / `generate-map` via CLI `graph export` / `graph map` (gateway-aware).
