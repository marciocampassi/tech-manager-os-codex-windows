# Story 9.19 — Fix Obsidian Plugin Installation Accuracy

**Epic:** 9 — UAT Pre-Launch Polish  
**Status:** Ready for dev  
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
