# MCP Client Template Analysis

Analysis of [andrea9293/mcp-client-template](https://github.com/andrea9293/mcp-client-template) patterns, protocol, and behavior.

## Architecture

**Two-tier web app:**
- **Frontend** (Vite + TypeScript): Web UI for managing servers and sending commands
- **Backend** (Express + TypeScript): REST API that wraps MCP SDK client operations

**Data persistence:**
- `data/mcp-servers.json` — Server configurations (command, type, args)
- `data/auth-tokens.json` — OAuth tokens per server

## Protocol & Transport

### Transport Types Supported

1. **`stdio`** — Newline-delimited JSON over stdin/stdout
   - Uses `StdioClientTransport` from SDK
   - Spawns process: `{ command, args }`
   - Example: `{ type: 'stdio', command: 'node', args: ['server.js'] }`

2. **`httpstream`** — Streamable HTTP (long-polling or streaming)
   - Uses `StreamableHTTPClientTransport` from SDK
   - Command is the server URL
   - Example: `{ type: 'httpstream', command: 'https://mcp-server.example.com' }`

3. **`sse`** — Server-Sent Events
   - Uses `SSEClientTransport` from SDK
   - Command is the server URL
   - Example: `{ type: 'sse', command: 'https://mcp-server.example.com/events' }`

### MCP SDK Usage

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const client = new Client({ name: 'my-client', version: '1.0.0' });
const transport = new StdioClientTransport({ command: 'node', args: ['server.js'] });
await client.connect(transport); // ← initialize happens here
// Then: client.request({ method: 'tools/list' }, schema)
```

**Key point:** The SDK `Client.connect(transport)` handles the full MCP lifecycle:
1. Spawns process (for stdio) or opens connection (for HTTP/SSE)
2. Sends `initialize` request
3. Waits for `initialize` response
4. Sends `notifications/initialized`
5. Client is ready for `tools/list`, `tools/call`, etc.

## Connection Pattern

**Per-request connection:**
- Each `/mcp` API call creates a new `Client` + `Transport`
- Connects, makes request(s), then closes
- No connection pooling or reuse

**Why:** Simpler error handling; each request is isolated. Trade-off: slower (reconnect cost per request).

## OAuth2.1 Flow

1. **First connect attempt** → `UnauthorizedError` thrown
2. **Extract auth URL** from `OAuthClientProvider.redirectToAuthorization()`
3. **Return 401 with `authUrl`** to frontend
4. **User completes OAuth** in browser → redirects to `/oauth/callback`
5. **Backend calls `transport.finishAuth(code)`**
6. **Reconnect** with authenticated transport
7. **Save tokens** to `auth-tokens.json` for future use

**Token reuse:** On subsequent connects, if tokens exist, they're loaded into the OAuth provider before connecting.

## API Endpoints

### `POST /add-server`
- Adds server config to `mcp-servers.json`
- Body: `{ id, command, type, args }`
- Persists immediately

### `GET /servers`
- Lists all servers from `mcp-servers.json`
- Returns array of `{ name, command, type, args }`

### `POST /mcp`
- **Body:** `{ server: string, command: string, args?: any[] }`
- **Command format:** `"list"` or `"call <toolName> [json-args]"`
- **Flow:**
  1. Load server config
  2. `autoDetectTransport()` → create Client + Transport
  3. `client.connect()` → initialize handshake
  4. Parse command:
     - `"list"` → `client.request({ method: 'tools/list' }, ListToolsResultSchema)`
     - `"call <name> [args]"` → `client.request({ method: 'tools/call', params: { name, arguments } }, CallToolResultSchema)`
  5. Return result as JSON
  6. Close transport

### `POST /oauth/callback`
- Receives OAuth code from frontend
- Calls `transport.finishAuth(code)`
- Reconnects with authenticated transport
- Saves tokens

## Key Patterns

### 1. Transport Auto-Detection

```typescript
async function autoDetectTransport(serverConfig) {
  const client = new Client({ name: serverConfig.name, version: '1.0.0' });
  const oauthProvider = new InMemoryOAuthProvider();
  
  if (type === 'stdio') {
    const transport = new StdioClientTransport({ command, args });
    await client.connect(transport);
  } else if (type === 'httpstream' || type === 'sse') {
    const TransportClass = type === 'httpstream' 
      ? StreamableHTTPClientTransport 
      : SSEClientTransport;
    const transport = new TransportClass(new URL(command), { authProvider: oauthProvider });
    await client.connect(transport);
  }
  return { client, transport };
}
```

**Pattern:** Factory that creates the right transport based on `type`, handles OAuth for HTTP transports.

### 2. Request Schema Validation

Uses Zod schemas from SDK:
- `ListToolsResultSchema` for `tools/list`
- `CallToolResultSchema` for `tools/call`
- `LoggingMessageNotificationSchema` for notifications

**Pattern:** Type-safe request/response validation via SDK schemas.

### 3. Error Handling

- **UnauthorizedError** → Return 401 with `authUrl` for OAuth flow
- **Other errors** → Return 500 with error details
- **Connection errors** → Caught and returned as JSON

**Pattern:** HTTP status codes map to MCP/auth errors; frontend handles 401 specially.

### 4. Notification Handling

```typescript
client.setNotificationHandler(LoggingMessageNotificationSchema, (notification) => {
  // Log notification (template doesn't do much here)
});
```

**Pattern:** Register handlers for server notifications (e.g. `logging/message`); template logs them.

## Comparison with Our LSP Client

| Aspect | MCP Template | Our LSP Client |
|--------|-------------|----------------|
| **SDK** | Uses `@modelcontextprotocol/sdk` Client | Custom Content-Length transport |
| **Framing** | Newline-delimited (SDK default) | Content-Length (LSP-style) |
| **Lifecycle** | `client.connect()` handles initialize | Manual: `initialize` → `initialized` → requests |
| **Connection** | Per-request (new client each time) | Shared client (reused across requests) |
| **Protocol** | MCP (`tools/list`, `tools/call`) | LSP (`textDocument/documentSymbol`) |
| **Transport** | stdio, HTTP, SSE | stdio only (Content-Length) |
| **OAuth** | Full OAuth2.1 support | None (LSP doesn't use OAuth) |

## Takeaways for Our Codebase

1. **SDK vs Custom:** We can't use SDK `StdioClientTransport` because sysml-v2-lsp uses Content-Length, not newline-delimited. Our custom transport is correct.

2. **Connection Reuse:** Template creates per-request connections; we reuse a shared client. Our approach is better for performance (no reconnect cost), but we need to handle errors/restarts.

3. **Lifecycle:** Template relies on SDK's `connect()` to do initialize; we do it manually. Both are valid—SDK abstracts it, we have explicit control.

4. **Error Handling:** Template maps MCP errors to HTTP status codes; we throw/return errors directly. Our approach fits our use case (CLI/scripts, not REST API).

5. **OAuth:** Template has full OAuth flow; we don't need it for LSP (LSP doesn't use OAuth).

## What We Should Adopt

1. **Notification handlers:** If the LSP server sends notifications (e.g. `window/logMessage`), we should register handlers instead of ignoring them.

2. **Request timeout:** Template doesn't show explicit timeouts, but we added 30s timeout—good practice.

3. **Error mapping:** Template maps `UnauthorizedError` to 401; we could map LSP errors to more specific error types.

4. **Connection retry:** Template doesn't retry; we could add retry logic for transient failures.

## What We Shouldn't Adopt

1. **Per-request connections:** Too slow for indexing (many files). Our shared client is better.

2. **REST API wrapper:** We're a CLI/library, not a web service. Direct function calls are appropriate.

3. **OAuth:** Not needed for LSP protocol.
