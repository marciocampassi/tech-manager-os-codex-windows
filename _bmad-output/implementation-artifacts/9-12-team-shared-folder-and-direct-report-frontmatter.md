# Story 9.12 — tmr team: <email>-shared/ Folder + direct-report Frontmatter

## Metadata

| Field | Value |
|---|---|
| **Epic** | Epic 9 — UAT Pre-Launch Polish |
| **Story ID** | 9.12 |
| **Priority** | Medium |
| **Effort** | XS |
| **Risk** | Low — additive changes to `TeamService.addMember()` only |

---

## Problem Statement

`TeamService.addMember()` creates four subdirs (`1on1s/`, `feedbacks/`, `assessments/`, `performance-reviews/`) but is missing `<email>-shared/`, and `buildMemberProfileMd()` does not include the `relationship` frontmatter field. Two methods also reference the old `my-career/<email>/<email>.md` nested path — these must be flagged for Story 9.3.

---

## Acceptance Criteria

- `tmr team add <team> <email>` creates `my-teams/members/<email>/<email>-shared/` alongside the other subdirs
- `my-teams/members/<email>/<email>.md` frontmatter includes `relationship: direct-report`
- `getManagerEmail()` and `buildMemberProfileMd()` have TODO comments pointing to Story 9.3 for the `my-career` path fix
- All tests pass

---

## Files to Change

| File | Change |
|---|---|
| `src/services/team.service.ts` | Add `<email>-shared/` dir creation; add `relationship: 'direct-report'` to `buildMemberProfileMd()`; add Story 9.3 TODO comments |
| `tests/services/team.service.test.ts` | Add `<email>-shared/` assertion; add `relationship` frontmatter assertion |

---

## Implementation Detail

### 1 — Add `<email>-shared/` subdir in `addMember()`

In the new-member branch (after the four existing `createDirectory` calls), add:

```typescript
await this._fs.createDirectory(
  path.join(memberDir(workspaceRoot, normalizedEmail), `${normalizedEmail}-shared`),
);
```

### 2 — Add `relationship: direct-report` to `buildMemberProfileMd()`

```typescript
return `---
email: "${email}"
name: ${options.name ?? ''}
role: ${options.role ?? ''}
gender: ${options.gender ?? ''}
location: ${options.location ?? ''}
relationship: direct-report
teams:
${teamsYaml}
action_items_gdoc: ''
date_added: ${todayIso()}
---
...
```

### 3 — TODO comments for Story 9.3

In `getManagerEmail()` — currently reads `my-career/<email>/<email>.md`:

```typescript
// TODO(Story 9.3): my-career is flat after 9.3 — change to:
//   const profilePath = path.join(careerRoot, `${email}.md`);
//   and replace listDirectories() with listFiles() filtered to .md
const profilePath = path.join(careerRoot, email, `${email}.md`);
```

In `buildMemberProfileMd()` — manager link path:

```typescript
// TODO(Story 9.3): update to flat path path.join(workspaceRoot, 'my-career', `${managerEmail}.md`)
formatWikiLink(
  path.join(workspaceRoot, 'my-career', managerEmail, `${managerEmail}.md`),
  ...
)
```

---

## Notes for Developer Agent

- Story 9.3 must land before or alongside this story for the manager link to resolve correctly in a fresh vault. The TODO comments are the contract for that fix.
- The `<email>-shared/` directory name uses the normalized email (lowercase) — same as the profile file name.
- Run `npm run validate` before marking done.

---

## Dev Agent Record

### Implementation Notes

- No new dependencies required. All changes are additive within `src/services/team.service.ts`.
- `<email>-shared/` creation is placed after the four existing `createDirectory` calls in the new-member branch of `addMember()`. Uses `normalizedEmail` (lowercase) as required by the spec.
- `relationship: direct-report` field inserted between `location` and `teams` in `buildMemberProfileMd()` template string.
- Two TODO comments added:
  1. Above `listDirectories()` call in `getManagerEmail()` — describes the flat-file change needed when Story 9.3 lands.
  2. Above `formatWikiLink()` call in `buildMemberProfileMd()` — describes the new flat manager path.
- The first test run timeout for `inbox-process.service.integration.test.ts` was a flake (resource contention during parallel run, test passes in 39ms in isolation). Validated as pre-existing infrastructure noise.

### Completion Notes

- All three ACs satisfied:
  1. `tmr team add <team> <email>` now creates `<email>-shared/` alongside the other four subdirs ✅
  2. Profile frontmatter includes `relationship: direct-report` ✅
  3. `getManagerEmail()` and `buildMemberProfileMd()` have TODO(Story 9.3) comments ✅
- 3 new unit tests added (9.12 block in `team.service.test.ts`)
- 1 existing test augmented with `<email>-shared` assertion
- `npm run validate` passed: 1191 tests, 0 failures

### File List

- `src/services/team.service.ts` — added `<email>-shared/` dir creation, `relationship: direct-report` frontmatter, two TODO(Story 9.3) comments
- `tests/services/team.service.test.ts` — augmented existing new-member test; added 3 new `9.12:` tests

### Change Log

- 2026-05-26: Story 9.12 implemented — `<email>-shared/` subdir, `relationship: direct-report` frontmatter, Story 9.3 TODO comments (1191 tests pass)

---

## Status

done

---

## Senior Developer Review (AI)

**Date:** 2026-05-26
**Outcome:** Approved
**Layers:** Blind Hunter · Edge Case Hunter · Acceptance Auditor
**Totals:** 0 decision-needed · 3 patch · 5 defer · 9 dismissed

### Patch Findings

- [x] [Review][Patch] P1: Add negative assertion to normalization test — `'9.12: <email>-shared/ dir uses normalized (lowercase) email'` only asserts the lowercase form was created; also assert `expect(mockFS.createDirectory).not.toHaveBeenCalledWith(expect.stringContaining('DEV@CO.COM-shared'))` [tests/services/team.service.test.ts]
- [x] [Review][Patch] P2: Fix double-"path" in TODO comment — `"update to flat path path.join(...)"` reads "flat path path.join"; rephrase to `"update to: path.join(...)"` [src/services/team.service.ts]
- [x] [Review][Patch] P3: Add `relationship` to `ITeamMemberFrontmatter` interface — `relationship: direct-report` is written to every new profile but the TypeScript type has no `relationship` field; add `relationship?: string` to the interface so the field is modeled and type-safe [src/types/team.types.ts]

### Deferred Findings

- [x] [Review][Defer] W1: Orphaned subdirs on write failure — if `createDirectory` succeeds but `writeFile` throws, the 5 dirs (including `-shared`) are left with no profile; pre-existing pattern across all subdirs, not introduced by this story [src/services/team.service.ts]
- [x] [Review][Defer] W2: Duplicate test setup — the 3 new 9.12 tests repeat the same `mockFS` setup boilerplate; could share a `beforeEach`; style only [tests/services/team.service.test.ts]
- [x] [Review][Defer] W3: Existing-member backfill gap — re-running `team add` for a second team updates `teams` only; `<email>-shared/` and `relationship: direct-report` are never backfilled to pre-9.12 profiles; out of scope for this story, needs a separate migration story
- [x] [Review][Defer] W4: Flat `my-career/` manager resolution — Story 9.3 scope; `getManagerEmail()` returns `null` on flat vaults (post-init), leaving `## Current Manager` empty; TODO comments in the code are the explicit contract for this fix
- [x] [Review][Defer] W5: `archiveMember` partial archive omits `<email>-shared/` — `subDirs` list in the date-range branch has 4 entries and doesn't include `<email>-shared/`; low impact since shared-folder files are typically not date-prefixed; full archive (no date filter) already handles the entire dir correctly
