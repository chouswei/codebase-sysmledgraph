/**
 * MCP tool: impact – blast radius (what uses this element, or what it uses).
 * direction: upstream = what references this; downstream = what this references.
 */

import { listIndexedPaths } from '../../storage/list.js';
import { getDbPathForIndexedPath } from '../../storage/location.js';
import { getCachedOrOpenGraphStore } from '../../graph/graph-store.js';
import { NODE_TABLE } from '../../graph/schema.js';
import { EDGE_TYPES } from '../../graph/schema.js';

export interface ImpactArgs {
  target: string;
  direction?: 'upstream' | 'downstream';
}

export async function handleImpact(args: ImpactArgs): Promise<{ ok: boolean; nodes?: unknown[]; error?: string }> {
  const paths = await listIndexedPaths();
  if (paths.length === 0) {
    return { ok: false, error: 'No indexed paths; run indexDbGraph first' };
  }
  const dbPath = getDbPathForIndexedPath(paths[0]);
  const store = await getCachedOrOpenGraphStore(dbPath);
  const conn = store.getConnection();
  const target = (args.target || '').trim().replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  if (!target) {
    return { ok: false, error: 'target is required' };
  }
  const direction = (args.direction ?? 'downstream') as 'upstream' | 'downstream';
  const seen = new Set<string>();
  const nodes: { id: string; name: string; path: string; label: string }[] = [];

  try {
    for (const relType of EDGE_TYPES) {
      const cypher =
        direction === 'downstream'
          ? `MATCH (a:${NODE_TABLE})-[:${relType}]->(b:${NODE_TABLE}) WHERE a.id = '${target}' OR a.name = '${target}' RETURN b.id, b.name, b.path, b.label LIMIT 100`
          : `MATCH (a:${NODE_TABLE})-[:${relType}]->(b:${NODE_TABLE}) WHERE b.id = '${target}' OR b.name = '${target}' RETURN a.id, a.name, a.path, a.label LIMIT 100`;
      const result = await conn.query(cypher);
      const rows = await result.getAll();
      for (const row of rows as unknown[]) {
        const v = Array.isArray(row) ? row : Object.values(row as object);
        const id = String(v[0]);
        if (seen.has(id)) continue;
        seen.add(id);
        nodes.push({ id, name: String(v[1]), path: String(v[2]), label: String(v[3]) });
      }
    }
    return { ok: true, nodes };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
