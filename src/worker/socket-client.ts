/**
 * TCP client for the long-lived graph daemon. NDJSON over socket (same protocol as stdio worker).
 */

import { createConnection, type Socket } from 'net';
import { createInterface } from 'readline';
import { readFileSync, existsSync } from 'fs';
import { getStorageRoot, getWorkerPortPath } from '../storage/location.js';
import type { WorkerRequest, WorkerResponse, WorkerResponseErr } from './protocol.js';
import { isWorkerResponseErr } from './protocol.js';

const CONNECT_TIMEOUT_MS = 5000;
const DEFAULT_HOST = '127.0.0.1';

let nextId = 1;
const pending = new Map<number, { resolve: (r: unknown) => void; reject: (e: Error) => void }>();

let socket: Socket | null = null;
let rl: ReturnType<typeof createInterface> | null = null;

/** True if env URL is set or worker.port exists under current storage root. */
export function useLongLivedWorkerSync(): boolean {
  if (process.env.SYSMLEGRAPH_WORKER_URL?.trim()) return true;
  return existsSync(getWorkerPortPath());
}

export function workerStrictSync(): boolean {
  return process.env.SYSMLEGRAPH_WORKER_STRICT === '1';
}

function parseWorkerUrl(url: string): { host: string; port: number } | null {
  const t = url.trim();
  if (!t) return null;
  try {
    const u = new URL(t.includes('://') ? t : `http://${t}`);
    const port = u.port ? parseInt(u.port, 10) : NaN;
    if (!Number.isFinite(port)) return null;
    return { host: u.hostname || DEFAULT_HOST, port };
  } catch {
    const m = /^([^:]+):(\d+)$/.exec(t);
    if (m) return { host: m[1], port: parseInt(m[2], 10) };
    return null;
  }
}

export function resolveWorkerTcpEndpoint(): { host: string; port: number } | null {
  const url = process.env.SYSMLEGRAPH_WORKER_URL?.trim();
  if (url) {
    const ep = parseWorkerUrl(url);
    if (ep) return ep;
  }
  const portPath = getWorkerPortPath();
  if (!existsSync(portPath)) return null;
  try {
    const text = readFileSync(portPath, 'utf-8');
    const line = text.trim().split(/\r?\n/)[0] ?? '';
    const port = parseInt(line, 10);
    if (!Number.isFinite(port)) return null;
    return { host: DEFAULT_HOST, port };
  } catch {
    return null;
  }
}

function connectWithTimeout(host: string, port: number): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const s = createConnection({ host, port }, () => {
      clearTimeout(timer);
      resolve(s);
    });
    const timer = setTimeout(() => {
      s.destroy();
      reject(new Error(`Connect timeout to ${host}:${port}`));
    }, CONNECT_TIMEOUT_MS);
    s.once('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/**
 * Connect to daemon and send init. Idempotent if already connected.
 */
export async function ensureLongLivedClient(): Promise<void> {
  if (socket != null && !socket.destroyed) return;
  const ep = resolveWorkerTcpEndpoint();
  if (!ep) {
    throw new Error('Long-lived worker configured but no endpoint (set SYSMLEGRAPH_WORKER_URL or start daemon)');
  }
  const s = await connectWithTimeout(ep.host, ep.port);
  socket = s;
  rl = createInterface({ input: s, terminal: false });
  s.on('error', (err) => {
    for (const [, p] of pending) p.reject(err);
    pending.clear();
  });
  s.on('close', () => {
    socket = null;
    if (rl) {
      rl.close();
      rl = null;
    }
    for (const [, p] of pending) p.reject(new Error('Worker connection closed'));
    pending.clear();
  });
  const storageRoot = getStorageRoot();
  const initReq: WorkerRequest = { id: 0, method: 'init', params: { storageRoot } };
  await new Promise<void>((resolve, reject) => {
    const onInitLine = (line: string) => {
      try {
        const res = JSON.parse(line) as WorkerResponse;
        if (res.id === 0) {
          rl!.off('line', onInitLine);
          if (isWorkerResponseErr(res)) {
            reject(new Error(res.error));
            return;
          }
          rl!.on('line', onDispatchLine);
          resolve();
        }
      } catch {
        // ignore until valid init response
      }
    };
    const onDispatchLine = (line: string) => {
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
        // ignore malformed
      }
    };
    rl!.on('line', onInitLine);
    s.write(JSON.stringify(initReq) + '\n');
  });
}

function requestLongLivedOnce<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T> {
  if (socket == null || socket.destroyed) {
    return Promise.reject(new Error('Long-lived worker not connected; call ensureLongLivedClient() first'));
  }
  const id = nextId++;
  const req: WorkerRequest = { id, method, params };
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (r: unknown) => void, reject });
    socket!.write(JSON.stringify(req) + '\n');
  });
}

function isRetryableWorkerDisconnect(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /closed|ECONNRESET|ECONNREFUSED|not connected|Connect timeout|ETIMEDOUT|EPIPE/i.test(msg);
}

/** Send one RPC; reconnects once on transient disconnect when not in SYSMLEGRAPH_WORKER_STRICT=1 mode. */
export async function requestLongLived<T = unknown>(
  method: string,
  params?: Record<string, unknown>
): Promise<T> {
  const run = async (): Promise<T> => {
    await ensureLongLivedClient();
    return requestLongLivedOnce<T>(method, params);
  };
  try {
    return await run();
  } catch (err) {
    if (workerStrictSync()) throw err;
    if (!isRetryableWorkerDisconnect(err)) throw err;
    closeLongLivedClient();
    return run();
  }
}

/** Close TCP client only (daemon keeps running). */
export function closeLongLivedClient(): void {
  if (socket != null) {
    socket.destroy();
    socket = null;
  }
  if (rl != null) {
    rl.close();
    rl = null;
  }
  for (const [, p] of pending) p.reject(new Error('Worker connection closed'));
  pending.clear();
}

export function isLongLivedConnected(): boolean {
  return socket != null && !socket.destroyed;
}
