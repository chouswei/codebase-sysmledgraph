# MCP Server for Cursor AI

This repo works as an **MCP server** so Cursor (and other MCP clients) can use the SysML knowledge graph: query symbols, context, impact, generate map, index paths, and run Cypher.

## 1. What the server provides

- **Server name:** `sysmledgraph`
- **Transport:** stdio (Cursor spawns the process and talks over stdin/stdout)
- **Tools (Publisher default):** indexDbGraph, list_indexed, clean_index, cypher, query, context, impact, rename, generate_map  
  **Subscriber:** set **`SYSMLEGRAPH_SUBSCRIBER=1`** in MCP **`env`** so **indexDbGraph** and **clean_index** are **not** registered (see **docs/INSTALL.md** — single daemon is enforced by **worker.lock**, not by hiding tools).
- **Resources:** `sysmledgraph://context`, `sysmledgraph://schema` (and per-path variants when paths are indexed)

Cursor AI can call these tools when you ask about your SysML model (e.g. “what uses Modelbase?”, “show me the graph map”, “list symbols in the deploy model”).

## 2. Prerequisites

1. **Index at least one path** so the graph has data. Either:
   - **CLI:** `npx sysmledgraph analyze <path>` (e.g. `modelbase-development/models`), or
   - **MCP tool:** After the server is running in Cursor, use the **indexDbGraph** tool with the same path(s).
2. **Kuzu:** Built (e.g. `npm install` without `--ignore-scripts`). See docs/INSTALL_NOTES.md if needed.
3. **LSP:** For indexing, the LSP is in **`lsp/`**. Run **`npm run setup-lsp`** (or `cd lsp && npm install`) once; it is then picked automatically. No need to set **SYSMLLSP_SERVER_PATH** if the server isn’t in the default location (see docs/PLAN_INDEPENDENT_LSP.md).

## 3. Enable in Cursor

Add the sysmledgraph MCP server to Cursor’s MCP config.

**Option A — Project-local (this repo as workspace)**

Create or edit **`.cursor/mcp.json`** in the project root:

```json
{
  "mcpServers": {
    "sysmledgraph": {
      "command": "node",
      "args": ["dist/mcp/index.js"],
      "cwd": ".",
      "env": {
        "SYSMEDGRAPH_STORAGE_ROOT": "C:/Users/YOU/.sysmledgraph"
      }
    }
  }
}
```

- **cwd** must be the **workspace root** (where `dist/` and the indexed paths live). Use `"."` when opening this repo as the workspace.
- **SYSMEDGRAPH_STORAGE_ROOT:** Default is `~/.sysmledgraph`. Set to a custom path if you use one for the CLI.
- **SYSMLLSP_SERVER_PATH (optional):** Only if not using the default. When running from this repo, the LSP in **`lsp/`** is used automatically after **`npm run setup-lsp`**.

**Subscriber (codebase) — same graph as Modelbase:** Use the **same** **`SYSMEDGRAPH_STORAGE_ROOT`** as the Publisher, set **`SYSMLEGRAPH_WORKER_URL`** to the running daemon (see **`worker.port`**), and add **`SYSMLEGRAPH_SUBSCRIBER": "1"`** so the assistant does not see **indexDbGraph** / **clean_index**. Example **`env`** fragment:

```json
"env": {
  "SYSMEDGRAPH_STORAGE_ROOT": "C:/Users/YOU/.sysmledgraph",
  "SYSMLEGRAPH_WORKER_URL": "127.0.0.1:9123",
  "SYSMLEGRAPH_SUBSCRIBER": "1"
}
```

**Option B — Absolute path to built server**

If the built server lives elsewhere (e.g. a global tools folder):

```json
{
  "mcpServers": {
    "sysmledgraph": {
      "command": "node",
      "args": ["C:/path/to/sysmledgraph/dist/mcp/index.js"],
      "env": {
        "SYSMEDGRAPH_STORAGE_ROOT": "C:/Users/YOU/.sysmledgraph"
      }
    }
  }
}
```

**Option C — npx (when published)**

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

After saving, (re)start Cursor or reload MCP so it picks up the new server.

## 4. Tools Cursor AI can use

| Tool | Purpose |
|------|--------|
| **list_indexed** | List indexed root paths (so AI knows what’s in the graph). |
| **query** | Concept search over symbol names/labels; optional `kind` filter (e.g. PartDef, Package). |
| **context** | 360° view for one symbol: node + edges (IN_DOCUMENT, IN_PACKAGE, etc.). |
| **impact** | Blast radius: upstream (what references this) or downstream (what this references). |
| **generate_map** | Get Markdown of the graph (documents, nodes by label, interconnection edges). |
| **cypher** | Run a Cypher query on the graph (advanced). |
| **indexDbGraph** | Index path(s) (same as CLI analyze). Use when the graph is empty or you add a new folder. |
| **clean_index** | Remove index for one path or all. |
| **rename** | Preview or perform a symbol rename across the graph. |

For “show the map of this file” or “what depends on X”, the AI can call **generate_map** or **context** / **impact** after **list_indexed** to see what’s available.

## 5. Storage and LSP

- **Storage:** Same as CLI. Default `~/.sysmledgraph`; override with **SYSMEDGRAPH_STORAGE_ROOT**. The MCP server uses the same DB as `sysmledgraph analyze` and `scripts/generate-map.mjs`.
- **LSP:** Used by **indexDbGraph** and CLI analyze. The canonical LSP is in **`lsp/`**. Run **`npm run setup-lsp`** once; the indexer then uses it by default (no **SYSMLLSP_SERVER_PATH** needed). If unset and lsp/ not installed, indexing falls back to MCP getSymbols.

## 6. Kuzu lock

Only one process can open the same Kuzu DB at a time. If the sysmledgraph MCP is running in Cursor, it holds the DB open. To run **CLI** analyze or **scripts/export-graph.mjs** / **generate-map.mjs** without “Could not set lock on file”, either:

- Close Cursor (or disable the sysmledgraph MCP), run the CLI/script, then reopen Cursor, or  
- Use a **different** **SYSMEDGRAPH_STORAGE_ROOT** for the CLI run (e.g. a temp folder), then point the MCP at the same root if you want Cursor to see that data.

See **docs/MCP_INTERACTION_GUIDE.md** §8 Troubleshooting and **docs/MCP-AND-KUZU.md** (if present).

## 7. Checklist

1. `npm install` and `npm run build` in this repo.
2. Run **`npm run setup-lsp`** (or `cd lsp && npm install`) so the LSP used for indexing is installed in **`lsp/`**.
3. Index at least one path: `npx sysmledgraph analyze modelbase-development/models` (or use **indexDbGraph** after MCP is on).
4. Add **sysmledgraph** to `.cursor/mcp.json` with `command`/`args`/`cwd`/`env` as above.
5. Restart Cursor or reload MCP; confirm the server appears (e.g. in Cursor MCP settings).
6. In chat, ask e.g. “List indexed paths for sysmledgraph”, “Show the graph map”, “What is the context of Modelbase?” to confirm tools work.

## 8. Next (optional)

- **Prompts:** Add a Cursor rule or AGENTS.md note so the AI knows to use sysmledgraph tools for SysML/graph questions.
- **Resources:** Expose `sysmledgraph://context` or `sysmledgraph://schema` in Cursor so the AI can pull index stats and schema when relevant.
