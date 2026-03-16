/**
 * Registry of indexed paths: persisted at storage root so list/clean use real paths.
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { getStorageRoot } from './location.js';

const REGISTRY_FILENAME = 'registry.json';

interface Registry {
  paths: string[];
}

async function registryPath(): Promise<string> {
  return join(getStorageRoot(), REGISTRY_FILENAME);
}

export async function readRegistry(): Promise<string[]> {
  try {
    const raw = await readFile(await registryPath(), 'utf-8');
    const data = JSON.parse(raw) as Registry;
    return Array.isArray(data.paths) ? data.paths : [];
  } catch {
    return [];
  }
}

export async function addToRegistry(path: string): Promise<void> {
  const paths = await readRegistry();
  if (paths.includes(path)) return;
  paths.push(path);
  await mkdir(getStorageRoot(), { recursive: true });
  await writeFile(await registryPath(), JSON.stringify({ paths }, null, 0), 'utf-8');
}

export async function removeFromRegistry(path: string): Promise<void> {
  const paths = (await readRegistry()).filter((p) => p !== path);
  await mkdir(getStorageRoot(), { recursive: true });
  await writeFile(await registryPath(), JSON.stringify({ paths }, null, 0), 'utf-8');
}

export async function clearRegistry(): Promise<void> {
  await mkdir(getStorageRoot(), { recursive: true });
  await writeFile(await registryPath(), JSON.stringify({ paths: [] }, null, 0), 'utf-8');
}
