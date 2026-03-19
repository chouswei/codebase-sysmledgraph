/**
 * MCP tool: clean_index – remove index for path or all.
 */

import { getDbPathForIndexedPath } from '../../storage/location.js';
import { listIndexedPaths } from '../../storage/list.js';
import { cleanIndex } from '../../storage/clean.js';
import { invalidateGraphStoreCache } from '../../graph/graph-store.js';

export interface CleanIndexArgs {
  path?: string;
}

export async function handleCleanIndex(args: CleanIndexArgs): Promise<{ ok: boolean; removed?: string[]; error?: string }> {
  if (args.path !== undefined && args.path !== '') {
    invalidateGraphStoreCache(getDbPathForIndexedPath(args.path));
  } else {
    const paths = await listIndexedPaths();
    for (const p of paths) invalidateGraphStoreCache(getDbPathForIndexedPath(p));
  }
  const result = await cleanIndex(args.path);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, removed: result.removed };
}
