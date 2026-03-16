/**
 * MCP tool: list_indexed – list indexed path(s).
 */

import { listIndexedPaths } from '../../storage/list.js';

export async function handleListIndexed(): Promise<{ ok: boolean; paths?: string[]; error?: string }> {
  try {
    const paths = await listIndexedPaths();
    return { ok: true, paths };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
