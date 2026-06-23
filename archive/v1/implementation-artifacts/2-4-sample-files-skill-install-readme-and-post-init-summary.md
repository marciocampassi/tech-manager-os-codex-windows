# Story 2.4: Sample Files, Skill Install, README & Post-Init Summary

Status: done

## Story

As a new `tmr` user completing `tmr init`,
I want sample inbox notes copied to my vault, the `tmr-inbox` skill installed silently, a `README.md` generated in the vault root, and a next-steps summary printed to the terminal,
So that my vault is immediately useful and I know exactly what to do next — even if I've never used `tmr` before.

## Acceptance Criteria

1. After all member files are written, `InitService.copySampleInboxFiles(vaultPath)` writes bundled sample Markdown files to `inbox/`. [FR11, INIT-UNIT-003]
2. `InitService.installDefaultSkill(vaultPath)` calls `SkillRegistryService` to fetch and install `tmr-inbox`. When the network call fails (timeout, 404, or any error), the error is **logged** via `logger.warn()` but onboarding **continues** — no throw, no abort. [FR10, NFR1, INIT-INT-010]
3. `InitService.writeReadme(vaultPath)` writes `README.md` to the vault root with content covering the most-used commands and a full command reference, generated from `generateVaultReadme()` in `src/templates/onboarding.templates.ts`. [FR12, ARCH-006, INIT-UNIT-002, INIT-INT-012]
4. `InitService.printPostInitSummary(vaultPath, plain)` calls `printSuccess` and `printInfo` from `src/utils/display.ts` to emit the post-init next-steps summary directing the user to `tmr project add` and `/tmr-inbox`. [FR13, INIT-UNIT-006]
5. Post-init guidance includes opening Obsidian and enabling required plugins. [FR14]
6. `InitCommand.run()` calls `initService.printPostInitSummary(workspacePath, this.plain)` as the final step instead of `this.displayNextSteps()`. `InitCommand.displayNextSteps()` is removed. [FR13, FR14]
7. All new write-phase steps in `InitCommand.run()` follow the established `startSpinner → try/catch → succeed/fail+return` pattern, **except** `installDefaultSkill` which uses `startSpinner → try/catch/log → succeed` (soft-fail: NEVER returns early on skill install error). [NFR4]
8. `tests/integration/init.integration.test.ts` is updated with `describe` blocks for README, sample files, and skill-failure scenario. [INIT-INT-001, INIT-INT-010, INIT-INT-012]
9. `npm run validate` exits 0.

## Tasks / Subtasks

- [x] Add template functions to `src/templates/onboarding.templates.ts` (AC: 1, 3)
  - [x] Add `export function generateSampleMeetingNote(): string` — returns a sample meeting note Markdown file for `inbox/`
  - [x] Add `export function generateVaultReadme(): string` — returns README.md content with most-used commands and full command reference table

- [x] Update `src/services/init.service.ts` (AC: 1–4)
  - [x] Add optional 4th constructor param: `private readonly _skillRegistryFactory: (workspaceRoot: string) => SkillRegistryService = (wr) => new SkillRegistryService(wr)` — backward-compatible (no change to the 3-arg constructor signature used by existing tests)
  - [x] Import `SkillRegistryService` from `'./skill-registry.service.js'`
  - [x] Import `logger` from `'../utils/logger.js'`
  - [x] Import `printSuccess`, `printInfo` from `'../utils/display.js'`
  - [x] Import `generateSampleMeetingNote`, `generateVaultReadme` from `'../templates/onboarding.templates.js'`
  - [x] Add `async copySampleInboxFiles(vaultPath: string): Promise<void>` — writes `generateSampleMeetingNote()` to `inbox/sample-meeting-note.md`; uses `this._fs.writeFile`; throws on error
  - [x] Add `async installDefaultSkill(vaultPath: string): Promise<void>` — creates `this._skillRegistryFactory(vaultPath)`, calls `fetchSkillContent('tmr-inbox')`, on success calls `installSkill()`, on any failure calls `logger.warn()` only; NEVER throws
  - [x] Add `async writeReadme(vaultPath: string): Promise<void>` — writes `generateVaultReadme()` to `<vaultPath>/README.md` via `this._fs.writeFile`; throws on error
  - [x] Add `printPostInitSummary(vaultPath: string, plain: boolean): void` — calls `printSuccess(...)` then `printInfo(...)` with next-steps content directing to `tmr project add` and `/tmr-inbox`, plus Obsidian plugin guidance

- [x] Update `src/commands/init.command.ts` (AC: 6, 7)
  - [x] Remove `displayNextSteps()` method entirely
  - [x] In the write phase, after `membersSpinner.succeed(...)` loop, add in order:
    1. `copySampleFiles` spinner: `startSpinner → initService.copySampleInboxFiles(workspacePath) → succeed` (try/catch returns on error)
    2. `installSkill` spinner: `startSpinner → initService.installDefaultSkill(workspacePath) → succeed` (try/catch logs ONLY — NEVER returns; skill fail is non-fatal)
    3. `readmeSpinner`: `startSpinner → initService.writeReadme(workspacePath) → succeed` (try/catch returns on error)
  - [x] Replace `this.displayNextSteps(workspacePath)` call with `initService.printPostInitSummary(workspacePath, this.plain)`
  - [x] CLAUDE.md write step: keep exactly as-is (no change)

- [x] Update `tests/templates/onboarding.templates.test.ts` (AC: 1, 3)
  - [x] Add `describe('generateSampleMeetingNote')` with 2 tests: contains `# ` heading, contains `inbox` or meeting-related content
  - [x] Add `describe('generateVaultReadme')` with 4 tests: contains `# README`, contains `tmr init`, contains `tmr project add`, contains `tmr --help`

- [x] Update `tests/services/init.service.test.ts` (AC: 1, 2, 3, 4)
  - [x] Create `mockSkillRegistry` type and factory mirroring `SkillRegistryService` methods needed: `fetchSkillContent: jest.fn()`, `installSkill: jest.fn()`
  - [x] Update `new InitService(mockFS, mockLeadership, mockTeam)` calls throughout the file to pass a mock factory as the 4th arg where relevant
  - [x] Add `describe('copySampleInboxFiles')` — 2 tests: writes file to `inbox/sample-meeting-note.md`, propagates writeFile error
  - [x] Add `describe('installDefaultSkill')` — 3 tests: calls fetchSkillContent with `'tmr-inbox'`; on success calls installSkill; on fetchSkillContent failure calls `logger.warn` and does NOT throw (swallows error)
  - [x] Add `describe('writeReadme')` — 2 tests: writes `README.md` at vault root, propagates writeFile error
  - [x] Add `describe('printPostInitSummary')` — 3 tests: calls `printInfo` at least once; output contains `tmr project add`; output contains `tmr-inbox`

- [x] Update `tests/integration/init.integration.test.ts` (AC: 8)
  - [x] Add `mockInstallDefaultSkill`-style mock by mocking `SkillRegistryService` at module level via `jest.unstable_mockModule('../../src/services/skill-registry.service.js', ...)`
  - [x] Add `describe('README generation (AC: 3 — INIT-INT-012)')` — 2 tests: `README.md` is written to vault root, README contains `tmr project add`
  - [x] Add `describe('sample inbox files (AC: 1 — FR11)')` — 1 test: `inbox/sample-meeting-note.md` is written
  - [x] Add `describe('full happy path — INIT-INT-001')` — 1 test aggregating: README + sample files + member profile all present
  - [x] Add separate `describe('skill install failure — INIT-INT-010')` with its own `beforeAll` that sets up a skill-registry mock to reject, runs full init, and asserts init completes (all other files written)

- [x] Run `npm run validate` (AC: 9)

## Dev Notes

### Architecture Context (MUST follow)

**Constructor DI pattern — backward-compatible extension:**
```typescript
export class InitService {
  constructor(
    private readonly _fs: FileSystemService,
    private readonly _leadership: LeadershipService,
    private readonly _team: TeamService,
    private readonly _skillRegistryFactory: (workspaceRoot: string) => SkillRegistryService =
      (wr) => new SkillRegistryService(wr),
  ) {}
```
All existing tests that call `new InitService(mockFS, mockLeadership, mockTeam)` remain valid — no change needed to existing unit tests unless they explicitly need to test `installDefaultSkill`. Unit tests for `installDefaultSkill` pass a mock factory as the 4th arg.

**Skill install is ALWAYS non-fatal:**
```typescript
async installDefaultSkill(vaultPath: string): Promise<void> {
  const registry = this._skillRegistryFactory(vaultPath);
  try {
    const result = await registry.fetchSkillContent('tmr-inbox');
    if (result.success) {
      registry.installSkill('tmr-inbox', result.data.content, result.data.version);
    } else {
      logger.warn(`tmr-inbox skill install skipped: ${result.error}`);
    }
  } catch (err) {
    logger.warn(`tmr-inbox skill install failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}
```
Do NOT throw. Do NOT call `printError`. Do NOT return early in the command's write phase.

**Command soft-fail spinner pattern (skill only):**
```typescript
const skillSpinner = startSpinner('Installing tmr-inbox skill', this.plain);
try {
  await initService.installDefaultSkill(workspacePath);
} catch {
  // installDefaultSkill never throws — this catch is a safety net only
}
skillSpinner.succeed('tmr-inbox skill ready');
```
Because `installDefaultSkill` never throws, `skillSpinner.succeed()` is always called regardless of network outcome.

**All other new write-phase steps follow the standard hard-fail pattern:**
```typescript
const sampleSpinner = startSpinner('Copying sample files', this.plain);
try {
  await initService.copySampleInboxFiles(workspacePath);
} catch (err) {
  printError(`Failed to copy sample files: ${err instanceof Error ? err.message : String(err)}`);
  sampleSpinner.fail('Sample file copy failed');
  return;
}
sampleSpinner.succeed('Sample files ready');
```

**Write phase order after existing steps (do NOT reorder existing steps):**
```
... existing steps ...
├── members loop (Story 2.3, unchanged)
├── CLAUDE.md write (unchanged — stays immediately after members)
├── Obsidian plugins install (unchanged)
├── [NEW] Copy sample inbox files  ← copySampleInboxFiles
├── [NEW] Install tmr-inbox skill  ← installDefaultSkill (soft-fail)
├── [NEW] Write README.md          ← writeReadme
└── [NEW] printPostInitSummary     ← replaces displayNextSteps
```

**Post-init summary content (FR13 + FR14):**
```typescript
printPostInitSummary(vaultPath: string, plain: boolean): void {
  printSuccess(`✓ Workspace created at ${vaultPath}`, plain);
  printInfo(
    [
      '',
      'Next steps:',
      '  1. Run `tmr config` to set your AI API key',
      '  2. Run `tmr project add` to add your first project',
      `  3. Open ${vaultPath} in Obsidian — plugins are ready`,
      '  4. Type /tmr-inbox in Claude Code to process your inbox',
      '  5. Run `tmr --help` to explore all commands',
      '',
      'Obsidian plugins installed: obsidian-git, granola-sync, terminal, dataview',
    ].join('\n'),
    plain,
  );
}
```
INIT-UNIT-006 unit test asserts `printInfo` is called AND output contains `tmr project add` and `tmr-inbox`.

**No new prompts:** The prompt phase is UNCHANGED. `tests/fixtures/init-prompts.ts` stays at 10 calls. Do NOT touch the fixture or the prompt count assertion in the integration test.

**ARCH-006 — README must be in dist:** `generateVaultReadme()` is a pure TypeScript function returning a string constant — it is naturally bundled by tsup as part of `onboarding.templates.ts`. No `publicDir` or static file copying needed.

**Sample inbox files:** One file is sufficient for Story 2.4. Filename: `sample-meeting-note.md`. Content: a simple Markdown meeting note demonstrating what to drop in the inbox.

**`SkillRegistryService.installSkill()` uses synchronous `fs.mkdirSync`/`fs.writeFileSync`** (not `FileSystemService`). Do NOT mock `fileSystemService` for skill install. Mock the `SkillRegistryService` constructor at the module level in integration tests.

**Importing `printSuccess`/`printInfo` in `InitService`:** This is intentional per INIT-UNIT-006. `display.ts` functions are output utilities — services may use them for user-facing terminal output as long as the `plain` flag is propagated.

### Files Changed

| File | Role |
|------|------|
| `src/templates/onboarding.templates.ts` | NEW: `generateSampleMeetingNote`, `generateVaultReadme` |
| `src/services/init.service.ts` | NEW: `copySampleInboxFiles`, `installDefaultSkill`, `writeReadme`, `printPostInitSummary`. UPDATE: optional 4th ctor param |
| `src/commands/init.command.ts` | UPDATE: add 3 write-phase steps, remove `displayNextSteps`, call `printPostInitSummary` |
| `tests/templates/onboarding.templates.test.ts` | UPDATE: add README and sample note tests |
| `tests/services/init.service.test.ts` | UPDATE: 4 new describe blocks |
| `tests/integration/init.integration.test.ts` | UPDATE: skill-registry mock + new describes for README, samples, skill-fail |

### Test Strategy

**Unit test mocking pattern for `printInfo`/`printSuccess` in `init.service.test.ts`:**
Because `InitService.printPostInitSummary` calls `printInfo` from `display.ts`, the unit test must mock the module:
```typescript
const mockPrintInfo = jest.fn<typeof import('../../src/utils/display.js').printInfo>();
const mockPrintSuccess = jest.fn<typeof import('../../src/utils/display.js').printSuccess>();

jest.unstable_mockModule('../../src/utils/display.js', () => ({
  printInfo: mockPrintInfo,
  printSuccess: mockPrintSuccess,
  printError: jest.fn(),
  startSpinner: jest.fn(),
}));
```
Do this BEFORE the dynamic import of `InitService`.

**Integration test — SkillRegistryService mock:**
```typescript
jest.unstable_mockModule('../../src/services/skill-registry.service.js', () => ({
  SkillRegistryService: jest.fn().mockImplementation(() => ({
    fetchSkillContent: jest.fn<() => Promise<{ success: true; data: { content: string; version: string } }>>()
      .mockResolvedValue({ success: true, data: { content: '# tmr-inbox skill', version: '1.0.0' } }),
    installSkill: jest.fn<() => void>(),
  })),
}));
```

**INIT-INT-010 (skill-fail scenario) — separate describe block** with its own `beforeAll`:
- Reset `SkillRegistryService` mock to throw on `fetchSkillContent`
- Run `new InitCommand().run()` again (with fresh `writtenFiles2` map)
- Assert README.md was still written (init completed)
- NOTE: `writtenFiles` from the outer `beforeAll` must NOT be polluted; use a separate Map for this describe

**Testing `installDefaultSkill` logger.warn in unit test:**
Mock `logger` from `'../../src/utils/logger.js'` to capture `logger.warn()` calls:
```typescript
const mockLoggerWarn = jest.fn();
jest.unstable_mockModule('../../src/utils/logger.js', () => ({
  logger: { warn: mockLoggerWarn, info: jest.fn(), error: jest.fn() },
}));
```

### Architecture Document References

- ARCH-005: InitService MUST delegate to services — `writeReadme`, `copySampleInboxFiles`, `installDefaultSkill` all live in InitService, not InitCommand
- ARCH-006: README generation is `InitService`'s responsibility; template in `src/templates/onboarding.templates.ts`
- NFR1: Any write error must be surfaced via `printError` with recovery guidance; EXCEPT skill install which is always non-fatal
- NFR4: All async steps wrapped in `ora` spinners
- `project-context.md` rules: `.js` import extensions, no `console.log`, `display.ts` helpers, `strict: true`, explicit return types on exports

### Regression Guard

**Do NOT break these:** 
- Existing 10-call prompt count assertion in `init.integration.test.ts` — no new prompts
- `initService = new InitService(fileSystemService, leadershipService, teamService)` singleton at bottom of `init.service.ts` — constructor signature backward-compatible  
- `displayWelcomeBanner()` in `InitCommand` — keep it
- CLAUDE.md write step in `init.command.ts` — no change
- `obsidianPluginService.installPlugins()` call — no change
- All existing `describe` blocks in `init.integration.test.ts` — extend, do NOT modify
- All 902 currently-passing tests

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6

### Debug Log References

None — clean implementation run.

### Completion Notes List

- Added `generateSampleMeetingNote()` and `generateVaultReadme()` to `src/templates/onboarding.templates.ts` as pure string-returning exports bundled naturally by tsup.
- Extended `InitService` constructor with optional 4th param `_skillRegistryFactory` for DI while maintaining full backward-compatibility with all existing 3-arg callers.
- Added 4 new methods to `InitService`: `copySampleInboxFiles`, `installDefaultSkill` (non-fatal, logger.warn only), `writeReadme`, `printPostInitSummary`.
- Replaced `displayNextSteps()` in `InitCommand` with `initService.printPostInitSummary()`. Updated copy: removed `tmr install tmr-inbox`, replaced with `/tmr-inbox` (Claude Code skill), added `tmr project add`.
- Added 6 new describes (22 new tests) across 4 test files; fixed chalk mock (missing `blue`, `yellow`, `red`) in both `init.command.test.ts` and `init.integration.test.ts`.
- All ACs 1–9 satisfied. `npm run validate` exits 0: 924 tests pass, 66 suites pass.

### File List

- `src/templates/onboarding.templates.ts`
- `src/services/init.service.ts`
- `src/commands/init.command.ts`
- `tests/templates/onboarding.templates.test.ts`
- `tests/services/init.service.test.ts`
- `tests/integration/init.integration.test.ts`
- `tests/commands/init.command.test.ts`

### Review Findings

- [x] [Review][Patch] Factory call outside `try` in `installDefaultSkill` — `this._skillRegistryFactory(vaultPath)` runs before the try block; a constructor/factory throw propagates out of the service, is caught by the command's empty `catch {}` with no logging, and `skillSpinner.succeed()` still fires — fix: move factory call inside the try block [`src/services/init.service.ts`]
- [x] [Review][Patch] Duplicate `✓ ` prefix in `printPostInitSummary` — `printSuccess` already prepends `✓ ` but the message string begins with `✓ ` too, producing `✓ ✓ Workspace created at …` — fix: remove leading `✓ ` from the string literal [`src/services/init.service.ts`]
- [x] [Review][Patch] `result.success = false` failure path has zero test coverage — the `else { logger.warn(...) }` branch in `installDefaultSkill` is untested; deleting it would leave all tests green — fix: add one unit test with `fetchSkillContent` resolving to `{ success: false, error: 'not found' }` and asserting `logger.warn` is called [`tests/services/init.service.test.ts`]
- [x] [Review][Defer] `today()` helper returns UTC date — can be off by one day for users in UTC+ timezones [`src/templates/onboarding.templates.ts`] — deferred, pre-existing pattern used by all templates
- [x] [Review][Defer] Hard-coded plugin list in `printPostInitSummary` can drift from actually-installed set [`src/services/init.service.ts`] — deferred, pre-existing design; future story concern
- [x] [Review][Defer] Command-layer empty `catch` for skill step has no logging — residual silent failure if factory is ever changed [`src/commands/init.command.ts`] — deferred, mitigated by P1; safety net per spec
- [x] [Review][Defer] `printSuccess` call in `printPostInitSummary` is not explicitly asserted in unit tests [`tests/services/init.service.test.ts`] — deferred, Dev Notes prescription omits this assertion; spec gap not impl bug
- [x] [Review][Defer] AC5/FR14 Obsidian "enabling" guidance is passive — content matches Dev Notes verbatim but does not instruct users to enable plugins in Community Plugins settings [`src/services/init.service.ts`] — deferred, spec content ambiguity; Dev Notes took precedence

#### Round 2 Findings (post-patch re-review)

- [x] [Review][Patch] AC4 INIT-UNIT-006: `printSuccess` call never independently asserted — removing `printSuccess(...)` leaves all three stdout-spy tests green; add assertion that output contains `"Workspace created at"` [`tests/services/init.service.test.ts`]
- [x] [Review][Patch] AC8 INIT-INT-010: skill-fail describe has no assertion for `inbox/sample-meeting-note.md` — step runs before skill install so sample files always land; add explicit `writtenFiles2.has(…inbox/sample-meeting-note.md)` assertion [`tests/integration/init.integration.test.ts`]
- [x] [Review][Defer] Non-atomic `installSkill` — `SKILL.md` written but `skill-manifest.json` not updated if `writeManifest` throws inside `installSkill` [`src/services/skill-registry.service.ts`] — deferred, pre-existing `SkillRegistryService` design; catch in `installDefaultSkill` handles it gracefully
