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
tmr init          # Guided setup: vault, your profile, leader, teams, members
tmr config        # Set your AI provider and API key
tmr doctor        # Verify your environment is ready
tmr process       # AI-route your inbox files
```

`tmr init` automatically installs the `tmr-inbox`, `tmr-project-impact`, and `tmr-myself-config` skills. Run `/tmr-myself-config` in Claude Code after init for personalized AI context.

For a full walkthrough, see [docs/project-overview.md](docs/project-overview.md).

---

## CLI Command Reference

### Core

| Command | Description |
|---------|-------------|
| `tmr --help` | Show all commands |
| `tmr --version` | Show version |
| `tmr init` | Guided vault setup — profile, leader, teams, members, skills |
| `tmr init --scaffold-only` | Create files and folders only — skip network operations (offline / CI) |
| `tmr config` | Configure AI provider and API key |
| `tmr doctor` | Check environment health: Node.js, Obsidian, Granola, vault, plugins |
| `tmr process` | AI-powered inbox processing (requires API key) |
| `tmr process --dry-run` | Preview routing decisions without moving files |
| `tmr watch` | Auto-process inbox on file changes |
| `tmr install <skill>` | Install a Claude Code skill into `.claude/skills/` |
| `tmr update` | Update all installed skills to latest versions |
| `tmr show <email>` | Display profile for any email (self, team, leadership, company, contractor) |

### Team & Member Management

| Command | Description |
|---------|-------------|
| `tmr team create [name]` | Create a new team |
| `tmr team add [name] [email]` | Add a member to a team |
| `tmr team archive [name] [email]` | Archive a team member |
| `tmr team list [name]` | List all teams, or members of a specific team |
| `tmr member add <email>` | Create a company-scoped member profile |
| `tmr member add <email> --team <name>` | Create a team-scoped member profile |
| `tmr member add <email> --contractor` | Create a contractor profile |
| `tmr member add 1on1 <email>` | Create a 1:1 note for a member |
| `tmr member add feedback <email>` | Add feedback for a member |
| `tmr member add feedback <email> --from <reviewer>` | Add feedback from another reviewer |
| `tmr member add assessment <email>` | Create a skills assessment |
| `tmr member add performance-review <email>` | Create a performance review |

### Leadership

| Command | Description |
|---------|-------------|
| `tmr leadership add [email]` | Add a leadership contact |
| `tmr leadership add 1on1 <email>` | Create a 1:1 note for a leader |
| `tmr leadership list` | List all leadership contacts |

### Projects

| Command | Description |
|---------|-------------|
| `tmr project add <name>` | Add a project (scaffolds `deps.yaml` for impact tracking) |
| `tmr project list` | List all projects |
| `tmr project standup <name>` | Create a standup note for a project |
| `tmr project standup <name> --date <YYYY-MM-DD>` | Create a standup for a specific date |
| `tmr project link-member <email>` | Link a member to the current project (bidirectional) |
| `tmr project link-stakeholder <email>` | Link a stakeholder to the current project (bidirectional) |

### Self

| Command | Description |
|---------|-------------|
| `tmr myself add performance-review` | Create a self performance review in `my-career/` |

---

## Claude Code Skills

Skills extend your vault with AI-powered workflows invoked directly from Claude Code.

| Skill | Slash Command | What it does |
|-------|--------------|-------------|
| `tmr-inbox` | `/tmr-inbox` | Routes Granola meeting notes from `inbox/` to the right folders, normalizes filenames, scaffolds missing profiles, extracts tasks |
| `tmr-project-impact` | `/tmr-project-impact` | Detects changes in project files and reports which dependent documents are affected |
| `tmr-myself-config` | `/tmr-myself-config` | One-time adaptive setup: enriches your profile, personalizes `CLAUDE.md`, scaffolds projects and team map |
| `tmr-myself-config update` | `/tmr-myself-config update` | Delta review — updates only what changed in your priorities, team, or projects |

All three skills are installed automatically by `tmr init`. To install additional community skills:

```bash
tmr install <skill-name>
```

Skills live in `.claude/skills/` inside your vault. They are plain Markdown files that Claude Code reads as instructions.

---

## Vault Structure

`tmr init` creates this structure in your chosen directory:

```
your-vault/
├── .tmr                       # Workspace sentinel (marks vault root, like .git)
├── CLAUDE.md                  # Claude Code context: your identity, folder map, communication style
├── README.md                  # Quick command reference for your vault
├── config/
│   └── organization.yaml      # Internal email domains for member routing
├── inbox/                     # Drop meeting notes here (Granola syncs here automatically)
├── archive/                   # Processed originals, organized by year/month
├── knowledge-base/            # Company knowledge: branding, people, process, security
├── my-career/
│   └── <your-email>.md        # Your self profile (flat — no subdirectory)
├── my-leadership/
│   └── <email>/               # One folder per leader
│       ├── <email>.md         # Leader profile
│       └── 1on1s/             # 1:1 notes
├── my-tasks/                  # tasks.md + Dataview view files (today, this-week, this-month, this-quarter)
├── my-teams/
│   ├── archived/              # Archived team members
│   ├── members/
│   │   └── <email>/           # One folder per direct report
│   │       ├── <email>.md     # Member profile (relationship: direct-report)
│   │       ├── <email>-shared/
│   │       ├── 1on1s/
│   │       ├── feedbacks/
│   │       ├── assessments/
│   │       └── performance-reviews/
│   └── teams/                 # Named team groupings
├── my-company/
│   ├── contractors/
│   │   └── <email>/           # One folder per contractor (relationship: contractor)
│   │       ├── <email>.md
│   │       ├── 1on1s/
│   │       ├── feedbacks/
│   │       ├── assessments/
│   │       └── performance-reviews/
│   ├── members/
│   │   └── <email>/           # One folder per company contact (relationship: company-member)
│   │       ├── <email>.md
│   │       ├── 1on1s/
│   │       ├── feedbacks/
│   │       ├── assessments/
│   │       └── performance-reviews/
│   └── projects/              # Active initiatives
│       └── <name>/
│           ├── <name>.md      # Project overview
│           ├── deps.yaml      # Dependency manifest for /tmr-project-impact
│           └── standups/
├── .claude/skills/            # Installed Claude Code skills
├── .cursor/rules/tmr/         # Cursor AI rules
└── .obsidian/                 # Obsidian config (auto-configured by tmr init)
    ├── community-plugins.json # Registered plugins: obsidian-git, granola-sync, terminal, dataview
    └── plugins/
        └── granola-sync/
            └── data.json      # Pre-configured: syncs to inbox/
```

See `examples/sample-vault/` for a realistic starter vault.

---

## How It Works

1. **`tmr init`** — guided prompts collect your identity, leader, team names, and members → scaffolds the vault → writes `CLAUDE.md` → auto-installs three skills → downloads Obsidian plugins
2. **`/tmr-myself-config`** (Claude Code) — adaptive conversation that enriches your profile and populates `CLAUDE.md ## Manager Context` with deep personal context
3. **Granola** records meetings and syncs transcripts into `inbox/` via the pre-configured Obsidian Granola Sync plugin
4. **`tmr process`** (CLI) or **`/tmr-inbox`** (Claude Code) routes each note to the correct team/leadership/company folder, extracts tasks, and updates context files
5. **`/tmr-project-impact`** (Claude Code) — when project files change, detects which dependent documents need updates
6. **`tmr install <skill>`** / **`tmr update`** — pull new skills from the registry and keep them current

---

## Requirements

- **Node.js 18+** (20.17.0 LTS recommended)
- **npm** (or use `npx @marlonvidal/tech-manager-os` without installing globally)
- **AI API key** — OpenAI, Anthropic (Claude), or Google Gemini — required for `tmr process`
- **Claude Code** (optional) — required for skill-based workflows (`/tmr-inbox`, `/tmr-project-impact`, `/tmr-myself-config`)
- **Obsidian + Granola** (optional) — recommended for automatic meeting note sync; configured automatically by `tmr init`

See [SECURITY.md](SECURITY.md) for API key storage and best practices.

---

## Documentation

- [Project Overview](docs/project-overview.md) — end-to-end walkthrough from install to daily use
- [Architecture](docs/architecture.md) — system design, service layer, and extension points
- [Development Guide](docs/development-guide.md) — local setup, conventions, and contributing
- [CONTRIBUTING.md](CONTRIBUTING.md) — PR process, coding standards, skill submission
- [Security](SECURITY.md) — API key storage, encryption, best practices
- [Changelog](CHANGELOG.md) — what changed in each release

---

## Architecture

- **CLI layer:** TypeScript + Commander.js — Command → Service → Provider pattern
- **AI provider:** Adapter pattern — OpenAI, Anthropic, Gemini (used only by `tmr process`)
- **Skills layer:** Claude Code `SKILL.md` files installed in `.claude/skills/`
- **Storage:** Local Markdown files — no database, Obsidian-compatible
- **Entity resolution:** `EmailResolutionService.resolve()` — single authoritative lookup across all scopes
- **Build:** TypeScript → `dist/` via tsup; binary entry point `dist/cli.js`

---

## Development Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Compile TypeScript to `dist/` via tsup |
| `npm test` | Run full test suite |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run lint` | ESLint check |
| `npm run lint:fix` | ESLint auto-fix |
| `npm run format` | Prettier format |
| `npm run typecheck` | TypeScript type check (no emit) |
| `npm run validate` | lint + typecheck + test + build (run before every PR) |

---

## License

MIT — see [LICENSE](LICENSE)
