# Install

How to build sysmledgraph, run the SysML indexer, and optionally use a **long-lived TCP worker** so CLI and MCP share one Kuzu database without file-lock errors. If you split **models** and **application code** across two Git repos, use [Two Git repos](#two-git-repos-modelbase-and-codebase).

**Contents:** [Quick start](#quick-start) · [LSP](#lsp) · [Kuzu](#kuzu) · [Long-lived graph worker](#long-lived-graph-worker-optional) · [Worker CLI exit codes & examples](#worker-cli-exit-codes-and-examples) · [Two Git repos](#two-git-repos-modelbase-and-codebase)

---

## Quick start

1. **Root:** `npm install` then `npm run build`. On **Windows**, if **`sysml-v2-lsp`** fails during install (its script uses shell syntax), use **`npm install --ignore-scripts`** then **`node node_modules/kuzu/install.js`**.
2. **LSP (for indexing):** The canonical LSP for this repo is in **`lsp/`**. Run **`npm run setup-lsp`** (uses `--ignore-scripts`) or **`cd lsp && npm install --ignore-scripts`**. No need to set **`SYSMLLSP_SERVER_PATH`** when using this default.
3. **Index:** `npx sysmledgraph analyze <path>`, or enable the sysmledgraph MCP in Cursor and use **indexDbGraph** (see [MCP_SERVER_FOR_CURSOR.md](MCP_SERVER_FOR_CURSOR.md)).
4. **Modelbase + Codebase (two Git repos):** If models and app code live in different repos but should share one graph, read [Two Git repos](#two-git-repos-modelbase-and-codebase) below.

**Using CLI and MCP together on the same graph:** Start **`npx sysmledgraph worker start --detach`** once (see [Long-lived graph worker](#long-lived-graph-worker-optional)) so both use TCP instead of opening **`graph.kuzu`** twice.

---

## LSP

- **Source:** [sysml-v2-lsp](https://www.npmjs.com/package/sysml-v2-lsp) (npm). The only copy used by sysmledgraph for indexing is in **`lsp/`** (see [PLAN_INDEPENDENT_LSP.md](PLAN_INDEPENDENT_LSP.md)).
- **Setup:** `npm run setup-lsp` installs it in `lsp/` with `--ignore-scripts` (required on **Windows** for **sysml-v2-lsp ≥ 0.8**). Manual: `cd lsp && npm install --ignore-scripts`.

### Updating language support (“grammar” via the server)

**sysmledgraph does not ship SysML grammar or a parser** — indexing and symbols come from the **`sysml-v2-lsp`** package.

1. **Bump the version** in **`lsp/package.json`** (`dependencies.sysml-v2-lsp`, e.g. `^0.8.0` when published).
2. **Reinstall in `lsp/`:**  
   `cd lsp && rm -rf node_modules package-lock.json` (optional, for a clean pull) then **`npm install`**.  
   Or from repo root: **`npm run setup-lsp`** (skips if the server file already exists — delete `lsp/node_modules` first if you need a forced refresh).
3. **Align the repo root** (optional but recommended): update **`sysml-v2-lsp`** in root **`package.json`** `devDependencies` to the same range so scripts and **`npm run check:sysml-lsp`** stay consistent, then **`npm install`** at root.
4. **Verify:** `node scripts/check-sysml-v2-lsp-version.mjs` and a smoke index, e.g. **`npx sysmledgraph analyze test/fixtures/sysml`** or **`node scripts/debug-lsp-symbols.mjs`** on a `.sysml` file.
5. If you pinned **`SYSMLLSP_SERVER_PATH`**, ensure it still points at **`lsp/node_modules/sysml-v2-lsp/dist/server/server.js`** (or clear the env to use defaults).

### Editor syntax highlighting (separate from this repo)

**Coloring / TextMate “grammar”** in Cursor or VS Code usually comes from a **SysML or SysML v2 extension** in the marketplace, not from sysmledgraph. To change that: install or update the relevant extension, or adjust **`files.associations`** / theme settings in the editor — see the extension’s docs.

---

## Kuzu

If `npm install` fails or you use `--ignore-scripts`, build Kuzu manually: `node node_modules/kuzu/install.js`. If **`docs/INSTALL_NOTES.md`** exists in your checkout, see it for platform notes.

---

## Long-lived graph worker (optional)

To avoid **Kuzu file-lock** conflicts when using the **CLI** and **MCP server** at the same time on the same storage root, run **one** TCP worker process that owns **`db/graph.kuzu`**. CLI and MCP then talk to it over **localhost** (see [DESIGN_LONG_LIVED_WORKER.md](DESIGN_LONG_LIVED_WORKER.md), [WORKER_CONTRACT.md](WORKER_CONTRACT.md)).

| Step | Command / setting |
|------|-------------------|
| **Start** | `npx sysmledgraph worker start --detach` (background) or `npx sysmledgraph worker start` (foreground). Writes **`worker.port`** under the storage root (default `~/.sysmledgraph`). |
| **Same storage** | CLI (`--storage` / **`SYSMEDGRAPH_STORAGE_ROOT`**) and MCP **`env`** must use the **same** root. With **`worker.port`** or **`SYSMLEGRAPH_WORKER_URL`** (e.g. `http://127.0.0.1:9123`), clients use TCP instead of in-process Kuzu. |
| **Stop** | `npx sysmledgraph worker stop` — graceful shutdown, then removes **`worker.port`**. |
| **Status** | `npx sysmledgraph worker status` — exit **0** if the port responds. |
| **Strict** | **`SYSMLEGRAPH_WORKER_STRICT=1`** — if a worker URL/port is configured but the daemon is unreachable, **fail** instead of falling back to in-process (avoids mixed mode). |

Fixed listen port (optional): **`SYSMLEGRAPH_WORKER_PORT`** (e.g. `9192`); otherwise the OS assigns a port and writes it to **`worker.port`** line 1.

**E2E smoke:** `npm run test:daemon` (uses `vitest.e2e.config.ts`; not part of default `npm test`).

**Export / map:** `npx sysmledgraph graph export` / `npx sysmledgraph graph map` use the same gateway as MCP. `npm run export-graph` / `npm run generate-map` call those CLI commands.

### Worker CLI: exit codes and examples

Use the same **`SYSMEDGRAPH_STORAGE_ROOT`** (or **`--storage`**) for every command below.

| Command | **0** (success) | **1** (failure / not ready) | **2** (already running) |
|---------|-----------------|----------------------------|-------------------------|
| **`worker start`** | Foreground: runs until shutdown. **`--detach`:** background start | Daemon not built, stale **`worker.port`** with PID still alive, other errors | **`worker.port`** exists and **TCP responds** — worker already up |
| **`worker stop`** | Shutdown attempted; **`worker.port`** removed | No **`worker.port`** | — |
| **`worker status`** | TCP responds (stdout: `running 127.0.0.1:<port>`) | No port file, TCP down, or **stale** **`worker.port`** (stderr explains); invalid port file | — |

**Examples (stderr/stdout):**

```text
# Up — exit 0
$ npx sysmledgraph worker status
running 127.0.0.1:9123
```

```text
# Down — exit 1
$ npx sysmledgraph worker status
not running
```

```text
# Port file left over, process gone — exit 1 (clean up with worker stop or delete worker.port)
$ npx sysmledgraph worker status
not running (stale worker.port: TCP closed on port 9123; run worker stop or delete worker.port)
```

```text
# Second start while daemon is up — exit 2
$ npx sysmledgraph worker start --detach
Worker already running (worker.port + TCP responds).
```

If you run **`dist/.../daemon.js`** directly and another worker holds the lock, the process prints an error and exits **2** when the message indicates *already running*, otherwise **1**. Details: [WORKER_CONTRACT.md](WORKER_CONTRACT.md), [DESIGN_LONG_LIVED_WORKER.md](DESIGN_LONG_LIVED_WORKER.md) §9.4.

### Which repo starts the TCP server?

The daemon is **not** tied to which Git repo you have open. It is tied to **`SYSMEDGRAPH_STORAGE_ROOT`** (and the **`sysmledgraph`** binary you invoke). You can run **`worker start`** from a terminal whose cwd is **either** repo, as long as the environment points at the **same** storage root.

In a **Publisher / Subscriber** setup ([below](#two-git-repos-modelbase-and-codebase)):

- **Start the worker once** where you operate the graph (conventionally **Modelbase / Publisher**).
- **Codebase / Subscriber** does **not** need to start the TCP server; it sets **`SYSMLEGRAPH_WORKER_URL`** and **connects** to the existing process. Starting a **second** worker for the **same** root fails (**`worker.lock`** or **`worker start`** exit **2**).

---

### Two Git repos: Modelbase and Codebase

Models often live in a **Modelbase** repo; implementation in a **Codebase** repo. Git remotes differ, but **one graph** is keyed by a shared **`SYSMEDGRAPH_STORAGE_ROOT`** directory, not by repo name.

| Short name | Typical repo | Role in one sentence |
|------------|--------------|----------------------|
| **Publisher** | SysML / modelbase | Owns indexing and usually **`worker start`**; one process holds **`graph.kuzu`**. |
| **Subscriber** | App, firmware, services | Same storage root + **`SYSMLEGRAPH_WORKER_URL`** (or readable **`worker.port`**); uses query / context / impact / … |

**Minimal env (same machine)**

| Role | Required | Typical extras |
|------|----------|----------------|
| **Publisher** | **`SYSMEDGRAPH_STORAGE_ROOT`** | After **`worker start`**: none for local clients; or set **`SYSMLEGRAPH_WORKER_URL`** if you do not rely on **`worker.port`**. |
| **Subscriber** | **`SYSMEDGRAPH_STORAGE_ROOT`** (same path) + **`SYSMLEGRAPH_WORKER_URL`** | **`SYSMLEGRAPH_SUBSCRIBER=1`**, **`SYSMLEGRAPH_WORKER_STRICT=1`** |

#### Publisher (Modelbase)

- Set **`SYSMEDGRAPH_STORAGE_ROOT`** to the directory that will contain **`db/graph.kuzu`** (default `~/.sysmledgraph` or a project path such as **`.sysmledgraph-local`**).
- Build the graph: **`npx sysmledgraph analyze <path>`** or MCP **indexDbGraph**.
- For CLI + MCP without Kuzu lock fights: **`npx sysmledgraph worker start --detach`**. Port → **`worker.port`** line 1; optional fixed port: **`SYSMLEGRAPH_WORKER_PORT`**.

#### Subscriber (Codebase)

- Use the **same absolute** **`SYSMEDGRAPH_STORAGE_ROOT`** as the Publisher.
- Set **`SYSMLEGRAPH_WORKER_URL`** to **`127.0.0.1:<port>`** (from the Publisher’s **`worker.port`**, or the port you fixed with **`SYSMLEGRAPH_WORKER_PORT`**). The **MCP process does not start** the TCP server; it only connects.
- Optional: **`SYSMLEGRAPH_SUBSCRIBER=1`** in MCP **`env`** — **indexDbGraph** / **clean_index** are not registered (fewer accidents from the wrong workspace).
- Optional: **`SYSMLEGRAPH_WORKER_STRICT=1`** — graph calls fail if the worker is down (no silent in-process DB).
- Do **not** run **`worker start`** for that same root from Codebase unless the Publisher worker is **not** running and you are deliberately taking over the same storage root from a shell (still only **one** daemon).

**`mcp.json` examples:** [MCP_SERVER_FOR_CURSOR.md](MCP_SERVER_FOR_CURSOR.md).

#### Same PC, two Cursor workspaces

One absolute **`SYSMEDGRAPH_STORAGE_ROOT`** in **both** projects. **Modelbase:** index + **`worker start`**. **Codebase:** **`SYSMLEGRAPH_WORKER_URL`** only — no second daemon for that root.

#### Different PCs

The daemon listens on **localhost** only on the machine where it runs. From **Codebase**, typical options: **SSH port forward** from the **Modelbase** host’s worker port to local **`127.0.0.1`**, then **`SYSMLEGRAPH_WORKER_URL`** to that local port; or a **shared filesystem** for the storage root (harder). See [PLAN.md](PLAN.md) Phase 7.

#### Only one worker per storage root

What **actually** enforces a single daemon (hiding MCP tools does **not**):

- **`worker.lock`** — exclusive lock; a second process on the **same** root gets an error such as *Another graph worker is already running*.
- **`worker start`** — if TCP already answers on **`worker.port`**, start exits **2** (already running).

**`SYSMLEGRAPH_SUBSCRIBER=1`** only removes **index** / **clean** from the MCP tool list; it does not stop **`worker start`** from a terminal.

For a full env var list, see [README.md](../README.md) (repository root).
