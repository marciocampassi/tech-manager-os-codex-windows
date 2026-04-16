# Architecture Pivot — April 2026

**Date:** 2026-04-14
**Type:** Strategic course correction
**PRD version:** 4.4

This document summarizes the changes made to the product plan, folder structure, and epic scope following months of real-world usage. Read this before picking up any story from Epic 4 onwards.

---

## What Changed and Why

### The Core Shift

The original plan assumed the CLI would **perform** management tasks — generating 1:1 agendas, drafting feedback, writing status reports — through specialized agent commands (`*1on1-prepare`, `*feedback`, `*status-report`, etc.).

Real-world usage showed a better model: **the CLI scaffolds the environment; Claude Code skills perform the work.**

This is not a rollback. Epics 1 and 2 (CLI foundation + CRUD commands) are complete and fully leveraged. Epic 3 (`tmr process`) continues as the only AI-enabled CLI command. What changed is everything after that.

### The New Model

| Before | After |
|---|---|
| CLI commands perform AI tasks | Claude Code skills perform AI tasks |
| `tmr init` collects API keys | `tmr init` scaffolds vault + generates `CLAUDE.md` |
| Skills are BMAD modules inside the CLI repo | Skills are distributable `SKILL.md` files installed into `.claude/skills/` |
| Epics 4–7 build agent commands | New Epic 4 delivers the skills distribution foundation |
| User extends via BMAD config | User installs skills via `tmr install`, updates via `tmr update` |

---

## Epic Changes

### Removed: Epics 4, 5, 6, 7

These epics were fully removed from the PRD. No code was written for them.

| Removed Epic | What it was |
|---|---|
| Epic 4: People Management Agent System | CLI agent commands for 1:1 prep, feedback, PDP, PIP, reviews |
| Epic 5: Leader's Career & Leadership Agent System | Agent commands for brag docs, self-reviews, PDP management |
| Epic 6: Project Management Agent System | Agent commands for status reports, risk assessments, hiring |
| Epic 7: Agent System & BMAD Builder Integration | BMAD modules, IDE integration files, process-meeting-note skill |

### Added: New Epic 4 — Skills-Based Architecture Pivot

Five stories in priority order:

| Story | What it delivers |
|---|---|
| **4.1** | Pivot `tmr init`: removes API key collection; scaffolds full vault per TECH-MANAGER-OS-TEMPLATE; generates `CLAUDE.md` with identity block, folder map, and communication placeholders |
| **4.2** | Folder structure alignment + Epic 3 retest: correct all routing paths in `tmr process` from old PRD paths to TECH-MANAGER-OS-TEMPLATE paths; retest Epic 3 end-to-end |
| **4.3** | `tmr config` first-run check: when `tmr process` runs without an API key, detect and tell user to run `tmr config` |
| **4.4** | Generalize `tmr-inbox` skill: remove all hardcoded user values; source identity and paths from `CLAUDE.md`; publish under `skills/tmr-inbox/SKILL.md` |
| **4.5** | Skill install/update mechanism: `tmr install <skill-name>` downloads into `.claude/skills/`; `tmr update` refreshes all installed skills |

### Renumbered: Epic 8 → Epic 5

Polish, Testing & Distribution is unchanged in scope. It is now Epic 5.

---

## Folder Structure Changes

The TECH-MANAGER-OS-TEMPLATE (at `docs/TECH-MANAGER-OS-TEMPLATE`) is the ground truth for the vault layout. The PRD previously documented a different structure. **All CLI code must use the template paths.** Story 4.2 is specifically about correcting the Epic 3 routing engine to match.

### Path Corrections

| Old PRD path | Correct path (TECH-MANAGER-OS-TEMPLATE) |
|---|---|
| `my-teams/{team}/{email}/` | `my-teams/members/{email}/` |
| `my-projects/{project}/` | `my-company/projects/{project}/` |
| `my-company/relationships/{email}/` | `my-company/members/{email}/` |
| `my-teams/{team}/meetings/` | `my-company/meetings/` or `my-company/projects/{project}/meetings/` |
| `operations/hiring/` | Removed — out of scope for v1 |

### Subdirectory renames (team member folders)

| Old | Correct |
|---|---|
| `feedback/` | `feedbacks/` |
| `{team}-context.md` in `_teams/` | `{team-name}-context.md` in `my-teams/teams/{team-name}/` |
| `{team}-members.md` in `_teams/` | `{team-name}-members.md` in `my-teams/teams/{team-name}/` |

---

## `tmr init` Changes

### Before
- Collected AI provider choice + API key
- Created a partial directory structure (different from the template)
- Generated IDE integration files

### After
- Collects: name, email, role, company/domain (4 questions only)
- Scaffolds the complete vault per TECH-MANAGER-OS-TEMPLATE
- Generates `CLAUDE.md` at the vault root with:
  - Identity block (from onboarding answers)
  - Folder structure reference (every top-level folder described)
  - Communication style section (placeholders — user fills in later)
  - Pointer to `my-company/` for company context
- Does NOT collect API keys (that's `tmr config`)

### `CLAUDE.md` matters because
The `tmr-inbox` Claude Code skill reads `CLAUDE.md` to know the vault owner's email, folder paths, and domain — so it works for any leader, not just the original author.

---

## `tmr process` Changes

### API key check (Story 4.3)
Before executing any AI call, `tmr process` checks whether an API key is configured. If not, it exits early with a message directing the user to `tmr config`. It does not prompt for the key inline.

### Routing paths (Story 4.2)
The routing engine currently writes to the old PRD paths. Story 4.2 corrects these to match the TECH-MANAGER-OS-TEMPLATE paths listed above, then reruns the full Epic 3 test suite.

---

## The `tmr-inbox` Skill

The skill at `docs/TMR-INBOX-SKILL.md` is the current reference implementation. It is functional but contains hardcoded values (`marlon.ferreira@poatek.com`, `@poatek.com` domain). Story 4.4 generalizes it.

The generalized version lives at `skills/tmr-inbox/SKILL.md` in this repo. Users install it via:
```bash
tmr install tmr-inbox
```
This copies it into their vault at `.claude/skills/inbox-processor/SKILL.md`.

The skill sources all user-specific context from the vault's `CLAUDE.md`. **Do not add hardcoded values to the skill.**

---

## New Source Tree Additions

```
skills/                         # ← NEW: distributable skill definitions
└── tmr-inbox/
    └── SKILL.md

packages/core/src/
├── scaffold/                   # ← NEW: vault scaffolding logic for tmr init
│   ├── scaffold.service.ts
│   └── claude-md.generator.ts
└── skills/                     # ← NEW: skill install/update registry logic
    └── skill-registry.service.ts

packages/cli/src/commands/
├── install.command.ts          # ← NEW: tmr install
└── update.command.ts           # ← NEW: tmr update
```

The `packages/agents/` package has been removed. There is no agent orchestrator — skills run directly in Claude Code.

---

## Documents Updated

All of the following were updated as part of this course correction:

| Document | What changed |
|---|---|
| `docs/prd/epic-list.md` | Epics 4–7 removed; Epic 4 (new) and Epic 5 (publish) added |
| `docs/prd/goals-and-background-context.md` | MVP goal reframed; agent model → skills model; v4.4 changelog entry |
| `docs/prd/requirements.md` | FR2/13/19/24/30 removed; FR1/3/8/42 rewritten; all folder paths corrected |
| `docs/prd/epic-details.md` | Old Epics 4–7 replaced with new Epic 4 stories; Epic 8 → Epic 5; paths corrected in Epics 1–3 |
| `docs/architecture/high-level-architecture.md` | BMAD agent subgraph → Claude Code Skills layer; diagram and flow updated |
| `docs/architecture/source-tree.md` | `packages/agents/` removed; `skills/` dir added; `scaffold/` and `skills/` added to core |
| `README.md` | Full rewrite to reflect new MVP scope and workflow |

---

## What Has NOT Changed

- Epic 1 (Foundation & CLI Infrastructure) — complete, no changes
- Epic 2 (Complete CLI Implementation) — complete, no changes to behavior; paths corrected in story 4.2
- Epic 3 (Process Intelligence Engine) — in progress/testing; routing paths corrected in story 4.2; otherwise untouched
- The AI provider abstraction layer — still supports OpenAI, Anthropic, Gemini
- `tmr config` — unchanged; remains the dedicated API key management command
- Obsidian + Granola as the recommended vault interface and meeting capture tool
- The email-as-identity convention — still the core uniqueness mechanism across all folders and filenames
- All naming conventions from TECH-MANAGER-OS-TEMPLATE — lowercase kebab-case, ISO 8601 dates, globally unique filenames
