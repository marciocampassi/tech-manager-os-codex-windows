# Story 2.1: Vault Scaffold & Folder Structure

Status: done

## Story

As a new `tmr` user running `tmr init` for the first time,
I want the CLI to create the complete vault folder structure at my chosen path,
So that all required directories exist and the vault is ready to be populated by subsequent init steps.

## Acceptance Criteria

1. `InitService` (new, at `src/services/init.service.ts`) exposes a `scaffold(vaultPath: string): Promise<void>` method that creates exactly the 12 directories listed below and writes a `CLAUDE.md` stub to the vault root.
2. Directories created: `inbox/`, `archive/`, `my-tasks/`, `my-teams/members/`, `my-teams/teams/`, `my-company/members/`, `my-company/projects/`, `my-leadership/`, `my-career/`, `knowledge-base/`, `.claude/skills/`, `.cursor/rules/tmr/` — no more, no less.
3. `/utils` and `/my-teams/feedback-templates` are **NOT** created (INIT-UNIT-001).
4. A `CLAUDE.md` file is written to the vault root (INIT-UNIT-007) — content must include the vault structure table at minimum.
5. `InitService.resolveVaultPath(input: string): string` maps an empty string to `process.cwd()`, expands `~/...` paths to the OS home dir, and returns all other strings unchanged.
6. `InitCommand.run()` is refactored to call `initService.scaffold(vaultPath)` instead of `buildWorkspaceStructure(workspacePath)`, and to resolve the vault path via `initService.resolveVaultPath()`.
7. `promptWorkspacePath()` default is updated from `~/tech-leadership-workspace` to `process.cwd()` so the user sees the current directory as the suggested default.
8. A file system error during scaffolding is caught, surfaced via `printError` to `process.stderr` with a descriptive message, and re-thrown so the process does not silently continue (NFR1).
9. Any unexpected error that escapes `InitService` is caught at the `InitCommand` layer and surfaced via `printError` — no raw stack trace visible to the user (NFR2).
10. `tests/services/init.service.test.ts` exists and INIT-UNIT-001 (correct dir set) and INIT-UNIT-007 (CLAUDE.md written) pass.
11. All existing `tests/commands/init.command.test.ts` tests continue to pass with no regressions.
12. `npm run validate` exits 0.

## Tasks / Subtasks

- [x] Create `src/services/init.service.ts` (AC: 1–5, 8)
  - [x] Define `VAULT_DIRS` constant with exactly the 12 directory strings (see Dev Notes)
  - [x] Define `buildClaudeMdStub(): string` private helper (see Dev Notes for content)
  - [x] Implement `resolveVaultPath(input: string): string` — empty → `process.cwd()`, `~/` prefix → `path.join(homedir(), input.slice(2))`, else as-is
  - [x] Implement `scaffold(vaultPath: string): Promise<void>` — create all dirs in parallel via `Promise.all`, write CLAUDE.md stub, wrap errors with `printError` + re-throw
  - [x] Export `InitService` class and `initService` singleton (`new InitService(fileSystemService)`)

- [x] Update `src/workflows/onboarding.prompts.ts` (AC: 7)
  - [x] Change `promptWorkspacePath()` default from `'~/tech-leadership-workspace'` to `process.cwd()`

- [x] Refactor `src/commands/init.command.ts` (AC: 6, 9)
  - [x] Add `import { initService } from '../services/init.service.js';`
  - [x] Remove `import { buildWorkspaceStructure } from '../workflows/workspace-builder.js';`
  - [x] In `run()`: replace `await buildWorkspaceStructure(workspacePath)` with `await initService.scaffold(workspacePath)`
  - [x] In `run()`: resolve vault path via `initService.resolveVaultPath(workspacePath)` after `promptWorkspacePath()` call (before `configService.setWorkspacePath`)
  - [x] Wrap `initService.scaffold()` call (and anything that could throw) in try/catch — on catch, call `printError(message)` and do NOT re-throw at the command layer (display error cleanly and return)
  - [x] Existing CLAUDE.md overwrite with `generateClaudeMd(answers)` stays — `writeFile` is idempotent and will overwrite the stub correctly

- [x] Create `tests/services/init.service.test.ts` (AC: 10)
  - [x] Mock `FileSystemService` (same pattern as `email-resolution.service.test.ts`)
  - [x] INIT-UNIT-001: verify `mockFS.createDirectory` is called with every one of the 12 expected paths and NOT called with `utils` or `my-teams/feedback-templates`
  - [x] INIT-UNIT-007: verify `mockFS.writeFile` is called with a path ending in `CLAUDE.md` and content containing the vault structure table
  - [x] `resolveVaultPath` unit tests: empty string → `process.cwd()`, `~/vault` → expanded path, `/absolute/path` → unchanged
  - [x] Error path: when `mockFS.createDirectory` rejects, `printError` is called and the error propagates (use `jest.spyOn(display, 'printError')`)

- [x] Run `npm run validate` — all four steps must pass (AC: 12)

### Review Findings (2026-05-09)

**Patch — fix required:**

- [x] [Review][Patch] Move `printError` out of `InitService.scaffold()` into `InitCommand` catch block — service re-throws silently; command owns all user-facing output; also adds missing `printError` import to `init.command.ts` [AC9] [`src/services/init.service.ts:94`, `src/commands/init.command.ts`]
- [x] [Review][Patch] Deduplicate triplicated `INIT-UNIT-001` test label — three distinct tests share the same ID string, making failure output ambiguous [`tests/services/init.service.test.ts`]
- [x] [Review][Patch] Guard array index access in `init.command.test.ts` — `claudeWrites[claudeWrites.length - 1]` is `undefined` if filter returns empty array; add `toBeDefined()` assertion before accessing index [`tests/commands/init.command.test.ts:184`]
- [x] [Review][Patch] Handle bare `~` in `resolveVaultPath` — `~` without trailing `/` falls through to the return-as-is branch; `path.join('~', 'inbox')` creates a literal `~` directory relative to CWD [`src/services/init.service.ts:77`]
- [x] [Review][Patch] Add `printError` spy to error-path test in `init.service.test.ts` — "re-throws when createDirectory rejects" test never asserts `printError` was called; AC8 requires surfacing via printError is tested [AC8/AC10] [`tests/services/init.service.test.ts`]

**Deferred — pre-existing or out-of-scope:**

- [x] [Review][Defer] `Promise.all` partial failure leaves orphaned directories with no rollback [`src/services/init.service.ts:89`] — deferred, pre-existing pattern (old workspace-builder had same behaviour)
- [x] [Review][Defer] `configService.setWorkspacePath` persisted before scaffold — broken config on early return [`src/commands/init.command.ts:82`] — deferred, pre-existing ordering, not introduced by Story 2.1
- [x] [Review][Defer] `allTaskFiles` `Promise.all` outside try-catch — scaffold spinner hangs on task-file write failure — deferred, pre-existing code not in Story 2.1 scope
- [x] [Review][Defer] `claudeSpinner` never `.fail()`-ed if CLAUDE.md overwrite throws — deferred, pre-existing code not in Story 2.1 scope
- [x] [Review][Defer] Relative vault paths stored in config break on CWD change — deferred, design intent + pre-existing pattern
- [x] [Review][Defer] No writability pre-flight check on resolved vault path — deferred, out of scope for Story 2.1
- [x] [Review][Defer] `~/` (empty after tilde-slash) resolves directly to homedir, polluting `$HOME` — deferred, edge-case UX, out of scope
- [x] [Review][Defer] Stale "Story 4.1" describe block label in integration test — deferred, pre-existing
- [x] [Review][Defer] CLAUDE.md stub write failure leaves vault without `CLAUDE.md` (dirs created but file absent) — deferred, acceptable failure mode; idempotent on re-run
- [x] [Review][Defer] Process exits with code 0 on scaffold failure — deferred, spec says "return" not "exit(1)"; exit-code contract out of scope for Story 2.1

---

## Dev Notes

### Critical Context: What `InitCommand.run()` Currently Does

`src/commands/init.command.ts` currently has ALL init logic inline in `run()`:

```
1. displayWelcomeBanner()
2. promptWorkspacePath() → workspacePath
3. promptMinimalOnboarding() → answers (name, email, role, company)
4. configService.initialize() + configService.setWorkspacePath(workspacePath)
5. startSpinner('Creating workspace', plain)
6. await buildWorkspaceStructure(workspacePath)  ← THIS becomes initService.scaffold()
7. Write task files (my-tasks/tasks.md, today.md, this-week.md, this-month.md, this-quarter.md)
8. scaffoldSpinner.succeed('Workspace ready')
9. startSpinner('Generating CLAUDE.md', plain)
10. await fileSystemService.writeFile(join(workspacePath, 'CLAUDE.md'), generateClaudeMd(answers))  ← stays
11. claudeSpinner.succeed('CLAUDE.md generated')
12. startSpinner('Downloading Obsidian plugins', plain)
13. await obsidianPluginService.installPlugins(workspacePath)
14. displayNextSteps(workspacePath)
```

**For Story 2.1, change ONLY steps 2, 6.** Everything else stays unchanged.
- Step 2: add `workspacePath = initService.resolveVaultPath(workspacePath)` AFTER the prompt call
- Step 6: swap `buildWorkspaceStructure()` → `initService.scaffold(workspacePath)`
- Step 10 stays: `generateClaudeMd(answers)` overwrites the stub written by `scaffold()` — this is correct and idempotent

**Do NOT move steps 7–14 into InitService in this story.** That scope belongs to Stories 2.2–2.4.

### VAULT_DIRS — Exact List (12 entries)

```typescript
const VAULT_DIRS = [
  'inbox',
  'archive',
  'my-tasks',
  'my-teams/members',
  'my-teams/teams',
  'my-company/members',
  'my-company/projects',
  'my-leadership',
  'my-career',
  'knowledge-base',
  '.claude/skills',
  '.cursor/rules/tmr',
] as const;
```

**Do NOT include:** `utils`, `my-teams/feedback-templates`, `my-career/assessments`, `my-career/feedbacks`, `my-teams/archived`, `my-company/meetings`, `.tmr-core/*`, `.gemini/*`, `.claude/agents`, `.obsidian/plugins/*`, `config`, or any subdirs of `knowledge-base/`.

### Why `.obsidian/plugins/*` Is NOT in VAULT_DIRS

`FileSystemService.writeFile()` calls `await fs.ensureDir(path.dirname(filePath))` BEFORE writing — it auto-creates parent directories. `ObsidianPluginService.installPlugins()` uses `fileSystemService.writeFile()` to write plugin files, so it creates `.obsidian/plugins/<id>/` automatically. No pre-creation needed.

### Why `workspace-builder.ts` Must NOT Be Deleted

`tests/services/inbox-process.service.integration.test.ts` (line 170) imports `buildWorkspaceStructure` from `workspace-builder.ts` to set up test fixtures. Deleting it would break that test. Simply stop importing it in `init.command.ts` — the file stays in place.

### CLAUDE.md Stub Content

`InitService.scaffold()` writes a structural CLAUDE.md stub without user identity (those fields will be overwritten by `InitCommand.run()` via `generateClaudeMd(answers)` immediately after). Use this as the stub:

```typescript
function buildClaudeMdStub(): string {
  return [
    '# CLAUDE.md',
    '',
    '> This file provides context about the vault owner to Claude Code.',
    '> Generated by `tmr init` — edit freely to add more detail.',
    '',
    '## Identity',
    '',
    '- **Name:** (set during init)',
    '- **Email:** (set during init)',
    '- **Role:** (set during init)',
    '- **Company:** (set during init)',
    '',
    '## Vault Structure',
    '',
    '| Folder | Purpose |',
    '|--------|---------|',
    '| `inbox/` | Drop meeting notes, documents, and items to process |',
    '| `archive/` | Processed files moved by `tmr process` |',
    '| `my-career/` | Career development (assessments, feedbacks, PDP) |',
    '| `my-company/` | Company context: members, meetings, projects |',
    '| `my-leadership/` | Leadership principles and frameworks |',
    '| `my-tasks/` | Task tracking: tasks.md, today.md, this-week.md, this-month.md, this-quarter.md |',
    '| `my-teams/` | Team members, team definitions |',
    '| `knowledge-base/` | Company knowledge: branding, people, process, security |',
    '',
  ].join('\n');
}
```

### Error Handling Pattern

Follow the pattern used in other services — wrap FS operations, call `printError`, re-throw:

```typescript
async scaffold(vaultPath: string): Promise<void> {
  try {
    await Promise.all(
      VAULT_DIRS.map((dir) => this._fs.createDirectory(path.join(vaultPath, dir))),
    );
    await this._fs.writeFile(path.join(vaultPath, 'CLAUDE.md'), buildClaudeMdStub());
  } catch (err) {
    printError(
      `Failed to scaffold vault at ${vaultPath}: ${err instanceof Error ? err.message : String(err)}`,
    );
    throw err;
  }
}
```

In `InitCommand.run()`, wrap the `scaffold()` call to satisfy NFR2 (no stack traces visible to user):

```typescript
try {
  await initService.scaffold(workspacePath);
  scaffoldSpinner.succeed('Workspace ready');
} catch {
  scaffoldSpinner.fail('Workspace scaffolding failed');
  return; // printError was already called by InitService
}
```

### resolveVaultPath Implementation

```typescript
import { homedir } from 'node:os';
import path from 'node:path';

resolveVaultPath(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return process.cwd();
  if (trimmed.startsWith('~/')) return path.join(homedir(), trimmed.slice(2));
  return trimmed;
}
```

### Test Pattern for init.service.test.ts

Follow the exact mock pattern from `tests/services/email-resolution.service.test.ts`:

```typescript
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import path from 'node:path';
import { InitService } from '../../src/services/init.service.js';
import type { FileSystemService } from '../../src/services/file-system.service.js';

type MockFS = {
  createDirectory: jest.MockedFunction<FileSystemService['createDirectory']>;
  writeFile: jest.MockedFunction<FileSystemService['writeFile']>;
};

function createMockFS(): MockFS {
  return {
    createDirectory: jest.fn<FileSystemService['createDirectory']>().mockResolvedValue(undefined),
    writeFile: jest.fn<FileSystemService['writeFile']>().mockResolvedValue(undefined),
  };
}

const WS = '/fake/vault';

describe('InitService', () => {
  let svc: InitService;
  let mockFS: MockFS;

  beforeEach(() => {
    mockFS = createMockFS();
    svc = new InitService(mockFS as unknown as FileSystemService);
  });

  // INIT-UNIT-001 and INIT-UNIT-007 tests go here
  // ...
});
```

For INIT-UNIT-001, assert the full list individually:

```typescript
it('INIT-UNIT-001: creates all 12 required directories and no forbidden ones', async () => {
  await svc.scaffold(WS);
  const dirs = (mockFS.createDirectory.mock.calls as [string][]).map((c) => c[0]);
  const rel = dirs.map((d) => path.relative(WS, d));

  const required = [
    'inbox', 'archive', 'my-tasks',
    'my-teams/members', 'my-teams/teams',
    'my-company/members', 'my-company/projects',
    'my-leadership', 'my-career', 'knowledge-base',
    '.claude/skills', '.cursor/rules/tmr',
  ];
  for (const dir of required) {
    expect(rel).toContain(dir);
  }
  expect(rel).not.toContain('utils');
  expect(rel).not.toContain(path.join('my-teams', 'feedback-templates'));
});
```

### printError Import

`printError` is in `src/utils/display.ts` — import it as:

```typescript
import { printError } from '../utils/display.js';
```

To spy on it in tests: because `printError` is a named export from a module, you will need to dynamically import and spy, OR accept that `printError` writes to stderr and just check that the error is re-thrown. Simpler approach: spy on `process.stderr.write` and confirm it was called when createDirectory rejects.

### InitCommand Lazy Loading — Do Not Change

`src/cli.ts` already lazy-loads `init.command.ts` via `await import('./commands/init.command.js')` inside the `.action()` callback. Do not change this. `InitService` is imported statically inside `init.command.ts` — that is correct (InitService has no heavy deps).

### promptWorkspacePath Default Change

In `src/workflows/onboarding.prompts.ts`, change:

```typescript
// BEFORE
default: '~/tech-leadership-workspace',

// AFTER
default: process.cwd(),
```

This makes the CWD the visible suggestion when the user hits Enter. `initService.resolveVaultPath()` handles the case where the user submits an empty string (though with this default set, the prompt returns `process.cwd()` directly when Enter is pressed, not `''`).

The INIT-INT-002 test (in Story 2.2's integration test) will mock `promptWorkspacePath` returning `''` to prove `resolveVaultPath('')` → CWD. Both paths are covered.

---

## Dev Agent Record

### Debug Log References

**init.command.test.ts double-write fix:** scaffold() writes CLAUDE.md stub first; InitCommand then overwrites with user data via generateClaudeMd(answers). Existing assertions used `find()` (returning first write = stub). Fixed by using `filter().slice(-1)[0]` to grab the last CLAUDE.md write. `findLast()` was considered but rejected — TypeScript lib target below ES2023.

**init.integration.test.ts contract update:** Old test was written against `buildWorkspaceStructure` which created 35+ directories. Story 2.1 replaces this with 12-entry VAULT_DIRS. 7 tests updated: 6 positive assertions replaced with correct new VAULT_DIRS assertions, and `my-teams/feedback-templates` converted to a negative assertion (per AC3).

### Completion Notes List

- Created `InitService` with `VAULT_DIRS` (12 entries), `resolveVaultPath()`, `scaffold()`, and `buildClaudeMdStub()`. Uses DI (`FileSystemService`) for testability and exports singleton `initService`.
- `scaffold()` calls `Promise.all` for parallel directory creation, writes CLAUDE.md stub, wraps errors with `printError` + re-throws (AC8/NFR1).
- `InitCommand.run()` now calls `initService.resolveVaultPath(rawPath)` to canonicalize vault path, then `initService.scaffold(workspacePath)` wrapped in try/catch (AC9/NFR2). `buildWorkspaceStructure` import removed — `workspace-builder.ts` kept in place (used by inbox integration test fixtures).
- `promptWorkspacePath()` default changed to `process.cwd()` (AC7).
- 13 unit tests + 29 integration tests pass. Full suite: 844 tests, 0 failures. `npm run validate` exits 0.

### File List

**NEW:**
- `src/services/init.service.ts`
- `tests/services/init.service.test.ts`

**MODIFIED:**
- `src/commands/init.command.ts`
- `src/workflows/onboarding.prompts.ts`
- `tests/commands/init.command.test.ts`
- `tests/integration/init.integration.test.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/2-1-vault-scaffold-and-folder-structure.md`

### Change Log

- 2026-05-09: Story 2.1 implemented — new `InitService` with `scaffold()` and `resolveVaultPath()`, replaced `buildWorkspaceStructure` in `InitCommand`, updated `promptWorkspacePath` default to CWD, updated two test files for new double-write contract, updated integration test to reflect new 12-dir VAULT_DIRS contract. `npm run validate` exits 0 (844 tests pass).
