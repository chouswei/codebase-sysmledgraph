# Plan: LSP Client Fixes, Indexing & Graph Worker

## Product positioning: Modelbase, sysmledgraph, and the codebase Subscriber

**Modelbase** (SysML v2 **system-models** repo) holds `.sysml` as **single source of truth**—authoring, validate/preview, exports, traceability. **sysmledgraph** (this package) is the **graph tool for the Modelbase**: it **indexes** modelbase paths into **Kuzu** and exposes **CLI + MCP** (query, context, impact, Cypher, map, …). The **publisher** workflow lives with the model: index and refresh the graph where the model lives.

**Codebase** (implementation repo—application, firmware, services) should reach the **same graph** without maintaining a second copy of the index. A **Subscriber** is that second consumer: same **`graph.kuzu` / same storage root**, connected over the **long-lived TCP worker** so the codebase’s Cursor (or CLI) uses **read/query tools** against the DB the modelbase already built—**no second process opening the Kuzu file**, easy access to **model structure** while coding.

| Role | Where it runs | What it does |
|------|----------------|--------------|
| **SysML MCP** (e.g. sysml-v2-lsp) | Modelbase (and codebase when editing `.sysml`) | Parse, validate, preview—**textual model** |
| **sysmledgraph (publisher)** | Modelbase | **`analyze` / `indexDbGraph`**, own **`SYSMEDGRAPH_STORAGE_ROOT`**, optional **`worker start --detach`** |
| **sysmledgraph (Subscriber)** | Codebase | **Same** `SYSMEDGRAPH_STORAGE_ROOT` + **`SYSMLEGRAPH_WORKER_URL`** (or visible **`worker.port`**) → TCP to daemon; use **query / context / impact / …**; avoid re-indexing unless you intentionally refresh |

**Principle:** **One graph DB** for one model slice; **Modelbase publishes** (index + daemon); **codebase subscribes** (TCP client to the same DB).

---

**Indexing / LSP plan:** Phases 1–4 **complete** (v0.7.0). **Phase 5** (long-lived graph worker) is **implemented**. **Phase 6** (design-doc alignment with the shipped worker) is **complete**—**DESIGN_LONG_LIVED_WORKER.md** refresh, **PLAN_IMPLEMENT** as implementation log, **WORKER_CONTRACT.md**.

**Released:** v0.8.2 — indexer **two-phase** edge write; optional **`SYSMLEGRAPH_INDEX_REFERENCES=1`** (MCP REFERENCES); **DESIGN** §8.2 **Failed** state; **docs/PUBLISH.md**. v0.8.1 — **WORKER_CONTRACT.md**, Phase 6, CI matrix, npm **`lsp/`** explicit **files**. v0.8.0 — long-lived worker, gateway, CI, README/docs refresh. v0.7.0 — LSP in `lsp/`, MCP, npm publish. (Earlier: v0.4.3.)

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
- **✅ Phase 6 (docs):** **DESIGN_LONG_LIVED_WORKER.md** refreshed; **PLAN_IMPLEMENT_LONG_LIVED_WORKER.md** → implementation log; **WORKER_CONTRACT.md** added.
- **✅ CI:** **`.github/workflows/ci.yml`** matrix **windows-latest** + **ubuntu-latest** (build, unit tests, **`test:daemon`**).
- **✅ v0.8.2:** Indexer two-phase edge write; optional **`SYSMLEGRAPH_INDEX_REFERENCES=1`**; **DESIGN** §8.2 **Failed**; **docs/PUBLISH.md**.
- **Doctrine (PLAN):** **sysmledgraph** = graph **tool for Modelbase**; **Subscriber** pattern = codebase MCP/CLI **same DB via worker** (see § Product positioning, Phase 7).

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

### Phase 6: Worker & design documentation alignment — ✅ Done

**Delivered:** **DESIGN_LONG_LIVED_WORKER.md** (As-built + map + body refresh); **PLAN_IMPLEMENT_LONG_LIVED_WORKER.md** (implementation log + v1 checklist checked); **WORKER_CONTRACT.md** (operator NDJSON / files / CLI summary).

| # | Task | Status |
|---|------|--------|
| 6.1 | **DESIGN — front matter** | ✅ |
| 6.2 | **DESIGN — reframe body** | ✅ |
| 6.3 | **DESIGN — mapping table** | ✅ |
| 6.4 | **PLAN_IMPLEMENT** | ✅ Retitled **implementation log**; archive summary table |
| 6.5 | **WORKER_CONTRACT.md** | ✅ |

**Success criteria (Phase 6):**

- [x] First screen of **DESIGN_LONG_LIVED_WORKER.md** answers what runs and which files are used.
- [x] Shipped worker path not described as “proposed only.”
- [x] **PLAN_IMPLEMENT_LONG_LIVED_WORKER.md** is not an open v1 todo list.

### Phase 7: Subscriber (codebase) — same DB as Modelbase — 🔄 Planned

**Goal:** Document and (optionally) productize **Subscriber** setup so an **implementation repo** uses **sysmledgraph MCP** only as a **client of the existing graph** (same `graph.kuzu` via daemon).

| # | Task | Status |
|---|------|--------|
| 7.1 | **Docs:** Recipe in **INSTALL** / **MCP_SERVER_FOR_CURSOR**: Modelbase `worker start`, shared `SYSMEDGRAPH_STORAGE_ROOT`, codebase `SYSMLEGRAPH_WORKER_URL` + same env; when to avoid `indexDbGraph` in Subscriber | ⏳ |
| 7.2 | Env **`SYSMLEGRAPH_SUBSCRIBER=1`** — MCP omits **`indexDbGraph`** / **`clean_index`** (Subscriber); **INSTALL** documents **worker.lock** as real single-daemon guarantee | ✅ |
| 7.3 | **Docs:** Cross-machine Subscriber (SSH tunnel vs shared FS) — **docs/INSTALL.md** § *Two Git repos* | ✅ |

**Today:** Subscriber works if storage root is **shared** (same clone, bind mount, or synced path) **and** Modelbase runs the daemon; codebase MCP points at **`SYSMLEGRAPH_WORKER_URL`**.

## MCP server for Cursor AI

**Modelbase:** Run **sysmledgraph** MCP (and/or CLI) as **publisher**—index model paths, optionally **`worker start --detach`**. **Codebase:** Run the **same** **sysmledgraph** MCP package as **Subscriber**—configure **same** `SYSMEDGRAPH_STORAGE_ROOT` and **`SYSMLEGRAPH_WORKER_URL`** (see Phase 7). Add **sysml-v2** MCP where you edit `.sysml`. See **docs/MCP_SERVER_FOR_CURSOR.md**.

- **Entrypoint:** `mcp/index.ts` → `dist/mcp/index.js`; bin `sysmledgraph-mcp` and `npm run mcp`.
- **Cursor:** Add **sysmledgraph** to `.cursor/mcp.json` (`command` / `args` / `env` per workspace—publisher vs Subscriber). Example in this repo’s `.cursor/mcp.json` is **publisher-style** (local storage).
- **Tools:** Publisher: indexDbGraph, list_indexed, clean_index, cypher, query, context, impact, rename, generate_map. Subscriber (**`SYSMLEGRAPH_SUBSCRIBER=1`**): same minus indexDbGraph / clean_index. Resources: sysmledgraph://context, sysmledgraph://schema.
- **Prereq:** **Publisher:** index at least one path. **Subscriber:** daemon reachable + same storage root; Kuzu opened only in daemon (**docs/INSTALL.md**, **docs/DESIGN_LONG_LIVED_WORKER.md**, **docs/WORKER_CONTRACT.md**).

## Success Criteria

- ✅ `graph-map.md` shows symbol nodes (Package, PartDef, Action, etc.) not just Document
- ✅ Interconnection table has edges (IN_DOCUMENT, IN_PACKAGE)
- ✅ Indexing writes data correctly (LSP + optional MCP fallback)
- ✅ Validation script: `node scripts/validate-sysml-file.mjs <path>` (exit 0/1)
- ✅ MCP server runnable via `npx sysmledgraph-mcp`; Cursor can use tools when configured (see MCP_SERVER_FOR_CURSOR.md)

### Phase 5 (worker)

- [x] Long-lived TCP worker + gateway + MCP/CLI wiring (see Phase 5 section above).
- [x] Scripts `export-graph` / `generate-map` via CLI `graph export` / `graph map` (gateway-aware).
