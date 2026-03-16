/**
 * Clean: delete index for path or all. Phase 2 step 9. R8: on failure report, graph unchanged.
 */

import { rm } from 'fs/promises';
import { join } from 'path';
import { getStorageRoot, getDbPathForIndexedPath } from './location.js';
import { listIndexedPaths } from './list.js';
import { removeFromRegistry, clearRegistry } from './registry.js';

export interface CleanResult {
  ok: boolean;
  removed: string[];
  error?: string;
}

/**
 * Remove index for a single path or all paths. Updates registry.
 */
export async function cleanIndex(path?: string): Promise<CleanResult> {
  const removed: string[] = [];
  try {
    if (path !== undefined && path !== '') {
      const dbPath = getDbPathForIndexedPath(path);
      await rm(dbPath, { recursive: true, force: true });
      await removeFromRegistry(path);
      removed.push(path);
    } else {
      const paths = await listIndexedPaths();
      const root = getStorageRoot();
      const dbDir = join(root, 'db');
      await rm(dbDir, { recursive: true, force: true });
      await clearRegistry();
      removed.push(...paths);
    }
    return { ok: true, removed };
  } catch (err) {
    return {
      ok: false,
      removed,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
