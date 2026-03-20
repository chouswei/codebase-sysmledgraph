# Release notes – v0.4.4

**Release date:** 2026-03-20

## Summary

Skill design patterns applied to GitNexus skills (tool-wrapper / pipeline metadata, gates). Single tools reference for all MCP tools (sysmledgraph + GitNexus). Docs and script updates; debug artifacts ignored.

## Changes

### Skills

- **Design patterns:** All six GitNexus skills tagged with `metadata.pattern` (tool-wrapper for cli/guide, pipeline for exploring/debugging/impact-analysis/refactoring) and explicit “execute in order; do not skip steps” gates per [docs/SKILL_DESIGN_PATTERNS.md](docs/SKILL_DESIGN_PATTERNS.md).
- **.cursor/skills/:** Deployed skills plus README with “Applied patterns” table. Source of truth: `.claude/skills/gitnexus/`; deploy via `npm run deploy-skills`.

### Documentation

- **docs/TOOLS.md:** Single reference for all MCP tools: sysmledgraph (indexDbGraph, list_indexed, clean_index, cypher, query, context, impact, rename, generate_map) and GitNexus (query, context, impact, detect_changes, rename, cypher, list_repos) with parameters, return shapes, and resources.
- **docs/MCP_INTERACTION_GUIDE.md**, **docs/PLAN.md:** Updates.

### Tooling

- **scripts/validate-sysml-file.mjs:** Updates.
- **.gitignore:** Ignore `compare-*-symbols.json`, `debug-lsp-out.txt`.

### Other

- **mcp/index.ts:** MCP server entrypoint (stdio) at repo root; included in build for `dist/mcp/index.js`.

## Upgrade

- `npm install` then `npm run build`. To deploy skills to Cursor: `npm run deploy-skills` (project) or `npm run deploy-skills -- --user` (user-wide).
