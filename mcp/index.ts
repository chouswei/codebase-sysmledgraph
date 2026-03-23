#!/usr/bin/env node
/**
 * MCP server entrypoint (stdio). Used by Cursor and other MCP clients.
 * Run: npx sysmledgraph-mcp or node dist/mcp/index.js
 */
import { setStorageRoot } from '../src/storage/location.js';
import { runStdio } from '../src/mcp/server.js';

const root = process.env.SYSMEDGRAPH_STORAGE_ROOT?.trim();
if (root) setStorageRoot(root);

runStdio();
