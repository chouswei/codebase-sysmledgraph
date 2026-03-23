/**
 * Shared graph worker dispatch: same methods for stdio worker and TCP daemon.
 */

import { listIndexedPaths } from '../storage/list.js';
import { handleListIndexed } from '../mcp/tools/list-indexed.js';
import { handleIndexDbGraph } from '../mcp/tools/index-db-graph.js';
import { handleCleanIndex } from '../mcp/tools/clean-index.js';
import { handleCypher } from '../mcp/tools/cypher.js';
import { handleQuery } from '../mcp/tools/query.js';
import { handleContext } from '../mcp/tools/context.js';
import { handleImpact } from '../mcp/tools/impact.js';
import { handleRename } from '../mcp/tools/rename.js';
import { handleGenerateMap } from '../mcp/tools/generate-map.js';
import { getContextContent } from '../mcp/resources/context.js';

export async function dispatch(method: string, params: Record<string, unknown> | undefined): Promise<unknown> {
  const p = params ?? {};
  switch (method) {
    case 'listIndexedPaths': {
      const paths = await listIndexedPaths();
      return { paths };
    }
    case 'index':
      return handleIndexDbGraph(p as { path?: string; paths?: string[] });
    case 'clean':
      return handleCleanIndex(p as { path?: string });
    case 'cypher':
      return handleCypher(p as { query: string });
    case 'query':
      return handleQuery(p as { query: string; kind?: string });
    case 'context':
      return handleContext(p as { name: string });
    case 'impact':
      return handleImpact(p as { target: string; direction?: 'upstream' | 'downstream' });
    case 'rename':
      return handleRename(p as { symbol: string; newName: string; dry_run?: boolean });
    case 'generateMap':
      return handleGenerateMap(p as { output_path?: string });
    case 'list_indexed':
      return handleListIndexed();
    case 'getContextContent': {
      const text = await getContextContent(p.path as string | undefined);
      return { content: text };
    }
    default:
      throw new Error(`Unknown method: ${method}`);
  }
}
