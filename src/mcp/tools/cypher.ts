/**
 * MCP tool: cypher – run Cypher query on the graph.
 * Uses first indexed path as default DB.
 */

import { listIndexedPaths } from '../../storage/list.js';
import { getDbPathForIndexedPath } from '../../storage/location.js';
import { getCachedOrOpenGraphStore } from '../../graph/graph-store.js';

export interface CypherArgs {
  query: string;
}

export async function handleCypher(args: CypherArgs): Promise<{ ok: boolean; rows?: unknown[]; error?: string }> {
  const paths = await listIndexedPaths();
  if (paths.length === 0) {
    return { ok: false, error: 'No indexed paths; run indexDbGraph first' };
  }
  const dbPath = getDbPathForIndexedPath(paths[0]);
  const store = await getCachedOrOpenGraphStore(dbPath);
  const conn = store.getConnection();
  try {
    const result = await conn.query(args.query.trim());
    const rows = await result.getAll();
    return { ok: true, rows };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
