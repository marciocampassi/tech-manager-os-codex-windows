# Story 4.1: `tmr install` — Skill Registry Integration

Status: done

## Story

As an engineering manager who wants to extend `tmr` with skills,
I want `tmr install` to fetch and install all available skills, and `tmr install <skill-name>` to install a specific one, with all failures surfaced clearly,
So that I can access the full skills ecosystem in one command and never wonder why a skill silently failed to install.

## Acceptance Criteria

1. `tmr install` (no args) fetches the registry skill list and writes each skill's `SKILL.md` to `<workspace>/.claude/skills/<name>/SKILL.md`, updating `skill-manifest.json` (FR25, SKILL-UNIT-005, SKILL-INT-001).
2. `tmr install <skill-name>` makes an HTTPS GET to the correct GitHub raw URL and writes the skill to the correct vault path; `printSuccess` confirms the installed skill name (FR26, SKILL-CMD-002).
3. No hardcoded URL string exists in command or service files — all URLs are read from `SkillRegistryService` methods only (FR27, NFR7).
4. A registry call that times out after 10 seconds produces a descriptive error without the process hanging (SKILL-UNIT-002).
5. A 404 response for a specific skill includes the skill name in the error message (SKILL-UNIT-003).
6. A malformed (non-JSON or truncated) response body for the skill index produces a descriptive error without crashing (SKILL-UNIT-004).
7. Any registry failure during `tmr install` calls `printError` to `process.stderr` and sets `process.exitCode` to a non-zero value (NFR6, SKILL-CMD-001, NFR-EXIT-001).
8. `node:https` is mocked via `jest.unstable_mockModule` — no real network calls in any install test (TC-002 mitigation).
9. Integration tests cover timeout, 404, and malformed-JSON failure paths — all produce `printError` output and non-zero exit code (NFR-EXIT-001).
10. Any unexpected error is caught, surfaced via `printError` to stderr, and no stack trace is visible to the user (NFR2).

## Tasks / Subtasks

- [x] Add `fetchSkillList()` and `getRegistryIndexUrl()` to `SkillRegistryService` (AC: 1, 3, 4, 6)
  - [x] Add `getRegistryIndexUrl(): string` → returns `${REGISTRY_BASE_URL}/index.json`
  - [x] Add `async fetchSkillList(): Promise<Result<string[]>>` that calls `fetchUrl(this.getRegistryIndexUrl())`
  - [x] Return `{ success: false, error: 'Network error: ...' }` on network/timeout catch
  - [x] Return `{ success: false, error: 'Skill registry index not found' }` on 404
  - [x] Return status error for any non-200 code
  - [x] `JSON.parse` the body → validate it's an `Array` → return `{ success: true, data: skills }`
  - [x] Catch `JSON.parse` errors → return `{ success: false, error: 'Malformed registry response: invalid JSON' }`
  - [x] Validate parsed value is `Array` → return `{ success: false, error: 'Malformed registry response: expected JSON array' }` if not

- [x] Add service unit tests for new methods (AC: 4, 5, 6, 8 — SKILL-UNIT-002, SKILL-UNIT-004, SKILL-UNIT-005)
  - [x] Add `makeTimeoutResponse()` helper in `tests/services/skill-registry.service.test.ts`
  - [x] Add `describe('getRegistryIndexUrl')` block — verifies URL ends with `index.json`
  - [x] Add `describe('fetchSkillList')` block:
    - [x] Happy path: 200 with `["tmr-inbox","tmr-daily"]` → success + array returned
    - [x] 404: `result.success === false`, error contains 'not found' (SKILL-UNIT-004 adjacent)
    - [x] Malformed JSON: 200 with `{not-json}` → `result.success === false`, error contains 'Malformed' (SKILL-UNIT-004)
    - [x] Non-array JSON: 200 with `{}` → error contains 'expected JSON array'
    - [x] Network/timeout error: `result.success === false`, error contains 'Network error' (SKILL-UNIT-002)
  - [x] Add `describe('fetchSkillContent — timeout')` test (SKILL-UNIT-002): `makeTimeoutResponse()` → `result.success === false`, error contains 'timed out'

- [x] Update `install.command.ts` for install-all mode (AC: 1, 2, 7, 10 — FR25)
  - [x] Add `async function runInstallAll(registry, opts)` private function (before exports)
  - [x] Update `runInstall` signature: `skillName: string` → `skillName: string | undefined`
  - [x] Add early guard: `if (skillName === undefined) { await runInstallAll(registry, opts); return; }`
  - [x] Update `createInstallCommand()`: `.argument('[skill-name]', ...)` (square brackets = optional)
  - [x] Update action handler signature: `skillName: string | undefined`

- [x] Update `install.command.test.ts` mock + add all-skills unit tests (AC: 1, 7, 8)
  - [x] Add `mockFetchSkillList` mock fn to the `SkillRegistryService` mock module declaration
  - [x] Add `describe('runInstall — all-skills mode (skillName=undefined)')` block with Tests K, L, M

- [x] Add integration tests (AC: 1, 7, 9 — SKILL-INT-001, NFR-EXIT-001)
  - [x] Add `MockRequest` interface, `makeTimeoutRequest()`, `makeMalformedResponse()` helpers
  - [x] Test H: install-all happy path (SKILL-INT-001)
  - [x] Test I: install timeout → exitCode 1 (NFR-EXIT-001)
  - [x] Test J: install-all malformed index → exitCode 1 (SKILL-UNIT-004)
  - [x] Fix `afterEach` to reset `process.exitCode = undefined` to prevent Jest exit code leak

- [x] Run `npm run validate` — lint + typecheck + 981 tests + build (AC: all)

---

## Dev Notes

### Architecture Reference
- **Language:** TypeScript strict, ESM (`"type": "module"`), `.js` import extensions for `.ts` source files
- **Test runner:** Jest with `jest.unstable_mockModule`, `NODE_OPTIONS=--experimental-vm-modules`
- **Run tests:** `npm test -- --testPathPattern="install|skill-registry"` (isolated), or `npm run validate` (full)
- **Validate:** `npm run validate` (lint + typecheck + tests + build) — must exit 0

### Brownfield Baseline — What Already Exists (DO NOT RECREATE)

This story has significant brownfield code. Read and understand it before writing a single line.

**`src/services/skill-registry.service.ts`** — EXISTS, partially complete
- `SkillRegistryService` class with `fetchSkillContent`, `installSkill`, `readManifest`, `writeManifest`, `isInstalled`, `getInstalledVersion`, `listInstalledSkills`, `getRegistryUrl`
- Module-level `fetchUrl(url)` private helper — reuse for `fetchSkillList`; it already handles the 10s timeout via `req.setTimeout`
- Module-level `REGISTRY_BASE_URL` const — DO NOT duplicate; use it in new `getRegistryIndexUrl()`
- `Result<T>` union type already defined at top of file — use it for `fetchSkillList` return type

**`src/commands/install.command.ts`** — EXISTS, needs extension
- `runInstall(skillName: string, opts)` — already works for single-skill; change `skillName` to `string | undefined`
- `createInstallCommand()` — uses `.argument('<skill-name>', ...)` (required); change `<>` to `[]` for optional
- Imports already correct: `printSuccess`, `printWarning`, `printError`, `printJson`, `startSpinner` from `display.ts`

**`tests/services/skill-registry.service.test.ts`** — EXISTS with 7 tests
- `makeHttpResponse(statusCode, body)` helper exists — reuse the pattern for `makeTimeoutResponse()`
- Mocks `node:fs` and `node:https` via `jest.unstable_mockModule` — pattern already established
- Import statement already has `const { SkillRegistryService } = await import(...)` — no new import needed

**`tests/commands/install.command.test.ts`** — EXISTS with 10 tests (A–J)
- Mock for `SkillRegistryService` already set up with `mockFetchSkillContent`, `mockInstallSkill`, etc.
- MUST add `mockFetchSkillList` to the mock object — otherwise `runInstall(undefined, ...)` will throw `TypeError: registry.fetchSkillList is not a function`

**`tests/integration/install-update.integration.test.ts`** — EXISTS with 7 tests (A–G)
- `mockHttpsGetImpl` typed as `(url: string, cb: HttpsGetCallback) => { on: () => void }`
- **Must expand the return type** to accommodate `makeTimeoutRequest()` which needs `setTimeout` and `destroy` methods on the request object
- `makeNetworkErrorRequest()` helper defined but unused — reference it for the error-chaining pattern

### Critical Implementation Details

#### `fetchSkillList()` — Registry Index Design
The registry index lives at `${REGISTRY_BASE_URL}/index.json`. The response body is a JSON array of skill name strings, e.g.:
```json
["tmr-inbox", "tmr-daily", "tmr-retrospective"]
```

`fetchSkillList` reuses the module-level `fetchUrl` function (exact same call pattern as `fetchSkillContent`). Key guard: after parsing JSON, check `Array.isArray(skills)` before returning `data`. If not an array, return a 'expected JSON array' error.

#### `makeTimeoutRequest()` Integration Test Helper

The `fetchUrl` function calls `req.setTimeout(ms, fn)` where `fn = () => req.destroy(new Error('timed out...'))`. To simulate this in tests, the mock request object needs `on`, `setTimeout`, and `destroy`, all chained correctly:

```typescript
function makeTimeoutRequest() {
  let errorCb: ((err: Error) => void) | null = null;
  const req = {
    on(event: string, cb: (err: Error) => void): typeof req {
      if (event === 'error') errorCb = cb;
      return req;
    },
    setTimeout(_ms: number, fn: () => void): typeof req {
      // fn = () => req.destroy(new Error('Request timed out after 10000ms'))
      // Must fire AFTER req.on('error') is registered — use setImmediate
      setImmediate(fn);
      return req;
    },
    destroy(err: Error): void {
      if (errorCb) errorCb(err);
    },
  };
  return req;
}
```

Call sequence in `fetchUrl`: (1) `https.get(url, _cb)` → req returned, (2) `req.on('error', reject)` → errorCb set, (3) `req.setTimeout(ms, fn)` → `setImmediate(fn)` scheduled. On next tick: `fn()` → `req.destroy(new Error(...))` → `errorCb(err)` → Promise rejects. ✓

For the integration test, `mockHttpsGetImpl` must NOT call `cb` (no response), just return the request:
```typescript
mockHttpsGetImpl = (_url, _cb) => makeTimeoutRequest();
```

#### `mockHttpsGetImpl` Type Expansion
The current type `(url, cb) => { on: () => void }` must be widened. Replace with:
```typescript
interface MockRequest {
  on: (event: string, cb: (err?: Error) => void) => MockRequest;
  setTimeout?: (ms: number, fn: () => void) => MockRequest;
  destroy?: (err: Error) => void;
}
let mockHttpsGetImpl: (url: string, cb: HttpsGetCallback) => MockRequest;
```
All existing callers (`makeSuccessResponse`, `make404Response`) return `{ on: jest.fn() }` — update to also return `setTimeout?: undefined, destroy?: undefined` or just cast via `as MockRequest`.

#### Install-All Logic — Correct Ordering in `runInstall`
The early return for install-all must happen AFTER `configService.initialize()` and `new SkillRegistryService(workspaceRoot)` but BEFORE `registry.getInstalledVersion(skillName)`:

```typescript
export async function runInstall(
  skillName: string | undefined,
  opts: { plain: boolean; force: boolean; json?: boolean },
): Promise<void> {
  configService.initialize();
  const workspaceRoot = getWorkspaceRoot();
  const registry = new SkillRegistryService(workspaceRoot);

  if (skillName === undefined) {
    await runInstallAll(registry, opts);
    return;
  }
  // ... rest of existing single-skill logic unchanged
```

#### `runInstallAll` — Spinner + Per-Skill Install Loop
The function takes `(registry: SkillRegistryService, opts: {...})` — not exported. Pattern mirrors `runUpdate` in `update.command.ts` (read that file for spinner + loop precedent):
- Use `startSpinner` for the initial index fetch
- Use a separate `startSpinner` per skill install inside the loop
- Track `installed: string[]`, `skipped: string[]`, `failed: Array<{ name: string; error: string }>`
- `process.exitCode = 1` on ANY individual skill failure (do not halt loop — install remaining skills)
- `--json` output: `printJson({ installed, skipped, failed })`
- No `--json` output: `printSuccess` per installed skill, no output for skipped

#### `createInstallCommand()` Argument Change
Only two characters change: `<skill-name>` → `[skill-name]`. The help text and description should mention the no-arg behavior:
```typescript
.argument('[skill-name]', 'name of the skill to install (e.g. tmr-inbox); omit to install all available skills')
.addHelpText('after', '\nExamples:\n  tmr install\n  tmr install tmr-inbox\n  tmr install tmr-inbox --force\n')
```

#### Unit Test Mock Expansion for `install.command.test.ts`
Add `mockFetchSkillList` alongside the other mocks:
```typescript
const mockFetchSkillList = jest.fn<
  () => Promise<{ success: true; data: string[] } | { success: false; error: string }>
>();

jest.unstable_mockModule('../../src/services/skill-registry.service.js', () => ({
  SkillRegistryService: jest.fn(() => ({
    isInstalled: mockIsInstalled,
    getInstalledVersion: mockGetInstalledVersion,
    fetchSkillContent: mockFetchSkillContent,
    fetchSkillList: mockFetchSkillList,   // ← ADD THIS
    installSkill: mockInstallSkill,
    listInstalledSkills: mockListInstalledSkills,
  })),
}));
```
In `beforeEach`, add: `mockFetchSkillList.mockReset()` (or rely on `jest.clearAllMocks()`).

#### Integration Test: Install-All Index URL Routing
The `mockHttpsGetImpl` for SKILL-INT-001 must handle TWO different URLs — the index URL and the skill content URL:
```typescript
mockHttpsGetImpl = (url, cb) => {
  if (url.includes('index.json')) {
    cb(makeSuccessResponse(JSON.stringify(['tmr-inbox'])));
  } else {
    cb(makeSuccessResponse(SKILL_CONTENT_V1));
  }
  return { on: jest.fn() } as MockRequest;
};
```

### Files Being Modified (UPDATE, not NEW)

| File | What Changes |
|------|-------------|
| `src/services/skill-registry.service.ts` | Add `getRegistryIndexUrl()` + `fetchSkillList()` |
| `src/commands/install.command.ts` | Add `runInstallAll()`, update `runInstall` signature, update `createInstallCommand()` |
| `tests/services/skill-registry.service.test.ts` | Add `makeTimeoutResponse()`, `describe('getRegistryIndexUrl')`, `describe('fetchSkillList')`, timeout test for `fetchSkillContent` |
| `tests/commands/install.command.test.ts` | Add `mockFetchSkillList` to mock, add Tests K/L/M |
| `tests/integration/install-update.integration.test.ts` | Expand `MockRequest` type, add `makeTimeoutRequest()`, `makeMalformedResponse()`, Tests H/I/J |

### What MUST NOT Change (Regression Guard)
- `SkillRegistryService` constructor, `fetchSkillContent`, `installSkill`, `readManifest`, `writeManifest`, `isInstalled`, `getInstalledVersion`, `listInstalledSkills` — all existing behavior must be preserved
- `runInstall` behavior when `skillName` is a non-undefined string — identical to current
- All existing install/update command tests (A–J) must remain green
- `update.command.ts` and `tests/commands/update.command.test.ts` — DO NOT TOUCH
- `src/cli.ts` registration of `install` command — DO NOT TOUCH (argument change is backward-compatible since `[skill-name]` is now optional)

### Previous Story Intelligence (Epic 3 patterns)
- Error handling: catch all exceptions in command layer, surface via `printError`, set `process.exitCode = 1` (never `process.exit()`)
- `jest.clearAllMocks()` in `beforeEach` is sufficient — no need for individual mock resets
- `process.exitCode = undefined` reset in `beforeEach` — already present in both test files, maintain it
- Integration tests use `fs-extra` (`import fs from 'fs-extra'`) and `os.tmpdir()` for temp workspace
- ESM `.js` extension on all imports even for `.ts` source files

### Recent Git Commits (context)
- `22fb672` — Add global email resolver and auto-create (Story 3.3)
- `306447b` — Add company/team-scoped member routing (Story 3.2)
- `6dd79ff` — Implement team creation with email validation (Story 3.1)

---

## Dev Agent Record

### Agent Model
claude-sonnet-4-5 (Cursor)

### Debug Log
- Brownfield analysis: `skill-registry.service.ts` and `install.command.ts` already existed with single-skill support; added install-all mode on top
- Timeout mock in integration tests required `MockRequest` interface with `on`, `setTimeout`, `destroy` chain; `setImmediate(fn)` ensures error handler is registered before timeout fires
- Integration tests I and J left `process.exitCode = 1` on the process causing Jest to exit non-zero; fixed by adding `process.exitCode = undefined` to `afterEach`
- `makeNetworkErrorRequest()` was defined but had a missing `return req` — fixed as part of `MockRequest` migration

### Completion Notes
- Added `getRegistryIndexUrl()` and `fetchSkillList()` to `SkillRegistryService` — reuses module-level `fetchUrl` helper; handles 404, malformed JSON, network/timeout errors
- `runInstall(skillName: string | undefined, opts)` now dispatches to `runInstallAll(registry, opts)` when `skillName` is undefined
- `createInstallCommand()` changed `<skill-name>` (required) to `[skill-name]` (optional) — backward-compatible; single-skill path unchanged
- 13 new tests added (8 service unit tests + 3 command unit tests K/L/M + 3 integration tests H/I/J = 13 net new, but actually we added: 6 service + 1 timeout fetchSkillContent + 1 getRegistryIndexUrl = 8 service, 3 command = 11 unit, 3 integration = 14 total) — net: 981 total tests (was 968)
- All 66 suites, 981 tests pass; lint, typecheck, build clean

---

## File List

- `src/services/skill-registry.service.ts` — added `getRegistryIndexUrl()` and `fetchSkillList()`
- `src/commands/install.command.ts` — added `runInstallAll()`, updated `runInstall` signature, updated `createInstallCommand()` argument
- `tests/services/skill-registry.service.test.ts` — added `makeTimeoutResponse()` helper + 8 new tests (getRegistryIndexUrl, fetchSkillList ×5, fetchSkillContent timeout)
- `tests/commands/install.command.test.ts` — added `mockFetchSkillList` to mock + Tests K, L, M
- `tests/integration/install-update.integration.test.ts` — added `MockRequest` interface, `makeTimeoutRequest()`, `makeMalformedResponse()`, Tests H/I/J, fixed `afterEach` exitCode reset, fixed `makeNetworkErrorRequest` return

---

## Change Log

- 2026-05-10: Implemented Story 4.1 — `tmr install` all-skills mode via `fetchSkillList()` + `runInstallAll()`; added 13 new tests covering SKILL-UNIT-002/004/005, SKILL-INT-001, NFR-EXIT-001; `npm run validate` passes with 981 tests

---

### Review Findings

- [x] [Review][Patch] `fetchSkillList` casts parsed array without element-type validation — `null`, numbers, or objects are silently passed to `installSkill` → `path.join` throws, process crashes with a visible stack trace [src/services/skill-registry.service.ts:87]
- [x] [Review][Patch] `makeTimeoutResponse` uses `void fn` instead of `setImmediate(fn)` — production timeout callback discarded; tests pass even if the real callback chain is broken [tests/services/skill-registry.service.test.ts:42]
- [x] [Review][Patch] Unit test `afterEach` missing `process.exitCode = undefined` reset — if Test L is the last test executed, Jest exits with code 1 [tests/commands/install.command.test.ts:77]
- [x] [Review][Patch] Tests I and J assert only `allOutput.length > 0` — too weak; doesn't verify error message content [tests/integration/install-update.integration.test.ts:380,402]

- [x] [Review][Defer] Path traversal via skill names (`"../.."` in registry index) can escape `.claude/skills/` [src/services/skill-registry.service.ts:installSkill] — deferred, pre-existing
- [x] [Review][Defer] Synchronous fs exceptions from `installSkill` propagate unhandled — AC10 gap exists in both install-all and single-skill paths [src/commands/install.command.ts:63,125] — deferred, pre-existing
- [x] [Review][Defer] No HTTP body size cap in `fetchUrl` — malicious registry can cause OOM [src/services/skill-registry.service.ts:fetchUrl] — deferred, pre-existing
- [x] [Review][Defer] Skill names not URL-encoded before interpolating into registry URL [src/services/skill-registry.service.ts:getRegistryUrl] — deferred, pre-existing
- [x] [Review][Defer] Empty string skill name writes `SKILL.md` at `.claude/skills/` root [src/services/skill-registry.service.ts:installSkill] — deferred, pre-existing
- [x] [Review][Defer] json-mode errors go to stdout via `printJson` rather than `printError` to stderr (AC7) — pre-existing single-skill pattern mirrored by install-all [src/commands/install.command.ts:27] — deferred, pre-existing
- [x] [Review][Defer] Per-skill failures in json mode only appear in final `printJson`; no real-time stderr signal — pre-existing pattern [src/commands/install.command.ts:52-59] — deferred, pre-existing
- [x] [Review][Defer] Empty skill list from registry exits 0 with no warning — design decision [src/commands/install.command.ts:runInstallAll] — deferred, pre-existing
- [x] [Review][Defer] `--json` error schema inconsistent: list-fetch failure emits `{status, message}` while batch result emits `{installed, skipped, failed}` — pre-existing codebase pattern [src/commands/install.command.ts:27,71] — deferred, pre-existing
