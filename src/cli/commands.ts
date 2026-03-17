/**
 * CLI commands: analyze (index), list, clean. Phase 4 step 15.
 * R8: on failure exit non-zero and write to stderr.
 */

import { resolve } from 'path';
import { setStorageRoot, getStorageRoot, getDbPathForIndexedPath } from '../storage/location.js';
import { listIndexedPaths } from '../storage/list.js';
import { cleanIndex } from '../storage/clean.js';
import { addToRegistry } from '../storage/registry.js';
import { checkAlignment } from '../storage/alignment.js';
import { openGraphStore } from '../graph/graph-store.js';
import { runIndexer } from '../indexer/indexer.js';

export function configureStorageRoot(root: string | undefined): void {
  if (root) setStorageRoot(root);
}

export async function cmdAnalyze(paths: string[]): Promise<{ ok: boolean; error?: string }> {
  if (paths.length === 0) {
    return { ok: false, error: 'At least one path required' };
  }
  for (const raw of paths) {
    const p = resolve(raw);
    const dbPath = getDbPathForIndexedPath(p);
    const store = await openGraphStore(dbPath);
    const result = await runIndexer(store, { roots: [p] });
    if (!result.ok) return { ok: false, error: result.error };
    await addToRegistry(p, new Date().toISOString());
  }
  return { ok: true };
}

export async function cmdList(): Promise<{ ok: boolean; paths: string[]; error?: string }> {
  try {
    const paths = await listIndexedPaths();
    return { ok: true, paths };
  } catch (err) {
    return { ok: false, paths: [], error: err instanceof Error ? err.message : String(err) };
  }
}

export async function cmdClean(path: string | undefined): Promise<{ ok: boolean; error?: string }> {
  const result = await cleanIndex(path);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true };
}

export async function cmdCheck(): Promise<{ ok: boolean; aligned: boolean; message: string; stalePaths: string[]; error?: string }> {
  try {
    const result = await checkAlignment();
    return {
      ok: true,
      aligned: result.aligned,
      message: result.message,
      stalePaths: result.stalePaths,
    };
  } catch (err) {
    return {
      ok: false,
      aligned: false,
      message: '',
      stalePaths: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function getStorageRootPath(): string {
  return getStorageRoot();
}
