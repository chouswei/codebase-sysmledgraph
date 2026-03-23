# Tools reference (all MCP tools)

Single reference for every MCP tool available in this workspace. Use when you need exact parameters, return shapes, or which server exposes which tool.

---

## 1. sysmledgraph MCP (this project)

Server: run `node dist/mcp/index.js` or `sysmledgraph-mcp`. Add to `.cursor/mcp.json` to use from Cursor.

**Subscriber mode:** If **`SYSMLEGRAPH_SUBSCRIBER=1`**, **`indexDbGraph`** and **`clean_index`** are **omitted** from the MCP tool list (use the Publisher workspace to index). Read-only / query tools remain.

Graph: one `Node` table (`id`, `name`, `path`, `label`); rel tables per edge type (`IN_DOCUMENT`, `IN_PACKAGE`, `PARENT`, `TYPES`, `REFERENCES`, `IMPORTS`, etc.). Labels: Document, Package, PartDef, PartUsage, ConnectionDef, ConnectionUsage, PortDef, Port, RequirementDef, Block, ValueType, Action, StateMachine.

| Tool | Description |
|------|-------------|
| **indexDbGraph** | Build the knowledge graph from path(s). |
| **list_indexed** | List indexed path(s). |
| **clean_index** | Remove index for path or all. |
| **cypher** | Run a Cypher query on the graph (uses first indexed path). |
| **query** | Concept search over symbols (by name/label). |
| **context** | 360° view for one symbol (node + edges). |
| **impact** | Blast radius: what uses this element or what it uses. |
| **rename** | Multi-file rename preview (dry_run only in v1). |
| **generate_map** | Generate Markdown from the graph (interconnection view). |

### indexDbGraph

Build the graph from one or more directory paths. Relative paths are resolved against `process.cwd()`.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | no* | Single path to index. |
| `paths` | string[] | no* | Multiple paths to index. |

*At least one of `path` or `paths` is required.

**Returns:** `{ ok: true, filesProcessed: number }` or `{ ok: false, error: string }`

**Environment:** **`SYSMLEGRAPH_INDEX_REFERENCES=1`** — after the normal index pass, run MCP **`getReferences`** and add **REFERENCES** edges (slow). See **MCP_INTERACTION_GUIDE** §6.

---

### list_indexed

List all paths currently registered in the index.

**Parameters:** None.

**Returns:** `{ ok: true, paths: string[] }` or `{ ok: false, error: string }`

---

### clean_index

Remove index data for a path or for all indexed paths.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | no | Path to clean; omit to clean all. |

**Returns:** `{ ok: true, removed: string[] }` or `{ ok: false, error: string }`

---

### cypher

Run a Cypher query against the graph. Uses the first indexed path to resolve the DB.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `query` | string | yes | Cypher query string. |

**Returns:** `{ ok: true, rows: unknown[] }` or `{ ok: false, error: string }`

**Example:** `MATCH (n:Node) WHERE n.label = 'PartDef' RETURN n.id, n.name, n.path LIMIT 50`

---

### query

Concept search over symbols: matches `query` against node names/labels (case-insensitive). Optional filter by node label.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `query` | string | yes | Search string. |
| `kind` | string | no | Filter by node label (e.g. `PartDef`, `Document`). |

**Returns:** `{ ok: true, nodes: unknown[] }` or `{ ok: false, error: string }`

---

### context

Return one node and its edges (incoming and outgoing) for a symbol by name or id.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `name` | string | yes | Symbol name or id. |

**Returns:** `{ ok: true, node: unknown, edges: unknown[] }` or `{ ok: false, error: string }`

---

### impact

Blast radius: list nodes that reference the target (upstream) or that the target references (downstream).

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `target` | string | yes | Symbol name or id. |
| `direction` | `'upstream'` \| `'downstream'` | no | `upstream` = what references this; `downstream` = what this references. |

**Returns:** `{ ok: true, nodes: unknown[] }` or `{ ok: false, error: string }`

---

### rename

Multi-file rename preview. In v1, only dry-run is implemented; no edits are applied.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `symbol` | string | yes | Symbol to rename. |
| `newName` | string | yes | New name. |
| `dry_run` | boolean | no | If true, only return preview (default: true). |

**Returns:** `{ ok: true, preview: { path: string, count: number }[], message?: string }` or `{ ok: false, error: string }`

---

### generate_map

Generate Markdown from the graph (documents, nodes by label, edges). Uses first indexed path. Fails if no indexed path or empty graph.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `output_path` | string | no | Optional path to write the .md file (if server can write). |

**Returns:** `{ ok: true, markdown: string }` or `{ ok: false, error: string }`

---

### Resources (sysmledgraph)

| URI | Description |
|-----|-------------|
| `sysmledgraph://context` | Index stats and indexed paths (markdown). |
| `sysmledgraph://context/{path}` | Context for a specific indexed path. |
| `sysmledgraph://schema` | Graph node/edge schema (markdown). |
| `sysmledgraph://schema/{path}` | Schema for a specific indexed path. |

---

## 2. GitNexus MCP

Server: `npx -y gitnexus@latest mcp` (configured in `.cursor/mcp.json` as `gitnexus`).

Index: run `npx gitnexus analyze` from project root first. Read `gitnexus://repo/{name}/context` for overview and staleness; read `gitnexus://repo/{name}/schema` before using `cypher`.

| Tool | Description |
|------|-------------|
| **query** | Process-grouped code intelligence — execution flows related to a concept. |
| **context** | 360° symbol view — categorized refs, processes it participates in. |
| **impact** | Symbol blast radius — depth 1/2/3 with confidence. |
| **detect_changes** | Git-diff impact — what do current changes affect. |
| **rename** | Multi-file coordinated rename with confidence-tagged edits. |
| **cypher** | Raw graph queries (read schema resource first). |
| **list_repos** | Discover indexed repos. |

### query (GitNexus)

Find execution flows and symbols related to a concept.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `query` | string | yes | Concept or search text (e.g. "payment processing", "auth"). |

**Returns:** Process-grouped results; symbols and file locations per flow.

---

### context (GitNexus)

Full context for one symbol: incoming/outgoing calls, processes, file.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `name` | string | yes | Symbol name (e.g. function, class). |

**Returns:** Incoming calls, outgoing calls, processes the symbol participates in.

---

### impact (GitNexus)

Blast radius with depth and confidence. Use before changing code.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `target` | string | yes | Symbol name. |
| `direction` | `'upstream'` \| `'downstream'` | no | `upstream` = what depends on this. |
| `minConfidence` | number | no | e.g. 0.8. |
| `maxDepth` | number | no | e.g. 3 (d=1 direct, d=2/3 transitive). |

**Returns:** Nodes by depth (d=1 WILL BREAK, d=2 LIKELY AFFECTED, d=3 MAY NEED TESTING).

---

### detect_changes (GitNexus)

Map current git changes to affected symbols and processes.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `scope` | `'staged'` \| `'all'` | no | Staged changes only or all working-tree changes. |

**Returns:** Changed symbols, affected processes, risk level.

---

### rename (GitNexus)

Multi-file rename with graph + AST search; supports dry_run then apply.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `symbol_name` | string | yes | Current symbol name. |
| `new_name` | string | yes | New name. |
| `dry_run` | boolean | no | If true, preview only (default: true). |

**Returns:** List of edits (file_path, line, old_text, new_text, confidence); graph edits high confidence, ast_search edits need review.

---

### cypher (GitNexus)

Run Cypher on the GitNexus graph. Read `gitnexus://repo/{name}/schema` first.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `query` | string | yes | Cypher query. |

**Returns:** Query result rows.

**Example:** `MATCH (caller)-[:CodeRelation {type: 'CALLS'}]->(f:Function {name: "myFunc"}) RETURN caller.name, caller.filePath`

---

### list_repos (GitNexus)

List all repos registered in the GitNexus registry.

**Parameters:** None.

**Returns:** Indexed repo names/paths (same as `npx gitnexus list`).

---

### Resources (GitNexus)

| URI | Description |
|-----|-------------|
| `gitnexus://repo/{name}/context` | Stats, staleness check. |
| `gitnexus://repo/{name}/clusters` | Functional areas with cohesion scores. |
| `gitnexus://repo/{name}/cluster/{clusterName}` | Area members. |
| `gitnexus://repo/{name}/processes` | All execution flows. |
| `gitnexus://repo/{name}/process/{processName}` | Step-by-step trace. |
| `gitnexus://repo/{name}/schema` | Graph schema for Cypher. |

---

## 3. Other MCP servers (this workspace)

| Server | Purpose | Tools |
|--------|---------|--------|
| **sysml-v2** | SysML v2 LSP MCP | See `node_modules/sysml-v2-lsp` for tool list. |
| **context7** | Context7 MCP | See `@upstash/context7-mcp` for tool list. |

---

## Quick pick: which tool for what

| Goal | Prefer |
|------|--------|
| Index SysML/models in this project | sysmledgraph **indexDbGraph** |
| Search SysML symbols / graph query | sysmledgraph **query**, **cypher**, **context** |
| “What uses this?” (sysmledgraph) | sysmledgraph **impact** |
| Understand or explore a codebase (TS/JS etc.) | GitNexus **query**, **context**; resources **process**, **clusters** |
| “What breaks if I change this?” (code) | GitNexus **impact**, **detect_changes** |
| Rename symbol across files (code) | GitNexus **rename** (dry_run first) |
| Rename symbol (SysML graph only) | sysmledgraph **rename** (preview only in v1) |
| List what’s indexed | sysmledgraph **list_indexed**; GitNexus **list_repos** |
