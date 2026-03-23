# Implementation log: long-lived graph worker (v1 — **shipped**)

> **Status:** Completed in-repo (**v0.8.x**). This file is a **historical checklist** of how the worker was built, not an active task list. **As-built behavior:** **docs/DESIGN_LONG_LIVED_WORKER.md** (§ As-built) and **docs/WORKER_CONTRACT.md**. **Design depth:** **DESIGN_LONG_LIVED_WORKER.md** §8–§11.

**Original goal:** One daemon per storage root owns Kuzu; CLI and MCP use TCP + NDJSON (same protocol as stdio `graph-worker`).

**Out of scope for v1:** Auth/TLS, multi-machine, Unix-socket-only transport.

---

## Prerequisites (historical)

- Port policy: **OS-assigned port** + **`worker.port`** file (recommended); optional fixed **`SYSMLEGRAPH_WORKER_PORT`**.
- **Strict mode:** **`SYSMLEGRAPH_WORKER_STRICT=1`** when daemon expected but unreachable.

---

## Completed sections

| § | Topic | Delivered (indicative paths) |
|---|--------|------------------------------|
| **1** | Shared **`dispatch()`** | `src/worker/dispatch.ts`; `graph-worker.ts` imports it |
| **2** | TCP daemon | `src/worker/daemon.ts`; **`worker.lock`**, **`worker.port`**, serialized dispatch |
| **3** | Socket client | `src/worker/socket-client.ts`; URL + port file; reconnect unless strict |
| **4** | Gateway | `src/worker/gateway.ts`; long-lived → stdio worker → in-process |
| **5** | MCP → gateway | `src/mcp/server.ts` tools/resources via gateway |
| **6** | CLI `worker` | `bin/cli.ts`, `src/cli/worker-commands.ts`; **`--detach`** (not legacy `--daemon` name) |
| **7** | Scripts | `graph export` / `graph map` via CLI + gateway; **`index-and-query.mjs`** via gateway; thin `*.mjs` wrappers |
| **8** | Serialization | Daemon **`runSerialized`** around **`dispatch()`** |
| **9** | Tests & docs | `test/integration/*.e2e.test.ts`, **INSTALL**, **README**, **MCP_INTERACTION_GUIDE** §6.1; **PLAN.md** Phase 5 |

---

## Original task detail (archive)

The numbered sections **1–11** in git history contained per-task tables (dispatch extract, daemon bind, socket client, gateway routing, MCP wiring, CLI worker commands, scripts, serialization, tests). All **v1** items above are **done**. For line-by-line task text, see an older revision of this file if needed.

---

## Definition of done (v1) — all satisfied

- [x] Daemon binds localhost, writes **`worker.port`**, holds **`worker.lock`**; clean stop removes artifacts.
- [x] CLI graph ops use gateway (socket when configured).
- [x] MCP tools use gateway.
- [x] **`sysmledgraph worker start|stop|status`** (Windows + documented Unix).
- [x] Docs + Phase 5 in **PLAN.md**; design doc refreshed (**DESIGN** As-built + **WORKER_CONTRACT**).
- [x] Default with no daemon / no URL: in-process unchanged.

---

## Follow-ups (not v1 blockers)

- **Linux CI:** ✅ matrix **`windows-latest`** + **`ubuntu-latest`** in **`.github/workflows/ci.yml`**.
- **npm publish:** **`package.json` `files`** lists **`lsp/`** by path (**`package.json`**, **`package-lock.json`**, **`README.md`**, **`test-server.mjs`**) so **`lsp/node_modules`** is never packed; consumers use **`npm run setup-lsp`**.
- Indexer **two-phase edges** / optional **REFERENCES:** ✅ all symbol nodes then edges (**`applyIndexedBatches`**); **`SYSMLEGRAPH_INDEX_REFERENCES=1`** → MCP **`getReferences`** pass (**`reference-pass.ts`**).
- Design doc **§8.2 StrictError** state (diagram-only refinement).
