# Two MCPs, Kuzu lock, and LSP path

## How the two MCPs relate

| | **sysmledgraph** | **sysml-v2** (e.g. SysML v2 MCP) |
|--|------------------|----------------------------------|
| **Role** | Path-based indexer: builds a Kuzu graph from `.sysml` paths | SysML LSP MCP: parse, validate, symbols, loadProject, impact, context, query, preview |
| **Uses LSP** | Spawns `server.js` (stdio) only when indexing | Runs `mcpServer.js` as the MCP server |
| **Uses Kuzu** | Yes (one DB per indexed path) | No |
| **Same package** | Same sysml-v2-lsp package, different entry points (`server.js` vs `mcpServer.js`) | Same |

So there is **no MCP-vs-MCP conflict**. The sysml-v2 MCP does not use Kuzu, so the two MCPs don’t contend over the database.

---

## Kuzu lock

**Only sysmledgraph uses Kuzu.** The “Could not set lock on file” (or similar) error happens when the **same DB file is opened more than once**:

- MCP has the DB open and you run the sysmledgraph **CLI** (e.g. `npx sysmledgraph analyze`), or  
- Two connections to the same DB in one process (we fixed that with a connection cache in the MCP).

**Fixes:**

- **Within one process:** The MCP uses a single cached connection per DB path (v0.2.0+), so repeated/concurrent tool calls don’t open the same file twice.  
- **Across processes:** Only one writer at a time. If you do a full re-index from the CLI, close Cursor (or stop the sysmledgraph MCP) first, or run the CLI when the MCP isn’t using that DB.

---

## “sysml-v2-lsp not found” / LSP path

That was **path resolution**: the sysmledgraph CLI (or MCP) was only looking in its own `node_modules` (e.g. `tools/sysmledgraph/node_modules/...`) and didn’t see the LSP at **repo root**.

**Fixes:**

- Resolver now also checks **repo root** (and parent directories) for `node_modules/sysml-v2-lsp/dist/server/server.js`, so when sysmledgraph runs from a subfolder (e.g. `tools/sysmledgraph`), it can find the LSP at the repo root.  
- You can always set **SYSMLLSP_SERVER_PATH** to the absolute path of your built `dist/server/server.js` if you want to point at a specific LSP install.

The sysml-v2 MCP runs from repo root and uses `mcpServer.js`; it doesn’t depend on this resolver and doesn’t block it.
