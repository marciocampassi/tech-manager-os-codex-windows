---
project_name: 'tech-manager-os'
user_name: 'Marlon'
date: '2026-04-27'
sections_completed: ['technology_stack', 'language_rules', 'architecture_rules', 'testing_rules', 'code_quality_rules', 'critical_rules', 'shared_utilities_rules']
status: 'complete'
rule_count: 53
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

| Category | Technology | Version |
|----------|-----------|---------|
| Language | TypeScript | ^5.9.3 |
| Runtime | Node.js | ≥18.0.0 |
| CLI Framework | Commander.js | ^14.0.3 |
| Build | tsup | ^8.5.1 |
| Config | conf | ^15.1.0 |
| AI: OpenAI | openai | ^6.25.0 |
| AI: Anthropic | @anthropic-ai/sdk | ^0.78.0 |
| AI: Google | @google/generative-ai | ^0.24.1 |
| Prompts | inquirer | ^13.3.0 |
| Spinners | ora | ^9.3.0 |
| Color output | chalk | ^5.6.2 |
| File watcher | chokidar | ^5.0.0 |
| File system | fs-extra | ^11.3.3 |
| Markdown | gray-matter | ^4.0.3 |
| Google Drive | googleapis | ^144.0.0 |
| Logging | winston | ^3.19.0 |
| Date utils | date-fns | ^3.6.0 |
| Testing | Jest + ts-jest | ^29.7.0 |
| Linting | ESLint (flat config) | ^10.0.1 |
| Formatting | Prettier | ^3.8.1 |

## Language-Specific Rules

### ESM & TypeScript

- Project is `"type": "module"` — all imports MUST use `.js` extension even for `.ts` source
  files (e.g. `import { foo } from './foo.js'`, never `'./foo'` or `'./foo.ts'`).
- `tsconfig.json` uses `"moduleResolution": "bundler"` — do NOT use `node16`/`nodenext` semantics.
- `strict: true` is enforced — no implicit `any`, all function params and returns must be typed.
- ESLint rule `@typescript-eslint/no-explicit-any` is set to `error` — never use `any`; use
  `unknown` and narrow it instead.
- ESLint rule `@typescript-eslint/explicit-function-return-type` is set to `warn` — always
  declare return types on exported functions.
- Unused variables/params starting with `_` are allowed (argsIgnorePattern `^_`); prefix
  intentionally unused params with `_`.

### Error Handling

- All custom errors MUST extend `TmrError` (from `src/errors/tmr-error.ts`).
- Every error subclass MUST call `Object.setPrototypeOf(this, SubClass.prototype)` in its
  constructor — required for correct `instanceof` checks across ESM module boundaries.
- Use the error code constants: TMR_E001–TMR_E005 (base), TMR_E101–TMR_E104 (domain).
- Exit code convention: `process.exitCode = 78` (EX_CONFIG) when no API key is configured;
  do NOT use `process.exit()` directly — prefer setting `process.exitCode`.

### Imports & Module Boundaries

- `no-console` ESLint rule is `warn` — NEVER use `console.log/error/warn`; use helpers from
  `src/utils/display.ts` (`printSuccess`, `printError`, `printInfo`, `printWarning`, `printJson`)
  or `src/utils/logger.ts` (winston) for file logging.
- `package.json` `require()` is loaded via `createRequire(import.meta.url)` — do not use
  `require()` elsewhere; use dynamic `import()` for lazy loading instead.

## Architecture & Framework Rules

### Layered CLI Architecture

- Architecture is strictly **Command → Service → Provider**. Commands MUST NOT contain
  business logic; they parse args and delegate to services.
- Services MUST NOT call other services directly for cross-cutting concerns — use dependency
  injection via constructor parameters instead.
- Providers implement the `AIProvider` interface — NEVER call OpenAI/Anthropic/Gemini SDKs
  directly from commands or services; always go through `AIProviderFactory.create()`.
- Valid provider key names: `'openai'` | `'claude'` | `'gemini'`. `'anthropic'` is accepted
  as a legacy alias but MUST NOT be used in new code.

### CLI Output Contract

- All output functions accept a `plain: boolean` parameter — propagate it from global opts
  into every service call; NEVER hardcode `plain = false`.
- Color contract in `src/utils/display.ts` is enforced:
  - `green` → success/confirmation (`printSuccess`)
  - `yellow` → warning (`printWarning`)
  - `blue` → info (`printInfo`)
  - `red` → error (`printError`)
  - `cyan` → ONLY for `tmr init` banner; do not use elsewhere.
- When `--json` flag is set, use `printJson(data)` exclusively — suppress all other output.
- Errors go to `process.stderr`; normal output goes to `process.stdout`.

### Lazy Loading

- Commands that import heavy deps (AI SDKs, inquirer, googleapis, chokidar) MUST be lazy-
  loaded via dynamic `import()` inside the `.action()` callback in `src/cli.ts`.
- Lightweight commands (config, team, member, leadership, project, task-view)
  use static imports and MUST stay that way — do not add heavy deps to them.

### Configuration

- Config lives at `~/.config/tmr/config.json` via the `conf` library (AES-256 encrypted).
- Always use `ConfigService` methods (`getActiveProvider()`, `getWorkspacePath()`, etc.) —
  never read the config store directly.
- `AppConfig.provider` and `AppConfig.apiKey` are deprecated — use `active_provider` and
  `providers[name].api_key_encrypted` in all new code.
- Environment override: `TMR_PROVIDER` → `active_provider`; respect this in any new provider
  resolution logic.

### AI Categorization

- AI categorization system prompt MUST be JSON-only; the response schema is strict (see
  architecture doc). Do not add free-text fields.
- Files with `confidence < threshold` (default 0.75) get `needsReview = true` and are NOT
  moved — never override this safeguard.

## Testing Rules

### Test Organization

- All tests live in `tests/`, never in `src/`. Mirror the source tree:
  - `tests/commands/` → command tests
  - `tests/services/` → service unit + integration tests
  - `tests/providers/` → provider tests
  - `tests/integration/` → full end-to-end integration tests
- Test file naming convention:
  - Unit tests: `<name>.test.ts`
  - Integration tests: `<name>.integration.test.ts`
  - Scalability/perf tests: `<name>.scalability.test.ts`

### Running Tests

- Run with `NODE_OPTIONS=--experimental-vm-modules jest` — required for ESM; the npm script
  handles this, but be aware when running Jest directly.
- `jest.config.ts` maps `.js` imports back to `.ts` source via `moduleNameMapper` —
  do NOT change this mapping.
- Test timeout is 30 000 ms — integration tests using real file I/O can legitimately be slow.

### Mocking Strategy

- Use `MockProvider` (from `src/providers/mock-provider.ts`) for all AI calls in tests —
  never use real API calls in any test.
- Mock `FileSystemService` for unit tests; use real file I/O in a temp dir for integration tests.
- Mock service singletons at the command layer — do not test command + service together in
  unit tests.

### Coverage Thresholds (enforced by Jest)

- Branches: 60%
- Functions: 78%
- Lines: 78%
- Statements: 78%

New code MUST maintain these thresholds — `npm run test:coverage` will fail the pipeline if
they drop below.

### ESM-Specific Test Gotcha

- `src/cli.ts` contains a `JEST_WORKER_ID` environment guard (ARCH-DEBT-003). If migrating
  to Vitest, update this guard to check `VITEST` instead.

## Code Quality & Style Rules

### Prettier (enforced via lint-staged on commit)

- Single quotes (`'`), not double quotes.
- Tab width: 2 spaces.
- Trailing commas: `all` (ES5+, including function params).
- Print width: 100 characters.
- Semicolons: required.
- Arrow function parens: always (e.g. `(x) => x`, not `x => x`).

### ESLint (flat config — `eslint.config.js`)

- Only `src/**/*.ts` is linted — test files are NOT linted by ESLint; keep this boundary.
- `no-console` is `warn` — treat it as an error in practice; use `display.ts` helpers.
- `@typescript-eslint/no-explicit-any` is `error` — zero tolerance.
- `@typescript-eslint/explicit-function-return-type` is `warn` — add return types to all
  exported functions; internal helpers should also have them where non-obvious.
- Run `npm run lint:fix` to auto-fix before committing.

### File & Folder Naming

- Source files: `kebab-case` with role suffix — `*.command.ts`, `*.service.ts`,
  `*.provider.ts`, `*.types.ts`, `*.interface.ts`.
- Test files mirror source names: `config.service.ts` → `config.service.test.ts`.
- No barrel `index.ts` files — import directly from the file that defines the export.

### Code Organization Within Files

- Helpers and private logic go above the exported class/function, separated by a
  `// ── Section Name ──` comment divider (see `display.ts` for the pattern).
- Types live in dedicated `*.types.ts` files — do not define types inline in service or
  command files unless they are purely local.

### Validation Script

- `npm run validate` = lint + typecheck + test + build. Run this before any PR.
  All four steps must pass.

## Critical Don't-Miss Rules

### Anti-Patterns to Avoid

- **DO NOT** add new fields to the AI categorization JSON schema without updating the
  response parser and the strict system prompt — schema drift silently breaks routing.
- **DO NOT** use `chalk` directly in commands or services — always go through `display.ts`
  helpers; direct chalk usage bypasses the `--plain` flag.
- **DO NOT** store API keys in plain text anywhere — `conf` encrypts them at rest; never
  log, print, or serialize a raw API key. Use `redact()` from `src/utils/redact.ts` when
  displaying key values.
- **DO NOT** use `process.exit()` — set `process.exitCode` instead to allow async cleanup
  to complete.
- **DO NOT** import from `dist/` in source or test files — always import from `src/`.
- **DO NOT** add synchronous `require()` calls — use `createRequire(import.meta.url)` only
  for the `package.json` read in `cli.ts`; everything else uses ESM `import`.

### Deprecated Fields (backward compat only)

- `AppConfig.provider` and `AppConfig.apiKey` exist only for Story 1.3 backward
  compatibility. Do NOT use them in new code — use `active_provider` and
  `providers[name].api_key_encrypted`.

### Security Rules

- API keys are AES-256 encrypted via `conf` (key: `tmr-config-v1`) — never bypass this.
- Google Drive OAuth tokens are stored in the same encrypted store — treat them as secrets.
- `src/utils/redact.ts` MUST be used whenever displaying any credential-adjacent value in
  CLI output or logs.

### Build & Distribution

- Only `dist/` is published (`"files": ["dist"]` in `package.json`) — do not add source
  files to the publish set.
- `tsup` produces ESM only with code splitting enabled — do NOT switch to CJS or disable
  splitting; it breaks lazy loading.
- The `#!/usr/bin/env node` shebang is injected by `tsup` banner config — do not add it
  manually to source files.

### Workspace Path Assumptions

- The CLI operates on a user-defined workspace path stored in config — never hardcode
  paths like `~/tech-leadership-workspace`; always resolve via `ConfigService.getWorkspacePath()`.

---

## Shared Utilities — Brownfield State & Rules

### Email Validation

- `EmailResolutionService.validateEmail(email)` **already exists** (`src/services/email-resolution.service.ts` line 25) and returns `boolean`. **DO NOT use it directly in new code.**
- New code MUST use a standalone `validateEmail(email: string): void` utility (to be created in `src/utils/validation.ts`) that **throws `InvalidEmailError` (TMR_E103)** before any file system operation — not just returns false.
- The `EmailResolutionService.resolve()` method also calls `validateEmail` internally; once the utility is extracted, `EmailResolutionService` should delegate to it.
- Never call `EmailResolutionService` solely for validation — it is a resolution service, not a validator.

### Wiki-Link Generation

- **Two legacy implementations exist — neither is the standard going forward:**
  1. `EmailResolutionService.generateWikiLink(email, resolvedPath, fromPath)` — generates relative-path alias format `[[path/to/file|email]]`. Use only when a relative path is semantically required (e.g. project stakeholder links).
  2. `buildWikiLink(email)` — private inline function in `team.service.ts`; generates `- [[../../members/email/email.md|email]]`. Not exported; do not replicate this pattern.
- **Standard for FR33 (entity references in generated Markdown files):** use `formatWikiLink(resolvedPath, fromPath, displayName)` from `src/utils/wiki-link.ts` (to be created in Story 1.3). Returns `[[relative/path/to/file.md|displayName]]` with `/`-normalized separators.
- All new services that write Markdown referencing people, teams, or leaders MUST use `formatWikiLink()` from `src/utils/wiki-link.ts`. Never inline a wiki-link format string.
- `EmailResolutionService.generateWikiLink()` is superseded by this utility — mark it `@deprecated` and do not use in new code.

### Entity Slug Normalization

- **No shared utility exists yet.** Inline `email.toLowerCase()` is scattered across services but no slug normalization utility exists.
- New code MUST use `normalizeSlug(name: string): string` from `src/utils/normalization.ts` (to be created in Story 1.2). It converts to lowercase and replaces spaces/underscores with hyphens: `"Backend Team"` → `"backend-team"`. Idempotent: `"my-team"` → `"my-team"`.
- Every command and service that accepts a team name **or project name** MUST call `normalizeSlug()` before any file system path construction or comparison.

### Relationship Service (Removed — Epic 1 Complete)

- `src/services/relationship.service.ts` and `src/commands/relationship.command.ts` were **deleted in Epic 1 (Story 1.4)**. Do not reference or import these files — they no longer exist.
- `EmailResolutionService._doResolve` step 4 now writes a company-scoped member profile inline (ISSUE-m1 shim). This shim is intentionally temporary — **Story 3.2** must replace it with `MemberService.addMember(email)`.
- All three relationship test files have been deleted (`tests/commands/relationship.command.test.ts`, `tests/services/relationship.service.test.ts`, `tests/integration/relationship.integration.test.ts`).

---

## Usage Guidelines

**For AI Agents:**

- Read this file before implementing any code in this project.
- Follow ALL rules exactly as documented — especially ESM import extensions, error subclassing,
  display helper usage, and the `--plain`/`--json` output contract.
- When in doubt, prefer the more restrictive option.
- Update this file if new patterns emerge during implementation.

**For Humans:**

- Keep this file lean and focused on agent needs — remove rules that become obvious over time.
- Update when the technology stack, architecture, or conventions change.
- Review quarterly for outdated rules.

_Last Updated: 2026-04-27 (added Shared Utilities — Brownfield State & Rules section)_
