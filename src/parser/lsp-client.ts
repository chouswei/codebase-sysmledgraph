/**
 * SysML LSP integration: stdio client (JSON-RPC over Content-Length framing).
 * 
 * **MCP Client Pattern**: This follows MCP client lifecycle (initialize → initialized → requests),
 * but uses LSP protocol messages (textDocument/documentSymbol) instead of MCP tools/call.
 * The server uses Content-Length framing (LSP-style), not newline-delimited (MCP SDK style),
 * so we implement a custom transport rather than using @modelcontextprotocol/sdk StdioClientTransport.
 * 
 * Reference: https://github.com/andrea9293/mcp-client-template for MCP client patterns.
 *
 * Spawns an external **server.js** — this repo does **not** bundle sysml-v2-lsp.
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
  /** Set when server returns SymbolInformation (flat list); use as parent for IN_PACKAGE. */
  containerName?: string;
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

/** Create a reader that yields one LSP message at a time from stdout. Rejects on stream close/error or process exit. */
function createMessageReader(proc: ReturnType<typeof spawn>): () => Promise<string> {
  let buffer = '';
  let contentLength: number | null = null;
  let waiting: { resolve: (s: string) => void; reject: (e: Error) => void } | null = null;

  function rejectWaiting(err: Error) {
    if (waiting) {
      waiting.reject(err);
      waiting = null;
    }
  }

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
  proc.stdout?.on('close', () => rejectWaiting(new Error('LSP stdout closed')));
  proc.stdout?.on('error', (err) => rejectWaiting(err instanceof Error ? err : new Error(String(err))));
  proc.on('exit', (code, signal) => {
    rejectWaiting(new Error(`LSP process exited (code=${code}, signal=${signal})`));
  });
  proc.on('error', (err) => rejectWaiting(err instanceof Error ? err : new Error(String(err))));

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

const LSP_REQUEST_TIMEOUT_MS = 30000;

type NotificationHandler = (method: string, params: unknown) => void;

function runLspRequest(
  proc: ReturnType<typeof spawn>,
  readNext: () => Promise<string>,
  method: string,
  params: unknown,
  id: number,
  onNotification?: NotificationHandler
): Promise<unknown> {
  const body = JSON.stringify({ jsonrpc: '2.0', id, method, params });
  sendLspMessage(proc, body);
  return (async () => {
    const deadline = Date.now() + LSP_REQUEST_TIMEOUT_MS;
    for (;;) {
      const raw = await Promise.race([
        readNext(),
        new Promise<never>((_, rej) =>
          setTimeout(() => rej(new Error(`LSP ${method} timeout after ${LSP_REQUEST_TIMEOUT_MS}ms`)), Math.max(100, deadline - Date.now()))
        ),
      ]);
      let msg: { id?: number; method?: string; params?: unknown; result?: unknown; error?: { message: string } };
      try {
        msg = JSON.parse(raw);
      } catch {
        continue; // skip malformed message (e.g. server log line)
      }
      if (msg.id === id) {
        if (msg.error) throw new Error(msg.error.message || JSON.stringify(msg.error));
        return msg.result;
      }
      // Server sent a notification (no id) or response for another request
      if (msg.id === undefined && msg.method && onNotification) {
        onNotification(msg.method, msg.params ?? {});
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

  // Run from package root when path is .../dist/server/server.js so sysml-v2-lsp finds sysml.library.
  // If path is under repo/lsp/node_modules/..., use repo/lsp as cwd (dedicated LSP init folder).
  const serverDir = dirname(path);
  const pathNorm = path.replace(/\\/g, '/');
  const lspNodeModules = '/lsp/node_modules/';
  const lspNodeModulesWin = '\\lsp\\node_modules\\';
  const underLsp =
    pathNorm.includes(lspNodeModules) ||
    path.includes(lspNodeModulesWin);
  const distServer = 'dist' + (serverDir.includes('\\') ? '\\' : '/') + 'server';
  const cwd = underLsp
    ? resolve(process.cwd(), 'lsp')
    : serverDir.endsWith(distServer)
      ? dirname(serverDir)
      : serverDir;

  // On Windows, spawn via cmd /c so Node runs the script (avoids "open with" for .js)
  const isWin = process.platform === 'win32';
  const proc = isWin
    ? spawn('cmd', ['/c', process.execPath, path, '--stdio'], { stdio: ['pipe', 'pipe', 'pipe'], cwd })
    : spawn(process.execPath, [path, '--stdio'], { stdio: ['pipe', 'pipe', 'pipe'], cwd });

  proc.stderr?.on('data', () => {});

  const readNext = createMessageReader(proc);

  const onNotification: NotificationHandler = (method, params) => {
    if (process.env.DEBUG_LSP_NOTIFICATIONS === '1' && (method === 'window/logMessage' || method === 'window/showMessage')) {
      const p = params as { type?: number; message?: string };
      process.stderr.write(`[LSP ${method}] ${p?.message ?? JSON.stringify(params)}\n`);
    }
  };

  // MCP client lifecycle: 1) initialize request
  const rootUri = pathToFileURL(resolve(cwd, '.')).href;
  await runLspRequest(proc, readNext, 'initialize', {
    processId: process.pid,
    rootUri,
    capabilities: {
      textDocument: {
        documentSymbol: { hierarchicalDocumentSymbolSupport: true },
      },
    },
    workspaceFolders: [{ uri: rootUri, name: 'workspace' }],
  }, nextId(), onNotification);

  // MCP client lifecycle: 2) initialized notification (after initialize response)
  sendNotification(proc, 'initialized', {});
  await new Promise((r) => setTimeout(r, 200));

  async function getDocumentSymbols(uri: string, content: string): Promise<DocumentSymbolLsp[]> {
    const docUri = uri.startsWith('file:') ? uri : pathToFileURL(uri).href;
    sendNotification(proc, 'textDocument/didOpen', {
      textDocument: { uri: docUri, languageId: 'sysml', version: 1, text: content },
    });
    await new Promise((r) => setTimeout(r, 500));
    const result = await runLspRequest(
      proc,
      readNext,
      'textDocument/documentSymbol',
      { textDocument: { uri: docUri } },
      nextId(),
      onNotification
    );
    if (result == null) return [];
    let arr: unknown[] = [];
    if (Array.isArray(result)) arr = result;
    else if (typeof result === 'object' && 'data' in result && Array.isArray((result as { data: unknown }).data)) {
      arr = (result as { data: unknown[] }).data;
    }
    if (arr.length === 0) return [];
    // Normalize SymbolInformation (location, name, kind, containerName) → DocumentSymbol-like (range, name, kind)
    const first = arr[0] as Record<string, unknown>;
    if (first?.location && !first?.range) {
      return arr.map((item: unknown) => {
        const i = item as Record<string, unknown>;
        return {
          name: String(i.name ?? ''),
          detail: i.detail != null ? String(i.detail) : undefined,
          kind: Number(i.kind ?? 0),
          range: (i.location as { range?: { start: unknown; end: unknown } })?.range ?? { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
          selectionRange: (i.location as { range?: { start: unknown; end: unknown } })?.range,
          children: undefined,
          containerName: i.containerName != null ? String(i.containerName) : undefined,
        };
      }) as DocumentSymbolLsp[];
    }
    return arr as DocumentSymbolLsp[];
  }

  function close() {
    proc.kill('SIGTERM');
  }

  return { getDocumentSymbols, close };
}

let sharedClient: Awaited<ReturnType<typeof createLspClient>> | null = null;

const LSP_INIT_RETRY_DELAY_MS = 1500;

/** Spawns external LSP (SYSMLLSP_SERVER_PATH). Throws if unset or startup fails. Retries once on transient failure. */
export async function getDocumentSymbolsFromLsp(filePath: string, content: string): Promise<DocumentSymbolLsp[]> {
  if (!sharedClient) {
    try {
      sharedClient = await createLspClient();
    } catch (firstErr) {
      await new Promise((r) => setTimeout(r, LSP_INIT_RETRY_DELAY_MS));
      sharedClient = await createLspClient();
    }
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
