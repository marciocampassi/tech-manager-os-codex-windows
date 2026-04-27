# Project Documentation Index

**Project:** tech-manager-os (`tmr`)
**Generated:** 2026-04-27
**Scan level:** Deep
**Workflow mode:** Initial scan

---

## Project Overview

- **Type:** Monolith CLI Tool
- **Primary Language:** TypeScript (Node.js ≥18, ESM)
- **Architecture:** Layered CLI — Command → Service → AI Provider Strategy
- **Package:** `@marlonvidal/tech-manager-os` on npm
- **Binary:** `tmr`

## Quick Reference

- **Tech Stack:** TypeScript 5.x, Commander.js, tsup, Jest, conf (AES-256), OpenAI / Claude / Gemini
- **Entry Point:** `src/cli.ts` → `dist/cli.js` (bin: `tmr`)
- **Architecture Pattern:** Layered CLI with lazy-loaded heavy commands
- **Config Location:** `~/.config/tmr/config.json`
- **Workspace Scaffold:** `tmr init` → creates Obsidian vault at user-chosen path

---

## Generated Documentation

- [Project Overview](./project-overview.md) — purpose, tech stack, command reference
- [Architecture](./architecture.md) — system design, subsystems, error model, lazy loading, output modes
- [Source Tree Analysis](./source-tree-analysis.md) — annotated directory tree with file-level descriptions
- [Development Guide](./development-guide.md) — setup, scripts, testing patterns, adding commands and providers

---

## Existing Documentation

- [README](../README.md) — user-facing quick start, command reference, Claude Code skills
- [CHANGELOG](../CHANGELOG.md) — version history
- [SECURITY](../SECURITY.md) — vulnerability reporting and security policy
- [Examples README](../examples/README.md) — sample vault and inbox note walkthrough
- [tmr-inbox Skill](../skills/tmr-inbox/SKILL.md) — Claude Code skill: routes Granola notes from inbox/

---

## Getting Started

### As a User

```bash
npm install -g @marlonvidal/tech-manager-os
tmr init          # Scaffold vault + generate CLAUDE.md (5 prompts)
tmr config        # Set AI provider (openai | claude | gemini) and API key
tmr install tmr-inbox   # Install the inbox processing skill
tmr process       # AI-route your inbox files
```

### As a Contributor

```bash
git clone https://github.com/marlonvidal/tech-manager-os.git
cd tech-manager-os
npm install
npm run build
npm link          # Makes `tmr` available globally
npm test          # Run the full test suite
```

Full details → [Development Guide](./development-guide.md)

---

## Key Architecture Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Config encryption | `conf` with AES-256 | API keys must not be stored in plaintext |
| AI provider abstraction | Strategy pattern | Supports OpenAI, Claude, Gemini interchangeably |
| Heavy command loading | Dynamic `import()` | Fast `tmr --version`/`--help` startup |
| Output modes | `--plain`, `--json` | CI/CD and scripting compatibility |
| Test isolation | MockProvider + real fs in temp dir | Deterministic tests without AI API calls |
| Local-first | Plain Markdown files | No cloud dependency, works offline, version-controllable |

---

## AI Usage Reference

The `tmr process` command is the main AI touchpoint:

1. **CategorizationService** — one AI call per inbox file, returns JSON routing decision
2. **TaskService** — one AI call covering all files, extracts action items

Both services use the configured provider (OpenAI / Claude / Gemini) with:
- `maxTokens: 1024` for categorization
- Strict JSON-only system prompt to ensure parseable responses
- `confidence` score gates: files below `0.75` (configurable) are flagged `needsReview`

---

*This index is the primary entry point for AI-assisted development of tech-manager-os. Reference it when creating brownfield PRDs, planning new features, or onboarding contributors.*
