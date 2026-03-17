/**
 * Model–codebase alignment: detect when .sysml files changed after last index.
 * Prompts the user to re-index so the graph stays aligned with the models.
 */

import { stat } from 'fs/promises';
import { readRegistryFull } from './registry.js';
import { findSysmlFiles } from '../discovery/find-sysml.js';

export interface AlignmentResult {
  /** true if no indexed path has file changes after last index */
  aligned: boolean;
  /** Paths that have newer files than last index (models/codebase changed) */
  stalePaths: string[];
  /** Short message for the user */
  message: string;
  /** Optional detail (e.g. per-path) */
  details?: string;
}

/**
 * Check whether indexed paths are still aligned with the files on disk.
 * If any .sysml/.kerml under an indexed path is newer than that path's last index time, the path is stale.
 */
export async function checkAlignment(): Promise<AlignmentResult> {
  const { paths, indexedAt } = await readRegistryFull();
  if (paths.length === 0) {
    return {
      aligned: true,
      stalePaths: [],
      message: 'No indexed paths. Run analyze or indexDbGraph to build the graph.',
    };
  }

  const stalePaths: string[] = [];
  const detailLines: string[] = [];

  for (const root of paths) {
    const lastIndexed = indexedAt?.[root];
    if (lastIndexed == null) {
      stalePaths.push(root);
      detailLines.push(`${root}: unknown index time (re-index to record)`);
      continue;
    }
    const lastIndexedMs = new Date(lastIndexed).getTime();
    let files: string[];
    try {
      files = await findSysmlFiles({ roots: [root], includeKerml: true });
    } catch {
      stalePaths.push(root);
      detailLines.push(`${root}: error listing files`);
      continue;
    }
    let maxMtimeMs = 0;
    for (const f of files) {
      try {
        const s = await stat(f);
        if (s.mtimeMs > maxMtimeMs) maxMtimeMs = s.mtimeMs;
      } catch {
        // file may have been deleted
        maxMtimeMs = lastIndexedMs + 1;
        break;
      }
    }
    if (files.length > 0 && maxMtimeMs > lastIndexedMs) {
      stalePaths.push(root);
      detailLines.push(`${root}: files changed after ${lastIndexed}`);
    }
  }

  const aligned = stalePaths.length === 0;
  const message = aligned
    ? 'Models and index are aligned. No changes detected since last index.'
    : `The codebase may not align with the models. ${stalePaths.length} path(s) have changes since last index. Re-run \`sysmledgraph analyze\` or the indexDbGraph tool to refresh the graph.`;

  return {
    aligned,
    stalePaths,
    message,
    details: detailLines.length > 0 ? detailLines.join('\n') : undefined,
  };
}
