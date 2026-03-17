## Changes

- **README: Kuzu lock note** — Added a short note in the CLI section: for a full CLI reindex, close Cursor (or disable the sysmledgraph MCP) first to avoid "Could not set lock on file"; link to docs/MCP-AND-KUZU.md.
- **README: LSP resolution** — Clarified that the CLI looks in the current workspace/repo first (walk up from cwd), then sysmledgraph's `node_modules`.
