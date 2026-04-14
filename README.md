# tech-manager-os

> A local-first operating system for engineering managers — scaffold your vault, process meeting notes, and extend with Claude Code skills.

## Overview

`tech-manager-os` (CLI: `tmr`) is a local-first tool that helps engineering managers stay organized using plain Markdown files, Obsidian, and Claude Code.

Run `tmr init` to scaffold a structured vault. Drop meeting notes into `inbox/`. Run `tmr process` (or the `/tmr-inbox` Claude Code skill) to file them automatically. Install new skills over time with `tmr install`.

Everything stays local. No cloud. No database. No vendor lock-in.

## Quick Start

```bash
npm install -g tech-manager-os
tmr init          # Scaffold vault + generate CLAUDE.md
tmr config        # Set your AI API key (required for tmr process)
tmr process       # Process inbox files with AI
```

## CLI Commands

```bash
tmr --help                        # Show all commands
tmr --version                     # Show version
tmr init                          # Scaffold vault + generate CLAUDE.md
tmr config                        # Configure AI API key
tmr process                       # AI-powered inbox processing (only AI command)
tmr watch                         # Auto-process inbox on file changes
tmr install <skill-name>          # Install a Claude Code skill into .claude/skills/
tmr update                        # Update all installed skills to latest versions
tmr team add <email>              # Add a team member
tmr team archive <email>          # Archive a team member
tmr leadership add <email>        # Add a leadership relationship
tmr project add <name>            # Add a project
```

## Claude Code Skills

Skills extend your vault with AI-powered workflows invoked directly from Claude Code — no CLI required.

| Skill | Command | What it does |
|-------|---------|-------------|
| `tmr-inbox` | `/tmr-inbox` | Routes Granola meeting notes from `inbox/` to the right folders, normalizes filenames, scaffolds missing profiles, extracts tasks |
| `tmr-inbox setup` | `/tmr-inbox setup` | One-time setup: installs Dataview plugin and creates task view files |

Install a skill:
```bash
tmr install tmr-inbox
```

## Vault Structure

`tmr init` creates this structure (per `TECH-MANAGER-OS-TEMPLATE`):

```
your-vault/
├── CLAUDE.md              # Claude Code context: your identity, folder map, communication style
├── inbox/                 # Drop meeting notes here
├── archive/               # Processed originals
├── my-teams/
│   ├── members/           # One folder per direct report ({email}/)
│   └── teams/             # Named team groupings
├── my-company/
│   ├── members/           # Company contacts not in your team
│   ├── meetings/          # Company-wide meeting notes
│   └── projects/          # Active initiatives
├── my-leadership/         # Your managers and skip-levels
├── my-career/             # Your own profile, assessments, feedback received
├── my-tasks/              # tasks.md + Dataview view files
├── knowledge-base/        # Reference materials (processes, rubrics, guidelines)
├── config/                # Messaging templates and process references
└── .claude/skills/        # Installed Claude Code skills
```

## How It Works

1. **`tmr init`** — answers 4 questions (name, email, role, company) → scaffolds the vault → generates `CLAUDE.md`
2. **Granola** syncs meeting transcripts into `inbox/` via the Obsidian Granola plugin
3. **`/tmr-inbox`** (Claude Code skill) routes notes to the right folder, renames them, scaffolds missing profiles, and extracts tasks to `my-tasks/tasks.md`
4. **`tmr process`** — the CLI alternative to the skill, powered by your configured AI provider
5. **`tmr install <skill>`** — pull new skills from the registry as they are published

## Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run dev` | Run CLI directly via ts-node |
| `npm test` | Run test suite |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run lint` | ESLint check |
| `npm run format` | Prettier format |
| `npm run typecheck` | TypeScript type check (no emit) |

## Requirements

- Node.js 18+
- npm
- An AI API key (OpenAI, Anthropic, or Gemini) for `tmr process`
- Claude Code for skill-based workflows (recommended)
- Obsidian + Granola plugin for meeting note sync (recommended)

## Architecture

- **CLI layer:** TypeScript + Commander.js
- **AI provider:** Adapter pattern — OpenAI, Anthropic, Gemini (used only by `tmr process`)
- **Skills layer:** Claude Code SKILL.md files installed in `.claude/skills/`
- **Storage:** Local Markdown files — no database, Obsidian-compatible
- **Vault structure:** Defined by `TECH-MANAGER-OS-TEMPLATE`

## License

MIT
