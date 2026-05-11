# Story 5.1: CONTRIBUTING.md for Open Source Contributors

Status: done

## Story

As an external developer who wants to contribute to `tech-manager-os`,
I want a `CONTRIBUTING.md` in the repository root that covers everything I need to set up, build, test, and submit changes,
So that I can contribute code, documentation, or skills without asking the maintainer for guidance.

## Acceptance Criteria

1. `CONTRIBUTING.md` is created at the repository root (FR34).
2. The development setup section enables a contributor to install dependencies, build the project (`npm run validate`), and run tests without additional guidance.
3. The conventions section explicitly documents: ESM `.js` import extensions, use of `display.ts` helpers (no `console.log`), `strict: true` TypeScript rules, and the `no-explicit-any` zero-tolerance rule.
4. The testing section documents: `NODE_OPTIONS=--experimental-vm-modules jest` requirement, coverage thresholds (78% lines/functions/statements, 60% branches), and `MockProvider` usage for AI calls.
5. The PR process section documents: branching strategy (`story/N.N-slug`), `npm run validate` as the pre-PR gate, and PR description expectations (via `.github/pull_request_template.md`).
6. The skills section documents: official skill registry structure (`skills/<name>/SKILL.md` + `index.json`), `SKILL.md` format requirements (version comment header), and the submission process for community skills.

## Tasks / Subtasks

- [x] Create `CONTRIBUTING.md` at repository root (AC: 1–6)
  - [x] Add Development Setup section — prerequisites, clone, install, validate (AC: 2)
  - [x] Add Coding Conventions section — ESM imports, display helpers, TypeScript strict rules (AC: 3)
  - [x] Add Testing section — running tests, coverage thresholds, MockProvider pattern (AC: 4)
  - [x] Add PR Process section — branch naming, validate gate, PR template reference (AC: 5)
  - [x] Add Skill Submission section — registry structure, SKILL.md format, submission flow (AC: 6)

---

## Dev Notes

### What This Story Produces

A single new file: `CONTRIBUTING.md` in the repository root. No source code changes, no new tests beyond verifying the file exists and satisfies all ACs by inspection.

### Repository Root Context

**Already exists at root level:**
- `README.md` — user-facing quick start and CLI reference
- `CHANGELOG.md` — version history
- `SECURITY.md` — security policy
- `.github/pull_request_template.md` — PR checklist template (reference this in the PR Process section)
- `.github/workflows/` — CI/CD pipelines

**Does NOT yet exist:**
- `CONTRIBUTING.md` — this story creates it

### Key Facts for Each Section

#### Development Setup (AC: 2)
- **Prerequisites**: Node.js ≥18.0.0 (engine constraint in `package.json`), npm
- **Clone**: `git clone https://github.com/marlonvidal/tech-manager-os.git`
- **Install**: `npm install`
- **Validate** (full gate): `npm run validate` → runs lint + typecheck + test + build
- **Individual scripts**:
  - `npm run build` — tsup ESM build
  - `npm test` — Jest (uses `NODE_OPTIONS=--experimental-vm-modules`)
  - `npm run test:coverage` — Jest with coverage report
  - `npm run lint` — ESLint on `src/`
  - `npm run lint:fix` — auto-fix linting issues
  - `npm run format` — Prettier on `src/`
  - `npm run typecheck` — `tsc --noEmit`

#### Coding Conventions (AC: 3)
- **ESM imports**: Project is `"type": "module"`. All imports MUST use `.js` extension even for `.ts` source files. E.g. `import { foo } from './foo.js'`, never `'./foo'` or `'./foo.ts'`.
- **Output helpers**: `no-console` ESLint rule is enforced. NEVER use `console.log/error/warn`. Use helpers from `src/utils/display.ts`: `printSuccess`, `printError`, `printInfo`, `printWarning`, `printJson`. Use `src/utils/logger.ts` (winston) for file logging.
- **TypeScript strict**: `strict: true` in tsconfig. No implicit `any`, all function params and returns must be typed. `@typescript-eslint/no-explicit-any` is `error` — use `unknown` and narrow it.
- **Return types**: `@typescript-eslint/explicit-function-return-type` is `warn` — always declare return types on exported functions.
- **File naming**: `kebab-case` with role suffix: `*.command.ts`, `*.service.ts`, `*.provider.ts`, `*.types.ts`. No barrel `index.ts` files.
- **Code organization**: Helpers above exports, `// ── Section Name ──` comment dividers. Types in `*.types.ts`.
- **Error handling**: All custom errors extend `TmrError`. Never use `process.exit()` — set `process.exitCode`.
- **Prettier**: single quotes, 2-space indent, trailing commas (`all`), print width 100, semicolons required, arrow parens always.

#### Testing (AC: 4)
- **Runner**: `NODE_OPTIONS=--experimental-vm-modules jest` — required for ESM module mocking. The npm scripts handle this automatically.
- **Coverage thresholds** (enforced by Jest):
  - Branches: 60%
  - Functions: 78%
  - Lines: 78%
  - Statements: 78%
- **MockProvider**: Use `MockProvider` from `src/providers/mock-provider.ts` for ALL AI calls in tests. Never use real API calls.
- **Mocking strategy**: `jest.unstable_mockModule` for ESM module mocking (see `tests/commands/install.command.test.ts` for example). Mock `FileSystemService` in unit tests; use real tmp-dir I/O in integration tests.
- **Test structure**:
  - `tests/commands/` → command-layer tests (mock services)
  - `tests/services/` → service unit and integration tests
  - `tests/integration/` → full end-to-end tests with real fs + mocked network
- **Naming**: `<name>.test.ts` for unit, `<name>.integration.test.ts` for integration.
- **Timeout**: 30 000 ms — integration tests can be slow; this is expected.

#### PR Process (AC: 5)
- **Branch naming**: `story/N.N-slug` (e.g. `story/4.1-skill-registry-integration`)
- **Pre-PR gate**: `npm run validate` must exit 0. All four steps (lint, typecheck, test, build) must pass.
- **PR template**: `.github/pull_request_template.md` — fill it in completely; the checklist is not optional.
- **No committing**: `dist/` and `node_modules/` — both are gitignored and must never be committed.

#### Skill Submission (AC: 6)
- **Registry location**: `skills/` directory at repo root, hosted at `https://raw.githubusercontent.com/marlonvidal/tech-manager-os/main/skills`
- **Registry index**: `skills/index.json` — a JSON array of skill name strings (e.g. `["tmr-inbox", "tmr-daily"]`). Must be updated when adding a new skill.
- **Skill structure**: Each skill lives at `skills/<name>/SKILL.md`. Example: `skills/tmr-inbox/SKILL.md`
- **SKILL.md format requirements**:
  - Must start with a version comment: `<!-- version: 1.0.0 -->`
  - Must be self-contained markdown that Claude Code can read and follow
  - Skill name must be kebab-case, prefixed with `tmr-` for official skills
- **Submission flow**: Fork → add skill at `skills/<name>/SKILL.md` → add name to `skills/index.json` → open PR with description of what the skill does and tested usage examples

### Skill Registry at a Glance

```
skills/
├── index.json            ← ["tmr-inbox", "tmr-daily", ...]
└── tmr-inbox/
    └── SKILL.md          ← <!-- version: 1.0.0 --> ...
```

### Previous Story Intelligence (Story 4.1)
- Story 4.1 implemented `tmr install` / `tmr install <name>` — the install mechanism that fetches skills from the registry described in the skills section
- Registry URL: `https://raw.githubusercontent.com/marlonvidal/tech-manager-os/main/skills`
- Skills are fetched from `skills/<name>/SKILL.md` at the registry root
- The `index.json` format is `["tmr-inbox", "tmr-daily"]` (confirmed from `fetchSkillList` implementation)

### Recent Git Commits
- `6dfa682` — Implement `tmr install` skill registry integration (Story 4.1)
- `2798d19` — Merge PR #53: Story 3.3 Global Email Resolver
- `22fb672` — Add global email resolver and auto-create (Story 3.3)
- `ce962e4` — Merge PR #52: Story 3.2 Member Routing
- `306447b` — Add company/team-scoped member routing (Story 3.2)

### What MUST NOT Change
- No changes to any `src/` files — this is a documentation-only story
- No changes to any `tests/` files
- No changes to `package.json`, `README.md`, `CHANGELOG.md`, or `SECURITY.md`

---

## Dev Agent Record

### Agent Model
claude-sonnet-4-6 (Cursor)

### Debug Log
- Documentation-only story: no source code changes, no test changes required
- Confirmed `CONTRIBUTING.md` did not exist prior to this story (only `README.md`, `CHANGELOG.md`, `SECURITY.md` at root)
- Verified skill registry structure from `skills/tmr-inbox/SKILL.md` and `src/services/skill-registry.service.ts` (`REGISTRY_BASE_URL`, `fetchSkillList`, `getRegistryIndexUrl`)
- Confirmed all npm scripts from `package.json` (`validate`, `test`, `test:coverage`, `lint`, `lint:fix`, `format`, `typecheck`, `build`)
- Confirmed coverage thresholds from `jest.config.ts` (branches: 60, functions/lines/statements: 78)
- Confirmed PR template location from `.github/pull_request_template.md`
- `npm run validate` passes: 66 suites, 982 tests, lint + typecheck + build all clean

### Completion Notes
- Created `CONTRIBUTING.md` at repository root with 5 sections covering all 6 ACs
- Development Setup: Node ≥18, clone, npm install, npm run validate, full scripts table
- Coding Conventions: ESM `.js` extensions with correct/wrong examples, `display.ts` helpers table, `strict`/`no-explicit-any` rules with examples, error handling (`process.exitCode` vs `process.exit`), Prettier config, file naming
- Testing: `NODE_OPTIONS=--experimental-vm-modules` note, coverage thresholds table, `MockProvider` usage, `jest.unstable_mockModule` example, test directory structure
- PR Process: `story/N.N-slug` branch naming with examples, 4-point pre-PR checklist, PR template reference
- Skill Submission: full registry structure diagram, `SKILL.md` format requirements (version comment, self-contained, naming), 5-step submission process

---

## File List

- `CONTRIBUTING.md` — created at repository root

---

## Change Log

- 2026-05-11: Implemented Story 5.1 — created `CONTRIBUTING.md` with development setup, coding conventions, testing, PR process, and skill submission sections; `npm run validate` passes with 982 tests
