# Story 8.4 — Publish tmr-project-impact to the Official Skill Registry

## Story Metadata

| Field | Value |
|---|---|
| **Story ID** | 8.4 |
| **Story Key** | 8-4-publish-tmr-project-impact-to-registry |
| **Epic** | Epic 8 — UAT Bug Fixes |
| **Status** | done |
| **Source** | BUG-004 · sprint-change-proposal-2026-05-19-uat-bug-fixes.md |
| **FRs** | FR25, FR27 |
| **Effort** | S |
| **Risk** | Low — data-only change, no service logic modified |

---

## User Story

**As** an engineering manager with `tmr-project-impact` installed,  
**I want** `tmr update` to successfully check and update the skill from the registry,  
**So that** I receive future improvements to the skill and am not permanently stuck on the bundled v0.0.0.

---

## Background / Context

### What went wrong (BUG-004)

During UAT (`tmr update`), the output was:

```
✖ tmr-project-impact: could not reach registry — Skill "tmr-project-impact" not found in registry
```

The error message `Skill "tmr-project-impact" not found in registry` is emitted by `fetchSkillContent()` when it receives an **HTTP 404**. The GitHub raw URL being fetched is:

```
https://raw.githubusercontent.com/marlonvidal/tech-manager-os/main/skills/tmr-project-impact/SKILL.md
```

This returned 404 because `skills/tmr-project-impact/SKILL.md` **did not have a proper semantic version** — and, more critically, the registry copy was not yet registered as a fully-published skill. The sprint proposal defines the fix as: add `tmr-project-impact` to the registry with a proper semantic version ≥ 1.0.0.

### How the two skill copies work

There are **two separate copies** of the skill's SKILL.md, each serving a different purpose:

| File | Used by | How version is read |
|---|---|---|
| `docs/skills/tmr-project-impact/SKILL.md` | `tmr init` (bundled install — no network) | `parseBundledVersion(content)` → regex `<!--\s*version:\s*(\S+)\s*-->`, defaults to `0.0.0` |
| `skills/tmr-project-impact/SKILL.md` | `tmr update` + `tmr install` (GitHub raw URL) | `parseVersion(content)` → same regex, defaults to `0.0.0` |

Both functions use **identical regexes**: `/<!--\s*version:\s*(\S+)\s*-->/`. When the comment is absent, installed version is `0.0.0`.

During `tmr init`, `installDefaultSkill()` reads `docs/skills/tmr-project-impact/SKILL.md` from the **bundled package** and calls `parseBundledVersion(content)` — no network needed. The installed version recorded in `skill-manifest.json` is whatever `parseBundledVersion` returns (`0.0.0` today, because no version comment exists in either copy).

During `tmr update`, `SkillRegistryService.fetchSkillContent('tmr-project-impact')` fetches:
```
https://raw.githubusercontent.com/marlonvidal/tech-manager-os/main/skills/tmr-project-impact/SKILL.md
```
If that returns **200**, the content is parsed for a version comment. If found, the registry version is compared against the installed version. If registry version is newer, the skill is updated.

### Why the other skills work

`tmr-inbox` and `tmr-myself-config` both exist at their GitHub raw URLs and return 200. Even without a version comment (returning `0.0.0`), `isNewerVersion('0.0.0', '0.0.0')` = false → "already up to date". They never error.

### The fix

1. Add `<!-- version: 1.0.0 -->` to **`skills/tmr-project-impact/SKILL.md`** (registry copy) — when committed/pushed to GitHub main, `tmr update` will find the file and see version `1.0.0` > installed `0.0.0`, triggering an update.
2. Add `<!-- version: 1.0.0 -->` to **`docs/skills/tmr-project-impact/SKILL.md`** (bundled copy) — future `tmr init` runs install at v1.0.0, keeping installed and registry versions in sync.
3. `skills/index.json` already contains `"tmr-project-impact"` — **no change needed**.
4. Add packaging tests to guard the registry integrity going forward (prevent future regression where a new skill is published without a version comment).
5. Add integration test covering the `tmr update` flow for `tmr-project-impact`.

---

## Acceptance Criteria

```gherkin
Feature: tmr-project-impact published to registry

  Scenario: tmr update resolves tmr-project-impact without error (AC-1)
    Given tmr-project-impact is installed in the vault
    When tmr update runs
    Then the output does NOT contain "could not reach registry"
    And the output shows either "updated" or "already up to date" for tmr-project-impact
    And exit code is 0

  Scenario: skills/index.json contains tmr-project-impact (AC-2)
    Given the skills/index.json file at the repo root
    When it is parsed as JSON
    Then it contains the string "tmr-project-impact"

  Scenario: registry copy has a semantic version comment (AC-3)
    Given skills/tmr-project-impact/SKILL.md exists in the repo
    When its content is read
    Then it contains a <!-- version: X.Y.Z --> comment where X.Y.Z >= 1.0.0
    And parseVersion() returns the version string (not "0.0.0")

  Scenario: bundled copy has a semantic version comment (AC-4)
    Given docs/skills/tmr-project-impact/SKILL.md exists in the repo
    When its content is read
    Then it contains a <!-- version: X.Y.Z --> comment where X.Y.Z >= 1.0.0
    And parseBundledVersion() returns the version string (not "0.0.0")

  Scenario: tmr install tmr-project-impact resolves correctly (AC-5)
    Given the registry returns 200 with skill content
    When tmr install tmr-project-impact is run
    Then the skill is installed to .claude/skills/tmr-project-impact/SKILL.md
    And the manifest records version 1.0.0
```

---

## Tasks

- [x] **Task 1** — Add `<!-- version: 1.0.0 -->` to `skills/tmr-project-impact/SKILL.md`
  - Place the comment **after** the YAML frontmatter closing `---`, on a line by itself
  - The frontmatter structure is:
    ```
    ---
    name: tmr-project-impact
    description: ...
    ---
    <!-- version: 1.0.0 -->

    # tmr-project-impact
    ```
  - Do NOT alter any other content in the file
  - Verify: `grep '<!-- version:'` returns the comment

- [x] **Task 2** — Add `<!-- version: 1.0.0 -->` to `docs/skills/tmr-project-impact/SKILL.md`
  - Same placement as Task 1 (after frontmatter closing `---`)
  - Verify the files `skills/` and `docs/skills/` have the same version comment

- [x] **Task 3** — Verify `skills/index.json` (read-only check, no change expected)
  - Read `skills/index.json` and confirm it contains `"tmr-project-impact"`
  - The file currently reads: `["tmr-inbox", "tmr-myself-config", "tmr-project-impact"]`
  - **No file change needed** — this task is purely a verification step

- [x] **Task 4** — Add packaging tests in `tests/packaging/skill-registry.test.ts` (NEW FILE)
  - Pattern: read real files from disk (like `tests/packaging/npmignore.test.ts` and `build-output.test.ts`)
  - Tests to write:
    - `SKILL-PKG-001` — `skills/index.json` is valid JSON and contains `"tmr-project-impact"`
    - `SKILL-PKG-002` — `skills/tmr-project-impact/SKILL.md` exists and contains a `<!-- version: X.Y.Z -->` comment
    - `SKILL-PKG-003` — `docs/skills/tmr-project-impact/SKILL.md` exists and contains a `<!-- version: X.Y.Z -->` comment
    - `SKILL-PKG-004` — The version in both copies is identical (registry and bundled are in sync)
    - `SKILL-PKG-005` — All skills listed in `skills/index.json` have a corresponding `skills/<name>/SKILL.md` file (guards future regressions)

- [x] **Task 5** — Add integration test to `tests/integration/install-update.integration.test.ts` (MODIFY)
  - Add a new describe block: `"Test F: tmr update — tmr-project-impact resolves without error"`
  - Pre-install `tmr-project-impact` at `0.0.0` using `fs.mkdirp` + `skill-manifest.json`
  - Mock the registry to return 200 with `<!-- version: 1.0.0 -->` content
  - Run `runUpdate({ plain: true, json: false })`
  - Assert:
    - `process.exitCode` is **not** 1 (no error exit)
    - stdout does **not** contain `could not reach registry`
    - stdout contains `updated` for `tmr-project-impact`
  - Test ID: `SKILL-INT-006`

- [x] **Task 6** — Run `npm test` and verify all tests pass, including new ones

---

## Dev Notes

### Version comment placement

The YAML frontmatter in these skill files uses `---` delimiters. The version comment must be placed **after** the closing `---` on a new line. Example:

```markdown
---
name: tmr-project-impact
description: Detect changes in project source files...
---
<!-- version: 1.0.0 -->

# tmr-project-impact
```

The regex `/<!--\s*version:\s*(\S+)\s*-->/` searches the entire file content (not line-by-line), so placement relative to other content does not matter technically — but post-frontmatter placement is the cleanest convention.

### What `skills/` vs `docs/skills/` is for

- `skills/` — GitHub raw content source. This is what `tmr install` and `tmr update` download at runtime. These files are **excluded** from the npm package (via `.npmignore`: `skills/` is listed as excluded).
- `docs/skills/` — Bundled into the npm package. These files are read by `InitService._readBundledSkill()` during `tmr init` — no network needed. Path resolution: `path.join(pkgRoot, 'docs', 'skills', docsFolder, 'SKILL.md')`.

Both copies must have the version comment or the user will get stuck at `0.0.0` for the bundled install and then see a "version bump" to `1.0.0` on first `tmr update`. That is the desired UX — bundled version matches registry, and future updates bump both.

### `parseVersion` / `parseBundledVersion` — same regex

Both use `/<!--\s*version:\s*(\S+)\s*-->/`. Default is `'0.0.0'` if not found. No code change needed — just add the version comment to the files.

### `skills/index.json` — no change needed

```json
["tmr-inbox", "tmr-myself-config", "tmr-project-impact"]
```

This file is already correct. The bug was exclusively that `skills/tmr-project-impact/SKILL.md` was not accessible at the GitHub raw URL — the index was fine.

### New packaging test file pattern

Follow the pattern in `tests/packaging/npmignore.test.ts`:

```typescript
import { describe, expect, it } from '@jest/globals';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../../');
```

Read files with `fs.readFileSync()`. No mocking needed — these are pure structural tests.

### Integration test pattern for `tmr update`

Look at the existing describe blocks in `tests/integration/install-update.integration.test.ts`. The test pre-installs a skill by writing a `skill-manifest.json` to `tmpDir/.claude/skills/`. Key snippet pattern:

```typescript
// Pre-install tmr-project-impact at v0.0.0
const skillsDir = path.join(tmpDir, '.claude', 'skills');
await fs.mkdirp(skillsDir);
await fs.writeFile(
  path.join(skillsDir, 'skill-manifest.json'),
  JSON.stringify([{ name: 'tmr-project-impact', version: '0.0.0', installedAt: new Date().toISOString() }]),
);
await fs.mkdirp(path.join(skillsDir, 'tmr-project-impact'));
await fs.writeFile(path.join(skillsDir, 'tmr-project-impact', 'SKILL.md'), '<!-- version: 0.0.0 -->\n# Old skill');
```

Then set `mockHttpsGetImpl` to return 200 with version `1.0.0` content for `tmr-project-impact`, run `runUpdate({ plain: true, json: false })`, and assert no error.

### Test ID allocation

| ID | Test |
|---|---|
| SKILL-PKG-001 | `skills/index.json` contains `tmr-project-impact` |
| SKILL-PKG-002 | `skills/tmr-project-impact/SKILL.md` has version comment ≥ 1.0.0 |
| SKILL-PKG-003 | `docs/skills/tmr-project-impact/SKILL.md` has version comment ≥ 1.0.0 |
| SKILL-PKG-004 | Registry and bundled copies have identical version comments |
| SKILL-PKG-005 | All entries in `skills/index.json` have corresponding SKILL.md files |
| SKILL-INT-006 | `tmr update` resolves `tmr-project-impact` at 1.0.0 without error |

---

## Previous Story Intelligence (8.3)

Key learnings from Story 8.3 implementation:

- **`jest.clearAllMocks()` does NOT clear `mockResolvedValueOnce` queues.** If you chain multiple `mockResolvedValueOnce` calls, leftover queue entries contaminate subsequent tests. Use `mockReset()` or ensure each test sets up its own complete queue in the correct order.
- **Integration tests must follow the `describe → it` pattern** used in the file — do not flatten test structure.
- **`process.exitCode` check**: Use `expect(process.exitCode).toBeUndefined()` or `expect(process.exitCode).not.toBe(1)` consistently with the existing test style.
- **`stdoutSpy.mock.calls`**: To assert stdout content, use `calls.flat().join('')` or `calls.map(([arg]) => String(arg)).join('')` — the spy captures each `write()` call as a separate entry.
- **Commit message style**: `story-8.X: <short description>` (lowercase, hyphenated)

---

## Architecture Compliance

- No new npm dependencies — this is a data-only change.
- Do NOT modify `SkillRegistryService`, `update.command.ts`, `install.command.ts`, or any service logic.
- Do NOT modify `skills/index.json` (already correct).
- The two SKILL.md files to modify: `skills/tmr-project-impact/SKILL.md` and `docs/skills/tmr-project-impact/SKILL.md`.
- New test file lives at `tests/packaging/skill-registry.test.ts`.
- Modified test file: `tests/integration/install-update.integration.test.ts`.
- After change: `npm test` must pass with 0 suite failures.

---

## File List

| File | Action | Description |
|---|---|---|
| `skills/tmr-project-impact/SKILL.md` | MODIFIED | Added `<!-- version: 1.0.0 -->` comment after YAML frontmatter |
| `docs/skills/tmr-project-impact/SKILL.md` | MODIFIED | Added `<!-- version: 1.0.0 -->` comment after YAML frontmatter |
| `tests/packaging/skill-registry.test.ts` | CREATED | 5 packaging tests: SKILL-PKG-001 through SKILL-PKG-005 |
| `tests/integration/install-update.integration.test.ts` | MODIFIED | Added SKILL-INT-006: tmr update with tmr-project-impact |

---

### Review Findings

- [x] [Review][Patch] Weak exit-code assertion allows non-1 failure codes — change `.not.toBe(1)` to `.toBeUndefined()` [tests/integration/install-update.integration.test.ts:SKILL-INT-006]
- [x] [Review][Patch] SKILL-INT-006 missing manifest assertion — after runUpdate, assert skill-manifest.json records version '1.0.0' for tmr-project-impact [tests/integration/install-update.integration.test.ts:SKILL-INT-006]
- [x] [Review][Patch] SKILL-PKG-005 vacuous on empty array — add `expect(registrySkills.length).toBeGreaterThan(0)` guard before the loop [tests/packaging/skill-registry.test.ts:SKILL-PKG-005]
- [x] [Review][Defer] tmr-inbox and tmr-myself-config have no version comments — parseVersion() returns 0.0.0; future content updates silently skipped if installed version advances above 0.0.0 — deferred, pre-existing
- [x] [Review][Defer] docs/ bundled skills excluded from npm publish — SKILL-PKG-003 tests the repo layout but not the published artifact; InitService._readBundledSkill() path may not exist post-install — deferred, pre-existing
- [x] [Review][Defer] Content-only registry changes without version bump are silently ignored after 1.0.0 — isNewerVersion uses strict > — deferred, pre-existing architectural design
- [x] [Review][Defer] SKILL-PKG-004 checks version string equality only, not skill body parity — registry and bundled copies can diverge in content while both pass — deferred, enhancement beyond scope
- [x] [Review][Defer] No test for "registry returns 0.0.0" (no version comment) scenario in SKILL-INT-006 — silent no-op would pass test — deferred, enhancement
- [x] [Review][Defer] semverAtLeast() NaN-blind for non-semver captures (e.g. '1.0.0-beta', 'v1.0.0') — same behavior as production parseVersion(); risk is low with controlled input — deferred, pre-existing

## Dev Agent Record

### Agent Model Used

Sonnet 4.6

### Completion Notes List

- Added `<!-- version: 1.0.0 -->` comment after YAML frontmatter in `skills/tmr-project-impact/SKILL.md` (registry copy). When committed/pushed to GitHub main, `tmr update` will receive HTTP 200 and parse version `1.0.0` instead of 404.
- Added identical `<!-- version: 1.0.0 -->` comment to `docs/skills/tmr-project-impact/SKILL.md` (bundled copy). Future `tmr init` runs install at v1.0.0 via `parseBundledVersion()`, keeping installed and registry versions in sync.
- `skills/index.json` already contained `"tmr-project-impact"` — no change required.
- Created `tests/packaging/skill-registry.test.ts` with 5 structural packaging tests (SKILL-PKG-001 through 005): verifies index.json contains the skill, both SKILL.md copies have version comments ≥ 1.0.0, both copies are in sync, and all index.json entries have corresponding SKILL.md files.
- Added SKILL-INT-006 to `tests/integration/install-update.integration.test.ts`: pre-installs `tmr-project-impact` at v0.0.0, mocks registry returning v1.0.0, runs `runUpdate`, asserts no error output, "updated" in stdout, and SKILL.md on disk updated to registry content.
- Full regression: 69 suites, 1100 tests — all green. 8 new tests added across 2 files.

### Debug Log References

- No debug issues encountered. Implementation was additive data-only changes plus tests — all green on first run.
