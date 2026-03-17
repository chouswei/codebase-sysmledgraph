## Changes

- **Docs: Two MCPs, Kuzu lock, LSP path** — New [docs/MCP-AND-KUZU.md](docs/MCP-AND-KUZU.md) explains how sysmledgraph and the sysml-v2 MCP relate (no conflict; only sysmledgraph uses Kuzu), when Kuzu lock happens (same DB opened twice), and how to avoid it. Also documents the "sysml-v2-lsp not found" path-resolution fix.
- **LSP path resolution** — Resolver now walks up from the current working directory to find `node_modules/sysml-v2-lsp/dist/server/server.js`. When sysmledgraph runs from a subfolder (e.g. `tools/sysmledgraph`), it can use the LSP at repo root without setting `SYSMLLSP_SERVER_PATH`.
- **README** — CLI env note and project layout link to MCP-AND-KUZU.md.
