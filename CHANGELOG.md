# Changelog

All notable changes to `tech-manager-os` are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).  
Versioning follows [Semantic Versioning](https://semver.org/).

---

## [Unreleased] — 1.0.0

This is the initial production release, covering work from Epics 1–5.

---

### Epic 5: Polish, Testing & Distribution

#### Added
- **Comprehensive test suite** — 80%+ coverage across all source files with Jest + `NODE_OPTIONS=--experimental-vm-modules` for ESM compatibility
- Integration tests for `tmr process` (inbox pipeline), `tmr install`, and `tmr update`
- Sample Granola-format fixtures in `tests/fixtures/` (`granola-1on1.md`, `granola-team-meeting.md`)
- CI/CD pipeline via GitHub Actions (`ci.yml`) — runs lint, typecheck, tests, and build on every push
- Pre-existing EPERM resilience in `workspace-builder.ts` via `Promise.allSettled` (read-only directories like `.cursor/` no longer cause a fatal error during vault scaffolding)
- **Documentation** — README.md, User Guide, Skill Authoring Guide, SECURITY.md, CHANGELOG.md, examples directory

---

### Epic 4: Skills-Based Architecture Pivot

#### Added
- **`tmr init` vault scaffolding** — scaffold a complete vault directory structure from 4 prompts; generates `CLAUDE.md` with the user's identity, folder map, and communication style
- **`CLAUDE.md` generation** — AI context file read by Claude Code skills to understand the user's vault without hardcoded values
- **`tmr config` first-run check** — `tmr process` now detects missing config (no API key) and prompts the user to run `tmr config` before proceeding
- **Generalized `tmr-inbox` skill** — `skills/tmr-inbox/SKILL.md` rewritten to read all context from `CLAUDE.md` dynamically; no hardcoded user values
- **`tmr install <skill>`** — fetch and install a SKILL.md from the skills registry or a GitHub repository into `.claude/skills/`
- **`tmr update`** — update all installed skills to their latest versions from the registry

#### Changed
- Folder structure aligned with Epic 3 path corrections (archive structure, team folder layout)
- `tmr process` now validates vault structure before processing and surfaces actionable errors

---

### Epic 3: AI-Powered Inbox Processing

#### Added
- **Inbox scanner** — detects Granola-format `.md` files in `inbox/` by frontmatter structure (`granola_id`, `date`, `attendees`)
- **AI categorization service** — classifies each meeting note by type (1:1, team meeting, leadership, company-wide) with confidence scoring
- **Context summary updates** — appends dated meeting excerpts to each person's `context.md` file in their vault folder
- **Task extraction** — identifies action items from meeting content and writes them to `my-tasks/tasks.md`
- **Timeline classification** — tags each extracted task with urgency (today, this week, someday)
- **File organization** — routes notes to `my-teams/members/{email}/`, `my-leadership/`, `my-company/meetings/`, etc.
- **`tmr process`** — the primary CLI command; orchestrates scan → categorize → route → context update → task extract
- **`tmr watch`** — file watcher (chokidar) that auto-runs `tmr process` whenever a new file lands in `inbox/`
- Low-confidence routing pauses and prompts the user to confirm the destination before moving the file

---

### Epic 2: Team & Vault Management Commands

#### Added
- **`tmr team add <email>`** — creates a team member profile in `my-teams/members/{email}/`
- **`tmr team archive <email>`** — marks a member as archived (moves folder to archive)
- **`tmr team list`** — lists all active team members with their roles
- **`tmr member` commands** — file management for member profiles (create, read, update)
- **`tmr leadership add <email>`** — adds a leadership relationship (manager, skip-level)
- **`tmr leadership list`** — lists leadership relationships
- **`tmr project add <name>`** — creates a project entry in `my-company/projects/`
- **`tmr project list`** — lists all active projects
- **Email resolution service** — normalizes and validates email addresses before storage; enforces lowercase
- **Task view commands** — `tmr task view` renders today/this-week/someday views from `my-tasks/tasks.md`
- **Obsidian plugin setup in `tmr init`** — generates Dataview query view files for `my-tasks/`

#### Changed
- `tmr init` extended to collect team members and leadership context during onboarding (optional)

---

### Epic 1: CLI Foundation

#### Added
- **TypeScript project scaffolding** — Node.js 20.17.0 LTS, TypeScript 5.3.3, pnpm, tsup build pipeline
- **Commander.js CLI framework** — command dispatcher (`cli.ts`), help text, version flag
- **Configuration service** — `conf`-based cross-platform storage with AES encryption for API keys; XDG-compliant paths
- **AI provider abstraction** — adapter interface (`IAIProvider`) with implementations for OpenAI, Anthropic (Claude), and Google Gemini; factory pattern for provider selection
- **File system service** — `FileSystemRepository` wrapping all `fs` operations; atomic writes, consistent error handling
- **Interactive onboarding** — `tmr init` prompts: workspace path, AI provider, API key, manager profile
- **API key retry and deferred setup** — if the user skips API key entry, `tmr process` prompts again at first use; limits retry attempts with clear error messaging
- **API key security** — `crypto-js` AES encryption; optional `keytar` OS keychain integration; keys are never logged
- **Locality collection** — `tmr init` collects the user's timezone for use in date-aware features

---

## Notes

- Versions before 1.0.0 were internal development iterations across Epics 1–5.
- The architecture pivot in April 2026 (documented in `docs/ARCHITECTURE-PIVOT-2026-04.md`) renamed and restructured several epics.
- This changelog covers the consolidated history from the pivot forward.
