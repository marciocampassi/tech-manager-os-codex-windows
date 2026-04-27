# User Interface Design Goals

## Overall UX Vision

Tech Leadership OS embraces a **hybrid workflow**: lightweight CLI for data capture and organization, powerful IDE agents for intelligence and document generation. The philosophy is **"Capture anywhere, think everywhere"** - drop transcripts in inbox, run process, then leverage agents in your IDE when you need AI assistance.

The system should feel like a **natural extension of how leaders already work**: meetings generate transcripts, transcripts go into a folder, the system organizes everything and makes it retrievable when needed.

**Obsidian is the primary daily workspace.** With the Obsidian Terminal plugin installed, leaders can run `tmr process`, `tmr today`, and all other CLI commands directly from a terminal panel inside Obsidian — no context switching to an external IDE required. The recommended layout (file tree + active note + terminal panel) creates a single-window environment for the complete capture → process → review loop. Using an external IDE (Cursor, Claude Code, Gemini CLI) remains fully supported for AI agent operations and is the recommended path for intelligence-heavy tasks like 1:1 prep, performance reviews, and project reports.

## Key Interaction Paradigms

**CLI Commands (Data Operations) — run from Obsidian Terminal or any shell:**
- **Instant capture**: No friction between thought and storage
- **Clear organization**: Predictable file structure, easy to navigate
- **Informative feedback**: Show what happened, what changed, what needs attention
- **Time-based views**: `today`, `this-week`, `this-month`, `this-quarter` for temporal context

**IDE Agents (Intelligence Operations) — Cursor, Claude Code, Gemini CLI, GitHub Copilot:**
- **Natural language**: Invoke agents like talking to a colleague (`@tmr-people *1on1-prepare sarah`)
- **Context-aware**: Agents automatically load relevant files
- **Draft generation**: AI produces human-quality drafts for manager to review/edit
- **Iterative refinement**: Agents can refine outputs based on feedback

## Core Workflows

### Workflow 1: Leader Onboarding (First Run)

```bash
tmr init

# Interactive wizard:
# - Welcome & AI provider setup
# - Collect leader's profile (name, role, experience, leadership style)
# - Define career goals and development areas
# - Capture leadership context (who are your managers, their expectations)
# - Create workspace structure
# - Generate IDE integration files
# - Display next steps
```

**Output:**
- Complete folder structure created
- Leader's profile and initial PDP drafted
- Leadership profile template created
- All IDE integration files generated (`.cursor/`, `.claude/`, `.gemini/`, `.github/copilot/`)
- Configuration saved and encrypted

### Workflow 2: Daily Routine - Inbox Processing

```bash
# User drops files in inbox/ throughout day/week:
# - Meeting transcripts (txt, md, json)
# - Quick notes
# - Email copies
# - Interview recordings (transcribed)
# - Binary files (PDFs, PPTX, XLS)

tmr process

# AI processes each file:
# - Categorizes by type (1:1, project meeting, leadership sync, hiring, company, etc.)
# - Identifies teams, people, projects, and leaders mentioned
# - Updates context summaries automatically
# - Extracts actionable tasks
# - Moves files to appropriate folders (multi-level: team/project/company)
# - Handles binary files by moving to knowledge-base/files/
# - Suggests follow-up actions
# - Encourages [[relationship]] notation for Obsidian
```

**Output:**
- Summary of files processed and where they went
- List of contexts updated (teams, people, projects, leaders, company relationships)
- Urgent actions flagged
- Task lists updated (today/week/month/quarter)

### Workflow 3: Preparing for 1:1 (IDE)

```bash
# In Cursor/Claude/Gemini/GitHub Copilot
@tmr-people *1on1-prepare sarah-chen

# Agent automatically reads:
# - my-teams/{team}/sarah.chen@company.com/context.md
# - my-teams/{team}/sarah.chen@company.com/pdp.md
# - my-teams/{team}/sarah.chen@company.com/1on1s/*.md (recent sessions)
# - my-teams/{team}/sarah.chen@company.com/feedback/*.md
# - my-tasks/today.md and my-tasks/this-week.md
# - Related project contexts

# Generates comprehensive agenda:
# - Check-in topics
# - Follow-ups from last session
# - Current challenges/support needs
# - PDP progress review
# - New discussion points
# - Suggested action items
```

**Output:**
- `my-teams/{team}/sarah.chen@company.com/1on1s/2026-02-10.md` created
- Structured agenda ready for meeting
- Leader reviews/edits before meeting

### Workflow 4: Weekly Project Status (IDE)

```bash
@tmr-project *status-report mobile-redesign

# Agent reads:
# - my-projects/mobile-redesign/context.md
# - my-projects/mobile-redesign/meetings/*.md
# - my-teams/{team}/sarah.chen@company.com/context.md (project lead)
# - my-tasks/this-week.md
# - Previous status reports for comparison

# Generates status report with:
# - Progress this week
# - Risks and blockers
# - Team capacity
# - Next week's plan
```

**Output:**
- `my-projects/mobile-redesign/status-reports/2026-w06.md` created
- Leader reviews/edits before sharing with stakeholders

### Workflow 5: Hiring - Candidate Review (IDE)

```bash
# Interview transcript dropped in inbox
# Process automatically categorizes to:
# operations/hiring/senior-frontend/candidates/john-doe/

@tmr-hiring *candidate-review john-doe --approved=true

# Agent reads:
# - Job description (auto-generated based on role/seniority)
# - All interview transcripts and notes
# - Company culture/values (knowledge-base)

# Generates comprehensive review:
# - Technical assessment
# - Culture fit analysis
# - Recommendation (STRONG HIRE/HIRE/NO HIRE)
# - Suggested compensation
# - Onboarding notes
```

**Output:**
- `operations/hiring/senior-frontend/candidates/john-doe/candidate-review.md`
- Leader reviews before making hiring decision

## CLI Terminal UX

**Visual Design:**
- Clean, scannable output with semantic colors (green=success, yellow=warning, blue=info, red=error)
- Progress spinners for AI operations (ora)
- Box drawing for structure and emphasis
- Tables for list views (cli-table3)
- Emoji support (optional, can disable with `TM_NO_EMOJI` env var)

**Branding:**
```
┌─────────────────────────────────────────────┐
│                                             │
│  ████████╗███╗   ███╗██████╗                │
│  ╚══██╔══╝████╗ ████║██╔══██╗               │
│     ██║   ██╔████╔██║██████╔╝               │
│     ██║   ██║╚██╔╝██║██╔══██╗               │
│     ██║   ██║ ╚═╝ ██║██║  ██║               │
│     ╚═╝   ╚═╝     ╚═╝╚═╝  ╚═╝               │
│                                             │
│       Tech Leadership OS                    │
│       by Marlon Vidal                       │
│                                             │
│  Comunidade Tech Manager de Resultados     │
│                                             │
└─────────────────────────────────────────────┘
```

Shown during `tmr init` and with `tmr --version`.

## IDE Integration

**Cursor Integration:**
- Agents defined as `.cursor/rules/tmr/*.mdc` files
- Rules include agent definition and command reference
- Agents auto-load relevant context files
- Usage: `@tmr-people *1on1-prepare sarah`

**Claude Code Integration:**
- Agents defined in `.claude/agents/*.md` files
- Natural agent invocation
- Usage: Similar to Cursor

**Gemini CLI Integration:**
- Agents defined in `.gemini/agents/*.md` files
- CLI-based agent interaction
- Usage: Similar to Cursor/Claude

**GitHub Copilot Integration:**
- Skills defined in `.github/copilot/skills/*.md` files
- SKILL.md-based agent definitions
- Follows agentskills.io specification
- Usage: Similar to other IDEs

## Accessibility

- Plain text output mode (`--plain` flag) that strips ANSI colors
- JSON output mode (`--json` flag) for programmatic consumption
- Screen reader friendly with descriptive messages
- Keyboard-only navigation for interactive prompts

## Target Platforms

**CLI:**
- macOS: Terminal.app, iTerm2, Warp
- Windows: PowerShell, Windows Terminal, WSL
- Linux: gnome-terminal, Konsole, Alacritty

**IDE:**
- Cursor (primary)
- Claude Code (primary)
- Gemini CLI (primary)
- Future: Windsurf, other AI-powered IDEs

---
