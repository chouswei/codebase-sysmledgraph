# Plan: LSP Client Fixes & Indexing

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
- **✅ Phase 1 Complete:** LSP client now returns symbols correctly; graph has symbol nodes (Package, PartDef) and edges (IN_DOCUMENT, IN_PACKAGE)

⚠️ **Minor Issue:**
- CLI may exit non-zero after successful indexing (cleanup/close issue), but data is written correctly

## Plan

### Phase 1: Test & Verify (Immediate)

1. **Rebuild and test LSP client**
   ```bash
   npm run build
   node lsp/test-server.mjs  # Should work (already tested)
   ```

2. **Test index-and-map with fixed client**
   ```bash
   npm run index-and-map
   ```
   - Check if LSP now returns symbols (with `--stdio`, proper cwd, timeouts)
   - If LSP still returns empty, MCP fallback should kick in
   - Verify `graph-map.md` has symbol nodes and edges

3. **If still no edges:**
   - Run `node scripts/debug-lsp-symbols.mjs` to see raw LSP response
   - Check if MCP fallback is being called (add logging)
   - Verify MCP client init succeeds (may need longer timeout or different approach)

### Phase 2: Notification Handlers (From Template Analysis)

4. **Add LSP notification handlers**
   - If server sends `window/logMessage`, register handler instead of ignoring
   - Log notifications for debugging
   - Pattern from template: `client.setNotificationHandler(schema, handler)`

5. **Test with real SysML files**
   - Index `modelbase-development/models/` (larger, more symbols)
   - Validate specific file: `deploy-modelbase-development.sysml`
   - Check if edges appear with more complex models

### Phase 3: Robustness (If Needed)

6. **Connection retry logic**
   - If LSP client fails to initialize, retry once (transient failures)
   - If MCP init times out, retry with longer timeout or skip gracefully

7. **Better error reporting**
   - Map LSP errors to specific types (like template maps `UnauthorizedError`)
   - Log which path succeeded (LSP vs MCP) for debugging

### Phase 4: Validation & Documentation

8. **Validate the requested file**
   - Use MCP `validate` tool on `deploy-modelbase-development.sysml`
   - Report syntax errors, semantic issues

9. **Update documentation**
   - Document the fixes in `MCP_INTERACTION_GUIDE.md`
   - Add troubleshooting section for "no edges" issue
   - Document `lsp/` folder usage

## Immediate Next Steps

1. **Rebuild TypeScript**
2. **Run index-and-map** to see if fixes work
3. **Check graph-map.md** for symbol nodes and edges
4. **If still empty:** Debug LSP response and MCP fallback

## Success Criteria

- ✅ `graph-map.md` shows symbol nodes (Package, PartDef, etc.) not just Document
- ✅ Interconnection table has edges (IN_DOCUMENT, IN_PACKAGE)
- ✅ Indexing completes without timeouts
- ✅ Validation script works for SysML files
