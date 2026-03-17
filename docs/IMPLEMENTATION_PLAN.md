# Implementation plan traceability

This document maps the **development plan** (source: `sysml-v2-models/projects/sysmledgraph/outputs/sysmledgraph-DEVELOPMENT_PLAN.md`) to the implementation in this repo. Requirements R1–R8 and the deploy/behaviour models are the source of truth.

**Behaviour model (index pipeline):** The modelbase defines **IndexPipelineStates** in `behaviour-sysmledgraph.sysml`: states *discovering* → *loadOrdering* → *parsing* → *mapping* → *writing* → *complete*, with events DiscoveryComplete, LoadOrderComplete, ParseComplete, MapComplete, WriteComplete. The indexer in `src/indexer/indexer.ts` is structured in the same order; `src/indexer/pipeline-phases.ts` exports the phase names for traceability.

---

## Phase 1 – Repo and pipeline

| Step | Plan | Implementation |
|------|------|-----------------|
| 1 | Create implementation location; layout per CODEBASE_STRUCTURE; Node/TS, dependencies (Kuzu, MCP SDK, commander, fast-glob); Node 20+; sysml-v2-lsp. | `package.json`, `tsconfig.json`, `.nvmrc`, `src/`, `bin/`, `mcp/`, `test/`, `schema/`, `docs/`. Dependencies: kuzu, @modelcontextprotocol/sdk, commander, fast-glob, sysml-v2-lsp (GitHub). |
| 2 | Build and test (tsc + vitest); scripts build, test, optional analyze. | `npm run build` (tsc), `npm test` (vitest), `npm run analyze` (dist CLI). |
| 3 | SysML parsing: sysml-v2-lsp as library or stdio client; documentSymbol/definition/references. | **stdio client**: `src/parser/lsp-client.ts` (spawn LSP, Content-Length framing, documentSymbol). `src/parser/symbols.ts`: getSymbolsForFile, flatten tree, IN_DOCUMENT/IN_PACKAGE. |
| 4 | File discovery: .sysml (and .kerml); config.yaml model_files, model_dir. | `src/discovery/find-sysml.ts` (fast-glob). `src/discovery/load-order.ts`: config.yaml, model_files, model_dir. |
| 5 | Verify parse; document symbol→graph mapping. | `src/symbol-to-graph/mapping.ts` (symbolKindToNodeLabel, relationToEdgeType). `docs/grammar-and-mapping.md`. |

---

## Phase 2 – Graph and index

| Step | Plan | Implementation |
|------|------|-----------------|
| 6 | Graph schema: node labels (Document, Package, PartDef, …), edge types (IN_DOCUMENT, IN_PACKAGE, …). | `src/graph/schema.ts`: NODE_TABLE, getSchemaDdl(), NODE_LABELS, EDGE_TYPES. Single Node table + one rel table per edge type. |
| 7 | GraphStore: open/create Kuzu DB; addDocument(path, indexedAt?), addSymbol, addEdge, getConnection(); storage root + registry + DB per path. | `src/graph/graph-store.ts`: openGraphStore, getCachedOrOpenGraphStore, invalidateGraphStoreCache. `src/storage/location.ts`: getDbPathForIndexedPath (.kuzu). |
| 8 | Indexer: discovery → load order → parse → map → write. Multiple roots; re-index behaviour documented. **R8:** on failure report, graph unchanged. | `src/indexer/indexer.ts`: pipeline phases (discovering → loadOrdering → parsing → mapping → writing) align with **SysmledgraphBehaviour::IndexPipelineStates** (modelbase `models/behaviour-sysmledgraph.sysml`). `src/indexer/pipeline-phases.ts`: phase names for traceability. findSysmlFiles, applyLoadOrder, getSymbolsForFile, addDocument/addSymbol/addEdge. Registry indexedAt. Re-index: merge (README). |
| 9 | list (registry); clean (delete DB, update registry). **R8:** on failure report, graph unchanged. | `src/storage/list.ts`, `src/storage/clean.ts`, `src/storage/registry.ts`. clean_index invalidates cache before clean. |
| 10 | Verify: index path, list, Cypher. | Integration test `test/integration/cli-and-graph.test.ts`; unit tests discovery, graph-store, load-order. |

---

## Phase 3 – MCP server

| Step | Plan | Implementation |
|------|------|-----------------|
| 11 | MCP server stdio; server name **sysmledgraph**. | `mcp/index.ts`, `src/mcp/server.ts`: McpServer, StdioServerTransport. |
| 12 | Tools: indexDbGraph (path/paths), query (query, kind?), context (name), impact (target, direction?), rename (symbol, newName, dry_run?), cypher (query), list_indexed, clean_index (path?). **R8:** structured error in tool result. | `src/mcp/tools/*.ts`. All tools return ok/error; server sets isError on result. Plus **alignment_status** (model–codebase alignment). |
| 13 | Resources: sysmledgraph://context (index stats, staleness), sysmledgraph://schema. Optional per-path. | `src/mcp/resources/context.ts`, `schema.ts`, **alignment.ts**. Resources: context, schema, alignment. (Per-path resource not implemented.) |
| 14 | Verify: index from Cursor, query, context, impact, rename dry_run, schema resource. | Manual / smoke. |

---

## Phase 4 – CLI and docs

| Step | Plan | Implementation |
|------|------|-----------------|
| 15 | CLI: analyze (index path(s)), list, clean (path optional). **R8:** non-zero exit, stderr. | `bin/cli.ts`, `src/cli/commands.ts`: analyze, list, clean, **check** (alignment). |
| 16 | README: install, usage, env/config, storage, schema summary, MCP setup. | README: Install, Usage (CLI, MCP, Querying, View the graph), alignment, Schema, docs links. |
| 17 | Verify: CLI analyze/list/clean; docs match. | Tests; README and INSTALL_NOTES, MCP-AND-KUZU, grammar-and-mapping. |

---

## R8 (error reporting)

- **MCP:** Tool results include `ok: false` and `error`; server returns `isError: true` for failures.
- **CLI:** On failure, stderr message and `process.exit(1)`.
- **Index/Clean:** On failure, no partial commit; graph/registry unchanged. Indexer returns ok/error; addToRegistry only after success.

---

## Risks (plan) → mitigations (implementation)

- **Kuzu DB lock:** Per-process connection cache (getCachedOrOpenGraphStore); invalidate on index/clean. Document: close Cursor before full CLI re-index (MCP-AND-KUZU.md, README).
- **LSP path:** Resolve LSP from SYSMLLSP_SERVER_PATH, then workspace/repo (walk up from cwd), then package node_modules.
- **Load order:** config.yaml model_files, model_dir; else deterministic sort.

---

## After v1 (plan, optional)

- **detect_changes:** Not implemented (Git diff → affected symbols).
- **Export:** Implemented: `scripts/export-graph.mjs`, `viewer/view.html`.
- **Multi-path:** One DB per indexed path (not one merged graph); tools use first indexed path for cypher/query/context/impact.
