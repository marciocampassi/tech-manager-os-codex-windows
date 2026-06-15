# Story 9.1 — Unify Entity Resolution & Enforce Nested Folder Pattern

## Metadata

| Field | Value |
|---|---|
| **Epic** | Epic 9 — UAT Pre-Launch Polish |
| **Story ID** | 9.1 |
| **Priority** | Critical — foundation for all member/entity stories in Epic 9 |
| **Effort** | M |
| **Risk** | Medium — changes path generation in MemberService; existing tests must be updated |

---

## Problem Statement

`MemberService.addMember()` writes **flat** profile paths (`my-company/members/<email>.md`, `my-teams/members/<email>.md`) but `EmailResolutionService._doResolve()` looks for **nested** paths (`my-company/members/<email>/<email>.md`, `my-teams/members/<email>/<email>.md`). Entities created by `addMember()` are invisible to the resolution service. `MemberService.findMemberGlobally()` exists only to patch over this inconsistency by checking both flat and nested forms. This divergence is the root cause of most member-related UAT issues.

Additionally, `MemberService.createMember()` is a partial duplicate of `addMember()` with `--team` that pre-dates the unified path convention, adding further confusion.

Both `findMemberGlobally()` and `createMember()` must be **deleted** (not deprecated) to eliminate any ambiguity about the correct call path.

---

## Acceptance Criteria

- `tmr member add user@company.com` creates `my-company/members/user@company.com/user@company.com.md` with subdirs `1on1s/`, `feedbacks/`, `assessments/`, `performance-reviews/`
- `tmr member add user@company.com --team backend` creates `my-teams/members/user@company.com/user@company.com.md` with same four subdirs plus `user@company.com-shared/`
- `tmr member add contractor@partner.com --contractor` creates `my-company/contractors/contractor@partner.com/contractor@partner.com.md` with subdirs `1on1s/`, `feedbacks/`, `assessments/`, `performance-reviews/`
- `EmailResolutionService.resolve(email, ws)` finds entities created by `addMember()` across all three scopes without any intermediate lookup
- `EmailResolutionService.resolve()` returns `type: 'contractor'` for emails resolved under `my-company/contractors/`
- `MemberService.findMemberGlobally()` does **not exist** in the codebase
- `MemberService.createMember()` does **not exist** in the codebase
- All callers that referenced either deleted method have been updated
- All existing tests pass with path assertions updated to nested form
- New resolution test covers the contractor scope (type: 'contractor')

---

## Files to Change

| File | Change |
|---|---|
| `src/services/member.service.ts` | Fix `addMember()` paths to nested; delete `findMemberGlobally()`; delete `createMember()`; add TODO comment on `_resolveManagerLink()` for Story 9.3 |
| `src/services/email-resolution.service.ts` | Add contractor resolution step (3.5) to `_doResolve()`; add TODO comment on self-profile path for Story 9.3 |
| `src/types/email-resolution.types.ts` | Add `'contractor'` to `IEntityLocation.type` union; update JSDoc resolution order |
| `src/types/member.types.ts` | Remove `ICreateMemberOptions` (used only by deleted `createMember()`); keep `IAddMemberOptions`, `ICreateFileOptions`, `ICreateFileResult`, `FILE_TYPE_CONFIG` |
| `tests/services/member.service.test.ts` | Update all flat-path assertions to nested; remove tests for `findMemberGlobally()` and `createMember()`; add tests for new nested subdir creation across all scopes |
| `tests/services/email-resolution.service.test.ts` | Add contractor resolution test case |
| Any other file importing `findMemberGlobally` or `createMember` | Update to use `EmailResolutionService.resolve()` and `addMember()` respectively |

---

## Implementation Detail

### 1 — `MemberService.addMember()` path fix

**Before (company scope):**
```typescript
path.join(workspaceRoot, 'my-company', 'members', `${normalizedEmail}.md`)
```

**After (company scope):**
```typescript
path.join(workspaceRoot, 'my-company', 'members', normalizedEmail, `${normalizedEmail}.md`)
```

**Before (team scope):**
```typescript
path.join(workspaceRoot, 'my-teams', 'members', `${normalizedEmail}.md`)
```

**After (team scope):**
```typescript
path.join(workspaceRoot, 'my-teams', 'members', normalizedEmail, `${normalizedEmail}.md`)
```

Contractor scope path is already correct — no change needed:
```typescript
path.join(workspaceRoot, 'my-company', 'contractors', normalizedEmail, `${normalizedEmail}.md`)
```

### 2 — Subdir scaffolding in `addMember()`

After computing `profilePath`, derive `entityDir = path.dirname(profilePath)` and create all applicable subdirs before writing the profile file:

| Scope | Subdirs |
|---|---|
| Company | `1on1s/`, `feedbacks/`, `assessments/`, `performance-reviews/` |
| Team | `1on1s/`, `feedbacks/`, `assessments/`, `performance-reviews/`, `<email>-shared/` |
| Contractor | `1on1s/`, `feedbacks/`, `assessments/`, `performance-reviews/` |

Replace the existing `await this._fs.createDirectory(path.dirname(profilePath))` call with explicit subdir creation for each scope.

### 3 — `createMemberFile()` — replace `findMemberGlobally()` with `EmailResolutionService.resolve()`

`createMemberFile()` currently:
```typescript
let profilePath = await this.findMemberGlobally(normalizedEmail, workspaceRoot);
if (!profilePath) {
  await this.addMember(normalizedEmail, {}, workspaceRoot);
  profilePath = path.join(workspaceRoot, 'my-company', 'members', `${normalizedEmail}.md`);
}
```

After:
```typescript
const resolution = await emailResolutionService.resolve(normalizedEmail, workspaceRoot);
const profilePath = resolution.absolutePath;
// resolution.created === true means auto-create happened (company-scoped)
```

`MemberService` must import `emailResolutionService` from `email-resolution.service.js`. Inject as constructor parameter to keep the class testable (pass mock in tests).

### 4 — `EmailResolutionService._doResolve()` — add contractor step

Insert between step 3 (relationship/company-member) and step 4 (auto-create):

```typescript
// 3.5. Contractor
const contractorProfile = path.join(ws, 'my-company', 'contractors', email, `${email}.md`);
if (await this._fs.exists(contractorProfile)) {
  return { type: 'contractor', absolutePath: contractorProfile, created: false };
}
```

Add `// TODO(Story 9.3): update self-profile path from my-career/<email>/<email>.md to my-career/<email>.md` comment on step 2.5 to flag the upcoming flat-structure change.

### 5 — Delete `findMemberGlobally()` and `createMember()`

Remove both methods and their TypeScript signatures entirely. Do not leave stub or `@deprecated` JSDoc — removal is the contract.

Remove `ICreateMemberOptions` from `member.types.ts` since it is only used by the deleted method.

Add `// TODO(Story 9.3): update _resolveManagerLink to read flat my-career/<email>.md after Story 9.3 lands` on `_resolveManagerLink`.

### 6 — `IEntityLocation` type update

```typescript
export interface IEntityLocation {
  type: 'team' | 'leadership' | 'self' | 'relationship' | 'contractor';
  absolutePath: string;
  created: boolean;
}
```

Update JSDoc block to document all five resolution steps including 3.5.

---

## Test Coverage

### `tests/services/member.service.test.ts`

Remove:
- All tests for `findMemberGlobally()`
- All tests for `createMember()`
- All flat-path assertions (`my-company/members/<email>.md`, `my-teams/members/<email>.md`)

Add / update:
- `addMember()` company scope: assert profile at `my-company/members/<email>/<email>.md`
- `addMember()` company scope: assert `1on1s/`, `feedbacks/`, `assessments/`, `performance-reviews/` dirs created
- `addMember()` team scope: assert profile at `my-teams/members/<email>/<email>.md` + all four subdirs + `<email>-shared/`
- `addMember()` contractor scope: assert profile at `my-company/contractors/<email>/<email>.md` + all four subdirs
- `createMemberFile()`: assert it routes through `EmailResolutionService.resolve()` (mock the service in the constructor)

### `tests/services/email-resolution.service.test.ts`

Add:
- Contractor resolution: create `my-company/contractors/user@x.com/user@x.com.md`, call `resolve('user@x.com', ws)`, assert `{ type: 'contractor', created: false }`

---

## Notes for Developer Agent

- `MemberService` constructor currently takes `(FileSystemService, SectionParserService, TemplateService)`. Add `EmailResolutionService` as a fourth constructor parameter with the singleton as default: `private readonly _emailResolver: EmailResolutionService = emailResolutionService`.
- The module-level singleton `export const memberService = new MemberService(...)` must be updated to pass `emailResolutionService` as the fourth argument.
- Circular dependency risk: `MemberService` importing `EmailResolutionService` and vice versa. Verify no circular import exists before merging. If one exists, pass the resolver via method parameter instead of constructor.
- `member.command.ts` uses `chalk` directly (`chalk.dim`, `chalk.green`) — this is a pre-existing lint warning. Do NOT fix it in this story to keep the diff minimal; file a separate cleanup note.
- Run `npm run validate` (lint + typecheck + test + build) before marking done.

---

## File List

- `src/services/member.service.ts` — MODIFIED
- `src/services/email-resolution.service.ts` — MODIFIED
- `src/types/email-resolution.types.ts` — MODIFIED
- `src/types/member.types.ts` — MODIFIED
- `tests/services/member.service.test.ts` — MODIFIED
- `tests/services/email-resolution.service.test.ts` — MODIFIED
- `tests/integration/member.integration.test.ts` — MODIFIED
- `tests/commands/member.command.test.ts` — MODIFIED

---

## Change Log

- 2026-05-24: Implemented story 9.1 — unified entity resolution and enforced nested folder pattern across all member scopes

---

## Dev Agent Record

### Completion Notes

All ACs satisfied. `npm run validate` passed: 1098 tests, 0 failures, build success.

- `MemberService.addMember()` now writes nested paths for company (`my-company/members/<e>/<e>.md`) and team (`my-teams/members/<e>/<e>.md`) scopes; contractor scope was already correct.
- All three scopes scaffold `1on1s/`, `feedbacks/`, `assessments/`, `performance-reviews/` subdirs on creation; team scope additionally creates `<email>-shared/`.
- `MemberService.createMemberFile()` now delegates profile lookup to injected `EmailResolutionService` (constructor arg with singleton default) — eliminates `findMemberGlobally()`.
- `MemberService.findMemberGlobally()` deleted entirely.
- `MemberService.createMember()` deleted entirely.
- `ICreateMemberOptions` removed from `member.types.ts`.
- `EmailResolutionService._doResolve()` gained step 3.5 for contractor scope; TODO(Story 9.3) comment added to step 2.5.
- `IEntityLocation.type` extended with `'contractor'`; JSDoc updated to document all 5 resolution steps.
- No circular import: `MemberService` → `EmailResolutionService` is one-directional. Verified.
- Unit tests rewritten with mock `EmailResolutionService`; 3 new subdir-creation tests added (MEM-UNIT-014/015/016); `findMemberGlobally` and `createMember` test blocks removed.
- Integration tests updated from flat-path to nested-path assertions.
- Command test cleaned of `createMember` mock.

---

## Review Findings

- [x] [Review][Patch] `_doResolve()` step 4 missing 3 subdirs — auto-create scaffolds only `1on1s/`, missing `feedbacks/`, `assessments/`, `performance-reviews/` [src/services/email-resolution.service.ts:118] ✓ fixed
- [x] [Review][Defer] Legacy flat profiles invisible to resolution [src/services/email-resolution.service.ts:_doResolve()] — deferred, pre-existing migration gap
- [x] [Review][Defer] Legacy flat team profile auto-creates as company relationship [src/services/email-resolution.service.ts:_doResolve() step 4] — deferred, pre-existing migration gap
- [x] [Review][Defer] `feedbacks/` scaffold vs `feedback/` write path mismatch [src/services/member.service.ts:addMember()] — deferred, explicit design decision (spec uses `feedbacks/` for scaffold; `FILE_TYPE_CONFIG` uses `feedback/` for file writes; different vault purposes)
- [x] [Review][Defer] Stale resolution cache after filesystem changes [src/services/email-resolution.service.ts:resolve()] — deferred, pre-existing design
- [x] [Review][Defer] `addMember()` only checks target scope, cross-scope duplicate risk [src/services/member.service.ts:addMember()] — deferred, pre-existing (logged story 3.2)
- [x] [Review][Defer] Relationship profile shadows contractor at same email [src/services/email-resolution.service.ts:_doResolve() steps 3/3.5] — deferred, data-error edge case requiring dual-existence
- [x] [Review][Defer] Concurrent `addMember()` silent overwrite [src/services/member.service.ts:addMember()] — deferred, pre-existing TOCTOU (logged story 3.2)
- [x] [Review][Defer] Leading/trailing whitespace in email not trimmed at service layer [src/services/member.service.ts:addMember()] — deferred, pre-existing (logged story 3.2)
- [x] [Review][Defer] Concurrent `resolve()` auto-create races [src/services/email-resolution.service.ts:_doResolve() step 4] — deferred, pre-existing TOCTOU
- [x] [Review][Defer] `memberSubDirFromProfile` flat-path branch unreachable via new resolution [src/services/member.service.ts:memberSubDirFromProfile()] — deferred, dead code, no functional impact
- [x] [Review][Defer] `findMember` team-only scope silently misses company/contractor members [src/services/member.service.ts:findMember()] — deferred, unchanged behavior from pre-9.1
- [x] [Review][Defer] `findMember` constructs path without input validation [src/services/member.service.ts:findMember()] — deferred, pre-existing caller-validates pattern
- [x] [Review][Defer] MEM-INT-004 does not assert subdir creation [tests/integration/member.integration.test.ts:284–309] — deferred, test gap

---

## Status

done
