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
│   │   │   │   ├── install.command.ts
│   │   │   │   ├── update.command.ts
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
│   │   │   ├── scaffold/             # Vault scaffolding (tmr init)
│   │   │   │   ├── scaffold.service.ts
│   │   │   │   └── claude-md.generator.ts
│   │   │   ├── skills/               # Skill install/update logic
│   │   │   │   └── skill-registry.service.ts
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
│   └── shared/                       # Shared utilities and types
│       ├── src/
│       │   ├── types/                # Shared TypeScript types
│       │   ├── utils/                # Utility functions
│       │   └── constants/            # Shared constants
│       ├── tests/
│       ├── package.json
│       └── tsconfig.json
│
├── skills/                           # Distributable Claude Code skills (published to registry)
│   └── tmr-inbox/
│       └── SKILL.md                  # Generalized inbox processor — no hardcoded user values
│
├── .tmr-core/                        # BMAD agent and skill definitions
│   ├── agents/                       # BMAD agent definitions (cycle-agent only)
│   │   └── cycle-agent.md
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
│ └─> packages/shared                    │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ packages/core                           │
│ └─> packages/shared                    │
└─────────────────────────────────────────┘
```

---
