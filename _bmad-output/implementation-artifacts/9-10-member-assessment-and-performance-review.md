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

---

## Dev Agent Record

### Implementation Notes

- Discovered that `FILE_TYPE_CONFIG['performance-review'].fileSuffix` was `'review'` instead of the required `'performance-review'`. This meant filenames were being generated as `2026-05-review-user@co.com.md` rather than `2026-05-performance-review-user@co.com.md`. Fixed in `src/types/member.types.ts`.
- Updated two pre-existing test assertions that expected the old `-review-` suffix: one unit test in `member.service.test.ts` and one integration test in `member.integration.test.ts`.
- Added 3 dedicated test cases (prefixed `9.10:`) to `member.service.test.ts`:
  1. Assessment — correct year-month path + `## Assessments` wiki-link
  2. Performance-review — correct year-month path + `## Performance Reviews` wiki-link
  3. Assessment — auto-creates missing member profile and creates assessment file

### Completion Notes

All ACs satisfied:
- ✅ `assessment` produces `assessments/2026-05-assessment-user@co.com.md`
- ✅ `performance-review` produces `performance-reviews/2026-05-performance-review-user@co.com.md`
- ✅ Wiki-links appended to correct profile sections (`## Assessments`, `## Performance Reviews`)
- ✅ `FILE_TYPE_CONFIG` verified and corrected (`fileSuffix: 'performance-review'`)
- ✅ Dedicated unit tests exist for both subtypes (3 new tests)
- ✅ 1182 tests pass (lint ✅ · typecheck ✅ · build ✅)

---

## File List

- `src/types/member.types.ts` — fixed `performance-review.fileSuffix: 'review'` → `'performance-review'`
- `tests/services/member.service.test.ts` — updated existing assertion; added 3 new 9.10 test cases
- `tests/integration/member.integration.test.ts` — updated existing performance-review path assertion

---

## Change Log

- 2026-05-26: Fixed `FILE_TYPE_CONFIG['performance-review'].fileSuffix` and added dedicated test coverage for `assessment` and `performance-review` subtypes (Story 9.10)

---

## Status

done

---

## Senior Developer Review (AI)

**Date:** 2026-05-26
**Outcome:** Changes Requested
**Layers:** Blind Hunter · Edge Case Hunter · Acceptance Auditor
**Totals:** 0 decision-needed · 8 patch · 4 defer · 4 dismissed

### Patch Findings

- [x] [Review][Patch] P1: Add auto-create test for `performance-review` type — mirrors the auto-create test added for `assessment`; the `performance-review` code path under auto-create is completely untested at the unit level [tests/services/member.service.test.ts]
- [x] [Review][Patch] P2: Augment existing assessment & performance-review tests with `appendToFile` assertions and remove the near-duplicate 9.10 tests — two nearly-identical test pairs now exist per type (old: checks writeFile; new: checks both writeFile and appendToFile with a different date); augment the originals and remove the duplicates [tests/services/member.service.test.ts:189-204]
- [x] [Review][Patch] P3: Add `createDirectory` assertions to all three new 9.10 tests — subdirectory creation is a key path reachable from each new test but none of them assert it; a regression in subdir creation would pass silently [tests/services/member.service.test.ts:205-252]
- [x] [Review][Patch] P4: Change `{ date: '2026-05-22' }` to `{}` in the auto-create test — spec literal for auto-create scenario is `{}`, intending to exercise default/missing date handling; hardcoded date diverges from specified scenario [tests/services/member.service.test.ts:231-252]
- [x] [Review][Patch] P5: Add direct `FILE_TYPE_CONFIG` snapshot test — the `fileSuffix: 'review'` bug was silent because no test directly asserts config values; a snapshot test would prevent this regression class [src/types/member.types.ts]
- [x] [Review][Patch] P6: Add `result.filePath` format assertion to performance-review integration test — `fs.existsSync(result.filePath)` only proves a file was written, not that the path contains `performance-review`; the original bug could survive this test [tests/integration/member.integration.test.ts:133]
- [x] [Review][Patch] P7: Add `result.wikiLink` assertion for `performance-review` — `createMemberFile` returns `{ filePath, profilePath, wikiLink }`; the wikiLink is used in CLI output and is never asserted for this type; if the builder produced the old suffix the return-value tests would all still pass [tests/services/member.service.test.ts]
- [x] [Review][Patch] P8: Add section boundary assertion to performance-review integration test — the 1on1 integration test explicitly checks both the wiki-link string and the section header (`## 1on1s`); the performance-review test only checks the raw string, so a wrong-section append would go undetected [tests/integration/member.integration.test.ts:140]

### Deferred Findings

- [x] [Review][Defer] W1: Document vault data backward compatibility for `fileSuffix` rename — existing vault files named `YYYY-MM-review-<email>.md` now have broken wiki-links; no migration note or release changelog entry [src/types/member.types.ts] — deferred, pre-existing data concern out of scope for this story
- [x] [Review][Defer] W2: Wrap 9.10 tests in a dedicated `describe` block — new tests are behind a comment banner but not in an enforceable describe scope; other story tests use `describe('Story X.Y — ...')` for selective execution [tests/services/member.service.test.ts] — deferred, stylistic
- [x] [Review][Defer] W3: Standardize test dates across assessment/performance-review tests — existing tests use `2026-03-07`, new 9.10 tests use `2026-05-22`; produces two expected year-month prefixes across tests for the same behavior [tests/services/member.service.test.ts] — deferred, low priority
- [x] [Review][Defer] W4: Add flat profile branch test for auto-create — the auto-create test uses a nested profile only; the flat profile layout of `memberSubDirFromProfile` is never entered in any auto-create test [tests/services/member.service.test.ts:231-252] — deferred, pre-existing coverage gap
