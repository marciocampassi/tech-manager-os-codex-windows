# Story 9.15 — tmr show: Self-Profile Lookup Fix

## Metadata

| Field | Value |
|---|---|
| **Epic** | Epic 9 — UAT Pre-Launch Polish |
| **Story ID** | 9.15 |
| **Priority** | High — `tmr show <own-email>` currently returns "not found" |
| **Effort** | XS |
| **Risk** | Low — additive lookup steps, no destructive changes |

---

## Problem Statement

`TeamService.showProfile()` searches: active team member → archived → leadership → company member. It never checks `my-career/` (self) or `my-company/contractors/` (contractors). Running `tmr show <own-email>` always returns "Profile not found" even when the user's self-profile exists at `my-career/<email>.md` (flat, per Story 9.3). Contractors are also invisible to this command.

The root cause is that `showProfile` builds paths inline for a subset of scopes rather than delegating to `EmailResolutionService.resolve()`, which already handles the full resolution order (team-member → leadership → self → company-member → contractor).

---

## Acceptance Criteria

- `tmr show <own-email>` displays the content of `my-career/<email>.md` with a `[Self]` label
- `tmr show <contractor-email>` displays the content of `my-company/contractors/<email>/<email>.md` with a `[Contractor]` label
- The existing cases (active member, archived, leadership, company member) continue to work unchanged
- Profile resolution delegates to `EmailResolutionService.resolve()` — no inline path construction for new cases
- All tests pass

---

## Files to Change

| File | Change |
|---|---|
| `src/services/team.service.ts` | `showProfile()` — add self and contractor lookup steps; add `EmailResolutionService` as constructor dependency |
| `src/commands/team.command.ts` | `runShow()` — add `'self'` and `'contractor'` to `locationLabel` map |
| `tests/services/team.service.test.ts` | Add `showProfile` tests for self and contractor resolution |
| `tests/commands/team.command.test.ts` | Add `runShow` tests for `'self'` and `'contractor'` location labels |

---

## Implementation Detail

### 1 — Extend `showProfile()` with self + contractor steps

The cleanest fix inserts two additional checks in the resolution sequence. These checks use `EmailResolutionService.resolve()` to avoid duplicating path logic:

```typescript
async showProfile(email: string, workspaceRoot: string): Promise<IProfileResult | null> {
  const normalizedEmail = email.toLowerCase();

  // 0. Self-profile (my-career/<email>.md — flat per Story 9.3)
  const selfResolved = await this._emailResolution.resolve(normalizedEmail, workspaceRoot);
  if (selfResolved?.type === 'self') {
    return {
      location: 'self',
      filePath: selfResolved.absolutePath,
      content: await this._fs.readFile(selfResolved.absolutePath),
    };
  }

  // 1. Active team member (existing)
  const memberPath = memberProfilePath(workspaceRoot, normalizedEmail);
  if (await this._fs.exists(memberPath)) { ... }

  // 2. Archived (existing) ...

  // 3. Leadership (existing) ...

  // 4. Company member (existing) ...

  // 5. Contractor (new)
  const contractorResolved = await this._emailResolution.resolve(normalizedEmail, workspaceRoot);
  if (contractorResolved?.type === 'contractor') {
    return {
      location: 'contractor',
      filePath: contractorResolved.absolutePath,
      content: await this._fs.readFile(contractorResolved.absolutePath),
    };
  }

  return null;
}
```

**Note:** Steps 1–4 can remain as-is for now since they predate `EmailResolutionService` and work correctly for those scopes. Only the self and contractor gaps require the resolver. A follow-up refactor (not in scope here) could route the entire method through the resolver.

### 2 — Add labels in `runShow()`

```typescript
const locationLabel: Record<string, string> = {
  member: 'Active team member',
  archived: 'Archived member',
  leadership: 'Leadership',
  relationship: 'Company member',
  self: 'Self',
  contractor: 'Contractor',
};
```

### 3 — Constructor injection of `EmailResolutionService`

`TeamService` already has a constructor that accepts services. Add `EmailResolutionService` alongside `FileSystemService`:

```typescript
constructor(
  fs: FileSystemService,
  private readonly _emailResolution: EmailResolutionService = emailResolutionService,
) {
  this._fs = fs;
}
```

---

## Notes for Developer Agent

- `EmailResolutionService.resolve()` returns `{ type, absolutePath, created }` — use `absolutePath` as `filePath` in the result.
- The `type: 'self'` check in step 0 will only match when the queried email is the user's own email (as stored in `my-career/`). Any other email will not resolve as `'self'` so no false positives.
- `IProfileResult` may need the `'self'` and `'contractor'` union members added to its `location` field type.
- Do NOT call `findMemberGlobally()` or `createMember()` — both are deleted.
- Run `npm run validate` before marking done.

---

## Tasks / Subtasks

- [x] Add `'self'` and `'contractor'` to `ProfileLocation` in `src/types/team.types.ts`
- [x] Add `EmailResolutionService` constructor injection to `TeamService`
- [x] Extend `showProfile()` with self + contractor resolution via `EmailResolutionService.resolve()`
- [x] Add `'self': 'Self'` and `'contractor': 'Contractor'` to `locationLabel` in `runShow()`; fix `'relationship'` label to `'Company member'`
- [x] Write failing service tests for self and contractor in `showProfile`; write command tests for self and contractor labels in `runShow`
- [x] `npm run validate` — all tests pass

---

## Dev Agent Record

### Implementation Notes

- `resolve()` is called once at step 5 in `showProfile()` — after all existing path-level checks (member, archived, leadership, company-member) — to avoid the auto-create side effect for truly unknown emails. For self/contractor emails, the existing checks all return false before `resolve()` fires.
- `MockEmailResolution` added to `tests/services/team.service.test.ts`; `TeamService` `beforeEach` updated to pass the mock as the second constructor parameter. Existing tests unaffected since the default mock returns `type: 'relationship'` (neither 'self' nor 'contractor').
- `'relationship'` label updated from `'Relationship'` to `'Company member'` in `runShow()` for consistency with spec and human-readable conventions.

### Completion Notes

All 5 ACs satisfied:
1. `tmr show <own-email>` returns self profile with `[Self]` label ✅
2. `tmr show <contractor-email>` returns contractor profile with `[Contractor]` label ✅
3. Existing cases (member, archived, leadership, company member) unchanged ✅
4. Profile resolution delegates to `EmailResolutionService.resolve()` for new cases ✅
5. All tests pass — `npm run validate` exits 0 ✅

New tests: 2 in `tests/services/team.service.test.ts`, 2 in `tests/commands/team.command.test.ts`.

### File List

- `src/types/team.types.ts`
- `src/services/team.service.ts`
- `src/commands/team.command.ts`
- `tests/services/team.service.test.ts`
- `tests/commands/team.command.test.ts`

### Change Log

- Extended `ProfileLocation` union with `'self'` and `'contractor'` (2026-05-27)
- Added `EmailResolutionService` constructor injection to `TeamService` (2026-05-27)
- Added self + contractor resolution at step 5 in `showProfile()` via `EmailResolutionService.resolve()` (2026-05-27)
- Added `'self'` and `'contractor'` to `locationLabel` in `runShow()`; fixed `'relationship'` label (2026-05-27)

---

### Review Findings Round 1 (AI)

- [x] [Review][Decision] D_NEEDED-1 — Resolved with Option C: replaced `resolve()` call with direct `_fs.exists()` checks; self at step 0 (priority fix), contractor at step 5. Removed `EmailResolutionService` injection from `TeamService` — no longer needed. [src/services/team.service.ts]
- [x] [Review][Patch] P1 — Auto-resolved by Option C: `resolve()` is no longer called in `showProfile()`, eliminating the uncaught `InvalidEmailError` path. [src/services/team.service.ts]
- [x] [Review][Patch] P2 — `locationLabel` now typed as `Record<ProfileLocation, string>`; `ProfileLocation` imported in `team.command.ts`; `?? result.location` fallback removed. [src/commands/team.command.ts]
- [x] [Review][Patch] P3 — Added test `'outputs [Company member] label for relationship location'` to `team.command.test.ts`. [tests/commands/team.command.test.ts]
- [x] [Review][Patch] P4 — Auto-resolved: `DEFAULT_RESOLVED` constant containing the redundant template literal was removed as part of D_NEEDED-1 fix (mock scaffold no longer needed).
- [x] [Review][Defer] D1 — Auto-create side effect: `resolve()` at step 5 ghost-creates `my-company/members/<email>/` dirs + profile for truly unknown emails before returning null — deferred, tied to D_NEEDED-1 resolution; pre-existing `resolve()` behavior [src/services/team.service.ts:452]
- [x] [Review][Defer] D2 — TOCTOU: self/contractor file deleted between `resolve()` exists-check and `readFile()` — deferred, pre-existing pattern across codebase [src/services/team.service.ts:457]
- [x] [Review][Defer] D3 — TOCTOU race: concurrent relationship profile creation between step 4 check and step 5 `resolve()` call makes the new profile invisible — deferred, pre-existing architectural pattern [src/services/team.service.ts:448]
- [x] [Review][Defer] D4 — No test for self-priority scenario (user email also registered as a team member) — deferred, depends on D_NEEDED-1 resolution [tests/services/team.service.test.ts]

---

## Status

done
