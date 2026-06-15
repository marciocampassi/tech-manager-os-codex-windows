# Project Overview

**Project:** tech-manager-os
**npm package:** `@marlonvidal/tech-manager-os`
**Binary:** `tmr`
**Version:** 1.0.0
**Generated:** 2026-04-27

---

## Purpose

`tech-manager-os` is a **local-first operating system for engineering managers**. It provides a single CLI tool (`tmr`) that:

1. **Scaffolds an Obsidian vault** — a structured set of Markdown folders for managing your team, career, and company context.
2. **Processes Granola meeting notes** — uses AI to categorize notes, route them to the right folders, extract action items, and update team/project context files automatically.
3. **Manages team metadata** — CRUD operations for team members, teams, leadership contacts, projects, and relationships, all backed by plain Markdown files.
4. **Distributes Claude Code skills** — an `install`/`update` system for AI-powered Markdown workflows (`SKILL.md` files) that extend the vault.

Everything runs locally — no cloud backend, no database, no vendor lock-in. Data lives in your filesystem as readable Markdown files.

---

## Tech Stack Summary

| Dimension | Choice |
|-----------|--------|
| Language | TypeScript 5.x (strict, ESNext) |
| Runtime | Node.js ≥18, ESM native |
| CLI framework | Commander.js |
| AI providers | OpenAI / Claude (Anthropic) / Gemini (Google) — switchable |
| Config | `conf` (AES-256 encrypted JSON at `~/.config/tmr/`) |
| Build | tsup (ESM, code splitting) |
| Tests | Jest + ts-jest (ESM mode) |
| File format | Plain Markdown (`.md`) |

---

## Architecture Type

**Monolith** — single TypeScript source tree compiled to one `dist/cli.js` binary with lazy-loaded code-split chunks for heavy commands.

**Pattern:** Layered CLI — Commander entry point → Command layer → Service layer → AI Provider Strategy.

---

## Key Commands

| Command | What it does |
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

---

## Repository Structure

```
tech-manager-os/
├── src/            ← TypeScript source (commands, services, providers, types, utils, workflows)
├── tests/          ← Jest test suite (unit + integration + packaging)
├── skills/         ← Bundled Claude Code skills published to registry
├── examples/       ← Sample vault and inbox note files
├── dist/           ← Compiled output (git-ignored source)
└── docs/           ← Project documentation (this folder)
```

---

## Documentation Links

- [Architecture](./architecture.md) — system design, subsystems, error model, testing strategy
- [Source Tree Analysis](./source-tree-analysis.md) — annotated directory tree with file purposes
- [Development Guide](./development-guide.md) — setup, scripts, testing, adding commands/providers
- [Master Index](./index.md) — complete navigation

---

## External Resources

- [README](../README.md) — user-facing quick start and command reference
- [CHANGELOG](../CHANGELOG.md) — version history
- [SECURITY](../SECURITY.md) — security policy
- [npm package](https://www.npmjs.com/package/@marlonvidal/tech-manager-os)
- [GitHub repository](https://github.com/marlonvidal/tech-manager-os)
