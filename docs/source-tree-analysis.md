# Source Tree Analysis

**Project:** tech-manager-os (`tmr`)
**Type:** CLI Tool — TypeScript / Node.js
**Generated:** 2026-04-27

---

## Annotated Directory Tree

```
tech-manager-os/                         ← Repository root
│
├── src/                                 ← All TypeScript source files
│   ├── cli.ts                           ← ENTRY POINT — creates Commander program, lazy-loads heavy commands
│   │
│   ├── commands/                        ← One file per CLI command; thin orchestrators only
│   │   ├── init.command.ts              ← tmr init: interactive setup wizard, scaffolds workspace + CLAUDE.md
│   │   ├── config.command.ts            ← tmr config: manage AI provider and API key settings
│   │   ├── process.command.ts           ← tmr process: 5-step AI inbox pipeline (scan→categorize→context→tasks→organize)
│   │   ├── watch.command.ts             ← tmr watch: chokidar watcher that triggers process on file add
│   │   ├── install.command.ts           ← tmr install: fetch and install Claude Code skills from GitHub registry
│   │   ├── update.command.ts            ← tmr update: check and update all installed skills
│   │   ├── team.command.ts              ← tmr team *: create/add/archive/list teams and members
│   │   ├── member.command.ts            ← tmr member *: manage individual team member records
│   │   ├── leadership.command.ts        ← tmr leadership *: track leadership contacts
│   │   ├── project.command.ts           ← tmr project *: add/list projects
│   │   ├── relationship.command.ts      ← tmr relationship *: track cross-team relationships
│   │   └── task-view.command.ts         ← tmr show <email>: display unified profile view
│   │
│   ├── services/                        ← Business logic and I/O, injected into commands
│   │   ├── config.service.ts            ← Conf-backed encrypted store at ~/.config/tmr/config.json
│   │   ├── file-system.service.ts       ← Abstracted fs-extra wrapper (testable, injectable)
│   │   ├── inbox.service.ts             ← Scans inbox/ folder, reads markdown files
│   │   ├── inbox-process.service.ts     ← Orchestrates the 5-step process pipeline
│   │   ├── categorization.service.ts    ← Sends notes to AI, parses JSON routing decisions
│   │   ├── categorization-context.loader.ts ← Loads team/project data for AI context
│   │   ├── context.service.ts           ← Updates member/project context files with AI insights
│   │   ├── task.service.ts              ← Extracts action items from notes, updates tasks.md
│   │   ├── file-organization.service.ts ← Moves processed files to their destination folders
│   │   ├── section-parser.service.ts    ← Parses markdown sections in context/profile files
│   │   ├── skill-registry.service.ts    ← Fetches SKILL.md from GitHub, manages skill-manifest.json
│   │   ├── team.service.ts              ← CRUD for teams in my-teams/ workspace folder
│   │   ├── member.service.ts            ← CRUD for team member profiles
│   │   ├── leadership.service.ts        ← CRUD for leadership contacts
│   │   ├── project.service.ts           ← CRUD for projects in my-company/projects/
│   │   ├── relationship.service.ts      ← Manages cross-team relationship records
│   │   ├── task-view.service.ts         ← Builds unified profile view across data sources
│   │   ├── template.service.ts          ← Reads and processes markdown templates
│   │   ├── claude-md.generator.ts       ← Generates CLAUDE.md from onboarding answers
│   │   ├── obsidian-plugin.service.ts   ← Downloads Obsidian plugin stubs during init
│   │   ├── google-drive.service.ts      ← Optional Google Drive OAuth2 sync for member docs
│   │   └── watch.service.ts             ← Wraps chokidar, wires file events to process pipeline
│   │
│   ├── providers/                       ← AI provider adapters (Strategy pattern)
│   │   ├── ai-provider.interface.ts     ← AIProvider interface: testConnection, generateText, streamText
│   │   ├── ai-provider-factory.ts       ← Factory: maps 'openai'|'claude'|'gemini' → concrete provider
│   │   ├── base-ai-provider.ts          ← Shared retry / error-handling logic
│   │   ├── openai-provider.ts           ← OpenAI SDK adapter
│   │   ├── anthropic-provider.ts        ← Anthropic SDK adapter
│   │   ├── gemini-provider.ts           ← Google Generative AI adapter
│   │   └── mock-provider.ts             ← Deterministic mock for unit/integration tests
│   │
│   ├── types/                           ← TypeScript interfaces and domain types (no runtime code)
│   │   ├── config.types.ts              ← AppConfig, ProviderConfig, ENV_MAP, CONFIG_DEFAULTS
│   │   ├── inbox.types.ts               ← InboxFile shape
│   │   ├── categorization.types.ts      ← NoteType enum, CategorizationResult, CategorizationContext
│   │   ├── process.types.ts             ← ProcessSummary, ProcessRunOptions
│   │   ├── member.types.ts              ← TeamMember, MemberProfile
│   │   ├── team.types.ts                ← Team, TeamConfig
│   │   ├── leadership.types.ts          ← LeadershipContact
│   │   ├── project.types.ts             ← Project, ProjectConfig
│   │   ├── relationship.types.ts        ← Relationship record
│   │   ├── task.types.ts                ← Task, TaskPeriod ('today'|'this-week'|...)
│   │   ├── context.types.ts             ← ContextEntry, ContextUpdateResult
│   │   ├── email-resolution.types.ts    ← EmailResolutionResult
│   │   ├── file-organization.types.ts   ← OrganizeDestination
│   │   └── onboarding.types.ts          ← ManagerProfile, LeadershipContext, TeamMember (onboarding shape)
│   │
│   ├── utils/                           ← Pure utility functions
│   │   ├── display.ts                   ← Centralized print helpers (success/warning/error/info/spinner)
│   │   ├── workspace.ts                 ← getWorkspaceRoot() — reads config or falls back to cwd
│   │   ├── logger.ts                    ← Winston-based logger (file + console)
│   │   └── redact.ts                    ← Redacts API keys and secrets for safe logging
│   │
│   ├── workflows/                       ← Multi-step interactive flows (not single-file commands)
│   │   ├── onboarding.prompts.ts        ← All inquirer prompts: workspace path, profile, team members, Google Drive
│   │   └── workspace-builder.ts         ← Creates full vault folder structure (28 directories)
│   │
│   └── templates/                       ← Static content generators
│       └── onboarding.templates.ts      ← Generates task period files (today.md, this-week.md, etc.)
│
├── tests/                               ← Jest test suite (mirrors src/ structure)
│   ├── commands/                        ← Command-level unit tests
│   ├── services/                        ← Service unit tests
│   ├── providers/                       ← Provider adapter tests (includes mock-provider)
│   ├── workflows/                       ← Prompt/workflow tests
│   ├── utils/                           ← Utility function tests
│   ├── templates/                       ← Template generation tests
│   ├── integration/                     ← End-to-end integration tests (real file I/O, mock AI)
│   ├── packaging/                       ← Build artifact validation tests
│   ├── fixtures/                        ← Sample Granola note markdown files for testing
│   └── cli.test.ts                      ← Top-level CLI smoke tests
│
├── skills/                              ← Bundled Claude Code skills (published to registry)
│   └── tmr-inbox/
│       └── SKILL.md                     ← tmr-inbox skill: routes Granola notes to vault folders
│
├── examples/                            ← Usage demonstrations
│   ├── inbox-samples/                   ← Sample meeting note markdowns
│   └── sample-vault/
│       └── CLAUDE.md                    ← Example generated CLAUDE.md context file
│
├── dist/                                ← Build output (tsup → ESM + .d.ts, git-ignored source)
│   ├── cli.js                           ← Compiled entry point (bin: tmr)
│   ├── cli.js.map                       ← Source map
│   └── cli.d.ts                         ← Type declarations
│
├── .github/workflows/
│   └── ci.yml                           ← GitHub Actions: lint → typecheck → build → test → coverage
│
├── package.json                         ← npm package, bin.tmr, scripts, deps
├── tsconfig.json                        ← TypeScript config (ESNext, strict, ESM)
├── tsup.config.ts                       ← Build config: code splitting, ESM output
├── jest.config.ts                       ← Jest config: ts-jest, ESM experimental-vm-modules
├── eslint.config.js                     ← ESLint flat config (TypeScript rules + prettier)
└── README.md                            ← User-facing documentation
```

---

## Critical Directories

| Directory | Purpose |
|-----------|---------|
| `src/cli.ts` | Single entry point — bootstraps Commander, registers commands |
| `src/commands/` | One file per CLI verb; thin orchestrators that delegate to services |
| `src/services/` | All business logic; most are injectable/testable classes |
| `src/providers/` | AI provider Strategy pattern — swap models without changing pipeline |
| `src/types/` | Domain type definitions (no runtime code — tree-shaken completely) |
| `src/workflows/` | Multi-step interactive flows (inquirer prompts, workspace scaffolding) |
| `src/utils/` | Cross-cutting concerns: display, logging, secrets redaction |
| `tests/integration/` | End-to-end tests with real file I/O and mock AI provider |
| `skills/tmr-inbox/` | Published Claude Code skill (fetched via `tmr install`) |

---

## Lazy Loading Architecture

`cli.ts` uses **static imports** for lightweight commands (config, team, member, leadership, project, task-view) and **dynamic `import()`** for heavy commands (init, process, watch, install, update). This ensures `tmr --version` and `tmr --help` have sub-50ms startup regardless of AI SDK install size.
