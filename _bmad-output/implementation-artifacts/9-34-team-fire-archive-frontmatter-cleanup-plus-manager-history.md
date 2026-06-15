---
baseline_commit: 98756f9
---

# Story 9.34: `tmr team fire/archive` — frontmatter cleanup (mark-only) + manager history

Status: done

## Story

As a vault owner archiving a team member,
I want the archived profile's frontmatter to clearly show archival state and move the manager into history,
so that queries can distinguish active vs archived AND the historical reporting line is preserved without polluting `current_manager`.

## Context & Rationale

This story is part of the **frontmatter-native relationship** migration wave (sprint change proposal 2026-06-09).

**Bug B6 (fixed here):** `TeamService.archiveMember()` currently:
- Sets `archived: true` and `archived_date` on the archived profile
- Removes the member from `<team>-members.md` (already uses `removeRelation` — correct)
- But **leaves `teams: []` unpopulated** (B6 — archived member still appears to be on a team in graph queries)
- Does **not** move `current_manager` into `previous_manager[]` (historical reporting line is lost)
- Does **not** remove the member from the self-profile's `direct_reports:` array (stale back-edge)

**Decision #4 (mark-only):** The archive operation does NOT walk the rest of the vault to remove every back-link. Only the three directly managed back-edges are cleaned:
1. Team-members file (`<team>-members.md`) — already done via `removeRelation`
2. Self-profile `direct_reports:` — new in this story
3. Profile's own `teams:` and `current_manager` fields — new in this story

Other references (project `members:` arrays, leader's `direct_reports` if matrix-reporting, etc.) are left intact — Obsidian shows them as stale visually, preserving history.

## Acceptance Criteria

**AC1 — `archived` + `archived_date` via frontmatter fields:** After `tmr team archive <team> <email>`, the archived profile has `archived: true` and `archived_date: <YYYY-MM-DD>` in frontmatter. These already work today — must not regress.

**AC2 — `teams: []` cleared on archive:** The archived profile's `teams:` frontmatter array is **set to `[]`** (empty). The member is no longer on any active team. (Fixes B6.)

**AC3 — `current_manager` → `previous_manager[]` on archive:** If the profile had a non-empty `current_manager` value, that value is **appended** to `previous_manager[]` (deduplicated). `current_manager` is then **cleared to `""`**. If `current_manager` was already empty, `previous_manager[]` is left unchanged and `current_manager` remains `""`.

**AC4 — Self-profile `direct_reports` reciprocal cleanup on archive:** If a self-profile exists (`my-career/<email>.md`), the archived member's wiki-link is **removed** from the self-profile's `direct_reports:` frontmatter array via `removeRelation`. If no self-profile exists, this step is silently skipped.

**AC5 — `fire` inherits all archive cleanup:** `tmr team fire <team> <email>` calls `archiveMember` internally and then adds `termination: true`, `termination_date`, and optional `termination_note`. Therefore all AC1–AC4 apply to `fire` with no additional implementation required beyond what `archiveMember` now does.

**AC6 — Mark-only; no vault-wide cleanup:** After archive/fire, all other back-references in the vault (project `members:`, leader's `direct_reports`, etc.) are left intact. Only the three managed back-edges described in AC1–AC4 are cleaned.

**AC7 — Validation:** `npm run typecheck`, `npm run lint`, and `npm run test` all pass — zero new type/lint errors. Existing archiveMember/fireMember unit tests continue to pass (they must be updated where needed to provide profiles with the new frontmatter fields).

## Tasks / Subtasks

- [x] **Task 1 — `archiveMember`: batch the new frontmatter transformations into the existing profile read-write** (AC: 1–4)
  - [x] Compute `originalMemberPath = memberProfilePath(workspaceRoot, normalizedEmail)` and `selfPath = await this._getSelfProfilePath(workspaceRoot)` **BEFORE** moving the member directory (after the move the original path no longer exists on disk)
  - [x] Keep the existing `hasDateFilter` partial-archive and full-archive move logic unchanged
  - [x] In the existing `if (await this._fs.exists(archivedProfile))` block, extend the single read-parse-write to also apply (on top of existing `archived`/`archived_date`):
    - Set `fm['teams'] = []` (clear team membership — fixes B6)
    - Read `currentManager = fm['current_manager']` (may be `undefined`, `""`, or a wiki-link string)
    - If `currentManager` is a non-empty string: append to `fm['previous_manager']` array (dedup), then set `fm['current_manager'] = ''`
    - If `currentManager` is empty/undefined: ensure `fm['current_manager'] = ''` is written (normalizes to empty string)
  - [x] After `_removeWikiLink`, add reciprocal self-profile cleanup:
    - If `selfPath` is non-null: `const selfLink = formatWikiLink(originalMemberPath, selfPath, normalizedEmail)`; `await removeRelation(selfPath, 'direct_reports', selfLink, this._fs)`
  - [x] Do NOT change `_removeWikiLink` — it already uses `removeRelation` correctly
  - [x] Do NOT change `fireMember` beyond what it already does (it calls `archiveMember` and then adds termination fields)

- [x] **Task 2 — Update `tests/services/team.service.test.ts`** (AC: 7)
  - [x] Update `buildProfileMd` helper to include `current_manager`, `previous_manager`, and a realistic `teams` array so new assertions can verify the transformations:
    ```typescript
    function buildProfileMd(email: string, teams: string[], managerLink = ''): string {
      return matter.stringify('\n## 1on1s\n\n## Notes\n', {
        email,
        role: 'Engineer',
        location: 'Remote',
        relationship: 'direct-report',
        date_added: '2026-01-01',
        teams,
        current_manager: managerLink,
        previous_manager: [],
        other_leaderships: [],
        projects: [],
      });
    }
    ```
  - [x] In `describe('archiveMember')`, add new test cases:
    - `'9.34: sets teams: [] on archived profile (B6 fix)'` — verify archived profile write has `data['teams']` equal to `[]`
    - `'9.34: moves current_manager to previous_manager[] and clears current_manager'` — use `buildProfileMd` with a manager link, verify archived profile write has `data['previous_manager']` containing the original manager link and `data['current_manager'] === ''`
    - `'9.34: skips previous_manager append when current_manager is empty'` — use `buildProfileMd` with `managerLink = ''`, verify `data['previous_manager']` is still `[]`
    - `'9.34: removes member from self direct_reports when self profile exists'` — mock `listFiles(careerRoot)` → `[selfProfilePath]`, mock `readFile(selfPath)` → profile with `direct_reports: ['[[...]]'`, verify `removeRelation` call on selfPath (i.e., the write to `selfPath` does not contain the member link)
    - `'9.34: skips direct_reports cleanup when self profile does not exist'` — `listFiles(careerRoot)` returns `[]`, verify no extra write calls beyond the profile and team-members file
  - [x] Update existing `'moves member directory and updates frontmatter'` archiveMember test to provide `buildProfileMd` with a manager link, so it doesn't break when the new code tries to read `current_manager`
  - [x] Update existing `fireMember` tests to use the updated `buildProfileMd` signature for consistency

- [x] **Task 3 — Validate** (AC: 7)
  - [x] `npx tsc --noEmit` — zero type errors
  - [x] `npx eslint src/services/team.service.ts` — zero lint errors
  - [x] `NODE_OPTIONS=--experimental-vm-modules npx jest --testPathPattern="team" --no-coverage` — all pass
  - [x] `NODE_OPTIONS=--experimental-vm-modules npx jest --no-coverage` — full suite green

### Review Findings

_Code review 2026-06-13 (Blind Hunter + Edge Case Hunter + Acceptance Auditor). All 7 ACs verified implemented; 42/42 team.service tests pass._

- [x] [Review][Decision→Patch] Partial archive (`--from/--to`) tears down team-roster + manager `direct_reports` and skips archive markers — RESOLVED: gated BOTH `_removeWikiLink` and the new self-`direct_reports` cleanup behind `!hasDateFilter` so a date-range partial archive keeps the member active and attached. [src/services/team.service.ts:363-374]

- [x] [Review][Patch] `previous_manager` history dropped when stored as a scalar string — FIXED: coerce a scalar string into `[existing]` before append so prior history is never lost. [src/services/team.service.ts:351-360]
- [x] [Review][Patch] AC5 test fidelity: added `fireMember` test with a stateful archived-profile mock asserting the fired profile retains `teams:[]` / `previous_manager` / `current_manager:''` plus `termination`. [tests/services/team.service.test.ts]
- [x] [Review][Patch] AC3 coverage gap: added double-archive dedup test (`previous_manager` already contains the manager → no duplicate) and a partial-archive non-detachment test. [tests/services/team.service.test.ts]

- [x] [Review][Defer] `_getSelfProfilePath` returns `mdFiles[0]` — wrong file when `my-career/` has >1 `.md` [src/services/team.service.ts:493-498] — deferred, pre-existing
- [x] [Review][Defer] Full archive throws when `destDir` already exists (partial-then-full archive) [src/services/team.service.ts:333] — deferred, pre-existing
- [x] [Review][Defer] Archive markers (and `fireMember` termination fields) silently skipped when `${email}.md` absent from `srcDir` [src/services/team.service.ts:337-338] — deferred, pre-existing
- [x] [Review][Defer] No rollback/atomicity across move → frontmatter write → relation cleanup sequence [src/services/team.service.ts:333-371] — deferred, pre-existing
- [x] [Review][Defer] `removeRelation` injects a spurious empty `direct_reports: []` into self profile when key was absent [src/utils/frontmatter-relations.ts:93-95] — deferred, pre-existing

_Dismissed as noise (5): `current_manager` non-string drop (type is `string`); selfLink/addMember label mismatch (verified exact match — both use `normalizedEmail` + `originalMemberPath`); self-archive moved-path (self profile lives in `my-career/`, member in `my-teams/members/` — different dirs); `previous_manager` non-string elements (type is `string[]`); `Record<string, unknown>` typing loss (intentional per D-9.34-2)._

## Dev Notes

### Decision Log (read first)

- **D-9.34-1 — Batch all frontmatter writes in a single read-parse-write.** The current code reads the archived profile once and writes it once. Rather than doing 3-4 individual `setScalar` calls (each triggering its own read-parse-write cycle), extend the EXISTING single read-parse-write to include the new fields. This avoids extra I/O and is consistent with the existing implementation pattern.

- **D-9.34-2 — Cast to `Record<string, unknown>` for the batch write, not `ITeamMemberFrontmatter`.** The current code casts `fm` to `ITeamMemberFrontmatter`. However, `ITeamMemberFrontmatter.teams` is `string[]` (non-optional) and `previous_manager` is `string[] | undefined`. Setting `fm['teams'] = []` and mutating `fm['previous_manager']` is safer through `Record<string, unknown>` to avoid TypeScript complaints when the existing profile is missing optional fields. Change the cast to `Record<string, unknown>` in the `archiveMember` profile-update block only.

- **D-9.34-3 — Compute `originalMemberPath` and `selfPath` BEFORE the move.** After `this._fs.moveFile(srcDir, destDir)`, the original member directory no longer exists on disk. The wiki-link for `removeRelation` on the self-profile must be computed from the **original** path (`memberProfilePath(workspaceRoot, normalizedEmail)`) because that is what was stored in `direct_reports:` when `addMember` ran. If computed after the move, `formatWikiLink` would use the archived path, generating a different (wrong) string that wouldn't match the stored link.

- **D-9.34-4 — `_removeWikiLink` already correct.** `_removeWikiLink` (lines 471-481 of team.service.ts) uses `removeRelation(membersPath, 'members', link, this._fs)`. No change needed. The link it generates uses `memberProfilePath(workspaceRoot, email)` (original path), which is correct because the team-members file stored the link with the original path.

- **D-9.34-5 — Self-profile path resolution uses `_getSelfProfilePath`.** The existing private method `_getSelfProfilePath(workspaceRoot)` (lines 464-469) finds the self-profile via `listFiles(careerRoot, '.md')`. This is already used by `addMember`. Reuse it in `archiveMember` rather than duplicating the logic.

- **D-9.34-6 — `previous_manager` deduplication.** Before appending `current_manager` to `previous_manager[]`, check `!existing.includes(currentManager)` to avoid duplicates if `archiveMember` is somehow called twice on the same profile. This is consistent with how `addRelation` handles deduplication.

- **D-9.34-7 — Handling partial archive (hasDateFilter).** When `hasDateFilter` is true, only dated files are moved, not the profile itself. In this case, the archived profile path may not exist (`await this._fs.exists(archivedProfile)` returns false). The code already guards against this with the `if (await this._fs.exists(archivedProfile))` check. No change needed for the partial-archive branch — the profile stays in the original location and frontmatter is NOT updated (user retains the original profile). This is existing behavior; do NOT add logic to update the un-moved profile.

- **D-9.34-8 — `fireMember` requires no structural change.** `fireMember` delegates to `archiveMember` (which now does all the new work), then reads the archived profile again to add termination fields. The second read-write is acceptable — `fireMember` intentionally separates the two concerns. Do NOT merge them.

### Current State to Understand Before Changing

**`TeamService.archiveMember` (src/services/team.service.ts:284-343) — current behavior:**
```typescript
// 1. Validates member directory exists
// 2. Computes destDir = archivedRoot/year/email
// 3. hasDateFilter ? partial move of dated files : full dir move
// 4. Updates archived profile:
//    const fm = { ...parsed.data } as ITeamMemberFrontmatter;
//    fm.archived = true;
//    fm.archived_date = todayIso();
//    writeFile(archivedProfile, matter.stringify(parsed.content, fm));
// 5. _removeWikiLink(slug, normalizedEmail, workspaceRoot)
//    → removeRelation(teamMembersPath, 'members', link, fs) ✅ already correct
```

**Missing (what this story adds):**
```
// After move, BEFORE profile write:
// - originalMemberPath = memberProfilePath(ws, normalizedEmail)
// - selfPath = await _getSelfProfilePath(ws)

// Inside the profile write block:
// - fm['teams'] = []
// - if fm['current_manager'] is non-empty string:
//     fm['previous_manager'] = deduped append of current_manager
//     fm['current_manager'] = ''
// - else: fm['current_manager'] = ''

// After _removeWikiLink:
// - if selfPath:
//     selfLink = formatWikiLink(originalMemberPath, selfPath, normalizedEmail)
//     removeRelation(selfPath, 'direct_reports', selfLink, fs)
```

**`TeamService.fireMember` (src/services/team.service.ts:345-373):**
Calls `archiveMember`, then re-reads archived profile and adds `termination`, `termination_date`, `termination_note`. No structural change needed.

**`TeamService._getSelfProfilePath` (src/services/team.service.ts:464-469):**
```typescript
private async _getSelfProfilePath(workspaceRoot: string): Promise<string | null> {
  const careerRoot = path.join(workspaceRoot, 'my-career');
  if (!(await this._fs.exists(careerRoot))) return null;
  const mdFiles = await this._fs.listFiles(careerRoot, '.md');
  return mdFiles.length > 0 ? (mdFiles[0] as string) : null;
}
```
Already exists. Reuse it — do NOT duplicate.

**`removeRelation` (src/utils/frontmatter-relations.ts:80-98):**
```typescript
export async function removeRelation(filePath, key: RelationKey, wikiLink, fs): Promise<void>
```
`'direct_reports'` is already in `RelationKey`. Silent no-op if file missing. Use this for self-profile cleanup.

### Files Modified

| File | Change |
|---|---|
| `src/services/team.service.ts` | `archiveMember`: add `teams:[]` clear, `current_manager→previous_manager[]`, self `direct_reports` removal |
| `tests/services/team.service.test.ts` | Update `buildProfileMd` helper + add 5 new test cases |

### Key Relationship Schemas (from Sprint Change Proposal)

**Archived profile frontmatter shape after 9.34 (Schema #6):**
```yaml
email: jane@co.com
name: Jane Smith
role: Engineer
relationship: direct-report
date_added: 2026-01-01
start_date: ""
current_manager: ""                         # cleared (was wiki-link to manager)
previous_manager:                           # now populated with manager history
  - "[[../../../my-career/me@co.com.md|me@co.com]]"
other_leaderships: []
teams: []                                   # cleared (B6 fix)
projects:
  - "[[...platform-project...]]"            # preserved (mark-only)
last_1on1: 2026-05-20
last_feedback: 2026-05
archived: true
archived_date: 2026-06-13
termination: true                           # only on fire
termination_date: 2026-06-13                # only on fire
termination_note: "Voluntary departure"     # only on fire (optional)
```

**Self-profile `direct_reports` field (managed by addMember/archiveMember):**
```yaml
direct_reports:
  - "[[../../my-teams/members/jane@co.com/jane@co.com.md|jane@co.com]]"
```
After archive: the entry above is removed via `removeRelation`.

### Testing Patterns

The `archiveMember` tests use `mockFS.readFile` with `mockImplementation` keyed on path pattern. The `buildProfileMd` helper must be updated to include all fields that the new code reads/writes. Existing tests will break if `buildProfileMd` doesn't include `current_manager`/`previous_manager`/`teams` because the batch write now touches those fields.

For the self-profile cleanup test:
```typescript
// Mock setup needed:
const selfProfilePath = `${WORKSPACE}/my-career/me@co.com.md`;
const memberLink = '[[some/relative/path|a@co.com]]';  // whatever formatWikiLink generates
mockFS.listFiles.mockImplementation(async (p: string) => {
  if (p.replace(/\\/g, '/').includes('my-career')) return [selfProfilePath];
  return [];
});
mockFS.readFile.mockImplementation(async (p: string) => {
  if (p.replace(/\\/g, '/').includes('my-career/me@co.com.md'))
    return matter.stringify('', { email: 'me@co.com', direct_reports: [memberLink] });
  if (p.includes('a@co.com.md')) return buildProfileMd('a@co.com', ['[[...alpha...]]']);
  if (p.includes('alpha-members.md')) return '---\nmembers:\n  - ...\n---\n\n# Team Members\n';
  return '';
});
// Assertion: verify that the write to selfProfilePath does NOT contain the member link
```

Note: `formatWikiLink` generates a path relative from `selfPath` to `memberProfilePath`. In unit tests with `WORKSPACE = '/fake/workspace'`, the relative path will depend on the OS separator normalization. Assert using a regex or use `expect(content).not.toContain('a@co.com')` in the `direct_reports` array (parse matter and check `data['direct_reports']`).

### Cross-Cutting Reciprocity Map (this story's scope)

| Operation | Archived profile | `<team>-members.md` | Self-profile |
|---|---|---|---|
| `tmr team archive <team> <email>` | `archived=true`, `archived_date`, `teams=[]`, `previous_manager[+=current_manager]`, `current_manager=""` | `members[-=email]` (already done) | `direct_reports[-=email]` (NEW) |
| `tmr team fire <team> <email>` | above + `termination=true`, `termination_date`, `termination_note` | same | same |

### Anti-Patterns to Avoid

- **DO NOT** call `appendToSection` or `appendToHashSection` anywhere in this story — structural relations use `addRelation`/`removeRelation` only.
- **DO NOT** walk the vault to find and clean other back-references (project `members:`, leader's `direct_reports`, etc.) — decision #4 is mark-only.
- **DO NOT** add a separate `setScalar` call per field (extra I/O) — batch all changes in the existing single read-parse-write.
- **DO NOT** recompute `memberProfilePath` after the move for the `direct_reports` wiki-link — use `originalMemberPath` captured before the move.

### References

- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-06-09-frontmatter-relationships.md` — Story 9.34, Schemas #2, #6, #8, Decision #4, Reciprocity Map]
- [Source: `src/services/team.service.ts:284-343` — current `archiveMember` implementation]
- [Source: `src/services/team.service.ts:464-469` — `_getSelfProfilePath` private method]
- [Source: `src/utils/frontmatter-relations.ts:80-98` — `removeRelation` utility]
- [Source: `src/types/team.types.ts:11-32` — `ITeamMemberFrontmatter` interface]
- [Source: `_bmad-output/project-context.md` — Frontmatter-Native Relationship Model, Anti-Pattern section]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Test failure: AC4 self-profile wiki-link mock used `../../my-teams/...` (two levels) but `formatWikiLink` from `my-career/` generates `../my-teams/...` (one level). Fixed by correcting the mock string.

### Completion Notes List

- Task 1: Extended `archiveMember` in a single batch read-parse-write to add: `teams: []`, `current_manager → previous_manager[]` (dedup), `current_manager: ''`. Paths captured BEFORE the move per D-9.34-3. Reciprocal self-profile `direct_reports` cleanup added after `_removeWikiLink`. Cast to `Record<string, unknown>` per D-9.34-2.
- Task 2: Updated `buildProfileMd` helper (3-arg with `managerLink` default `''`). Added 5 new 9.34 test cases (AC2, AC3, AC3-empty, AC4-present, AC4-absent). Updated 3 existing tests to use new helper signature.
- Task 3: All 42 team.service tests pass. Full suite: 1357/1357 across 76 suites. Zero typecheck errors. Zero lint errors.

### File List

- `src/services/team.service.ts`
- `tests/services/team.service.test.ts`

### Change Log

- 2026-06-13: Implemented Story 9.34 — `archiveMember` frontmatter cleanup (teams clear, manager history, self direct_reports) + 5 new unit tests
- 2026-06-13: Addressed code review findings — 4 patches resolved (partial-archive teardown gated behind `!hasDateFilter`, `previous_manager` scalar coercion, AC5 fire-preservation test, AC3 dedup + partial-archive tests); 5 deferred (pre-existing), 5 dismissed. Full suite 1360/1360 green.
