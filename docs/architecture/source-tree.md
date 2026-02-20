# Source Tree

This section defines the complete project folder structure for the Tech Leadership OS monorepo.

```
tech-manager-os/                     # Repository root
├── packages/                         # Monorepo packages
│   ├── cli/                          # Main CLI application
│   │   ├── src/
│   │   │   ├── commands/             # CLI command handlers
│   │   │   │   ├── init.command.ts
│   │   │   │   ├── process.command.ts
│   │   │   │   ├── watch.command.ts
│   │   │   │   ├── team.command.ts
│   │   │   │   ├── project.command.ts
│   │   │   │   ├── config.command.ts
│   │   │   │   └── task-view.command.ts
│   │   │   ├── index.ts              # CLI entry point
│   │   │   └── cli.ts                # Command dispatcher
│   │   ├── tests/
│   │   │   ├── unit/
│   │   │   └── integration/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── core/                         # Core business logic
│   │   ├── src/
│   │   │   ├── inbox/                # Inbox processing
│   │   │   │   ├── inbox-processor.ts
│   │   │   │   ├── categorization.service.ts
│   │   │   │   └── routing.engine.ts
│   │   │   ├── context/              # Context management
│   │   │   │   ├── context-updater.ts
│   │   │   │   └── context-entry.model.ts
│   │   │   ├── tasks/                # Task extraction
│   │   │   │   ├── task-extractor.ts
│   │   │   │   └── task.model.ts
│   │   │   ├── ai/                   # AI provider abstraction
│   │   │   │   ├── ai-provider.interface.ts
│   │   │   │   ├── openai.provider.ts
│   │   │   │   ├── claude.provider.ts
│   │   │   │   ├── gemini.provider.ts
│   │   │   │   └── provider.factory.ts
│   │   │   ├── config/               # Configuration service
│   │   │   │   ├── config.service.ts
│   │   │   │   └── encryption.util.ts
│   │   │   ├── repository/           # File system abstraction
│   │   │   │   ├── filesystem.repository.ts
│   │   │   │   ├── frontmatter.parser.ts
│   │   │   │   └── markdown.processor.ts
│   │   │   └── models/               # Data models
│   │   │       ├── team-member.model.ts
│   │   │       ├── project.model.ts
│   │   │       ├── leader.model.ts
│   │   │       └── categorization-result.model.ts
│   │   ├── tests/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── agents/                       # BMAD agent orchestration
│   │   ├── src/
│   │   │   ├── orchestrator.ts       # Agent orchestrator
│   │   │   ├── skill-executor.ts     # BMAD skill execution
│   │   │   └── agent-loader.ts       # Load BMAD definitions
│   │   ├── tests/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── shared/                       # Shared utilities and types
│       ├── src/
│       │   ├── types/                # Shared TypeScript types
│       │   ├── utils/                # Utility functions
│       │   └── constants/            # Shared constants
│       ├── tests/
│       ├── package.json
│       └── tsconfig.json
│
├── .tmr-core/                        # BMAD agent and skill definitions
│   ├── agents/                       # BMAD agent definitions
│   │   ├── cycle-agent.md
│   │   ├── tmr-people.md
│   │   ├── tmr-project.md
│   │   ├── tmr-career.md
│   │   ├── tmr-hiring.md
│   │   └── tmr-master.md
│   ├── skills/                       # BMAD skill definitions
│   │   ├── process-meeting-note.md
│   │   ├── 1on1-prepare.md
│   │   ├── feedback-generate.md
│   │   └── status-report.md
│   ├── tasks/                        # Workflow task definitions
│   ├── templates/                    # Document templates
│   └── checklists/                   # Validation checklists
│
├── docs/                             # Documentation
│   ├── architecture.md               # This document
│   ├── prd.md                        # Product requirements
│   └── setup/
│       └── obsidian-setup.md
│
├── scripts/                          # Monorepo management scripts
│   ├── build.sh                      # Build all packages
│   ├── test.sh                       # Run all tests
│   └── setup-dev.sh                  # Development environment setup
│
├── .github/                          # GitHub configuration
│   └── workflows/
│       ├── ci.yml                    # Continuous integration
│       └── release.yml               # Release automation
│
├── pnpm-workspace.yaml               # pnpm monorepo configuration
├── package.json                      # Root package.json
├── tsconfig.base.json                # Base TypeScript config
├── .eslintrc.js                      # ESLint configuration
├── .prettierrc                       # Prettier configuration
├── vitest.config.ts                  # Vitest configuration
├── README.md                         # Project README
└── LICENSE                           # MIT License
```

## Package Dependencies

```
┌─────────────────────────────────────────┐
│ packages/cli                            │
│ ├─> packages/core                      │
│ ├─> packages/agents                    │
│ └─> packages/shared                    │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ packages/core                           │
│ └─> packages/shared                    │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ packages/agents                         │
│ ├─> packages/core                      │
│ └─> packages/shared                    │
└─────────────────────────────────────────┘
```

---
