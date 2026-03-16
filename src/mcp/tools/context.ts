/**
 * MCP tool: context – 360° view for one symbol (usages, types, relations).
 * Uses first indexed path. Returns node and outgoing/incoming edges.
 */

import { listIndexedPaths } from '../../storage/list.js';
import { getDbPathForIndexedPath } from '../../storage/location.js';
import { getCachedOrOpenGraphStore } from '../../graph/graph-store.js';
import { NODE_TABLE } from '../../graph/schema.js';
import { EDGE_TYPES } from '../../graph/schema.js';

export interface ContextArgs {
  name: string;
}

export async function handleContext(args: ContextArgs): Promise<{ ok: boolean; node?: unknown; edges?: unknown[]; error?: string }> {
  const paths = await listIndexedPaths();
  if (paths.length === 0) {
    return { ok: false, error: 'No indexed paths; run indexDbGraph first' };
  }
  const dbPath = getDbPathForIndexedPath(paths[0]);
  const store = await getCachedOrOpenGraphStore(dbPath);
  const conn = store.getConnection();
  const name = (args.name || '').trim().replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  if (!name) {
    return { ok: false, error: 'name is required' };
  }
  try {
    const nodeResult = await conn.query(
      `MATCH (n:${NODE_TABLE}) WHERE n.id = '${name}' OR n.name = '${name}' RETURN n.id, n.name, n.path, n.label LIMIT 1`
    );
    const nodeRows = await nodeResult.getAll();
    if (!nodeRows.length) {
      return { ok: false, error: `Symbol not found: ${args.name}` };
    }
    const r0 = nodeRows[0] as unknown;
    const arr = Array.isArray(r0) ? r0 : Object.values(r0 as object);
    const node = { id: arr[0], name: arr[1], path: arr[2], label: arr[3] };

    const edges: { type: string; from: string; to: string }[] = [];
    for (const relType of EDGE_TYPES) {
      try {
        const relResult = await conn.query(
          `MATCH (a:${NODE_TABLE})-[:${relType}]->(b:${NODE_TABLE}) WHERE a.id = '${name}' OR a.name = '${name}' RETURN a.id, b.id LIMIT 20`
        );
        const relRows = await relResult.getAll();
        for (const row of relRows as unknown[]) {
          const v = Array.isArray(row) ? row : Object.values(row as object);
          edges.push({ type: relType, from: String(v[0]), to: String(v[1]) });
        }
      } catch {
        // rel type may not exist or have no matches
      }
    }
    return { ok: true, node, edges };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
