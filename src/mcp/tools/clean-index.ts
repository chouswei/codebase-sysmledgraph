/**
 * MCP tool: clean_index – remove index for path or all.
 */

import { cleanIndex } from '../../storage/clean.js';

export interface CleanIndexArgs {
  path?: string;
}

export async function handleCleanIndex(args: CleanIndexArgs): Promise<{ ok: boolean; removed?: string[]; error?: string }> {
  const result = await cleanIndex(args.path);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, removed: result.removed };
}
