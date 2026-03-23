# sysmledgraph

**Why:** When SysML v2 is the **single source of truth** for structure, connections, and requirements—especially in **AI-assisted (“vibe”) workflows**—you still need a way to treat the model like **navigable data**: “what uses this?”, “what’s connected?”, “give me context for the assistant.” This tool is that layer for **paths of `.sysml` files**, the same way [**GitNexus**](https://github.com/abhigyanpatwari/GitNexus) turns a **code** tree into a queryable graph for agents—here the **symbols and relations** come from the **SysML language server** (and optional MCP fallback), not from parsing C/JavaScript.

**What:** A **path-only indexer** that builds a **Kuzu** knowledge graph and exposes it through a **CLI** and an **MCP server** (e.g. Cursor): index, query, context, impact, Cypher, map generation, and more. Intended as the **graph tool for a SysML Modelbase** (where you index); a **second workspace (codebase)** can **subscribe** to the **same DB** via the **long-lived TCP worker** and shared **`SYSMEDGRAPH_STORAGE_ROOT`**—see [docs/PLAN.md](docs/PLAN.md) (product positioning, Phase 7). A **long-lived TCP worker** (localhost) avoids Kuzu file-lock fights between processes. Indexing uses **`lsp/`** (or **`SYSMLLSP_SERVER_PATH`**) to resolve symbols; see [Install](#install).

- **npm:** [sysmledgraph](https://www.npmjs.com/package/sysmledgraph) — `npm install sysmledgraph`
- **Repo:** [github.com/chouswei/codebase-sysmledgraph](https://github.com/chouswei/codebase-sysmledgraph)
- **Background:** [Integrating SysML as the single source of truth in vibe-coding](https://www.linkedin.com/pulse/integrating-sysml-single-source-truth-vibe-coding-szu-wei-chou-owhtc/) (LinkedIn article)

## Contents

- [Version](#version)
- [Requirements](#requirements)
- [Install](#install)
- [Quick start](#quick-start)
- [Usage](#usage)
  - [Environment variables](#environment-variables)
  - [CLI (`sysmledgraph`)](#cli-sysmledgraph)
  - [MCP binary (`sysmledgraph-mcp`)](#mcp-binary-sysmledgraph-mcp)
  - [npm scripts](#npm-scripts-repository--packagejson)
  - [Node scripts in `scripts/`](#node-scripts-in-scripts-after-npm-run-build-where-noted)
- [MCP tools and resources](#mcp-tools-and-resources)
- [Documentation](#documentation)
- [Continuous integration](#continuous-integration)
- [Publishing (npm)](#publishing-npm)
- [License](#license)

## Version

- **Current package version:** **0.8.2** — bump this line when you release; [`package.json`](package.json) `"version"` is what npm publishes.
- **Policy:** [Semantic versioning](https://semver.org/) — **MAJOR** / **MINOR** / **PATCH** as usual. CLI and MCP tool names and shapes are treated as stable within a major line unless release notes say otherwise.

To ship: follow [docs/PUBLISH.md](docs/PUBLISH.md) (version, notes, `npm run build` / `test` / `test:daemon`, `npm publish`) — summary in [Publishing (npm)](#publishing-npm).

## Requirements

- **Node.js** — **20+** (`package.json` `"engines"`: `>=20`).
- **Kuzu** — Native addon built during `npm install`, or run `node node_modules/kuzu/install.js` if you used `--ignore-scripts`.
- **LSP** — [sysml-v2-lsp](https://www.npmjs.com/package/sysml-v2-lsp) for indexing, normally installed under **`lsp/`** via `npm run setup-lsp`.

## Install

**From npm (CLI + MCP):**

```bash
npm install sysmledgraph
cd node_modules/sysmledgraph && npm run setup-lsp
```

**From source:**

```bash
git clone https://github.com/chouswei/codebase-sysmledgraph.git && cd codebase-sysmledgraph
npm install
npm run build
npm run setup-lsp
```

After **setup-lsp**, you usually do **not** need **`SYSMLLSP_SERVER_PATH`**. Details: [docs/INSTALL.md](docs/INSTALL.md), [docs/PLAN_INDEPENDENT_LSP.md](docs/PLAN_INDEPENDENT_LSP.md).

## Quick start

From a **clone** (after install + build + setup-lsp):

```bash
npx sysmledgraph analyze test/fixtures/sysml
npx sysmledgraph graph map graph-map.md
```

Or one step from repo root: `npm run index-and-map` (optional path argument).

## Usage

### Environment variables

| Variable | Purpose |
|----------|---------|
| **`SYSMEDGRAPH_STORAGE_ROOT`** | Graph storage directory (default `~/.sysmledgraph`). Merged DB: `<root>/db/graph.kuzu`. |
| **`SYSMLEGRAPH_WORKER_URL`** | Long-lived worker endpoint, e.g. `127.0.0.1:PORT` (overrides reading `worker.port` from storage root). |
| **`SYSMLEGRAPH_WORKER_STRICT`** | Set to **`1`** so graph clients **fail** if the TCP worker is unreachable (no silent in-process fallback). |
| **`SYSMLEGRAPH_SUBSCRIBER`** | Set to **`1`** in a **Subscriber** (codebase) MCP config so **`indexDbGraph`** / **`clean_index`** are **not registered** (Publisher still indexes). Does **not** enforce a single daemon—see **`worker.lock`** / **INSTALL.md**. |
| **`SYSMLEGRAPH_WORKER_PORT`** | Daemon bind port; **`0`** = OS-assigned (default when unset). Used when running `worker:daemon` / `daemon.js` directly. |
| **`SYSMLLSP_SERVER_PATH`** | Path to sysml-v2-lsp **`server.js`** if not using default `lsp/` or `node_modules` resolution. |
| **`SYSMEDGRAPH_USE_MCP_SYMBOLS`** | Set to **`1`** to fall back to MCP `getSymbols` when LSP returns no symbols (indexing). |
| **`SYSMLEGRAPH_INDEX_REFERENCES`** | Set to **`1`** to run an extra MCP **`getReferences`** pass after indexing and add **REFERENCES** edges (slow; needs **setup-lsp** / **sysml-v2-lsp**). See [docs/MCP_INTERACTION_GUIDE.md](docs/MCP_INTERACTION_GUIDE.md) §6. |
| **`SYSMLEDGRAPH_USE_WORKER`** | Set to **`1`** to use a **per-command** stdio graph worker instead of in-process Kuzu (short-lived child). |

### Global CLI option

| Option | Description |
|--------|-------------|
| `--storage <path>` | Same as **`SYSMEDGRAPH_STORAGE_ROOT`** for this invocation. |

Use it on **`worker`** and **`graph`** subcommands (and anywhere storage applies).

### CLI (`sysmledgraph`)

Use **`npx sysmledgraph`**, a global install, or **`node node_modules/sysmledgraph/dist/bin/cli.js`**.

| Command | Description |
|---------|-------------|
| `sysmledgraph analyze <paths...>` | Index path(s). **Default command** if you omit the subcommand name. |
| `sysmledgraph list` | Print indexed root paths. |
| `sysmledgraph clean [path]` | Drop one path from the index, or all paths if omitted. |
| `sysmledgraph worker start [--detach]` | TCP daemon; writes **`worker.port`** + PID under the storage root. |
| `sysmledgraph worker stop` | Shutdown RPC + cleanup; removes **`worker.port`**. |
| `sysmledgraph worker status` | Exit **0** if TCP responds; **1** if not (stderr notes stale **`worker.port`** when applicable). |
| `sysmledgraph graph export [file]` | JSON export (default **`graph-export.json`** in cwd). |
| `sysmledgraph graph map [file]` | Markdown map (default **`graph-map.md`** in cwd). |

**`worker start` exit codes:** **0** started · **2** already running (TCP up) · **1** other failure (e.g. not built, stale port + live PID). **`worker stop`:** **1** if no **`worker.port`**. **`worker status`:** **1** when not running.

**Examples:** `npx sysmledgraph analyze ./models` · `npx sysmledgraph --storage D:\store list` · `npx sysmledgraph worker start --detach`

**Help:** `sysmledgraph --help` · `sysmledgraph worker --help` · `sysmledgraph graph --help`

If **`worker.port`** exists or **`SYSMLEGRAPH_WORKER_URL`** is set, the CLI uses the **long-lived worker** and avoids opening Kuzu in-process. See [docs/INSTALL.md](docs/INSTALL.md).

### MCP binary (`sysmledgraph-mcp`)

| Command | Description |
|---------|-------------|
| `npx sysmledgraph-mcp` | MCP server on **stdio** (Cursor, etc.). |
| `npm run mcp` | Same from a clone (**requires** `npm run build`). |

### npm scripts (repository / package.json)

| Script | Command | Description |
|--------|---------|-------------|
| `build` | `tsc` | Compile → **`dist/`**. |
| `clean` | `node scripts/clean.mjs` | Clean artifacts (see script). |
| `test` | `vitest run` | Default unit/integration tests. |
| `test:daemon` | `vitest run --config vitest.e2e.config.ts` | Long-lived worker E2E. |
| `test:watch` | `vitest` | Watch mode. |
| `worker:daemon` | `node dist/src/worker/daemon.js` | Run daemon only (**after** `build`). |
| `analyze` | `node dist/bin/cli.js analyze` | Shortcut. |
| `export-graph` | `node dist/bin/cli.js graph export` | Shortcut. |
| `generate-map` | `node dist/bin/cli.js graph map` | Shortcut. |
| `index-and-map` | `node scripts/index-and-map.mjs` | Index then **`graph-map.md`**. |
| `deploy-skills` | `node scripts/deploy-skills.mjs` | Maintainer: deploy Cursor skills. |
| `mcp` | `node dist/mcp/index.js` | MCP stdio server. |
| `check:sysml-lsp` | `node scripts/check-sysml-v2-lsp-version.mjs` | Version alignment check. |
| `setup-lsp` | `node scripts/setup-lsp.mjs` | Install LSP under **`lsp/`**. |
| `prepublishOnly` | `npm run build` | Runs before **`npm publish`**. |

**Args through npm:** `npm run generate-map -- custom.md` · `npm run export-graph -- out.json`

### Node scripts in `scripts/` (after `npm run build` where noted)

| Script | Purpose |
|--------|---------|
| `node scripts/index-and-map.mjs [path]` | Index (default **`test/fixtures/sysml`**), then map → **`graph-map.md`**. |
| `node scripts/index-and-query.mjs <path>` | Index one path, then node count via gateway (**merged** **`graph.kuzu`**). |
| `node scripts/export-graph.mjs` | Delegates to CLI **`graph export`**. |
| `node scripts/generate-map.mjs` | Delegates to CLI **`graph map`**. |
| `node scripts/validate-sysml-file.mjs <file.sysml>` | Validate via MCP; exit **0** / **1**. |
| `node scripts/setup-lsp.mjs` | Same as **`npm run setup-lsp`**. |
| `node scripts/clean.mjs` | Clean helper. |
| `node scripts/check-sysml-v2-lsp-version.mjs` | LSP version check. |
| `node scripts/deploy-skills.mjs` | Skills deploy. |
| **Dev / debug** | `access-sysml-mcp.mjs`, `example-sysml-mcp.mjs`, `debug-lsp-symbols.mjs`, `debug-index.mjs`, `compare-mcp-vs-lsp-symbols.mjs`, `query-one.mjs`, `test-lsp.mjs`, `test-mcp-*.mjs`, `test-sysml-mcp-from-node_modules.mjs` — see headers in each file. |

## MCP tools and resources

Configure **sysmledgraph** in **`.cursor/mcp.json`** (see [docs/MCP_SERVER_FOR_CURSOR.md](docs/MCP_SERVER_FOR_CURSOR.md)).

**Tools:** `indexDbGraph`, `list_indexed`, `clean_index`, `cypher`, `query`, `context`, `impact`, `rename`, `generate_map`.

**Resources:** `sysmledgraph://context`, `sysmledgraph://schema`, plus per-indexed-path **`sysmledgraph://context/...`** and **`sysmledgraph://schema/...`**.

**Kuzu lock:** Prefer one mode per storage root — e.g. run **`sysmledgraph worker start --detach`** and share **`SYSMEDGRAPH_STORAGE_ROOT`** with MCP, or see [docs/MCP_INTERACTION_GUIDE.md](docs/MCP_INTERACTION_GUIDE.md) §6.1 and §8.

## Documentation

| Doc | Content |
|-----|---------|
| [docs/INSTALL.md](docs/INSTALL.md) | Install, LSP, Kuzu, worker |
| [docs/MCP_SERVER_FOR_CURSOR.md](docs/MCP_SERVER_FOR_CURSOR.md) | Cursor MCP config, tools |
| [docs/MCP_INTERACTION_GUIDE.md](docs/MCP_INTERACTION_GUIDE.md) | LSP vs MCP, indexing, troubleshooting |
| [docs/PLAN.md](docs/PLAN.md) | Roadmap and status |
| [docs/PUBLISH.md](docs/PUBLISH.md) | npm publish checklist (maintainers) |
| [docs/PLAN_IMPLEMENT_LONG_LIVED_WORKER.md](docs/PLAN_IMPLEMENT_LONG_LIVED_WORKER.md) | Worker implementation log (v1 shipped) |
| [docs/DESIGN_LONG_LIVED_WORKER.md](docs/DESIGN_LONG_LIVED_WORKER.md) | Worker design, errors, exit semantics |
| [docs/WORKER_CONTRACT.md](docs/WORKER_CONTRACT.md) | Worker NDJSON contract, files, CLI (operator summary) |
| [docs/PLAN_INDEPENDENT_LSP.md](docs/PLAN_INDEPENDENT_LSP.md) | Why **`lsp/`** exists |
| [docs/TOOLS.md](docs/TOOLS.md) | Tool-oriented notes |
| [lsp/README.md](lsp/README.md) | LSP folder layout |

## Continuous integration

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs **`npm ci`**, **`npm run build`**, **`npm test`**, and **`npm run test:daemon`** on **windows-latest** and **ubuntu-latest** (Node 20).

## Publishing (npm)

Others can install with **`npm install sysmledgraph`** or run **`npx sysmledgraph analyze <path>`**.

1. **Name:** **`sysmledgraph`** in `package.json` (or a scoped name if needed).
2. **Build:** **`prepublishOnly`** runs **`npm run build`** so **`dist/`** ships in the tarball.
3. **Files:** **`package.json`** **`files`** lists **`dist`**, **`scripts`**, explicit **`lsp/`** files (**`package.json`**, **`package-lock.json`**, **`README.md`**, **`test-server.mjs`** — not the whole folder, so **`lsp/node_modules`** is never packed), **`README.md`**, **`docs`**. Consumers run **`npm run setup-lsp`** inside the package to install **sysml-v2-lsp** under **`lsp/`**.
4. **Publish:**
   ```bash
   npm login
   npm publish
   ```
   Scoped packages: **`npm publish --access public`** the first time.

**Consumer LSP resolution:** **`npx sysmledgraph`** from another project resolves LSP paths from **that project’s cwd** (`lsp/` or **`node_modules/sysml-v2-lsp`**). Either run **setup-lsp** inside the installed package and set **`SYSMLLSP_SERVER_PATH`**, or add **sysml-v2-lsp** to the consumer project.

## License

MIT
