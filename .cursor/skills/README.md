# Cursor skills (project)

Deployed from `.claude/skills/gitnexus/` via `npm run deploy-skills`.

**Skill design reference:** [docs/SKILL_DESIGN_PATTERNS.md](../../docs/SKILL_DESIGN_PATTERNS.md) — Tool Wrapper, Generator, Reviewer, Inversion, Pipeline.

## Applied patterns

| Skill | Pattern | Notes |
|-------|---------|--------|
| gitnexus-cli | tool-wrapper | On-demand context for GitNexus CLI (analyze, status, clean, wiki, list). |
| gitnexus-guide | tool-wrapper | On-demand context for tools, resources, schema. |
| gitnexus-exploring | pipeline | 5 steps in order; gate: do not skip steps. |
| gitnexus-debugging | pipeline | 4 steps in order; gate: do not skip steps. |
| gitnexus-impact-analysis | pipeline | 4 steps in order; gate: do not skip steps. |
| gitnexus-refactoring | pipeline | 4 steps; gate: dry_run before apply, do not skip steps. |

To deploy to your user folder (all projects): `npm run deploy-skills -- --user`.
