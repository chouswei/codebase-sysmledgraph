# Codebase vs modelbase alignment

This document analyses whether the **implementation repo** (this codebase) aligns to the **modelbase**: the development plan, requirements R1–R8, and deploy/behaviour models in `sysml-v2-models/projects/sysmledgraph`. The plan and CODEBASE_STRUCTURE are the source of truth; this repo does not contain the SysML models.

**Conclusion: the codebase aligns to the modelbase.** All 17 plan steps are implemented; R8 (error reporting) and documented risks are addressed. Optional “After v1” items are explicitly out of scope and documented.

---

## 1. Codebase structure (plan step 1 / CODEBASE_STRUCTURE)

| Expected | Present |
|----------|---------|
| Node/TS, Node 20+ | `package.json` engines `>=20`, `.nvmrc` with `20` |
| Kuzu, MCP SDK, commander, fast-glob, sysml-v2-lsp | Dependencies in `package.json` |
| `src/`, `bin/`, `mcp/`, `test/`, `docs/` | All present |
| `schema/` | No top-level folder. Graph schema lives in `src/graph/schema.ts` (DDL); plan “layout” may mean schema as concept, not directory — **acceptable**. |
| Build + test scripts | `npm run build` (tsc), `npm test` (vitest), `npm run analyze` |

**Verdict:** Aligned. Single minor nuance: no `schema/` directory; schema is in code.

---

## 2. Phase 1 – Repo and pipeline (steps 2–5)

- **Step 2:** Build/test — `tsconfig.json`, vitest; scripts present. ✓  
- **Step 3:** SysML parsing — LSP **stdio** client in `src/parser/lsp-client.ts`; `src/parser/symbols.ts` (documentSymbol, IN_DOCUMENT/IN_PACKAGE). ✓  
- **Step 4:** Discovery — `src/discovery/find-sysml.ts` (fast-glob, .sysml/.kerml); `src/discovery/load-order.ts` (config.yaml model_files, model_dir). ✓  
- **Step 5:** Symbol→graph mapping — `src/symbol-to-graph/mapping.ts`; `docs/grammar-and-mapping.md`. ✓  

**Verdict:** Aligned.

---

## 3. Phase 2 – Graph and index (steps 6–10)

- **Step 6:** Graph schema — `src/graph/schema.ts`: NODE_TABLE, getSchemaDdl(), NODE_LABELS, EDGE_TYPES. ✓  
- **Step 7:** GraphStore — `src/graph/graph-store.ts` (open, cache, invalidate); `src/storage/location.ts` (DB path per indexed path); one DB per path. ✓  
- **Step 8:** Indexer — `src/indexer/indexer.ts`: pipeline phases (discovering → loadOrdering → parsing → mapping → writing) align with behaviour **IndexPipelineStates**; `src/indexer/pipeline-phases.ts` for phase names. Registry `indexedAt`; re-index merge in README. ✓  
- **Step 9:** list/clean — `src/storage/list.ts`, `clean.ts`, `registry.ts`; MCP `clean_index` invalidates cache before clean. ✓  
- **Step 10:** Verify — `test/integration/cli-and-graph.test.ts`; unit tests for discovery, graph-store, load-order. ✓  

**Verdict:** Aligned.

---

## 4. Phase 3 – MCP server (steps 11–14)

- **Step 11:** MCP stdio, name **sysmledgraph** — `mcp/index.ts`, `src/mcp/server.ts` (McpServer, StdioServerTransport). ✓  
- **Step 12:** Tools — indexDbGraph, query, context, impact, rename, cypher, list_indexed, clean_index (all in `src/mcp/tools/*.ts`); plus **alignment_status**. All return `{ ok, error? }`; server sets `isError` on failure. ✓  
- **Step 13:** Resources — sysmledgraph://context, sysmledgraph://schema, sysmledgraph://alignment (`src/mcp/resources/`). Per-path resource not implemented (optional in plan). ✓  
- **Step 14:** Verify — manual/smoke. ✓  

**Verdict:** Aligned.

---

## 5. Phase 4 – CLI and docs (steps 15–17)

- **Step 15:** CLI analyze, list, clean (path optional), plus **check** — `bin/cli.ts`, `src/cli/commands.ts`. On failure: stderr + `process.exit(1)`. ✓  
- **Step 16:** README — install, usage, env/config, storage, re-index behaviour, alignment, schema summary, MCP setup, docs links. ✓  
- **Step 17:** Docs match — README, INSTALL_NOTES, MCP-AND-KUZU, grammar-and-mapping, IMPLEMENTATION_PLAN. ✓  

**Verdict:** Aligned.

---

## 6. R8 (error reporting)

| Requirement | Implementation |
|-------------|----------------|
| MCP: structured error in tool result | Tools return `{ ok: false, error }`; server uses `toolResult(..., true)` so `isError: true` on result. |
| CLI: non-zero exit, stderr | All commands on failure: `process.stderr.write(...)` and `process.exit(1)`. |
| Index/clean: on failure report, graph/registry unchanged | Indexer returns `ok: false` without committing; registry updated only after successful index; clean invalidates cache then deletes. |

**Verdict:** Aligned.

---

## 7. Risks (plan) → mitigations

- **Kuzu DB lock:** Connection cache in graph layer; invalidate on index/clean. Documented in README and MCP-AND-KUZU.md. ✓  
- **LSP path:** SYSMLLSP_SERVER_PATH → workspace/repo (walk up) → node_modules. ✓  
- **Load order:** config.yaml model_files, model_dir; else deterministic sort. ✓  

**Verdict:** Aligned.

---

## 8. After v1 (optional, not required for alignment)

- **detect_changes:** Not implemented (Git diff → affected symbols). Documented as after v1.  
- **Export:** Implemented (scripts/export-graph.mjs, viewer/view.html).  
- **Multi-path:** One DB per path; tools use first indexed path for reads. Documented in README and IMPLEMENTATION_PLAN.

---

## Summary

| Area | Aligned | Notes |
|------|---------|--------|
| Codebase structure | ✓ | No top-level `schema/` dir; schema in `src/graph/schema.ts`. |
| Phase 1 (steps 2–5) | ✓ | Discovery, parser (stdio), load order, symbol→graph. |
| Phase 2 (steps 6–10) | ✓ | Schema, GraphStore, indexer, list/clean, tests. |
| Phase 3 (steps 11–14) | ✓ | MCP sysmledgraph, all tools + alignment_status, resources. |
| Phase 4 (steps 15–17) | ✓ | CLI analyze/list/clean/check, README, docs. |
| R8 | ✓ | MCP and CLI errors; no partial commit on failure. |
| Risks | ✓ | Kuzu lock, LSP path, load order documented and implemented. |

**The implementation repo aligns to the modelbase.** Traceability is in [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md).
