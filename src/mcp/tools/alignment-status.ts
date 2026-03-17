/**
 * MCP tool: alignment_status – model–codebase alignment check.
 * Prompts the user when the index is stale (files changed after last index).
 */

import { checkAlignment } from '../../storage/alignment.js';

export async function handleAlignmentStatus(): Promise<{
  ok: boolean;
  aligned?: boolean;
  message?: string;
  stalePaths?: string[];
  details?: string;
  error?: string;
}> {
  try {
    const result = await checkAlignment();
    return {
      ok: true,
      aligned: result.aligned,
      message: result.message,
      stalePaths: result.stalePaths,
      details: result.details,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
