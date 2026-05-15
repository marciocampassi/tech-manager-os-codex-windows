---
title: 'init-vault-config-corrections'
type: 'feature'
created: '2026-05-13'
status: 'in-review'
baseline_commit: 'b7567eb9b950079d64066d0f27eeec1f315d5c7c'
context:
  - '_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** After `tmr init`, six vault state issues exist: (1) `.obsidian/plugins/granola-sync/data.json` is never written, leaving the Granola Sync plugin unconfigured on first open; (2) the Terminal plugin has no `data.json`, so "enable when open vault" is not set; (3) the user's career profile (`my-career/<email>/<email>.md`) does not reference their leader, which is known at init time; (4) `copySampleInboxFiles()` writes a single generated stub note rather than the real Granola-formatted examples from `examples/inbox-samples/`; (5) `tmr-project-impact` and `tmr-myself-config` skills are never installed — `installDefaultSkill()` only fetches `tmr-inbox`; (6) the post-init next-steps text does not mention or describe these two skills.

**Approach:** Extend `ObsidianPluginService.installPlugins()` to write `data.json` for granola-sync and terminal plugins; update `InitService.writeUserProfile()` to accept an optional `leaderEmail` and embed a leadership wiki-link; pass `leader.email` from `init.command.ts`; replace the stub example note with the real `examples/inbox-samples/` files (embedded as template strings); extend `installDefaultSkill()` to also install `tmr-project-impact` and `tmr-myself-config` via `SkillRegistryService`; update `printPostInitSummary()` to describe all three skills.

## Boundaries & Constraints

**Always:**
- Use `formatWikiLink()` from `src/utils/wiki-link.ts` for the career-to-leader reference — no inline path strings.
- Plugin `data.json` writes use `fileSystemService.writeFile()` — no direct `fs` calls.
- Plugin config errors must be caught and logged via `logger.warn()` then swallowed — same resilience policy as plugin download failures.
- Skill install failures (registry down, 404) must be swallowed with `logger.warn()` — same as existing `tmr-inbox` install.
- ESM `.js` import extensions on all new imports; `strict: true` on all new typed params.

**Ask First:**
- If the Granola Sync plugin is updated to a version that renames the fields in the config written here — the field names are verified against the current source (https://github.com/tomelliot/obsidian-granola-sync) but could drift.

**Never:**
- Do not add new user-facing prompts to the init flow.
- Do not change the order of the init write phase (scaffold → profile → leader → teams → CLAUDE.md → plugins → README).
- Do not fix the plugin download path/ID mismatch (`obsidian-granola-sync` vs `granola-sync`) — out of scope.
- Do not modify `DoctorService` — the existing `customBaseFolder` check is sufficient for now.
- Do not add `examples/` as a runtime file path dependency — embed example file contents as TypeScript template strings in `onboarding.templates.ts`; the only published artifact is `dist/`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Granola config written | `installPlugins(vaultPath)` called | `.obsidian/plugins/granola-sync/data.json` exists with all 7 fields | `logger.warn()` + swallow on write failure |
| Terminal enabled on open | `installPlugins(vaultPath)` called | `obsidian-terminal` listed in `community-plugins.json` (already done — no data.json needed) | N/A |
| Career file with leader | `writeUserProfile(…, { leaderEmail: "boss@co.com" })` | `my-career/…/<email>.md` includes `## Leadership` section with formatted wiki-link | N/A |
| Career file without leader | `writeUserProfile(…, { leaderEmail: undefined })` | Career file written normally, no `## Leadership` section | N/A |
| Real examples installed | `tmr init` completes | `inbox/2026-04-10-Marlon-Alex.md` and `inbox/2026-04-15-Team-Sync.md` exist with Granola frontmatter | error propagates — spinner fails, init aborts |
| Skills installed | `installDefaultSkill(vaultPath)` called | `.claude/skills/tmr-project-impact/` and `.claude/skills/tmr-myself-config/` written to vault | `logger.warn()` + swallow on registry failure |
| Post-init summary | `printPostInitSummary()` called | Output includes one-line description of `/tmr-inbox`, `/tmr-project-impact`, and `/tmr-myself-config` | N/A |

</frozen-after-approval>

## Code Map

- `src/services/obsidian-plugin.service.ts` — `installPlugins()` downloads plugin files and writes `community-plugins.json`; extend to also write `data.json` for granola-sync and terminal
- `src/services/init.service.ts` — `writeUserProfile()` builds career file content; `installDefaultSkill()` only installs tmr-inbox; `printPostInitSummary()` omits the two new skills
- `src/commands/init.command.ts` — calls `writeUserProfile` (line 134); `leader.email` already available at that point
- `src/utils/wiki-link.ts` — `formatWikiLink(resolvedPath, fromPath, displayName)` — use for leader reference
- `src/templates/onboarding.templates.ts` — embed `examples/inbox-samples/` file contents as exported string constants here; `copySampleInboxFiles()` uses them
- `src/services/skill-registry.service.ts` — `fetchSkillContent(name)` / `installSkill(name, content, version)` — already used for tmr-inbox; reuse for new skills
- `tests/services/obsidian-plugin.service.test.ts` — needs assertions for new `data.json` files
- `tests/integration/init.integration.test.ts` — sample file assertions, career leadership link, INIT-INT-011
- `tests/commands/init.command.test.ts` — sample file and skill install assertions
- `tests/services/init.service.test.ts` — `writeUserProfile` and `copySampleInboxFiles` tests

## Tasks & Acceptance

**Execution:**

- [x] `src/services/obsidian-plugin.service.ts` — add private `writeGranolaConfig(obsidianDir: string): Promise<void>` that writes `.obsidian/plugins/granola-sync/data.json` with the fields below; call it at the end of `installPlugins()` wrapped in `try/catch` → `logger.warn()` + swallow. No terminal data.json is written — community-plugins.json inclusion is sufficient for the terminal plugin.
  ```json
  {
    "syncNotes": true,
    "includePrivateNotes": true,
    "saveAsIndividualFiles": true,
    "baseFolderType": "custom",
    "customBaseFolder": "inbox",
    "filenamePattern": "{date}-{title}",
    "isSyncEnabled": true,
    "syncInterval": 1800
  }
  ```

- [x] `src/templates/onboarding.templates.ts` — add two exported string constants with the verbatim contents of `examples/inbox-samples/2026-04-10-Marlon-Alex.md` and `examples/inbox-samples/2026-04-15-Team-Sync.md`. Export `INBOX_SAMPLE_FILES: Array<{ filename: string; content: string }>` referencing both. Remove `generateSampleMeetingNote()` if no remaining callers exist (check before removing).

- [x] `src/services/init.service.ts` — (a) extend `writeUserProfile()` opts type to `{ email, name, role, leaderEmail?: string }`; when `leaderEmail` is provided, append `\n## Leadership\n\n- ${formatWikiLink(leaderFilePath, careerFilePath, leaderEmail)}\n` to the career file content; import `formatWikiLink` from `../utils/wiki-link.js`. (b) Update `copySampleInboxFiles()` to iterate `INBOX_SAMPLE_FILES` and write each to `inbox/<filename>`. (c) In `installDefaultSkill()`, after installing tmr-inbox, add the same fetch+install+warn-on-failure pattern for `tmr-project-impact` and `tmr-myself-config`. (d) Update `printPostInitSummary()` next-steps text to include a one-line description for each of the three skills: `/tmr-inbox` (process meeting notes), `/tmr-project-impact` (check impact when project files change), `/tmr-myself-config` (personalize AI context — run this first).

- [x] `src/commands/init.command.ts` — add `leaderEmail: leader.email` to the `writeUserProfile()` call (line ~134). The `copySampleInboxFiles` and `installDefaultSkill` spinner blocks need no structural changes — only their underlying implementations change.

- [x] `tests/services/obsidian-plugin.service.test.ts` — add suite: granola-sync `data.json` written at correct path with `customBaseFolder: "inbox"`, `isSyncEnabled: true`, `includePrivateNotes: true`, `saveAsIndividualFiles: true`, `filenamePattern: "{date}-{title}"`; write failure does not throw from `installPlugins()`.

- [x] `tests/services/init.service.test.ts` — update `writeUserProfile` tests: (a) with `leaderEmail` → `## Leadership` section present with wiki-link; (b) without `leaderEmail` → no `## Leadership` section. Update `copySampleInboxFiles` tests: assert the two new filenames are written. Add `installDefaultSkill` tests: registry calls made for all three skills; per-skill failure does not abort the others.

- [x] `tests/integration/init.integration.test.ts` — replace `inbox/sample-meeting-note.md` assertions with `inbox/2026-04-10-Marlon-Alex.md` and `inbox/2026-04-15-Team-Sync.md`. Update INIT-INT-011 to mock a write failure on one of the new example filenames. Add: career file contains reference to `my-leadership/${LEADER_EMAIL}`. Add: `.claude/skills/tmr-project-impact/` and `.claude/skills/tmr-myself-config/` exist after successful init.

- [x] `tests/commands/init.command.test.ts` — update sample file assertions to the two new filenames; verify skill install called for all three skills.

**Acceptance Criteria:**

- Given `tmr init` completes, when `.obsidian/plugins/granola-sync/data.json` is read, then `customBaseFolder` is `"inbox"`, `isSyncEnabled` is `true`, `includePrivateNotes` is `true`, and `saveAsIndividualFiles` is `true`.
- Given `tmr init` completes, when `community-plugins.json` is read, then `obsidian-terminal` is included (enabling it when the vault opens).
- Given `tmr init` completes with `leaderEmail: boss@co.com`, when the career profile is read, then it contains a `## Leadership` section with a wiki-link to `my-leadership/boss@co.com/boss@co.com.md`.
- Given `tmr init` completes, when `inbox/` is inspected, then `2026-04-10-Marlon-Alex.md` and `2026-04-15-Team-Sync.md` both exist with Granola frontmatter intact.
- Given `tmr init` completes, when `.claude/skills/` is inspected, then `tmr-project-impact/` and `tmr-myself-config/` directories exist.
- Given the post-init summary is printed, then it includes descriptive next-step entries for `/tmr-inbox`, `/tmr-project-impact`, and `/tmr-myself-config`.
- Given any single skill registry fetch fails during `installDefaultSkill()`, then the remaining skills are still attempted and init completes normally.

## Spec Change Log

- **2026-05-13 (review loop 1):** Patched `writeUserProfile` leaderEmail guard from `if (opts.leaderEmail)` to `if (opts.leaderEmail?.trim())` — whitespace-only string was truthy and produced a broken `my-leadership/.md` path. Corrected stale AC-1 field name `periodicSyncEnabled` → `isSyncEnabled`. Added missing integration-test and command-test assertions for skill installs and sample filenames (spec task gaps). Re-init overwrites of inbox samples deferred — pre-existing behavior, not in scope.

## Design Notes

**Example files bundling:** The two files from `examples/inbox-samples/` are embedded as exported string constants in `src/templates/onboarding.templates.ts`. `copySampleInboxFiles()` writes both to `inbox/` using their original filenames. Check whether `generateSampleMeetingNote()` has other callers before removing it.

**Skills in next-steps:** Suggested wording for `printPostInitSummary()`:
```
Skills installed — use them in Claude Code or Cursor:
  /tmr-inbox              — process your inbox meeting notes
  /tmr-project-impact     — check which docs are affected when a project changes
  /tmr-myself-config      — personalize AI context (run this first)
```

**Granola-sync field names (verified against plugin source):** The plugin uses `Object.assign({}, DEFAULT_SETTINGS, savedData)`, so only override fields that differ from defaults. Write only:
```json
{
  "syncNotes": true,
  "includePrivateNotes": true,
  "saveAsIndividualFiles": true,
  "baseFolderType": "custom",
  "customBaseFolder": "inbox",
  "filenamePattern": "{date}-{title}",
  "isSyncEnabled": true,
  "syncInterval": 1800
}
```
Note: `enableWhenOpenVault` is NOT a plugin field — "enable when open vault" means the plugin is listed in `community-plugins.json`, which `installPlugins()` already writes.

**Terminal plugin:** The `obsidian-terminal` plugin has no "enable when open vault" data.json field. Including it in `community-plugins.json` (already done by `installPlugins()`) is sufficient — no terminal `data.json` is written.

**Granola-sync path:** `.obsidian/plugins/granola-sync/data.json` is already the path `DoctorService.checkGranolaSync()` validates — writing here makes the existing doctor check pass with no doctor changes.

**Leadership wiki-link path:** From `my-career/<email>/<email>.md` to `my-leadership/<leaderEmail>/<leaderEmail>.md` is two levels up. `formatWikiLink(resolvedPath, fromPath, displayName)` computes the relative path automatically.

## Follow-on Finding: Plugin ID / Folder Name Mismatch

**Discovery (2026-05-15):** Post-implementation analysis confirmed that `granola-obsidian` and the `terminal` plugin do not load when the vault is opened in Obsidian, while `dataview` and `obsidian-git` load correctly. The root cause is a plugin ID mismatch between the values used in `OBSIDIAN_PLUGINS` and the `id` field in each plugin's `manifest.json`.

Obsidian requires: folder name = `manifest.json` `id` = entry in `community-plugins.json`. Any deviation silently prevents the plugin from loading.

| Plugin entry in code | Folder installed | Actual manifest `id` | Loads? |
|---|---|---|---|
| `dataview` | `plugins/dataview/` | `dataview` | ✓ |
| `obsidian-git` | `plugins/obsidian-git/` | `obsidian-git` | ✓ |
| `obsidian-granola-sync` | `plugins/obsidian-granola-sync/` | `granola-sync` | ✗ |
| `obsidian-terminal` | `plugins/obsidian-terminal/` | `terminal` | ✗ |

The code already separates `id` from `repo` in the `OBSIDIAN_PLUGINS` constant (the download URL uses `plugin.repo`), so the fix is limited to correcting the two `id` values. The `writeGranolaConfig` path (`plugins/granola-sync/data.json`) is already correct for the fixed folder name.

**Fix applied:** Changed `id: 'obsidian-granola-sync'` → `id: 'granola-sync'` and `id: 'obsidian-terminal'` → `id: 'terminal'` in `src/services/obsidian-plugin.service.ts`. Updated `community-plugins.json` expected values in `tests/services/obsidian-plugin.service.test.ts` and all other test/source files referencing the old IDs.

## Verification

**Commands:**
- `npm run validate` — expected: lint clean, type-check passes, all tests pass, build succeeds

## Suggested Review Order

**Leadership wiki-link in career profile**

- Entry point: `writeUserProfile` opts extended and whitespace-safe guard added
  [`init.service.ts:122`](../../src/services/init.service.ts#L122)

- Call site passes `leader.email` from prompt into the new optional field
  [`init.command.ts:134`](../../src/commands/init.command.ts#L134)

**Granola Sync plugin config**

- `writeGranolaConfig` writes the 8-field JSON to the path DoctorService already validates
  [`obsidian-plugin.service.ts:78`](../../src/services/obsidian-plugin.service.ts#L78)

- Try/catch wrapper swallows write failures; granola config is non-fatal to init
  [`obsidian-plugin.service.ts:69`](../../src/services/obsidian-plugin.service.ts#L69)

**Real Granola-formatted inbox sample files**

- Two embedded constants replace the old generic stub; exported as `INBOX_SAMPLE_FILES`
  [`onboarding.templates.ts:410`](../../src/templates/onboarding.templates.ts#L410)

- `copySampleInboxFiles` iterates the array; each file fails independently
  [`init.service.ts:215`](../../src/services/init.service.ts#L215)

**Multi-skill install loop**

- Skills array replaces single tmr-inbox call; per-skill try/catch preserves others on failure
  [`init.service.ts:228`](../../src/services/init.service.ts#L228)

- Post-init summary now lists all three skills with one-line descriptions
  [`init.service.ts:265`](../../src/services/init.service.ts#L265)

**Tests (peripherals)**

- Granola config assertions: path, required fields, write-failure resilience
  [`obsidian-plugin.service.test.ts:211`](../../tests/services/obsidian-plugin.service.test.ts#L211)

- `writeUserProfile` with/without `leaderEmail`; all three skills fetched and installed
  [`init.service.test.ts:256`](../../tests/services/init.service.test.ts#L256)

- Integration: sample filenames and skill install calls verified end-to-end
  [`init.integration.test.ts:444`](../../tests/integration/init.integration.test.ts#L444)
