/**
 * SysML MCP client: spawns sysml-v2-lsp MCP server and exposes tools as a callable API.
 * Use this when you want to call parse, validate, getSymbols, etc. from code (e.g. tests or scripts).
 *
 * Requires sysml-v2-lsp as a dependency. Uses the same Content-Length framing as the MCP server.
 */

import { spawn, type ChildProcess } from 'child_process';
import { createRequire } from 'module';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);

/** Resolved path to mcpServer.js (from sysml-v2-lsp package). */
export function getMcpServerPath(): string {
  try {
    const { mcpServerPath } = require('sysml-v2-lsp') as { mcpServerPath: string };
    return mcpServerPath;
  } catch {
    const fromCwd = resolve(process.cwd(), 'node_modules/sysml-v2-lsp/dist/server/mcpServer.js');
    return fromCwd;
  }
}

function sendMessage(proc: ChildProcess, body: string): void {
  const buf = Buffer.from(body, 'utf8');
  const header = `Content-Length: ${buf.length}\r\n\r\n`;
  proc.stdin?.write(header + body, 'utf8');
}

function createMcpReader(proc: ChildProcess): {
  readNext: () => Promise<string>;
  drain: () => void;
} {
  let buffer = '';
  let contentLength: number | null = null;
  let pending: { resolve: (s: string) => void; reject: (e: Error) => void } | null = null;

  proc.stdout?.setEncoding('utf8');
  proc.stdout?.on('data', (chunk: string) => {
    buffer += chunk;
    for (;;) {
      if (contentLength === null) {
        const idx = buffer.indexOf('\r\n\r\n');
        if (idx === -1) break;
        const header = buffer.slice(0, idx);
        const m = header.match(/Content-Length:\s*(\d+)/i);
        contentLength = m ? parseInt(m[1], 10) : 0;
        buffer = buffer.slice(idx + 4);
      }
      if (contentLength !== null && buffer.length >= contentLength) {
        const body = buffer.slice(0, contentLength);
        buffer = buffer.slice(contentLength);
        contentLength = null;
        if (pending) {
          pending.resolve(body);
          pending = null;
        }
      } else break;
    }
  });

  function readNext(): Promise<string> {
    return new Promise((resolve, reject) => {
      pending = { resolve, reject };
    });
  }

  function drain() {
    buffer = '';
    contentLength = null;
    if (pending) {
      pending.reject(new Error('drained'));
      pending = null;
    }
  }

  return { readNext, drain };
}

let id = 0;
function nextId(): number {
  return ++id;
}

export interface SysmlMcpClientOptions {
  /** Override path to mcpServer.js. Default: from sysml-v2-lsp package. */
  serverPath?: string;
  /** Timeout in ms for initialize. Default 20000. */
  initTimeout?: number;
}

export interface ParseResult {
  uri: string;
  symbolCount: number;
  errorCount: number;
  timing?: { lex: number; parse: number };
  errors?: Array<{ line: number; column: number; message: string; length?: number }>;
  topLevelElements?: string[];
}

export interface ValidateResult {
  valid: boolean;
  syntaxErrors: Array<{ line: number; column: number; message: string; length?: number }>;
  semanticIssues: Array<{ line: number; column: number; message: string; severity?: string; code?: string }>;
  totalIssues: number;
}

export interface SymbolInfo {
  name: string;
  kind: string;
  qualifiedName?: string;
  documentation?: string;
  parent?: string;
  location?: { uri: string; range: { start: { line: number; character: number }; end: { line: number; character: number } } };
}

export interface GetSymbolsResult {
  count: number;
  symbols: SymbolInfo[];
}

/**
 * Client that talks to sysml-v2-lsp MCP server over stdio.
 * Call createSysmlMcpClient(), then use the returned methods, then close().
 */
export async function createSysmlMcpClient(options: SysmlMcpClientOptions = {}): Promise<{
  parse: (code: string, uri?: string) => Promise<ParseResult>;
  validate: (code: string, uri?: string) => Promise<ValidateResult>;
  getDiagnostics: (code: string, uri?: string) => Promise<{ uri: string; diagnostics: unknown[]; summary?: Record<string, number> }>;
  validateFile: (code: string, uri?: string) => Promise<ValidateResult>;
  getSymbols: (code: string, uri?: string) => Promise<GetSymbolsResult>;
  getDefinition: (name: string, code: string, uri?: string) => Promise<{ found: boolean; count: number; symbols: SymbolInfo[] }>;
  getReferences: (name: string, code: string, uri?: string) => Promise<{ name: string; referenceCount: number; references: SymbolInfo[] }>;
  getHierarchy: (name: string, code: string, uri?: string) => Promise<{ element: unknown; ancestors: unknown[]; children: unknown[] }>;
  getModelSummary: (code: string, uri?: string) => Promise<unknown>;
  getComplexity: (code: string, uri?: string) => Promise<unknown>;
  preview: (code: string, uri?: string) => Promise<unknown>;
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  close: () => void;
}> {
  const serverPath = options.serverPath ?? getMcpServerPath();
  const initTimeout = options.initTimeout ?? 20000;

  const pkgRoot = resolve(dirname(serverPath), '../..');
  const proc = spawn(process.execPath, [serverPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: pkgRoot,
  });

  proc.stderr?.on('data', () => {});

  const { readNext, drain } = createMcpReader(proc);

  const reqId = nextId();
  sendMessage(proc, JSON.stringify({
    jsonrpc: '2.0',
    id: reqId,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'sysmledgraph-mcp-client', version: '0.1.0' },
    },
  }));

  const initResponse = await Promise.race([
    (async () => {
      for (;;) {
        const raw = await readNext();
        const msg = JSON.parse(raw) as { id?: number; result?: unknown; error?: { message: string } };
        if (msg.id === reqId) {
          if (msg.error) throw new Error(msg.error.message);
          return msg.result;
        }
      }
    })(),
    new Promise<never>((_, rej) => setTimeout(() => rej(new Error('initialize timeout')), initTimeout)),
  ]);

  if (!initResponse) {
    proc.kill('SIGTERM');
    throw new Error('initialize returned no result');
  }

  sendMessage(proc, JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }));
  await new Promise((r) => setTimeout(r, 200));

  async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    const uri = (args.uri as string) ?? 'file:///untitled.sysml';
    const toolArgs = { ...args, uri };
    const rid = nextId();
    sendMessage(proc, JSON.stringify({
      jsonrpc: '2.0',
      id: rid,
      method: 'tools/call',
      params: { name, arguments: toolArgs },
    }));

    for (;;) {
      const raw = await readNext();
      const msg = JSON.parse(raw) as {
        id?: number;
        result?: { content?: Array<{ type?: string; text?: string }>; isError?: boolean };
        error?: { message: string };
      };
      if (msg.id === rid) {
        if (msg.error) throw new Error(msg.error.message);
        const result = msg.result;
        if (!result?.content?.length) return result;
        const text = result.content[0].text;
        if (typeof text !== 'string') return result;
        try {
          return JSON.parse(text) as unknown;
        } catch {
          return result;
        }
      }
    }
  }

  const uriDefault = 'file:///untitled.sysml';
  return {
    parse: (code, uri = uriDefault) => callTool('parse', { code, uri }) as Promise<ParseResult>,
    validate: (code, uri = uriDefault) => callTool('validate', { code, uri }) as Promise<ValidateResult>,
    getDiagnostics: (code, uri = uriDefault) => callTool('getDiagnostics', { code, uri }) as Promise<{ uri: string; diagnostics: unknown[]; summary?: Record<string, number> }>,
    validateFile: (code, uri = uriDefault) => callTool('validateFile', { code, uri }) as Promise<ValidateResult>,
    getSymbols: (code, uri = uriDefault) => callTool('getSymbols', { code, uri }) as Promise<GetSymbolsResult>,
    getDefinition: (name, code, uri = uriDefault) => callTool('getDefinition', { name, code, uri }) as Promise<{ found: boolean; count: number; symbols: SymbolInfo[] }>,
    getReferences: (name, code, uri = uriDefault) => callTool('getReferences', { name, code, uri }) as Promise<{ name: string; referenceCount: number; references: SymbolInfo[] }>,
    getHierarchy: (name, code, uri = uriDefault) => callTool('getHierarchy', { name, code, uri }) as Promise<{ element: unknown; ancestors: unknown[]; children: unknown[] }>,
    getModelSummary: (code, uri = uriDefault) => callTool('getModelSummary', { code, uri }),
    getComplexity: (code, uri = uriDefault) => callTool('getComplexity', { code, uri }),
    preview: (code, uri = uriDefault) => callTool('preview', { code, uri }),
    callTool,
    close: () => {
      drain();
      proc.kill('SIGTERM');
    },
  };
}
