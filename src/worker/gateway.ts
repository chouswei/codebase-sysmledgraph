/**
 * Graph gateway: when SYSMLEDGRAPH_USE_WORKER=1, all graph operations go through the worker; otherwise use in-process handlers.
 * MCP server and CLI call these functions instead of the handlers directly.
 */

import { getStorageRoot } from '../storage/location.js';
import { startWorker, request, useWorker } from './client.js';
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

async function ensureWorker(): Promise<void> {
  await startWorker(getStorageRoot());
}

export async function listIndexed(): Promise<{ ok: boolean; paths?: string[]; error?: string }> {
  if (useWorker()) {
    await ensureWorker();
    return request('list_indexed');
  }
  return handleListIndexed();
}

export async function index(args: { path?: string; paths?: string[] }): Promise<{ ok: boolean; filesProcessed?: number; error?: string }> {
  if (useWorker()) {
    await ensureWorker();
    return request('index', args);
  }
  return handleIndexDbGraph(args);
}

export async function clean(args: { path?: string }): Promise<{ ok: boolean; removed?: string[]; error?: string }> {
  if (useWorker()) {
    await ensureWorker();
    return request('clean', args);
  }
  return handleCleanIndex(args);
}

export async function cypher(args: { query: string }): Promise<{ ok: boolean; rows?: unknown[]; error?: string }> {
  if (useWorker()) {
    await ensureWorker();
    return request('cypher', args);
  }
  return handleCypher(args);
}

export async function query(args: { query: string; kind?: string }): Promise<{ ok: boolean; nodes?: unknown[]; error?: string }> {
  if (useWorker()) {
    await ensureWorker();
    return request('query', args);
  }
  return handleQuery(args);
}

export async function context(args: { name: string }): Promise<{ ok: boolean; node?: unknown; edges?: unknown[]; error?: string }> {
  if (useWorker()) {
    await ensureWorker();
    return request('context', args);
  }
  return handleContext(args);
}

export async function impact(args: { target: string; direction?: 'upstream' | 'downstream' }): Promise<{ ok: boolean; nodes?: unknown[]; error?: string }> {
  if (useWorker()) {
    await ensureWorker();
    return request('impact', args);
  }
  return handleImpact(args);
}

export async function rename(args: { symbol: string; newName: string; dry_run?: boolean }): Promise<{ ok: boolean; preview?: { path: string; count: number }[]; message?: string; error?: string }> {
  if (useWorker()) {
    await ensureWorker();
    return request('rename', args);
  }
  return handleRename(args);
}

export async function generateMap(args?: { output_path?: string }): Promise<{ ok: boolean; markdown?: string; error?: string }> {
  if (useWorker()) {
    await ensureWorker();
    return request('generateMap', args ?? {});
  }
  return handleGenerateMap(args ?? {});
}

/** Context resource content (for MCP resource). When using worker, fetches from worker. */
export async function getContextContent(path?: string): Promise<string> {
  if (useWorker()) {
    await ensureWorker();
    const res = await request<{ content: string }>('getContextContent', { path });
    return res?.content ?? '';
  }
  return getContextContentLocal(path);
}

export { useWorker, closeWorker } from './client.js';
