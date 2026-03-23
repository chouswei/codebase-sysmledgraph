/**
 * Graph worker: single process that owns the Kuzu DB. Listens for NDJSON commands on stdin, writes NDJSON responses to stdout.
 * Run as: node dist/src/worker/graph-worker.js
 * First message must be init with params.storageRoot. Then any method supported by dispatch.
 */

import { createInterface } from 'readline';
import { setStorageRoot } from '../storage/location.js';
import { dispatch } from './dispatch.js';
import type { WorkerRequest, WorkerResponse, WorkerResponseErr } from './protocol.js';
import { isWorkerResponseErr } from './protocol.js';

let initialized = false;

function respond(obj: WorkerResponse): void {
  process.stdout.write(JSON.stringify(obj) + '\n');
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
