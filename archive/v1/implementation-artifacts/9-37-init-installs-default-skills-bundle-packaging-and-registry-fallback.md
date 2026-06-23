---
baseline_commit: 5b7b5a306258e25b2e4e9fa9d34abb278ae8fc38
---

# Story 9.37: `tmr init` Installs Default Skills — Bundle Packaging Fix + Registry Fallback

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a `tmr` user installing the CLI from npm,
I want `tmr init` to install the default Claude skills automatically — reading them from the bundled package, and falling back to the remote registry if a bundled file is missing,
so that I never have to run `tmr install` manually after init, the same way Obsidian plugins and vault files are created automatically during onboarding.

## Context & Root Cause (Sprint Change Trigger)

`tmr init` is **designed** to install the three default skills (`tmr-inbox`, `tmr-project-impact`, `tmr-myself-config`) automatically via `InitService.installDefaultSkill()` ([src/commands/init.command.ts](../../src/commands/init.command.ts) line 249-255 → [src/services/init.service.ts](../../src/services/init.service.ts) line 282-308). It reads each skill from the **bundled offline copy** at `docs/skills/<skill>/SKILL.md` via `_readBundledSkill()` (line 316-324), which resolves the path relative to the package root (`new URL('..', import.meta.url)` → one level up from `dist/`).

**The bug:** `package.json` ships only `"files": ["dist"]` (line 21-23) and `tsup.config.ts` does **not** copy `docs/` into `dist/`. So in a published/globally-installed npm package, `docs/skills/` does not exist. `_readBundledSkill()` throws → returns `null` → the error is logged via `logger.warn()` and **swallowed** (skill-install failures are intentionally non-fatal, by design from Story 2.4). Result: **no skills are installed during `tmr init`**, and the user must run `tmr install` (which fetches from the remote GitHub registry over the network) to recover.

This was never caught because in local dev (running from the repo) `docs/skills/` exists, so init works there.

**The fix (two parts):**
1. **Packaging (primary):** Ship the bundled offline skill copies in the published package so `tmr init` works offline as designed.
2. **Registry fallback (resilience):** If a bundled skill file is ever missing/empty at runtime, fall back to fetching it from the remote registry (the same source `tmr install` uses) before giving up — guaranteeing automatic install in every scenario.

## Acceptance Criteria

1. **Bundled skills ship in the npm package.** `package.json` `files` includes `docs/skills` so that `docs/skills/tmr-inbox/SKILL.md`, `docs/skills/tmr-project-impact/SKILL.md`, and `docs/skills/tmr-myself-config/SKILL.md` are present in the published tarball alongside `dist/`. [INIT-SKILL-PKG]
2. **Registry fallback in `installDefaultSkill`.** When the bundled read for a skill returns `null` (file not found) **or** an empty/whitespace-only string, `InitService.installDefaultSkill()` attempts `SkillRegistryService.fetchSkillContent(skillName)`. On success it calls `registry.installSkill(skillName, content, version)` using the fetched content and registry version. [INIT-SKILL-FALLBACK]
3. **Both-fail path stays non-fatal.** When the bundled read is unavailable **and** the registry fetch fails (network error, 404, empty body), `installDefaultSkill` logs a single `logger.warn()` for that skill and continues to the next skill — it **never throws** and never aborts init. [NFR1, INIT-SKILL-SOFTFAIL]
4. **Bundled path is preferred.** When the bundled file is present and non-empty, the registry is **not** contacted for that skill (no network call) — bundled-first behavior is preserved for offline/fast init. [INIT-SKILL-BUNDLED-FIRST]
5. **All three default skills are attempted independently.** A failure (bundled + fallback) for one skill does not prevent the other two from being installed. [INIT-SKILL-INDEPENDENT]
6. **Existing packaging integrity tests still pass and are extended.** `tests/packaging/skill-registry.test.ts` gains a test asserting `package.json` `files` contains an entry that ships `docs/skills` (e.g. `'docs/skills'`). Optionally, a `npm pack --dry-run` based assertion verifies the tarball includes all three bundled `SKILL.md` files. [SKILL-PKG-006]
7. **Affected existing `installDefaultSkill` unit tests are updated** to reflect the new fallback behavior (see Dev Notes → "Existing tests that MUST change"). New unit tests cover: bundled-missing → registry-success → installSkill called with fetched version; bundled-empty → registry-success; bundled-missing → registry-fail → logger.warn + no installSkill. [INIT-SKILL-FALLBACK, INIT-SKILL-SOFTFAIL]
8. `npm run validate` exits 0 (lint + typecheck + test + build).

## Tasks / Subtasks

- [x] **Packaging fix** — `package.json` (AC: 1)
  - [x] Change `"files": ["dist"]` to `"files": ["dist", "docs/skills"]` so the bundled offline skill copies ship in the published package.
  - [x] Do NOT add `skills/` (the registry copy served via GitHub raw) — only the bundled `docs/skills` is consumed by `installDefaultSkill`.

- [x] **Registry fallback** — `src/services/init.service.ts` (AC: 2, 3, 4, 5)
  - [x] In `installDefaultSkill()`, restructure the per-skill loop so that:
    - Read bundled content via `_readBundledSkill(docsFolder)`.
    - If content is non-`null` and non-empty → `registry.installSkill(skillName, content, parseBundledVersion(content))` (unchanged bundled-first path; no network).
    - If content is `null` or empty → `await registry.fetchSkillContent(skillName)`; on `success && data.content.trim()` → `registry.installSkill(skillName, data.content, data.version)`; otherwise `logger.warn(...)` and continue.
  - [x] Keep the whole per-skill body inside `try/catch` so any thrown error (including a fallback `fetchSkillContent` rejection) is caught, logged via `logger.warn()`, and swallowed — `installDefaultSkill` MUST still resolve (never throw).
  - [x] Preserve the distinct warn messages so tests can assert them (e.g. keep `bundled file not found` / `bundled file is empty` semantics, and add a clear message for the both-failed case such as `skill install skipped: bundled unavailable and registry fetch failed`).

- [x] **Packaging test** — `tests/packaging/skill-registry.test.ts` (AC: 6)
  - [x] Add `SKILL-PKG-006`: read `package.json`, assert `files` array includes `'docs/skills'` (or an entry covering it).
  - [x] (Optional) Verified separately via `npm pack --dry-run` that the tarball now ships `docs/skills/tmr-inbox/SKILL.md`, `docs/skills/tmr-myself-config/SKILL.md`, `docs/skills/tmr-project-impact/SKILL.md`. Not codified as a test to keep the suite fast/offline; the `package.json` assertion is the regression guard.

- [x] **Update existing + add new unit tests** — `tests/services/init.service.test.ts` (AC: 7)
  - [x] UPDATE the former `installs remaining skills even when one file read throws`: now asserts the failing-bundled skill falls back to `fetchSkillContent` (default success) → `installSkill` called 3 times + `fetchSkillContent` called once with `'tmr-inbox'`.
  - [x] UPDATE the former `calls logger.warn and does NOT throw when a file read throws`: registry fallback set to fail → asserts warn contains `registry fetch failed` and the service resolves (non-fatal).
  - [x] UPDATE the former empty-bundled warn test: split into a fallback-success path (installs from registry) and a fallback-fail skip path.
  - [x] ADD `falls back to registry and installs when a bundled file read throws`: asserts `installSkill('tmr-inbox', '# skill', '1.0.0')` (registry content + version).
  - [x] ADD `falls back to registry and installs when a bundled file is empty`: `'   '` bundled → asserts fallback `fetchSkillContent('tmr-inbox')` + `installSkill('tmr-inbox', '# skill', '1.0.0')`.
  - [x] ADD `warns and skips a skill (without blocking others) when bundled missing AND registry fails`: asserts `installSkill` called 2 times, not for `tmr-inbox`, and warn contains `skipped`.

- [x] **Run** `npm run validate` (AC: 8)

## Dev Notes

### Architecture Context (MUST follow)

- **Layered architecture:** the fix stays entirely in `InitService` (service layer) + `package.json` (build/packaging) + tests. Do NOT move logic into `InitCommand`. [project-context.md → "Layered CLI Architecture"]
- **ESM imports:** all relative imports use the `.js` extension even from `.ts`. No new imports are required for the fallback — `SkillRegistryService` is already injected via `_skillRegistryFactory`, and `fetchSkillContent` already exists on it. [project-context.md → "ESM & TypeScript"]
- **No `console.*`:** use `logger.warn()` (winston) for the swallowed warnings — already imported in `init.service.ts`. [project-context.md → "Imports & Module Boundaries"]
- **Explicit return types** on any new/changed exported function; `installDefaultSkill` already returns `Promise<void>` — keep it.

### The packaging path resolution (why `files: ["dist", "docs/skills"]` is sufficient)

`_readBundledSkill` computes:
```ts
const pkgRoot = fileURLToPath(new URL('..', import.meta.url)); // dist/<chunk>.js → package root
const skillPath = path.join(pkgRoot, 'docs', 'skills', docsFolder, 'SKILL.md');
```
`import.meta.url` points at a file inside `dist/` (tsup emits chunks there with `splitting: true`). `new URL('..', …)` resolves to the package root. With `docs/skills` shipped as a sibling of `dist/`, `path.join(pkgRoot, 'docs', 'skills', …)` resolves correctly in the published package. **No change to `_readBundledSkill`'s path logic is needed** — only the packaging `files` entry. Do NOT rewrite the path to point inside `dist/`.

### Target shape of `installDefaultSkill` (bundled-first + registry fallback)

```ts
async installDefaultSkill(vaultPath: string): Promise<void> {
  const registry = this._skillRegistryFactory(vaultPath);
  const BUNDLED_SKILLS = [
    { docsFolder: 'tmr-inbox', skillName: 'tmr-inbox' },
    { docsFolder: 'tmr-project-impact', skillName: 'tmr-project-impact' },
    { docsFolder: 'tmr-myself-config', skillName: 'tmr-myself-config' },
  ] as const;

  for (const { docsFolder, skillName } of BUNDLED_SKILLS) {
    try {
      const content = this._readBundledSkill(docsFolder); // null on read error
      if (content !== null && content.trim()) {
        registry.installSkill(skillName, content, parseBundledVersion(content));
        continue; // bundled-first: no network when bundled is usable
      }

      // Fallback: bundled missing/empty → fetch from remote registry
      const reason = content === null ? 'bundled file not found' : 'bundled file is empty';
      logger.warn(`${skillName} bundled skill unavailable (${reason}); falling back to registry`);
      const result = await registry.fetchSkillContent(skillName);
      if (result.success && result.data.content.trim()) {
        registry.installSkill(skillName, result.data.content, result.data.version);
      } else {
        const err = result.success ? 'empty registry content' : result.error;
        logger.warn(`${skillName} skill install skipped: bundled unavailable and registry fetch failed (${err})`);
      }
    } catch (err) {
      logger.warn(
        `${skillName} skill install failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
```
- Keep `parseBundledVersion(content)` for the bundled path (defaults to `'0.0.0'` when no `<!-- version: X -->` comment) and use `result.data.version` for the registry path.
- The `try/catch` wraps the fallback too, so a `fetchSkillContent` **rejection** (vs. a `{ success: false }` result) is still swallowed and non-fatal (AC3).

### Existing tests that MUST change (regression — do not skip)

The current default `createMockSkillRegistry()` ([tests/services/init.service.test.ts](../../tests/services/init.service.test.ts) line 26-33) makes `fetchSkillContent` resolve **success**. With the new fallback, three existing `installDefaultSkill` tests change behavior:

| Test (approx line) | Current expectation | Why it breaks | Required update |
|---|---|---|---|
| `installs remaining skills even when one file read throws` (~535) | `installSkill` called **2** times | Failing bundled skill now falls back to registry-success → 3 installs | Either expect **3**, or set `fetchSkillContent` to fail for the fallback and keep 2 |
| `calls logger.warn ... when a file read throws` (~545) | warn contains `bundled file not found` | Fallback succeeds → no terminal warn for skip | Set `fetchSkillContent` to `{ success: false }` so both fail; assert warn + resolves |
| `calls logger.warn ... when bundled file is empty` (~555) | warn `empty` + no `installSkill` | Empty bundled now falls back → installs | Set `fetchSkillContent` to fail; assert skip-warn + no `installSkill` |

The warn **message strings** in the target implementation differ slightly from the originals (now there's an intermediate `falling back to registry` warn plus a final skip warn). Update the `expect(...).toHaveBeenCalledWith(expect.stringContaining(...))` matchers to match whichever message the chosen implementation emits. Keep matchers loose (`stringContaining`) rather than exact.

### Test mocking patterns (reuse existing harness)

- `installDefaultSkill` tests construct the service with the injectable bundled reader and a mock registry factory — reuse it exactly:
```ts
svcWithRegistry = new InitService(
  mockFS as unknown as FileSystemService,
  mockLeadership as unknown as LeadershipService,
  mockTeam as unknown as TeamService,
  () => mockRegistry as unknown as SkillRegistryService,
  mockReadSkillFile, // (p: string) => string
);
```
- For "bundled missing" use `mockReadSkillFile.mockImplementationOnce(() => { throw new Error('ENOENT'); })`.
- For "bundled empty" use `mockReadSkillFile.mockReturnValueOnce('   ')`.
- For "registry fails" set `mockRegistry.fetchSkillContent.mockResolvedValueOnce({ success: false, error: 'not found' })` (or `.mockRejectedValueOnce(...)` to exercise the outer catch).
- Spy on warn with `jest.spyOn(logger, 'warn').mockImplementation(() => logger)`.

### Packaging test reference

`tests/packaging/skill-registry.test.ts` already reads real files from disk and asserts the registry copy and bundled copy stay version-synced (`SKILL-PKG-001..005`). Add `SKILL-PKG-006` in the same file/style:
```ts
it('SKILL-PKG-006: package.json files includes docs/skills so bundled skills ship in the npm package', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  expect(Array.isArray(pkg.files)).toBe(true);
  expect(pkg.files).toContain('docs/skills');
});
```
This is the regression guard that would have caught the original bug.

### Files to change

| File | Role |
|------|------|
| `package.json` | UPDATE: `files` → `["dist", "docs/skills"]` (AC1) |
| `src/services/init.service.ts` | UPDATE: `installDefaultSkill` adds bundled-first + registry-fallback (AC2-5) |
| `tests/packaging/skill-registry.test.ts` | UPDATE: add `SKILL-PKG-006` (AC6) |
| `tests/services/init.service.test.ts` | UPDATE 3 existing tests + ADD 3 fallback tests (AC7) |

### Regression guards — do NOT break

- `installDefaultSkill` MUST remain **non-throwing** and non-fatal — the command layer wraps it in an empty `catch {}` safety net and always calls `skillSpinner.succeed()` ([src/commands/init.command.ts](../../src/commands/init.command.ts) line 249-255). [Story 2.4 design, NFR1]
- Do NOT change the `InitService` constructor signature — the injectable `_skillRegistryFactory` (4th param) and `_readSkillFile` (5th param) already exist; tests depend on them.
- Do NOT add `skills/` to `package.json` `files` (registry copy is served from GitHub raw, not the npm package).
- Do NOT contact the network when the bundled file is present and valid (AC4) — bundled-first keeps offline init fast.
- Keep `SKILL-PKG-001..005` passing — they enforce registry/bundled version parity.
- Do NOT reorder or alter other `tmr init` write-phase steps (scaffold, profiles, teams, plugins, samples, README, summary).

### References

- [Source: src/services/init.service.ts#installDefaultSkill] (lines 282-324) — bundled read + swallowed warn
- [Source: src/commands/init.command.ts] (lines 225-258) — write-phase skill step + scaffold-only skip
- [Source: src/services/skill-registry.service.ts#fetchSkillContent] (lines 100-125) — registry fetch + `installSkill`
- [Source: package.json] (lines 21-23) — `files: ["dist"]`
- [Source: tsup.config.ts] — confirms `docs/` is not copied into `dist/`
- [Source: tests/packaging/skill-registry.test.ts] — existing packaging integrity tests (SKILL-PKG-001..005)
- [Source: tests/services/init.service.test.ts] (lines 479-562) — existing `installDefaultSkill` unit tests
- [Source: _bmad-output/implementation-artifacts/2-4-sample-files-skill-install-readme-and-post-init-summary.md] — original skill-install design (non-fatal contract)
- [Source: _bmad-output/project-context.md] — ESM `.js` imports, `display.ts`/`logger` rules, `files: ["dist"]` publish set, strict typing

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8

### Debug Log References

None — clean implementation run. `npm run validate` exits 0 on first full run after changes.

### Completion Notes List

- **AC1 (packaging):** Added `docs/skills` to `package.json` `files`. Verified via `npm pack --dry-run` that the tarball now ships `docs/skills/{tmr-inbox,tmr-myself-config,tmr-project-impact}/SKILL.md` (31 total files) — previously absent, which was the root cause of `tmr init` silently installing no skills from a published package.
- **AC2-5 (registry fallback):** Reworked `InitService.installDefaultSkill()` to bundled-first + registry fallback. When the bundled read returns non-empty content, it installs offline with no network call (AC4). When the bundled file is missing/empty, it falls back to `registry.fetchSkillContent(skillName)` and installs with the fetched content + registry version (AC2). When both fail, it logs a single `logger.warn()` and continues (AC3). Each skill is attempted independently and the whole body stays inside `try/catch`, so the method never throws (AC3, AC5).
- **AC6:** Added `SKILL-PKG-006` to `tests/packaging/skill-registry.test.ts` asserting `package.json` `files` contains `docs/skills` — the regression guard that would have caught the original bug.
- **AC7:** Updated 3 existing `installDefaultSkill` unit tests for the new fallback behavior and added 3 new tests (fallback-on-throw installs, fallback-on-empty installs, both-fail skip without blocking other skills).
- **AC8:** `npm run validate` exits 0 — ESLint clean, `tsc --noEmit` clean, **1435 tests pass / 76 suites**, `tsup` build success.
- No constructor signature change; reused the existing injectable `_skillRegistryFactory` and `_readSkillFile`. No new dependencies. Command-layer write-phase ordering and the non-fatal `catch {}` safety net are unchanged.

### File List

- `package.json` (UPDATE: `files` → `["dist", "docs/skills"]`)
- `src/services/init.service.ts` (UPDATE: `installDefaultSkill` bundled-first + registry fallback + doc comment)
- `tests/packaging/skill-registry.test.ts` (UPDATE: add `SKILL-PKG-006`)
- `tests/services/init.service.test.ts` (UPDATE: 3 existing tests reworked + 3 new fallback tests)
- `_bmad-output/implementation-artifacts/9-37-init-installs-default-skills-bundle-packaging-and-registry-fallback.md` (story tracking)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (status tracking)

## Change Log

| Date | Change |
|------|--------|
| 2026-06-20 | Implemented Story 9.37: fixed `tmr init` skill-install packaging bug (ship `docs/skills` in npm package) and added registry fallback in `installDefaultSkill`. All ACs satisfied; `npm run validate` exits 0. |
| 2026-06-20 | Code review (3-layer adversarial): all 8 ACs verified. Applied 2 low-severity patches (AC4 no-network regression guard + downgraded intermediate fallback log to info). 7 pre-existing items deferred, 5 dismissed. `npm run validate` exits 0. Status → done. |

## Review Findings

_Adversarial code review (Blind Hunter + Edge Case Hunter + Acceptance Auditor) — 2026-06-20. All 8 ACs verified satisfied; all "do NOT break" regression guards respected._

### Patch (actionable now)

- [x] [Review][Patch] Add AC4 regression guard — assert the registry is NOT contacted when the bundled file is present [tests/services/init.service.test.ts]. Added test `does NOT contact the registry when every bundled file is present (AC4: bundled-first)` asserting `fetchSkillContent` is never called on the bundled-present happy path.
- [x] [Review][Patch] Downgrade the intermediate "bundled skill unavailable; falling back to registry" `logger.warn` to `logger.info` [src/services/init.service.ts: installDefaultSkill]. Successful fallback no longer logs a WARN; the both-fail path now emits a single warn (strict AC3). The both-fail test still asserts the final `registry fetch failed` warn.

### Deferred (pre-existing, not caused by this change)

- [x] [Review][Defer] Idle-only request timeout (no wall-clock deadline) in `fetchUrl` can hang init on a slow-trickle server [src/services/skill-registry.service.ts:34-36] — deferred, pre-existing (shared with `tmr install`); this change newly routes init through it on fallback.
- [x] [Review][Defer] Serial fallback fetches can block init up to ~30s when all 3 bundled files are missing + slow network [src/services/init.service.ts] — deferred, degraded-path only (requires a packaging regression to even reach it).
- [x] [Review][Defer] Spinner reports "Default skills installed" even when 0 skills installed; `installDefaultSkill` returns `void` [src/commands/init.command.ts:249-255] — deferred, by-design non-fatal contract (Story 2.4) and an explicit regression guard in Dev Notes.
- [x] [Review][Defer] Registry 200 with a non-skill body (captive portal / error HTML) is installed verbatim as `SKILL.md` [src/services/skill-registry.service.ts:122-124] — deferred, pre-existing `fetchSkillContent` behavior.
- [x] [Review][Defer] `fetchUrl` does not follow 3xx redirects → fallback silently skips on a redirect [src/services/skill-registry.service.ts:100-120] — deferred, pre-existing.
- [x] [Review][Defer] Missing/garbled version comment → `0.0.0` manifest overwrite with no version comparison on re-run/upgrade [src/services/init.service.ts:77-80 + `installSkill`] — deferred, pre-existing.
- [x] [Review][Defer] `_readBundledSkill` path resolution (`new URL('..', import.meta.url)`) fails under ts-node dev / non-flat layout → silent network fallback in dev [src/services/init.service.ts:316-324] — deferred, pre-existing path logic; production flat-`dist` layout resolves correctly (verified via `npm pack`); dev-only.

### Dismissed (false positives / noise) — 5

- `installSkill` not awaited → it is a synchronous `void` (uses `fs.*Sync`); no await needed.
- `result.error` could render `[object Object]`/`undefined` → `Result.error` is typed `string`; always a string.
- Registry version handling "inconsistent" → `fetchSkillContent` already parses the version via `parseVersion`, equivalent to `parseBundledVersion`.
- `content.trim()` truthiness vs explicit length check → style nit.
- "Empty/missing bundled triggers a network fetch" framed as a bug → this is the intended fallback (AC2).
