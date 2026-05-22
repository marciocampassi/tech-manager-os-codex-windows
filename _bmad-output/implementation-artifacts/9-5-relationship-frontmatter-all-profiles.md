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
| `src/services/email-resolution.service.ts` | Add `relationship_type: 'company-member'` to auto-create shim frontmatter (step 4) — use `relationship` key to match standard |
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
