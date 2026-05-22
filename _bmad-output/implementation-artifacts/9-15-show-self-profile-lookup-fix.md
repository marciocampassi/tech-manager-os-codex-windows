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
