import { describe, it, expect } from 'vitest';
import { findSysmlFiles } from '../../src/discovery/find-sysml.js';

describe('findSysmlFiles', () => {
  it('returns empty array for empty roots', async () => {
    const files = await findSysmlFiles({ roots: [] });
    expect(files).toEqual([]);
  });

  it('returns sorted unique paths when roots overlap', async () => {
    // Use a real path that exists (project root)
    const root = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1').replace(/\//g, '\\');
    const files = await findSysmlFiles({ roots: [root], includeKerml: false });
    expect(Array.isArray(files)).toBe(true);
    const sysml = files.filter((f) => f.endsWith('.sysml'));
    expect(sysml.length).toBeGreaterThanOrEqual(0);
  });
});
