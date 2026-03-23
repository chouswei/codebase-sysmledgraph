# Plan: Implement the long-lived graph worker

**Goal:** Ship a daemon that is the only process opening Kuzu for a given storage root; CLI and MCP (and scripts) connect over TCP with the existing NDJSON protocol.

**Design reference:** **docs/DESIGN_LONG_LIVED_WORKER.md** (protocol, errors §9, statecharts §8, interactions §11).

**Out of scope for v1:** Auth/TLS, multi-machine, Unix-socket-only transport (TCP localhost first).

---

## 0. Prerequisites

- Read **DESIGN_LONG_LIVED_WORKER.md** §3–§4 and §11 (mixed mode = lock conflict).
- Decide default **port policy:** fixed env `SYSMLEGRAPH_WORKER_PORT` (e.g. `9192`) vs OS-assigned port written to `{storageRoot}/worker.port` (recommended for fewer collisions).
- Decide **strict vs fallback** when daemon is configured but unreachable (recommend: env flag `SYSMLEGRAPH_WORKER_STRICT=1` for fail-fast).

---

## 1. Refactor: shared dispatch (foundation)

**Why:** `graph-worker.ts` already implements `dispatch()` and NDJSON stdio; the daemon must reuse the same logic without duplicating the switch.

| Task | Detail |
|------|--------|
| 1.1 | Extract `dispatch()` (and any small helpers) into **`src/worker/dispatch.ts`** (or `worker-handlers.ts`). Export `dispatch(method, params): Promise<unknown>`. |
| 1.2 | **`graph-worker.ts`** imports `dispatch`, keeps stdio readline loop, `init`, `initialized`, `respond()` to stdout. |
| 1.3 | Run existing tests / manual: `SYSMLEDGRAPH_USE_WORKER=1` CLI `analyze` still works (spawned child uses same dispatch). |

**Acceptance:** No behavior change for stdio worker; `tsc` clean.

---

## 2. Daemon process (TCP server)

| Task | Detail |
|------|--------|
| 2.1 | Add **`src/worker/daemon.ts`** (or `graph-daemon.ts`): parse `SYSMEDGRAPH_STORAGE_ROOT` (reuse `setStorageRoot` / default from `storage/location.ts`). |
| 2.2 | **Lock:** Exclusive lock file under storage root (e.g. `worker.lock` or `.worker.lock`) using `fs` + `fs.open` with `wx` or a portable lock library; hold until exit. On failure → stderr + exit code per design §9.1 (e.g. 2). |
| 2.3 | **Bind:** `net.createServer()` on `127.0.0.1`, port from env or `0` (OS picks); write **`worker.port`** (and **`worker.pid`**) under storage root (e.g. next to `db/` or under `storageRoot`). Document path in design. |
| 2.4 | **Per connection:** On `socket`, read lines (same NDJSON as stdio: `init` first, then requests). Reuse protocol types from **`src/worker/protocol.ts`**. Call shared `dispatch()`; write `JSON.stringify(response) + '\n'` to socket. Handle parse errors per §9.3. |
| 2.5 | **Shutdown:** Method `shutdown` in protocol (optional) or SIGTERM handler: stop `accept`, close all sockets, close Kuzu if daemon opened DB eagerly (or rely on process exit). Remove port file, release lock. Exit 0. |
| 2.6 | **Build:** Ensure `daemon.ts` is compiled to `dist/src/worker/daemon.js` (already under `src/` in `tsconfig`). Optional **`package.json` `bin`:** `sysmledgraph-worker` → `dist/src/worker/daemon.js` for direct launch. |

**Acceptance:** Manual: start daemon, `nc` or small script sends `init` + `list_indexed`, gets JSON line back; second start with same storage → exit 2 (lock/port).

---

## 3. Socket client

| Task | Detail |
|------|--------|
| 3.1 | Add **`src/worker/socket-client.ts`:** `connect(host, port)`, send line, readline parser for responses, pending `Map<id, resolve/reject>`, same API shape as **`client.ts`** `request(method, params)` after `init` completes. |
| 3.2 | **Timeouts:** Connect timeout + per-line read timeout (design §10.2 liveness). |
| 3.3 | **`resolveWorkerAddress()`:** Read `worker.port` from `getStorageRoot()`; or parse `SYSMLEGRAPH_WORKER_URL` if set (e.g. `http://127.0.0.1:9192` → host/port). |

**Acceptance:** Unit or integration test: mock TCP server echoes valid response; client resolves one request.

---

## 4. Gateway: long-lived vs stdio vs in-process

| Task | Detail |
|------|--------|
| 4.1 | Add **`useLongLivedWorker()`:** true if `SYSMLEGRAPH_WORKER_URL` set **or** `worker.port` exists under current storage root (after `setStorageRoot`). Order: URL overrides port file. |
| 4.2 | **`gateway.ts`:** If `useLongLivedWorker()` → use socket client (connect once per process, reuse for MCP; CLI may connect per command or reuse — see 4.3). Else if `SYSMLEDGRAPH_USE_WORKER=1` → existing `startWorker` + stdio. Else → in-process handlers (current). |
| 4.3 | **MCP:** Long-lived connection: on first tool call, `ensureSocketWorker()` connects + `init`; keep socket open for process lifetime. On disconnect, optional single reconnect. |
| 4.4 | **CLI:** For `analyze`/`list`/`clean`, either connect per command and disconnect (simple) or reuse one connection per CLI invocation (already one process per command). Do **not** call `closeWorker()` for socket mode in a way that kills the daemon — only close **client** socket when CLI exits. |
| 4.5 | **Strict mode:** If `useLongLivedWorker()` would be true (user set URL) but connect fails → error message and non-zero exit (no silent in-process fallback). If URL unset and no port file → in-process as today. |

**Acceptance:** With daemon running + env/port file, `gateway` routes `index` to socket; with no daemon and no URL, behavior unchanged from main branch.

---

## 5. MCP server uses gateway

| Task | Detail |
|------|--------|
| 5.1 | Replace direct `handleIndexDbGraph`, `handleCypher`, … calls in **`src/mcp/server.ts`** with **`gateway`** functions matching tool names (`index`, `cypher`, `query`, … — map existing handler signatures to gateway). |
| 5.2 | Keep **`listIndexedPaths`** for any resource that only reads registry without DB if applicable; otherwise route through gateway. |
| 5.3 | Verify resources **`getContextContent`** / schema: use gateway or shared path that hits daemon when configured. |

**Acceptance:** Cursor MCP with daemon running: tools work; with daemon off and no worker config: current in-process behavior.

---

## 6. CLI: `worker` subcommands

| Task | Detail |
|------|--------|
| 6.1 | **`bin/cli.ts`:** Add command group `worker` with `start`, `stop`, `status`. Respect global `--storage`. |
| 6.2 | **`start`:** Spawn `node dist/src/worker/daemon.js` (or `process.execPath`) with env `SYSMEDGRAPH_STORAGE_ROOT`; foreground default; `--daemon` on Windows = start detached child + exit 0 (document limitation vs Unix `fork`). |
| 6.3 | **`stop`:** Read `worker.pid`, `process.kill(pid, 'SIGTERM')` or send `shutdown` over TCP; wait for port file removal; exit codes §9.4. |
| 6.4 | **`status`:** If port file + optional PID alive → stdout “running 127.0.0.1:PORT”; else exit 1. |

**Acceptance:** Scriptable: `sysmledgraph worker status`; exit codes documented.

---

## 7. Scripts: no direct Kuzu when daemon mode — ✅ Done

| Task | Detail |
|------|--------|
| 7.1 | **`graph export`** / **`graph map`** in CLI (`src/cli/graph-artifacts.ts`) use **`gateway.cypher`** / **`gateway.generateMap`**. **`scripts/export-graph.mjs`** and **`scripts/generate-map.mjs`** spawn **`dist/bin/cli.js`**. **`npm run export-graph` / `generate-map`** invoke the CLI directly. |
| 7.2 | **`scripts/index-and-query.mjs`:** Still uses `openGraphStore` in-process (optional follow-up). |
| 7.3 | **`index-and-map.mjs`:** Uses **`dist/bin/cli.js graph map`**. |

**Acceptance:** With daemon holding DB, `npm run index-and-map` completes without opening a second Kuzu in a script process.

---

## 8. Serialization (mutating ops)

| Task | Detail |
|------|--------|
| 8.1 | Per **DESIGN §10.4 / §11.3:** Serialize `dispatch` for mutating methods (`index`, `clean`, `rename`?) behind a **mutex** or single queue in the daemon so concurrent TCP connections do not interleave writes. Read-only ops (`query`, `cypher`, `context`, …) may run in parallel only if Kuzu allows; if unsure, serialize all `dispatch` calls (simplest). |

**Acceptance:** Stress test: two parallel `index` requests do not corrupt graph (or second waits).

---

## 9. Tests and docs

| Task | Detail |
|------|--------|
| 9.1 | **Integration test:** Start daemon subprocess in test, set `SYSMLEGRAPH_WORKER_URL` or port file, run one gateway `list_indexed` or `index` on temp storage root, assert OK. |
| 9.2 | **docs/INSTALL.md**, **docs/MCP_INTERACTION_GUIDE.md**, **README.md:** When to run `sysmledgraph worker start`; env vars; “do not mix in-process and daemon on same storage root” (§11). |
| 9.3 | Update **docs/PLAN.md** Phase 5 checkboxes when milestones land. |
| 9.4 | **DESIGN_LONG_LIVED_WORKER.md:** Set status to “partially implemented” when v1 ships; link this plan. |

---

## 10. Suggested implementation order

```
1 → Refactor dispatch (1)
2 → Socket client (3) + minimal mock test
3 → Daemon (2) + manual nc test
4 → Gateway routing (4) + CLI graph commands still default in-process
5 → MCP via gateway (5)
6 → CLI worker start/stop/status (6)
7 → Serialization (8)
8 → Scripts / CLI graph subcommands (7)
9 → Tests + docs (9)
```

Parallel risk: doing MCP (5) before gateway (4) is wrong order. Doing scripts (7) last is OK.

---

## 11. Definition of done (v1)

- [ ] Daemon starts, binds localhost, writes port file, holds lock; exits cleanly on stop with files removed.
- [ ] CLI `analyze` / `list` / `clean` use socket path when worker URL or port file indicates daemon (per policy in §4).
- [ ] MCP tools use same gateway path; no `getCachedOrOpenGraphStore` in MCP tool code when long-lived mode is active (optional: always use gateway for one code path).
- [ ] `sysmledgraph worker start|stop|status` works on primary dev OS (Windows + document Unix daemon).
- [ ] Documented env vars and troubleshooting; Phase 5 checkboxes in PLAN.md updated.
- [ ] Default behavior with **no** env and **no** daemon unchanged for existing users.

---

## 12. Risks

| Risk | Mitigation |
|------|------------|
| Windows detached daemon / signals | Use TCP `shutdown` message + documented `worker stop` implementation; test on Windows. |
| Stale port file after crash | `worker status` checks PID; connect timeout; document manual delete of port file. |
| Handler imports pull MCP-only deps into daemon | Daemon already runs same handlers in `graph-worker.ts`; watch bundle size and circular imports. |
| Two daemons different storage roots | OK; lock is per storage root path. |
