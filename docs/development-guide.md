# Development Guide

**Project:** tech-manager-os (`tmr`)
**Generated:** 2026-04-27

---

## Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Node.js | ≥ 18.0.0 | LTS recommended (CI uses 20.17.0) |
| npm | ≥ 9 | Included with Node.js |
| Git | any | For hooks (husky) |

---

## Getting Started

```bash
# 1. Clone
git clone https://github.com/marlonvidal/tech-manager-os.git
cd tech-manager-os

# 2. Install dependencies
npm install

# 3. Build
npm run build

# 4. Link for local development (makes `tmr` available globally)
npm link

# 5. Verify
tmr --version
```

---

## Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| Build | `npm run build` | Compiles TypeScript → `dist/` via tsup |
| Dev (no build) | `npm run dev` | Run source directly via ts-node (no build step) |
| Test | `npm test` | Run full Jest test suite |
| Test (coverage) | `npm run test:coverage` | Run tests + generate coverage report |
| Lint | `npm run lint` | ESLint with TypeScript rules |
| Lint (fix) | `npm run lint:fix` | ESLint with auto-fix |
| Format | `npm run format` | Prettier on `src/` |
| Type-check | `npm run typecheck` | `tsc --noEmit` (no emit, just checks) |
| Validate (full) | `npm run validate` | Runs lint → typecheck → test → build in sequence |

---

## Development Workflow

### Running Without Building

```bash
npm run dev -- --version
npm run dev -- init
npm run dev -- process --dry-run
```

> `ts-node` executes TypeScript directly via tsconfig.json. Use this for rapid iteration.

### Running the Built Binary

```bash
npm run build
node dist/cli.js --help
# or if linked:
tmr --help
```

---

## Environment Variables

| Variable | Maps To | Description |
|----------|---------|-------------|
| `TMR_PROVIDER` | `active_provider` | Override the configured AI provider |
| `TM_PROVIDER` | `provider` (deprecated) | Legacy provider override |
| `TM_API_KEY` | `apiKey` (deprecated) | Legacy API key override |

> **Note:** Prefer `tmr config` over environment variables for local development. Environment variables are primarily used in CI/CD contexts.

---

## Configuration Storage

Config is stored at `~/.config/tmr/config.json` using the `conf` library with AES-256 encryption at rest. To inspect or reset:

```bash
# View config location
node -e "const { homedir } = require('os'); const { join } = require('path'); console.log(join(homedir(), '.config', 'tmr'))"

# Reset config (delete the file)
rm ~/.config/tmr/config.json
```

---

## Testing

### Running Tests

```bash
# All tests
npm test

# Watch mode
npm test -- --watch

# Single file
npm test -- tests/commands/install.command.test.ts

# With coverage
npm run test:coverage
```

### Test Structure

```
tests/
├── commands/       ← Unit tests for each command (mock services)
├── services/       ← Unit tests for services (mock file system, mock AI)
├── providers/      ← AI provider adapter tests
├── workflows/      ← Prompt and workspace builder tests
├── utils/          ← Utility function tests
├── templates/      ← Template generation tests
├── integration/    ← End-to-end tests with real fs I/O + MockProvider
├── packaging/      ← Build artifact integrity tests
├── fixtures/       ← Sample Granola meeting note .md files
└── cli.test.ts     ← CLI smoke tests
```

### Key Testing Patterns

- **Mock AI**: Use `MockProvider` from `src/providers/mock-provider.ts` — returns deterministic JSON for categorization tests.
- **Integration tests** use real file I/O in a temp directory; they do not make real AI calls.
- **Jest ESM mode**: Tests run with `NODE_OPTIONS=--experimental-vm-modules` due to the project's `"type": "module"` ESM configuration.
- **Guard in cli.ts**: `if (!process.env.JEST_WORKER_ID)` prevents `await run()` from executing during tests.

---

## Build System

**tsup** compiles `src/cli.ts` into `dist/`:

```bash
npm run build
# Outputs:
#   dist/cli.js       ← ESM bundle (bin: tmr)
#   dist/cli.d.ts     ← Type declarations
#   dist/cli.js.map   ← Source maps
```

Key tsup settings (in `tsup.config.ts`):
- **format**: ESM only
- **splitting**: enabled — creates separate chunks for lazy-loaded commands
- **dts**: generates `.d.ts` declarations

---

## Code Quality

### Pre-commit Hook

Husky runs `lint-staged` on staged `.ts` files:
1. `eslint --fix`
2. `prettier --write`

### CI Pipeline (GitHub Actions)

On every push/PR to `main`:
1. Lint (`npm run lint`)
2. Type-check (`npm run typecheck`)
3. Build (`npm run build`)
4. Test (`npm test`)
5. Coverage threshold check (`npm run test:coverage`)

See `.github/workflows/ci.yml`.

---

## Adding a New Command

1. Create `src/commands/<name>.command.ts` with a `run<Name>` function and optionally `create<Name>Command()`.
2. Register in `src/cli.ts`:
   - **Lightweight** (no AI/heavy deps): static import + `p.addCommand(create<Name>Command())`
   - **Heavy** (AI, inquirer, googleapis): dynamic `import()` in `.action()` handler
3. Add tests in `tests/commands/<name>.command.test.ts`.

---

## Adding a New AI Provider

1. Create `src/providers/<name>-provider.ts` implementing `AIProvider` interface.
2. Register in `src/providers/ai-provider-factory.ts` `switch` statement.
3. Add tests in `tests/providers/<name>-provider.test.ts`.
4. Update `promptProviderSelection()` in `src/workflows/onboarding.prompts.ts`.

---

## Publishing

```bash
# Validate everything passes
npm run validate

# Bump version in package.json
# Tag and push — npm publish is manual
npm publish --access public
```

> The `.npmignore` controls what gets included. `tests/packaging/` validates the published artifact.
