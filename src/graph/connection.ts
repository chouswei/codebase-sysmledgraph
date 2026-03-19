/**
 * getConnection() for Cypher. Phase 2.
 */

import type { GraphStore } from './graph-store.js';

export function getConnection(store: GraphStore): unknown {
  return store.getConnection();
}
