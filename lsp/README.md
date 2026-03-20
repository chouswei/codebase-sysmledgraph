# LSP server (dedicated init)

This folder is a **separate npm install** for the SysML LSP server. Use it so the server runs with its own `cwd` and dependencies.

## Setup

```bash
cd lsp
npm install
```

## What this does

- **Isolated install**: `sysml-v2-lsp` lives in `lsp/node_modules/`, not the repo root. The server starts with **process cwd = `lsp/`**, which can help it find config or libraries relative to this directory.
- **Clear boundary**: The main project points at this LSP when you set:
  - `SYSMLLSP_SERVER_PATH` to the **absolute** path to:
    - `lsp/node_modules/sysml-v2-lsp/dist/server/server.js` (LSP)
    - or `lsp/node_modules/sysml-v2-lsp/dist/server/mcpServer.js` (MCP)
  - and the spawn **cwd** to `lsp/` (or the parent that contains `lsp/`) so the server’s working directory is correct.

## Running the server

- **stdio (for our indexer)**: The main app spawns the server; it doesn’t run “standalone” here. Use this folder’s path in `SYSMLLSP_SERVER_PATH` and set the spawn cwd to `lsp` when starting the process.
- **Manual run** (e.g. to see stdout/stderr):
  ```bash
  cd lsp && npm start
  ```
  The process will wait for LSP messages on stdin; useful for debugging.

## Main project

From repo root, after `cd lsp && npm install`:

- **LSP (analyze/index)**  
  Point `SYSMLLSP_SERVER_PATH` at:
  - `lsp/node_modules/sysml-v2-lsp/dist/server/server.js`  
  (use absolute path or resolve from repo root.)
- **Spawn cwd**  
  When the main project spawns this server, set **cwd** to the **`lsp`** directory (absolute path) so the LSP server’s init and file resolution use this folder.

If the main app already resolves cwd from the server path (e.g. “dirname of server.js → dist/server → cwd = package root”), then with the server path under `lsp/node_modules/...`, that cwd would be `lsp/`. That is what we want.
