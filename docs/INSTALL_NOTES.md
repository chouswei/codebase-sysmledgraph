# Install notes: why it can be slow and Windows workarounds

## Why install can take a long time

- **Heavy dependencies** — Kuzu, MCP SDK, Commander, fast-glob, Zod, and **sysml-v2-lsp** (GitHub dependency). A successful `npm install` often takes 1–2+ minutes due to network and disk work.
- **Failed first run** — If the first install fails (e.g. on Windows due to the LSP postinstall), you have to fix and rerun, so total time includes the failed run and the retry.
- **Two steps** — In a monorepo or when using sysmledgraph as a submodule, you may run install in the submodule, then build; both add to the total time.

---

## Issues and workarounds

### 1. sysml-v2-lsp postinstall is Unix-only

The LSP’s **postinstall** script uses Unix shell (e.g. `[ -f tsconfig.json ] && cd clients/vscode && npm install ...`). On **Windows** that is invalid (`[` is not a command), so **npm install can fail**.

**Workaround:** Run install with scripts skipped, then build sysmledgraph (you do **not** need to build the LSP inside sysmledgraph’s `node_modules` if you use an external LSP path):

```bash
npm install --ignore-scripts
npm run build
```

Then either:

- Point to a **pre-built LSP** elsewhere (recommended on Windows): set **SYSMLLSP_SERVER_PATH** to the path of your built `dist/server/server.js` (e.g. from a separate clone of sysml-v2-lsp where you ran `npm install` and `npm run build`), or  
- If you need the LSP inside this repo: clone or copy the full sysml-v2-lsp source (including grammar files) into `node_modules/sysml-v2-lsp` and run `npm run build` there manually.

### 2. Kuzu cleanup warnings on Windows

During install or uninstall, npm may report **EPERM** or “Failed to remove some directories” under `node_modules/kuzu` (long paths / nested dirs on Windows). This is **cleanup only**; the install itself usually completes. You can ignore these unless install actually fails.

### 3. No LSP build in sysmledgraph’s node_modules

When sysmledgraph is installed as a dependency (e.g. in `tools/sysmledgraph`), the **sysml-v2-lsp** package in `node_modules` may come from an npm tarball or a shallow clone that **does not include the grammar/source** (e.g. no `grammar/SysMLv2Lexer.g4`). In that case, building the LSP inside that copy fails (e.g. antlr-ng can’t find the grammar).

**Workaround:** Do **not** rely on building the LSP inside sysmledgraph’s `node_modules`. Instead:

- Build the LSP in a **separate clone** of sysml-v2-lsp (full repo with grammar), or use a pre-built LSP from another project.
- Set **SYSMLLSP_SERVER_PATH** to that LSP’s `dist/server/server.js` when running the sysmledgraph CLI or MCP.

---

## Summary

| Issue | Platform | Workaround |
|-------|----------|------------|
| Install fails (postinstall script) | Windows | `npm install --ignore-scripts` then `npm run build` |
| Slow install | All | Expected; use a pre-built LSP via SYSMLLSP_SERVER_PATH to avoid building in node_modules |
| Kuzu EPERM / “Failed to remove” | Windows | Ignore if install completed; only cleanup failed |
| LSP build fails (no grammar) | When used as dependency | Use external LSP: set SYSMLLSP_SERVER_PATH to a built `dist/server/server.js` from a full sysml-v2-lsp clone |
