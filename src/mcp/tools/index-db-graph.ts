/**
 * MCP tool: indexDbGraph – build graph from path(s).
 */

import { getDbPathForIndexedPath } from '../../storage/location.js';
import { addToRegistry } from '../../storage/registry.js';
import { getCachedOrOpenGraphStore, invalidateGraphStoreCache } from '../../graph/graph-store.js';
import { runIndexer } from '../../indexer/indexer.js';

export interface IndexDbGraphArgs {
  path?: string;
  paths?: string[];
}

export async function handleIndexDbGraph(args: IndexDbGraphArgs): Promise<{ ok: boolean; filesProcessed?: number; error?: string }> {
  const paths = args.paths ?? (args.path ? [args.path] : []);
  if (paths.length === 0) {
    return { ok: false, error: 'At least one path required (path or paths)' };
  }
  for (const p of paths) {
    const dbPath = getDbPathForIndexedPath(p);
    invalidateGraphStoreCache(dbPath);
    const store = await getCachedOrOpenGraphStore(dbPath);
    const result = await runIndexer(store, { roots: [p] });
    if (!result.ok) return { ok: false, error: result.error };
    await addToRegistry(p);
  }
  return { ok: true, filesProcessed: paths.length };
}
