# Story 1.3: File-Anchored Wiki-Link Utility

Status: done

## Story

As a developer implementing any service that writes Markdown referencing people, teams, or leaders,
I want a standalone `formatWikiLink()` utility that produces a properly formed Obsidian wiki-link anchored to a specific file,
so that all entity references across the codebase use one consistent format and the existing duplicated inline implementations are superseded.

## Acceptance Criteria

1. `src/utils/wiki-link.ts` exports `formatWikiLink(resolvedPath: string, fromPath: string, displayName: string): string` that returns `[[relative/path/to/file.md|displayName]]` with `/` as the path separator on all platforms.
2. When `resolvedPath` and `fromPath` are in the same directory, the result uses the filename only (e.g. `[[email@co.com.md|email@co.com]]`).
3. `formatWikiLink` called with a display name of `"joao@company.com"` and an entity file at a different directory depth returns `[[relative/path/joao@company.com.md|joao@company.com]]` with correct relative pathing.
4. `EmailResolutionService.generateWikiLink()` (`src/services/email-resolution.service.ts`) is marked `@deprecated` with a JSDoc comment pointing to `formatWikiLink` from `src/utils/wiki-link.ts`. The existing method body is **not changed** — only the deprecation tag is added.
5. `tests/utils/wiki-link.test.ts` exists and the test suite passes: VAL-UNIT-007 (`formatWikiLink` returns correct `[[path|name]]` format for different-directory paths) and VAL-UNIT-008 (`formatWikiLink` returns filename-only format for same-directory paths) both pass.
6. All pre-existing tests continue to pass (no regressions) — `npm run validate` exits 0.

## Tasks / Subtasks

- [x] Create `src/utils/wiki-link.ts` (AC: 1–3)
  - [x] Export `formatWikiLink(resolvedPath: string, fromPath: string, displayName: string): string`
  - [x] Implement: compute relative path with `path.relative(path.dirname(fromPath), resolvedPath)`, normalize separators with `.split(path.sep).join('/')`, return `[[normalizedRel|displayName]]`
  - [x] Add explicit return type annotation (ESLint warn rule)
  - [x] Add `// ── Wiki-Link Formatting ──` section divider (follow `display.ts` / `normalization.ts` style)
  - [x] Use `node:path` import (canonical ESM form used throughout the project)

- [x] Create `tests/utils/wiki-link.test.ts` (AC: 5)
  - [x] VAL-UNIT-007: different-directory case — `formatWikiLink('/ws/my-teams/members/a@b.com.md', '/ws/my-leadership/a@b.com/a@b.com.md', 'a@b.com')` → `[[../../my-teams/members/a@b.com.md|a@b.com]]`
  - [x] VAL-UNIT-008: same-directory case — `formatWikiLink('/ws/members/a@b.com.md', '/ws/members/other.md', 'a@b.com')` → `[[a@b.com.md|a@b.com]]`
  - [x] Additional: `fromPath` one level up (parent → child subdir), custom `displayName` differs from filename, path with spaces (if applicable)

- [x] Mark `EmailResolutionService.generateWikiLink()` `@deprecated` (AC: 4)
  - [x] Add JSDoc `@deprecated Use \`formatWikiLink\` from \`src/utils/wiki-link.ts\` instead.` above the `generateWikiLink` method in `src/services/email-resolution.service.ts`
  - [x] Do NOT change the method body or its callers in this story — the method remains functional

- [x] Run `npm run validate` — lint + typecheck + test + build must all pass (AC: 6)

### Review Findings

- [x] [Review][Patch] Missing JSDoc on `formatWikiLink` — both peer utilities (`validateEmail`, `normalizeSlug`) have JSDoc blocks; `formatWikiLink` has none; inconsistent with established pattern [src/utils/wiki-link.ts:5]
- [x] [Review][Defer] Empty `resolvedPath` silently resolves to `process.cwd()` [src/utils/wiki-link.ts:10] — deferred, pre-existing (same behavior in `generateWikiLink`)
- [x] [Review][Defer] Path-separator normalization test trivially passes on macOS/Linux [tests/utils/wiki-link.test.ts:56] — deferred, CI runs on macOS; OS-path mocking not established in test suite
- [x] [Review][Defer] `fromPath` as a bare directory path shifts relative result by one level [src/utils/wiki-link.ts:10] — deferred, pre-existing in `generateWikiLink`; no caller passes a directory

## Dev Notes

### Implementation (Exact)

```ts
import path from 'node:path';

// ── Wiki-Link Formatting ──────────────────────────────────────────────────────

export function formatWikiLink(resolvedPath: string, fromPath: string, displayName: string): string {
  const rel = path.relative(path.dirname(fromPath), resolvedPath);
  const normalizedRel = rel.split(path.sep).join('/');
  return `[[${normalizedRel}|${displayName}]]`;
}
```

This is identical in logic to `EmailResolutionService.generateWikiLink()` (lines 66–70 of `src/services/email-resolution.service.ts`), but:
- Extracted as a standalone exported utility (no class coupling)
- `displayName` parameter replaces the forced `email.toLowerCase()` inline — callers control the display text
- Same relative-path computation via `path.relative(path.dirname(fromPath), resolvedPath)`
- Same cross-platform separator normalization via `.split(path.sep).join('/')`

### Scope Boundary (Story 1.3 Only)

This story creates the utility and marks the old method deprecated. It does **NOT**:
- Replace the private `buildWikiLink()` helper in `src/services/team.service.ts` (line 126) — done in Epic 2/3 when those services are reworked
- Replace callers of `EmailResolutionService.generateWikiLink()` in `project.service.ts` (lines 165, 186, 208, 236) — done when ProjectService is refactored
- Replace inline wiki-link strings in `src/templates/onboarding.templates.ts` — out of scope
- Wire `formatWikiLink` into any existing service — all new Epics 2 & 3 code will use the new utility by default; existing callers remain on the old path until their story arrives

### Two Legacy Implementations to Be Aware Of

| Location | Implementation | Status After Story 1.3 |
|---|---|---|
| `src/services/email-resolution.service.ts:66` `generateWikiLink(email, resolvedPath, fromPath)` | Returns `[[rel\|email.toLowerCase()]]` | Marked `@deprecated`, body unchanged |
| `src/services/team.service.ts:126` `buildWikiLink(email)` | Private: `- [[../../members/email/email.md\|email]]` | Left as-is; NOT a target in this story |

### `EmailResolutionService.generateWikiLink()` Deprecation Pattern

```ts
/**
 * @deprecated Use `formatWikiLink` from `src/utils/wiki-link.ts` instead.
 * This method remains for backward compatibility with existing callers in
 * `ProjectService`. New code in Epics 2 and 3 must use the standalone utility.
 *
 * Generates an Obsidian-compatible wiki-link string (without the leading `- `).
 * The relative path is computed from `fromPath`'s directory to `resolvedPath`,
 * with path separators normalized to `/` for cross-platform compatibility.
 *
 * Callers prepend `- ` when appending to a section, e.g.:
 *   `- ${generateWikiLink(email, resolved.absolutePath, compPath)}`
 */
generateWikiLink(email: string, resolvedPath: string, fromPath: string): string {
  // ... unchanged body ...
}
```

### ESM Import Rules (Critical)

```ts
// In src/utils/wiki-link.ts
import path from 'node:path';

// In test file
import { formatWikiLink } from '../../src/utils/wiki-link.js';  // .js extension required
```

### Test Pattern (follow `tests/utils/validation.test.ts` and `tests/utils/normalization.test.ts`)

```ts
import { describe, it, expect } from '@jest/globals';
import { formatWikiLink } from '../../src/utils/wiki-link.js';

describe('formatWikiLink', () => {
  it('VAL-UNIT-007: different-directory path with correct relative segments', () => {
    const result = formatWikiLink(
      '/ws/my-teams/members/a@b.com.md',
      '/ws/my-leadership/a@b.com/a@b.com.md',
      'a@b.com',
    );
    expect(result).toBe('[[../../my-teams/members/a@b.com.md|a@b.com]]');
  });

  it('VAL-UNIT-008: same-directory returns filename only', () => {
    const result = formatWikiLink(
      '/ws/members/a@b.com.md',
      '/ws/members/other.md',
      'a@b.com',
    );
    expect(result).toBe('[[a@b.com.md|a@b.com]]');
  });
});
```

### Regression Safety

No existing service is modified to call the new utility in this story — all existing callers of `buildWikiLink` and `generateWikiLink` remain untouched. The only source change outside `src/utils/wiki-link.ts` is adding a `@deprecated` JSDoc line to `EmailResolutionService.generateWikiLink`. This cannot break any existing tests.

**Watch for:** On Windows CI, `path.sep` is `\\`. The `.split(path.sep).join('/')` normalization in `formatWikiLink` is what handles this. Do not short-circuit it.

### Code Organization Within the File

Follow the divider pattern from `src/utils/normalization.ts` and `src/utils/display.ts`:
```ts
import path from 'node:path';

// ── Wiki-Link Formatting ──────────────────────────────────────────────────────

export function formatWikiLink(...): string {
  ...
}
```

No class, no default export, no barrel re-export. Single function, single responsibility.

### Project Structure Notes

| Action | Path |
|--------|------|
| CREATE | `src/utils/wiki-link.ts` |
| CREATE | `tests/utils/wiki-link.test.ts` |
| UPDATE | `src/services/email-resolution.service.ts` (add `@deprecated` JSDoc only) |

All other files are read-only context for this story.

### References

- Epic 1, Story 1.3 AC: `_bmad-output/planning-artifacts/epics.md` lines 295–323
- ARCH-002 technical requirement: `_bmad-output/planning-artifacts/epics.md` line 79
- TEA-INFRA-003: `_bmad-output/planning-artifacts/epics.md` line 97
- Quality gate R-004: `_bmad-output/planning-artifacts/epics.md` line 109
- Existing `generateWikiLink` to deprecate: `src/services/email-resolution.service.ts` lines 58–70
- Existing `buildWikiLink` (context only, not touched): `src/services/team.service.ts` lines 126–128
- ESM import rule: `_bmad-output/project-context.md` §Language-Specific Rules
- File naming conventions: `_bmad-output/project-context.md` §File & Folder Naming
- Code organization divider pattern: `_bmad-output/project-context.md` §Code Organization Within Files
- Story 1.2 pattern (parallel utility): `_bmad-output/implementation-artifacts/1-2-entity-slug-normalization-utility.md`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Created `src/utils/wiki-link.ts` with a single exported `formatWikiLink(resolvedPath, fromPath, displayName)` function. Uses `path.relative(path.dirname(fromPath), resolvedPath)` + `.split(path.sep).join('/')` for cross-platform separator normalization. Returns `[[normalizedRel|displayName]]`. Follows the `// ── Section Name ──` divider pattern and uses `node:path` canonical import. Pure utility — no side effects, no console output.
- Created `tests/utils/wiki-link.test.ts` with 6 test cases: VAL-UNIT-007 (different-directory cross-path), VAL-UNIT-008 (same-directory filename-only), parent→child, child→parent, displayName differs from filename, and forward-slash assertion. All 6 pass (100% line coverage on the new file).
- Marked `EmailResolutionService.generateWikiLink()` as `@deprecated` in `src/services/email-resolution.service.ts` with a JSDoc comment pointing to `formatWikiLink` from `src/utils/wiki-link.ts`. Method body and all callers in `ProjectService` left unchanged per scope boundary.
- `npm run validate` exit 0: lint, typecheck, 875 tests across 68 suites (up from 867/67), build — all pass. Zero regressions.

### File List

- `src/utils/wiki-link.ts` — CREATED
- `tests/utils/wiki-link.test.ts` — CREATED
- `src/services/email-resolution.service.ts` — UPDATED (added `@deprecated` JSDoc to `generateWikiLink`)

### Change Log

- 2026-05-09: Story 1.3 implemented — `formatWikiLink` utility created; `EmailResolutionService.generateWikiLink` marked deprecated
