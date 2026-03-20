# sysmledgraph

Path-only SysML indexer: builds a knowledge graph from `.sysml` files and exposes it via **MCP** (for Cursor AI) and **CLI**. The LSP used for indexing lives in **`lsp/`** and is used only by this repo.

## Requirements

- **Node.js 20+**
- **Kuzu** (built via `npm install` or `node node_modules/kuzu/install.js` if you use `--ignore-scripts`)
- **LSP** for indexing: [sysml-v2-lsp](https://www.npmjs.com/package/sysml-v2-lsp), installed in **`lsp/`** (see below)

## Install

```bash
npm install
npm run build
npm run setup-lsp
```

- **setup-lsp** installs the SysML LSP in **`lsp/`** so the indexer can use it. No need to set `SYSMLLSP_SERVER_PATH` when using this default. See [docs/INSTALL.md](docs/INSTALL.md) and [docs/PLAN_INDEPENDENT_LSP.md](docs/PLAN_INDEPENDENT_LSP.md).

## Usage

### CLI

| Command | Description |
|--------|-------------|
| `npx sysmledgraph analyze <path>` | Index path(s); discover `.sysml`, build graph (uses LSP in `lsp/` by default) |
| `npx sysmledgraph list` | List indexed root paths |
| `npx sysmledgraph clean [path]` | Remove index for path or all |

**Scripts (from repo root):**

- `npm run index-and-map [path]` — Index path (default `test/fixtures/sysml`), then write **graph-map.md**
- `npm run generate-map [out.md]` — Generate map from existing DB
- `npm run setup-lsp` — Install LSP in `lsp/` (Option C, see plan)

### MCP (Cursor)

This repo runs as an **MCP server** so Cursor AI can query the graph (query, context, impact, generate_map, indexDbGraph, cypher, etc.). Add **sysmledgraph** to `.cursor/mcp.json`; see [docs/MCP_SERVER_FOR_CURSOR.md](docs/MCP_SERVER_FOR_CURSOR.md).

**Storage:** Default `~/.sysmledgraph`. Override with `SYSMEDGRAPH_STORAGE_ROOT`. Only one process should open the same DB at a time (see [docs/MCP_INTERACTION_GUIDE.md](docs/MCP_INTERACTION_GUIDE.md) §8).

## Docs

| Doc | Content |
|-----|--------|
| [docs/INSTALL.md](docs/INSTALL.md) | Install steps, LSP, Kuzu |
| [docs/MCP_SERVER_FOR_CURSOR.md](docs/MCP_SERVER_FOR_CURSOR.md) | Enable sysmledgraph MCP in Cursor, tools, checklist |
| [docs/MCP_INTERACTION_GUIDE.md](docs/MCP_INTERACTION_GUIDE.md) | LSP vs MCP, indexing, troubleshooting |
| [docs/PLAN_INDEPENDENT_LSP.md](docs/PLAN_INDEPENDENT_LSP.md) | Why LSP is in `lsp/` only for sysmledgraph |
| [lsp/README.md](lsp/README.md) | LSP folder setup and cwd |

## Publishing (npm)

You can publish this package to npm so others can install it with `npm install sysmledgraph` or `npx sysmledgraph analyze <path>`.

1. **Name:** The package name is **`sysmledgraph`**. If it is already taken, use a scoped name (e.g. `@yourusername/sysmledgraph`) and set it in `package.json` `"name"`.
2. **Build:** `prepublishOnly` runs `npm run build` before packing, so **dist/** is included in the tarball.
3. **Included files:** Only **dist**, **scripts**, **lsp**, **README.md**, and **docs** are published (see `package.json` `"files"`). Users run **`npm run setup-lsp`** after install to install the LSP in **lsp/**.
4. **Publish:** From a clean build, run:
   ```bash
   npm login
   npm publish
   ```
   For a scoped package (e.g. `@user/sysmledgraph`), use `npm publish --access public` the first time.

After publish, users can install with `npm install sysmledgraph`, then run **`npm run setup-lsp`** from the installed package directory (e.g. `cd node_modules/sysmledgraph && npm run setup-lsp`) so the LSP is available. When using **npx sysmledgraph** from another project, the default LSP path is resolved from the **current working directory** (that project’s `lsp/` or `node_modules/sysml-v2-lsp`). So either run setup-lsp inside the sysmledgraph package and set **SYSMLLSP_SERVER_PATH** to that `lsp/node_modules/.../server.js`, or install **sysml-v2-lsp** in the consumer project so the fallback finds it.

## License

MIT
