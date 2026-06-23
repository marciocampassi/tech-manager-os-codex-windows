# Story 9.19 — Fix Obsidian Plugin Installation Accuracy

**Epic:** 9 — UAT Pre-Launch Polish  
**Status:** done  
**Added:** 2026-06-04 via Sprint Change Proposal (V2 post-UAT bugs)  
**Source:** `sprint-change-proposal-2026-06-04-v2-post-uat-bugs.md`

---

## Story

As a user running `tmr init` (full, not scaffold-only),  
I want the Obsidian plugin installation step to only register plugins that were actually downloaded successfully,  
So that when I open Obsidian, the plugins listed as enabled actually have their files on disk and can be loaded without error.

---

## Root Cause

In `src/services/obsidian-plugin.service.ts`, `community-plugins.json` is written with all 4 plugin IDs **unconditionally**, even when downloads fail (line 89-92):

```typescript
// BUG: always writes all 4 IDs regardless of download outcome
await fileSystemService.writeFile(
  join(obsidianDir, 'community-plugins.json'),
  JSON.stringify(OBSIDIAN_PLUGINS.map((p) => p.id)),
);
```

When a download fails, `downloadPluginFile` returns `false` without calling `writeFile`, so the plugin directory (`.obsidian/plugins/<id>/`) is never created. Obsidian then finds plugin IDs in `community-plugins.json` but no corresponding files — plugins fail silently.

---

## Acceptance Criteria

**Given** `ObsidianPluginService.installPlugins()` runs  
**When** all 4 plugins download successfully (`main.js` and `manifest.json` both return 2xx)  
**Then** all 4 plugin IDs appear in `.obsidian/community-plugins.json`  
**And** `.obsidian/plugins/<id>/main.js` and `.obsidian/plugins/<id>/manifest.json` exist for each of the 4 plugins

---

**Given** a plugin's `main.js` OR `manifest.json` download fails (non-2xx response, network error, or timeout)  
**When** `installPlugins()` completes  
**Then** that plugin's ID is **NOT included** in `.obsidian/community-plugins.json`  
**And** `printWarning` outputs the failed plugin ID with remediation URL (`https://obsidian.md/plugins`)

---

**Given** `installPlugins()` is called  
**When** it begins execution  
**Then** `.obsidian/plugins/` directory is explicitly created via `fileSystemService.createDirectory(join(obsidianDir, 'plugins'))` **before** any download attempt starts

---

**Given** `InitCommand` calls `obsidianPluginService.installPlugins()`  
**When** all plugins install successfully  
**Then** the spinner succeeds with message `"Obsidian plugins installed (4/4)"`

**Given** `InitCommand` calls `obsidianPluginService.installPlugins()`  
**When** N < 4 plugins install successfully and M = 4 - N fail  
**Then** the spinner succeeds with message `"Obsidian plugins installed (N/4)"` (spinner still succeeds — partial install is not a fatal error)  
**And** each failed plugin ID is reported via `printWarning` with the `https://obsidian.md/plugins` remediation URL  
**And** the failed plugin IDs are NOT included in `community-plugins.json`

---

**Given** `--scaffold-only` flag is set during `tmr init`  
**When** init runs  
**Then** `installPlugins()` is NOT called (Story 9.18 behavior preserved — no regression)

---

**Given** `ObsidianPluginService` unit tests exist  
**When** all downloads succeed  
**Then** `community-plugins.json` contains all 4 IDs

**Given** `ObsidianPluginService` unit tests mock one plugin's `main.js` as a 404  
**When** `installPlugins()` runs  
**Then** `community-plugins.json` contains only the 3 successfully installed plugin IDs  
**And** the failed plugin ID is in the return value of `installPlugins()`

---

## Implementation Notes

### `ObsidianPluginService.installPlugins()` — key changes

1. **Pre-create `.obsidian/plugins/` directory** before downloads:
   ```typescript
   await fileSystemService.createDirectory(join(obsidianDir, 'plugins'));
   ```

2. **Track successfully installed plugins** using the existing `fullyFailedPlugins` array:
   ```typescript
   // After all downloads complete:
   const successfulPlugins = OBSIDIAN_PLUGINS
     .filter((p) => !fullyFailedPlugins.includes(p.id))
     .map((p) => p.id);
   
   await fileSystemService.writeFile(
     join(obsidianDir, 'community-plugins.json'),
     JSON.stringify(successfulPlugins),
   );
   ```

3. **Return the count** so `InitCommand` can form the spinner message:
   The method already returns `fullyFailedPlugins: string[]` — use `OBSIDIAN_PLUGINS.length - failedPlugins.length` in the command.

### `InitCommand.run()` — update spinner message

```typescript
const failedPlugins = await obsidianPluginService.installPlugins(workspacePath);
const installedCount = REQUIRED_PLUGIN_IDS.length - failedPlugins.length;
pluginSpinner.succeed(`Obsidian plugins installed (${installedCount}/${REQUIRED_PLUGIN_IDS.length})`);
for (const id of failedPlugins) {
  printWarning(
    `Plugin "${id}" download failed — install manually: https://obsidian.md/plugins`,
    this.plain,
  );
}
```

Import `REQUIRED_PLUGIN_IDS` from `obsidian-plugin.service.js` in `init.command.ts`.

---

## Files to Modify

| File | Change |
|---|---|
| `src/services/obsidian-plugin.service.ts` | Pre-create `.obsidian/plugins/` dir; filter `community-plugins.json` to successful installs only |
| `src/commands/init.command.ts` | Update spinner message to show `N/4` count; surface per-plugin warnings |

---

## Test Coverage

- Unit: mock `fetch` to return 404 for one plugin → verify `community-plugins.json` has 3 IDs, not 4
- Unit: all downloads succeed → `community-plugins.json` has all 4 IDs
- Unit: `installPlugins()` pre-creates `.obsidian/plugins/` dir before any fetch
- Integration: no regression on `--scaffold-only` (plugin install path not reached)

---

## Dev Agent Record

### Implementation Notes

- Pre-creates `.obsidian/plugins/` via `fileSystemService.createDirectory()` before any download attempt.
- Changed `community-plugins.json` to only include successfully installed plugin IDs (filtered via `fullyFailedPlugins`).
- Changed failure threshold from `failed === requiredCount` (ALL required files fail) to `failed > 0` (ANY required file fails), matching the AC: "if `main.js` OR `manifest.json` fails → exclude from JSON".
- Removed the now-unused `requiredCount` variable.
- Updated `init.command.ts` to import `REQUIRED_PLUGIN_IDS` and show `N/4` count in spinner message; warning message updated to include remediation URL.
- Updated `tests/commands/init.command.test.ts` and `tests/integration/init.integration.test.ts` mocks to expose `REQUIRED_PLUGIN_IDS` (required after named import was added to `InitCommand`).
- Added 3 new unit tests in `tests/services/obsidian-plugin.service.test.ts` covering: pre-create dir, partial-failure exclusion, full-failure empty array.

### Files Modified

- `src/services/obsidian-plugin.service.ts`
- `src/commands/init.command.ts`
- `tests/services/obsidian-plugin.service.test.ts`
- `tests/commands/init.command.test.ts`
- `tests/integration/init.integration.test.ts`

### Validation

- `npm run validate` — exit 0 (lint ✓, typecheck ✓, 1185 tests passed ✓, build ✓)

---

## Review Findings

- [x] [Review][Decision] Spinner succeeds with "0/4" when all plugins fail — resolved: use `pluginSpinner.warn()` when `installedCount === 0`; added `warn()` to `SpinnerHandle` interface and both plain/ora implementations. [`src/commands/init.command.ts`, `src/utils/display.ts`]
- [x] [Review][Patch] No try/catch around `installPlugins()` in `InitCommand` — fixed: wrapped plugin block in try/catch; `pluginSpinner.fail()` called on error. [`src/commands/init.command.ts`]
- [x] [Review][Patch] Removed aggregate per-plugin failure log — fixed: restored `logger.warn` inside plugin loop when `failed > 0`. [`src/services/obsidian-plugin.service.ts`]
- [x] [Review][Patch] "Excludes failed plugin" test missing return-value assertion — fixed: test now captures return value and asserts `result.toContain('obsidian-git')`. [`tests/services/obsidian-plugin.service.test.ts`]
- [x] [Review][Patch] No test for `manifest.json`-specific failure path — fixed: added symmetric test for `manifest.json` 404. [`tests/services/obsidian-plugin.service.test.ts`]
- [x] [Review][Defer] `REQUIRED_PLUGIN_IDS` vs `OBSIDIAN_PLUGINS` drift — spinner count uses `REQUIRED_PLUGIN_IDS.length` while `successfulIds` is built from `OBSIDIAN_PLUGINS`; adding a plugin to one without the other silently misreports the N/4 ratio. Already tracked as D3 in `deferred-work.md` (code review of 9-17). — deferred, pre-existing
- [x] [Review][Defer] Hardcoded plugin IDs in test mocks — `REQUIRED_PLUGIN_IDS: ['obsidian-git','granola-sync','terminal','dataview']` is duplicated in mocks; drift risk when the real constant changes. ESM architectural constraint; already tracked as D1 in `deferred-work.md` (code review of 9-17). — deferred, pre-existing
- [x] [Review][Defer] Post-init summary always says "plugins are ready" regardless of actual install count — `printPostInitSummary()` hardcodes all four names; contradicts partial-install warnings printed above it. Pre-existing; already tracked in `deferred-work.md` (code review of 2-4). — deferred, pre-existing
- [x] [Review][Defer] Granola `data.json` written when `granola-sync` download fails — `writeGranolaConfig()` runs unconditionally outside the download loop; if `granola-sync` ends up in `fullyFailedPlugins`, its config file still lands on disk, creating a mismatch with `community-plugins.json` and confusing `tmr doctor`. [`src/services/obsidian-plugin.service.ts`] — deferred, pre-existing design
- [x] [Review][Defer] Orphan plugin files after partial download — if one required file succeeds (`writeFile` runs) but another fails, the partial files remain in `.obsidian/plugins/<id>/`; Obsidian won't load the plugin (correct) but leftover files are not cleaned up. [`src/services/obsidian-plugin.service.ts`] — deferred, pre-existing pattern

---

## QA Smoke Test Extension

After full `tmr init` (no `--scaffold-only`), verify:

```bash
ls .obsidian/plugins/
# Expected: obsidian-git/  granola-sync/  terminal/  dataview/

ls .obsidian/plugins/obsidian-git/
# Expected: main.js  manifest.json  (styles.css optional)

cat .obsidian/community-plugins.json
# Expected: ["obsidian-git","granola-sync","terminal","dataview"]
# (fewer entries if some downloads failed — check warnings in terminal output)
```
