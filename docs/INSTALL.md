# Install

## Quick start

1. **Root:** `npm install` then `npm run build`.
2. **LSP (for indexing):** The canonical LSP for this repo is in **`lsp/`**. Run **`npm run setup-lsp`** (or `cd lsp && npm install`) so the indexer can use it. No need to set **`SYSMLLSP_SERVER_PATH`** when using this default.
3. **Index:** `npx sysmledgraph analyze <path>` or use the MCP tool **indexDbGraph** after enabling the sysmledgraph MCP in Cursor (see docs/MCP_SERVER_FOR_CURSOR.md).

## LSP

- **Source:** [sysml-v2-lsp](https://www.npmjs.com/package/sysml-v2-lsp) (npm). The only copy used by sysmledgraph for indexing is in **`lsp/`** (see docs/PLAN_INDEPENDENT_LSP.md).
- **Setup:** `npm run setup-lsp` installs it in `lsp/` with `--ignore-scripts` (recommended on Windows). If you prefer a manual install: `cd lsp && npm install`.

## Kuzu

If `npm install` fails or you use `--ignore-scripts`, build Kuzu manually: `node node_modules/kuzu/install.js`. See docs/INSTALL_NOTES.md if present.
