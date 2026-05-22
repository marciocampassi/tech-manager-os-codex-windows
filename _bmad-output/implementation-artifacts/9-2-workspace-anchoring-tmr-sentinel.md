# Story 9.2 — Workspace Anchoring (.tmr Sentinel File)

## Metadata

| Field | Value |
|---|---|
| **Epic** | Epic 9 — UAT Pre-Launch Polish |
| **Story ID** | 9.2 |
| **Priority** | High — critical UX bug affecting every command |
| **Effort** | S |
| **Risk** | Low — additive change; falls back gracefully |

---

## Problem Statement

`getWorkspaceRoot()` in `src/utils/workspace.ts` falls back to `process.cwd()` when no workspace path is stored in config. Running any `tmr` command from a directory other than the original init location silently operates on the wrong vault — or produces confusing "file not found" errors.

The fix mirrors how `git` works: `tmr init` plants a sentinel file at the vault root. All commands detect that file by walking up the directory tree from wherever they are invoked, making the workspace self-identifying regardless of the user's current directory.

---

## Acceptance Criteria

- After `tmr init`, a `.tmr` file exists at the vault root containing valid JSON with at least `version` and `created` fields
- Running any `tmr` command from a subdirectory inside the vault resolves the correct vault root
- Running any `tmr` command from a directory outside any vault root prints a clear error and exits non-zero: `"No tmr vault found in this directory or any parent. Run 'tmr init' to create one."`
- Running `tmr init` when a `.tmr` file already exists anywhere in the current directory tree prints a clear error and exits non-zero: `"A tmr vault already exists at <resolved-path>. Use existing vault or choose a different directory."`
- The `configService.getWorkspacePath()` fallback is preserved for backward compatibility — existing vaults without `.tmr` continue to work via the config path

---

## Files to Change

| File | Change |
|---|---|
| `src/utils/workspace.ts` | Rewrite `getWorkspaceRoot()` to walk up from `process.cwd()` looking for `.tmr`; fall back to `configService.getWorkspacePath()` for backward compat; error if neither found |
| `src/services/init.service.ts` | Add `writeSentinel(vaultPath)` method; call it at end of `scaffold()`; add `findExistingVault(fromDir)` helper used by init command to detect re-init |
| `src/commands/init.command.ts` | Before starting the init flow, call `InitService.findExistingVault(process.cwd())`; if found, print error and return |
| `tests/utils/workspace.test.ts` | New test file — covers walk-up resolution, missing sentinel, config fallback |
| `tests/services/init.service.test.ts` | Add tests for `writeSentinel()` and `findExistingVault()` |

---

## Implementation Detail

### 1 — Sentinel file format

Written to `<vaultPath>/.tmr`:
```json
{
  "version": "1.0.0",
  "created": "YYYY-MM-DD"
}
```

`version` refers to the tmr schema version, not the app version. Set to `"1.0.0"` for all vaults created by this story.

### 2 — `getWorkspaceRoot()` walk-up logic

```typescript
export function getWorkspaceRoot(): string {
  // 1. Walk up from cwd looking for .tmr sentinel
  let dir = process.cwd();
  while (true) {
    if (fs.existsSync(path.join(dir, '.tmr'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break; // reached filesystem root
    dir = parent;
  }

  // 2. Fall back to config-stored path (backward compat for vaults without .tmr)
  const configured = configService.getWorkspacePath();
  if (configured) return configured;

  // 3. No vault found anywhere
  printError(
    'No tmr vault found in this directory or any parent.',
    "Run 'tmr init' to create one.",
  );
  process.exitCode = 1;
  // Return cwd to avoid crashing callers that don't check exitCode immediately
  return process.cwd();
}
```

Note: `getWorkspaceRoot()` is synchronous (matches current signature). Use `fs.existsSync` here — do NOT make it async; that would require updating every caller.

### 3 — `InitService.writeSentinel(vaultPath)`

```typescript
async writeSentinel(vaultPath: string): Promise<void> {
  const content = JSON.stringify(
    { version: '1.0.0', created: todayIso() },
    null,
    2,
  );
  await this._fs.writeFile(path.join(vaultPath, '.tmr'), content);
}
```

Call at the end of `scaffold()`, after all directories and `CLAUDE.md` are written.

### 4 — `InitService.findExistingVault(fromDir)`

```typescript
findExistingVault(fromDir: string): string | null {
  let dir = fromDir;
  while (true) {
    const sentinel = path.join(dir, '.tmr');
    if (fs.existsSync(sentinel)) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}
```

### 5 — `init.command.ts` guard

At the very start of the init action, before any prompts:

```typescript
const existingVault = initService.findExistingVault(process.cwd());
if (existingVault) {
  printError(
    `A tmr vault already exists at: ${existingVault}`,
    'Use the existing vault or choose a different directory.',
  );
  process.exitCode = 1;
  return;
}
```

---

## Notes for Developer Agent

- `getWorkspaceRoot()` must remain **synchronous** — it is called in constructor-level expressions and synchronous code paths across many services. Do not change the return type to `Promise<string>`.
- The walk-up uses `fs.existsSync` (Node built-in `node:fs`) — do not use `FileSystemService` here since `FileSystemService` is async.
- `.tmr` should be added to `.gitignore` if the project has one, or to the vault's own ignore configuration — it is a machine-local marker, not a file to commit.
- Backward compat: existing users who ran `tmr init` before this story have their workspace stored in `~/.config/tmr/config.json` via `ConfigService`. The fallback to `configService.getWorkspacePath()` ensures their commands continue to work. They will not get the walk-up benefit until they re-init or manually place a `.tmr` file, which is acceptable.
- Run `npm run validate` before marking done.
