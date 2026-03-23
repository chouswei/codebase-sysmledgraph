# Install

## Quick start

1. **Root:** `npm install` then `npm run build`.
2. **LSP (for indexing):** The canonical LSP for this repo is in **`lsp/`**. Run **`npm run setup-lsp`** (or `cd lsp && npm install`) so the indexer can use it. No need to set **`SYSMLLSP_SERVER_PATH`** when using this default.
3. **Index:** `npx sysmledgraph analyze <path>` or use the MCP tool **indexDbGraph** after enabling the sysmledgraph MCP in Cursor (see docs/MCP_SERVER_FOR_CURSOR.md).

## LSP

- **Source:** [sysml-v2-lsp](https://www.npmjs.com/package/sysml-v2-lsp) (npm). The only copy used by sysmledgraph for indexing is in **`lsp/`** (see docs/PLAN_INDEPENDENT_LSP.md).
- **Setup:** `npm run setup-lsp` installs it in `lsp/` with `--ignore-scripts` (recommended on Windows). If you prefer a manual install: `cd lsp && npm install`.

### Updating language support (“grammar” via the server)

**sysmledgraph does not ship SysML grammar or a parser** — indexing and symbols come from the **`sysml-v2-lsp`** package.

1. **Bump the version** in **`lsp/package.json`** (`dependencies.sysml-v2-lsp`, e.g. `^0.8.0` when published).
2. **Reinstall in `lsp/`:**  
   `cd lsp && rm -rf node_modules package-lock.json` (optional, for a clean pull) then **`npm install`**.  
   Or from repo root: **`npm run setup-lsp`** (skips if the server file already exists — delete `lsp/node_modules` first if you need a forced refresh).
3. **Align the repo root** (optional but recommended): update **`sysml-v2-lsp`** in root **`package.json`** `devDependencies` to the same range so scripts and **`npm run check:sysml-lsp`** stay consistent, then **`npm install`** at root.
4. **Verify:** `node scripts/check-sysml-v2-lsp-version.mjs` and a smoke index, e.g. **`npx sysmledgraph analyze test/fixtures/sysml`** or **`node scripts/debug-lsp-symbols.mjs`** on a `.sysml` file.
5. If you pinned **`SYSMLLSP_SERVER_PATH`**, ensure it still points at **`lsp/node_modules/sysml-v2-lsp/dist/server/server.js`** (or clear the env to use defaults).

### Editor syntax highlighting (separate from this repo)

**Coloring / TextMate “grammar”** in Cursor or VS Code usually comes from a **SysML or SysML v2 extension** in the marketplace, not from sysmledgraph. To change that: install or update the relevant extension, or adjust **`files.associations`** / theme settings in the editor — see the extension’s docs.

## Kuzu

If `npm install` fails or you use `--ignore-scripts`, build Kuzu manually: `node node_modules/kuzu/install.js`. See docs/INSTALL_NOTES.md if present.

## Long-lived graph worker (optional)

To avoid **Kuzu file-lock** conflicts when using the **CLI** and **MCP server** at the same time on the same storage root, run a single TCP worker that owns the database:

1. **Start:** `npx sysmledgraph worker start --detach` (background) or `npx sysmledgraph worker start` (foreground). Writes **`worker.port`** under your storage root (default `~/.sysmledgraph`).
2. **Same storage:** Point CLI (`--storage` / `SYSMEDGRAPH_STORAGE_ROOT`) and the MCP server env at the **same** root. With `worker.port` present (or **`SYSMLEGRAPH_WORKER_URL`** e.g. `http://127.0.0.1:9123`), CLI and MCP talk to the worker over **localhost TCP** instead of opening Kuzu in-process.
3. **Stop:** `npx sysmledgraph worker stop` — graceful shutdown via TCP, then removes `worker.port`.
4. **Status:** `npx sysmledgraph worker status` — exit `0` if the port responds.
5. **Strict:** If the worker is configured but unreachable, set **`SYSMLEGRAPH_WORKER_STRICT=1`** to fail instead of falling back to in-process (avoids accidental mixed mode). See **docs/DESIGN_LONG_LIVED_WORKER.md**.

Optional port: **`SYSMLEGRAPH_WORKER_PORT`** (e.g. `9192`); default is an OS-assigned port written to `worker.port`.

E2E smoke (subprocess daemon): `npm run test:daemon` (uses `vitest.e2e.config.ts`; not part of default `npm test`).

**Export / map (worker-aware):** `npx sysmledgraph graph export [file]` and `npx sysmledgraph graph map [file]` use the same gateway as MCP (TCP worker when configured). `npm run export-graph` / `npm run generate-map` call those CLI commands.
