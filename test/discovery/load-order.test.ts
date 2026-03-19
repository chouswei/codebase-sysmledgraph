import { describe, it, expect } from 'vitest';
import { applyLoadOrder } from '../../src/discovery/load-order.js';

describe('applyLoadOrder', () => {
  it('returns sorted copy when no config', async () => {
    const root = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1').replace(/\//g, '\\');
    const files = ['/a/c.sysml', '/a/b.sysml'];
    const ordered = await applyLoadOrder(root, files);
    expect(ordered).toHaveLength(2);
    expect(ordered.sort()).toEqual([...files].sort());
  });

  it('returns deterministic order for empty config dir', async () => {
    const root = process.cwd();
    const files = ['b.sysml', 'a.sysml'].map((f) => `${root}/${f}`);
    const ordered = await applyLoadOrder(root, files);
    expect(ordered).toHaveLength(2);
  });
});
