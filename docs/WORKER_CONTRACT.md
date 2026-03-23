# Worker contract (operator summary)

Short reference for the **long-lived graph worker** (TCP daemon). For state machines, error matrices, and interaction analysis, see **docs/DESIGN_LONG_LIVED_WORKER.md** (§8–§11).

## Scope

- **One daemon per `SYSMEDGRAPH_STORAGE_ROOT`** (default `~/.sysmledgraph`).
- **Only the daemon** opens **`db/graph.kuzu`** when clients use long-lived mode.
- **CLI** and **MCP** talk to the daemon via **`src/worker/gateway.ts`** when configured.

## Discovery

| Mechanism | Meaning |
|-----------|---------|
| **`SYSMLEGRAPH_WORKER_URL`** | Optional. Host/port for TCP (e.g. `127.0.0.1:9123` or `http://127.0.0.1:9123`). Overrides port file. |
| **`{storageRoot}/worker.port`** | Line 1: TCP **port**. Line 2: daemon **PID**. Host is **`127.0.0.1`**. |
| **`{storageRoot}/worker.lock`** | Exclusive startup lock; contains **PID**; released on shutdown. |

## Wire protocol

- **Framing:** One **JSON object per line** (NDJSON), UTF-8, trailing `\n`.
- **First message on a connection:** `init`  
  `{"id":0,"method":"init","params":{"storageRoot":"<path>"}}`  
  Response: `{"id":0,"result":{}}` or `{"id":0,"error":"..."}`.
- **Requests:** `{"id":<n>,"method":"<name>","params":{...}}`
- **Responses:** `{"id":<n>,"result":...}` or `{"id":<n>,"error":"<message>"}`.
- **Shutdown:** `{"id":<n>,"method":"shutdown"}` → daemon begins graceful teardown after responding.

**Methods** (same as stdio graph-worker): e.g. `list_indexed`, `index`, `clean`, `cypher`, `query`, `context`, `impact`, `rename`, `generateMap`, `getContextContent`. Unknown method → `{ id, error }`.

**Implementation:** `src/worker/dispatch.ts`, `protocol.ts`, `daemon.ts`.

## CLI

```bash
sysmledgraph worker start          # foreground
sysmledgraph worker start --detach # background
sysmledgraph worker stop
sysmledgraph worker status
```

Global **`--storage <path>`** sets the storage root (same as **`SYSMEDGRAPH_STORAGE_ROOT`**).

**Exit codes (summary):** `worker start` → **0** started, **2** already running (TCP up), **1** other failure. `worker stop` → **1** if no **`worker.port`**. `worker status` → **0** if TCP responds, **1** if not (stderr may mention stale port file). Details: **DESIGN_LONG_LIVED_WORKER.md** §9.4.

## Client strict mode

- **`SYSMLEGRAPH_WORKER_STRICT=1`:** If long-lived mode is expected (URL or port file) but the daemon is **unreachable**, graph operations **fail** instead of falling back to in-process Kuzu.

## Operational rules

1. Use the **same** **`SYSMEDGRAPH_STORAGE_ROOT`** for daemon, CLI, and MCP when sharing one graph.
2. Do **not** mix **daemon + in-process** open of the **same** `graph.kuzu` (Kuzu lock errors).
3. After a crash, **`worker.port`** / **`worker.lock`** may be stale; use **`worker status`**, **`worker stop`**, or remove files only when sure the old PID is dead (see **INSTALL.md**).

## Related

- **Design & diagrams:** **docs/DESIGN_LONG_LIVED_WORKER.md**
- **Install & env:** **docs/INSTALL.md**, **README.md**
- **Cursor / MCP:** **docs/MCP_INTERACTION_GUIDE.md** §6.1
