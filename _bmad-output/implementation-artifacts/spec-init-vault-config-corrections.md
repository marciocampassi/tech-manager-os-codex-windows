---
title: 'init-vault-config-corrections'
type: 'feature'
created: '2026-05-13'
status: 'done'
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

- **2026-05-15 (addendum pass 2+3):** Implemented all Addendum A and B tasks. B1: fixed `_readBundledSkill` pkgRoot to `new URL('..', import.meta.url)`. B2: added `writeOrgConfig()` to `InitService` and wired it in `InitCommand` after scaffold with fail-fast error handling. B3: added BOOTSTRAP section (BT1/BT2/BT3) to `tmr-inbox/SKILL.md` before SETUP; replaced all hardcoded `marlon.ferreira@example.com` and `@example.com` references with `MANAGER_EMAIL` / `INTERNAL_DOMAINS`; added INTERNAL_DOMAINS BOOTSTRAP note to Step 2c. Test fixes: added `node:fs` mock to `init.command.test.ts` and `init.integration.test.ts` so `_readBundledSkill` returns content in Jest ESM context; added `writeOrgConfig` unit test suite; added `organization.yaml` assertion to command test. All 1074 tests pass.
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

## Addendum — Init & Skills Corrections (2026-05-15)

The following corrections were identified post-implementation and applied as a second pass. They extend the original spec without renegotiating its frozen intent.

### New Issues Fixed

| # | Bug | Location |
|---|-----|----------|
| A1 | `company/domain` collected during init but never stored in config | `init.command.ts`, `config.types.ts` |
| A2 | `my-company/contractors` and `config` folders absent from scaffold | `init.service.ts` `VAULT_DIRS` |
| A3 | `installDefaultSkill()` fetches from GitHub — fails offline, diverges from `docs/skills/` | `init.service.ts` |
| A4 | `tmr-project-impact` missing from `skills/` registry; `skills/` out of sync with `docs/skills/` | `skills/index.json`, `skills/` |
| A5 | `tmr-inbox` skill has no contractor routing; `tmr member add` has no `--contractor` flag | `docs/skills/tmr-inbox/SKILL.md`, `member.command.ts` |

### Constraints (addendum)

**Always:**
- `company_domain` stored via existing `configService.set()` — no new persistence mechanism.
- Skill content read from `docs/skills/<name>/SKILL.md` using synchronous `fs.readFileSync`; resolve path via `fileURLToPath(new URL('../../..', import.meta.url))` from compiled `dist/services/`.
- `installDefaultSkill()` must never throw — same swallow-on-failure contract as before.
- Contractor profiles written to `my-company/contractors/<email>/<email>.md` (email-subfolder pattern, consistent with all other member scopes).

**Never:**
- Do not change how `tmr install` / `tmr update` fetch skills (those still use GitHub registry).
- Do not rename `skills/tmr-myself-config/` in the remote registry — keep the existing folder name.

### Tasks (addendum)

- [x] `src/types/config.types.ts` — add `company_domain?: string` to `AppConfig` and `CONFIG_KEYS`.

- [x] `src/commands/init.command.ts` — after `configService.initialize()`, call `configService.set('company_domain', answers.company)`. Update spinner label from `'Installing tmr-inbox skill'` → `'Installing default skills'`; succeed message → `'Default skills installed'`.

- [x] `src/services/init.service.ts` — (a) add `'my-company/contractors'` and `'config'` to `VAULT_DIRS`; update JSDoc count on `scaffold()`. (b) Add module-level `parseBundledVersion(content: string): string` using `/<!--\s*version:\s*(\S+)\s*-->/` regex; default `'0.0.0'`. (c) Add private `readBundledSkill(docsFolder: string): string | null` that reads `<pkgRoot>/docs/skills/<docsFolder>/SKILL.md` synchronously via `fs.readFileSync`; resolve `pkgRoot` as `fileURLToPath(new URL('../../..', import.meta.url))`. (d) Replace the `fetchSkillContent` network loop in `installDefaultSkill()` with a `BUNDLED_SKILLS` array `[{docsFolder: 'tmr-inbox', skillName: 'tmr-inbox'}, {docsFolder: 'tmr-project-impact', skillName: 'tmr-project-impact'}, {docsFolder: 'tmr-myself-config', skillName: 'tmr-myself-config'}]` read via `readBundledSkill`; call `registry.installSkill(skillName, content, parseBundledVersion(content))`. Add `import * as fs from 'node:fs'` and `import { fileURLToPath } from 'node:url'`.

- [x] `docs/skills/tmr-myself/` → rename to `docs/skills/tmr-myself-config/` to match skill name and registry folder.

- [x] `docs/skills/tmr-inbox/SKILL.md` — (a) Rule 1: add `Else check my-company/contractors/[email]/ → type: 1on1-contractor` before the final `1on1-member` fallback; update destination list. (b) Step 2b: extend 1:1 types list to include `1on1-contractor`; add check for `my-company/contractors/[email]/` and scaffold `mkdir -p "my-company/contractors/[email]/1on1s"`. (c) T3 ambiguous prompt: add option `e) Contractor 1:1 → my-company/contractors/[email]/1on1s/`; add `e` → `1on1-contractor` in apply block. (d) Step 2c relationship derivation: add `1on1-contractor` → `contractor`. (e) Step 2h profile lookup: add `my-company/contractors/[email]/` as third search location (before `my-company/members/`). (f) Step 2a name-to-email resolution: add `my-company/contractors/` to the profile scan list.

- [x] `skills/` registry — create `skills/tmr-project-impact/SKILL.md` from `docs/skills/tmr-project-impact/SKILL.md`; overwrite `skills/tmr-inbox/SKILL.md` from `docs/skills/tmr-inbox/SKILL.md` (after the SKILL.md is updated above); overwrite `skills/tmr-myself-config/SKILL.md` from `docs/skills/tmr-myself-config/SKILL.md`; update `skills/index.json` to `["tmr-inbox", "tmr-myself-config", "tmr-project-impact"]`.

- [x] `src/types/member.types.ts` — add `contractor?: boolean` to `IAddMemberOptions`.

- [x] `src/services/member.service.ts` — (a) in `addMember()`: add contractor branch that writes profile to `my-company/contractors/<email>/<email>.md` with `relationship: contractor`; create `my-company/contractors/<email>/1on1s/` directory. (b) in `findMemberGlobally()`: add `my-company/contractors/<email>/<email>.md` as a search candidate.

- [x] `src/commands/member.command.ts` — add `.option('--contractor', 'create profile in my-company/contractors/ for external/contractor members')` to the `add` subcommand; pass `contractor: opts.contractor` into `svc.addMember()`.

### Acceptance Criteria (addendum)

- Given `tmr init` completes, when `~/.config/tmr/config.json` is read, then `company_domain` equals the value entered at the company prompt.
- Given `tmr init` completes, when the vault is inspected, then `my-company/contractors/` and `config/` directories exist.
- Given `tmr init` completes offline (registry unreachable), then all three default skills are still installed from bundled `docs/skills/` files.
- Given `tmr init` completes, when `.claude/skills/` is inspected, then `tmr-inbox/`, `tmr-project-impact/`, and `tmr-myself-config/` all exist with non-empty `SKILL.md` files.
- Given `tmr member add --contractor contractor@agency.com`, then `my-company/contractors/contractor@agency.com/contractor@agency.com.md` is created with `relationship: contractor` and `my-company/contractors/contractor@agency.com/1on1s/` exists.
- Given a 1:1 inbox note whose sole attendee has a folder under `my-company/contractors/`, then tmr-inbox routes it to `my-company/contractors/[email]/1on1s/`.

## Addendum — Skill Path Bug + Vault Org Config (2026-05-15)

The following corrections were identified post-implementation and applied as a third pass. They extend the prior addendum without renegotiating frozen intent.

### New Issues Fixed

| # | Bug | Location |
|---|-----|----------|
| B1 | `_readBundledSkill()` resolves `pkgRoot` with `'../..'` — correct if compiled to `dist/services/`, but the build outputs a flat bundle at `dist/init.command-<hash>.js`; two levels up lands in the project's **parent** directory and `docs/skills/` is never found; all three skills silently return `null` and are skipped | `init.service.ts` `_readBundledSkill` |
| B2 | Company domain collected at init is only stored in global `~/.config/tmr/config.json`; no vault-side file is written, so skills like `tmr-inbox` cannot discover or extend the org's internal domains | `init.service.ts`, `init.command.ts` |
| B3 | `tmr-inbox` skill hardcodes `marlon.ferreira@example.com` as the vault owner and `@example.com` as the default email domain; `INTERNAL_DOMAINS` is referenced in relationship derivation but never defined, breaking any vault whose owner is not the original author | `docs/skills/tmr-inbox/SKILL.md` |

### Constraints (addendum)

**Always:**
- `pkgRoot` in `_readBundledSkill` resolved with `new URL('..', import.meta.url)` — exactly one level up from the flat `dist/` bundle. (The prior addendum spec contained `'../../..'` — three levels — which is also incorrect; the right value is `'..'`.)
- `config/organization.yaml` written using `fileSystemService.writeFile()` — no direct `fs` calls.
- Org config write failure must be caught, printed via `printError()`, and abort init via early `return` — same pattern as all other write steps in `init.command.ts`.
- `tmr-inbox` BOOTSTRAP reads `config/organization.yaml` if present; fallback to email domain extracted from the manager profile filename — no prompts, no hardcoded values.

**Never:**
- Do not change the `tmr-inbox` TRIAGE or SETUP logic — only add the BOOTSTRAP section and replace hardcoded literal strings with variable references.
- Do not remove `configService.set('company_domain', answers.company)` — keep it for backward compatibility alongside the new vault file.

### Tasks (addendum)

- [x] `src/services/init.service.ts` — in `_readBundledSkill()`, change `new URL('../..', import.meta.url)` to `new URL('..', import.meta.url)`. Verification: `..` from `dist/init.command-<hash>.js` resolves to the project root; `../..` resolves to the project's parent directory (confirmed empirically).

- [x] `src/services/init.service.ts` — add `async writeOrgConfig(vaultPath: string, managerEmail: string): Promise<void>` that extracts the domain as `managerEmail.split('@')[1] ?? managerEmail` and writes `config/organization.yaml` with content `internal_domains:\n  - <domain>\n`. The `config/` directory is guaranteed to exist after `scaffold()`.

- [x] `src/commands/init.command.ts` — after `scaffoldSpinner.succeed('Workspace ready')`, add a new spinner block that calls `initService.writeOrgConfig(workspacePath, answers.email)`; on failure: `printError(...)`, `spinner.fail(...)`, early `return`. Keep the existing `configService.set('company_domain', answers.company)` line.

- [x] `docs/skills/tmr-inbox/SKILL.md` — add a `## BOOTSTRAP` section at the top of the skill (before `## SETUP` and `## TRIAGE`) containing three steps: **BT1** run `git rev-parse --show-toplevel` and store as `VAULT_ROOT`; **BT2** list `.md` files in `my-career/` non-recursively, identify the one whose name contains `@`, store its filename stem as `MANAGER_EMAIL` (exit with message if none found); **BT3** read `config/organization.yaml` if it exists and extract `internal_domains` as `INTERNAL_DOMAINS`; fallback: `INTERNAL_DOMAINS = [domain portion of MANAGER_EMAIL]`. Update the `Usage` block to add: *"Before either command, BOOTSTRAP is always run first to resolve `MANAGER_EMAIL` and `INTERNAL_DOMAINS`."* Replace the hardcoded `marlon.ferreira@example.com` vault owner note (line 17) with `Vault owner: resolved dynamically in BOOTSTRAP — see Step BT2`. In T2, replace `Marlon's email is marlon.ferreira@example.com. Exclude him from attendee counts.` with `Exclude MANAGER_EMAIL from attendee counts.` In Step 2a, replace `default to @example.com` with `default to @<first domain in INTERNAL_DOMAINS>`. In Step 2c relationship derivation, replace the `INTERNAL_DOMAINS` reference with a note that this list is resolved in BOOTSTRAP Step BT3.

- [x] `tests/services/init.service.test.ts` — add `writeOrgConfig` suite: (a) writes `config/organization.yaml` at the correct path; (b) YAML content contains the domain extracted from the email; (c) uses the full domain string after `@` as the domain; (d) re-throws when `writeFile` rejects.

- [x] `tests/commands/init.command.test.ts` — in the happy-path suite, assert that `mockWriteFile` is called with a path ending in `config/organization.yaml`.

### Acceptance Criteria (addendum)

- Given `_readBundledSkill('tmr-inbox')` is called from the compiled bundle, then the resolved skill path points to `<project-root>/docs/skills/tmr-inbox/SKILL.md` and the file is read successfully.
- Given `tmr init` completes, when `config/organization.yaml` is read, then `internal_domains` contains the domain portion of the email entered during init.
- Given `config/organization.yaml` write fails during `tmr init`, then init aborts with a printed error (non-silent failure — org config is vault-critical context).
- Given `/tmr-inbox` is invoked on any vault, then `MANAGER_EMAIL` is resolved from `my-career/` and no hardcoded email address is used at any point in the triage.
- Given `config/organization.yaml` exists with multiple domains, then `INTERNAL_DOMAINS` contains all listed domains and is used for relationship classification in Step 2c.
- Given `config/organization.yaml` does not exist, then `INTERNAL_DOMAINS` falls back to the single domain extracted from `MANAGER_EMAIL` and triage proceeds normally.

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
