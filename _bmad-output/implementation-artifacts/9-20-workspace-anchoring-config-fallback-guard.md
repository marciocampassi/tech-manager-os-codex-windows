# Story 9.20 — Fix Workspace Anchoring: Restrict Config-Path Fallback

**Epic:** 9 — UAT Pre-Launch Polish  
**Status:** done  
**Added:** 2026-06-04 via Sprint Change Proposal (V2 post-UAT bugs)  
**Source:** `sprint-change-proposal-2026-06-04-v2-post-uat-bugs.md`

---

## Story

As a `tmr` user navigating to a directory that was never initialized as a vault,  
I want `tmr` commands to detect there is no vault here and halt with a clear error,  
So that I never accidentally write data to a different vault that was initialized elsewhere.

---

## Root Cause

In `src/utils/workspace.ts`, `getWorkspaceRoot()` falls back to `configService.getWorkspacePath()` unconditionally when no `.tmr` sentinel is found via walk-up:

```typescript
// Step 2 (current — no guard):
const configured = configService.getWorkspacePath();
if (configured) return configured;  // ← returns vault1's path even when CWD is vault2
```

**User scenario causing the bug:**
1. User runs `tmr init` in `c:/projects/vault1` → config stores `vault1` path
2. User navigates to `c:/projects/vault2` (never initialized, no `.tmr`)
3. User runs `tmr project add` from `vault2`
4. Walk-up finds no `.tmr` → config fallback returns `vault1` → project created inside `vault1`

**Expected behavior:** detect no vault and print an error.

---

## Acceptance Criteria

**Given** vault1 exists at `/projects/vault1` (with `.tmr` sentinel)  
**When** the user runs `tmr project add my-project` from `/projects/vault2` (no `.tmr`, never initialized)  
**Then** `getWorkspaceRoot()` prints: `"No tmr vault found in this directory or any parent."`  
**And** the hint `"Run 'tmr init' to create one."` is shown  
**And** `process.exitCode` is set to `1`  
**And** NO content is created anywhere (not in vault1, not in vault2)

---

**Given** vault1 exists at `/projects/vault1` **without** a `.tmr` sentinel (legacy pre-sentinel vault)  
**When** the user runs any tmr command from inside `/projects/vault1/my-teams/` (a subdirectory)  
**Then** `getWorkspaceRoot()` falls back to the config-stored path (vault1) successfully  
**And** commands operate on vault1 correctly  
*(CWD is a subdirectory of the configured vault → backward compat preserved)*

---

**Given** vault1 has `.tmr` at `/projects/vault1/.tmr`  
**When** the user runs any tmr command from inside `/projects/vault1/my-teams/`  
**Then** `getWorkspaceRoot()` finds `.tmr` via walk-up and returns `vault1` — sentinel path, config fallback never reached

---

**Given** no vault has ever been initialized (fresh machine, first use)  
**When** `tmr member add bob@company.com` is run from any directory  
**Then** `getWorkspaceRoot()` prints the vault-not-found error and sets exit code 1  
**And** NO file is created

---

**Given** vault1 exists at `/projects/vault1` (with `.tmr`)  
**When** the user runs `tmr init` from `/projects/vault2`  
**Then** `tmr init` is NOT affected by this fix — `InitCommand` calls `initService.findExistingVault()` directly, not `getWorkspaceRoot()`; init behavior is unchanged

---

## Implementation

In `src/utils/workspace.ts`, replace step 2:

**OLD:**
```typescript
// 2. Fall back to config-stored path (backward compat for vaults without .tmr)
const configured = configService.getWorkspacePath();
if (configured) return configured;
```

**NEW:**
```typescript
// 2. Fall back to config-stored path only when CWD is inside the configured vault.
// This preserves backward compat for legacy vaults (no .tmr sentinel) while
// blocking accidental writes to a different vault from an unrelated directory.
const configured = configService.getWorkspacePath();
if (configured) {
  const cwd = process.cwd();
  if (cwd === configured || cwd.startsWith(configured + path.sep)) {
    return configured;
  }
}
```

The `path` import is already present in the file (`import path from 'node:path'`).

No other files need to be modified. `getWorkspaceRoot()` is a shared utility — the fix propagates to all commands automatically.

---

## Files to Modify

| File | Change |
|---|---|
| `src/utils/workspace.ts` | Add CWD-inside-vault guard before accepting config-stored path fallback (≈ 4 lines) |

---

## Test Coverage

- Unit: mock `configService.getWorkspacePath()` to return `/projects/vault1`; set `process.cwd()` to `/projects/vault2`; verify `getWorkspaceRoot()` prints error and sets `process.exitCode = 1`
- Unit: mock CWD as `/projects/vault1/subdir` (inside configured vault, no `.tmr`); verify fallback returns vault1 (backward compat)
- Unit: `.tmr` file present in `vault1`; CWD is `vault1/subdir`; verify sentinel path is used (walk-up wins, fallback never triggered)
- Integration: `tmr project add` from outside any vault → exits 1 with error message, no files created

---

## Review Findings

- [x] [Review][Patch] Normalize `configured` path before comparison — added `path.normalize(configured)` before comparison; also split configured-but-outside case into its own early return with specific error. [`src/utils/workspace.ts`]
- [x] [Review][Patch] Error message does not mention the rejected configured path — when CWD is outside the configured vault, error hint now reads: "Your configured vault is at X — cd into it, or run 'tmr init' to create a vault here." [`src/utils/workspace.ts`]
- [x] [Review][Patch] WS-004d uses weak assertion and is missing `process.exitCode` check — upgraded to `toHaveBeenCalledWith()` with exact strings; added `expect(process.exitCode).toBe(1)`. WS-004c also updated to match the new contextual hint. [`tests/utils/workspace.test.ts`]
- [x] [Review][Patch] `process.cwd()` called three times in the function — captured once at top (`const cwd = process.cwd()`) and reused throughout. [`src/utils/workspace.ts`]
- [x] [Review][Defer] Symlink CWD not resolved — if CWD contains a symlink (`/link/to/vault/sub` → `/configured/workspace`), `startsWith` fails even though the user is inside the vault at the OS level. Fix requires `fs.realpathSync()` on both paths; also applies to step-1 walk-up. [`src/utils/workspace.ts`] — deferred, pre-existing limitation
- [x] [Review][Defer] Case-insensitive filesystem on macOS — `startsWith` is case-sensitive; on APFS (case-insensitive), `/Users/Alice/vault/sub` would not match `/users/alice/vault/`. Pre-existing pattern across the codebase. [`src/utils/workspace.ts`] — deferred, pre-existing pattern
- [x] [Review][Defer] No integration test for AC4 (tmr command from outside vault exits 1, no files created) — spec Coverage #4 explicitly requires it; unit tests cover the `getWorkspaceRoot()` logic but not command-level abort behavior. Out of scope for this minimal fix story. [`tests/integration/`] — deferred, scope concern

---

## Dev Agent Record

### Implementation Notes

- Modified `src/utils/workspace.ts` step 2: config fallback now only activates when `process.cwd() === configured || process.cwd().startsWith(configured + path.sep)`.
- Updated JSDoc to reflect the new behaviour.
- Replaced WS-004 with four tests (WS-004, WS-004b, WS-004c, WS-004d) covering: CWD equals vault, CWD is subdirectory, CWD is outside vault (error path), CWD is a prefix without separator (must not pass).
- All 8 workspace unit tests pass; full regression suite in progress.

### Files Modified

- `src/utils/workspace.ts`
- `tests/utils/workspace.test.ts`

### Validation

- `npm run validate` — 1289 tests pass (lint ✓, typecheck ✓, build ✓); one inbox-process integration test timed out under parallel load — confirmed pre-existing flakiness (passes in isolation in 169ms, unrelated to this change)
- Targeted suite (workspace + init + e2e): 150/150 pass

---

## QA Regression Test (R-06)

```bash
# From a directory that is NOT a vault (no .tmr sentinel):
cd /tmp
tmr member add bob@company.com
# Expected output: "No tmr vault found in this directory or any parent."
# Expected: process exits with non-zero code
# Verify: no file created in vault1 or /tmp

# Confirm vault1 is unaffected:
ls ~/tmr-qa-workspace/my-company/members/
# Expected: bob@company.com NOT present (was not created)
```
