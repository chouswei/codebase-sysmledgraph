/**
 * Long-lived graph daemon: TCP localhost, NDJSON protocol, single Kuzu owner.
 * Run: node dist/src/worker/daemon.js
 * Env: SYSMEDGRAPH_STORAGE_ROOT (optional), SYSMLEGRAPH_WORKER_PORT (optional, 0 = OS picks)
 */

import { createServer, createConnection, type Server, type Socket } from 'net';
import { createInterface } from 'readline';
import { mkdir, writeFile, unlink, readFile, open, type FileHandle } from 'fs/promises';
import { existsSync, realpathSync } from 'fs';
import { fileURLToPath } from 'url';
import { setStorageRoot, getStorageRoot, getWorkerPortPath, getWorkerLockPath } from '../storage/location.js';
import { dispatch } from './dispatch.js';
import type { WorkerRequest, WorkerResponse, WorkerResponseErr } from './protocol.js';
import { isWorkerResponseErr } from './protocol.js';

const clients = new Set<Socket>();
let serverInstance: Server | null = null;
let shuttingDown = false;
let lockHandle: FileHandle | null = null;

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function clearStaleWorkerLockIfDead(lockPath: string): Promise<void> {
  if (!existsSync(lockPath)) return;
  try {
    const text = await readFile(lockPath, 'utf-8');
    const pid = parseInt(text.trim(), 10);
    if (Number.isFinite(pid) && isProcessAlive(pid)) return;
    await unlink(lockPath);
  } catch {
    await unlink(lockPath).catch(() => {});
  }
}

async function tryClearLockForRetry(lockPath: string): Promise<boolean> {
  try {
    const text = await readFile(lockPath, 'utf-8');
    const pid = parseInt(text.trim(), 10);
    if (Number.isFinite(pid) && isProcessAlive(pid)) return false;
    await unlink(lockPath);
    return true;
  } catch {
    await unlink(lockPath).catch(() => {});
    return true;
  }
}

async function acquireWorkerLock(): Promise<void> {
  const lockPath = getWorkerLockPath();
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const fh = await open(lockPath, 'wx');
      await fh.writeFile(`${process.pid}\n`, 'utf-8');
      lockHandle = fh;
      return;
    } catch (e) {
      const code = e && typeof e === 'object' && 'code' in e ? (e as NodeJS.ErrnoException).code : '';
      if (code !== 'EEXIST') throw e;
      const cleared = await tryClearLockForRetry(lockPath);
      if (!cleared) {
        throw new Error('Another graph worker is already running (worker.lock held by live process).');
      }
    }
  }
  throw new Error('Could not acquire worker.lock');
}

async function releaseWorkerLock(): Promise<void> {
  if (lockHandle) {
    await lockHandle.close().catch(() => {});
    lockHandle = null;
  }
  try {
    await unlink(getWorkerLockPath());
  } catch {
    /* ignore */
  }
}

let dispatchQueue: Promise<unknown> = Promise.resolve();

function runSerialized<T>(fn: () => Promise<T>): Promise<T> {
  const next = dispatchQueue.then(fn, fn);
  dispatchQueue = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

function respond(sock: Socket, obj: WorkerResponse): void {
  if (!sock.destroyed) sock.write(JSON.stringify(obj) + '\n');
}

async function probePortOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const c = createConnection({ host: '127.0.0.1', port }, () => {
      c.destroy();
      resolve(true);
    });
    c.on('error', () => resolve(false));
    setTimeout(() => {
      c.destroy();
      resolve(false);
    }, 400);
  });
}

async function removeStalePortFile(portPath: string): Promise<void> {
  if (!existsSync(portPath)) return;
  try {
    const text = await readFile(portPath, 'utf-8');
    const line = text.trim().split(/\r?\n/)[0] ?? '';
    const port = parseInt(line, 10);
    if (!Number.isFinite(port)) {
      await unlink(portPath);
      return;
    }
    const alive = await probePortOpen(port);
    if (alive) {
      throw new Error('Another graph worker is already running (port file + TCP probe).');
    }
    await unlink(portPath);
  } catch (e) {
    if (e instanceof Error && e.message.includes('already running')) throw e;
    await unlink(portPath).catch(() => {});
  }
}

function scheduleShutdown(): void {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const c of clients) {
    try {
      c.destroy();
    } catch {
      /* ignore */
    }
  }
  clients.clear();
  if (serverInstance) {
    serverInstance.close(() => {
      void cleanupPortFile()
        .then(() => releaseWorkerLock())
        .finally(() => process.exit(0));
    });
  } else {
    void cleanupPortFile()
      .then(() => releaseWorkerLock())
      .finally(() => process.exit(0));
  }
}

async function cleanupPortFile(): Promise<void> {
  const p = getWorkerPortPath();
  try {
    await unlink(p);
  } catch {
    /* ignore */
  }
}

function handleConnection(sock: Socket): void {
  clients.add(sock);
  const rl = createInterface({ input: sock, terminal: false });
  let initialized = false;

  const cleanup = (): void => {
    clients.delete(sock);
    rl.close();
  };
  sock.on('close', cleanup);
  sock.on('error', cleanup);

  rl.on('line', (line) => {
    void (async () => {
      let req: WorkerRequest;
      try {
        req = JSON.parse(line) as WorkerRequest;
      } catch {
        respond(sock, { id: 0, error: 'Invalid JSON' } as WorkerResponseErr);
        return;
      }
      const id = typeof req.id === 'number' ? req.id : 0;

      if (req.method === 'shutdown') {
        respond(sock, { id, result: {} });
        scheduleShutdown();
        return;
      }

      if (req.method === 'init') {
        const root = (req.params?.storageRoot as string) ?? '';
        if (root && root !== getStorageRoot()) {
          setStorageRoot(root);
        }
        initialized = true;
        respond(sock, { id, result: {} });
        return;
      }

      if (!initialized) {
        respond(sock, { id, error: 'Not initialized; send init first' } as WorkerResponseErr);
        return;
      }

      try {
        const result = await runSerialized(() => dispatch(req.method, req.params as Record<string, unknown> | undefined));
        respond(sock, { id, result });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        respond(sock, { id, error: msg } as WorkerResponseErr);
      }
    })();
  });
}

/**
 * Start TCP daemon on 127.0.0.1. Blocks until shutdown (SIGINT/SIGTERM or shutdown RPC).
 */
export async function runDaemon(): Promise<void> {
  const envRoot = process.env.SYSMEDGRAPH_STORAGE_ROOT?.trim();
  if (envRoot) setStorageRoot(envRoot);
  const root = getStorageRoot();
  await mkdir(root, { recursive: true });
  await clearStaleWorkerLockIfDead(getWorkerLockPath());

  await acquireWorkerLock();

  const portPath = getWorkerPortPath();
  try {
    await removeStalePortFile(portPath);
  } catch (e) {
    await releaseWorkerLock();
    throw e;
  }

  const requested = process.env.SYSMLEGRAPH_WORKER_PORT?.trim();
  const portNum = requested ? parseInt(requested, 10) : 0;
  const bindPort = Number.isFinite(portNum) && portNum >= 0 ? portNum : 0;

  const server = createServer(handleConnection);
  serverInstance = server;

  let actualPort = 0;
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(bindPort, '127.0.0.1', () => {
        server.off('error', reject);
        resolve();
      });
    });

    const addr = server.address();
    if (addr == null || typeof addr === 'string') {
      throw new Error('Server address unavailable');
    }
    actualPort = addr.port;
    await writeFile(portPath, `${actualPort}\n${process.pid}\n`, 'utf-8');
  } catch (e) {
    await new Promise<void>((res) => {
      server.close(() => res());
    });
    serverInstance = null;
    await releaseWorkerLock();
    throw e;
  }

  process.stderr.write(`sysmledgraph worker listening on 127.0.0.1:${actualPort} (storage: ${getStorageRoot()})\n`);

  const onSignal = (): void => {
    scheduleShutdown();
  };
  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);

  await new Promise<void>(() => {
    /* until process.exit from scheduleShutdown */
  });
}

function isExecutedDirectly(): boolean {
  const a = process.argv[1];
  if (!a) return false;
  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(a);
  } catch {
    return false;
  }
}

if (isExecutedDirectly()) {
  runDaemon().catch((err) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(msg);
    void releaseWorkerLock().finally(() => {
      if (msg.includes('already running')) process.exit(2);
      process.exit(1);
    });
  });
}
