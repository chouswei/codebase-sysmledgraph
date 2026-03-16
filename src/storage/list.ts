/**
 * List indexed path(s). Phase 2 step 9.
 * Reads registry (canonical list of indexed root paths).
 */

import { readRegistry } from './registry.js';

/**
 * List all indexed root paths from registry.
 */
export async function listIndexedPaths(): Promise<string[]> {
  return readRegistry();
}
