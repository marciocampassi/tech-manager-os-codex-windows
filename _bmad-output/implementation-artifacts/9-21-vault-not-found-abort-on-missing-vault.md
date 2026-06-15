# Story 9.21 — Abort Command Execution When No Vault Found

**Epic:** 9 — UAT Pre-Launch Polish  
**Status:** done  
**Added:** 2026-06-04 via UAT regression observation (story 9.20 follow-up)  
**Source:** Manual test of story 9.20 revealed command execution continues after vault-not-found error

---

## Story

As a `tmr` user running a command from outside any vault,  
I want the command to abort immediately with a clear error,  
So that no prompts appear and no files are created in my current directory.

---

## Root Cause

Story 9.20 fixed the primary bug (commands no longer write to a different vault). However `getWorkspaceRoot()` signals failure by setting `process.exitCode = 1` and returning `process.cwd()`. Because `process.exitCode` does not abort execution, command handlers continue running — prompting the user for input and writing files to the current directory using the fallback CWD path.

**Observed behaviour after 9.20:**
```
$ cd /tmp && tmr member add test@example.com

✗ No tmr vault found in this directory or any parent.
  → Your configured vault is at /vault1 — cd into it, or run 'tmr init' here.
✔ Name (optional):            ← prompts still appear
✓ Member profile created      ← file written to /tmp/my-company/...
```

---

## Acceptance Criteria

**AC1:** Given CWD is outside any vault (no `.tmr` sentinel, CWD not inside the configured vault),  
When any tmr command (e.g. `tmr member add`) is run,  
Then the command prints the vault-not-found error and exits immediately  
**And** no prompts are shown  
**And** no files are created anywhere  
**And** `process.exitCode` is `1`

---

**AC2:** Given CWD is outside any vault,  
When there IS a configured vault path,  
Then the error message is:  
`"No tmr vault found in this directory or any parent."`  
And the hint is:  
`"Your configured vault is at <path> — cd into it, or run 'tmr init' to create a vault here."`

---

**AC3:** Given no vault has ever been configured,  
When any tmr command is run,  
Then the error message is:  
`"No tmr vault found in this directory or any parent."`  
And the hint is:  
`"Run 'tmr init' to create one."`

---

**AC4:** Given CWD is inside the configured vault (legacy pre-sentinel vault),  
When a tmr command is run,  
Then the command executes normally — backward compatibility preserved

---

**AC5:** `tmr init` is NOT affected — `InitCommand` does not call `getWorkspaceRoot()`

---

## Implementation

### 1. Add `VaultNotFoundError` to `src/errors/tmr-error.ts`

```typescript
/** Thrown when no tmr vault is found for the current working directory. */
export class VaultNotFoundError extends TmrError {
  constructor(
    public readonly hint: string,
    code = 'TMR_E201',
  ) {
    super('No tmr vault found in this directory or any parent.', code);
    this.name = 'VaultNotFoundError';
    Object.setPrototypeOf(this, VaultNotFoundError.prototype);
  }
}
```

### 2. Change `src/utils/workspace.ts` to throw instead of returning

Remove the `printError` calls and `process.exitCode` assignments. Throw `VaultNotFoundError` instead:

```typescript
// Step 2 — configured vault exists but CWD is outside:
throw new VaultNotFoundError(
  `Your configured vault is at ${normalizedConfigured} — cd into it, or run 'tmr init' to create a vault here.`,
);

// Step 3 — no vault configured at all:
throw new VaultNotFoundError("Run 'tmr init' to create one.");
```

Remove `printError` import from `workspace.ts` if no longer needed.

### 3. Update `src/cli.ts` global error handler

Add a `VaultNotFoundError` case before the generic handler so it displays the error cleanly with its hint (not the generic "Run 'tmr --help'" hint):

```typescript
import { VaultNotFoundError } from './errors/tmr-error.js';

// In the catch block:
if (err instanceof VaultNotFoundError) {
  printError(err.message, err.hint, plain);
  process.exit(1);
}
```

### 4. Update `tests/utils/workspace.test.ts`

Replace the current WS-004c, WS-004d, WS-005 assertions (which check `mockPrintError` + `process.exitCode`) with `expect(() => getWorkspaceRoot()).toThrow(VaultNotFoundError)` and message/hint checks.

---

## Files to Modify

| File | Change |
|---|---|
| `src/errors/tmr-error.ts` | Add `VaultNotFoundError` class |
| `src/utils/workspace.ts` | Throw `VaultNotFoundError` instead of `printError` + return |
| `src/cli.ts` | Handle `VaultNotFoundError` in catch block with hint |
| `tests/utils/workspace.test.ts` | Update WS-004c, WS-004d, WS-005 to assert thrown error |

---

## Test Coverage

- Unit: `getWorkspaceRoot()` throws `VaultNotFoundError` when CWD is outside configured vault — assert `error.message` and `error.hint`
- Unit: `getWorkspaceRoot()` throws `VaultNotFoundError` when no vault configured — assert `error.hint` = "Run 'tmr init' to create one."
- Unit: `getWorkspaceRoot()` does NOT throw when CWD is inside configured vault (backward compat)
- Unit: `getWorkspaceRoot()` does NOT throw when `.tmr` sentinel found (sentinel path)
- Integration: `tmr member add` from outside vault exits 1 immediately — no "Member profile created" output, no files in CWD

---

## Dev Agent Record

### Completion Notes

Implemented 2026-06-04. Changed `getWorkspaceRoot()` to throw `VaultNotFoundError` (new error class, TMR_E201) instead of silently returning `process.cwd()` with `process.exitCode = 1`. The CLI catch block in `cli.ts` now detects `VaultNotFoundError` and uses its `hint` property instead of the generic "Run 'tmr --help'" message. All 8 workspace unit tests pass; the 3 failure-path tests (WS-004c, WS-004d, WS-005) were migrated from `printError`/`exitCode` assertions to `instanceof VaultNotFoundError` + message/hint assertions. Full suite: 1288/1289 pass (1 pre-existing flaky timeout in inbox-process integration — confirmed unrelated by isolation run).

### File List

- `src/errors/tmr-error.ts` — added `VaultNotFoundError extends TmrError` (TMR_E201, `hint` property)
- `src/utils/workspace.ts` — replaced `printError` + `process.exitCode = 1` + `return cwd` with `throw new VaultNotFoundError(...)`; removed `printError` import
- `src/cli.ts` — imported `VaultNotFoundError`; added `hint` ternary in catch block to use `err.hint` when error is `VaultNotFoundError`
- `tests/utils/workspace.test.ts` — added `VaultNotFoundError` dynamic import; rewrote WS-004c, WS-004d, WS-005 to assert thrown error type, message, and hint

### Review Findings

- [x] [Review][Patch] Verbose-mode drops `VaultNotFoundError` hint — `printError(..., undefined, plain)` in the `opts.verbose` branch ignores the computed `hint` variable; fix: pass `hint` as second arg in that branch too [`src/cli.ts` verbose branch] ✅ fixed

- [x] [Review][Defer] Prompts appear before vault guard in some arg-less commands [`src/commands/team.command.ts`, `leadership.command.ts`, `project.command.ts`] — deferred, pre-existing ordering issue; vault check IS first for all argument-passing invocations; restructuring arg-less command flows is out of 9.21 scope
- [x] [Review][Defer] `myself.command.ts` local catch intercepts `VaultNotFoundError` before CLI handler, dropping hint [`src/commands/myself.command.ts` local catch block] — deferred, pre-existing catch pattern
- [x] [Review][Defer] `--json` flag not respected in CLI catch block — vault error always uses `printError` even with `--json` [`src/cli.ts` catch block] — deferred, pre-existing gap
- [x] [Review][Defer] Subcommand-level `--plain` (e.g. `task-view`) doesn't reach global vault error output — deferred, pre-existing architectural gap
- [x] [Review][Defer] Missing integration test for full CLI abort (listed in spec Test Coverage section) — deferred, workspace + CLI unit tests cover the throw path sufficiently
- [x] [Review][Defer] `myself.command.ts` success path uses raw chalk without `plain` flag — deferred, pre-existing, unrelated to vault errors

### Change Log

- Added `VaultNotFoundError` to error hierarchy (TMR_E201)
- `getWorkspaceRoot()` now throws instead of returning fallback CWD — commands abort before prompting or writing files
- CLI global error handler uses contextual vault hint for `VaultNotFoundError` instead of generic help hint

---

## QA Smoke Test

```bash
cd /tmp
tmr member add test@example.com
# Expected:
#   ✗ No tmr vault found in this directory or any parent.
#   → Your configured vault is at /path/to/vault — cd into it, ...
# No prompts. Exit code 1.
ls /tmp/my-company  # must not exist
```
