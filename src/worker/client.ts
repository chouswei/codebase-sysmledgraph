/**
 * Client for the graph worker. Spawns the worker process, sends init, then request(method, params) for each call.
 * Only one process owns the DB; this process just sends commands and receives results.
 */

import { spawn } from 'child_process';
import { createInterface } from 'readline';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import type { WorkerRequest, WorkerResponse, WorkerResponseErr } from './protocol.js';
import { isWorkerResponseErr } from './protocol.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** When true, MCP and CLI should use the worker for all graph operations. */
export function useWorker(): boolean {
  return process.env.SYSMLEDGRAPH_USE_WORKER === '1';
}

let nextId = 1;
const pending = new Map<number, { resolve: (r: unknown) => void; reject: (e: Error) => void }>();

let workerProcess: ReturnType<typeof spawn> | null = null;
let rl: ReturnType<typeof createInterface> | null = null;

function getWorkerPath(): string {
  const nextToClient = join(__dirname, 'graph-worker.js');
  if (existsSync(nextToClient)) return nextToClient;
  return join(process.cwd(), 'dist', 'src', 'worker', 'graph-worker.js');
}

/**
 * Start the worker with the given storage root. Idempotent: if already started with same root, does nothing.
 * Call from MCP server or CLI after setStorageRoot has been set (so getStorageRoot() is correct).
 */
export async function startWorker(storageRoot: string): Promise<void> {
  if (workerProcess != null) return;
  const workerJs = getWorkerPath();
  const child = spawn(process.execPath, [workerJs], {
    stdio: ['pipe', 'pipe', 'inherit'],
    env: { ...process.env },
  });
  workerProcess = child;
  rl = createInterface({ input: child.stdout!, terminal: false });
  rl.on('line', (line) => {
    try {
      const res = JSON.parse(line) as WorkerResponse;
      const id = res.id;
      const p = pending.get(id);
      if (p) {
        pending.delete(id);
        if (isWorkerResponseErr(res)) p.reject(new Error(res.error));
        else p.resolve((res as { id: number; result: unknown }).result);
      }
    } catch {
      // ignore malformed lines
    }
  });
  child.on('error', (err) => {
    for (const [, p] of pending) p.reject(err);
    pending.clear();
  });
  child.on('exit', (code) => {
    workerProcess = null;
    rl = null;
    if (code != null && code !== 0) {
      for (const [, p] of pending) p.reject(new Error(`Worker exited with code ${code}`));
      pending.clear();
    }
  });
  // Send init
  const initReq: WorkerRequest = { id: 0, method: 'init', params: { storageRoot } };
  child.stdin!.write(JSON.stringify(initReq) + '\n');
  await new Promise<void>((resolve, reject) => {
    const onLine = (line: string) => {
      try {
        const res = JSON.parse(line) as WorkerResponse;
        if (res.id === 0) {
          rl!.off('line', onLine);
          if (isWorkerResponseErr(res)) reject(new Error(res.error));
          else resolve();
        }
      } catch {
        // continue
      }
    };
    rl!.on('line', onLine);
  });
}

/**
 * Send a request to the worker and return the result. startWorker(storageRoot) must have been called first.
 */
export function request<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T> {
  if (workerProcess == null || workerProcess.stdin == null) {
    return Promise.reject(new Error('Worker not started; call startWorker(storageRoot) first'));
  }
  const id = nextId++;
  const req: WorkerRequest = { id, method, params };
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (r: unknown) => void, reject });
    workerProcess!.stdin!.write(JSON.stringify(req) + '\n');
  });
}

/**
 * Close the worker (close stdin so it exits). Call when the app is done (e.g. CLI after one command).
 */
export function closeWorker(): void {
  if (workerProcess != null && workerProcess.stdin != null) {
    workerProcess.stdin.end();
    workerProcess = null;
  }
  if (rl != null) {
    rl.close();
    rl = null;
  }
  for (const [, p] of pending) p.reject(new Error('Worker closed'));
  pending.clear();
}

export function isWorkerRunning(): boolean {
  return workerProcess != null;
}
