/**
 * GraphStore: open/create Kuzu DB, addDocument, addSymbol, addEdge, getConnection.
 * Phase 2 step 7.
 * Connection cache: one store per dbPath per process to avoid Kuzu "Could not set lock on file".
 */

import * as kuzu from 'kuzu';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';
import type { NodeLabel, SymbolProps } from '../types.js';
import { getSchemaDdl, NODE_TABLE } from './schema.js';

const storeCache = new Map<string, GraphStore>();

function escapeCypherString(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export interface GraphStore {
  addDocument(path: string, indexedAt?: string): Promise<void>;
  addSymbol(label: NodeLabel, props: SymbolProps): Promise<void>;
  addEdge(fromId: string, toId: string, type: string): Promise<void>;
  getConnection(): kuzu.Connection;
  /** Delete all nodes whose path equals rootPath or starts with rootPath + sep (for merged graph clean/re-index). */
  deleteNodesForRoot?(rootPath: string): Promise<void>;
  /** Close the connection and database so the DB file can be reopened or deleted. Call before invalidate. */
  close?(): Promise<void>;
}

/**
 * Create or open a GraphStore at the given DB path. Initializes schema if new.
 */
export async function openGraphStore(dbPath: string): Promise<GraphStore> {
  await mkdir(dirname(dbPath), { recursive: true });
  const db = new kuzu.Database(dbPath);
  const conn = new kuzu.Connection(db);

  for (const ddl of getSchemaDdl()) {
    try {
      await conn.query(ddl);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes('already exists')) throw e;
    }
  }

  async function addDocument(path: string, _indexedAt?: string): Promise<void> {
    const pathEsc = escapeCypherString(path);
    const label = 'Document';
    await conn.query(
      `MERGE (n:${NODE_TABLE} {id: '${pathEsc}'}) ON CREATE SET n.name = '${pathEsc}', n.path = '${pathEsc}', n.label = '${label}' ON MATCH SET n.name = '${pathEsc}', n.path = '${pathEsc}', n.label = '${label}'`
    );
  }

  async function addSymbol(label: NodeLabel, props: SymbolProps): Promise<void> {
    const id = (props.qualifiedName as string) ?? `${props.path}:${props.name}`;
    const nameEsc = escapeCypherString(props.name);
    const pathEsc = escapeCypherString(props.path);
    const idEsc = escapeCypherString(id);
    const labelEsc = escapeCypherString(label);
    await conn.query(
      `MERGE (n:${NODE_TABLE} {id: '${idEsc}'}) ON CREATE SET n.name = '${nameEsc}', n.path = '${pathEsc}', n.label = '${labelEsc}' ON MATCH SET n.name = '${nameEsc}', n.path = '${pathEsc}', n.label = '${labelEsc}'`
    );
  }

  async function addEdge(fromId: string, toId: string, type: string): Promise<void> {
    const fromEsc = escapeCypherString(fromId);
    const toEsc = escapeCypherString(toId);
    await conn.query(
      `MATCH (a:${NODE_TABLE} {id: '${fromEsc}'}), (b:${NODE_TABLE} {id: '${toEsc}'}) MERGE (a)-[:${type}]->(b)`
    );
  }

  /** Delete nodes for one indexed root (path = root or path under root). Used for clean and re-index with merged graph. */
  async function deleteNodesForRoot(rootPath: string): Promise<void> {
    const rootEsc = escapeCypherString(rootPath);
    const rootPrefixEscFwd = escapeCypherString(rootPath.replace(/\\/g, '/') + '/');
    const rootPrefixEscBk = escapeCypherString(rootPath + (rootPath.endsWith('\\') ? '' : '\\'));
    try {
      await conn.query(
        `MATCH (n:${NODE_TABLE}) WHERE n.path = '${rootEsc}' OR starts_with(n.path, '${rootPrefixEscFwd}') OR starts_with(n.path, '${rootPrefixEscBk}') DETACH DELETE n`
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('starts_with') || msg.includes('DETACH')) {
        await conn.query(`MATCH (n:${NODE_TABLE}) WHERE n.path = '${rootEsc}' DETACH DELETE n`);
      } else throw e;
    }
  }

  async function close(): Promise<void> {
    await (conn as unknown as { close(): Promise<void> }).close();
    await (db as unknown as { close(): Promise<void> }).close();
  }

  return {
    addDocument,
    addSymbol,
    addEdge,
    getConnection: () => conn,
    deleteNodesForRoot,
    close,
  };
}

/**
 * Return cached GraphStore for dbPath or open once and cache it.
 * Use this in MCP tools so repeated/concurrent requests share one connection per DB (avoids Kuzu lock errors).
 */
export async function getCachedOrOpenGraphStore(dbPath: string): Promise<GraphStore> {
  const cached = storeCache.get(dbPath);
  if (cached) return cached;
  const store = await openGraphStore(dbPath);
  storeCache.set(dbPath, store);
  return store;
}

/**
 * Remove cached store for dbPath. Next getCachedOrOpenGraphStore(dbPath) will open a new connection.
 * Call before re-index or clean so the next access sees the new or removed DB.
 */
export function invalidateGraphStoreCache(dbPath: string): void {
  storeCache.delete(dbPath);
}

/**
 * Close the cached store for dbPath and remove it from the cache. Use before clean or when the DB file will be deleted/reopened.
 * Avoids "Could not set lock on file" when the same process reopens or deletes the DB.
 */
export async function closeGraphStoreCache(dbPath: string): Promise<void> {
  const store = storeCache.get(dbPath);
  if (store?.close) await store.close();
  storeCache.delete(dbPath);
}
