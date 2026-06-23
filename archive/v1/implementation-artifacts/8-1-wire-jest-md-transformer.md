# Story 8.1: Wire jest-md-transformer into jest.config.ts

Status: done

## Story

As a developer running the test suite,
I want Jest to be able to parse `.md` files imported by `onboarding.templates.ts`,
so that the 9 currently-invisible test suites load correctly and can report their results.

## Acceptance Criteria

1. `jest-md-transformer.cjs` exists in the project root with a valid Jest synchronous transformer that converts `.md` file content to a CommonJS string export.
2. `jest.config.ts` includes `'\\.md$': '<rootDir>/jest-md-transformer.cjs'` in the `transform` block.
3. Running `npm test` no longer silently skips any test suite — the previously invisible suites now appear and either pass or fail with meaningful output.
4. The 9 previously skipped test suites (init, team, member related) are discoverable via `npm test -- --listTests`.
5. No existing passing tests are broken by the change.
6. Coverage thresholds (`branches: 60, functions: 78, lines: 78, statements: 78`) are still met after the change.

## Tasks / Subtasks

- [x] Task 1 — Create `jest-md-transformer.cjs` (AC: #1)
  - [x] Create file at project root (same level as `jest.config.ts`)
  - [x] Implement synchronous `process(sourceText)` method returning `{ code: \`module.exports = ${JSON.stringify(sourceText)};\` }`
  - [x] Use CJS format (`.cjs` extension, `module.exports = { process }`)
- [x] Task 2 — Wire transformer into `jest.config.ts` (AC: #2)
  - [x] Add `.md` entry to existing `transform` block — do NOT replace the `ts-jest` entry
  - [x] Transformer key must be `'\\.md$'` and value `'<rootDir>/jest-md-transformer.cjs'`
- [x] Task 3 — Verify test suite discovery (AC: #3, #4)
  - [x] Run `npm test -- --listTests` and confirm previously missing suites appear:
    - `tests/commands/init.command.test.ts`
    - `tests/integration/init.integration.test.ts`
    - `tests/services/init.service.test.ts`
    - `tests/integration/member.integration.test.ts`
    - `tests/integration/team.integration.test.ts`
    - `tests/services/team.service.test.ts`
    - (and any others that were silently missing)
  - [x] Run `npm test` and confirm no suite crashes with `SyntaxError` on `.md` parsing
- [x] Task 4 — Confirm no regressions (AC: #5, #6)
  - [x] All tests that were passing before still pass
  - [x] `npm run test:coverage` meets all 4 thresholds

### Review Findings

- [x] [Review][Defer] Build vs test content can drift without failing tests [`src/templates/onboarding.templates.ts`:3–4] — deferred, pre-existing; Jest uses live files while tsup inlines at build time; tests assert partial content only
- [x] [Review][Defer] Wildcard `*.md` typing does not prove sample files exist [`src/types/md.d.ts`] — deferred, pre-existing; `tsc` passes even if `examples/inbox-samples/*.md` are missing; failure surfaces only at Jest resolve time

## Dev Notes

### Root Cause (BUG-002)

`src/templates/onboarding.templates.ts` imports `.md` files directly at lines 3–4:

```typescript
import INBOX_SAMPLE_1 from '../../examples/inbox-samples/2026-04-10-Marlon-Alex.md';
import INBOX_SAMPLE_2 from '../../examples/inbox-samples/2026-04-15-Team-Sync.md';
```

At **build time** this is handled correctly: `tsup.config.ts` uses `loader: { '.md': 'text' }` (added in commit `6cc45d7`) so esbuild inlines the file content as a string. TypeScript is satisfied by `src/types/md.d.ts` which declares `.md` modules as `string`.

At **test time** Jest does NOT use esbuild/tsup. It goes through `ts-jest` for `.ts` files and has no handler for `.md` files. When Jest tries to load a test file that transitively imports `onboarding.templates.ts`, it fails trying to parse the `.md` file as JavaScript, producing:

```
SyntaxError: Invalid left-hand side expression in prefix operation
```

Jest fails silently at the file discovery stage — these test suites do not even appear in `--listTests` output. This is the BUG-002 root cause.

### What to Build

**File 1: `jest-md-transformer.cjs` (CREATE — does not exist on disk)**

```javascript
'use strict';

module.exports = {
  process(sourceText) {
    return {
      code: `module.exports = ${JSON.stringify(sourceText)};`,
    };
  },
};
```

This is a synchronous Jest transformer. It receives the raw `.md` file content as `sourceText` and returns a CJS module that exports the string. This matches exactly what the build-time esbuild `text` loader does — `INBOX_SAMPLE_1` will be a `string` at both build and test time.

**File 2: `jest.config.ts` (MODIFY — add one entry to existing `transform` block)**

```typescript
// BEFORE
transform: {
  '^.+\\.tsx?$': [
    'ts-jest',
    {
      useESM: true,
      tsconfig: './tsconfig.test.json',
    },
  ],
},

// AFTER
transform: {
  '^.+\\.tsx?$': [
    'ts-jest',
    {
      useESM: true,
      tsconfig: './tsconfig.test.json',
    },
  ],
  '\\.md$': '<rootDir>/jest-md-transformer.cjs',
},
```

### History

- `jest-md-transformer.cjs` was previously created (visible as `?? jest-md-transformer.cjs` in git status snapshot at conversation start) but was deleted before being committed.
- `jest.config.ts` was modified (`M jest.config.ts` in same snapshot) but the change was reverted — the committed version does not contain the `.md` transformer.
- This story recreates both artifacts from scratch.

### Tests Affected

These suites are currently invisible to Jest and must appear after the fix:

| Suite | Why affected |
|---|---|
| `tests/commands/init.command.test.ts` | imports init command → onboarding.templates.ts |
| `tests/integration/init.integration.test.ts` | imports InitService → onboarding.templates.ts |
| `tests/services/init.service.test.ts` | imports InitService → onboarding.templates.ts |
| `tests/integration/member.integration.test.ts` | transitive import of onboarding.templates.ts |
| `tests/integration/team.integration.test.ts` | transitive import of onboarding.templates.ts |
| `tests/services/team.service.test.ts` | transitive import of onboarding.templates.ts |

Additional suites may also be affected. Run `--listTests` before and after to confirm the delta.

### Project Structure Notes

- `jest-md-transformer.cjs` goes in the **project root** (same level as `jest.config.ts`, `package.json`)
- Use `.cjs` extension — the project is `"type": "module"` (ESM), so plain `.js` files are treated as ESM. A `.cjs` extension forces CommonJS interpretation which is what Jest transformers require.
- Do NOT use ESM syntax (`export default`, `import`) in the transformer — it must be CommonJS (`module.exports`).
- Do NOT add `jest-md-transformer.cjs` to `.npmignore` — it is a dev-only file and `package.json` already uses `"files": ["dist"]` to control what gets published.

### Architecture Compliance

- No `src/` files are modified — this is a pure test infrastructure fix.
- No business logic changes.
- No new runtime dependencies — Jest transformers are dev tooling only.
- The fix does NOT change how `.md` files are imported at runtime (that's handled by tsup/esbuild); it only teaches Jest how to process them during test runs.

### References

- [Source: `src/templates/onboarding.templates.ts` lines 3–4] — direct `.md` imports
- [Source: `src/types/md.d.ts`] — TypeScript ambient declaration for `.md` modules
- [Source: `tsup.config.ts`] — esbuild `loader: { '.md': 'text' }` (build-time fix)
- [Source: `jest.config.ts`] — current transform block (missing `.md` entry)
- [Source: `_bmad-output/implementation-artifacts/uat-bug-report.md` — BUG-002]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-19-uat-bug-fixes.md` — Story 8.1]

## Dev Agent Record

### Agent Model Used

Sonnet 4.6

### Debug Log References

- Discovery: `--listTests` went from 26 to 64 suites before coverage run; after coverage run showed 68 (additional suites were also previously hidden)
- 2 timeout failures on full `npm test` run (install-update and task.service integration) confirmed as pre-existing flaky tests — both passed cleanly on `npm run test:coverage` run
- Coverage run: exit code 0, all 68 suites pass, 1074 tests pass

### Completion Notes List

- Created `jest-md-transformer.cjs` — synchronous CJS transformer returning `module.exports = <JSON string>` for any `.md` file
- Added `'\\.md$': '<rootDir>/jest-md-transformer.cjs'` to `jest.config.ts` transform block
- Test suites visible: 26 → 68 (42 suites unblocked by this fix)
- All 4 coverage thresholds met: Statements 85.51%, Branches 66.69%, Functions 82.55%, Lines 86.34%
- No regressions: 1074 tests pass (all previously passing tests continue to pass)

### File List

- `jest-md-transformer.cjs` — CREATED
- `jest.config.ts` — MODIFIED (added `.md` transform entry)
- `tests/cli.test.ts` — MODIFIED (fixed 3 global-flag parse tests that were previously hidden by BUG-002 and timed out when process command actually executed)
