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
