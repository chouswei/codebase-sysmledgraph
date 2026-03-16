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

/**
 * Resolve DB path for an indexed root path.
 * Strategy: global registry under storage root; DB per path (path hashed or path as dir name).
 * For simplicity we use path as dir name (sanitized). Caller ensures path is absolute/normalized.
 */
export function getDbPathForIndexedPath(indexedPath: string): string {
  const sanitized = indexedPath.replace(/[:\\/]/g, '_').replace(/_+/g, '_') || 'root';
  return join(storageRoot, 'db', sanitized + '.kuzu');
}
