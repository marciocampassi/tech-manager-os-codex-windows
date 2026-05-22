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
