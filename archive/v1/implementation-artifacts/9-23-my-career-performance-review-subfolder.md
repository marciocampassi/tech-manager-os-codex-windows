---
baseline_commit: edfbcb36d70ac2eefc2342f0cf1b8fc1da0d2156
---

# Story 9.23: `my-career` performance-review subfolder

Status: done

## Story

As a user running `tmr myself add performance-review`,
I want the performance review file created under `my-career/performance-reviews/`,
so that `my-career/` stays clean and follows the same typed-subdirectory convention as all other entity scopes.

## Acceptance Criteria

1. **Given** `tmr init` runs, **When** the vault is scaffolded, **Then** `my-career/performance-reviews/` directory exists.
2. **Given** user runs `tmr myself add performance-review`, **When** the command succeeds, **Then** the file is written to `my-career/performance-reviews/YYYY-MM-performance-review-<email>.md`.
3. **Given** user runs `tmr myself add performance-review`, **When** the command succeeds, **Then** the wiki-link appended to the self-profile reads `- [[performance-reviews/YYYY-MM-performance-review-<email>.md]]`.
4. **Given** user runs `tmr myself add performance-review`, **When** the command succeeds, **Then** `my-career/<email>.md` (the self-profile) remains flat and unaffected — the profile file itself does NOT move.

## Tasks / Subtasks

- [x] Add `my-career/performance-reviews` to `VAULT_DIRS` in `init.service.ts` (AC: #1)
  - [x] Insert `'my-career/performance-reviews'` directly after the `'my-career'` entry in `VAULT_DIRS`
- [x] Update `MyselfService.addPerformanceReview()` — fix `filePath` (AC: #2)
  - [x] Change `path.join(careerRoot, fileName)` → `path.join(careerRoot, 'performance-reviews', fileName)`
- [x] Update `MyselfService.addPerformanceReview()` — fix `wikiLink` (AC: #3)
  - [x] Change `` `- [[${fileName}]]` `` → `` `- [[performance-reviews/${fileName}]]` ``
- [x] Update `tests/services/myself.service.test.ts` — fix all path assertions that assume flat `my-career/` layout
  - [x] Update regex in `'creates a performance-review file...'` test to match `/my-career/performance-reviews/`
  - [x] Rename and invert the `'writes file into my-career/ (flat — no subdirectory)'` test — it must now assert the `performance-reviews/` subfolder IS present
  - [x] Update `'falls back to current month...'` test regex to match `/my-career/performance-reviews/`
  - [x] Update the wiki-link assertion in `'appends wiki-link...'` test to expect `- [[performance-reviews/YYYY-MM-performance-review-<email>.md]]`

### Review Findings

- [x] [Review][Patch] Update `project-context.md` vault structure docs [`_bmad-output/project-context.md`:276,284]
- [x] [Review][Defer] No migration for pre-9.23 flat performance-review files in `my-career/` — deferred, out of story scope (intentional supersede of 9.16 flat layout)
- [x] [Review][Defer] `resolveSelfEmail` / `_resolveManagerLink` lack dated-file filter when flat review files exist — deferred, pre-existing from 9.16; 9.23 improves forward path by writing new reviews to subfolder

## Dev Notes

### Files to Change

| File | Change |
|------|--------|
| `src/services/init.service.ts` | Add `'my-career/performance-reviews'` to `VAULT_DIRS` |
| `src/services/myself.service.ts` | Update `filePath` and `wikiLink` in `addPerformanceReview()` |
| `tests/services/myself.service.test.ts` | Update 4 test assertions broken by the path change |

**No other files need to change.** `myself.command.ts`, `cli.ts`, and command-layer tests do not reference paths directly.

### Exact Code Changes

#### `src/services/init.service.ts` — `VAULT_DIRS`

```typescript
// BEFORE (line 27):
  'my-career',
  'knowledge-base',

// AFTER:
  'my-career',
  'my-career/performance-reviews',
  'knowledge-base',
```

#### `src/services/myself.service.ts` — `addPerformanceReview()`

```typescript
// BEFORE (lines 75-81):
const fileName = `${datePrefix}-performance-review-${ownEmail}.md`;
const filePath = path.join(careerRoot, fileName);

const content = this._template.getTemplate('performance-review', datePrefix, ownEmail);
await this._fs.writeFile(filePath, content);

const wikiLink = `- [[${fileName}]]`;

// AFTER:
const fileName = `${datePrefix}-performance-review-${ownEmail}.md`;
const filePath = path.join(careerRoot, 'performance-reviews', fileName);

const content = this._template.getTemplate('performance-review', datePrefix, ownEmail);
await this._fs.writeFile(filePath, content);

const wikiLink = `- [[performance-reviews/${fileName}]]`;
```

### Test Changes Required — `tests/services/myself.service.test.ts`

Four existing tests must be updated. The profile-discovery logic itself is unchanged — only path and wiki-link assertions break.

**Test 1 — line 99–113: `'creates a performance-review file in my-career/ with current month prefix'`**

```typescript
// BEFORE:
expect(result.filePath).toMatch(/\/my-career\/\d{4}-\d{2}-performance-review-/);

// AFTER:
expect(result.filePath).toMatch(/\/my-career\/performance-reviews\/\d{4}-\d{2}-performance-review-/);
```

**Test 2 — line 144–153: `'appends wiki-link to Performance Reviews section of self profile'`**

```typescript
// BEFORE:
expect(mockSectionParser.appendToFile).toHaveBeenCalledWith(
  PROFILE_PATH,
  'Performance Reviews',
  `- [[${expectedFileName}]]`,
);

// AFTER:
expect(mockSectionParser.appendToFile).toHaveBeenCalledWith(
  PROFILE_PATH,
  'Performance Reviews',
  `- [[performance-reviews/${expectedFileName}]]`,
);
```

**Test 3 — line 164–171: `'writes file into my-career/ (flat — no subdirectory)'`**

This test was written to document the OLD flat-file behaviour. It must be renamed and inverted:

```typescript
// BEFORE (asserts no subdir):
it('writes file into my-career/ (flat — no subdirectory)', async () => {
  await svc.addPerformanceReview({ date: '2026-05' }, WORKSPACE);
  const [[writtenPath]] = mockFS.writeFile.mock.calls as [string, string][];
  expect(writtenPath).toContain(`/my-career/`);
  const relativeToCareer = writtenPath.replace(`${CAREER_ROOT}/`, '');
  expect(relativeToCareer).not.toContain('/');
});

// AFTER (asserts performance-reviews/ subdir):
it('writes file into my-career/performance-reviews/ subdirectory', async () => {
  await svc.addPerformanceReview({ date: '2026-05' }, WORKSPACE);
  const [[writtenPath]] = mockFS.writeFile.mock.calls as [string, string][];
  expect(writtenPath).toContain(`/my-career/performance-reviews/`);
  const relativeToCareer = writtenPath.replace(`${CAREER_ROOT}/`, '');
  expect(relativeToCareer).toContain('performance-reviews/');
});
```

**Test 4 — line 195–199: `'falls back to current month when --date is empty string'`**

```typescript
// BEFORE:
expect(result.filePath).toMatch(/\/my-career\/\d{4}-\d{2}-performance-review-/);

// AFTER:
expect(result.filePath).toMatch(/\/my-career\/performance-reviews\/\d{4}-\d{2}-performance-review-/);
```

### Profile Discovery Is Unaffected

`FileSystemService.listFiles()` is **non-recursive** — it uses `fs.readdir` with `{ withFileTypes: true }` and filters for `entry.isFile()`. This means:

- Directory entries (including the new `performance-reviews/` dir) are excluded by `isFile() === false`
- `listFiles(careerRoot, '.md')` continues to return only `my-career/*.md` files
- The `nonDatedFiles` heuristic used to find the self-profile will not pick up anything from the subfolder

No changes needed to the profile-discovery logic in `addPerformanceReview()`.

### Vault Structure Context

Per `project-context.md`:

> `my-career/` is flat — `my-career/<email>.md` only, no subfolder. This is the only exception.

This story refines that rule: the **self-profile itself** remains flat (`my-career/<email>.md`). Dated subdocuments (performance reviews) now get a typed subdirectory — aligning `my-career/` with every other entity scope. The profile file is NOT moved.

Updated vault structure after this story:

```
my-career/
  <email>.md                             ← self-profile (flat, unchanged)
  performance-reviews/
    YYYY-MM-performance-review-<email>.md
```

This is consistent with the typed-subdir pattern used everywhere else:

| Scope | Subdirs |
|---|---|
| Direct report | `1on1s/`, `feedbacks/`, `assessments/`, `performance-reviews/` |
| Company member | `1on1s/`, `feedbacks/`, `assessments/`, `performance-reviews/` |
| Contractor | `1on1s/`, `feedbacks/`, `assessments/`, `performance-reviews/` |
| Self (after this story) | `performance-reviews/` |

### Regression Guard — Story 9.16

Story 9.16 (`myself-add-performance-review`) documented the flat path as intentional. That story's `File List` notes: _"Wiki-link appended as `- [[YYYY-MM-performance-review-<email>.md]]` (no subdir prefix since `my-career/` is flat)."_

This story intentionally supersedes that decision. The `project-context.md` rule about `my-career/` being flat was written before the performance-reviews subdirectory was needed.

**Do NOT preserve the old flat path** — it is the bug being fixed.

### Anti-patterns to Avoid

- Do NOT call `this._fs.createDirectory()` inside `addPerformanceReview()` for the `performance-reviews/` dir — it is created by `scaffold()` via `VAULT_DIRS`. The service must not pre-create dirs on write.
- Do NOT move or rename the self-profile (`my-career/<email>.md`) — only the dated review files go into the subfolder.
- Do NOT change the `listFiles(careerRoot, '.md')` call to add recursive scanning — it works correctly as-is.

### Project Structure Notes

- `VAULT_DIRS` is defined as `const` with `as const` assertion at `src/services/init.service.ts:17`. Append the new dir as a string literal in the same array. No type changes needed.
- All `.js` extension imports required (ESM `"type": "module"`) — no new imports in this story.
- Run `npm run validate` (lint + typecheck + test + build) before marking done.

### References

- Story 9.16 implementation (prior work & test patterns): `_bmad-output/implementation-artifacts/9-16-myself-add-performance-review.md`
- Sprint change proposal (root cause & exact code diff): `_bmad-output/planning-artifacts/sprint-change-proposal-2026-06-09-post-uat-bugs-3.md#Story-9.23`
- Vault structure rules: `_bmad-output/project-context.md` — `⚠ CRITICAL: Canonical Entity Resolution & Vault Structure`
- `VAULT_DIRS` definition: `src/services/init.service.ts:17-32`
- `MyselfService.addPerformanceReview()`: `src/services/myself.service.ts:42-85`
- `FileSystemService.listFiles()` (non-recursive contract): `src/services/file-system.service.ts:139-153`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-5

### Debug Log References

- Windows path separator issue: `path.join` on Windows produces backslashes; the 4 test assertions from the story spec used forward-slash literals. Fixed by using `[\/\\]` character class in regex patterns and rewriting the `toContain` check as a single `.toMatch` regex. This also corrected a pre-existing Windows path bug in those same tests from story 9.16.
- Pre-existing test failure `INIT-UNIT-006` (init.service.test.ts): expects `'tmr project add'` in `printPostInitSummary` output, but story 9.25 rewrote that function and the test was not updated. Not in scope for story 9.23.

### Completion Notes List

- Added `'my-career/performance-reviews'` to `VAULT_DIRS` — vault scaffold now creates this directory on `tmr init` (AC #1).
- Updated `MyselfService.addPerformanceReview()`: `filePath` now uses `path.join(careerRoot, 'performance-reviews', fileName)` and `wikiLink` now reads `- [[performance-reviews/${fileName}]]` (AC #2, #3).
- Self-profile (`my-career/<email>.md`) is untouched — only dated review files move to the subfolder (AC #4).
- Updated 4 test assertions in `myself.service.test.ts` to match new path/wikilink; made path regexes cross-platform with `[\/\\]` character classes.
- Updated `init.service.test.ts`: directory count 14→15 and added `my-career/performance-reviews` to INIT-UNIT-001 required-dirs list.
- All 11 `myself.service.test.ts` tests pass. Lint, typecheck, and build all pass.

### File List

- `src/services/init.service.ts`
- `src/services/myself.service.ts`
- `tests/services/myself.service.test.ts`
- `tests/services/init.service.test.ts`
- `_bmad-output/project-context.md`

## Change Log

- 2026-06-09: Implemented story 9.23 — moved `tmr myself add performance-review` output from `my-career/<file>` to `my-career/performance-reviews/<file>`; added `my-career/performance-reviews` to vault scaffold; updated wiki-link prefix; updated 4 test assertions cross-platform. Pre-existing test failure (INIT-UNIT-006) noted and not in scope.
- 2026-06-09: Code review — updated `project-context.md` vault structure docs for `my-career/performance-reviews/` subdir; story marked done.
