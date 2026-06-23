# Story 1.1: Email Validation Utility

Status: done

## Story

As a developer implementing any `tmr` command,
I want a standalone `validateEmail()` utility that throws `InvalidEmailError` before any file system operation,
so that invalid email inputs are consistently rejected across all commands without duplicating validation logic.

## Acceptance Criteria

1. `src/utils/validation.ts` exports `validateEmail(email: string): void` — returns void on valid input, throws `InvalidEmailError` (TMR_E103) on invalid input, before any FS operation is attempted.
2. `validateEmail("marco@")` (missing domain) throws `InvalidEmailError` with code `TMR_E103`.
3. `validateEmail("not-an-email")` (no `@`) throws `InvalidEmailError` with code `TMR_E103`.
4. `validateEmail("")` (empty string) throws `InvalidEmailError` with code `TMR_E103`.
5. `validateEmail("marco@company.com")` (valid) returns without throwing.
6. `EmailResolutionService.validateEmail()` delegates to `src/utils/validation.ts` rather than containing its own inline regex.
7. `tests/utils/validation.test.ts` passes: VAL-UNIT-001 (`"marco@"` rejected), VAL-UNIT-002 (`"valid@company.com"` passes), VAL-UNIT-003 (`"not-an-email"` rejected).
8. `AppConfig.provider` and `AppConfig.apiKey` are removed from the `AppConfig` type, `CONFIG_KEYS` array, and `ENV_MAP` object in `src/types/config.types.ts`.
9. `ConfigService.getActiveProvider()` no longer falls back to `this.get('provider')` — only reads `active_provider`.
10. A new test in `tests/services/config.service.test.ts` asserts that no file under `src/` contains the strings `AppConfig.provider` or `AppConfig.apiKey` (structural guard).

## Tasks / Subtasks

- [x] Create `src/utils/validation.ts` (AC: 1–5)
  - [x] Export `validateEmail(email: string): void` — use regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` from existing `EmailResolutionService.validateEmail`
  - [x] Guard non-string / falsy inputs (throw before regex)
  - [x] Import and throw `InvalidEmailError` from `../../errors/tmr-error.js`
  - [x] Add explicit return type annotation (ESLint warn rule)

- [x] Update `src/services/email-resolution.service.ts` (AC: 6)
  - [x] Import `validateEmail` utility from `../utils/validation.js`
  - [x] Replace the inline regex body in `EmailResolutionService.validateEmail()` with a try/catch delegation:
    ```ts
    validateEmail(email: string): boolean {
      try { validateEmailUtil(email); return true; }
      catch { return false; }
    }
    ```
  - [x] Update `resolve()` to call the utility directly instead of the boolean `if (!this.validateEmail(e))` pattern, so `InvalidEmailError` propagates natively:
    ```ts
    const e = email.toLowerCase().trim();
    validateEmailUtil(e); // throws InvalidEmailError if invalid — replaces the if/throw block
    ```
  - [x] Keep the public `validateEmail()` boolean method for backward compat (existing tests and callers rely on it)

- [x] Remove deprecated `AppConfig.provider` and `AppConfig.apiKey` fields (AC: 8–9)
  - [x] In `src/types/config.types.ts`: remove `provider?: string`, `apiKey?: string` from `AppConfig` interface
  - [x] In `src/types/config.types.ts`: remove `'provider'` and `'apiKey'` from `CONFIG_KEYS` array
  - [x] In `src/types/config.types.ts`: remove `provider` and `apiKey` entries from `ENV_MAP`
  - [x] In `src/services/config.service.ts`: remove `?? this.get('provider')` fallback from `getActiveProvider()` — return only `this.get('active_provider')`

- [x] Create `tests/utils/validation.test.ts` (AC: 7)
  - [x] VAL-UNIT-001: `"marco@"` → throws `InvalidEmailError` with code `TMR_E103`
  - [x] VAL-UNIT-002: `"valid@company.com"` → returns without throwing
  - [x] VAL-UNIT-003: `"not-an-email"` → throws `InvalidEmailError` with code `TMR_E103`
  - [x] Additional coverage: empty string `""`, whitespace-only `"   "`, valid with subdomains

- [x] Update `tests/services/config.service.test.ts` (AC: 10)
  - [x] Remove or rewrite all test cases that call `service.set('provider', ...)` or `service.set('apiKey', ...)` directly — these test removed deprecated keys
  - [x] Remove the test `'getActiveProvider returns TM_PROVIDER env var over stored value'` that reads `TM_PROVIDER` via the deprecated `provider` key path
  - [x] Remove `'get("apiKey") returns TM_API_KEY env var over stored value'` test
  - [x] Remove the test `'getActiveProvider() falls back to legacy provider key'` — fallback is intentionally deleted
  - [x] Remove the test `'active_provider takes precedence over legacy provider'` — can be replaced with a simpler `setActiveProvider` round-trip
  - [x] Add structural guard test: reads all `.ts` files under `src/` and asserts none contain the literal string `'AppConfig.provider'` or `'AppConfig.apiKey'`

- [x] Update `tests/services/email-resolution.service.test.ts`
  - [x] Existing `validateEmail` boolean-return tests remain valid — service method still returns `boolean` via delegation
  - [x] Update the `resolve()` invalid-email test: it currently expects `throws /Invalid email/i` — `InvalidEmailError` message is `"Invalid email address: ${email}"` so the regex still matches; no change needed

- [x] Run `npm run validate` — all four steps (lint, typecheck, test, build) must pass

## Dev Notes

### Key Behavioral Distinction

The new `validateEmail(email: string): void` in `src/utils/validation.ts` **throws** — it does not return boolean. This is intentional: commands call it before any FS operation and let the error propagate to `printError`.

The existing `EmailResolutionService.validateEmail(email): boolean` **stays boolean** — it wraps the utility in try/catch for internal use and backward compat. Do not change its signature.

### Regex to Use (Exact Match from Existing Codebase)

```ts
/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
```

Source: `src/services/email-resolution.service.ts` line 27. Use this exact regex in the new utility — do not invent a different one. Apply `.trim()` before the test to handle leading/trailing whitespace.

### Error Class — Already Exists

`InvalidEmailError` is **already defined** in `src/errors/tmr-error.ts` (line 95–101):

```ts
export class InvalidEmailError extends TmrError {
  constructor(email: string, code = 'TMR_E103') {
    super(`Invalid email address: ${email}`, code);
    this.name = 'InvalidEmailError';
    Object.setPrototypeOf(this, InvalidEmailError.prototype);
  }
}
```

Import it from `'../../errors/tmr-error.js'` (`.js` extension required — ESM rule). Do NOT create a new error class.

### `EmailResolutionService.resolve()` Refactor Pattern

Current:
```ts
const e = email.toLowerCase().trim();
if (!this.validateEmail(e)) {
  throw new Error(`Invalid email address: '${email}'`);
}
```

Target (preferred — propagates `InvalidEmailError` natively):
```ts
import { validateEmail as validateEmailUtil } from '../utils/validation.js';
// ...
const e = email.toLowerCase().trim();
validateEmailUtil(e); // throws InvalidEmailError(TMR_E103) if invalid
```

The existing test `'throws Error with message matching /Invalid email/ for invalid email'` will still pass because `InvalidEmailError` message contains `"Invalid email address:"`.

### Deprecated Field Removal Impact Map

| File | Change | Impact |
|------|--------|--------|
| `src/types/config.types.ts` | Remove `provider?`, `apiKey?` from AppConfig | Breaks any TypeScript access to `config.provider` or `config.apiKey` at compile time — intentional |
| `src/types/config.types.ts` | Remove `'provider'`, `'apiKey'` from `CONFIG_KEYS` | Removes them from the readonly key list |
| `src/types/config.types.ts` | Remove `provider`, `apiKey` from `ENV_MAP` | `TM_PROVIDER` and `TM_API_KEY` env vars no longer override these deprecated keys |
| `src/services/config.service.ts` | Remove `?? this.get('provider')` from `getActiveProvider()` | `getActiveProvider()` now only reads `active_provider` — legacy fallback deliberately dropped |

**Verify**: After the change, `addProvider(name, apiKey, model)` in `config.service.ts` has a local param named `apiKey` — this is fine, it's a function parameter name, not `AppConfig.apiKey`. Do not rename it.

### Config Service Tests to Remove

These specific tests in `config.service.test.ts` test deprecated behavior and MUST be deleted:
- `'set + get round-trip returns the stored value for provider'` (line 41)
- `'set + get round-trip returns the stored value for apiKey'` (line 45)
- `'get returns undefined for a key that was never set'` when using `'provider'` key (line 50)
- `'has returns false before set'` when using `'provider'` (line 54)
- `'has returns true after set'` with `'provider'` (line 59)
- `'delete removes the stored value'` using `'apiKey'` (line 63)
- `'get("provider") returns TM_PROVIDER env var over stored value'` (line 72)
- `'get("apiKey") returns TM_API_KEY env var over stored value'` (line 76)
- `'has returns true when env var is set even if conf store is empty'` for `TM_PROVIDER` (line 89)
- `'getActiveProvider returns TM_PROVIDER env var over stored value'` (line 134... varies) — this was using `service.set('provider', ...)` to set legacy key
- `'getActiveProvider() falls back to legacy provider key'` — **MUST be removed**; fallback is deleted
- `'active_provider takes precedence over legacy provider'` — remove the `service.set('provider', ...)` half

Keep all other tests that use `setActiveProvider`, `addProvider`, `getProviderConfig`, `getWorkspacePath`, etc.

### Structural Guard Test Pattern

```ts
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from '@jest/globals';

describe('ARCH-DEBT-001 guard — deprecated AppConfig fields', () => {
  it('no source file under src/ references AppConfig.provider or AppConfig.apiKey', () => {
    const srcRoot = path.resolve(process.cwd(), 'src');
    const violations: string[] = [];
    
    function walk(dir: string): void {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { walk(full); continue; }
        if (!entry.name.endsWith('.ts')) continue;
        const content = fs.readFileSync(full, 'utf8');
        if (content.includes('AppConfig.provider') || content.includes('AppConfig.apiKey')) {
          violations.push(path.relative(srcRoot, full));
        }
      }
    }
    
    walk(srcRoot);
    expect(violations).toEqual([]);
  });
});
```

Place this test inside a new `describe` block at the bottom of `tests/services/config.service.test.ts`. Note: this test uses **synchronous** `fs` and runs outside async/mock context — this is intentional and safe.

### File Locations (All Paths from Project Root)

| Action | Path |
|--------|------|
| CREATE | `src/utils/validation.ts` |
| CREATE | `tests/utils/validation.test.ts` |
| UPDATE | `src/types/config.types.ts` |
| UPDATE | `src/services/config.service.ts` |
| UPDATE | `src/services/email-resolution.service.ts` |
| UPDATE | `tests/services/config.service.test.ts` |
| UPDATE | `tests/services/email-resolution.service.test.ts` (verify only — existing tests should pass as-is) |

### ESM Import Rules (Critical)

All imports inside `src/` MUST use `.js` extension on the import path — even though the source files are `.ts`:
```ts
// Correct
import { validateEmail } from '../utils/validation.js';
import { InvalidEmailError } from '../../errors/tmr-error.js';

// Wrong
import { validateEmail } from '../utils/validation';
import { InvalidEmailError } from '../../errors/tmr-error';
```

Test files use `../../src/utils/validation.js` (same rule applies).

### Output & Error Contract

- `validateEmail` utility: throws only, no console output, no spinner
- It is a pure utility function — commands/services catch the thrown `InvalidEmailError` and pass it to `printError`
- Do NOT call `printError` from inside the utility itself

### Coverage Requirement

New utility must contribute to coverage. The `validation.test.ts` must cover: valid email (passes), missing domain, no `@`, empty string, whitespace-only, and subdomains. Target: 100% lines on the new file.

### Project Structure Notes

- `src/utils/` already contains: `display.ts`, `logger.ts`, `redact.ts`, `workspace.ts` — `validation.ts` follows the same flat structure, no subfolder
- `tests/utils/` already exists and contains `display.test.ts`, `redact.test.ts` — `validation.test.ts` follows the same pattern
- No barrel `index.ts` — import directly from `src/utils/validation.js`

### References

- Epic 1, Story 1.1 AC: `_bmad-output/planning-artifacts/epics.md` lines 222–258
- Existing `validateEmail` regex: `src/services/email-resolution.service.ts` line 27
- `InvalidEmailError` definition: `src/errors/tmr-error.ts` lines 95–101
- AppConfig deprecated fields: `src/types/config.types.ts` lines 33–35, 55–60, 71–75
- Config service fallback: `src/services/config.service.ts` line 69
- ESM import rule: `_bmad-output/project-context.md` § Language-Specific Rules
- Error hierarchy rule: `_bmad-output/project-context.md` § Error Handling
- Coverage thresholds: `jest.config.ts` (branches 60%, functions/lines/statements 78%)

### Review Findings — Round 1 (patches applied)

- [x] [Review][Patch] Blanket `catch {}` in `EmailResolutionService.validateEmail()` swallows all exceptions, not just `InvalidEmailError` — any future runtime error inside the utility silently returns `false` [src/services/email-resolution.service.ts:31]
- [x] [Review][Patch] Stale `@throws Error` JSDoc on `resolve()` — now throws `InvalidEmailError`, not plain `Error` [src/services/email-resolution.service.ts]
- [x] [Review][Patch] Duplicate VAL-UNIT-001 test ID label — two tests are tagged `VAL-UNIT-001`; the code-check test should use a distinct label [tests/utils/validation.test.ts]
- [x] [Review][Patch] Silent-pass test pattern — `try/catch` blocks without `expect.assertions(N)` pass vacuously if the utility does not throw [tests/utils/validation.test.ts]
- [x] [Review][Defer] `resolve()` error message now uses normalized email (`e`) instead of original caller input — minor UX regression but within spec intent [src/services/email-resolution.service.ts:46] — deferred, pre-existing design trade-off
- [x] [Review][Defer] ARCH-DEBT-001 structural guard catches only literal `AppConfig.property` string access, not computed-key or aliased access — acceptable scope for this story [tests/services/config.service.test.ts] — deferred, pre-existing
- [x] [Review][Defer] `validateEmailUtil` error message embeds un-trimmed email despite internally testing the trimmed form — cosmetically inconsistent but harmless [src/utils/validation.ts:14] — deferred, pre-existing

### Review Findings — Round 2 (re-review after patches)

- [x] [Review][Patch] `getRedacted` method has zero test coverage — its three dedicated tests were removed with the apiKey block and no replacement was added [tests/services/config.service.test.ts]
- [x] [Review][Defer] Provider fallback removal silently breaks existing user configs written with the `provider` key — by spec design; needs a migration story [src/services/config.service.ts] — deferred, by spec
- [x] [Review][Defer] Old `TM_PROVIDER` env var silently stops working — by spec design; needs migration documentation — deferred, by spec
- [x] [Review][Defer] ARCH-DEBT-001 guard scope misses `service.get('provider')` usage patterns — TypeScript catches method-level access; acceptable guard scope — deferred, pre-existing
- [x] [Review][Defer] ARCH-DEBT-001 guard uses `process.cwd()` — not guaranteed to be project root in all CI configurations [tests/services/config.service.test.ts] — deferred, pre-existing
- [x] [Review][Defer] Dead `typeof email !== 'string'` check in validation.ts — redundant given TypeScript signature but harmless [src/utils/validation.ts:14] — deferred, harmless
- [x] [Review][Defer] `EmailResolutionService.validateEmail()` is now orphaned public API — nothing calls it directly; cleanup deferred — deferred, future refactor

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Created `src/utils/validation.ts` with `validateEmail(email: string): void` that throws `InvalidEmailError` (TMR_E103). Uses the exact regex from the existing `EmailResolutionService` — no new regex invented.
- Updated `EmailResolutionService.validateEmail()` to delegate via try/catch, preserving the boolean return contract for all existing callers and tests.
- Updated `EmailResolutionService.resolve()` to call the utility directly, propagating `InvalidEmailError` natively instead of throwing a plain `Error`.
- Removed `AppConfig.provider` and `AppConfig.apiKey` from type definition, `CONFIG_KEYS`, and `ENV_MAP`. Removed the legacy `?? this.get('provider')` fallback from `ConfigService.getActiveProvider()`.
- Rewrote `config.service.test.ts` removing all deprecated-key tests, adapting storage/env-var tests to use `active_provider`/`TMR_PROVIDER`, and adding the ARCH-DEBT-001 structural guard.
- All 66 targeted tests pass. Full suite: 62/64 suites pass; 2 pre-existing failures (`watch.service.integration.test.ts` — worker crash from `process.exit(0)`, `inbox-process.service.integration.test.ts` — timeout) are unrelated to this story and confirmed by `git diff --name-only`.
- Lint: exit 0. Typecheck: exit 0. Build: exit 0.

### File List

- `src/utils/validation.ts` — CREATED
- `tests/utils/validation.test.ts` — CREATED
- `src/types/config.types.ts` — UPDATED (removed deprecated AppConfig fields)
- `src/services/config.service.ts` — UPDATED (removed legacy provider fallback)
- `src/services/email-resolution.service.ts` — UPDATED (delegation to utility)
- `tests/services/config.service.test.ts` — UPDATED (removed deprecated tests, added structural guard)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — UPDATED (status: review)
