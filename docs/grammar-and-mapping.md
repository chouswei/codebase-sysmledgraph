# Grammar and symbol mapping

## Two different things

1. **SysML v2 language grammar** – The syntax of `.sysml` / `.kerml` (what is valid SysML). **Not in this repo.** It is defined and updated in the **sysml-v2-lsp** project (the LSP that does the actual parsing).
2. **Symbol → graph mapping** – How LSP *output* (metaclass names, relation names) is turned into graph node labels and edge types in sysmledgraph. **This is in this repo** and is what you update when you want to index new metaclasses or relations.

---

## 1. Updating the SysML v2 language grammar

Parsing is done by **sysml-v2-lsp** (dependency: `github:daltskin/sysml-v2-lsp`). To change what is *parsed* as valid SysML (new syntax, grammar fixes):

- Work in the **sysml-v2-lsp** repository.
- That project typically has a grammar (e.g. ANTLR `.g4` or similar) and a parser generated from it. Update the grammar there, regenerate the parser, and release or point `package.json` at your fork.
- After updating the LSP, rebuild it (`npm run build` in the LSP repo or in `node_modules/sysml-v2-lsp`) and ensure **SYSMLLSP_SERVER_PATH** (if you use it) points to the new server binary.

sysmledgraph does not contain or generate the SysML grammar; it only consumes the LSP’s document symbols.

---

## 2. Updating the symbol → graph mapping (in this repo)

When the LSP returns **new metaclass names** or **new relation semantics**, you map them to the graph here.

### Node labels (LSP metaclass → graph label)

**File:** `src/symbol-to-graph/mapping.ts`

- **`symbolKindToNodeLabel(kind)`** – `kind` is the LSP `DocumentSymbol.detail` (metaclass name from sysml-v2-lsp, e.g. `PartDefinition`, `RequirementUsage`). Add or change entries in the `map` object to support new metaclasses or rename labels.

If you introduce a **new** graph label:

1. Add it to **`NODE_LABELS`** in `src/types.ts`.
2. Add the corresponding Kuzu schema in `src/graph/schema.ts` if you ever split into multiple node tables (currently there is a single `Node` table with a `label` property, so usually no schema change).
3. Add the metaclass → label mapping in **`symbolKindToNodeLabel`** in `src/symbol-to-graph/mapping.ts`.

### Edge types (LSP relation → graph edge type)

**File:** `src/symbol-to-graph/mapping.ts`

- **`relationToEdgeType(relation)`** – `relation` is the relation name from the LSP (e.g. `inDocument`, `inPackage`). Add or change entries to support new relations.

If you introduce a **new** edge type:

1. Add it to **`EDGE_TYPES`** in `src/types.ts`.
2. The Kuzu schema in `src/graph/schema.ts` creates one rel table per `EDGE_TYPES` entry, so a new type will get a new table when the DB is (re)created.
3. Add the relation name → edge type mapping in **`relationToEdgeType`** in `src/symbol-to-graph/mapping.ts`.

### Where LSP output is used

- **`src/parser/symbols.ts`** – Builds normalized symbols from LSP response; uses `symbolKindToNodeLabel(item.sym.detail ?? '')` and emits relations that are later mapped with `relationToEdgeType`.

After editing mapping or types, run `npm run build` and re-index to see new nodes/edges in the graph.
