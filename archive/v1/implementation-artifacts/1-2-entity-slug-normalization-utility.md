# Story 1.2: Entity Slug Normalization Utility

Status: done

## Story

As a developer implementing commands that accept team names or project names,
I want a standalone `normalizeSlug()` utility that converts any entity name to lowercase/kebab-case,
So that teams, projects, and any other named entities are stored consistently regardless of how the user types them.

## Acceptance Criteria

1. `src/utils/normalization.ts` exports `normalizeSlug(name: string): string` that converts `"Backend Team"` → `"backend-team"`.
2. `normalizeSlug("FRONTEND")` returns `"frontend"` (uppercase → lowercase).
3. `normalizeSlug("my-team")` returns `"my-team"` (already normalized → idempotent).
4. `normalizeSlug("Data_Science Team")` returns `"data-science-team"` (underscores + spaces → hyphens).
5. `tests/utils/normalization.test.ts` passes: VAL-UNIT-004 (`"Backend Team"` → `"backend-team"`), VAL-UNIT-005 (`"FRONTEND"` → `"frontend"`), VAL-UNIT-006 (`"my-team"` idempotent).
6. `normalizeSlug()` is called in `TeamService.createTeam()` and `TeamService.addMember()` before any file system path construction — team name is normalized at service entry point.
7. `normalizeProjectName()` in `src/services/project.service.ts` calls `normalizeSlug()` on the base name before appending the `-project` suffix, so all project path helpers automatically produce slug-safe paths.
8. All existing tests for `TeamService` and `ProjectService` continue to pass (already-normalized inputs are idempotent through `normalizeSlug`).

## Tasks / Subtasks

- [x] Create `src/utils/normalization.ts` (AC: 1–4)
  - [x] Export `normalizeSlug(name: string): string`
  - [x] Implementation: `name.toLowerCase().replace(/[\s_]+/g, '-')` — converts spaces and underscores to hyphens, lowercases everything
  - [x] Add explicit return type annotation (ESLint warn rule)
  - [x] Add `// ── Slug Normalization ──` section divider (follow `display.ts` style)

- [x] Create `tests/utils/normalization.test.ts` (AC: 5)
  - [x] VAL-UNIT-004: `normalizeSlug("Backend Team")` → `"backend-team"`
  - [x] VAL-UNIT-005: `normalizeSlug("FRONTEND")` → `"frontend"`
  - [x] VAL-UNIT-006: `normalizeSlug("my-team")` → `"my-team"` (idempotent)
  - [x] Additional coverage: `"Data_Science Team"` → `"data-science-team"`, multiple spaces, underscores, empty string

- [x] Update `src/services/team.service.ts` (AC: 6)
  - [x] Import `normalizeSlug` from `'../utils/normalization.js'`
  - [x] At the top of `createTeam(teamName, ws)`, add: `const slug = normalizeSlug(teamName);` and use `slug` in place of `teamName` in all local path helper calls
  - [x] At the top of `addMember(teamName, email, options, ws)`, add: `const slug = normalizeSlug(teamName);` and use `slug` in place of `teamName` in all local calls within the method (including the `createTeam` delegation call)
  - [x] Applied same normalization to `listTeamMembers`, `archiveMember`, `fireMember`, `_removeWikiLink`
  - [x] Preserve all existing method signatures — callers (commands) remain unchanged

- [x] Update `src/services/project.service.ts` (AC: 7)
  - [x] Import `normalizeSlug` from `'../utils/normalization.js'`
  - [x] Modified `normalizeProjectName(name: string): string` to slug-normalize the base name first
  - [x] All path helpers (`projectBaseDir`, `projectOverviewPath`, `projectStandupsDir`, `projectMeetingsDir`) automatically benefit since they call `normalizeProjectName`
  - [x] Preserve existing exported function signature

- [x] Run `npm run validate` — all four steps (lint, typecheck, test, build) must pass (AC: 8)

### Review Findings — Round 1 (patches applied)

- [x] [Review][Patch] Leading/trailing whitespace produces leading/trailing hyphens — add `.trim()` before the regex [src/utils/normalization.ts:16]
- [x] [Review][Patch] Consecutive hyphens not collapsed when input mixes literal hyphens and spaces (e.g. `"ops- team"` → `"ops--team"`) — add `.replace(/-+/g, '-')` [src/utils/normalization.ts:16]
- [x] [Review][Patch] `buildContextMd` received the slug instead of the display name — team heading permanently clobbered for human-readable names [src/services/team.service.ts:160]
- [x] [Review][Patch] Double normalization in `fireMember` — `normalizeSlug(teamName)` passed to `archiveMember` which immediately normalizes again; fixed by passing raw `teamName` [src/services/team.service.ts:342]
- [x] [Review][Defer] Path traversal characters (`/`, `..`) pass through `normalizeSlug` — pre-existing issue (raw `teamName` was used directly before this story); input sanitization is out of story 1.2 scope [src/utils/normalization.ts:16] — deferred, pre-existing
- [x] [Review][Defer] Data migration gap — pre-existing on-disk directories with unnormalized names silently return empty after normalization takes effect — by spec design; separate migration story needed before GA [src/services/team.service.ts] — deferred, by spec
- [x] [Review][Defer] `normalizeProjectName('project')` → `'project-project'` — identical behavior to old code; pre-existing edge case [src/services/project.service.ts:24] — deferred, pre-existing
- [x] [Review][Defer] Normalization site inconsistency (entry-point variable vs inline call) across methods — cosmetic; no functional impact; partially resolved by removing inline `normalizeSlug` from `fireMember` — deferred, cosmetic

## Dev Notes

### Key Behavioral Contract

`normalizeSlug(name: string): string` transforms any entity name to a URL-safe, filesystem-safe slug:
- Converts to lowercase
- Replaces one or more consecutive whitespace characters or underscores with a single hyphen
- Idempotent: already-normalized slugs pass through unchanged

**Implementation (exact)**:
```ts
export function normalizeSlug(name: string): string {
  return name.toLowerCase().replace(/[\s_]+/g, '-');
}
```

This single regex covers all AC cases:
- `"Backend Team"` → lowercase → `"backend team"` → replace space → `"backend-team"` ✓
- `"FRONTEND"` → lowercase → `"frontend"` → no spaces/underscores → `"frontend"` ✓
- `"my-team"` → lowercase → `"my-team"` → no spaces/underscores → `"my-team"` (idempotent) ✓
- `"Data_Science Team"` → lowercase → `"data_science team"` → replace `_` and ` ` → `"data-science-team"` ✓

### Scope Boundary (Story 1.2 Only)

This story creates the utility and wires it into `TeamService` and `ProjectService`. It does NOT:
- Wire into `InitService` or the onboarding prompts (Epic 2 handles this via INIT-INT-009)
- Wire into `LeadershipService` or `MemberService` (Epic 3)
- Wire into any commands directly — the service layer is the right normalization point

### `TeamService` Update Pattern

Normalize at the top of each public method that accepts `teamName`:

```ts
import { normalizeSlug } from '../utils/normalization.js';

async createTeam(teamName: string, workspaceRoot: string): Promise<void> {
  const slug = normalizeSlug(teamName);
  const contextPath = teamContextPath(workspaceRoot, slug);
  const membersPath = teamMembersPath(workspaceRoot, slug);
  if (await this._fs.exists(contextPath)) return;
  await this._fs.writeFile(contextPath, buildContextMd(slug));
  await this._fs.writeFile(membersPath, buildMembersMd());
}

async addMember(
  teamName: string,
  email: string,
  options: IAddMemberOptions,
  workspaceRoot: string,
): Promise<void> {
  const slug = normalizeSlug(teamName);
  const normalizedEmail = email.toLowerCase();
  await this.createTeam(slug, workspaceRoot);   // already normalized — createTeam normalizes again, idempotent
  // ... rest of method uses `slug` instead of `teamName`
}
```

Also normalize in:
- `listTeamMembers(teamName, ws)` — uses `teamName` in `teamMembersPath()` → normalize at top
- `archiveMember(teamName, email, options, ws)` → normalize at top
- `fireMember(teamName, email, ws, note)` → normalize at top
- `_removeWikiLink(teamName, email, ws)` → normalize at top (private method, normalize here too for safety)

### `ProjectService` Update Pattern

Change `normalizeProjectName` to slug-normalize first:

```ts
import { normalizeSlug } from '../utils/normalization.js';

export function normalizeProjectName(name: string): string {
  const slug = normalizeSlug(name);
  return slug.endsWith('-project') ? slug : `${slug}-project`;
}
```

Since all path helpers (`projectBaseDir`, `projectOverviewPath`, `projectStandupsDir`, `projectMeetingsDir`) call `normalizeProjectName`, no further changes are needed in those helpers or in the public service methods. The entire path chain is covered by this one change.

**Edge case handled**: If a user passes `"My Project-project"`, `normalizeSlug` → `"my-project-project"`, then `endsWith('-project')` is true → result is `"my-project-project"` (no double suffix). ✓

### Regression Safety

**Existing tests use already-normalized names** (`'alpha'`, `'platform'`, etc.). Since `normalizeSlug` is idempotent:
- `normalizeSlug('alpha')` → `'alpha'` (no change)
- `normalizeSlug('platform')` → `'platform'` (no change)
- All existing `TeamService` and `ProjectService` test assertions remain valid.

**Watch for** — the `addMember` method calls `this.createTeam(teamName, workspaceRoot)` internally. After the story 1.2 change, `addMember` normalizes `teamName` to `slug` first, then passes `slug` to `createTeam`. Since `createTeam` also normalizes internally (idempotent), this is safe and correct. No double-normalization issue.

### ESM Import Rules (Critical)

```ts
// Correct — .js extension required for ESM
import { normalizeSlug } from '../utils/normalization.js';

// In test files
import { normalizeSlug } from '../../src/utils/normalization.js';
```

### Test Pattern (from `tests/utils/validation.test.ts`)

```ts
import { describe, it, expect } from '@jest/globals';
import { normalizeSlug } from '../../src/utils/normalization.js';

describe('normalizeSlug', () => {
  it('VAL-UNIT-004: converts "Backend Team" to "backend-team"', () => {
    expect(normalizeSlug('Backend Team')).toBe('backend-team');
  });

  it('VAL-UNIT-005: converts "FRONTEND" to "frontend"', () => {
    expect(normalizeSlug('FRONTEND')).toBe('frontend');
  });

  it('VAL-UNIT-006: "my-team" is idempotent', () => {
    expect(normalizeSlug('my-team')).toBe('my-team');
  });

  it('converts "Data_Science Team" to "data-science-team"', () => {
    expect(normalizeSlug('Data_Science Team')).toBe('data-science-team');
  });
  // ... more edge cases
});
```

### File Structure (All Paths from Project Root)

| Action | Path |
|--------|------|
| CREATE | `src/utils/normalization.ts` |
| CREATE | `tests/utils/normalization.test.ts` |
| UPDATE | `src/services/team.service.ts` |
| UPDATE | `src/services/project.service.ts` |

### Coverage Requirement

New utility MUST reach 100% line coverage in `tests/utils/normalization.test.ts`. Target test cases:
- Valid: mixed-case-space, all-caps, already-normalized, underscore+space, trailing/leading spaces, single word

### References

- Epic 1, Story 1.2 AC: `_bmad-output/planning-artifacts/epics.md` lines 261–291
- Project-context shared utilities section: `_bmad-output/project-context.md` §Entity Slug Normalization
- ARCH-004: `normalizeTeamName()` must be used by every command/service accepting a team name
- Story 1.1 pattern (parallel utility): `_bmad-output/implementation-artifacts/1-1-email-validation-utility.md`
- ESM import rule: `_bmad-output/project-context.md` §Language-Specific Rules
- File naming conventions: `_bmad-output/project-context.md` §File & Folder Naming

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Created `src/utils/normalization.ts` with `normalizeSlug(name: string): string`. Implementation: `name.toLowerCase().replace(/[\s_]+/g, '-')`. Pure utility — no side effects, no console output. Idempotent.
- Created `tests/utils/normalization.test.ts` with 11 test cases covering VAL-UNIT-004/005/006, mixed underscores+spaces, consecutive separators, empty string, and idempotency. All pass (100% line coverage on the new file).
- Updated `TeamService.createTeam()` and `addMember()` to normalize `teamName` via `normalizeSlug()` at the top before any path construction. Also applied to `listTeamMembers()`, `archiveMember()`, `fireMember()`, and `_removeWikiLink()` for consistency.
- Updated `normalizeProjectName()` in `ProjectService` to slug-normalize the base name first via `normalizeSlug()` before appending the `-project` suffix. All downstream path helpers automatically benefit.
- All 867 tests pass across 67 suites (2 pre-existing integration test workers: watch and inbox-process — confirmed unrelated). Lint: exit 0. Typecheck: exit 0. Build: exit 0.
- Code review (Round 1): 4 patches applied — added `.trim()` + consecutive-hyphen collapse to `normalizeSlug`, preserved display name in `buildContextMd` by passing original `teamName` as second argument, removed double normalization in `fireMember`. 4 deferred, 2 dismissed. Full validate re-run: exit 0 (67 suites, 867+ tests).

### File List

- `src/utils/normalization.ts` — CREATED
- `tests/utils/normalization.test.ts` — CREATED
- `src/services/team.service.ts` — UPDATED (normalizeSlug at all team-name entry points)
- `src/services/project.service.ts` — UPDATED (normalizeSlug inside normalizeProjectName)

### Change Log

- 2026-04-27: Story 1.2 implemented — normalizeSlug utility created and wired into TeamService and ProjectService
