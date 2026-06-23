# Story 9.11 — tmr member add 1on1: Subcommand Verification & Auto-Create

## Metadata

| Field | Value |
|---|---|
| **Epic** | Epic 9 — UAT Pre-Launch Polish |
| **Story ID** | 9.11 |
| **Priority** | Medium |
| **Depends on** | 9.1 (nested paths), 9.8 (similarity check), 9.9 (year-month/full-date filename fix) |
| **Effort** | XS |
| **Risk** | Low |

---

## Problem Statement

`tmr member add 1on1 <email>` should work even when no member profile exists for that email — it auto-creates the profile first, then creates the 1on1 file. The email similarity check from Story 9.8 is the critical guard here: a typo (e.g. `usr1@co.com` instead of `user1@co.com`) would silently create a new member folder. The check must fire before any file system write.

---

## Acceptance Criteria

- `tmr member add 1on1 user@co.com` when no profile exists: auto-creates `my-company/members/user@co.com/user@co.com.md` with all subdirs, then creates `1on1s/2026-05-22-1on1-user@co.com.md`
- `tmr member add 1on1 user@co.com` when profile already exists: skips profile creation, creates the 1on1 file
- Email similarity check fires **before** any file system write — if user confirms abort (Y), no folder or file is created
- The `## 1on1s` section of the member profile is updated with a wiki-link to the new file
- Full date (`YYYY-MM-DD`) is used in the filename (1on1s happen frequently)
- All tests pass

---

## Files to Change

| File | Change |
|---|---|
| `src/services/member.service.ts` | Confirm `createMemberFile()` auto-creates via `EmailResolutionService.resolve()` (already handled post-9.1) |
| `src/commands/member.command.ts` | Confirm similarity check fires before `createMemberFile()` for the 1on1 type path |
| `tests/services/member.service.test.ts` | Add 1on1 auto-create test case |
| `tests/commands/member.command.test.ts` | Add similarity-check-before-create test for 1on1 path |

---

## Implementation Detail

### Execution order in `runMemberAdd()` for type-first path (1on1, feedback, etc.)

The order of operations MUST be:

```
1. Resolve / prompt for email
2. validateEmail(email)                        ← throws on invalid format
3. warnIfSimilarEmail(email, ws)               ← Story 9.8 — fires BEFORE any FS write
   └─ if user aborts → return (no files written, no folders created)
4. createMemberFile(email, type, opts, ws)     ← auto-creates profile if needed, then writes dated file
```

This order guarantees that a typo like `usr1@co.com` is caught before `my-company/members/usr1@co.com/` is created.

### `createMemberFile()` auto-create flow (post-9.1)

After Story 9.1, `createMemberFile()` calls `EmailResolutionService.resolve(email, ws)`. If the entity is not found anywhere in the vault, `_doResolve` step 4 auto-creates a company-scoped member profile. This covers the "member not found" case automatically — no additional logic needed in `createMemberFile()` for 1on1.

---

## Test Cases

### `tests/services/member.service.test.ts`

**1on1 on existing member:**
```
Given: profile at my-company/members/user@co.com/user@co.com.md; 1on1s/ subdir exists
When:  createMemberFile('user@co.com', '1on1', { date: '2026-05-22' }, ws)
Then:  file at 1on1s/2026-05-22-1on1-user@co.com.md
       ## 1on1s section updated with wiki-link
```

**1on1 auto-creates member:**
```
Given: no profile for newuser@co.com
When:  createMemberFile('newuser@co.com', '1on1', { date: '2026-05-22' }, ws)
Then:  profile auto-created at my-company/members/newuser@co.com/newuser@co.com.md
       1on1 file created at 1on1s/2026-05-22-1on1-newuser@co.com.md
```

### `tests/commands/member.command.test.ts`

**Similarity check fires before 1on1 creation:**
```
Given: profile exists for user1@co.com
When:  tmr member add 1on1 usr1@co.com (typo)
       similarity check returns user1@co.com
       user confirms abort (Y)
Then:  no file written; no directory created for usr1@co.com
       exit code 0
```

---

## Notes for Developer Agent

- The similarity check placement is the most important correctness requirement in this story. Verify it is called before `createMemberFile()`, not after.
- `warnIfSimilarEmail` returns `false` when the user aborts — the caller returns immediately without calling `createMemberFile()`. No partial state is left behind.
- Run `npm run validate` before marking done.

---

## Dev Agent Record

### Implementation Notes

- Verified: `warnIfSimilarEmail` is called at `member.command.ts:201`, before `createMemberFile()` at line 259 — the ordering is correct (P12 fix from story 9.9).
- Verified: `createMemberFile()` auto-creates the member profile via `EmailResolutionService.resolve()` when the email is not found — this was established by story 9.1.
- No production code changes were needed. All work is test-only.
- Added 2 new unit tests in `member.service.test.ts` (1on1 existing member, 1on1 auto-create) with full assertions: `createDirectory`, `writeFile`, and `appendToFile`.
- Added 2 new command tests in `member.command.test.ts` verifying the type-first path similarity check ordering: abort prevents `createMemberFile`, continue allows it.

### Completion Notes

All ACs satisfied:
- ✅ `tmr member add 1on1 user@co.com` (no profile): auto-creates profile then creates `1on1s/YYYY-MM-DD-1on1-user@co.com.md` — verified by auto-create unit test
- ✅ `tmr member add 1on1 user@co.com` (profile exists): skips profile creation, creates 1on1 file — verified by existing-member unit test
- ✅ Similarity check fires before any FS write — verified by command abort test
- ✅ `## 1on1s` section updated with wiki-link — verified by `appendToFile` assertions
- ✅ Full date (`YYYY-MM-DD`) used in filename — verified by date `2026-05-22` assertions
- ✅ 1187 tests pass (lint ✅ · typecheck ✅ · build ✅)

---

## File List

- `tests/services/member.service.test.ts` — added 2 new 9.11 test cases
- `tests/commands/member.command.test.ts` — added `9.11: similarity check fires before 1on1 creation` describe block (3 tests after patches)

---

## Change Log

- 2026-05-26: Added 1on1 auto-create and similarity-check ordering tests (Story 9.11)
- 2026-05-26: Applied 4 code-review patches — clarifying comment, `mockFindSimilarEmail` arg assertion, `mockPrompt` called assertion, null-return happy-path test (1188 tests pass)

---

## Status

done

---

## Senior Developer Review (AI)

**Date:** 2026-05-26
**Outcome:** Changes Requested
**Layers:** Blind Hunter · Edge Case Hunter · Acceptance Auditor
**Totals:** 0 decision-needed · 4 patch · 4 defer · 4 dismissed

### Patch Findings

- [x] [Review][Patch] P1: Add comment explaining `proceed: true = abort` semantics — the prompt asks "Did you mean X?", making `true` mean "abort original"; undocumented, high regression risk if someone inverts future [tests/commands/member.command.test.ts]
- [x] [Review][Patch] P2: Add `expect(mockFindSimilarEmail).toHaveBeenCalledWith('usr1@co.com', '/fake/ws')` to abort test — currently only asserts outcome, not that the similarity check mechanism was invoked with the correct args [tests/commands/member.command.test.ts]
- [x] [Review][Patch] P3: Add `expect(mockPrompt).toHaveBeenCalled()` to abort test — verifies the user was actually shown a warning before abort; without it, the test would pass even if the check silently dropped the prompt [tests/commands/member.command.test.ts]
- [x] [Review][Patch] P4: Add null-return happy-path test: `findSimilarEmail` returns `null` → no prompt shown, `createMemberFile` called — the most common real-world path has zero coverage in the new 9.11 block [tests/commands/member.command.test.ts]

### Deferred Findings

- [x] [Review][Defer] W1: Fix `as unknown as Record<string, string>` cast to `{ proceed: boolean }` actual type [tests/commands/member.command.test.ts] — deferred, stylistic; works correctly at runtime
- [x] [Review][Defer] W2: Tighten `expect.any(Object)` in continue-path to also validate date field [tests/commands/member.command.test.ts] — deferred, over-specification risk; deliberate choice
- [x] [Review][Defer] W3: Add service test for 1on1 with no `date` option (default date handling) [tests/services/member.service.test.ts] — deferred, pre-existing coverage gap
- [x] [Review][Defer] W4: Guard for `resolve` returning `created: true` with null `absolutePath` [tests/services/member.service.test.ts] — deferred, pre-existing service-layer edge case
