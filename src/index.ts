/**
 * Main entry exports for programmatic use.
 */

export * from './types.js';
export { findSysmlFiles } from './discovery/find-sysml.js';
export { applyLoadOrder } from './discovery/load-order.js';
export { runIndexer } from './indexer/indexer.js';
export { openGraphStore } from './graph/graph-store.js';
export { getStorageRoot, setStorageRoot, getDbPathForIndexedPath } from './storage/location.js';
export { listIndexedPaths } from './storage/list.js';
export { cleanIndex } from './storage/clean.js';
export { readRegistry, addToRegistry, removeFromRegistry, clearRegistry } from './storage/registry.js';
