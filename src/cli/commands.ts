/**
 * CLI commands: analyze (index), list, clean. Phase 4 step 15.
 * R8: on failure exit non-zero and write to stderr.
 * When SYSMLEDGRAPH_USE_WORKER=1, all graph ops go through the worker; worker is closed after each command.
 */

import { resolve } from 'path';
import { setStorageRoot, getStorageRoot, getDbPathForIndexedPath } from '../storage/location.js';
import { listIndexedPaths } from '../storage/list.js';
import { cleanIndex } from '../storage/clean.js';
import { addToRegistry } from '../storage/registry.js';
import { openGraphStore } from '../graph/graph-store.js';
import { runIndexer } from '../indexer/indexer.js';
import { useWorker, index, listIndexed, clean, closeWorker } from '../worker/gateway.js';

export function configureStorageRoot(root: string | undefined): void {
  if (root) setStorageRoot(root);
}

export async function cmdAnalyze(paths: string[]): Promise<{ ok: boolean; filesProcessed?: number; error?: string }> {
  if (paths.length === 0) {
    return { ok: false, error: 'At least one path required' };
  }
  const resolved = paths.map((raw) => resolve(raw));
  if (useWorker()) {
    try {
      return await index({ paths: resolved });
    } finally {
      closeWorker();
    }
  }
  const dbPath = getDbPathForIndexedPath(resolved[0]);
  const store = await openGraphStore(dbPath);
  let totalProcessed = 0;
  for (const p of resolved) {
    if (store.deleteNodesForRoot) await store.deleteNodesForRoot(p);
    const result = await runIndexer(store, { roots: [p] });
    if (!result.ok) return { ok: false, filesProcessed: totalProcessed, error: result.error };
    totalProcessed += result.filesProcessed;
    await addToRegistry(p, new Date().toISOString());
  }
  return { ok: true, filesProcessed: totalProcessed };
}

export async function cmdList(): Promise<{ ok: boolean; paths: string[]; error?: string }> {
  if (useWorker()) {
    try {
      const r = await listIndexed();
      return r.ok ? { ok: true, paths: r.paths ?? [] } : { ok: false, paths: [], error: r.error };
    } finally {
      closeWorker();
    }
  }
  try {
    const paths = await listIndexedPaths();
    return { ok: true, paths };
  } catch (err) {
    return { ok: false, paths: [], error: err instanceof Error ? err.message : String(err) };
  }
}

export async function cmdClean(path: string | undefined): Promise<{ ok: boolean; error?: string }> {
  if (useWorker()) {
    try {
      const result = await clean({ path });
      return result.ok ? { ok: true } : { ok: false, error: result.error };
    } finally {
      closeWorker();
    }
  }
  const result = await cleanIndex(path);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true };
}

export function getStorageRootPath(): string {
  return getStorageRoot();
}
