/**
 * CLI: sysmledgraph worker start | stop | status
 */

import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync } from 'fs';
import { createConnection } from 'net';
import { createInterface } from 'readline';
import { readFile, unlink } from 'fs/promises';
import { getStorageRoot, getWorkerPortPath } from '../storage/location.js';

function isPidRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function getDaemonScriptPath(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const next = join(here, '..', 'worker', 'daemon.js');
  if (existsSync(next)) return next;
  return join(process.cwd(), 'dist', 'src', 'worker', 'daemon.js');
}

function shutdownViaTcp(port: number, storageRoot: string): Promise<void> {
  return new Promise((resolve) => {
    const sock = createConnection({ host: '127.0.0.1', port }, () => {
      const rl = createInterface({ input: sock, terminal: false });
      sock.write(JSON.stringify({ id: 0, method: 'init', params: { storageRoot } }) + '\n');
      rl.once('line', () => {
        sock.write(JSON.stringify({ id: 1, method: 'shutdown' }) + '\n');
        setTimeout(() => {
          sock.destroy();
          resolve();
        }, 200);
      });
      sock.on('error', () => resolve());
    });
    sock.on('error', () => resolve());
    setTimeout(() => {
      sock.destroy();
      resolve();
    }, 4000);
  });
}

export async function cmdWorkerStart(detach: boolean): Promise<{ ok: boolean; error?: string; exitCode?: number }> {
  const portPath = getWorkerPortPath();
  if (existsSync(portPath)) {
    try {
      const lines = readFileSync(portPath, 'utf-8').trim().split(/\r?\n/);
      const port = parseInt(lines[0] ?? '', 10);
      const filePid = lines[1] ? parseInt(lines[1], 10) : NaN;
      if (Number.isFinite(port)) {
        const tcpAlive = await new Promise<boolean>((res) => {
          const c = createConnection({ host: '127.0.0.1', port }, () => {
            c.destroy();
            res(true);
          });
          c.on('error', () => res(false));
          setTimeout(() => {
            c.destroy();
            res(false);
          }, 400);
        });
        if (tcpAlive) {
          return {
            ok: false,
            exitCode: 2,
            error: 'Worker already running (worker.port + TCP responds).',
          };
        }
        if (Number.isFinite(filePid) && isPidRunning(filePid)) {
          return {
            ok: false,
            exitCode: 1,
            error: `Stale worker.port: TCP closed but PID ${filePid} still exists. Stop that process or remove ${portPath}.`,
          };
        }
        await unlink(portPath).catch(() => {});
      }
    } catch {
      /* continue start */
    }
  }

  const script = getDaemonScriptPath();
  if (!existsSync(script)) {
    return { ok: false, exitCode: 1, error: `Daemon not built: missing ${script} (run npm run build).` };
  }

  if (detach) {
    const child = spawn(process.execPath, [script], {
      detached: true,
      stdio: 'ignore',
      env: { ...process.env, SYSMEDGRAPH_STORAGE_ROOT: getStorageRoot() },
    });
    child.unref();
    return { ok: true };
  }

  const { runDaemon } = await import('../worker/daemon.js');
  await runDaemon();
  return { ok: true };
}

export async function cmdWorkerStop(): Promise<{ ok: boolean; error?: string; exitCode?: number }> {
  const portPath = getWorkerPortPath();
  if (!existsSync(portPath)) {
    return { ok: false, exitCode: 1, error: 'No worker.port; worker does not appear to be running.' };
  }
  const text = await readFile(portPath, 'utf-8');
  const lines = text.trim().split(/\r?\n/);
  const port = parseInt(lines[0] ?? '', 10);
  const pid = lines[1] ? parseInt(lines[1], 10) : NaN;
  const storageRoot = getStorageRoot();

  if (Number.isFinite(port)) {
    await shutdownViaTcp(port, storageRoot);
  }

  await new Promise((r) => setTimeout(r, 400));

  if (existsSync(portPath) && Number.isFinite(pid)) {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      /* stale pid */
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  await unlink(portPath).catch(() => {});
  return { ok: true };
}

export async function cmdWorkerStatus(): Promise<{
  ok: boolean;
  running: boolean;
  port?: number;
  stalePortFile?: boolean;
  error?: string;
}> {
  const portPath = getWorkerPortPath();
  if (!existsSync(portPath)) {
    return { ok: true, running: false };
  }
  const port = parseInt(readFileSync(portPath, 'utf-8').trim().split(/\r?\n/)[0] ?? '', 10);
  if (!Number.isFinite(port)) {
    return { ok: false, running: false, error: 'Invalid worker.port' };
  }
  const alive = await new Promise<boolean>((res) => {
    const c = createConnection({ host: '127.0.0.1', port }, () => {
      c.destroy();
      res(true);
    });
    c.on('error', () => res(false));
    setTimeout(() => {
      c.destroy();
      res(false);
    }, 400);
  });
  if (!alive) {
    return { ok: true, running: false, port, stalePortFile: true };
  }
  return { ok: true, running: true, port };
}
