# Release notes – v0.8.0

**Release date:** 2026-03-19

## Summary

Long-lived **TCP graph worker** (daemon), **gateway** routing for CLI and MCP, worker **CLI** commands, **CI**, README/docs refresh, and LSP update guidance in **INSTALL**.

## Features

- **Worker:** `sysmledgraph worker start [--detach] | stop | status`; TCP NDJSON daemon (`src/worker/daemon.ts`) with serialized dispatch, **`worker.port`** + **`worker.lock`**, shutdown RPC and signals.
- **Gateway:** `src/worker/gateway.ts` — long-lived TCP → optional stdio worker → in-process; MCP and graph artifacts use it when `worker.port` or **`SYSMLEGRAPH_WORKER_URL`** is set.
- **Socket client:** `ensureLongLivedClient` / `requestLongLived` with optional reconnect when not **`SYSMLEGRAPH_WORKER_STRICT=1`**.

## CLI & scripts

- **`graph export`** / **`graph map`**; npm **`export-graph`** / **`generate-map`** delegate to CLI (gateway-aware).
- **`scripts/index-and-query.mjs`** uses gateway + merged **`graph.kuzu`** and **`SYSMEDGRAPH_STORAGE_ROOT`**.
- Worker **exit codes:** `worker start` **2** if already running; stale **`worker.port`** + live PID handling; **`worker status`** reports stale port file.

## Tests & CI

- **`npm run test:daemon`** — Vitest e2e (`vitest.e2e.config.ts`), worker + concurrent RPC smoke; **`fileParallelism: false`** for global storage root.
- **`.github/workflows/ci.yml`** — Windows, Node 20: `npm ci`, `build`, `test`, `test:daemon`.

## Docs

- **README:** Versioning, env vars, full command tables, MCP tools/resources, CI link.
- **docs/INSTALL.md:** Updating **sysml-v2-lsp**; editor highlighting vs language server.
- **docs/MCP_INTERACTION_GUIDE.md**, **docs/PLAN.md**, **docs/DESIGN_LONG_LIVED_WORKER.md**, **PLAN_IMPLEMENT_LONG_LIVED_WORKER.md** — worker alignment.

## Security / repo hygiene

- **`.npmrc`** removed from version control (belongs in `.gitignore` only). If it was ever pushed with a token, **rotate** that npm token at [npmjs.com](https://www.npmjs.com/).

## Upgrade

```bash
npm install sysmledgraph@0.8.0
cd node_modules/sysmledgraph && npm run setup-lsp
npm run build   # from source clone
```

Optional: **`sysmledgraph worker start --detach`** with shared **`SYSMEDGRAPH_STORAGE_ROOT`** for CLI + MCP without Kuzu lock conflicts.
