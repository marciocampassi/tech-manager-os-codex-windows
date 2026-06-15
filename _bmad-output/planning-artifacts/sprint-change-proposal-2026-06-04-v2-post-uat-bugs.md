# Sprint Change Proposal — V2 Post-UAT Bug Fixes

**Date:** 2026-06-04  
**Prepared by:** Developer Agent (Correct Course workflow)  
**Status:** Pending User Approval

---

## Section 1: Issue Summary

### Problem Statement

Two bugs were identified during V2 QA testing that prevent the product from shipping in a functional state:

**Bug 1 — Obsidian plugins not installed or active after `tmr init`:**  
After running `tmr init` (full init, without `--scaffold-only`), the four community plugins (`obsidian-git`, `granola-sync`, `terminal`, `dataview`) do not appear installed and active in Obsidian. The `.obsidian/plugins/` folder is expected to contain plugin files for all four plugins; instead it is absent or incomplete.

**Bug 2 — `tmr` commands write to vault1 when run from vault2 (no `.tmr`):**  
When a user navigates to a directory that was never initialized as a vault (no `.tmr` sentinel file) and runs a vault-write command such as `tmr project add`, the CLI silently falls back to the config-stored workspace path (the last initialized vault) and writes content there. Expected behavior: detect the absence of `.tmr` and halt with a clear error message.

### Discovery Context

- **Bug 1** was discovered during manual QA testing of the full `tmr init` flow (scoped to Epic 9 QA smoke test T-23 validation).
- **Bug 2** was discovered during manual workspace anchoring validation (Epic 9 Story 9.2 scope).

### Evidence (from codebase analysis)

**Bug 1 — Root cause in `src/services/obsidian-plugin.service.ts`:**

```typescript
// Line 89-92: community-plugins.json ALWAYS includes all 4 plugins,
// even when downloads fail. Obsidian tries to load plugins whose files
// don't exist on disk.
await fileSystemService.writeFile(
  join(obsidianDir, 'community-plugins.json'),
  JSON.stringify(OBSIDIAN_PLUGINS.map((p) => p.id)),  // ← always all 4
);
```

- `downloadPluginFile()` returns `false` without calling `writeFile` when `!res.ok` — so plugin directories are never created for failed downloads.
- The `fullyFailedPlugins` array is computed correctly but never used to filter `community-plugins.json`.
- Result: Obsidian sees 4 "enabled" plugins in the JSON but finds no files on disk. Plugins fail silently.

**Bug 2 — Root cause in `src/utils/workspace.ts`:**

```typescript
// Line 24-26: config-stored path fallback with NO guard on CWD location.
// If CWD is in vault2 and config points to vault1, commands run against vault1.
const configured = configService.getWorkspacePath();
if (configured) return configured;  // ← no CWD-inside-vault check
```

- Walk-up from `vault2` finds no `.tmr` → falls through to config fallback → returns `vault1` path → commands write to `vault1`.
- The guard "CWD must be inside the configured vault" was never added after the sentinel system was introduced in Story 9.2.

---

## Section 2: Impact Analysis

### Epic Impact

| Epic | Impact |
|---|---|
| **Epic 2** (`tmr init`) | [x] Bug 1 is in the plugin installation step of `tmr init`. No spec change — implementation fix only. |
| **Epic 7** (Zero-Friction Setup) | [x] `tmr doctor` community-plugins check (Story 9.17) is unaffected — it correctly reports missing files. |
| **Epic 9** (UAT Pre-Launch Polish) | [!] Two corrective stories (9.19, 9.20) must be added before launch. |
| **All other Epics** | [N/A] |

### Story Impact

| Story | Impact |
|---|---|
| **Story 9.18** (`--scaffold-only`) | [x] Existing spec is correct. Bug 1 fix (Story 9.19) must not regress scaffold-only behavior. |
| **Story 9.2** (Workspace anchoring) | [!] Sentinel walk-up was correctly implemented; config fallback guard was omitted. Story 9.20 corrects this. |
| **Stories 9.1–9.17** | [N/A] — not affected. |

### Artifact Conflicts

| Artifact | Conflict | Resolution |
|---|---|---|
| `epics.md` | Stories 9.19 and 9.20 are missing | Append both stories to Epic 9 |
| `epic-9-qa-smoke-test.md` | T-23 and T-03 pass criteria need extension | Add two new regression test cases |
| `project-context.md` | No rule changes needed — existing intent is correct | [N/A] |

### Technical Impact

| Component | Change |
|---|---|
| `src/services/obsidian-plugin.service.ts` | Track successfully installed plugins; filter `community-plugins.json`; pre-create `.obsidian/plugins/` dir |
| `src/commands/init.command.ts` | Update plugin spinner message to reflect actual count installed |
| `src/utils/workspace.ts` | Add CWD-inside-vault guard before accepting config fallback |

---

## Section 3: Recommended Approach

**Selected approach: Direct Adjustment (Option 1)**

Both bugs are contained implementation defects in existing files. No PRD goals are affected, no architectural changes are needed, and the MVP scope is unchanged. Two new corrective stories added to Epic 9 are sufficient.

**Rationale:**
- **Effort:** Low — both fixes are surgical, well-isolated changes (< 30 lines each)
- **Risk:** Low — no new architecture, no new dependencies, no behavioral changes for happy paths
- **Timeline:** Minimal — completable within the current sprint
- **MVP:** Unaffected — both features were in scope and correctly spec'd; only the implementation needs correction

---

## Section 4: Detailed Change Proposals

---

### Story 9.19: Fix Obsidian plugin installation accuracy

**As a user running `tmr init` (full, not scaffold-only),**  
I want the Obsidian plugin installation step to only register plugins that were actually downloaded successfully,  
So that when I open Obsidian, the plugins listed as enabled actually have their files on disk and can be loaded.

#### Acceptance Criteria

**Given** `ObsidianPluginService.installPlugins()` runs  
**When** all 4 plugins download successfully (2xx responses for `main.js` and `manifest.json`)  
**Then** all 4 plugin IDs appear in `.obsidian/community-plugins.json`  
**And** `.obsidian/plugins/<id>/main.js` and `.obsidian/plugins/<id>/manifest.json` exist for each

**Given** a plugin's `main.js` or `manifest.json` download fails (non-2xx or network error)  
**When** `installPlugins()` completes  
**Then** that plugin's ID is **NOT included** in `.obsidian/community-plugins.json`  
**And** `printWarning` outputs the failed plugin ID with a remediation URL (`https://obsidian.md/plugins`)

**Given** `installPlugins()` is called  
**When** it begins execution  
**Then** `.obsidian/plugins/` directory is created via `fileSystemService.createDirectory()` before any download attempt

**Given** `InitCommand` calls `obsidianPluginService.installPlugins()`  
**When** some plugins succeed and some fail  
**Then** the spinner message reflects the actual count (e.g. `"Obsidian plugins: 3/4 installed"`)  
**And** fully-failed plugins are reported individually via `printWarning`

**Given** `--scaffold-only` flag is set  
**When** init runs  
**Then** `installPlugins()` is NOT called (existing Story 9.18 behavior preserved, no regression)

#### Files Modified

- `src/services/obsidian-plugin.service.ts` — filter `community-plugins.json` to only successfully installed plugins; explicitly create `.obsidian/plugins/` before downloads
- `src/commands/init.command.ts` — update spinner to show `X/4 installed` count; surface per-plugin warnings

---

### Story 9.20: Fix workspace anchoring — restrict config-path fallback

**As a `tmr` user navigating to an uninitialized directory,**  
I want `tmr` commands to detect there is no vault here and halt with a clear error,  
So that I never accidentally write data to a vault in a different directory.

#### Acceptance Criteria

**Given** vault1 exists at `/projects/vault1` (with `.tmr`)  
**When** the user runs `tmr project add my-project` from `/projects/vault2` (no `.tmr`, never initialized)  
**Then** `getWorkspaceRoot()` prints: `"No tmr vault found in this directory or any parent."` with hint `"Run 'tmr init' to create one."`  
**And** `process.exitCode` is set to `1`  
**And** NO content is created anywhere (neither vault1 nor vault2)

**Given** vault1 exists at `/projects/vault1` WITHOUT a `.tmr` sentinel (legacy pre-sentinel vault)  
**When** the user runs any tmr command from inside `/projects/vault1/subdir`  
**Then** `getWorkspaceRoot()` falls back to the config-stored path (vault1) — backward compatibility preserved  
*(CWD is inside the configured vault → safe fallback)*

**Given** vault1 has `.tmr` at `/projects/vault1/.tmr`  
**When** the user runs any tmr command from inside `/projects/vault1/subdir`  
**Then** `getWorkspaceRoot()` finds `.tmr` via walk-up — sentinel takes priority, config fallback not needed

**Given** no vault has ever been initialized (clean machine, first run)  
**When** `tmr member add bob@company.com` is run from any directory  
**Then** `getWorkspaceRoot()` prints the vault-not-found error and exits non-zero

#### Implementation Detail

In `src/utils/workspace.ts`, replace:

```typescript
// Step 2 (current — no guard)
const configured = configService.getWorkspacePath();
if (configured) return configured;
```

With:

```typescript
// Step 2 (fixed — CWD must be inside the configured vault for backward compat)
const configured = configService.getWorkspacePath();
if (configured) {
  const cwd = process.cwd();
  if (cwd === configured || cwd.startsWith(configured + path.sep)) {
    return configured;
  }
}
```

#### Files Modified

- `src/utils/workspace.ts` — add CWD-inside-vault guard before accepting config fallback

---

## Section 5: Implementation Handoff

**Change scope classification: Minor**

Both stories are self-contained, surgical fixes with no cross-service dependencies. The Developer agent can implement directly without PO or Architect involvement.

**Handoff recipient:** Developer agent  
**Deliverables:**
1. Story 9.19 — `src/services/obsidian-plugin.service.ts` and `src/commands/init.command.ts` updated; plugin files exist + `community-plugins.json` reflects actual install state
2. Story 9.20 — `src/utils/workspace.ts` updated; `tmr project add` from vault2 errors instead of writing to vault1

**Updated QA smoke tests (extend existing test file):**

*T-23 extension — after full init, verify plugin files:*
```bash
ls .obsidian/plugins/
# Must show: obsidian-git/  granola-sync/  terminal/  dataview/
ls .obsidian/plugins/obsidian-git/
# Must show: main.js  manifest.json
cat .obsidian/community-plugins.json
# Must show the IDs of all successfully downloaded plugins
```

*New regression test R-06 — vault anchoring guard:*
```bash
# From a directory that is NOT a vault (no .tmr):
cd /tmp
tmr member add bob@company.com
# Expected: "No tmr vault found in this directory or any parent."
# Expected: exits non-zero
# Expected: NO file created in vault1 or /tmp
```

**Success criteria:**
1. `tmr init` (full) → `.obsidian/plugins/` exists with plugin subdirectories → plugins appear enabled in Obsidian
2. `tmr <any-write-command>` from outside any vault → "No tmr vault found" error → exit 1 → no content created

---

*Workflow: bmad-correct-course | Correct Course workflow complete — routed to Developer agent.*
