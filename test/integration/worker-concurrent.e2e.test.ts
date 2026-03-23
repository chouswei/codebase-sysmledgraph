/**
 * E2E: concurrent TCP RPCs against daemon (dispatch serializes mutating work; read-only RPCs complete).
 * Run: npm run test:daemon
 */
import { describe, it, expect, afterAll } from 'vitest';
import { mkdtempSync, existsSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { spawn, type ChildProcess } from 'child_process';
import { fileURLToPath } from 'url';
import { setStorageRoot } from '../../src/storage/location.js';
import { ensureLongLivedClient, requestLongLived, closeLongLivedClient } from '../../src/worker/socket-client.js';

const daemonJs = fileURLToPath(new URL('../../dist/src/worker/daemon.js', import.meta.url));

describe('long-lived daemon concurrency', () => {
  let dir: string;
  let child: ChildProcess | null = null;

  afterAll(() => {
    closeLongLivedClient();
    try {
      child?.kill('SIGTERM');
    } catch {
      /* ignore */
    }
    if (dir) {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  });

  it('handles concurrent list_indexed (serialized in daemon)', async () => {
    dir = mkdtempSync(join(tmpdir(), 'sysmled-wc-'));
    child = spawn(process.execPath, [daemonJs], {
      env: { ...process.env, SYSMEDGRAPH_STORAGE_ROOT: dir },
      stdio: 'ignore',
    });

    const portPath = join(dir, 'worker.port');
    let appeared = false;
    for (let i = 0; i < 80; i++) {
      if (existsSync(portPath)) {
        appeared = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    expect(appeared, 'worker.port should appear').toBe(true);

    delete process.env.SYSMLEGRAPH_WORKER_URL;
    setStorageRoot(dir);
    await ensureLongLivedClient();

    const [a, b, c, d] = await Promise.all([
      requestLongLived<{ ok: boolean; paths?: string[] }>('list_indexed'),
      requestLongLived<{ ok: boolean; paths?: string[] }>('list_indexed'),
      requestLongLived<{ ok: boolean; paths?: string[] }>('list_indexed'),
      requestLongLived<{ ok: boolean; paths?: string[] }>('list_indexed'),
    ]);

    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(c.ok).toBe(true);
    expect(d.ok).toBe(true);
    expect(Array.isArray(a.paths)).toBe(true);
    expect(Array.isArray(b.paths)).toBe(true);
    expect(Array.isArray(c.paths)).toBe(true);
    expect(Array.isArray(d.paths)).toBe(true);
  }, 20_000);
});
