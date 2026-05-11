# Contributing to tech-manager-os

Thank you for your interest in contributing to `tech-manager-os`! This guide covers everything you need to set up, build, test, and submit changes — no additional guidance required.

---

## Table of Contents

1. [Development Setup](#development-setup)
2. [Coding Conventions](#coding-conventions)
3. [Testing](#testing)
4. [Pull Request Process](#pull-request-process)
5. [Contributing a Skill](#contributing-a-skill)

---

## Development Setup

### Prerequisites

- **Node.js ≥ 18.0.0** — the project requires Node 18+ for native ESM and modern `node:` built-ins.
- **npm** — comes bundled with Node.js.

### Clone and Install

```bash
git clone https://github.com/marlonvidal/tech-manager-os.git
cd tech-manager-os
npm install
```

### Validate Everything

Before opening a PR, run the full quality gate:

```bash
npm run validate
```

This runs **lint → typecheck → test → build** in sequence. All four steps must pass.

### Individual Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Compile TypeScript to ESM via tsup |
| `npm test` | Run the Jest test suite |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run lint` | ESLint on `src/` |
| `npm run lint:fix` | Auto-fix ESLint issues |
| `npm run format` | Prettier on `src/` |
| `npm run typecheck` | Type-check without emitting (`tsc --noEmit`) |
| `npm run validate` | Full gate: lint + typecheck + test + build |

---

## Coding Conventions

### ESM Import Extensions

The project uses `"type": "module"`. Every import **must** include the `.js` extension — even for `.ts` source files:

```typescript
// ✅ Correct
import { printSuccess } from '../utils/display.js';

// ❌ Wrong — will fail at runtime
import { printSuccess } from '../utils/display';
import { printSuccess } from '../utils/display.ts';
```

### Output Helpers — Never Use `console`

The `no-console` ESLint rule is enforced. Use the helpers from `src/utils/display.ts` exclusively:

| Helper | When to Use | Color |
|--------|-------------|-------|
| `printSuccess(msg, plain)` | Confirmations, completed actions | Green |
| `printError(msg, hint, plain)` | Errors (writes to `stderr`) | Red |
| `printWarning(msg, plain)` | Non-fatal warnings | Yellow |
| `printInfo(msg, plain)` | Neutral information | Blue |
| `printJson(data)` | Machine-readable output (`--json` flag) | — |

```typescript
// ✅ Correct
import { printSuccess, printError } from '../utils/display.js';
printSuccess('Skill installed successfully', plain);

// ❌ Wrong
console.log('Skill installed successfully');
```

Always propagate the `plain: boolean` parameter from global CLI options into every helper call — never hardcode `plain = false`.

### TypeScript Strict Rules

- `strict: true` is enforced — no implicit `any`, all function parameters and return types must be explicit.
- `@typescript-eslint/no-explicit-any` is set to **error** — zero tolerance. Use `unknown` and narrow it:

```typescript
// ✅ Correct
function process(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Expected string');
  return value.toUpperCase();
}

// ❌ Wrong
function process(value: any): string { ... }
```

- `@typescript-eslint/explicit-function-return-type` is set to **warn** — always declare return types on exported functions; add them to internal helpers where non-obvious.

### Error Handling

- All custom errors **must** extend `TmrError` (from `src/errors/tmr-error.ts`).
- Never use `process.exit()` — set `process.exitCode` instead to allow async cleanup:

```typescript
// ✅ Correct
process.exitCode = 1;
return;

// ❌ Wrong
process.exit(1);
```

### File & Folder Naming

- Source files: `kebab-case` with a role suffix — `*.command.ts`, `*.service.ts`, `*.provider.ts`, `*.types.ts`.
- No barrel `index.ts` files — import directly from the file that defines the export.
- Types live in dedicated `*.types.ts` files; do not define complex types inline in service or command files.

### Code Organization Within Files

- Module-level helpers go **above** the exported class or function, separated by `// ── Section Name ──` comment dividers (see `src/utils/display.ts` for the pattern).

### Formatting

Prettier is configured for:
- Single quotes (`'`)
- 2-space indentation
- Trailing commas (`all` — including function params)
- Print width: 100 characters
- Semicolons required
- Arrow function parens always (`(x) => x`, not `x => x`)

Run `npm run lint:fix && npm run format` before committing.

---

## Testing

### Running Tests

```bash
# Full suite
npm test

# With coverage report
npm run test:coverage

# Single file or pattern
npm test -- --testPathPattern="install"
```

> **Note:** The `NODE_OPTIONS=--experimental-vm-modules` flag is required for Jest's ESM module mocking (`jest.unstable_mockModule`). The npm scripts set it automatically — be aware of this when running Jest directly.

### Coverage Thresholds

Jest enforces minimum coverage thresholds. New code must not drop these below:

| Metric | Threshold |
|--------|-----------|
| Branches | 60% |
| Functions | 78% |
| Lines | 78% |
| Statements | 78% |

Run `npm run test:coverage` to see the current coverage report and verify your additions maintain these levels.

### Mocking AI Calls — `MockProvider`

Never make real AI API calls in tests. Use `MockProvider` from `src/providers/mock-provider.ts`:

```typescript
import { MockProvider } from '../../src/providers/mock-provider.js';

const mockProvider = new MockProvider();
mockProvider.setResponse('categorize', JSON.stringify({ category: 'meeting-notes' }));
```

### Mocking ESM Modules

Use `jest.unstable_mockModule` (not `jest.mock`) for ESM-compatible module mocking. See `tests/commands/install.command.test.ts` for a complete example:

```typescript
jest.unstable_mockModule('../../src/services/skill-registry.service.js', () => ({
  SkillRegistryService: jest.fn(() => ({
    fetchSkillContent: mockFetchSkillContent,
    installSkill: mockInstallSkill,
  })),
}));
```

### Test Structure

```
tests/
├── commands/          # Command-layer unit tests (services are mocked)
├── services/          # Service unit tests + integration tests
├── integration/       # Full end-to-end tests (real fs via tmp dir, mocked network)
├── providers/         # AI provider tests
└── fixtures/          # Shared test data builders
```

File naming:
- Unit tests: `<name>.test.ts`
- Integration tests: `<name>.integration.test.ts`
- Performance tests: `<name>.scalability.test.ts`

---

## Pull Request Process

### Branch Naming

Use `story/N.N-short-slug` — where `N.N` is the epic and story number:

```
story/5.1-contributing-md
story/4.1-skill-registry-integration
story/3.2-team-scoped-member-routing
```

### Pre-PR Checklist

1. `npm run validate` passes — **all four steps** (lint, typecheck, test, build) must exit 0.
2. No `console.log` or debug code left in `src/`.
3. No secrets or API keys hardcoded.
4. `dist/` and `node_modules/` are **not** committed (both are gitignored).

### PR Description

Fill in the PR template at `.github/pull_request_template.md` completely — the checklist items are not optional. Include:

- A brief description of what was implemented.
- The type of change (new feature, bug fix, refactor, chore).
- Whether there is a breaking change and its impact.
- The `npm run validate` output confirming all steps passed.
- Any trade-offs or follow-up items for future stories.

---

## Contributing a Skill

`tech-manager-os` supports an official skill registry that contributors can extend. Skills are Markdown files that Claude Code can read and execute.

### Registry Structure

```
skills/
├── index.json               ← Registry index: ["tmr-inbox", "tmr-daily", ...]
├── tmr-inbox/
│   └── SKILL.md             ← Skill content for tmr-inbox
└── tmr-daily/
    └── SKILL.md             ← Skill content for tmr-daily
```

The registry is hosted at:
```
https://raw.githubusercontent.com/marlonvidal/tech-manager-os/main/skills
```

Users install skills via `tmr install` (all skills) or `tmr install <name>` (specific skill).

### `SKILL.md` Format Requirements

Every skill file must:

1. **Start with a version comment** on the first line:
   ```
   <!-- version: 1.0.0 -->
   ```

2. **Be self-contained** — the file must be fully readable without any other context; Claude Code loads it directly.

3. **Follow the naming convention**:
   - Skill directory name: `kebab-case`, prefixed with `tmr-` for official skills (e.g. `tmr-inbox`, `tmr-daily`).
   - Only lowercase letters, digits, and hyphens.

### Submission Process

1. **Fork** the repository and create a branch: `skill/tmr-<name>`.
2. **Add your skill** at `skills/tmr-<name>/SKILL.md`.
3. **Update the registry index** — add your skill name to the `skills/index.json` array:
   ```json
   ["tmr-inbox", "tmr-daily", "tmr-<name>"]
   ```
4. **Test locally** — run `tmr install tmr-<name>` from a local build to verify the skill installs and behaves as expected.
5. **Open a PR** with:
   - A description of what the skill does.
   - Example invocations showing expected input and output.
   - Confirmation that you tested the install flow locally.

Skills that do not include a version comment, do not function as described, or contain hardcoded credentials will not be merged.

---

## Questions?

Open a [GitHub Discussion](https://github.com/marlonvidal/tech-manager-os/discussions) or file an issue. We're happy to help you get your contribution across the finish line.
