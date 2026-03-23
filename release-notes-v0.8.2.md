# Release notes – v0.8.2

**Release date:** 2026-03-23

## Summary

Indexer writes **all symbol nodes before any edges** (fixes missing **IN_PACKAGE** when the parent appears in a **later** file). Optional **MCP `getReferences`** pass adds **REFERENCES** edges when **`SYSMLEGRAPH_INDEX_REFERENCES=1`**. Design doc **§8.2** adds a **Failed (StrictError)** state. Maintainer **publish checklist** in **docs/PUBLISH.md**.

## Indexer

- **Two-phase write** — **`applyIndexedBatches`**: documents → symbols → edges (`src/indexer/indexer.ts`). Unit test: **`test/indexer/apply-batches.test.ts`**.
- **Cross-file REFERENCES (opt-in)** — **`SYSMLEGRAPH_INDEX_REFERENCES=1`**: after indexing, **`runMcpReferencesPass`** (`src/indexer/reference-pass.ts`) spawns sysml-v2-lsp MCP and adds **REFERENCES** edges when both node ids exist. Documented in **README**, **MCP_INTERACTION_GUIDE** §6–§7, §9.

## Documentation

- **DESIGN_LONG_LIVED_WORKER.md** §8.2 — **Failed** state and strict transitions; §10.3 table row updated; old “add StrictError” recommendation removed.
- **docs/PUBLISH.md** — npm checklist.
- **docs/PLAN.md** / **PLAN_IMPLEMENT** — follow-ups and released line.

## MCP

- **`SERVER_VERSION`** → **0.8.2**.

## Upgrade

```bash
npm install sysmledgraph@0.8.2
cd node_modules/sysmledgraph && npm run setup-lsp
```

Optional indexing:

```bash
set SYSMLEGRAPH_INDEX_REFERENCES=1
npx sysmledgraph analyze <path>
```

(On Unix: `export SYSMLEGRAPH_INDEX_REFERENCES=1`.)
