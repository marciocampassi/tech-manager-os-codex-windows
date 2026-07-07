# tech-manager-os

[![npm version](https://img.shields.io/npm/v/@marlonvidal/tech-manager-os.svg)](https://www.npmjs.com/package/@marlonvidal/tech-manager-os)
[![CI](https://github.com/marlonvidal/tech-manager-os/actions/workflows/ci.yml/badge.svg)](https://github.com/marlonvidal/tech-manager-os/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> A local-first operating system for engineering managers — scaffold your vault, process meeting notes, and extend with Codex skills.

`tech-manager-os` (CLI: `tmr`) helps engineering managers stay organized using plain Markdown files, Obsidian, and Codex. Everything stays local — no cloud, no database, no vendor lock-in.

---

## Quick Start

```bash
npm install -g @marlonvidal/tech-manager-os
tmr init          # Guided setup: vault, your profile, leader, teams, members
```

After `tmr init` completes:

1. **Open the generated vault in Obsidian**
   - macOS/Linux: `open -a Obsidian "<vault-path>"`
   - Windows: open Obsidian and choose **Open folder as vault**

2. **Open the generated vault in Codex**
   - Select the vault folder created by `tmr init`, not the `tech-manager-os` source-code folder.
   - Codex reads `AGENTS.md` from the vault root and uses it as the operating context for the workspace.

3. **Run `$tmr-myself-config` in Codex** — personalizes AI context across your vault *(do this first)*

4. **Run `$tmr-inbox` in Codex** — processes inbox meeting notes into structured entries

5. **Run `tmr --help`** to explore all available CLI commands

`tmr init` automatically installs three Codex skills: `tmr-inbox`, `tmr-project-impact`, and `tmr-myself-config`, and configures Obsidian plugins: obsidian-git, granola-sync, terminal, and dataview.

Upgrading an older vault? Run `tmr doctor --fix-frontmatter` to migrate body links to frontmatter. The migration is idempotent.

For a full walkthrough, see [docs/project-overview.md](docs/project-overview.md).

---

## Upgrading an existing vault

Newer versions of `tmr` store entity relationships — managers, direct reports, team members, stakeholders, and projects — in YAML **frontmatter** instead of Markdown body sections. If you created your vault with an older release, run:

```bash
tmr doctor --fix-frontmatter
```

This lifts structural body wiki-links into frontmatter, renames the legacy `manager:` key to `current_manager:`, and removes deprecated fields. It is **idempotent**: running it again is a safe no-op.

Dated lists such as `## 1on1s`, `## Feedbacks`, and similar sections intentionally stay in the body. Only a `last_<type>` summary scalar is recorded in frontmatter. Plain `tmr doctor` will warn you when a vault still contains legacy body links.

If you deleted a profile, team, or project file by hand — or a write was interrupted — a relationship link can be left pointing at a file that no longer exists. To remove dangling reciprocal links:

```bash
tmr doctor --prune-links
```

This scans every profile, team roster, and project overview and drops frontmatter relation entries — `direct_reports`, `leadership`, `members`, `stakeholders`, `projects`, and `teams` — whose target file is missing. It only removes broken links. Valid links and free-text values are left untouched. The command is also idempotent.

---

## CLI Command Reference

### Core

| Command | Description |
|---------|-------------|
| `tmr --help` | Show all commands |
| `tmr --version` | Show version |
| `tmr init` | Guided vault setup — profile, leader, teams, members, skills |
| `tmr init --scaffold-only` | Create files and folders only — skip network operations for offline or CI usage |
| `tmr doctor` | Check environment health: Node.js, Obsidian, Granola, vault, plugins |
| `tmr doctor --fix-frontmatter` | Migrate a legacy vault's body wiki-links into frontmatter |
| `tmr doctor --prune-links` | Remove dangling reciprocal frontmatter links whose target file no longer exists |
| `tmr update` | Update all installed skills to latest versions |
| `tmr show <email>` | Display profile for any email: self, team, leadership, company, or contractor |

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
| `tmr project add <name>` | Add a project and scaffold `deps.yaml` for impact tracking |
| `tmr project list` | List all projects |
| `tmr project standup <name>` | Create a standup note for a project |
| `tmr project standup <name> --date <YYYY-MM-DD>` | Create a standup for a specific date |
| `tmr project link-member <email>` | Link a member to the current project bidirectionally |
| `tmr project link-stakeholder <email>` | Link a stakeholder to the current project bidirectionally |

### Self

| Command | Description |
|---------|-------------|
| `tmr myself add performance-review` | Create a self performance review in `my-career/` |
| `tmr myself set-manager <email>` | Change your current manager, move the previous one to `previous_manager[]`, and update reciprocal `direct_reports` |

---

## Codex Skills

Skills extend your vault with AI-powered workflows invoked directly from Codex.

| Skill | Codex invocation | What it does |
|-------|------------------|--------------|
| `tmr-inbox` | `$tmr-inbox` | Routes Granola meeting notes from `inbox/` to the right folders, normalizes filenames, scaffolds missing profiles, and extracts tasks |
| `tmr-project-impact` | `$tmr-project-impact` | Detects changes in project files and reports which dependent documents are affected |
| `tmr-myself-config` | `$tmr-myself-config` | One-time adaptive setup: enriches your profile, personalizes `AGENTS.md`, scaffolds projects, and builds your team map |
| `tmr-myself-config update` | `$tmr-myself-config update` | Delta review: updates only what changed in your priorities, team, or projects |

All three skills are installed automatically by `tmr init`. To install additional community skills:

```bash
tmr install <skill-name>
```

Skills live in `.agents/skills/` inside your vault. They are plain Markdown instructions that Codex can read and execute as local workspace workflows.

---

## Vault Structure

`tmr init` creates this structure in your chosen directory:

```text
your-vault/
├── .tmr                       # Workspace sentinel; marks vault root, like .git
├── AGENTS.md                  # Codex context: identity, folder map, conventions, communication style
├── README.md                  # Quick command reference for your vault
├── config/
│   └── organization.yaml      # Internal email domains for member routing
├── inbox/                     # Drop meeting notes here; Granola syncs here automatically
├── archive/                   # Processed originals, organized by year/month
├── knowledge-base/            # Company knowledge: branding, people, process, security
├── my-career/
│   └── <your-email>.md        # Your self profile; flat, no subdirectory
├── my-leadership/
│   └── <email>/               # One folder per leader
│       ├── <email>.md         # Leader profile
│       └── 1on1s/             # 1:1 notes
├── my-tasks/                  # tasks.md + Dataview views: today, this-week, this-month, this-quarter
├── my-teams/
│   ├── archived/              # Archived team members
│   ├── members/
│   │   └── <email>/           # One folder per direct report
│   │       ├── <email>.md     # Member profile; relationship: direct-report
│   │       ├── <email>-shared/
│   │       ├── 1on1s/
│   │       ├── feedbacks/
│   │       ├── assessments/
│   │       └── performance-reviews/
│   └── teams/                 # Named team groupings
├── my-company/
│   ├── contractors/
│   │   └── <email>/           # One folder per contractor; relationship: contractor
│   │       ├── <email>.md
│   │       ├── 1on1s/
│   │       ├── feedbacks/
│   │       ├── assessments/
│   │       └── performance-reviews/
│   ├── members/
│   │   └── <email>/           # One folder per company contact; relationship: company-member
│   │       ├── <email>.md
│   │       ├── 1on1s/
│   │       ├── feedbacks/
│   │       ├── assessments/
│   │       └── performance-reviews/
│   └── projects/              # Active initiatives
│       └── <name>/
│           ├── <name>.md      # Project overview
│           ├── deps.yaml      # Dependency manifest for $tmr-project-impact
│           └── standups/
├── .agents/skills/            # Installed Codex skills
├── .cursor/rules/tmr/         # Cursor AI rules
└── .obsidian/                 # Obsidian config; auto-configured by tmr init
    ├── community-plugins.json # Registered plugins: obsidian-git, granola-sync, terminal, dataview
    └── plugins/
        └── granola-sync/
            └── data.json      # Pre-configured: syncs to inbox/
```

See `examples/sample-vault/` for a realistic starter vault.

---

## How It Works

1. **`tmr init`** — guided prompts collect your identity, leader, team names, and members. The CLI scaffolds the vault, writes `AGENTS.md`, installs the default Codex skills, and downloads supported Obsidian plugins.
2. **`$tmr-myself-config` in Codex** — adaptive setup that enriches your profile and populates `AGENTS.md ## Manager Context` with deeper personal context.
3. **Granola + Obsidian** — Granola records meetings and syncs transcripts into `inbox/` through the pre-configured Obsidian Granola Sync plugin.
4. **`tmr process` or `$tmr-inbox`** — the CLI or Codex routes each note to the correct team, leadership, company, or project folder, extracts tasks, and updates context files.
5. **`$tmr-project-impact` in Codex** — when project files change, Codex detects which dependent documents need to be reviewed or updated.
6. **`tmr install <skill>` / `tmr update`** — installs new skills from the registry and keeps installed skills current.

---

## Requirements

- **Node.js 18.17+**. Node.js 20 LTS or 22 LTS is recommended for day-to-day usage.
- **npm**. You can also use `npx @marlonvidal/tech-manager-os` without installing globally.
- **Codex** for skill-based workflows such as `$tmr-inbox`, `$tmr-project-impact`, and `$tmr-myself-config`.
- **Obsidian + Granola** are recommended for automatic meeting note sync. `tmr init` configures the supported Obsidian plugins automatically.

### Windows / PowerShell notes

If PowerShell blocks `npm` with an execution-policy error, use the Windows command shim instead:

```powershell
npm.cmd -v
npm.cmd ci
npm.cmd run build
npm.cmd install -g .
tmr.cmd --help
```

Alternatively, enable scripts for your current Windows user:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

When developing locally on Windows, prefer running commands outside OneDrive-synced directories to avoid file-locking or sync conflicts.

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
- **AI provider:** Adapter pattern — OpenAI, Anthropic, Gemini. This is used by CLI processing flows such as `tmr process` and is independent from Codex workspace skills.
- **Skills layer:** Codex `SKILL.md` files installed in `.agents/skills/`
- **Workspace context:** `AGENTS.md` generated at the vault root for Codex to understand the manager context, folder conventions, and workflow rules
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
| `npm run typecheck` | TypeScript type check; no emit |
| `npm run validate` | lint + typecheck + test + build; run before every PR |

On Windows PowerShell, replace `npm` with `npm.cmd` if script execution is blocked.

---

## License

MIT — see [LICENSE](LICENSE)
