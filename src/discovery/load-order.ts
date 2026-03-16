/**
 * Load order: when config.yaml exists at path, use model_files; else deterministic (e.g. breadth-first by path).
 * Phase 1 step 4, R7.
 */

import { readFile } from 'fs/promises';
import { join } from 'path';
import type { ModelConfig } from '../types.js';

const CONFIG_FILENAME = 'config.yaml';

/** Simple YAML parse for model_dir and model_files only (avoid heavy dependency). */
function parseConfigYaml(raw: string): ModelConfig {
  const out: ModelConfig = {};
  const lines = raw.split(/\r?\n/);
  let inModelFiles = false;
  const modelFiles: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('model_dir:')) {
      out.model_dir = trimmed.slice('model_dir:'.length).trim();
      inModelFiles = false;
      continue;
    }
    if (trimmed.startsWith('model_files:')) {
      inModelFiles = true;
      continue;
    }
    if (inModelFiles && trimmed.startsWith('-')) {
      const value = trimmed.slice(1).trim();
      if (value) modelFiles.push(value);
      continue;
    }
    if (trimmed && !trimmed.startsWith('#')) {
      inModelFiles = false;
    }
  }

  if (modelFiles.length > 0) {
    out.model_files = modelFiles;
  }
  return out;
}

/**
 * Resolve ordered file list for a root path.
 * If config.yaml exists, use model_files (paths relative to model_dir or root).
 * Otherwise return files in deterministic order (sorted by path).
 */
export async function applyLoadOrder(
  rootPath: string,
  files: string[]
): Promise<string[]> {
  const configPath = join(rootPath, CONFIG_FILENAME);
  let raw: string;
  try {
    raw = await readFile(configPath, 'utf-8');
  } catch {
    return [...files].sort();
  }

  const config = parseConfigYaml(raw);
  if (!config.model_files || config.model_files.length === 0) {
    return [...files].sort();
  }

  const modelDir = config.model_dir ? join(rootPath, config.model_dir) : rootPath;
  const ordered: string[] = [];
  const fileSet = new Set(files.map((f) => f.replace(/\\/g, '/')));
  const byBasename = new Map<string, string>();
  for (const f of files) {
    const base = f.split(/[/\\]/).pop() ?? f;
    byBasename.set(base, f);
  }

  for (const rel of config.model_files) {
    const resolved = join(modelDir, rel).replace(/\\/g, '/');
    if (fileSet.has(resolved)) {
      ordered.push(resolved);
      continue;
    }
    const base = rel.split(/[/\\]/).pop();
    if (base && byBasename.has(base)) {
      ordered.push(byBasename.get(base)!);
    }
  }

  // Append any files not in model_files (e.g. extra .sysml in subdirs)
  for (const f of files) {
    if (!ordered.includes(f)) {
      ordered.push(f);
    }
  }
  return ordered;
}
