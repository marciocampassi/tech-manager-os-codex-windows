# Story 9.17 — tmr doctor: Granola Plugins Check

## Metadata

| Field | Value |
|---|---|
| **Epic** | Epic 9 — UAT Pre-Launch Polish |
| **Story ID** | 9.17 |
| **Priority** | Medium |
| **Effort** | XS |
| **Risk** | Minimal — additive check, no existing behavior changes |

---

## Problem Statement

`tmr doctor` already checks whether the Granola Sync plugin **config** is correct (`checkGranolaSync`). However, it does not verify that the required Obsidian community plugins are listed in `.obsidian/community-plugins.json`. A user whose vault was scaffolded before `tmr init` started writing `community-plugins.json` (or who lost the file) would pass the Granola Sync config check but have no plugins enabled in Obsidian. The four required plugins (`obsidian-git`, `granola-sync`, `terminal`, `dataview`) are defined in `ObsidianPluginService.OBSIDIAN_PLUGINS` — `tmr doctor` should verify all four are registered.

---

## Acceptance Criteria

- `tmr doctor` includes a `Community Plugins` check (`key: 'community_plugins'`)
- If `.obsidian/community-plugins.json` exists and lists all four required plugin IDs, the check shows `✔  Community Plugins  4/4 registered`
- If one or more plugins are missing from the list, the check shows `⚠  Community Plugins  missing: obsidian-git, terminal — run: tmr init`
- If `.obsidian/community-plugins.json` is absent or unreadable, the check shows `⚠  Community Plugins  not found — run: tmr init`
- On Linux, the check is info-only (`ℹ`) with `not applicable on Linux` (same policy as `granola_sync`)
- If vault is not configured, check is skipped with `skipped (vault not configured)`
- The check result contributes to non-zero exit code when `ok: false`
- All tests pass

---

## Files to Change

| File | Change |
|---|---|
| `src/services/doctor.service.ts` | Add `checkCommunityPlugins(vaultPath)` method; call it in `runChecks()` |
| `src/services/obsidian-plugin.service.ts` | Export `REQUIRED_PLUGIN_IDS` (extracted from the `OBSIDIAN_PLUGINS` const) so `DoctorService` can import it without duplicating the list |
| `tests/services/doctor.service.test.ts` | Add unit tests for `checkCommunityPlugins` covering: all present, some missing, file absent, unreadable JSON, Linux skip |

---

## Implementation Detail

### 1 — Export required plugin IDs from `ObsidianPluginService`

```typescript
// src/services/obsidian-plugin.service.ts

export const REQUIRED_PLUGIN_IDS = [
  'obsidian-git',
  'granola-sync',
  'terminal',
  'dataview',
] as const;

export type RequiredPluginId = (typeof REQUIRED_PLUGIN_IDS)[number];
```

Derive `OBSIDIAN_PLUGINS` from this:

```typescript
const OBSIDIAN_PLUGINS: readonly { id: RequiredPluginId; owner: string; repo: string }[] = [
  { id: 'obsidian-git', owner: 'Vinzent03', repo: 'obsidian-git' },
  { id: 'granola-sync', owner: 'tomelliot', repo: 'obsidian-granola-sync' },
  { id: 'terminal', owner: 'polyipseity', repo: 'obsidian-terminal' },
  { id: 'dataview', owner: 'blacksmithgu', repo: 'obsidian-dataview' },
];
```

### 2 — `checkCommunityPlugins()` in `DoctorService`

```typescript
private checkCommunityPlugins(vaultPath: string | undefined): CheckResult {
  if (process.platform === 'linux') {
    return {
      key: 'community_plugins',
      label: 'Community Plugins',
      ok: false,
      info: true,
      detail: 'not applicable on Linux',
    };
  }

  if (!vaultPath || !existsSync(vaultPath)) {
    return {
      key: 'community_plugins',
      label: 'Community Plugins',
      ok: false,
      detail: 'skipped (vault not configured)',
      fix: 'tmr init',
    };
  }

  const pluginsJsonPath = join(vaultPath, '.obsidian', 'community-plugins.json');

  if (!existsSync(pluginsJsonPath)) {
    return {
      key: 'community_plugins',
      label: 'Community Plugins',
      ok: false,
      detail: 'not found',
      fix: 'tmr init',
    };
  }

  try {
    const raw = readFileSync(pluginsJsonPath, 'utf-8');
    const registered = JSON.parse(raw) as string[];
    const missing = REQUIRED_PLUGIN_IDS.filter((id) => !registered.includes(id));

    if (missing.length > 0) {
      return {
        key: 'community_plugins',
        label: 'Community Plugins',
        ok: false,
        detail: `missing: ${missing.join(', ')}`,
        fix: 'tmr init',
      };
    }

    return {
      key: 'community_plugins',
      label: 'Community Plugins',
      ok: true,
      value: `${REQUIRED_PLUGIN_IDS.length}/${REQUIRED_PLUGIN_IDS.length} registered`,
    };
  } catch {
    return {
      key: 'community_plugins',
      label: 'Community Plugins',
      ok: false,
      detail: 'not found',
      fix: 'tmr init',
    };
  }
}
```

### 3 — Add to `runChecks()`

```typescript
return [
  this.checkNodejs(),
  this.checkTmr(),
  this.checkVault(),
  obsidian,
  granola,
  googleDrive,
  this.checkGranolaSync(vaultPath),
  this.checkCommunityPlugins(vaultPath),   // new
];
```

---

## Notes for Developer Agent

- `REQUIRED_PLUGIN_IDS` is imported from `obsidian-plugin.service.ts` — do not hardcode the list in `doctor.service.ts`.
- The check is synchronous (uses `readFileSync` / `existsSync` like `checkGranolaSync`) — no need to add it to the `Promise.all` in `runChecks()`.
- `NAME_COL = 14` pads label to 14 characters. `"Community Plugins"` is 17 characters — the column may overflow slightly. This is acceptable; do not change `NAME_COL` just for this check.
- Run `npm run validate` before marking done.
