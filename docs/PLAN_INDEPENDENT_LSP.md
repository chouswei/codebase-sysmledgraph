# Plan: Independent LSP Server in This Repo

## Summary

Sysmledgraph is an **MCP server for Cursor** (query, context, impact, indexDbGraph, generate_map). When indexing runs (CLI or MCP tool), it spawns an **LSP subprocess** (sysml-v2-lsp `server.js`) to get document symbols. That LSP allows **only one client**; we must use a **dedicated instance** in **`lsp/`** so it is only for sysmledgraph—never shared with Cursor’s sysml-v2-lsp MCP server.

**Goal:** The LSP used by sysmledgraph always lives in this repo (**`lsp/`**), is installed by a defined step, and is used by default everywhere (CLI, MCP, scripts) without setting `SYSMLLSP_SERVER_PATH`.

**LSP source:** The only source of the LSP is the npm package [**sysml-v2-lsp**](https://www.npmjs.com/package/sysml-v2-lsp). We install it in **`lsp/`** (and optionally at root as fallback); there are no other builds or forks. The server entrypoints are `dist/server/server.js` (LSP) and `dist/server/mcpServer.js` (MCP) from that package.

---

## Architecture

```
Cursor
  ├── sysmledgraph (MCP server)  ← our server; tools: indexDbGraph, query, context, …
  │     └── spawns LSP (server.js) from lsp/  ← only for indexing; single client
  └── sysml-v2 (MCP server)      ← optional; parse, validate, getSymbols; separate process
```

- **One MCP server (sysmledgraph)** for Cursor; **one LSP process (from `lsp/`)** used only by sysmledgraph (and CLI) for indexing.
- The LSP in **`lsp/`** is **only for sysmledgraph**. No sharing with Cursor’s sysml-v2 MCP.

---

## Current state

| Area | Behaviour |
|------|-----------|
| **`lsp/`** | Exists; own `package.json` with `sysml-v2-lsp`; `npm start` / `npm run mcp`; README describes cwd and paths. |
| **Default path** | Only **`scripts/index-and-map.mjs`** sets env to `lsp/.../server.js` when unset. |
| **Elsewhere** | CLI analyze, MCP indexDbGraph, debug/compare scripts only read **`SYSMLLSP_SERVER_PATH`**. If unset → MCP fallback only (or script failure). |

So the LSP *can* live in `lsp/`, but we do not **default** to it from all entry points or **ensure** it is installed.

---

## Requirements (what “independent” means)

1. **Single default path** — All code that needs the LSP uses: env → `lsp/node_modules/sysml-v2-lsp/dist/server/server.js` → root `node_modules/.../server.js`. No env required when `lsp/` is present.
2. **Guaranteed install** — After setup, `lsp/node_modules/sysml-v2-lsp/dist/server/server.js` exists (via setup script and/or postinstall).
3. **Optional later** — Root drops `sysml-v2-lsp` so only `lsp/` has it (single source of truth).

---

## Codebase modification requirements

| # | File / location | Change |
|---|-----------------|--------|
| 1 | **`src/parser/lsp-server-path.ts`** (new) | Add module exporting `getDefaultLspServerPath(): string or null`. Resolution: env → `lsp/node_modules/sysml-v2-lsp/dist/server/server.js` → `node_modules/sysml-v2-lsp/dist/server/server.js` (use `fs.existsSync`). |
| 2 | **`src/parser/lsp-client.ts`** | Replace (or wire) `resolveLspServerPath()` to use `getDefaultLspServerPath()` from the new module. Keep spawn cwd logic for paths under `lsp/node_modules/...`. |
| 3 | **`scripts/debug-lsp-symbols.mjs`** | When `SYSMLLSP_SERVER_PATH` is unset, set it to lsp path then root path (same order as Step 1). |
| 4 | **`scripts/compare-mcp-vs-lsp-symbols.mjs`** | Same as #3: default to lsp/ then root when env unset. |
| 5 | **`scripts/setup-lsp.mjs`** (new) | If `lsp/node_modules/sysml-v2-lsp/dist/server/server.js` exists → exit 0; else run `npm install` in `lsp/` (optionally `--ignore-scripts`). |
| 6 | **`package.json`** (root) | Add script: `"setup-lsp": "node scripts/setup-lsp.mjs"`. |
| 7 | **README** (or INSTALL) | Add: canonical LSP is in `lsp/`; run `npm run setup-lsp` or `cd lsp && npm install`; no need to set `SYSMLLSP_SERVER_PATH` for default. |
| 8 | **`lsp/README.md`** | Add: this is the only LSP used by sysmledgraph when present; root `node_modules` is fallback. |
| 9 | **`docs/MCP_SERVER_FOR_CURSOR.md`**, **`docs/MCP_INTERACTION_GUIDE.md`** | Mention: LSP is in `lsp/` and is picked automatically after setup. |
| 10 (optional) | **`package.json`** (root) | Remove `sysml-v2-lsp` from devDependencies; update any root code that imports it (e.g. validate script) to use `lsp/` or spawn from `lsp/`. |

**Notes:** Steps 1–2 are code; 3–4 are scripts (can call into built helper or duplicate two-path check); 5–6 are setup; 7–9 are docs; 10 is optional cleanup.

---

## Steps

### Step 1: Default LSP path in code

**Add:** Module (e.g. **`src/parser/lsp-server-path.ts`**) exporting **`getDefaultLspServerPath(): string | null`**:

- If `SYSMLLSP_SERVER_PATH` is set and non-empty → resolve (absolute or cwd-relative) and return.
- Else, in order:  
  1. `resolve(cwd, 'lsp/node_modules/sysml-v2-lsp/dist/server/server.js')`  
  2. `resolve(cwd, 'node_modules/sysml-v2-lsp/dist/server/server.js')`  
  Return first path where `fs.existsSync(path)` is true, else `null`.

**Use in:** **`src/parser/lsp-client.ts`** — make **`resolveLspServerPath()`** call this helper. Keep existing spawn **cwd** logic (use `lsp/` when path is under `lsp/node_modules/...`).

**Verify:** Run `node scripts/debug-lsp-symbols.mjs test/fixtures/sysml/sample.sysml` with **no** `SYSMLLSP_SERVER_PATH`; with `lsp/` installed, it should use `lsp/.../server.js` and return symbols.

---

### Step 2: Scripts use same default

**Update:** **`scripts/debug-lsp-symbols.mjs`** and **`scripts/compare-mcp-vs-lsp-symbols.mjs`** so that when `SYSMLLSP_SERVER_PATH` is unset they set it to the same order (lsp/ then root), e.g. by requiring the same helper or duplicating the two-path check.

**Note:** **`scripts/index-and-map.mjs`** already sets env; can stay as-is or switch to the shared helper later.

**Verify:** Same as Step 1; scripts behave like CLI/MCP.

---

### Step 3: Ensure `lsp/` is installed (Option C — setup script)

**Use Option C.** Add **`scripts/setup-lsp.mjs`** and root script **`npm run setup-lsp`**:

- If `lsp/node_modules/sysml-v2-lsp/dist/server/server.js` exists → exit 0.
- Else run `npm install` in `lsp/` (use `--ignore-scripts` for Windows if needed).
- Document: “Run `npm run setup-lsp` or `cd lsp && npm install` to install the LSP used by sysmledgraph.”

No root postinstall or workspaces; the LSP is installed only when the user runs `setup-lsp` (or `cd lsp && npm install`).

**Verify:** After `npm run setup-lsp`, `lsp/node_modules/sysml-v2-lsp/dist/server/server.js` exists; index-and-map and CLI analyze use it without env.

---

### Step 4: Documentation

- **README / INSTALL:** “Canonical LSP for this repo is in **`lsp/`**. Run `npm run setup-lsp` (or `cd lsp && npm install`). No need to set `SYSMLLSP_SERVER_PATH` when using the default.”
- **`lsp/README.md`:** “This is the **only** LSP used by sysmledgraph when present; root `node_modules` is fallback.”
- **docs/MCP_SERVER_FOR_CURSOR.md**, **docs/MCP_INTERACTION_GUIDE.md:** When running from this repo, LSP is in `lsp/` and is picked automatically after `setup-lsp` (or equivalent).

**Verify:** New contributors can follow README and get indexing working without setting env.

---

### Step 5 (optional): Root no longer depends on sysml-v2-lsp

- Remove **sysml-v2-lsp** from root **devDependencies**; only **`lsp/`** has it.
- **Caveat:** Root code that imports sysml-v2-lsp (e.g. validate script / MCP client) must be updated (resolve from `lsp/` or spawn MCP server from `lsp/`). Defer until Step 1–4 are done and dependencies are clear.

---

## Success criteria

- [ ] **Default path:** With `lsp/` installed and `SYSMLLSP_SERVER_PATH` unset, CLI analyze and MCP indexDbGraph use `lsp/node_modules/.../server.js`.
- [ ] **Scripts:** debug-lsp-symbols and compare-mcp-vs-lsp use the same default.
- [ ] **Install:** `npm run setup-lsp` (or documented equivalent) installs the LSP in `lsp/`.
- [ ] **Docs:** README and lsp/README state that the LSP is in `lsp/` and is only for sysmledgraph; MCP docs mention automatic use when setup is run.
- [ ] **No conflict:** Cursor can run both sysmledgraph MCP and sysml-v2 MCP; sysmledgraph’s indexing uses only the LSP in `lsp/`.

---

## Summary table

| Step | Action | Verification |
|------|--------|--------------|
| 1 | Default LSP path helper; use in lsp-client | debug-lsp-symbols works without env when lsp/ present |
| 2 | Scripts use same default (lsp/ then root) | All scripts consistent with CLI/MCP |
| 3 | setup-lsp script — Option C; document | LSP exists in lsp/ after setup; index works without env |
| 4 | README, lsp/README, MCP docs | Clear “LSP in lsp/, only for sysmledgraph” |
| 5 (opt) | Remove sysml-v2-lsp from root | Single copy in lsp/; validate/MCP client updated if needed |

**Outcome:** An LSP server lives only in **`lsp/`**, is installed via a defined step, and is used by default by CLI, MCP, and scripts. That LSP is **only for sysmledgraph**; Cursor keeps its own sysml-v2 MCP. No sharing, no single-client conflicts.
