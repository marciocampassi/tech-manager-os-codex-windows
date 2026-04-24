# tech-manager-os

[![npm version](https://img.shields.io/npm/v/@marlonvidal/tech-manager-os.svg)](https://www.npmjs.com/package/@marlonvidal/tech-manager-os)
[![CI](https://github.com/marlonvidal/tech-manager-os/actions/workflows/ci.yml/badge.svg)](https://github.com/marlonvidal/tech-manager-os/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> A local-first operating system for engineering managers — scaffold your vault, process meeting notes, and extend with Claude Code skills.

`tech-manager-os` (CLI: `tmr`) helps engineering managers stay organized using plain Markdown files, Obsidian, and Claude Code. Everything stays local — no cloud, no database, no vendor lock-in.

---

## Quick Start

```bash
npm install -g @marlonvidal/tech-manager-os
tmr init          # Scaffold vault + generate CLAUDE.md (5 quick prompts)
tmr config        # Set your AI provider and API key
tmr install tmr-inbox   # Install the inbox processing skill
tmr process       # AI-route your inbox files
```

For a full walkthrough, see the [User Guide](docs/user-guide.md).

---

## CLI Command Reference

| Command | Description |
|---------|-------------|
| `tmr --help` | Show all commands |
| `tmr --version` | Show version |
| `tmr init` | Scaffold vault + generate `CLAUDE.md` |
| `tmr config` | Configure AI provider and API key |
| `tmr process` | AI-powered inbox processing (requires API key) |
| `tmr process --plain` | Plain text output (no colors/spinners) |
| `tmr process --dry-run` | Preview routing decisions without moving files |
| `tmr watch` | Auto-process inbox on file changes |
| `tmr install <skill>` | Install a Claude Code skill into `.claude/skills/` |
| `tmr install <skill> --force` | Reinstall even if already installed |
| `tmr update` | Update all installed skills to latest versions |
| `tmr team create [team-name]` | Create a team |
| `tmr team add [team-name] [email]` | Add a member to a team (prompts if args omitted) |
| `tmr team archive [team-name] [email]` | Archive a team member |
| `tmr team list [team-name]` | List all teams, or members of a specific team |
| `tmr leadership add [email]` | Add a leadership contact (prompts if arg omitted) |
| `tmr leadership list` | List all leadership contacts |
| `tmr project add <name>` | Add a project |
| `tmr project list` | List all projects |
| `tmr show <email>` | Display profile for any email (teams, leadership, relationships) |

---

## Claude Code Skills

Skills extend your vault with AI-powered workflows invoked directly from Claude Code — no CLI required.

| Skill | Slash Command | What it does |
|-------|--------------|-------------|
| `tmr-inbox` | `/tmr-inbox` | Routes Granola meeting notes from `inbox/` to the right folders, normalizes filenames, scaffolds missing profiles, extracts tasks |
| `tmr-inbox setup` | `/tmr-inbox setup` | One-time setup: creates `my-tasks/tasks.md` and Dataview view files |

Install a skill:
```bash
tmr install tmr-inbox
```

Skills live in `.claude/skills/` inside your vault. They are plain Markdown files that Claude Code reads as instructions. See the [Skill Authoring Guide](docs/skill-authoring-guide.md) to write and publish your own.

---

## Vault Structure

`tmr init` creates this structure in your chosen directory:

```
your-vault/
├── CLAUDE.md              # Claude Code context: your identity, folder map, communication style
├── inbox/                 # Drop meeting notes here (Granola syncs here automatically)
├── archive/               # Processed originals, organized by year/month
├── config/                # Messaging templates and process references
├── my-career/
│   ├── assessments/
│   └── feedbacks/
├── my-leadership/         # Your managers and skip-levels
├── my-tasks/              # tasks.md + Dataview view files (today, this-week, this-month, this-quarter)
├── my-teams/
│   ├── archived/          # Archived team members
│   ├── feedback-templates/
│   ├── members/           # One folder per direct report ({email}/)
│   └── teams/             # Named team groupings
├── my-company/
│   ├── meetings/          # Company-wide meeting notes
│   ├── members/           # Company contacts not in your team
│   └── projects/          # Active initiatives
├── knowledge-base/
│   ├── branding-guidelines/
│   ├── company/
│   ├── files/
│   ├── people/
│   ├── process/
│   └── security/
└── .claude/skills/        # Installed Claude Code skills
```

See `examples/sample-vault/` for a realistic starter vault.

---

## How It Works

1. **`tmr init`** — answers 4 prompts (name, email, role, company) → scaffolds the vault → generates `CLAUDE.md` with your identity and folder map
2. **Granola** records meetings and syncs transcripts into `inbox/` via the [Obsidian Granola plugin](docs/setup/obsidian-setup.md)
3. **`tmr process`** (CLI) or **`/tmr-inbox`** (Claude Code skill) routes each note to the correct team/leadership/company folder, extracts tasks, and updates context files
4. **`tmr install <skill>`** — pull new skills from the registry to extend your vault with new AI workflows
5. **`tmr update`** — keep all installed skills up to date

---

## Requirements

- **Node.js 18+** (20.17.0 LTS recommended)
- **npm** (or use `npx @marlonvidal/tech-manager-os` without installing globally)
- **AI API key** — OpenAI, Anthropic (Claude), or Google Gemini — required for `tmr process`
- **Claude Code** (optional) — required for skill-based workflows (`/tmr-inbox`)
- **Obsidian + Granola plugin** (optional) — recommended for automatic meeting note sync

See [SECURITY.md](SECURITY.md) for API key storage and best practices.

---

## Setup Guides

- [User Guide](docs/user-guide.md) — end-to-end walkthrough from install to daily use
- [Obsidian Setup](docs/setup/obsidian-setup.md) — Obsidian vault, Granola Sync plugin, Obsidian Terminal
- [Skill Authoring Guide](docs/skill-authoring-guide.md) — write and publish your own skills
- [Security](SECURITY.md) — API key storage, encryption, best practices
- [Changelog](CHANGELOG.md) — what changed in each release

---

## Architecture

- **CLI layer:** TypeScript + Commander.js
- **AI provider:** Adapter pattern — OpenAI, Anthropic, Gemini (used only by `tmr process`)
- **Skills layer:** Claude Code `SKILL.md` files installed in `.claude/skills/`
- **Storage:** Local Markdown files — no database, Obsidian-compatible
- **Build:** TypeScript → `dist/` via tsup; binary entry point `dist/cli.js`

---

## Development Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Compile TypeScript to `dist/` via tsup |
| `npm run dev` | Run CLI directly via ts-node |
| `npm test` | Run full test suite |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run lint` | ESLint check |
| `npm run lint:fix` | ESLint auto-fix |
| `npm run format` | Prettier format |
| `npm run typecheck` | TypeScript type check (no emit) |
| `npm run validate` | lint + typecheck + test + build |

---

## License

MIT — see [LICENSE](LICENSE)
