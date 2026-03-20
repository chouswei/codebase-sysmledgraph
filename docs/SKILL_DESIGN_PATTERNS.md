# Agent skill design patterns

**Summary:** The SKILL.md format (YAML, layout, spec) is standardized across 30+ agent tools. The real challenge is **content design**—how to structure the logic inside a skill. This doc captures five recurring patterns (from ecosystem practice: Anthropic, Vercel, Google, ADK) so we choose the right structure and compose skills reliably.

**When to use:** When creating or refactoring an agent *skill* (e.g. a `SKILL.md` file) in your repo, regardless of the specific agent runtime. This is about **content design** inside the skill, not about YAML/formatting.

---

## 1. Tool Wrapper

**Purpose:** Give the agent on-demand context for a **specific library or API**. Conventions live in the skill (or in `references/`); the agent loads them only when working with that technology.

**Mechanism:** Listen for library/keyword in the user prompt → load internal docs (e.g. `references/conventions.md`) → apply as authority when reviewing or writing code.

**Fits:** API experts (FastAPI, SysML v2), framework best practices, team coding guidelines.

**Example (generic):** A skill that wraps the conventions for a specific library/API. It loads the conventions only when the user's request is actually about that library/API.

**Full example (Tool Wrapper):**

```markdown
# skills/api-expert/SKILL.md
---
name: api-expert
description: FastAPI development best practices and conventions. Use when building, reviewing, or debugging FastAPI applications, REST APIs, or Pydantic models.
metadata:
  pattern: tool-wrapper
  domain: fastapi
---

You are an expert in FastAPI development. Apply these conventions to the user's code or question.

## Core Conventions

Load 'references/conventions.md' for the complete list of FastAPI best practices.

## When Reviewing Code
1. Load the conventions reference
2. Check the user's code against each convention
3. For each violation, cite the specific rule and suggest the fix

## When Writing Code
1. Load the conventions reference
2. Follow every convention exactly
3. Add type annotations to all function signatures
4. Use Annotated style for dependency injection
```

The actual rules live in `references/conventions.md`; the skill only says when to load them and how to apply them.

---

## 2. Generator

**Purpose:** Enforce **consistent output** from a fill-in-the-blank process. Avoids the agent inventing a new document structure every run.

**Mechanism:** `assets/` = output template; `references/` = style guide. Instructions: load template + style → ask user for missing variables → fill template → return single artifact.

**Fits:** Technical reports, API docs, commit messages, project scaffolds, standardized .md from a template.

**Example (generic):** Generating a standardized report or plan from a reusable template (so the output structure stays consistent across runs).

**Full example (Generator):**

```markdown
# skills/report-generator/SKILL.md
---
name: report-generator
description: Generates structured technical reports in Markdown. Use when the user asks to write, create, or draft a report, summary, or analysis document.
metadata:
  pattern: generator
  output-format: markdown
---

You are a technical report generator. Follow these steps exactly:

Step 1: Load 'references/style-guide.md' for tone and formatting rules.

Step 2: Load 'assets/report-template.md' for the required output structure.

Step 3: Ask the user for any missing information needed to fill the template:
- Topic or subject
- Key findings or data points
- Target audience (technical, executive, general)

Step 4: Fill the template following the style guide rules. Every section in the template must be present in the output.

Step 5: Return the completed report as a single Markdown document.
```

Structure lives in `assets/report-template.md`, style in `references/style-guide.md`; the skill orchestrates load → gather vars → fill → return.

---

## 3. Reviewer

**Purpose:** Separate **what to check** from **how to check**. Rubric lives in `references/review-checklist.md`; the skill defines the protocol (load checklist → score by severity → structured output).

**Mechanism:** Load modular checklist → apply each rule → classify findings (error / warning / info) → produce summary, findings, score, top recommendations.

**Fits:** Code review, security audit (e.g. OWASP), style/spec compliance. Swap the checklist to get a different audit with the same skill shape.

**Example (generic):** Adding a Reviewer skill that scores a submission against a checklist (coding standards, security rules, or spec compliance).

---

**Full example (Reviewer):**

```markdown
# skills/code-reviewer/SKILL.md
---
name: code-reviewer
description: Reviews Python code for quality, style, and common bugs. Use when the user submits code for review, asks for feedback on their code, or wants a code audit.
metadata:
  pattern: reviewer
  severity-levels: error,warning,info
---

You are a Python code reviewer. Follow this review protocol exactly:

Step 1: Load 'references/review-checklist.md' for the complete review criteria.

Step 2: Read the user's code carefully. Understand its purpose before critiquing.

Step 3: Apply each rule from the checklist to the code. For every violation found:
- Note the line number (or approximate location)
- Classify severity: error (must fix), warning (should fix), info (consider)
- Explain WHY it's a problem, not just WHAT is wrong
- Suggest a specific fix with corrected code

Step 4: Produce a structured review with these sections:
- **Summary**: What the code does, overall quality assessment
- **Findings**: Grouped by severity (errors first, then warnings, then info)
- **Score**: Rate 1-10 with brief justification
- **Top 3 Recommendations**: The most impactful improvements
```

Criteria live in `references/review-checklist.md`; swap that file (e.g. OWASP checklist) to get a different audit with the same skill.

---

## 4. Inversion

**Purpose:** **Agent interviews the user first**; no building or synthesizing until requirements are gathered. Flips the default "guess and generate" behavior.

**Mechanism:** Explicit gating: "DO NOT start building until all phases are complete." Phases = structured questions (one at a time, wait for answers). Only after all answers → load template and synthesize.

**Fits:** Project planning, system design kickoff, any task where wrong assumptions are costly.

**Example (generic):** A planning/refactor workflow that asks questions first and refuses to synthesize until requirements are confirmed.

---

**Full example (Inversion):**

```markdown
# skills/project-planner/SKILL.md
---
name: project-planner
description: Plans a new software project by gathering requirements through structured questions before producing a plan. Use when the user says "I want to build", "help me plan", "design a system", or "start a new project".
metadata:
  pattern: inversion
  interaction: multi-turn
---

You are conducting a structured requirements interview. DO NOT start building or designing until all phases are complete.

## Phase 1 — Problem Discovery (ask one question at a time, wait for each answer)

Ask these questions in order. Do not skip any.

- Q1: "What problem does this project solve for its users?"
- Q2: "Who are the primary users? What is their technical level?"
- Q3: "What is the expected scale? (users per day, data volume, request rate)"

## Phase 2 — Technical Constraints (only after Phase 1 is fully answered)

- Q4: "What deployment environment will you use?"
- Q5: "Do you have any technology stack requirements or preferences?"
- Q6: "What are the non-negotiable requirements? (latency, uptime, compliance, budget)"

## Phase 3 — Synthesis (only after all questions are answered)

1. Load 'assets/plan-template.md' for the output format
2. Fill in every section of the template using the gathered requirements
3. Present the completed plan to the user
4. Ask: "Does this plan accurately capture your requirements? What would you change?"
5. Iterate on feedback until the user confirms
```

The gate ("DO NOT start building until all phases are complete") and phased Q&A enforce gathering before synthesis; output format lives in `assets/plan-template.md`.

---

## 5. Pipeline

**Purpose:** **Strict multi-step workflow with checkpoints.** No skipping steps; optional gates (e.g. user approval) between steps.

**Mechanism:** Instructions = workflow definition. Each step loads only the references/assets it needs. Diamond gates (e.g. "Do NOT proceed to Step 3 until the user confirms") prevent unvalidated results.

**Fits:** Doc generation pipelines (parse → docstrings → assemble → quality check), multi-step codegen, release checklists.

**Example (generic):** A multi-step "plan → implement → verify → lessons" workflow where each step is enforced in order.

---

**Full example (Pipeline):**

```markdown
# skills/doc-pipeline/SKILL.md
---
name: doc-pipeline
description: Generates API documentation from Python source code through a multi-step pipeline. Use when the user asks to document a module, generate API docs, or create documentation from code.
metadata:
  pattern: pipeline
  steps: "4"
---

You are running a documentation generation pipeline. Execute each step in order. Do NOT skip steps or proceed if a step fails.

## Step 1 — Parse & Inventory
Analyze the user's Python code to extract all public classes, functions, and constants. Present the inventory as a checklist. Ask: "Is this the complete public API you want documented?"

## Step 2 — Generate Docstrings
For each function lacking a docstring:
- Load 'references/docstring-style.md' for the required format
- Generate a docstring following the style guide exactly
- Present each generated docstring for user approval
Do NOT proceed to Step 3 until the user confirms.

## Step 3 — Assemble Documentation
Load 'assets/api-doc-template.md' for the output structure. Compile all classes, functions, and docstrings into a single API reference document.

## Step 4 — Quality Check
Review against 'references/quality-checklist.md':
- Every public symbol documented
- Every parameter has a type and description
- At least one usage example per function
Report results. Fix issues before presenting the final document.
```

Steps are sequential with an explicit gate (no Step 3 until user confirms docstrings); each step loads only the refs/assets it needs; Step 4 is a Reviewer-style quality check inside the pipeline.

---

## Choosing the right pattern

| Question | Pattern |
|----------|---------|
| "Agent should be an expert on library X when the user touches X" | **Tool Wrapper** |
| "Agent must produce the same document structure every time" | **Generator** |
| "Agent must score/critique against a checklist" | **Reviewer** |
| "Agent must ask questions before doing anything" | **Inversion** |
| "Agent must follow fixed steps and not skip or merge them" | **Pipeline** |

---

## How to apply

### For a new skill

1. **Pick the pattern** using the table above (and Composition if the skill mixes patterns).
2. **Create the skill folder** (e.g. `skills/<name>/` or your framework's equivalent).
3. **Add frontmatter** including `metadata.pattern` (e.g. `tool-wrapper`, `generator`, `reviewer`, `inversion`, `pipeline`).
4. **Write the body to match the pattern:**
   - **Tool Wrapper:** "When … load `references/conventions.md` (or inline). When reviewing/writing: 1. Load ref 2. Apply rules."
   - **Generator:** "Step 1: Load `references/style-guide.md`. Step 2: Load `assets/template.md`. Step 3: Ask user for missing vars. Step 4: Fill template. Step 5: Return output."
   - **Reviewer:** "Step 1: Load `references/review-checklist.md`. Step 2: Apply each rule. Step 3: Classify by severity. Step 4: Output summary, findings, score."
   - **Inversion:** "DO NOT build until all phases are complete. Phase 1: ask Q1, Q2, Q3 (one at a time). Phase 2: ask Q4, Q5, Q6. Phase 3: only then load template and synthesize."
   - **Pipeline:** "Execute steps in order. Do NOT skip. Step 1: … Step 2: … [Gate: do not proceed until user confirms.] Step 3: …"
5. **Add optional dirs** if the skill references them: `references/` (conventions, checklists, style guides), `assets/` (templates).

### For an existing skill

1. **Decide which pattern it already is** (or which it's closest to).
2. **Add `metadata.pattern`** in the YAML frontmatter.
3. **Optionally refactor:** move long "what to check" or "conventions" into `references/<name>.md` and have the skill say "Load references/…"; move output structure into `assets/template.md` for Generators.
4. **If it mixes patterns,** tag the primary one and add one line (e.g. "Uses Inversion at start to gather variables, then Generator to fill template").

### Folder layout (optional)

```
skills/<skill-name>/
  SKILL.md              # Required: name, description, pattern, instructions
  references/           # Optional: conventions.md, review-checklist.md, style-guide.md
  assets/               # Optional: template.md, plan-template.md
```

If your tooling uses a different directory (e.g. Cursor's `.cursor/skills/`), substitute accordingly.

Not every skill needs `references/` or `assets/`; Tool Wrappers often keep conventions inline. Use them when the content is long or reused.

---

## Composition

Patterns compose. A **Pipeline** can include a **Reviewer** step at the end. A **Generator** can use **Inversion** at the start to gather variables before filling the template. Tag skills with `metadata.pattern` (e.g. `tool-wrapper`, `generator`) so agents and humans can see the design at a glance.

---

## References

- Optional internal: your repo's skill index/table (e.g. `AGENTS.md`) and any "create-skill" rule/skill you keep locally.
- **Agent Development Kit (ADK):** [google.github.io/adk-docs](https://google.github.io/adk-docs/) — Google's framework for building and deploying AI agents (Python, TypeScript, Go, Java). Model-agnostic; supports workflow agents (sequential, loop, parallel), multi-agent systems, custom/MCP/OpenAPI tools, and **Skills**. ADK 2.0 adds graph-based workflows. The five skill patterns (Tool Wrapper, Generator, Reviewer, Inversion, Pipeline) are often implemented with ADK SkillToolset and progressive disclosure.
- External: Article on five agent skill patterns with ADK code examples—by Shubham Saboo and Lavini Gam; ecosystem study (Anthropic, Vercel, Google).
