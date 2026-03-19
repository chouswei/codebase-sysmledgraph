/**
 * Resource: sysmledgraph://context – index stats and indexed paths.
 * Optional per-path: pass path to get stats for that indexed root only (plan step 13).
 */

import { listIndexedPaths } from '../../storage/list.js';
import { getMergedDbPath } from '../../storage/location.js';
import { getCachedOrOpenGraphStore } from '../../graph/graph-store.js';
import { NODE_TABLE } from '../../graph/schema.js';

function escapeCypherString(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export async function getContextContent(path?: string): Promise<string> {
  const paths = await listIndexedPaths();
  const lines = ['# sysmledgraph index context', ''];

  if (path !== undefined && path !== '') {
    const rootEsc = escapeCypherString(path);
    const rootPrefixEsc = escapeCypherString(path.replace(/\\/g, '/') + '/');
    const store = await getCachedOrOpenGraphStore(getMergedDbPath());
    const conn = store.getConnection();
    let nodeCount = 0;
    try {
      const result = await conn.query(
        `MATCH (n:${NODE_TABLE}) WHERE n.path = '${rootEsc}' OR starts_with(n.path, '${rootPrefixEsc}') RETURN count(n) AS c`
      );
      const rows = await result.getAll();
      if (rows.length > 0) {
        const r0 = rows[0];
        const v = Array.isArray(r0) ? r0 : Object.values(r0 as Record<string, unknown>);
        nodeCount = Number(v[0] ?? 0);
      }
    } catch {
      // ignore
    }
    lines.push('## Path');
    lines.push(`- ${path}`);
    lines.push('');
    lines.push(`Nodes (this path): ${nodeCount}`);
    return lines.join('\n');
  }

  lines.push('## Indexed paths');
  lines.push(paths.length === 0 ? '(none)' : paths.map((p) => `- ${p}`).join('\n'));
  lines.push('');
  lines.push(`Total: ${paths.length} path(s)`);
  return lines.join('\n');
}
