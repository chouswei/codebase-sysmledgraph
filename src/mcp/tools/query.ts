/**
 * MCP tool: query – concept search over symbols (by name/label).
 * Uses first indexed path. Optional kind filters by node label.
 */

import { listIndexedPaths } from '../../storage/list.js';
import { getDbPathForIndexedPath } from '../../storage/location.js';
import { getCachedOrOpenGraphStore } from '../../graph/graph-store.js';
import { NODE_TABLE } from '../../graph/schema.js';

export interface QueryArgs {
  query: string;
  kind?: string;
}

export async function handleQuery(args: QueryArgs): Promise<{ ok: boolean; nodes?: unknown[]; error?: string }> {
  const paths = await listIndexedPaths();
  if (paths.length === 0) {
    return { ok: false, error: 'No indexed paths; run indexDbGraph first' };
  }
  const dbPath = getDbPathForIndexedPath(paths[0]);
  const store = await getCachedOrOpenGraphStore(dbPath);
  const conn = store.getConnection();
  const q = (args.query || '').trim().toLowerCase();
  if (!q) {
    return { ok: false, error: 'query is required' };
  }
  const kind = args.kind?.trim();
  try {
    const cypher = `MATCH (n:${NODE_TABLE}) RETURN n.id, n.name, n.path, n.label LIMIT 200`;
    const result = await conn.query(cypher);
    const rows = await result.getAll();
    const nodes: { id: string; name: string; path: string; label: string }[] = [];
    for (const r of rows as unknown[]) {
      const arr = Array.isArray(r) ? r : Object.values(r as object);
      const id = String(arr[0]);
      const name = String(arr[1]);
      const path = String(arr[2]);
      const label = String(arr[3]);
      if (kind && label !== kind) continue;
      if (!id.toLowerCase().includes(q) && !name.toLowerCase().includes(q)) continue;
      nodes.push({ id, name, path, label });
      if (nodes.length >= 50) break;
    }
    return { ok: true, nodes };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
