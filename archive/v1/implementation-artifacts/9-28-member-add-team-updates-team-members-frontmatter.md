---
baseline_commit: 4d18b17
---

# Story 9.28: `tmr member add <email> --team` Updates Team Members Frontmatter

Status: done

## Story

As a user adding a team member via `member add`,
I want the team's `<team>-members.md` updated automatically with a frontmatter `members:` array,
So that the team page shows the member without needing a second command and the Obsidian graph resolves team edges.

## Acceptance Criteria

**AC1 — MemberService bug fix (B1):** When `tmr member add <email> --team <team>` runs, the team's `<team>-members.md` frontmatter `members:` array is appended with the member's wiki-link using `addRelation`.

**AC2 — TeamService frontmatter write:** `tmr team add <team> <email>` also writes the wiki-link to `members:` frontmatter (replaces the existing `appendFile` body-link approach).

**AC3 — Team members file scaffold:** New team-members files created by `createTeam` include frontmatter `members: []` (the `buildMembersMd()` function updated).

**AC4 — Idempotent:** Running either command twice for the same email leaves the `members:` array with exactly one entry (idempotency guaranteed by `addRelation`).

**AC5 — No team provided:** When `tmr member add <email>` is run without `--team`, no team-members file is touched.

**AC6 — Team file absent:** When the team-members file does not exist (e.g. the team was not yet created), `MemberService.addMember` skips the frontmatter update silently without error.

**AC7 — Remove uses frontmatter:** `tmr team archive/fire` removes the member from `members:` frontmatter array (not body string manipulation) via `removeRelation`.

**AC8 — listTeams reads frontmatter:** `tmr team list` member count reads from frontmatter `members:` array length, not body regex.

**AC9 — listTeamMembers reads frontmatter:** `tmr team list <team>` reads emails from frontmatter `members:` array entries, not body regex.

## Tasks / Subtasks

- [x] Task 1 — Update `buildMembersMd()` in `team.service.ts` (AC: 3)
  - [x] Change from `'# Team Members\n'` to YAML frontmatter + heading (see Dev Notes for exact output)

- [x] Task 2 — Update `TeamService.addMember` wiki-link append (AC: 2, 4)
  - [x] Import `addRelation` and `removeRelation` from `'../utils/frontmatter-relations.js'`
  - [x] Replace `appendFile` body-append + duplicate-check with single `addRelation(membersPath, 'members', link, this._fs)` call
  - [x] The link passed to `addRelation` must NOT have the `- ` prefix (just `[[path|email]]`)

- [x] Task 3 — Update `TeamService._removeWikiLink` (AC: 7)
  - [x] Replace inline `content.split/filter/join` approach with `removeRelation(membersPath, 'members', wikiLink, this._fs)`
  - [x] Compute the same `[[path|email]]` format as in Task 2

- [x] Task 4 — Update `TeamService.listTeams` (AC: 8)
  - [x] Read `members:` from frontmatter via `matter(content).data` instead of body regex `content.match(/^\s*-\s+\[\[/gm)`
  - [x] memberCount = `members.length` where members is the frontmatter array (empty array → 0)

- [x] Task 5 — Update `TeamService.listTeamMembers` (AC: 9)
  - [x] Parse frontmatter `members:` array from `matter(content).data`
  - [x] Extract email from each wiki-link string with regex `/\[\[.*?\|([^\]]+)\]\]/`
  - [x] Replace body-parsing regex approach

- [x] Task 6 — Update `MemberService.addMember` to fix bug B1 (AC: 1, 4, 5, 6)
  - [x] Import `addRelation` from `'../utils/frontmatter-relations.js'`
  - [x] Import `normalizeSlug` from `'../utils/normalization.js'`
  - [x] After `writeFile(profilePath, profileMd)`, when `opts.team` is truthy:
    - Compute `teamMembersFilePath` from `workspaceRoot/my-teams/teams/<slug>/<slug>-members.md`
    - Check `this._fs.exists(teamMembersFilePath)` — only proceed if file exists (AC6)
    - Call `addRelation(teamMembersFilePath, 'members', link, this._fs)` with proper wiki-link

- [x] Task 7 — Update tests in `tests/services/member.service.test.ts` (AC: 1, 4, 5, 6)
  - [x] Add test: team scope → team-members frontmatter updated when file exists
  - [x] Add test: team scope → no team-members update when file does not exist (AC6)
  - [x] Add test: no-team scope → no team-members file touched (AC5)
  - [x] Idempotency is verified by `addRelation` logic (see existing utility tests)

- [x] Task 8 — Update tests in `tests/services/team.service.test.ts` (AC: 2, 7, 8, 9)
  - [x] Fix tests that assert `appendFile` on the members file → must now assert `writeFile` with frontmatter
  - [x] Fix mock for `readFile` on members file to return frontmatter content (not body)
  - [x] Fix `listTeams` tests to use frontmatter `members:` array
  - [x] Fix `listTeamMembers` tests to use frontmatter array
  - [x] Fix `archiveMember` / `fireMember` tests to use `removeRelation` approach (no more body string filter)

- [x] Task 9 — Validate (all ACs)
  - [x] Run `npm run typecheck` — zero new type errors
  - [x] Run `npm run lint` — zero new lint errors
  - [x] Run `npm run test` — all tests pass (updated team and member service tests)

## Dev Notes

### Exact Change: `buildMembersMd()` in `team.service.ts`

```typescript
// BEFORE
function buildMembersMd(): string {
  return '# Team Members\n';
}

// AFTER
function buildMembersMd(): string {
  return `---\nmembers: []\n---\n\n# Team Members\n`;
}
```

`matter.stringify` is NOT used here — the string is hardcoded for simplicity. `gray-matter` serializes `[]` as `members: []\n` which is what we want.

### Exact Change: `TeamService.addMember` — replace `appendFile` with `addRelation`

The current code (lines 241–248 of `team.service.ts`):

```typescript
// CURRENT (body-append pattern)
const membersPath = teamMembersPath(workspaceRoot, slug);
const wikiLink = buildWikiLink(normalizedEmail, workspaceRoot, slug);
const currentMembers = await this._fs.readFile(membersPath);
if (!currentMembers.includes(wikiLink)) {
  await this._fs.appendFile(membersPath, `${wikiLink}\n`);
}
```

Change to:

```typescript
// AFTER (frontmatter addRelation)
const membersPath = teamMembersPath(workspaceRoot, slug);
const link = formatWikiLink(memberProfilePath(workspaceRoot, normalizedEmail), membersPath, normalizedEmail);
await addRelation(membersPath, 'members', link, this._fs);
```

Key difference: `buildWikiLink` added `- ` prefix (body-list format). `addRelation` stores raw `[[path|email]]` in a YAML array. Do NOT pass `- [[...]]` to `addRelation`.

`buildWikiLink` private helper can remain unchanged — it is used by `_removeWikiLink` (which will also be replaced). After this story it will be dead code; leave it in place to avoid noise (remove in 9.29 or future cleanup).

### Exact Change: `TeamService._removeWikiLink`

```typescript
// BEFORE
private async _removeWikiLink(teamName: string, email: string, workspaceRoot: string): Promise<void> {
  const membersPath = teamMembersPath(workspaceRoot, normalizeSlug(teamName));
  if (!(await this._fs.exists(membersPath))) return;
  const content = await this._fs.readFile(membersPath);
  const wikiLink = buildWikiLink(email, workspaceRoot, normalizeSlug(teamName));
  const updated = content.split('\n').filter((line) => line.trim() !== wikiLink.trim()).join('\n');
  await this._fs.writeFile(membersPath, updated);
}

// AFTER
private async _removeWikiLink(teamName: string, email: string, workspaceRoot: string): Promise<void> {
  const slug = normalizeSlug(teamName);
  const membersPath = teamMembersPath(workspaceRoot, slug);
  if (!(await this._fs.exists(membersPath))) return;
  const link = formatWikiLink(memberProfilePath(workspaceRoot, email), membersPath, email);
  await removeRelation(membersPath, 'members', link, this._fs);
}
```

`removeRelation` is a no-op on missing key and silently handles the case where the link is not in the array — no extra guard needed.

### Exact Change: `TeamService.listTeams`

```typescript
// BEFORE
let memberCount = 0;
if (await this._fs.exists(membersPath)) {
  const content = await this._fs.readFile(membersPath);
  memberCount = (content.match(/^\s*-\s+\[\[/gm) ?? []).length;
}

// AFTER
let memberCount = 0;
if (await this._fs.exists(membersPath)) {
  const content = await this._fs.readFile(membersPath);
  const { data } = matter(content);
  const members = Array.isArray(data['members']) ? (data['members'] as string[]) : [];
  memberCount = members.length;
}
```

`matter` is already imported at the top of `team.service.ts`.

### Exact Change: `TeamService.listTeamMembers`

```typescript
// BEFORE
const emailMatches = [...content.matchAll(/\[\[.*?\|([^\]]+)\]\]/g)];
const emails = emailMatches.map((m) => m[1] as string);

// AFTER
const { data } = matter(content);
const members = Array.isArray(data['members']) ? (data['members'] as string[]) : [];
const emails = members
  .map((link) => {
    const match = /\[\[.*?\|([^\]]+)\]\]/.exec(link);
    return match?.[1] ?? null;
  })
  .filter((e): e is string => e !== null);
```

Note: the full `listTeamMembers` method must parse frontmatter BEFORE the `for` loop over emails.

### Exact Change: `MemberService.addMember` — add team-members update (bug B1 fix)

Add to **existing imports** in `member.service.ts`:

```typescript
import { addRelation } from '../utils/frontmatter-relations.js';
import { normalizeSlug } from '../utils/normalization.js';
```

After the `await this._fs.writeFile(profilePath, profileMd);` line in `addMember`, add:

```typescript
if (opts.team) {
  const slug = normalizeSlug(opts.team);
  const teamMembersFilePath = path.join(
    workspaceRoot,
    'my-teams',
    'teams',
    slug,
    `${slug}-members.md`,
  );
  if (await this._fs.exists(teamMembersFilePath)) {
    const link = formatWikiLink(profilePath, teamMembersFilePath, normalizedEmail);
    await addRelation(teamMembersFilePath, 'members', link, this._fs);
  }
}
```

`formatWikiLink` is already imported in `member.service.ts`. The `if (await this._fs.exists(...))` guard is required for AC6 — if the team does not exist, skip silently.

### Required Imports in `team.service.ts`

Add to the imports section:

```typescript
import { addRelation, removeRelation } from '../utils/frontmatter-relations.js';
```

`formatWikiLink` is already imported. `matter` and `normalizeSlug` are already imported.

### Hard Cutover — Migration Impact

After this story, **read paths in `listTeams` and `listTeamMembers` read from frontmatter ONLY** (no legacy body fallback — confirmed decision from sprint change proposal Section 2).

This means:
- Existing `<team>-members.md` files that don't have a `members:` frontmatter array will show `0` member count and empty member list.
- Users must run `tmr doctor --fix-frontmatter` (Story 9.36) to migrate body-link files.
- **Do NOT add a legacy body fallback** — hard cutover is the spec.

For tests, mock the members file content as frontmatter format:

```typescript
// Correct mock format for post-9.28 members file:
mockFS.readFile.mockResolvedValue('---\nmembers:\n  - \'[[../../members/john@co.com/john@co.com.md|john@co.com]]\'\n---\n\n# Team Members\n');
```

### Test Strategy for `team.service.test.ts` — What Breaks

The following existing tests will fail after the code changes and **must be updated**:

1. **`'creates full directory structure and profile for a new member'`** (line 108):
   - Currently asserts `expect(mockFS.appendFile).toHaveBeenCalledWith(...)` on `alpha-members.md`
   - After fix: assert `expect(mockFS.writeFile).toHaveBeenCalledWith(expect.stringContaining('alpha-members.md'), expect.stringContaining('john@co.com'))` instead
   - Also fix `mockFS.readFile` mock to return frontmatter content for the members file

2. **`'does not duplicate wiki-link when member already in members file'`** (line 169):
   - Currently checks `expect(mockFS.appendFile).not.toHaveBeenCalled()`
   - After fix: `addRelation` is idempotent by design — the `if (!existing.includes(wikiLink))` guard in `addRelation` handles dedup. Test should verify `writeFile` on the members file contains the link exactly once.

3. **`'appends correct relative wiki-link format to members file (AC-5)'`** (line 221):
   - Currently asserts `appendFile` with `'- [[../../members/dev@co.com/dev@co.com.md|dev@co.com]]\n'`
   - After fix: assert `writeFile` on the members file contains `[[../../members/dev@co.com/dev@co.com.md|dev@co.com]]` (no `- ` prefix, stored in YAML array)

4. **`listTeams` tests** — if any read body regex; update to return frontmatter content in mock.

5. **`listTeamMembers` tests** — update mock to return frontmatter format; re-verify email extraction.

6. **`archiveMember` / `fireMember` tests** — `_removeWikiLink` no longer calls `writeFile` with a string-filtered body; it calls `removeRelation`. Update assertions accordingly.

### Test Strategy for `member.service.test.ts` — New Tests Needed

Add the following tests in the `addMember` describe block:

```typescript
it('MEM-UNIT-017: team scope — adds member to team-members frontmatter when file exists', async () => {
  const teamMembersPath = `${WS}/my-teams/teams/backend/backend-members.md`;
  const teamMembersContent = '---\nmembers: []\n---\n\n# Team Members\n';

  mockFS.exists
    .mockResolvedValueOnce(false)       // profile does not yet exist
    .mockResolvedValueOnce(false)       // careerRoot does not exist
    .mockResolvedValueOnce(true);       // team-members file exists

  mockFS.readFile.mockResolvedValueOnce(teamMembersContent);

  await svc.addMember('jane@co.com', { team: 'backend' }, WS);

  expect(mockFS.writeFile).toHaveBeenCalledWith(
    teamMembersPath,
    expect.stringContaining('jane@co.com'),
  );
});

it('MEM-UNIT-018: team scope — skips team-members update when file does not exist', async () => {
  mockFS.exists.mockResolvedValue(false); // all exists return false

  await svc.addMember('jane@co.com', { team: 'backend' }, WS);

  const calls = mockFS.writeFile.mock.calls as [string, string][];
  expect(calls.some(([p]) => p.includes('-members.md'))).toBe(false);
});

it('MEM-UNIT-019: no-team scope — no team-members file is touched', async () => {
  mockFS.exists.mockResolvedValue(false);

  await svc.addMember('jane@co.com', {}, WS);

  const calls = mockFS.writeFile.mock.calls as [string, string][];
  expect(calls.some(([p]) => p.includes('-members.md'))).toBe(false);
});
```

Note: For MEM-UNIT-017, the `exists` call sequence is:
1. `profilePath` → false (profile doesn't exist → proceeds to create)
2. `careerRoot` → false (in `_resolveManagerLink`)
3. `teamMembersFilePath` → true (file exists → update frontmatter)

The `readFile` mock must return the team-members content at call index 0 (only one `readFile` call before the addRelation write).

### Scope Boundary — What This Story Does NOT Change

Do NOT touch these areas (they belong to later Wave 2 stories):

- **`buildMemberProfileMd`** template in `team.service.ts` — still has empty `## Current Manager`, `## Previous Managers`, etc. and `action_items_gdoc` field. Story 9.29 scope.
- **`getManagerEmail`** in `team.service.ts` — still uses `listDirectories` (old nested path). Pre-existing Story 9.3 deferred item (D1). Do NOT fix here.
- **`MemberService.addMember` frontmatter fields** — only fix the team-members update; do NOT change the profile's own frontmatter fields (that's 9.29 scope).
- **`ITeamMemberFrontmatter` type** in `team.types.ts` — may need `members?: string[]` added if TypeScript complains, but do not restructure the types file.
- **Body-link reading on entity profiles** — `listTeamMembers` reads emails from the `members` array in `<team>-members.md` (not from each member's profile). This is correct.

### Pre-existing Deferred Items to Be Aware Of (Do Not Fix)

From `_bmad-output/implementation-artifacts/deferred-work.md`:

- **D1 from 9-3 (High):** `TeamService.getManagerEmail()` uses `listDirectories()` which returns empty on flat `my-career/` after Story 9.3. New team members added via `TeamService.addMember` will get `manager: ''` (empty). This is pre-existing — do NOT fix in 9.28.
- **D2 from 9-3:** `_resolveManagerLink` in member.service.ts picks up any `.md` file in `my-career/` including performance-review files. Pre-existing — do NOT fix.
- **Team service tests that use old nested `my-career/<email>/<email>.md` path** — some tests mock `listDirectories` for manager email resolution. Leave these as-is; they exercise pre-existing behavior.

### `addRelation` Reference (from Story 9.26)

`src/utils/frontmatter-relations.ts` — already exists, done, do not modify:

```typescript
export async function addRelation(
  filePath: string,
  key: RelationKey,     // 'members' is a valid RelationKey
  wikiLink: string,     // just [[path|email]], no '- ' prefix
  fs: FileSystemService,
): Promise<void>
```

- Throws if `filePath` does not exist (so always guard with `exists()` check first, or use try/catch for graceful degradation)
- **Idempotent**: if `wikiLink` already in array, array is unchanged
- `'members'` is in the `RelationKey` union (see `frontmatter-relations.ts` line 14)

```typescript
export async function removeRelation(
  filePath: string,
  key: RelationKey,
  wikiLink: string,
  fs: FileSystemService,
): Promise<void>
```

- Silent no-op if file is missing
- Filters out the wikiLink; leaves key as `[]` if no entries remain

### `formatWikiLink` Reference

```typescript
formatWikiLink(resolvedPath, fromPath, displayName): string
// → [[relative/path/to/file.md|displayName]]
```

For MemberService.addMember, the relative path is computed FROM `teamMembersFilePath` TO `profilePath`:

```typescript
const link = formatWikiLink(profilePath, teamMembersFilePath, normalizedEmail);
// profilePath = /ws/my-teams/members/jane@co.com/jane@co.com.md
// teamMembersFilePath = /ws/my-teams/teams/backend/backend-members.md
// → [[../../members/jane@co.com/jane@co.com.md|jane@co.com]]
```

For TeamService.addMember, `formatWikiLink` is called the same way as before:

```typescript
const link = formatWikiLink(memberProfilePath(workspaceRoot, normalizedEmail), membersPath, normalizedEmail);
```

### ESM Import Rules

All imports use `.js` extension on `.ts` source files:

```typescript
import { addRelation, removeRelation } from '../utils/frontmatter-relations.js';
import { normalizeSlug } from '../utils/normalization.js';
```

### Files to Modify

| File | Change |
|------|--------|
| `src/services/team.service.ts` | Update `buildMembersMd`, `addMember`, `_removeWikiLink`, `listTeams`, `listTeamMembers`; add imports |
| `src/services/member.service.ts` | Add team-members frontmatter update to `addMember`; add imports |
| `tests/services/team.service.test.ts` | Fix broken `appendFile` assertions → `writeFile` with frontmatter; fix mock content format; fix `listTeams`/`listTeamMembers`/`archive` tests |
| `tests/services/member.service.test.ts` | Add 3 new tests (MEM-UNIT-017, 018, 019) |

### Architecture Compliance

- **Layer:** Service → utility (`addRelation`) — correct layer
- **No direct `matter.stringify`** for relationship changes — all writes go through `addRelation`/`removeRelation` per the project-context.md Anti-Pattern rule
- **No `appendFile`** for structural wiki-links on entity/team profiles — replaced with `addRelation`
- **`SectionParserService.appendToFile`** stays correct for dated artifact body lists (`## 1on1s`, etc.) — not changed here

### References

- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-06-09-frontmatter-relationships.md` § Story 9.28 — Change proposals and ACs]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-06-09-frontmatter-relationships.md` § Section 3.5 — Schema #8 (team members file)]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-06-09-frontmatter-relationships.md` § Cross-Cutting Reciprocity Map]
- [Source: `src/utils/frontmatter-relations.ts` — `addRelation`, `removeRelation`, `RelationKey`]
- [Source: `_bmad-output/project-context.md` § Frontmatter-Native Relationship Model — anti-pattern rule]
- [Source: `_bmad-output/implementation-artifacts/9-26-frontmatter-relations-shared-utility.md` — utility API reference]
- [Source: `src/services/team.service.ts` — current implementation (all methods analyzed above)]
- [Source: `src/services/member.service.ts` — current addMember (B1 bug location)]
- [Source: `tests/services/team.service.test.ts` — tests that break and must be updated]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — D1 from 9-3 (do not fix getManagerEmail here)]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-5 (Cursor)

### Debug Log References

- Removed `buildWikiLink` dead-code function to satisfy ESLint `no-unused-vars: error` rule (story notes said leave it, but lint error takes precedence per project-context.md).
- `'does not duplicate wiki-link'` test assertion changed from regex `match(/john@co\.com/g).length` (counted 3 due to multiple occurrences in YAML) to `matter(content).data.members` length check.
- Windows path separator: 18 pre-existing test suite failures (forward-slash test assertions vs `path.join` backslash output on Windows). Not caused by this story; CI runs on Linux where all pass.

### Completion Notes List

- **Task 1 (AC3):** `buildMembersMd()` now returns `'---\nmembers: []\n---\n\n# Team Members\n'`.
- **Task 2 (AC2, AC4):** `TeamService.addMember` replaces `appendFile` body-append + duplicate-check with `addRelation(membersPath, 'members', link, this._fs)`. Dead-code helper `buildWikiLink` removed (ESLint enforcement).
- **Task 3 (AC7):** `_removeWikiLink` now uses `removeRelation` with frontmatter; explicit `exists` guard retained.
- **Task 4 (AC8):** `listTeams` reads `members.length` from `matter(content).data` frontmatter; body regex removed.
- **Task 5 (AC9):** `listTeamMembers` parses `members:` YAML array and extracts emails via `/\[\[.*?\|([^\]]+)\]\]/` regex.
- **Task 6 (AC1, AC4, AC5, AC6):** `MemberService.addMember` after `writeFile(profilePath)` checks `exists(teamMembersFilePath)` and calls `addRelation` when `opts.team` is set. Guard satisfies AC6 (skip silently when team file absent).
- **Task 7 (AC1, AC4, AC5, AC6):** Added MEM-UNIT-017, MEM-UNIT-018, MEM-UNIT-019 to `member.service.test.ts`.
- **Task 8:** Updated all `team.service.test.ts` `addMember` mocks to return frontmatter content for members file; updated `appendFile` assertions to `writeFile`; fixed `listTeamMembers` mock format; updated idempotency assertion to use `matter` parsing.
- **Task 9:** `npm run typecheck` ✅, `npm run lint` ✅, all new/updated tests pass (pre-existing Windows path-separator failures unaffected).
- **Code review patches (2026-06-10):** `_syncTeamMembersFrontmatter` helper syncs team-members on existing profiles when `--team` is set; archive/fire/listTeams/createTeam test gaps closed; MEM-UNIT-020/021 added.

### File List

- `src/services/team.service.ts` — `buildMembersMd`, `addMember`, `_removeWikiLink`, `listTeams`, `listTeamMembers`; added `addRelation`/`removeRelation` imports; removed dead-code `buildWikiLink`
- `src/services/member.service.ts` — `addMember` team-members frontmatter update via `_syncTeamMembersFrontmatter` (runs for new and existing profiles); added `addRelation` and `normalizeSlug` imports
- `tests/services/team.service.test.ts` — Updated `addMember` test mocks (frontmatter format); fixed `listTeamMembers` mock; updated assertions from `appendFile` to `writeFile`; fixed idempotency assertion; added AC8 listTeams test; updated archive/fire tests for `removeRelation`
- `tests/services/member.service.test.ts` — Added MEM-UNIT-017, MEM-UNIT-018, MEM-UNIT-019, MEM-UNIT-020, MEM-UNIT-021

### Change Log

- Story 9.28 implementation: `member add --team` + `team add` now update `members:` frontmatter array instead of body wiki-link list; `listTeams`/`listTeamMembers` read from frontmatter (hard cutover); `team archive/fire` removes via `removeRelation`; new team-members scaffold includes `members: []` frontmatter. (Date: 2026-06-10)
- Code review: `_syncTeamMembersFrontmatter` syncs team-members on re-run when profile exists; test coverage gaps for archive/fire/listTeams/idempotency closed. (Date: 2026-06-10)

### Review Findings

- [x] [Review][Patch] `member add --team` must sync team-members even when profile already exists [`src/services/member.service.ts`:115-157] — **Fixed:** extracted `_syncTeamMembersFrontmatter`; runs on both new and existing profile paths.

- [x] [Review][Patch] `archiveMember` / `fireMember` tests not updated for frontmatter [`tests/services/team.service.test.ts`:490-592] — **Fixed:** frontmatter mocks, cross-platform path checks, `removeRelation` assertions.

- [x] [Review][Patch] `listTeams` frontmatter member count untested [`tests/services/team.service.test.ts`:443] — **Fixed:** AC8 test with two-member frontmatter mock.

- [x] [Review][Patch] `createTeam` test omits `members: []` assertion [`tests/services/team.service.test.ts`:64-67] — **Fixed:** asserts `members: []` in scaffold output.

- [x] [Review][Patch] MemberService team-members idempotency integration test missing [`tests/services/member.service.test.ts`:530] — **Fixed:** added MEM-UNIT-020 and MEM-UNIT-021.

- [x] [Review][Defer] Concurrent read-modify-write on team-members file can lose updates [`src/utils/frontmatter-relations.ts`:53-74] — deferred, pre-existing; no file-lock pattern in codebase; single-user CLI assumption (see 9-26 deferred work).

- [x] [Review][Defer] `createTeam` early-return skips members file recreation when context exists but members file deleted [`src/services/team.service.ts`:166-170] — deferred, pre-existing; `addRelation` throws if members file missing; repair belongs in doctor/migration scope.

- [x] [Review][Defer] Corrupt YAML in team-members file throws uncaught `matter()` parse error [`src/services/team.service.ts`:257-274] — deferred, pre-existing; acceptable for v1 per 9-26 deferred work; Story 9.36 doctor may add validation.

- [x] [Review][Defer] Duplicated team-members file path construction in MemberService vs TeamService [`src/services/member.service.ts`:147-153] — deferred, pre-existing pattern; story spec explicitly inlined path; centralize in a future refactor.

- [x] [Review][Defer] MemberService has no symmetric `removeRelation` when member profile is deleted [`src/services/member.service.ts`] — deferred, pre-existing; lifecycle cleanup is Story 9.34 scope, not 9.28.
