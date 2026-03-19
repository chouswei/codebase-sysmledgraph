/**
 * Registry of indexed paths and last-indexed time. Used for list/clean.
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { getStorageRoot } from './location.js';

const REGISTRY_FILENAME = 'registry.json';

export interface RegistryData {
  paths: string[];
  /** path -> ISO date string when last indexed */
  indexedAt?: Record<string, string>;
}

async function registryPath(): Promise<string> {
  return join(getStorageRoot(), REGISTRY_FILENAME);
}

export async function readRegistry(): Promise<string[]> {
  const data = await readRegistryFull();
  return data.paths;
}

export async function readRegistryFull(): Promise<RegistryData> {
  try {
    const raw = await readFile(await registryPath(), 'utf-8');
    const data = JSON.parse(raw) as RegistryData;
    return {
      paths: Array.isArray(data.paths) ? data.paths : [],
      indexedAt: data.indexedAt && typeof data.indexedAt === 'object' ? data.indexedAt : {},
    };
  } catch {
    return { paths: [], indexedAt: {} };
  }
}

export async function addToRegistry(path: string, indexedAt?: string): Promise<void> {
  const data = await readRegistryFull();
  if (data.paths.includes(path)) {
    if (indexedAt != null) {
      data.indexedAt = data.indexedAt ?? {};
      data.indexedAt[path] = indexedAt;
      await mkdir(getStorageRoot(), { recursive: true });
      await writeFile(await registryPath(), JSON.stringify(data, null, 0), 'utf-8');
    }
    return;
  }
  data.paths.push(path);
  if (indexedAt != null) {
    data.indexedAt = data.indexedAt ?? {};
    data.indexedAt[path] = indexedAt;
  }
  await mkdir(getStorageRoot(), { recursive: true });
  await writeFile(await registryPath(), JSON.stringify(data, null, 0), 'utf-8');
}

export async function removeFromRegistry(path: string): Promise<void> {
  const data = await readRegistryFull();
  const paths = data.paths.filter((p) => p !== path);
  const indexedAt = { ...(data.indexedAt ?? {}) };
  delete indexedAt[path];
  await mkdir(getStorageRoot(), { recursive: true });
  await writeFile(await registryPath(), JSON.stringify({ paths, indexedAt }, null, 0), 'utf-8');
}

export async function clearRegistry(): Promise<void> {
  await mkdir(getStorageRoot(), { recursive: true });
  await writeFile(await registryPath(), JSON.stringify({ paths: [], indexedAt: {} }, null, 0), 'utf-8');
}
