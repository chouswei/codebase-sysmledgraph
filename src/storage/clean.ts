/**
 * Clean: delete index for path or all. Phase 2 step 9. R8: on failure report, graph unchanged.
 * Uses merged graph: single path = delete nodes for that root; all = delete DB file.
 */

import { rm } from 'fs/promises';
import { join } from 'path';
import { getMergedDbPath } from './location.js';
import { listIndexedPaths } from './list.js';
import { removeFromRegistry, clearRegistry } from './registry.js';
import { getCachedOrOpenGraphStore, closeGraphStoreCache } from '../graph/graph-store.js';

export interface CleanResult {
  ok: boolean;
  removed: string[];
  error?: string;
}

/**
 * Remove index for a single path or all paths. Updates registry.
 * Single path: delete nodes for that root from merged graph. All: delete merged DB file.
 */
export async function cleanIndex(path?: string): Promise<CleanResult> {
  const removed: string[] = [];
  try {
    if (path !== undefined && path !== '') {
      const mergedPath = getMergedDbPath();
      const store = await getCachedOrOpenGraphStore(mergedPath);
      if (store.deleteNodesForRoot) {
        await store.deleteNodesForRoot(path);
      }
      await removeFromRegistry(path);
      removed.push(path);
    } else {
      const paths = await listIndexedPaths();
      const mergedPath = getMergedDbPath();
      await closeGraphStoreCache(mergedPath);
      await rm(mergedPath, { recursive: true, force: true });
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
