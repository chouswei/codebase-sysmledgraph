## Changes

- **LSP resolution: existing repo first** — sysmledgraph-mcp now looks for sysml-v2-lsp in this order: `SYSMLLSP_SERVER_PATH` (if set), then the **current workspace/repo** (walk up from cwd), then sysmledgraph’s own `node_modules`. When the MCP runs with cwd = workspace root, the repo’s LSP is used first.
- **Docs** — MCP-AND-KUZU.md updated to describe the resolution order.
