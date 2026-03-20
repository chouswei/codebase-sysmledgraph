/**
 * Default LSP server path: env override, then lsp/ then root node_modules.
 * Single source for "independent LSP" used only by sysmledgraph (see docs/PLAN_INDEPENDENT_LSP.md).
 */

import { resolve } from 'path';
import { existsSync } from 'fs';

const LSP_RELATIVE_PATHS = [
  'lsp/node_modules/sysml-v2-lsp/dist/server/server.js',
  'node_modules/sysml-v2-lsp/dist/server/server.js',
] as const;

/**
 * Resolved path to the LSP server script, or null if none found.
 * Order: SYSMLLSP_SERVER_PATH (if set) → lsp/.../server.js → root node_modules/.../server.js.
 */
export function getDefaultLspServerPath(): string | null {
  const env = process.env.SYSMLLSP_SERVER_PATH?.trim();
  if (env) {
    const isAbsolute = env.startsWith('/') || /^[A-Za-z]:[/\\]/.test(env);
    return isAbsolute ? env : resolve(process.cwd(), env);
  }
  const cwd = process.cwd();
  for (const rel of LSP_RELATIVE_PATHS) {
    const p = resolve(cwd, rel);
    if (existsSync(p)) return p;
  }
  return null;
}
