/**
 * MCP tool: rename – multi-file rename for defs (dry_run only in v1).
 * Returns preview of what would change; no actual file edits yet.
 */

import { listIndexedPaths } from '../../storage/list.js';
import { getDbPathForIndexedPath } from '../../storage/location.js';
import { getCachedOrOpenGraphStore } from '../../graph/graph-store.js';
import { NODE_TABLE } from '../../graph/schema.js';

export interface RenameArgs {
  symbol: string;
  newName: string;
  dry_run?: boolean;
}

export async function handleRename(args: RenameArgs): Promise<{ ok: boolean; preview?: { path: string; count: number }[]; message?: string; error?: string }> {
  const paths = await listIndexedPaths();
  if (paths.length === 0) {
    return { ok: false, error: 'No indexed paths; run indexDbGraph first' };
  }
  const dbPath = getDbPathForIndexedPath(paths[0]);
  const store = await getCachedOrOpenGraphStore(dbPath);
  const conn = store.getConnection();
  const symbol = (args.symbol || '').trim().replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const newName = (args.newName ?? '').trim();
  if (!symbol) {
    return { ok: false, error: 'symbol is required' };
  }
  if (!newName) {
    return { ok: false, error: 'newName is required' };
  }
  try {
    const result = await conn.query(
      `MATCH (n:${NODE_TABLE}) WHERE n.id = '${symbol}' OR n.name = '${symbol}' RETURN n.path LIMIT 100`
    );
    const rows = await result.getAll();
    const byPath = new Map<string, number>();
    for (const row of rows as unknown[]) {
      const v = Array.isArray(row) ? row : Object.values(row as object);
      const path = String(v[0]);
      byPath.set(path, (byPath.get(path) ?? 0) + 1);
    }
    const preview = [...byPath.entries()].map(([path, count]) => ({ path, count }));
    const dryRun = args.dry_run !== false;
    return {
      ok: true,
      preview,
      message: dryRun ? `Dry run: would rename "${args.symbol}" to "${newName}" in ${preview.length} path(s). Run without dry_run to apply (not implemented in v1).` : 'Rename not implemented in v1; use dry_run for preview only.',
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
