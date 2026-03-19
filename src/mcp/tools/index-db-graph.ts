/**
 * MCP tool: indexDbGraph – build graph from path(s).
 * Relative paths are resolved against process.cwd() so one canonical DB per logical path.
 */

import { resolve } from 'path';
import { getDbPathForIndexedPath } from '../../storage/location.js';
import { addToRegistry } from '../../storage/registry.js';
import { getCachedOrOpenGraphStore } from '../../graph/graph-store.js';
import { runIndexer } from '../../indexer/indexer.js';

function toAbsolutePath(p: string): string {
  const isAbsolute = p.startsWith('/') || /^[A-Za-z]:[/\\]/.test(p);
  return isAbsolute ? p : resolve(process.cwd(), p);
}

export interface IndexDbGraphArgs {
  path?: string;
  paths?: string[];
}

export async function handleIndexDbGraph(args: IndexDbGraphArgs): Promise<{ ok: boolean; filesProcessed?: number; error?: string }> {
  const rawPaths = args.paths ?? (args.path ? [args.path] : []);
  if (rawPaths.length === 0) {
    return { ok: false, error: 'At least one path required (path or paths)' };
  }
  const paths = rawPaths.map(toAbsolutePath);
  const dbPath = getDbPathForIndexedPath(paths[0]);
  const store = await getCachedOrOpenGraphStore(dbPath);
  for (const p of paths) {
    if (store.deleteNodesForRoot) await store.deleteNodesForRoot(p);
    const result = await runIndexer(store, { roots: [p] });
    if (!result.ok) return { ok: false, error: result.error };
    await addToRegistry(p, new Date().toISOString());
  }
  return { ok: true, filesProcessed: paths.length };
}
