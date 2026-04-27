# Architecture

**Project:** tech-manager-os (`tmr`)
**Type:** CLI Tool — TypeScript / Node.js
**Pattern:** Layered CLI (Command → Service → Provider)
**Generated:** 2026-04-27

---

## Executive Summary

`tech-manager-os` is a **local-first CLI tool** for engineering managers. It scaffolds an Obsidian vault, processes Granola meeting notes using AI (routing, categorization, task extraction), and manages team/project metadata — all from a single binary (`tmr`) with no cloud backend.

The architecture is intentionally simple and flat: a **Commander.js program** registers commands, each command delegates to **injected services**, and AI calls are routed through a **Strategy-pattern provider layer** that supports OpenAI, Anthropic (Claude), and Google Gemini interchangeably.

---

## Technology Stack

| Category | Technology | Version | Role |
|----------|-----------|---------|------|
| Language | TypeScript | ^5.9.3 | Strict, ESNext target |
| Runtime | Node.js | ≥18.0.0 | ESM native |
| CLI framework | Commander.js | ^14.0.3 | Command parsing, help, subcommands |
| Build | tsup | ^8.5.1 | ESM bundling with code splitting |
| Config storage | conf | ^15.1.0 | AES-256 encrypted JSON at `~/.config/tmr/` |
| AI: OpenAI | openai | ^6.25.0 | GPT-4o adapter |
| AI: Anthropic | @anthropic-ai/sdk | ^0.78.0 | Claude adapter |
| AI: Google | @google/generative-ai | ^0.24.1 | Gemini adapter |
| Prompts | inquirer | ^13.3.0 | Interactive onboarding flows |
| Spinners | ora | ^9.3.0 | Progress feedback |
| Color output | chalk | ^5.6.2 | ANSI colors (disabled via `--plain`) |
| File watcher | chokidar | ^5.0.0 | `tmr watch` inbox monitoring |
| File system | fs-extra | ^11.3.3 | Enhanced fs with copy/move/ensureDir |
| Markdown | gray-matter | ^4.0.3 | Frontmatter parsing |
| Google Drive | googleapis | ^144.0.0 | Optional OAuth2 Drive sync |
| Logging | winston | ^3.19.0 | File + console logger |
| Date utils | date-fns | ^3.6.0 | Date formatting for filenames/tasks |
| Testing | Jest + ts-jest | ^29.7.0 | ESM test runner |
| Linting | ESLint + TypeScript | ^10.0.1 | Flat config, strict rules |

---

## Architecture Pattern: Layered CLI

```
┌─────────────────────────────────────────────────┐
│                   CLI Entry Point                │
│                   src/cli.ts                     │
│  Commander.js · Lazy loading · Global options    │
└──────────────┬──────────────────────────────────┘
               │ registers / delegates
┌──────────────▼──────────────────────────────────┐
│               Command Layer                      │
│           src/commands/*.command.ts              │
│  Thin orchestrators — parse args, call services  │
└──────────────┬──────────────────────────────────┘
               │ calls
┌──────────────▼──────────────────────────────────┐
│               Service Layer                      │
│           src/services/*.service.ts              │
│  Business logic · File I/O · AI orchestration    │
└──────────────┬──────────────────────────────────┘
               │ calls
┌──────────────▼──────────────────────────────────┐
│              Provider Layer                      │
│           src/providers/*.ts                     │
│  Strategy pattern · OpenAI | Claude | Gemini     │
└─────────────────────────────────────────────────┘
```

---

## Core Subsystems

### 1. Configuration (`ConfigService`)

- **Storage**: `~/.config/tmr/config.json` via `conf` library
- **Encryption**: AES-256 at rest (key: `tmr-config-v1`)
- **Fields**: `active_provider`, `providers` map (model + encrypted API key), `workspace_path`, `confidence_threshold`, optional Google Drive OAuth tokens
- **Environment overrides**: `TMR_PROVIDER` → `active_provider`
- **API**: `getActiveProvider()`, `addProvider()`, `getWorkspacePath()`, `getConfidenceThreshold()`

### 2. AI Provider Strategy

```
AIProvider (interface)
  ├── OpenAIProvider
  ├── AnthropicProvider
  ├── GeminiProvider
  └── MockProvider (tests only)
```

`AIProviderFactory.create(provider, apiKey)` instantiates the correct adapter. All adapters implement:
- `testConnection(): Promise<boolean>`
- `generateText(prompt, options): Promise<string>`
- `streamText(prompt, options): AsyncGenerator<string>`

Provider key names: `'openai'` | `'claude'` | `'gemini'`. `'anthropic'` is accepted as a legacy alias.

### 3. Inbox Processing Pipeline (`InboxProcessService`)

The `tmr process` command runs a **5-step pipeline**:

```
[1/5] Scan inbox/           → InboxService.scanInbox()
[2/5] Load context          → loadCategorizationContext() [team + project data]
[3/5] AI categorization     → CategorizationService.categorize() [per file, AI call]
[4/5] Extract tasks         → TaskService.extractTasks() [AI call, all files]
[5/5] Organize files        → FileOrganizationService.organizeFile() [move to destinations]
```

AI categorization uses a strict **JSON-only system prompt**. The response schema:
```json
{
  "type": "1on1_session|team_meeting|...",
  "members": [],
  "projects": [],
  "insights": { "<name>": ["insight1"] },
  "destinations": ["workspace-relative/path/"],
  "suggestedActions": [],
  "confidence": 0.95
}
```

Files with `confidence < threshold` (default 0.75) are flagged `needsReview = true` and not moved.

### 4. Workspace Structure

`tmr init` scaffolds a **local Obsidian vault** at the user-chosen path:

```
~/tech-leadership-workspace/
├── CLAUDE.md                    ← AI context: identity, folders, style
├── inbox/                       ← Drop Granola notes here
├── archive/                     ← Processed originals
├── my-tasks/                    ← tasks.md + today/week/month/quarter views
├── my-teams/members/            ← Per-member context files
├── my-teams/teams/              ← Team configuration
├── my-company/members/          ← Company-scoped member profiles
├── my-company/projects/         ← Project metadata
├── my-leadership/               ← Leadership contacts
├── my-career/                   ← Assessments, feedback
├── knowledge-base/              ← Company docs, people, process
├── .claude/skills/              ← Installed Claude Code skills
├── .cursor/rules/tmr/           ← Cursor AI rules
├── .gemini/agents/              ← Gemini agents (future)
└── .obsidian/plugins/           ← obsidian-git, granola-sync, terminal, dataview
```

### 5. Skill Registry (`SkillRegistryService`)

Skills are Markdown files (`SKILL.md`) hosted in this repository under `skills/<name>/SKILL.md`. The registry base URL is:

```
https://raw.githubusercontent.com/marlonvidal/tech-manager-os/main/skills
```

- `fetchSkillContent(name)` — HTTPS GET with 10s timeout
- Version is parsed from `<!-- version: X.Y.Z -->` comment in SKILL.md
- Installed skills live in `<workspace>/.claude/skills/<name>/SKILL.md`
- Manifest at `<workspace>/.claude/skills/skill-manifest.json`

---

## Error Hierarchy

All errors extend `TmrError` (base) with error codes:

| Class | Code | Trigger |
|-------|------|---------|
| `ConfigurationError` | TMR_E001 | Missing/invalid config |
| `FileSystemError` | TMR_E002 | I/O operation failure |
| `AIProviderError` | TMR_E003 | AI API call failure |
| `ValidationError` | TMR_E004 | Invalid user input |
| `RoutingError` | TMR_E005 | File routing failure |
| `TeamMemberNotFoundError` | TMR_E101 | Email not in team |
| `ProjectNotFoundError` | TMR_E102 | Project slug not found |
| `InvalidEmailError` | TMR_E103 | Malformed email |
| `ConfidenceThresholdError` | TMR_E104 | AI confidence below threshold |

`process.exitCode = 78` (EX_CONFIG) is used when no API key is configured — distinguishes config errors from runtime errors for shell scripting.

---

## Output Modes

Every command supports three output modes via global flags:

| Flag | Behavior | Use Case |
|------|---------|---------|
| _(default)_ | Colored ANSI output with spinners | Interactive terminal |
| `--plain` | Plain text, no ANSI codes | CI/CD, pipes, accessibility |
| `--json` | Machine-readable JSON to stdout | Scripting, integrations |

The `plain` flag propagates from global opts into every service via function parameters. The color contract is enforced in `src/utils/display.ts`:
- `green` → success
- `yellow` → warning
- `blue` → info
- `red` → error
- `cyan` (exception) → `tmr init` banner only

---

## Lazy Loading Strategy

`src/cli.ts` uses **dynamic `import()`** for commands with heavy dependencies, keeping startup time fast for lightweight commands:

| Commands (static import) | Commands (lazy import) |
|--------------------------|----------------------|
| config, team, member, leadership, project, task-view | init, process, watch, install, update |

This ensures `tmr --version`, `tmr --help`, `tmr team list`, etc. do not pay the startup cost of loading AI SDKs, googleapis, chokidar, or inquirer.

---

## Testing Strategy

| Layer | Approach |
|-------|---------|
| Unit: services | Mock `FileSystemService` and `AIProvider` (MockProvider) |
| Unit: commands | Mock service singletons |
| Unit: providers | Mock HTTP/SDK calls, test error handling |
| Integration | Real file I/O in temp dir, `MockProvider` for AI |
| Packaging | Verify dist/ output shape and .npmignore correctness |

All tests run via Jest with `NODE_OPTIONS=--experimental-vm-modules` for ESM compatibility.

---

## Known Architectural Debt

- `cli.ts` contains a guard comment referencing `ARCH-DEBT-003`: when migrating to Vitest (the intended test runner per architecture), the `JEST_WORKER_ID` environment guard should be updated to check `VITEST`.
- `AppConfig.provider` and `AppConfig.apiKey` are deprecated fields kept for Story 1.3 backward compatibility; they should be removed once all callers use `active_provider` and `providers[name].api_key_encrypted`.
