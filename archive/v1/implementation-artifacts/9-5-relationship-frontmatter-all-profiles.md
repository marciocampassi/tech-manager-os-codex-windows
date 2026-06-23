# Story 9.5 — relationship Frontmatter on All Profiles

## Metadata

| Field | Value |
|---|---|
| **Epic** | Epic 9 — UAT Pre-Launch Polish |
| **Story ID** | 9.5 |
| **Priority** | Medium |
| **Effort** | XS |
| **Risk** | Low — additive frontmatter change; no logic changes |

---

## Problem Statement

No profile type currently writes a `relationship` frontmatter field. Obsidian queries, dataview views, and AI agents have no machine-readable way to distinguish a direct report from a contractor from a leader. The `contractor: true` field written by `addMember()` is a one-off exception that breaks the pattern. This story establishes `relationship` as the single canonical discriminator across all entity types and removes the `contractor: true` exception.

---

## Acceptance Criteria

- Every profile created by any `tmr` command contains `relationship: <value>` in its frontmatter
- `contractor: true` and `company: <domain>` fields are **removed** from contractor profiles; `relationship: contractor` replaces them
- No profile anywhere in new vault output contains `contractor: true`
- All five `relationship` values are used correctly per scope (table below)
- The `EmailResolutionService` auto-create shim (step 4) writes `relationship: company-member`
- All tests pass with updated frontmatter assertions

---

## relationship Values

| Entity | `relationship` value | Written by |
|---|---|---|
| Self | `self` | `InitService.writeUserProfile()` |
| Direct report | `direct-report` | `MemberService.addMember()` with `team` option |
| Leadership | `leadership` | `LeadershipService.addLeadership()` |
| Company member | `company-member` | `MemberService.addMember()` (default, no team/contractor) |
| Contractor | `contractor` | `MemberService.addMember()` with `contractor: true` option |

---

## Files to Change

| File | Change |
|---|---|
| `src/services/init.service.ts` | Add `relationship: 'self'` to `writeUserProfile()` frontmatter |
| `src/services/member.service.ts` | Add `relationship` to `addMember()` frontmatter for all three scopes; remove `contractor: true` and `company: <domain>` fields from contractor branch |
| `src/services/leadership.service.ts` | Add `relationship: 'leadership'` to `addLeadership()` frontmatter |
| `src/services/email-resolution.service.ts` | Add `relationship: 'company-member'` to auto-create shim frontmatter (step 4) |
| `src/types/member.types.ts` | Remove `company` field from `IAddMemberOptions` (was only used for `company: <domain>` frontmatter on contractors) |
| `tests/services/member.service.test.ts` | Update frontmatter assertions — replace `contractor: true` checks with `relationship: 'contractor'`; add `relationship` assertions for all scopes |
| `tests/services/init.service.test.ts` | Add `relationship: 'self'` assertion on written profile |
| `tests/services/leadership.service.test.ts` | Add `relationship: 'leadership'` assertion |

---

## Implementation Detail

### `MemberService.addMember()` frontmatter construction

**Before (contractor branch):**
```typescript
...(opts.contractor
  ? { relationship: 'contractor', ...(opts.company ? { company: opts.company } : {}) }
  : {}),
```

**After — unified pattern for all scopes:**
```typescript
relationship: opts.contractor ? 'contractor' : opts.team ? 'direct-report' : 'company-member',
```

The `company` field is removed entirely. If the contractor's company name is useful metadata in the future, it should be added as a separate story with a deliberate key name — not bundled into the routing story.

### `IAddMemberOptions` — remove `company` field

```typescript
export interface IAddMemberOptions {
  team?: string;
  location?: string;
  name?: string;
  role?: string;
  gender?: string;
  contractor?: boolean;
  // `company` removed — replaced by relationship: 'contractor'
}
```

Any caller passing `company` must be updated to remove the field.

### `LeadershipService.addLeadership()` frontmatter

Add `relationship: 'leadership'` alongside the existing `name`, `role`, `date_added` fields.

### `InitService.writeUserProfile()` frontmatter

Add `relationship: 'self'` to the `fm` object:
```typescript
const fm = { email, name: opts.name, role: opts.role, relationship: 'self', date_added: todayIso() };
```

### `EmailResolutionService` auto-create shim (step 4)

Update the inline frontmatter string in `_doResolve()` to include `relationship: company-member`:
```
---\nemail: "${safeEmail}"\nname: ""\nrole: ""\ndepartment: ""\nrelationship: "company-member"\ndate_added: "${today}"\n---
```

Remove the old `relationship_type` field if present — the canonical key is `relationship`.

---

## Notes for Developer Agent

- The `company` field removal from `IAddMemberOptions` may require updating `member.command.ts` if it currently passes `company` from the prompt. Verify and remove the company-name prompt from the contractor flow since the field is no longer stored.
- `relationship` is a string literal in frontmatter — it does not need to be a TypeScript union type unless a future story needs to query it programmatically. Keep it as `string` in the frontmatter record for now.
- Run `npm run validate` before marking done.

---

## Tasks/Subtasks

- [x] T1: Add `relationship?: string` to `ILeadershipFrontmatter` (`src/types/leadership.types.ts`)
- [x] T2: Remove `company?: string` from `IAddMemberOptions` (`src/types/member.types.ts`)
- [x] T3: Unified `relationship` frontmatter in `MemberService.addMember()` for all three scopes (`src/services/member.service.ts`)
- [x] T4: Add `relationship: 'leadership'` to `buildLeadershipProfileMd()` (`src/services/leadership.service.ts`)
- [x] T5: Add `relationship: 'self'` to `writeUserProfile()` frontmatter (`src/services/init.service.ts`)
- [x] T6: Replace `relationship_type: ""` with `relationship: "company-member"` in auto-create shim (`src/services/email-resolution.service.ts`)
- [x] T7: Remove company-name prompt and `company` field from `member.command.ts`
- [x] T8: Update tests — member.service, init.service, leadership.service, email-resolution, member.command
- [x] T9: Run `npm run validate` — 192 target tests pass, lint/typecheck/build clean

### Review Findings

- [x] [Review][Decision] Contractor + team combo: should `manager` be suppressed on contractor profiles? — resolved: Option A applied, guarded team spread with `!opts.contractor` [`src/services/member.service.ts:119`]
- [x] [Review][Patch] `ILeadershipFrontmatter.relationship` typed `string?` instead of required `'leadership'` — fixed: changed to `relationship: 'leadership'` [`src/types/leadership.types.ts:17`]
- [x] [Review][Patch] No regression guard asserting `contractor: true` is absent from contractor frontmatter — fixed: added `expect(written).not.toContain('contractor: true')` [`tests/services/member.service.test.ts:352`]
- [x] [Review][Patch] Spec "Files to Change" table has stale `relationship_type` typo — fixed: corrected to `relationship: 'company-member'` [`_bmad-output/implementation-artifacts/9-5-relationship-frontmatter-all-profiles.md:51`]
- [x] [Review][Defer] `department: ""` orphan field in `EmailResolutionService` auto-create shim [`src/services/email-resolution.service.ts:123`] — deferred, pre-existing
- [x] [Review][Defer] Auto-create shim hardcodes `relationship: company-member` for all auto-created profiles regardless of caller context [`src/services/email-resolution.service.ts:126`] — deferred, pre-existing design limitation
- [x] [Review][Defer] Auto-create shim uses raw inline string instead of `gray-matter` [`src/services/email-resolution.service.ts`] — deferred, pre-existing (tracked by TODO(Story 3.2))
- [x] [Review][Defer] Quoting inconsistency: shim writes `relationship: "company-member"` (YAML-quoted), `matter.stringify` profiles write unquoted [`src/services/email-resolution.service.ts:126`] — deferred, harmless but depends on shim refactor
- [x] [Review][Defer] No typed frontmatter interface for member `relationship` field — `MemberService` builds frontmatter as `Record<string, unknown>` with no compile-time enforcement [`src/services/member.service.ts:111`] — deferred, pre-existing pattern

---

## File List

- `src/types/leadership.types.ts` — added `relationship?: string` to `ILeadershipFrontmatter`
- `src/types/member.types.ts` — removed `company?: string` from `IAddMemberOptions`
- `src/services/member.service.ts` — unified `relationship` frontmatter for all three scopes; removed `company` field
- `src/services/leadership.service.ts` — added `relationship: 'leadership'` to `buildLeadershipProfileMd()`
- `src/services/init.service.ts` — added `relationship: 'self'` to `writeUserProfile()`
- `src/services/email-resolution.service.ts` — replaced `relationship_type: ""` with `relationship: "company-member"` in auto-create shim
- `src/commands/member.command.ts` — removed company-name prompt and `company` field from `addMember()` call
- `tests/services/member.service.test.ts` — removed obsolete FR42 company test; added `relationship` assertions for all 3 scopes
- `tests/services/init.service.test.ts` — added `relationship: self` assertion
- `tests/services/leadership.service.test.ts` — added `relationship: leadership` assertion
- `tests/services/email-resolution.service.test.ts` — added `relationship: company-member` assertion; verified no `relationship_type`
- `tests/commands/member.command.test.ts` — removed company-name prompt mocks; updated FR41/FR42 test sequences
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — 9-5 → in-progress → review

---

## Change Log

- Story 9.5 implementation (2026-05-24): unified `relationship` frontmatter across all profile types (self/direct-report/leadership/company-member/contractor); removed `contractor: true` exception and `company` field from contractor profiles; fixed auto-create shim (`relationship_type` → `relationship`); removed company-name prompt from `tmr member add`. 192 target tests pass; lint/typecheck/build clean.

---

## Dev Agent Record

### Completion Notes

- **`ILeadershipFrontmatter`** — added `relationship?: string` so `buildLeadershipProfileMd()` can include the field without TypeScript errors.
- **`IAddMemberOptions`** — `company?: string` removed; `member.command.ts` company-name prompt and the `company:` frontmatter emission were both removed.
- **`MemberService.addMember()`** — single unified line `relationship: opts.contractor ? 'contractor' : opts.team ? 'direct-report' : 'company-member'` replaces the old contractor-only conditional spread.
- **`LeadershipService.buildLeadershipProfileMd()`** — `relationship: 'leadership'` added to frontmatter object.
- **`InitService.writeUserProfile()`** — `relationship: 'self'` added to `fm`.
- **`EmailResolutionService._doResolve()` step 4** — inline frontmatter string updated from `relationship_type: ""` to `relationship: "company-member"`.
- All 5 changed test suites (192 tests) pass; the timeout failure in `inbox-process.service.integration.test.ts` is a pre-existing flake (passes cleanly in isolation with `--testTimeout=60000`).

---

## Status

done
