/**
 * Main entry exports for programmatic use.
 */

export * from './types.js';
export { findSysmlFiles } from './discovery/find-sysml.js';
export { applyLoadOrder } from './discovery/load-order.js';
export { runIndexer } from './indexer/indexer.js';
export {
  openGraphStore,
  getCachedOrOpenGraphStore,
  invalidateGraphStoreCache,
  closeGraphStoreCache,
} from './graph/graph-store.js';
export { getStorageRoot, setStorageRoot, getDbPathForIndexedPath, getMergedDbPath } from './storage/location.js';
export { listIndexedPaths } from './storage/list.js';
export { cleanIndex } from './storage/clean.js';
export { readRegistry, readRegistryFull, addToRegistry, removeFromRegistry, clearRegistry } from './storage/registry.js';
export {
  createSysmlMcpClient,
  getMcpServerPath,
  type SysmlMcpClientOptions,
  type ParseResult,
  type ValidateResult,
  type SymbolInfo,
  type GetSymbolsResult,
} from './parser/sysml-mcp-client.js';
