#!/usr/bin/env node
/**
 * MCP server entrypoint (stdio). Used by Cursor and other MCP clients.
 * Run: npx sysmledgraph-mcp or node dist/mcp/index.js
 */
import { runStdio } from '../src/mcp/server.js';

runStdio();
