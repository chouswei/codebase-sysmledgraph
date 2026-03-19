/**
 * Graph worker: single process that owns the Kuzu DB. Listens for NDJSON commands on stdin, writes NDJSON responses to stdout.
 * Run as: node dist/worker/graph-worker.js
 * First message must be init with params.storageRoot. Then any method supported by the handlers.
 */

import { createInterface } from 'readline';
import { setStorageRoot } from '../storage/location.js';
import { listIndexedPaths } from '../storage/list.js';
import { handleListIndexed } from '../mcp/tools/list-indexed.js';
import { handleIndexDbGraph } from '../mcp/tools/index-db-graph.js';
import { handleCleanIndex } from '../mcp/tools/clean-index.js';
import { handleCypher } from '../mcp/tools/cypher.js';
import { handleQuery } from '../mcp/tools/query.js';
import { handleContext } from '../mcp/tools/context.js';
import { handleImpact } from '../mcp/tools/impact.js';
import { handleRename } from '../mcp/tools/rename.js';
import { handleGenerateMap } from '../mcp/tools/generate-map.js';
import { getContextContent } from '../mcp/resources/context.js';
import type { WorkerRequest, WorkerResponse, WorkerResponseErr } from './protocol.js';
import { isWorkerResponseErr } from './protocol.js';

let initialized = false;

function respond(obj: WorkerResponse): void {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

async function dispatch(method: string, params: Record<string, unknown> | undefined): Promise<unknown> {
  const p = params ?? {};
  switch (method) {
    case 'listIndexedPaths': {
      const paths = await listIndexedPaths();
      return { paths };
    }
    case 'index':
      return handleIndexDbGraph(p as { path?: string; paths?: string[] });
    case 'clean':
      return handleCleanIndex(p as { path?: string });
    case 'cypher':
      return handleCypher(p as { query: string });
    case 'query':
      return handleQuery(p as { query: string; kind?: string });
    case 'context':
      return handleContext(p as { name: string });
    case 'impact':
      return handleImpact(p as { target: string; direction?: 'upstream' | 'downstream' });
    case 'rename':
      return handleRename(p as { symbol: string; newName: string; dry_run?: boolean });
    case 'generateMap':
      return handleGenerateMap(p as { output_path?: string });
    case 'list_indexed':
      return handleListIndexed();
    case 'getContextContent': {
      const text = await getContextContent(p.path as string | undefined);
      return { content: text };
    }
    default:
      throw new Error(`Unknown method: ${method}`);
  }
}

function run(): void {
  const rl = createInterface({ input: process.stdin, terminal: false });
  rl.on('line', async (line) => {
    let req: WorkerRequest;
    try {
      req = JSON.parse(line) as WorkerRequest;
    } catch {
      respond({ id: 0, error: 'Invalid JSON' } as WorkerResponseErr);
      return;
    }
    const id = typeof req.id === 'number' ? req.id : 0;
    if (req.method === 'init') {
      const root = (req.params?.storageRoot as string) ?? '';
      if (root) setStorageRoot(root);
      initialized = true;
      respond({ id, result: {} });
      return;
    }
    if (!initialized) {
      respond({ id, error: 'Not initialized; send init first' } as WorkerResponseErr);
      return;
    }
    try {
      const result = await dispatch(req.method, req.params as Record<string, unknown> | undefined);
      respond({ id, result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      respond({ id, error: msg } as WorkerResponseErr);
    }
  });
}

run();
