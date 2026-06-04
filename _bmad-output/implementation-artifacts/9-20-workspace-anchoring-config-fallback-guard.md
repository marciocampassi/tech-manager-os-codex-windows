# Story 9.20 — Fix Workspace Anchoring: Restrict Config-Path Fallback

**Epic:** 9 — UAT Pre-Launch Polish  
**Status:** Ready for dev  
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
