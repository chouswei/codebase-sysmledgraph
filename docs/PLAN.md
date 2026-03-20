# Plan: LSP Client Fixes & Indexing

**Released:** v0.4.3 (2026-03-19) — see `release-notes-v0.4.3.md`.

## Current Status

✅ **Completed:**
- Fixed LSP client: added `--stdio` flag, Windows spawn (`cmd /c`), timeouts, error handling
- Created `lsp/` folder with dedicated npm install for isolated LSP server init
- Added MCP fallback: when LSP returns no symbols, automatically tries MCP `getSymbols` (shared client per index run)
- Added LSP capabilities: `hierarchicalDocumentSymbolSupport`, `workspaceFolders`
- Added SymbolInformation support: normalize flat list with `containerName` to DocumentSymbol-like shape
- Added LSP SymbolKind fallback: map numeric `kind` to label when `detail` is missing
- Enhanced symbol mapping: added MCP-style kind strings ("Part Definition", etc.) with normalized lookup
- Analyzed MCP client template patterns
- **✅ Phase 1 Complete:** LSP client returns symbols; graph has symbol nodes and edges (IN_DOCUMENT, IN_PACKAGE)
- **✅ Phase 2 Complete:** LSP notification handler (e.g. `window/logMessage` when `DEBUG_LSP_NOTIFICATIONS=1`); indexed `modelbase-development/models/`; `graph-map.md` generated with full nodes and interconnection table
- **✅ CLI exit fix:** (1) Explicit graph store close in `cmdAnalyze` (try/finally). (2) After successful analyze, CLI calls `process.exit(0)` so the process exits before Node/Kuzu teardown (avoids Windows access violation). Verified: `node scripts/index-and-map.mjs test/fixtures/sysml` completes with exit 0 and writes `graph-map.md`.

## Plan

### Phase 1: Test & Verify — ✅ Done

1. Rebuild and test LSP client; run index-and-map.
2. Verify `graph-map.md` has symbol nodes and edges.
3. Debug LSP/MCP via `scripts/debug-lsp-symbols.mjs` if needed.

### Phase 2: Notification Handlers & Larger Models — ✅ Done

4. **LSP notification handler** — Handler added in `lsp-client.ts`; `window/logMessage` and `window/showMessage` logged when `DEBUG_LSP_NOTIFICATIONS=1`.
5. **Real SysML files** — Indexed `modelbase-development/models/` (4 files); map shows Action, Block, Package, PartDef, PartUsage, RequirementDef and IN_DOCUMENT/IN_PACKAGE edges.

### Phase 3: Robustness (If Needed)

6. **Connection retry logic**
   - If LSP client fails to initialize, retry once (transient failures)
   - If MCP init times out, retry with longer timeout or skip gracefully

7. **Better error reporting**
   - Map LSP errors to specific types (like template maps `UnauthorizedError`)
   - Log which path succeeded (LSP vs MCP) for debugging

### Phase 4: Validation & Documentation

8. **Validate the requested file** (optional)
   - Use MCP `validate` tool on `deploy-modelbase-development.sysml`
   - Report syntax errors, semantic issues

9. **Documentation** — Done in v0.4.3: fixes in `MCP_INTERACTION_GUIDE.md`, "no edges" and troubleshooting, `lsp/` usage in README and release notes. Further troubleshooting can be added as needed.

## Next Steps (Phase 3 / 4)

1. **Optional:** Connection retry and clearer error reporting (Phase 3).
2. **Optional:** MCP `validate` on a SysML file; expand troubleshooting in docs (Phase 4).

## Success Criteria

- ✅ `graph-map.md` shows symbol nodes (Package, PartDef, Action, etc.) not just Document
- ✅ Interconnection table has edges (IN_DOCUMENT, IN_PACKAGE)
- ✅ Indexing writes data correctly (LSP + optional MCP fallback)
- ⏳ Validation script for SysML files (script exists; MCP validate integration optional)
