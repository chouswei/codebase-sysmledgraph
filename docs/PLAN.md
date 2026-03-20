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

### Phase 3: Robustness — ✅ Done

6. **Connection retry logic** — LSP: `getDocumentSymbolsFromLsp` retries `createLspClient()` once after 1.5s on failure. MCP: `getSymbolsFromMcp` retries the getSymbols call once after 1s on failure; still returns [] if unavailable.
7. **Better error reporting** — When **`DEBUG_SYSMLEGRAPH_SYMBOLS=1`**, log to stderr per file whether symbols came from LSP or MCP (and count for MCP). LSP errors still fall through to MCP; no custom error types added.

### Phase 4: Validation & Documentation

8. **Validate the requested file** (optional)
   - Use MCP `validate` tool on `deploy-modelbase-development.sysml`
   - Report syntax errors, semantic issues

9. **Documentation** — Done in v0.4.3: fixes in `MCP_INTERACTION_GUIDE.md`, "no edges" and troubleshooting, `lsp/` usage in README and release notes. Further troubleshooting can be added as needed.

## Next Steps (Phase 4)

1. **Optional:** MCP `validate` on a SysML file; expand troubleshooting in docs (Phase 4).

## Success Criteria

- ✅ `graph-map.md` shows symbol nodes (Package, PartDef, Action, etc.) not just Document
- ✅ Interconnection table has edges (IN_DOCUMENT, IN_PACKAGE)
- ✅ Indexing writes data correctly (LSP + optional MCP fallback)
- ⏳ Validation script for SysML files (script exists; MCP validate integration optional)
