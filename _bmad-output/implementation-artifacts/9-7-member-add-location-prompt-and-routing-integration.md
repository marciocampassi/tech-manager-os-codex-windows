# Story 9.7 — tmr member add: Location Prompt + Domain Routing Integration Test

## Metadata

| Field | Value |
|---|---|
| **Epic** | Epic 9 — UAT Pre-Launch Polish |
| **Story ID** | 9.7 |
| **Priority** | Medium |
| **Depends on** | 9.1 (nested paths), 9.4 (remember domain) |
| **Effort** | XS |
| **Risk** | Low — additive prompt only |

---

## Problem Statement

`tmr member add <email>` accepts `--location` as a flag but never interactively prompts for it when the flag is omitted. Members created post-init end up with an empty `location` frontmatter field even though the user would supply it if asked. This is inconsistent with the `tmr init` member collection loop which always asks for location.

Additionally, after Stories 9.1 and 9.4 land, there is no integration test covering the full `tmr member add` flow end-to-end (nested path creation + subdir scaffolding + domain routing + remember-domain offer). This story adds that test.

---

## Acceptance Criteria

- `tmr member add <email>` (no `--location` flag) prompts: `Location (optional):`
- `tmr member add <email> --team <name>` (no `--location` flag) prompts: `Location (optional):`
- `tmr member add <email> --location "Berlin"` skips the prompt and uses the flag value
- `tmr member add <email> --contractor` prompts for location
- Location value is written to the `location` frontmatter field in all scopes
- Integration test covers: company-scoped member creation with nested folder, all four subdirs present, domain routing prompt fires for external domain, "remember domain" updates `organization.yaml`
- All tests pass

---

## Files to Change

| File | Change |
|---|---|
| `src/commands/member.command.ts` | Add `location` to secondary prompts in `runMemberAdd()` for all creation paths |
| `tests/integration/member.integration.test.ts` | New integration test covering full add flow post-9.1/9.4 |

---

## Implementation Detail

### `runMemberAdd()` — add location prompt

In the member-creation branch (where `isEmail(typeArg)` is true), add `location` to the `inquirer.prompt` call alongside `name`, `gender`, `role`:

**Before:**
```typescript
const { name, gender, role } = await inquirer.prompt<{
  name: string;
  gender: string;
  role: string;
}>([
  { type: 'input', name: 'name', message: 'Name (optional):' },
  { type: 'input', name: 'gender', message: 'Gender (optional):' },
  { type: 'input', name: 'role', message: 'Role (optional):' },
]);
```

**After:**
```typescript
const { name, gender, role, location } = await inquirer.prompt<{
  name: string;
  gender: string;
  role: string;
  location: string;
}>([
  { type: 'input', name: 'name', message: 'Name (optional):' },
  { type: 'input', name: 'gender', message: 'Gender (optional):' },
  { type: 'input', name: 'role', message: 'Role (optional):' },
  !opts.location && { type: 'input', name: 'location', message: 'Location (optional):' },
].filter(Boolean) as Parameters<typeof inquirer.prompt>[0]);
```

Pass `location` to `addMember()`:
```typescript
result = await svc.addMember(email, {
  team: opts.team,
  location: opts.location?.trim() || location?.trim() || undefined,
  contractor: isContractor,
  name: name.trim() || undefined,
  gender: gender.trim() || undefined,
  role: role.trim() || undefined,
}, ws);
```

---

## Integration Test Coverage

`tests/integration/member.integration.test.ts` — new test cases (use real temp dir, no mocks):

1. **Company-scoped member creation (internal domain)**
   - Setup: write `config/organization.yaml` with `internal_domains: [company.com]`; mock inquirer responses for name/role/gender/location
   - Run: `tmr member add user@company.com`
   - Assert: `my-company/members/user@company.com/user@company.com.md` exists
   - Assert: `1on1s/`, `feedbacks/`, `assessments/`, `performance-reviews/` dirs exist
   - Assert: frontmatter contains `relationship: company-member`, `location: <value>`

2. **External domain routing — contractor path**
   - Setup: `organization.yaml` with `company.com`; mock routing choice = contractor; mock remember = N
   - Run: `tmr member add ext@partner.com`
   - Assert: `my-company/contractors/ext@partner.com/ext@partner.com.md` exists
   - Assert: frontmatter contains `relationship: contractor`
   - Assert: `organization.yaml` unchanged

3. **External domain routing — company path + remember domain**
   - Setup: `organization.yaml` with `company.com`; mock routing choice = member; mock remember = Y
   - Run: `tmr member add ext@partner.com`
   - Assert: `my-company/members/ext@partner.com/ext@partner.com.md` exists
   - Assert: `organization.yaml` now contains `partner.com`

4. **Team-scoped member creation**
   - Setup: `organization.yaml` with `company.com`; mock responses
   - Run: `tmr member add user@company.com --team backend`
   - Assert: `my-teams/members/user@company.com/user@company.com.md` exists
   - Assert: all four subdirs + `user@company.com-shared/` exist
   - Assert: frontmatter contains `relationship: direct-report`

---

## Notes for Developer Agent

- The `!opts.location &&` conditional in the prompt array follows the existing pattern used for `name`/`role`/`gender` in `leadership.command.ts` — be consistent.
- Integration tests use real `FileSystemService` on a temp directory (see `tests/integration/` for the established pattern).
- Run `npm run validate` before marking done.
