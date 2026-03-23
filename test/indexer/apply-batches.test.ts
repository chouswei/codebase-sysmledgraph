import { describe, it, expect } from 'vitest';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';
import { openGraphStore } from '../../src/graph/graph-store.js';
import { applyIndexedBatches } from '../../src/indexer/indexer.js';

describe('applyIndexedBatches (two-phase edges)', () => {
  it('creates IN_PACKAGE edge when parent symbol is indexed in a later file', async () => {
    const dbPath = join(tmpdir(), `sysmledgraph-idx-${randomBytes(6).toString('hex')}.kuzu`);
    const store = await openGraphStore(dbPath);
    const batches = [
      {
        filePath: '/models/a.sysml',
        symbols: [
          {
            label: 'PartDef' as const,
            props: { name: 'Child', qualifiedName: 'P::Child', path: '/models/a.sysml' },
            relations: [
              { from: 'P::Child', to: '/models/a.sysml', type: 'IN_DOCUMENT' as const },
              { from: 'P::Child', to: 'P::Parent', type: 'IN_PACKAGE' as const },
            ],
          },
        ],
      },
      {
        filePath: '/models/b.sysml',
        symbols: [
          {
            label: 'PartDef' as const,
            props: { name: 'Parent', qualifiedName: 'P::Parent', path: '/models/b.sysml' },
            relations: [{ from: 'P::Parent', to: '/models/b.sysml', type: 'IN_DOCUMENT' as const }],
          },
        ],
      },
    ];

    await applyIndexedBatches(store, batches, '2026-01-01T00:00:00.000Z');

    const conn = store.getConnection();
    const r = await conn.query(
      `MATCH (a:Node)-[:IN_PACKAGE]->(b:Node) WHERE a.id = 'P::Child' RETURN b.id`
    );
    const rows = await r.getAll();
    expect(rows.length).toBe(1);
    const row = rows[0];
    const vals = Array.isArray(row) ? row : Object.values(row as object);
    expect(String(vals[0])).toBe('P::Parent');
  });
});
