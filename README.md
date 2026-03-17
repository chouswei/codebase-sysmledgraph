# sysmledgraph

Path-only SysML indexer: builds a knowledge graph from `.sysml` files and exposes it via **MCP** (query, context, impact, rename, cypher, list, clean) and **CLI** (analyze, list, clean). Follows the [GitNexus](https://github.com/abhigyanpatwari/GitNexus) pattern (Kuzu graph, MCP tools) but indexes SysML only; grouping is SysML-native.

**Design and plan:** SysML v2 model and development plan live in a separate repo (`sysml-v2-models/projects/sysmledgraph`). This repo is the implementation.

## Requirements

- **Node.js 20+** (see `.nvmrc`)

## Libraries

| Library | Purpose |
|--------|--------|
| **[Kuzu](https://kuzudb.com/)** (`kuzu`) | Embedded property graph database; Cypher queries; stores SysML nodes and edges. |
| **[@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk)** | MCP server (stdio), tool and resource registration; used for the sysmledgraph MCP server. |
| **[Commander](https://github.com/tj/commander.js)** (`commander`) | CLI subcommands: `analyze`, `list`, `clean`. |
| **[fast-glob](https://github.com/mrmlnc/fast-glob)** | File discovery: find all `.sysml` / `.kerml` under path(s). |
| **[Zod](https://github.com/colinhacks/zod)** | Schema validation for MCP tool parameters. |
| **[sysml-v2-lsp](https://github.com/daltskin/sysml-v2-lsp)** | SysML v2 parser via LSP stdio; **required** for indexing. Provides document symbols (Package, PartDef, PartUsage, etc.) and IN_DOCUMENT / IN_PACKAGE edges. |

**sysml-v2-lsp (required)**  
After `npm install`, build the LSP once:  
`cd node_modules/sysml-v2-lsp && npm run build`  
Or set **SYSMLLSP_SERVER_PATH** to your built `dist/server/server.js`. Indexing will fail with a clear error if the LSP is not found.

*Dev:* TypeScript, Vitest, @types/node.

## Install

```bash
npm install
npm run build
```

**If install fails or is slow:** The dependency set is large (Kuzu, sysml-v2-lsp, etc.), so install can take 1–2+ minutes. On **Windows**, the LSP’s postinstall script is Unix-only and may cause install to fail; use `npm install --ignore-scripts` then `npm run build`. You can then point to a pre-built LSP with **SYSMLLSP_SERVER_PATH**. See [docs/INSTALL_NOTES.md](docs/INSTALL_NOTES.md) for why it’s slow and full workarounds (Kuzu cleanup warnings, using an external LSP when the bundled one has no grammar).

## Usage

### CLI

Run from the project root (after `npm run build`) or via `npx sysmledgraph` if linked/published.

| Command | Description |
|--------|-------------|
| **analyze** `<paths...>` | Index one or more directory trees: discover `.sysml` and `.kerml`, parse via LSP, build the graph. Paths are resolved to absolute and stored in the registry. |
| **list** | Print all indexed root paths (from the registry). |
| **clean** `[path]` | Remove the index for a given path, or for **all** indexed paths if `path` is omitted. Deletes the DB file and registry entry. |

**Examples:**

```bash
# Index a single model directory
npx sysmledgraph analyze ./path/to/sysml-models

# Index multiple roots (each gets its own DB)
npx sysmledgraph analyze ./repo1/models ./repo2/models

# See what is indexed
npx sysmledgraph list

# Remove index for one path
npx sysmledgraph clean ./path/to/sysml-models

# Remove all indexed paths
npx sysmledgraph clean
```

**Options and environment:**

- **`--storage <path>`** — Override the storage root (default: `~/.sysmledgraph`). Same as env **`SYSMEDGRAPH_STORAGE_ROOT`**.
- **`SYSMLLSP_SERVER_PATH`** — Optional. Path to the sysml-v2-lsp server JS (e.g. `dist/server/server.js`). If unset, the CLI looks in the current workspace/repo first (walk up from cwd), then in sysmledgraph’s `node_modules`.

**Storage layout:** Under the storage root: `registry.json` (list of indexed paths), and `db/<sanitized-path>.kuzu` (one Kuzu database per indexed path). On failure, the CLI writes errors to stderr and exits non-zero.

**Kuzu lock:** Only one process should open the same DB at a time. For a full CLI reindex, close Cursor (or disable the sysmledgraph MCP) first to avoid “Could not set lock on file”. See [docs/MCP-AND-KUZU.md](docs/MCP-AND-KUZU.md).

---

### MCP

Server name: **sysmledgraph**. The MCP server uses the same storage root as the CLI (default `~/.sysmledgraph`), so tools operate on whatever paths you indexed via the CLI or via the **indexDbGraph** tool.

**Setup (Cursor):** Add to `.cursor/mcp.json` or Cursor MCP settings.

**Option A — local build:**

```json
{
  "mcpServers": {
    "sysmledgraph": {
      "command": "node",
      "args": ["C:/path/to/codebase-sysmledgraph/dist/mcp/index.js"],
      "env": {
        "SYSMEDGRAPH_STORAGE_ROOT": "C:/Users/you/.sysmledgraph",
        "SYSMLLSP_SERVER_PATH": "C:/path/to/sysml-v2-lsp/dist/server/server.js"
      }
    }
  }
}
```

**Option B — npx (when published):**

```json
{
  "mcpServers": {
    "sysmledgraph": {
      "command": "npx",
      "args": ["-y", "sysmledgraph-mcp"]
    }
  }
}
```

**Tools:**

| Tool | Parameters | Description |
|------|------------|-------------|
| **indexDbGraph** | `path` (string) or `paths` (string[]) | Build the graph for the given path(s). Same logic as CLI `analyze`. Uses first indexed path if none given (no-op). |
| **list_indexed** | — | Return the list of indexed root paths (same as CLI `list`). |
| **clean_index** | `path` (string, optional) | Remove index for one path or all (same as CLI `clean`). |
| **cypher** | `query` (string) | Run a Cypher query on the graph for the **first** indexed path. Example: `MATCH (n:Node) RETURN n.id, n.label LIMIT 10`. |
| **query** | `query` (string), `kind` (string, optional) | Concept search over node names/labels. Filters by node label if `kind` is set. |
| **context** | `name` (string) | Get one node by id or name and its adjacent edges (types and targets). |
| **impact** | `target` (string), `direction` (`"upstream"` \| `"downstream"`, optional) | List nodes that depend on `target` (upstream) or that `target` depends on (downstream). |
| **rename** | `symbol` (string), `newName` (string), `dry_run` (boolean, optional) | Preview or perform a rename of a symbol across the graph. |

**Resources:**

- **sysmledgraph://context** — Index stats and list of indexed paths (Markdown).
- **sysmledgraph://schema** — Graph node and edge schema (Markdown).

Tools that need a graph (cypher, query, context, impact) use the **first** entry in the registry as the target DB. Ensure at least one path is indexed (CLI or indexDbGraph) before calling them.

---

### Querying the graph (scripts)

For ad-hoc Cypher or exporting the graph without MCP:

- **Run one Cypher query** (uses first indexed path, outputs JSON):

  ```bash
  node scripts/query-one.mjs "MATCH (n:Node) RETURN count(n) AS total"
  node scripts/query-one.mjs "MATCH (n:Node) RETURN n.label, count(*) AS c ORDER BY c DESC LIMIT 5"
  ```

  The graph uses a single node table **Node**; always use the label in Cypher: `MATCH (n:Node) ...`.

- **Export graph for viewing:** Run `npm run export-graph` (writes `graph-export.json` in the current directory). Open `viewer/view.html` in a browser, click “Load graph.json”, and select that file for a force-directed view; click a node for details. Custom output path: `node scripts/export-graph.mjs path/to/out.json`.

## Project layout

- `src/` — Core: indexer, graph, mcp, cli, discovery, parser, symbol-to-graph, storage.
- `bin/cli.ts` — CLI entrypoint.
- `mcp/index.ts` — MCP server entrypoint (stdio).
- `test/` — Unit and integration tests.
- `docs/` — [INSTALL_NOTES.md](docs/INSTALL_NOTES.md) (slow install, Windows), [MCP-AND-KUZU.md](docs/MCP-AND-KUZU.md) (two MCPs, Kuzu lock, LSP path), [grammar-and-mapping.md](docs/grammar-and-mapping.md).

## Development

- `npm run build` — Compile TypeScript.
- `npm run test` — Run tests.
- `npm run test:watch` — Watch mode.

## View the graph

See **Usage → Querying the graph (scripts)** for the full flow. Short version: `npm run export-graph` writes `graph-export.json`; open `viewer/view.html` in a browser and load that file for a force-directed graph (click nodes for id/label/path).

## Schema (graph)

Implemented with **Kuzu**: one `Node` table (id, name, path, label) and one rel table per edge type (Node→Node). Label values: Document, Package, PartDef, PartUsage, etc. Edge types: IN_DOCUMENT, IN_PACKAGE, PARENT, TYPES, REFERENCES, IMPORTS, SATISFY, DERIVE, VERIFY, BINDING, CONNECTION_END. See design doc (GITNEXUS_FEATURES.md) and deploy model.

## License

MIT
