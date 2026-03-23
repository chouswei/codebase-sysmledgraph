/**
 * E2E: spawn daemon subprocess, talk via socket client (list_indexed).
 * Run: npm run test:daemon (separate vitest config; excluded from default npm test).
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

describe('long-lived daemon', () => {
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

  it('responds to list_indexed over TCP', async () => {
    dir = mkdtempSync(join(tmpdir(), 'sysmled-w-'));
    child = spawn(process.execPath, [daemonJs], {
      env: { ...process.env, SYSMEDGRAPH_STORAGE_ROOT: dir },
      stdio: 'ignore',
    });

    const portPath = join(dir, 'worker.port');
    let ok = false;
    for (let i = 0; i < 80; i++) {
      if (existsSync(portPath)) {
        ok = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    expect(ok, 'worker.port should appear').toBe(true);

    delete process.env.SYSMLEGRAPH_WORKER_URL;
    setStorageRoot(dir);
    await ensureLongLivedClient();
    const res = await requestLongLived<{ ok: boolean; paths?: string[] }>('list_indexed');
    expect(res.ok).toBe(true);
    expect(Array.isArray(res.paths)).toBe(true);
  }, 20_000);
});
