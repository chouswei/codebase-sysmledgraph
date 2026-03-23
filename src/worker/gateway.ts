/**
 * Graph gateway: routes graph ops to long-lived TCP daemon, stdio worker, or in-process handlers.
 * Priority: SYSMLEGRAPH_WORKER_URL / worker.port → SYSMLEDGRAPH_USE_WORKER=1 (stdio) → in-process.
 */

import { getStorageRoot } from '../storage/location.js';
import { startWorker, request, useWorker, closeWorker } from './client.js';
import {
  useLongLivedWorkerSync,
  workerStrictSync,
  ensureLongLivedClient,
  requestLongLived,
  closeLongLivedClient,
} from './socket-client.js';
import { handleListIndexed } from '../mcp/tools/list-indexed.js';
import { handleIndexDbGraph } from '../mcp/tools/index-db-graph.js';
import { handleCleanIndex } from '../mcp/tools/clean-index.js';
import { handleCypher } from '../mcp/tools/cypher.js';
import { handleQuery } from '../mcp/tools/query.js';
import { handleContext } from '../mcp/tools/context.js';
import { handleImpact } from '../mcp/tools/impact.js';
import { handleRename } from '../mcp/tools/rename.js';
import { handleGenerateMap } from '../mcp/tools/generate-map.js';
import { getContextContent as getContextContentLocal } from '../mcp/resources/context.js';

function strictError<T extends { ok: boolean; error?: string }>(err: unknown): T {
  const msg = err instanceof Error ? err.message : String(err);
  return { ok: false, error: msg } as T;
}

async function routeLongLivedOrStdioOrDirect<T>(
  method: string,
  params: Record<string, unknown> | undefined,
  direct: () => Promise<T>
): Promise<T> {
  if (useLongLivedWorkerSync()) {
    try {
      await ensureLongLivedClient();
      return await requestLongLived<T>(method, params);
    } catch (err) {
      if (workerStrictSync()) {
        return strictError(err) as T;
      }
    }
  }
  if (useWorker()) {
    await startWorker(getStorageRoot());
    return request<T>(method, params);
  }
  return direct();
}

export async function listIndexed(): Promise<{ ok: boolean; paths?: string[]; error?: string }> {
  return routeLongLivedOrStdioOrDirect('list_indexed', undefined, () => handleListIndexed());
}

export async function index(args: { path?: string; paths?: string[] }): Promise<{ ok: boolean; filesProcessed?: number; error?: string }> {
  return routeLongLivedOrStdioOrDirect('index', args, () => handleIndexDbGraph(args));
}

export async function clean(args: { path?: string }): Promise<{ ok: boolean; removed?: string[]; error?: string }> {
  return routeLongLivedOrStdioOrDirect('clean', args, () => handleCleanIndex(args));
}

export async function cypher(args: { query: string }): Promise<{ ok: boolean; rows?: unknown[]; error?: string }> {
  return routeLongLivedOrStdioOrDirect('cypher', args, () => handleCypher(args));
}

export async function query(args: { query: string; kind?: string }): Promise<{ ok: boolean; nodes?: unknown[]; error?: string }> {
  return routeLongLivedOrStdioOrDirect('query', args, () => handleQuery(args));
}

export async function context(args: { name: string }): Promise<{ ok: boolean; node?: unknown; edges?: unknown[]; error?: string }> {
  return routeLongLivedOrStdioOrDirect('context', args, () => handleContext(args));
}

export async function impact(args: { target: string; direction?: 'upstream' | 'downstream' }): Promise<{ ok: boolean; nodes?: unknown[]; error?: string }> {
  return routeLongLivedOrStdioOrDirect('impact', args, () => handleImpact(args));
}

export async function rename(args: { symbol: string; newName: string; dry_run?: boolean }): Promise<{ ok: boolean; preview?: { path: string; count: number }[]; message?: string; error?: string }> {
  return routeLongLivedOrStdioOrDirect('rename', args, () => handleRename(args));
}

export async function generateMap(args?: { output_path?: string }): Promise<{ ok: boolean; markdown?: string; error?: string }> {
  const p = args ?? {};
  return routeLongLivedOrStdioOrDirect('generateMap', p, () => handleGenerateMap(p));
}

export async function getContextContent(path?: string): Promise<string> {
  if (useLongLivedWorkerSync()) {
    try {
      await ensureLongLivedClient();
      const res = await requestLongLived<{ content: string }>('getContextContent', { path });
      return res?.content ?? '';
    } catch (err) {
      if (workerStrictSync()) throw err instanceof Error ? err : new Error(String(err));
    }
  }
  if (useWorker()) {
    await startWorker(getStorageRoot());
    const res = await request<{ content: string }>('getContextContent', { path });
    return res?.content ?? '';
  }
  return getContextContentLocal(path);
}

/** Close stdio worker and/or long-lived TCP client (does not stop the daemon). */
export function closeGraphClient(): void {
  closeLongLivedClient();
  closeWorker();
}

export { useWorker, closeWorker } from './client.js';
export { useLongLivedWorkerSync, workerStrictSync } from './socket-client.js';
