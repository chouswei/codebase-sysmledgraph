#!/usr/bin/env node
/**
 * Example: use SysML MCP as a lib from code.
 * Build first: npm run build
 * Run: node scripts/example-sysml-mcp.mjs
 */
import { createSysmlMcpClient } from '../dist/src/parser/sysml-mcp-client.js';

const code = `package Example {
  requirement ReqOne {
    doc /* requirement one */ "Req one.";
  }
}`;

const client = await createSysmlMcpClient({ initTimeout: 45000 });
try {
  const parseResult = await client.parse(code, 'file:///example.sysml');
  console.log('parse:', JSON.stringify(parseResult, null, 2));

  const validateResult = await client.validate(code, 'file:///example.sysml');
  console.log('validate:', JSON.stringify(validateResult, null, 2));

  const symbolsResult = await client.getSymbols(code, 'file:///example.sysml');
  console.log('getSymbols count:', symbolsResult.count);
} finally {
  client.close();
}
