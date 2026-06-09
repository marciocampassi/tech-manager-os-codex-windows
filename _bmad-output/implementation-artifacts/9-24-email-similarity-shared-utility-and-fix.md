---
baseline_commit: c171979c3392a6b7cc20d6527cb005e4a64aefdf
---

# Story 9.24: Email Similarity Guard — Shared Utility and Use-Found-Email Fix

Status: done

## Story

As a user adding a member/leader/team-member/project stakeholder,
I want the "did you mean X?" prompt to actually use the found email when I confirm it,
So that I don't need to re-run the command with the corrected email.

## Acceptance Criteria

1. A new file `src/utils/email-guard.ts` exports `resolveEmailWithSimilarCheck(email, workspaceRoot): Promise<string>` — it returns the email to use (similar if user said Y, original if user said N or no match found). It NEVER returns `undefined`; it NEVER aborts.
2. When a similar email is found and the user answers **Y** ("yes, I meant the similar one"), the command continues using the **found (corrected) email** — not the originally-typed one.
3. When the user answers **N**, the command continues with the **originally typed email** unchanged.
4. The local `warnIfSimilarEmail()` function is **deleted** from all 4 command files (`member`, `leadership`, `team`, `project`).
5. The `findSimilarEmail` import from `../utils/email-similarity.js` is **removed** from all 4 command files and replaced with `resolveEmailWithSimilarCheck` from `../utils/email-guard.js`.
6. All single-email call sites use: `email = await resolveEmailWithSimilarCheck(email, ws);` — **reassigning** the `email` variable, not checking a boolean.
7. `project.command.ts` batch loops (`runProjectLinkMembers`, `runProjectLinkStakeholders`) push the resolved email (which may be the corrected one) into `filteredEmails`.
8. All existing tests pass. Tests that previously mocked `../../src/utils/email-similarity.js` are updated to mock `../../src/utils/email-guard.js` instead.
9. `npm run validate` passes.

## Tasks / Subtasks

- [x] Task 1: Create `src/utils/email-guard.ts` (AC: 1)
  - [x] Import `findSimilarEmail` from `./email-similarity.js` and `printWarning` from `./display.js`
  - [x] Export `resolveEmailWithSimilarCheck(email, workspaceRoot): Promise<string>` — see exact implementation in Dev Notes
  - [x] Do NOT re-implement levenshtein or scan logic — delegate to `findSimilarEmail`
- [x] Task 2: Update `src/commands/member.command.ts` (AC: 4, 5, 6)
  - [x] Remove `import { findSimilarEmail } from '../utils/email-similarity.js'`
  - [x] Add `import { resolveEmailWithSimilarCheck } from '../utils/email-guard.js'`
  - [x] Delete the `warnIfSimilarEmail` function (lines 12–28)
  - [x] Member-creation path (line ~57): change `const email` → `let email`, then replace the `warnIfSimilarEmail` guard with `email = await resolveEmailWithSimilarCheck(email, ws);` (no `if (!shouldContinue) return`)
  - [x] Type-first path (line ~200): `email` is already `let` — replace the `warnIfSimilarEmail` guard with `email = await resolveEmailWithSimilarCheck(email, ws);`
- [x] Task 3: Update `src/commands/leadership.command.ts` (AC: 4, 5, 6)
  - [x] Remove `import { findSimilarEmail }` → add `import { resolveEmailWithSimilarCheck }` from `email-guard.js`
  - [x] Delete the `warnIfSimilarEmail` function (lines 12–26)
  - [x] Line ~65 (`runLeadershipAdd`): `email = await resolveEmailWithSimilarCheck(email, ws);`
  - [x] Line ~145 (`runLeadership1on1`): `email = await resolveEmailWithSimilarCheck(email, ws);`
  - [x] Verify `email` is `let` at both call sites (both already are — resolved from prompt or arg)
- [x] Task 4: Update `src/commands/team.command.ts` (AC: 4, 5, 6)
  - [x] Remove `import { findSimilarEmail }` → add `import { resolveEmailWithSimilarCheck }` from `email-guard.js`
  - [x] Delete the `warnIfSimilarEmail` function (lines 13–27)
  - [x] Line ~123 (`runAdd`): `email = await resolveEmailWithSimilarCheck(email, ws);` — `email` is already `let`
- [x] Task 5: Update `src/commands/project.command.ts` (AC: 4, 5, 6, 7)
  - [x] Remove `import { findSimilarEmail }` → add `import { resolveEmailWithSimilarCheck }` from `email-guard.js`
  - [x] Delete the `warnIfSimilarEmail` function (lines 11–25)
  - [x] Line ~111 (`runProjectLinkMember`): `email` is `const` — change to `let email`, then `email = await resolveEmailWithSimilarCheck(email, ws);`
  - [x] `runProjectLinkMembers` batch loop (lines ~155–157): change loop variable to `rawEmail` and push resolved email → `filteredEmails.push(await resolveEmailWithSimilarCheck(rawEmail, ws));`
  - [x] Line ~203 (`runProjectLinkStakeholder`): `email` is `const` — change to `let email`, then `email = await resolveEmailWithSimilarCheck(email, ws);`
  - [x] `runProjectLinkStakeholders` batch loop (lines ~247–249): same pattern as link-members
- [x] Task 6: Update tests (AC: 8)
  - [x] `tests/commands/member.command.test.ts`: changed mock to `'../../src/utils/email-guard.js'` with `resolveEmailWithSimilarCheck`; rewrote 9.8 and 9.11 test blocks
  - [x] `tests/commands/leadership.command.test.ts`: same change; rewrote 9.8 tests for 1on1
  - [x] `tests/commands/team.command.test.ts`: no mock needed — real `resolveEmailWithSimilarCheck` returns original email for fake workspace; all 17 tests pass
  - [x] `tests/commands/project.command.test.ts`: same as team; all 19 tests pass
  - [x] Verify all tests pass: 90 tests pass across all 4 command files
- [x] Task 7: Validate (AC: 9)
  - [x] `npm run validate` (lint + typecheck + test + build)

## Dev Notes

### New File: `src/utils/email-guard.ts`

Exact implementation to create:

```typescript
import inquirer from 'inquirer';
import { findSimilarEmail } from './email-similarity.js';
import { printWarning } from './display.js';

/**
 * Checks for a similar email in the vault. If found, prompts the user to
 * confirm whether they meant the existing email or want to continue with
 * the typed one. Returns the email to use — either the similar one or the
 * original. Never aborts; the caller always gets a valid email back.
 */
export async function resolveEmailWithSimilarCheck(
  email: string,
  workspaceRoot: string,
): Promise<string> {
  const similar = findSimilarEmail(email, workspaceRoot);
  if (!similar) return email;

  printWarning(`Similar email already exists: ${similar}`);
  const { useSimilar } = await inquirer.prompt<{ useSimilar: boolean }>([
    {
      type: 'confirm',
      name: 'useSimilar',
      message: `Did you mean "${similar}"? (Y = use "${similar}", N = continue with "${email}")`,
      default: false,
    },
  ]);
  return useSimilar ? similar : email;
}
```

Key difference from the old `warnIfSimilarEmail`: this function **returns a string** (the email to use), not a boolean. There is **no abort path** — the caller does not need to check a return value and `return`. The caller simply uses whatever email the function returns.

### The Bug Being Fixed

Old pattern (broken):
```typescript
const shouldContinue = await warnIfSimilarEmail(email, ws);
if (!shouldContinue) return; // user said Y → exits! Never uses the found email.
```

New pattern (correct):
```typescript
email = await resolveEmailWithSimilarCheck(email, ws);
// email is now either the original or the corrected one — execution always continues
```

### member.command.ts — Member-Creation Path Detail

The email variable in the member-creation branch is declared `const` (line ~57). It MUST become `let` so it can be reassigned:

```typescript
// BEFORE:
if (isEmail(typeArg)) {
  const email = typeArg.trim().toLowerCase();
  const ws = svc.getWorkspaceRoot();
  const shouldContinue = await warnIfSimilarEmail(email, ws);
  if (!shouldContinue) return;
  // ...
}

// AFTER:
if (isEmail(typeArg)) {
  let email = typeArg.trim().toLowerCase();
  const ws = svc.getWorkspaceRoot();
  email = await resolveEmailWithSimilarCheck(email, ws);
  // ...
}
```

The type-first path (`email` at line ~180) is already `let email` — just replace the guard.

### project.command.ts — const email Declarations

`runProjectLinkMember` and `runProjectLinkStakeholder` both declare `email` as `const` via optional chaining:
```typescript
const email = emailArg?.trim().toLowerCase() ?? '';
```
Change to `let email = ...` before the similarity check call.

### project.command.ts — Batch Loop Pattern

Old batch loop (broken — accumulates original emails):
```typescript
for (const email of emails) {
  const shouldContinue = await warnIfSimilarEmail(email, ws);
  if (shouldContinue) filteredEmails.push(email);
}
```

New batch loop (correct — accumulates resolved emails, never skips):
```typescript
for (const rawEmail of emails) {
  filteredEmails.push(await resolveEmailWithSimilarCheck(rawEmail, ws));
}
```

The "All emails were skipped" early-return guard remains unchanged — it now fires only if the original `emails` array was empty, which is already prevented by the earlier validation. In practice the guard becomes unreachable since `resolveEmailWithSimilarCheck` always pushes an email, but it is harmless to leave it.

### Test Mock Update

Current mock in `member.command.test.ts` (and `leadership.command.test.ts`):
```typescript
jest.unstable_mockModule('../../src/utils/email-similarity.js', () => ({
  findSimilarEmail: jest.fn().mockReturnValue(null),
}));
```

New mock (replace the above with):
```typescript
jest.unstable_mockModule('../../src/utils/email-guard.js', () => ({
  resolveEmailWithSimilarCheck: jest.fn().mockImplementation((email: string) =>
    Promise.resolve(email),
  ),
}));
```

This mock makes `resolveEmailWithSimilarCheck` return the original email unchanged — the same "no-op" behavior the old null-returning `findSimilarEmail` mock produced.

For `team.command.test.ts` and `project.command.test.ts` — these files currently have no mock for `email-similarity.js`. They rely on the real `findSimilarEmail` returning `null` when the workspace path is a fake temp dir. The real `resolveEmailWithSimilarCheck` will also return the original email unchanged under those conditions (since `findSimilarEmail` returns null → function returns `email`). **If tests fail**, add the same `email-guard.js` mock as above.

### Project Structure Notes

- New file: `src/utils/email-guard.ts` — role suffix `*.ts`, kebab-case name ✓
- No barrel `index.ts` — import directly: `import { resolveEmailWithSimilarCheck } from '../utils/email-guard.js'` (`.js` extension required for ESM)
- `inquirer` is already a static import in all 4 command files — no lazy loading needed in the utility (it is only called inside `.action()` callbacks)
- `printWarning` is already imported in all 4 command files — in the new utility file you must import it directly from `./display.js`

### Anti-Pattern Enforced (project-context.md rule)

> **DO NOT** duplicate interactive guard functions across command files. Any `async function` that uses `inquirer.prompt` and appears in more than one command file MUST be extracted to `src/utils/` and imported. The canonical shared guard is `resolveEmailWithSimilarCheck` in `src/utils/email-guard.ts`.

### References

- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-06-09-post-uat-bugs-3.md#Story 9.24`] — Full spec, code diffs, acceptance criteria
- [Source: `src/utils/email-similarity.ts`] — `findSimilarEmail` implementation (delegate to this, don't re-implement)
- [Source: `src/commands/member.command.ts`] — Two call sites: line ~61 (member-creation path, `const email`), line ~200 (type-first path, `let email`)
- [Source: `src/commands/leadership.command.ts`] — Two call sites: line ~65 (`runLeadershipAdd`), line ~145 (`runLeadership1on1`)
- [Source: `src/commands/team.command.ts`] — One call site: line ~123 (`runAdd`)
- [Source: `src/commands/project.command.ts`] — Four call sites: line ~111 (`runProjectLinkMember`, `const`), lines ~155–157 (batch loop), line ~203 (`runProjectLinkStakeholder`, `const`), lines ~247–249 (batch loop)
- [Source: `_bmad-output/project-context.md#Anti-Patterns to Avoid`] — Canonical shared guard rule

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

(none)

### Completion Notes List

- Created `src/utils/email-guard.ts` with `resolveEmailWithSimilarCheck` — delegates to `findSimilarEmail`, prompts user if similar found, always returns a string (never aborts). This is the canonical fix for the bug where answering Y on the similarity prompt caused an abort instead of using the corrected email.
- Deleted the duplicated `warnIfSimilarEmail` function from all 4 command files (`member`, `leadership`, `team`, `project`). Also cleaned up now-unused `printWarning` imports from `leadership`, `team`, and `project` command files.
- Updated all 6 call sites: `member` (×2), `leadership` (×2), `team` (×1), `project` (×4 including both batch loops). `const email` → `let email` changed where needed.
- Updated `member.command.test.ts` and `leadership.command.test.ts` to mock `email-guard.js` instead of `email-similarity.js`. Rewrote the 9.8/9.11 test blocks to reflect the new contract: no abort path, corrected email flows through.
- `team.command.test.ts` and `project.command.test.ts` required no mock changes — real `resolveEmailWithSimilarCheck` behaves as no-op with fake workspace paths.
- All 90 command tests pass. Lint, typecheck, and build clean.

### File List

- `src/utils/email-guard.ts` (new)
- `src/commands/member.command.ts` (modified)
- `src/commands/leadership.command.ts` (modified)
- `src/commands/team.command.ts` (modified)
- `src/commands/project.command.ts` (modified)
- `tests/commands/member.command.test.ts` (modified)
- `tests/commands/leadership.command.test.ts` (modified)

## Change Log

- 2026-06-09: Code review patch — normalize email casing in `team.command.ts` `runAdd` before similarity guard (Marlon / code review)
- 2026-06-09: Story 9.24 implemented — extracted `resolveEmailWithSimilarCheck` shared utility to `src/utils/email-guard.ts`; deleted `warnIfSimilarEmail` from all 4 command files; fixed the bug where answering Y on the similarity prompt caused an abort instead of using the corrected email; updated all tests. (Marlon / claude-sonnet-4-6)

### Review Findings

- [x] [Review][Patch] Normalize email casing in `team.command.ts` before similarity guard [`src/commands/team.command.ts:82,102`]
- [x] [Review][Defer] Dead `filteredEmails.length === 0` guard in project batch loops [`src/commands/project.command.ts:140,230`] — deferred, pre-existing; story dev notes document leaving it harmless
- [x] [Review][Defer] No dedicated unit test for `email-guard.ts` Y/N prompt branches [`src/utils/email-guard.ts`] — deferred, AC8 satisfied via command-level mocks per story spec
- [x] [Review][Defer] `inquirer.prompt` throws in non-TTY / SIGINT contexts unhandled at guard call sites — deferred, pre-existing pattern (see 9-8 deferred D12)
- [x] [Review][Defer] Batch link commands prompt sequentially per email with no dedup — deferred, pre-existing behavior from 9-8 guard
- [x] [Review][Defer] Leadership decline-path test relies on default mock passthrough without explicit N simulation [`tests/commands/leadership.command.test.ts:248`] — deferred, mock contract still validates original email flows through
