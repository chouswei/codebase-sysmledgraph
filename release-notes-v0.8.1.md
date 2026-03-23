# Release notes – v0.8.1

**Release date:** 2026-03-23

## Summary

Documentation wrap-up for the long-lived worker, **Linux + Windows CI**, and explicit **npm pack** rules so **`lsp/node_modules`** is never published by mistake.

## Documentation

- **`docs/WORKER_CONTRACT.md`** — Operator-facing NDJSON contract, env vars, CLI, links to design/install.
- **`docs/PLAN_IMPLEMENT_LONG_LIVED_WORKER.md`** — Reframed as **v1 implementation log** (not an open checklist).
- **`docs/PLAN.md`** — Phase 6 complete; CI bullet; **v0.8.1** in released line.
- **`docs/DESIGN_LONG_LIVED_WORKER.md`** — Link to **WORKER_CONTRACT** from As-built.
- **`README.md`** — Docs table includes **WORKER_CONTRACT**; CI describes **ubuntu-latest** + **windows-latest**.

## CI

- **`.github/workflows/ci.yml`** — Matrix **`windows-latest`** and **`ubuntu-latest`** (`fail-fast: false`): **`npm ci`**, **`build`**, **`test`**, **`test:daemon`**.

## Packaging

- **`package.json` `files`** — **`lsp/`** is no longer a directory glob; only **`lsp/package.json`**, **`lsp/package-lock.json`**, **`lsp/README.md`**, and **`lsp/test-server.mjs`** ship. Local **`lsp/node_modules`** (after **`setup-lsp`**) is never packed. Consumers still run **`npm run setup-lsp`** inside the installed package to install **sysml-v2-lsp** under **`lsp/`**. Typical **`npm pack`** size drops from ~**1 MB** (with accidental **`lsp/node_modules`**) to ~**120 kB** packed / ~**470 kB** unpacked (machine-dependent).

## MCP

- **`SERVER_VERSION`** in **`src/mcp/server.ts`** → **0.8.1**.

## Upgrade

```bash
npm install sysmledgraph@0.8.1
cd node_modules/sysmledgraph && npm run setup-lsp
npm run build   # from source clone
```

Long-lived worker usage unchanged from v0.8.0 — see **docs/INSTALL.md** and **docs/WORKER_CONTRACT.md**.

**Next:** [release-notes-v0.8.2.md](release-notes-v0.8.2.md) — two-phase indexer edges, optional **REFERENCES** pass, **DESIGN** §8.2 **Failed**, **docs/PUBLISH.md**.
