/**
 * Storage location: resolve DB path (per-path or global registry).
 * Phase 2 step 7. Decision documented in README.
 */

import { join } from 'path';
import { homedir } from 'os';

const DEFAULT_STORAGE_ROOT = join(homedir(), '.sysmledgraph');

let storageRoot: string = DEFAULT_STORAGE_ROOT;

/**
 * Set storage root (e.g. from env SYSMEDGRAPH_STORAGE_ROOT or config).
 */
export function setStorageRoot(root: string): void {
  storageRoot = root;
}

/**
 * Get current storage root.
 */
export function getStorageRoot(): string {
  return storageRoot;
}

/** Single merged graph DB path (plan step 8: one merged graph with path on Document nodes). */
const MERGED_DB_FILENAME = 'graph.kuzu';

/**
 * Path of the single merged graph DB. All indexed paths share this DB; nodes carry a path property.
 */
export function getMergedDbPath(): string {
  return join(storageRoot, 'db', MERGED_DB_FILENAME);
}

/**
 * Resolve DB path for an indexed root path.
 * Strategy: one merged graph (all paths in one DB); path is stored on Node.path. Caller ensures path is absolute/normalized.
 */
export function getDbPathForIndexedPath(_indexedPath: string): string {
  return getMergedDbPath();
}
