#!/usr/bin/env node
/**
 * Validate a SysML file using sysml-v2-lsp MCP (validate tool).
 * Usage: node scripts/validate-sysml-file.mjs <path-to.sysml>
 */
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { existsSync } from 'fs';

const pathArg = process.argv[2];
if (!pathArg) {
  console.error('Usage: node scripts/validate-sysml-file.mjs <path-to.sysml>');
  process.exit(1);
}

const absPath = resolve(process.cwd(), pathArg);
if (!existsSync(absPath)) {
  console.error('File not found:', absPath);
  process.exit(1);
}

const content = await readFile(absPath, 'utf-8');
const uri = `file:///${absPath.replace(/\\/g, '/')}`;

const { createSysmlMcpClient, getMcpServerPath } = await import('../dist/src/parser/sysml-mcp-client.js');
const serverPath = getMcpServerPath();
if (!serverPath || !existsSync(serverPath)) {
  console.error('sysml-v2-lsp MCP server not found. Run: npm install');
  process.exit(1);
}

const client = await createSysmlMcpClient({ serverPath, initTimeout: 60000 });
try {
  const result = await client.validate(content, uri);
  console.log('Valid:', result.valid);
  console.log('Total issues:', result.totalIssues ?? 0);
  if (result.syntaxErrors?.length) {
    console.log('\nSyntax errors:');
    result.syntaxErrors.forEach((e) => console.log(`  L${e.line}:${e.column} ${e.message}`));
  }
  if (result.semanticIssues?.length) {
    console.log('\nSemantic issues:');
    result.semanticIssues.forEach((e) => console.log(`  L${e.line}:${e.column} [${e.severity ?? 'info'}] ${e.message}`));
  }
  if (result.valid && (result.totalIssues ?? 0) === 0) {
    console.log('\nNo issues found.');
  }
} finally {
  client.close();
}
