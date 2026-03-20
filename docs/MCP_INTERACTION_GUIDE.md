# MCP Client–Server Interaction Guide

This guide describes how MCP (Model Context Protocol) clients and servers interact, the two stdio framing styles, and how to access the **sysml-v2-lsp** MCP server from code.

## 1. Lifecycle

MCP follows a fixed handshake before any tool or resource calls:

```
Client                          Server
   |                               |
   |  initialize (request)         |
   |------------------------------>|
   |  initialize (response)        |
   |<------------------------------|
   |  notifications/initialized   |
   |------------------------------>|
   |                               |
   |  tools/call, etc.             |
   |<=============================>|
```

1. **Initialize request**  
   Client sends a JSON-RPC request with `method: "initialize"` and params: `protocolVersion`, `capabilities`, `clientInfo`.  
   Example: `{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"my-client","version":"1.0.0"}}}`

2. **Initialize response**  
   Server replies with the same `id`, `result` with `serverInfo`, `capabilities`, and `protocolVersion`.

3. **Initialized notification**  
   Client sends a notification (no `id`): `{"jsonrpc":"2.0","method":"notifications/initialized"}`.  
   Only after this may the client send other requests (e.g. `tools/call`).

4. **Operation**  
   Client calls `tools/call` with `name` and `arguments`; server returns `result.content` (e.g. `[{ type: "text", text: "<json>" }]`).

References: [MCP Lifecycle](https://modelcontextprotocol.io/specification/2024-11-05/basic/lifecycle), [Building a client (Node)](https://modelcontextprotocol.io/tutorials/building-a-client-node).

---

## 2. Stdio transport: two framing styles

Over stdio, the **framing** (how messages are delimited) must match between client and server.

### 2.1 Newline-delimited (MCP spec / SDK)

- **Format:** One JSON-RPC message per line. Each message is `JSON.stringify(msg)` followed by `\n`. No embedded newlines.
- **Used by:** Official [@modelcontextprotocol/sdk](https://www.npmjs.com/package/@modelcontextprotocol/sdk) **client** and **server** (e.g. [modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers)).
- **Client in code:** Use the SDK’s `Client` and `StdioClientTransport`; they handle framing and lifecycle.

```ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({ command: "node", args: ["server.js"] });
const client = new Client({ name: "my-client", version: "1.0.0" }, { capabilities: {} });
await client.connect(transport);
// then: client.request({ method: "tools/call", params: { name, arguments } }, schema)
```

### 2.2 Content-Length (LSP-style)

- **Format:** For each message: a header line `Content-Length: <N>` (and optional other headers), then `\r\n\r\n`, then exactly N bytes of UTF-8 JSON. Same as LSP.
- **Used by:** **sysml-v2-lsp** MCP server (its bundled transport uses this format).
- **Client in code:** A custom client that sends and parses this framing (e.g. this repo’s `createSysmlMcpClient()`).
- **MCP Client Pattern:** Even though we use LSP protocol messages (`textDocument/documentSymbol`), the client follows MCP client lifecycle patterns (initialize → initialized → requests). See [MCP client template](https://github.com/andrea9293/mcp-client-template) for reference. We can’t use `@modelcontextprotocol/sdk` `StdioClientTransport` directly because it expects newline-delimited JSON, not Content-Length framing.

| Server / client          | Framing          | Use in code                          |
|--------------------------|------------------|--------------------------------------|
| modelcontextprotocol/servers, SDK demos | Newline-delimited | SDK `Client` + `StdioClientTransport` |
| sysml-v2-lsp             | Content-Length   | `createSysmlMcpClient()` (this repo) |

---

## 3. How Cursor runs the MCP server

Cursor starts the server as a **subprocess** from the **project root** (the folder that contains `.cursor/mcp.json`):

- **Config:** In `.cursor/mcp.json`, `mcpServers.<name>.command` and `args` (and optional `cwd`).
- **Example (sysml-v2):**  
  `"command": "node"`,  
  `"args": ["node_modules/sysml-v2-lsp/dist/server/mcpServer.js"]`  
  with **cwd** = project root so `node_modules` resolves.
- On Windows, if the OS would open `.js` with another app, the same process is often run via `cmd /c node ...` so Node executes the script.

Cursor’s client then talks to that process over stdio using whatever framing the server expects (for sysml-v2-lsp, Content-Length).

---

## 4. sysml-v2-lsp server

- **Package:** [sysml-v2-lsp](https://www.npmjs.com/package/sysml-v2-lsp) (npm); LobeHub: [daltskin-sysml-v2-lsp](https://lobehub.com/zh-TW/mcp/daltskin-sysml-v2-lsp).
- **Two entry points:**
  - **MCP:** `node_modules/sysml-v2-lsp/dist/server/mcpServer.js` — used by Cursor MCP and by this repo’s `createSysmlMcpClient()` (tools: parse, validate, getSymbols, etc.).
  - **LSP:** `node_modules/sysml-v2-lsp/dist/server/server.js` — used by the **analyze** (index) CLI via `SYSMLLSP_SERVER_PATH`; same Content-Length framing, different protocol (LSP documentSymbol, etc.).
- **Transport:** **Content-Length** framing on stdin/stdout (LSP-style) for both.
- **Tools (MCP examples):** `parse`, `validate`, `getDiagnostics`, `diagnostics`, `validateFile`, `getSymbols`, `getDefinition`, `getReferences`, `getHierarchy`, `getModelSummary`, `getComplexity`, `preview`.

---

## 5. Accessing sysml-v2-lsp from code

### 5.1 From Cursor (MCP tools)

When the **sysml-v2** MCP server is enabled in this project, Cursor can call its tools directly. No extra code: use the MCP tool API with server name and `tools/call` (e.g. `parse`, `validate`). This is the most reliable way to “access” the server in practice.

### 5.2 Programmatic client (this repo)

For scripts or tests, use the **SysML MCP client** that speaks Content-Length and the same lifecycle as above:

```ts
import { createSysmlMcpClient, getMcpServerPath } from "./parser/sysml-mcp-client.js";

const client = await createSysmlMcpClient();
try {
  const result = await client.parse(code, "file:///example.sysml");
  console.log(result);
  const valid = await client.validate(code, "file:///example.sysml");
  console.log(valid);
} finally {
  client.close();
}
```

- **Options:** `createSysmlMcpClient({ serverPath?, initTimeout?, debug? })`.  
  - `serverPath`: defaults to `getMcpServerPath()` (from `sysml-v2-lsp` package or `node_modules/.../mcpServer.js`).  
  - `initTimeout`: ms to wait for initialize response (default 20000).  
  - `debug`: log raw stdout/stderr.
- **Spawn:** Server is started with `process.execPath` (node) and `serverPath`, **cwd = process.cwd()** (project root), so behaviour matches Cursor. On Windows, the client may use `cmd /c node <path>` if needed to avoid the OS opening `.js` with another app.
- **Framing:** Content-Length only (required for sysml-v2-lsp). Do not use the SDK’s `StdioClientTransport` for sysml-v2-lsp; it uses newline-delimited and will not interoperate.

### 5.3 Example and access scripts

From repo root after `npm run build`:

```bash
node scripts/example-sysml-mcp.mjs
node scripts/access-sysml-mcp.mjs
```

- **example-sysml-mcp.mjs** — Calls `parse`, `validate`, and `getSymbols` on a small snippet.
- **access-sysml-mcp.mjs** — Same idea; use `--debug` to log server stdout/stderr. Optional `initTimeout` (default 30s) can be increased in code if the server is slow to start.

**If the script hits “initialize timeout”:**  
When the MCP server is started from a Node script, it may not send the initialize response in time (cold start, stdout buffering, or load). In that case:

1. **Use Cursor MCP** — With the sysml-v2 server enabled in `.cursor/mcp.json`, call the tools from Cursor (e.g. via the MCP tool API). This is the most reliable way to use the server.
2. **Increase `initTimeout`** — e.g. `createSysmlMcpClient({ initTimeout: 60000 })`.
3. **Run from the same conditions as Cursor** — Same working directory and `node`; the client already uses `cwd: process.cwd()` to match.

---

## 6. Index and graph map (LSP, not MCP)

Indexing and generating the graph map use the **LSP** server (`server.js`), not the MCP server. The CLI runs `analyze` (which spawns the LSP and uses documentSymbol), then you can run `generate-map` to produce a markdown map.

- **Kuzu:** The graph DB is backed by [kuzu](https://www.npmjs.com/package/kuzu). Ensure it is built: run `npm install` without `--ignore-scripts`, or `node node_modules/kuzu/install.js` so that `index.js` / `index.mjs` and the native addon are present. Without this, analyze and generate-map will fail with module-not-found.
- **LSP path:** The canonical LSP for this repo is in **`lsp/`**. Run **`npm run setup-lsp`** (or `cd lsp && npm install`) once; the indexer then uses `lsp/node_modules/sysml-v2-lsp/dist/server/server.js` by default (then root `node_modules/...` as fallback). No need to set **`SYSMLLSP_SERVER_PATH`** when using the default. See docs/PLAN_INDEPENDENT_LSP.md.
- **Commands (from repo root, after `npm run build`):**
  - `npm run index-and-map` — Index default path `test/fixtures/sysml`, then write **graph-map.md**.
  - `npm run index-and-map <path>` — Index the given path, then generate the map.
  - `npm run generate-map [outFile]` — Generate map only (reads from existing DB under `~/.sysmledgraph/db/` or `SYSMEDGRAPH_STORAGE_ROOT`).
- **Output:** `graph-map.md` (or the file you pass to generate-map) lists documents, nodes by label, and edges (interconnection view).

**Why no edges (interconnection empty)?**  
Edges come from **symbols** (Package, PartDef, etc.). The indexer gets symbols via the LSP **textDocument/documentSymbol** request. If the LSP returns no symbols (or only symbols we don’t map to a label), you get Document nodes but no symbol nodes and no edges.

- **Optional MCP fallback:** Set **`SYSMEDGRAPH_USE_MCP_SYMBOLS=1`** and run index-and-map again. When the LSP returns no symbols, the indexer will try the **MCP** `getSymbols` tool (same sysml-v2-lsp server, different API). If the MCP returns symbols, they are mapped to nodes and edges. Note: spawning the MCP server from a script can be slow or hit init timeouts; if that happens, use Cursor MCP for ad‑hoc symbol queries and rely on the LSP for indexing when your LSP build supports documentSymbol.
- **LSP behaviour:** Some builds of sysml-v2-lsp may not implement `documentSymbol` or may return a different response shape. We now pass `rootUri` and `workspaceFolders` in initialize and support both array and wrapped `{ data: [] }` responses; we also map LSP **SymbolKind** (number) to a label when `detail` is missing.

---

## 7. Debugging

- **`DEBUG_SYSMLEGRAPH_SYMBOLS=1`** — Log to stderr per file whether symbols came from **LSP** or **MCP** (and count for MCP). Use when indexing to see which path is used.
- **`DEBUG_LSP_NOTIFICATIONS=1`** — Log LSP `window/logMessage` and `window/showMessage` to stderr when using the LSP client.

---

## 8. Troubleshooting

| Issue | What to do |
|-------|------------|
| **No edges in graph-map.md** | Edges come from LSP (or MCP fallback) symbols. Ensure **SYSMLLSP_SERVER_PATH** points to a built `server.js` (with `--stdio`). Run `node scripts/debug-lsp-symbols.mjs <file.sysml>` to see raw LSP output. Use **DEBUG_SYSMLEGRAPH_SYMBOLS=1** when indexing to see if LSP or MCP is used. |
| **LSP server not found** | Run `npm install` (or in `lsp/` for a dedicated install). On Windows, if install fails use `npm install --ignore-scripts` then build; set **SYSMLLSP_SERVER_PATH** to your built `dist/server/server.js`. |
| **Kuzu "Could not set lock on file"** | Only one process can open the same DB. Close Cursor (or disable the sysmledgraph MCP) before running CLI analyze/export, or use a different **SYSMEDGRAPH_STORAGE_ROOT** (e.g. a temp folder) for the run. |
| **Validate a SysML file** | `node scripts/validate-sysml-file.mjs <path-to.sysml>`. Exit 0 = no issues; exit 1 = syntax/semantic issues or script error. Requires sysml-v2-lsp MCP server (same as indexing). |

---

## 9. Summary

| Goal                         | Approach                                                                 |
|-----------------------------|---------------------------------------------------------------------------|
| Understand MCP interaction | Lifecycle: initialize → response → notifications/initialized → tools/call |
| Talk to standard MCP servers| SDK `Client` + `StdioClientTransport` (newline-delimited)                 |
| Talk to sysml-v2-lsp        | Content-Length client; in this repo: `createSysmlMcpClient()`            |
| Use from Cursor             | Enable sysml-v2 in `.cursor/mcp.json` and call MCP tools                 |
| Use from Node/scripts       | `createSysmlMcpClient()` and call methods; run from project root         |
| Index and see the map       | LSP (`server.js`); kuzu built; `npm run index-and-map` (see §6)          |
| Validate a file             | `node scripts/validate-sysml-file.mjs <path>` (exit 0/1)                 |
