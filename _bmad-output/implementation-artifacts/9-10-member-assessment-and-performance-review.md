# Story 9.10 — tmr member add assessment + performance-review: Verification & Tests

## Metadata

| Field | Value |
|---|---|
| **Epic** | Epic 9 — UAT Pre-Launch Polish |
| **Story ID** | 9.10 |
| **Priority** | Low |
| **Depends on** | 9.1 (nested paths + subdir scaffolding), 9.9 (year-month filename fix for all types) |
| **Effort** | XS |
| **Risk** | Minimal — no new logic; verification and test coverage only |

---

## Problem Statement

`assessment` and `performance-review` exist as valid `FileType` values and are routed through `createMemberFile()`. After Stories 9.1 and 9.9 land, the path structure and filename format are correct by inheritance. However there are no dedicated tests verifying these two subtypes end-to-end, and the existing `FILE_TYPE_CONFIG` entries need a review to confirm they match the new conventions.

---

## Acceptance Criteria

- `tmr member add assessment user@co.com` creates `assessments/2026-05-assessment-user@co.com.md` inside the member's directory
- `tmr member add performance-review user@co.com` creates `performance-reviews/2026-05-performance-review-user@co.com.md`
- Both commands append a wiki-link to the correct profile section (`## Assessments`, `## Performance Reviews`)
- `FILE_TYPE_CONFIG` entries for `assessment` and `performance-review` are correct (subDir, fileSuffix, sectionName)
- Dedicated unit tests exist for both subtypes
- All tests pass

---

## Files to Change

| File | Change |
|---|---|
| `src/types/member.types.ts` | Verify `FILE_TYPE_CONFIG` entries; no changes expected if 9.9 already landed correctly |
| `tests/services/member.service.test.ts` | Add dedicated test cases for `assessment` and `performance-review` subtypes |

---

## `FILE_TYPE_CONFIG` Expected State (post-9.9)

```typescript
assessment: {
  subDir: 'assessments',
  fileSuffix: 'assessment',
  sectionName: 'Assessments',
},
'performance-review': {
  subDir: 'performance-reviews',
  fileSuffix: 'performance-review',
  sectionName: 'Performance Reviews',
},
```

Confirm these values are in place. No changes needed if 9.9 landed them correctly.

---

## Test Cases to Add

### `tests/services/member.service.test.ts`

**Assessment:**
```
Given: member profile exists at my-company/members/user@co.com/user@co.com.md
       assessments/ subdir exists
When:  createMemberFile('user@co.com', 'assessment', { date: '2026-05-22' }, ws)
Then:  file created at assessments/2026-05-assessment-user@co.com.md
       ## Assessments section in profile updated with wiki-link
```

**Performance review:**
```
Given: member profile exists at my-company/members/user@co.com/user@co.com.md
       performance-reviews/ subdir exists
When:  createMemberFile('user@co.com', 'performance-review', { date: '2026-05-22' }, ws)
Then:  file created at performance-reviews/2026-05-performance-review-user@co.com.md
       ## Performance Reviews section in profile updated with wiki-link
```

**Auto-create on missing member (assessment):**
```
Given: no member profile for newuser@co.com
When:  createMemberFile('newuser@co.com', 'assessment', {}, ws)
Then:  profile auto-created at my-company/members/newuser@co.com/newuser@co.com.md
       assessment file created inside assessments/ subdir
```

---

## Notes for Developer Agent

- This story is purely verification + tests. If `FILE_TYPE_CONFIG` and filename construction are already correct after 9.9, the only work is adding the test cases.
- Run `npm run validate` before marking done.
