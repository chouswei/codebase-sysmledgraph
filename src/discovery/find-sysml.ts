/**
 * File discovery: find all .sysml (and optionally .kerml) under path(s).
 * Phase 1 step 4. Uses fast-glob.
 */

import fg from 'fast-glob';
import { join } from 'path';

const SYSML_GLOB = '**/*.sysml';
const KERML_GLOB = '**/*.kerml';

export interface FindSysmlOptions {
  /** Include .kerml files. Default true. */
  includeKerml?: boolean;
  /** Root path(s) to search. */
  roots: string[];
}

/**
 * Find all .sysml files under the given roots (and optionally .kerml).
 * Returns absolute paths, deduplicated.
 */
export async function findSysmlFiles(options: FindSysmlOptions): Promise<string[]> {
  const { roots, includeKerml = true } = options;
  const patterns = includeKerml ? [SYSML_GLOB, KERML_GLOB] : [SYSML_GLOB];
  const seen = new Set<string>();

  for (const root of roots) {
    for (const pattern of patterns) {
      const files = await fg(pattern, {
        cwd: root,
        absolute: true,
        onlyFiles: true,
      });
      for (const f of files) {
        seen.add(f);
      }
    }
  }

  return [...seen].sort();
}
