/**
 * SysML LSP integration: stdio client (JSON-RPC over Content-Length framing).
 * Spawns an external **server.js** — this repo does **not** bundle sysml-v2-lsp.
 *
 * Set **SYSMLLSP_SERVER_PATH** to a built [daltskin/sysml-v2-lsp](https://github.com/daltskin/sysml-v2-lsp)
 * `dist/server/server.js` (from a separate install or wherever your SysML MCP/LSP provides it).
 */

import { spawn } from 'child_process';
import { pathToFileURL } from 'url';
import { dirname, resolve } from 'path';

export interface DocumentSymbolLsp {
  name: string;
  detail?: string;
  kind: number;
  range: { start: { line: number; character: number }; end: { line: number; character: number } };
  selectionRange?: { start: { line: number; character: number }; end: { line: number; character: number } };
  children?: DocumentSymbolLsp[];
}

/** Absolute path to LSP server script, or null if SYSMLLSP_SERVER_PATH is unset/invalid. */
export function resolveLspServerPath(): string | null {
  const p = process.env.SYSMLLSP_SERVER_PATH?.trim();
  if (!p) return null;
  const isAbsolute = p.startsWith('/') || /^[A-Za-z]:[/\\]/.test(p);
  return isAbsolute ? p : resolve(process.cwd(), p);
}

function sendLspMessage(proc: ReturnType<typeof spawn>, body: string): void {
  const buf = Buffer.from(body, 'utf8');
  proc.stdin?.write(`Content-Length: ${buf.length}\r\n\r\n`, 'utf8');
  proc.stdin?.write(buf, 'utf8');
}

/** Create a reader that yields one LSP message at a time from stdout. */
function createMessageReader(proc: ReturnType<typeof spawn>): () => Promise<string> {
  let buffer = '';
  let contentLength: number | null = null;
  let waiting: { resolve: (s: string) => void; reject: (e: Error) => void } | null = null;

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
        if (waiting) {
          waiting.resolve(body);
          waiting = null;
        }
      } else break;
    }
  });

  return () =>
    new Promise<string>((resolve, reject) => {
      if (buffer.length > 0 && contentLength !== null && buffer.length >= contentLength) {
        const body = buffer.slice(0, contentLength);
        buffer = buffer.slice(contentLength);
        contentLength = null;
        resolve(body);
        return;
      }
      waiting = { resolve, reject };
    });
}

function runLspRequest(
  proc: ReturnType<typeof spawn>,
  readNext: () => Promise<string>,
  method: string,
  params: unknown,
  id: number
): Promise<unknown> {
  const body = JSON.stringify({ jsonrpc: '2.0', id, method, params });
  sendLspMessage(proc, body);
  return (async () => {
    for (;;) {
      const raw = await readNext();
      const msg = JSON.parse(raw);
      if (msg.id === id) {
        if (msg.error) throw new Error(msg.error.message || JSON.stringify(msg.error));
        return msg.result;
      }
    }
  })();
}

function sendNotification(proc: ReturnType<typeof spawn>, method: string, params: unknown): void {
  sendLspMessage(proc, JSON.stringify({ jsonrpc: '2.0', method, params }));
}

let requestId = 1;
function nextId(): number {
  return requestId++;
}

export async function createLspClient(): Promise<{
  getDocumentSymbols: (uri: string, content: string) => Promise<DocumentSymbolLsp[]>;
  close: () => void;
}> {
  const path = resolveLspServerPath();
  if (!path) {
    throw new Error(
      'SysML LSP server path not set. Set SYSMLLSP_SERVER_PATH to the absolute or cwd-relative path ' +
        'to sysml-v2-lsp dist/server/server.js (install [daltskin/sysml-v2-lsp](https://github.com/daltskin/sysml-v2-lsp) ' +
        'separately or via your SysML MCP setup). This package no longer bundles sysml-v2-lsp.'
    );
  }

  // Run from package root when path is .../dist/server/server.js so sysml-v2-lsp finds sysml.library
  const serverDir = dirname(path);
  const distServer = 'dist' + (serverDir.includes('\\') ? '\\' : '/') + 'server';
  const cwd = serverDir.endsWith(distServer) ? dirname(serverDir) : serverDir;

  const proc = spawn(process.execPath, [path], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd,
  });

  proc.stderr?.on('data', () => {});

  const readNext = createMessageReader(proc);

  await runLspRequest(proc, readNext, 'initialize', {
    processId: process.pid,
    rootUri: null,
    capabilities: {},
    workspaceFolders: null,
  }, nextId());

  sendNotification(proc, 'initialized', {});
  await new Promise((r) => setTimeout(r, 200));

  async function getDocumentSymbols(uri: string, content: string): Promise<DocumentSymbolLsp[]> {
    const docUri = uri.startsWith('file:') ? uri : pathToFileURL(uri).href;
    sendNotification(proc, 'textDocument/didOpen', {
      textDocument: { uri: docUri, languageId: 'sysml', version: 1, text: content },
    });
    await new Promise((r) => setTimeout(r, 150));
    const result = await runLspRequest(
      proc,
      readNext,
      'textDocument/documentSymbol',
      { textDocument: { uri: docUri } },
      nextId()
    );
    return (result as DocumentSymbolLsp[]) ?? [];
  }

  function close() {
    proc.kill('SIGTERM');
  }

  return { getDocumentSymbols, close };
}

let sharedClient: Awaited<ReturnType<typeof createLspClient>> | null = null;

/** Spawns external LSP (SYSMLLSP_SERVER_PATH). Throws if unset or startup fails. */
export async function getDocumentSymbolsFromLsp(filePath: string, content: string): Promise<DocumentSymbolLsp[]> {
  if (!sharedClient) {
    sharedClient = await createLspClient();
  }
  const uri = pathToFileURL(filePath).href;
  return await sharedClient.getDocumentSymbols(uri, content);
}

export function closeLspClient(): void {
  if (sharedClient) {
    sharedClient.close();
    sharedClient = null;
  }
}
