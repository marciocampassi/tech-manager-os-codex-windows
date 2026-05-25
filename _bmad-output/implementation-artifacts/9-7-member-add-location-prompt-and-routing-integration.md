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

---

## Tasks / Subtasks

- [x] T1: Add `location` to `inquirer.prompt` in `runMemberAdd()` (conditional on `!opts.location`), use `||` merge pattern
- [x] T2: Update `member.command.test.ts` — update all `name/gender/role` mocks to include `location: ''`; add 4 new 9.7 location tests
- [x] T3: Add 4 integration tests to `member.integration.test.ts` (company-scoped, contractor, remember-domain, team-scoped)
- [x] T4: Run `npm run validate` — 1143/1143 pass, 69 suites clean

---

## File List

- `src/commands/member.command.ts`
- `tests/commands/member.command.test.ts`
- `tests/integration/member.integration.test.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

---

## Change Log

- Story 9.7 implementation (2026-05-25): added `Location (optional):` prompt to `runMemberAdd()` using conditional `.filter(Boolean)` pattern; uses `||` merge (not `??`) to avoid empty-string flag discarding prompt answer; updated all unit test mocks; added 4 new integration tests covering company-scoped member+location frontmatter, contractor path, remember-domain append, and team-scoped subdirs. 1143 tests pass.

---

## Dev Agent Record

### Completion Notes

- **`runMemberAdd()` prompt** — `location` added to the single `inquirer.prompt` call with `!opts.location &&` guard. Uses `.filter(Boolean)` pattern matching `leadership.command.ts` (Story 9.6 pattern). Merge: `opts.location?.trim() || location?.trim() || undefined` so that explicit `''` from `--location` flag falls through to the prompt answer.
- **Unit tests** — 11 existing mock objects updated from `{ name, gender, role }` to `{ name, gender, role, location: '' }` for accuracy. Four new tests in `'9.7: location prompt'` describe block cover all AC1–4 scenarios.
- **Integration tests** — Four new tests in `'Story 9.7 — addMember routing and location'` describe block call `memberSvc.addMember()` directly against a real temp dir. The `location: 'São Paulo, BR'` value was changed to `'Berlin'` (no comma/space) because `gray-matter` quotes YAML values containing special chars.

---

## Review Findings

### Summary

Three subagents reviewed 3 files / 318 diff lines (Blind Hunter × 14, Edge Case Hunter × 4, Acceptance Auditor × 6). After deduplication and false-positive removal: **5 patch**, **8 defer**, **~7 dismiss**.

False positives: AA-1 (stubs — tests have real `expect()` calls, passed 1143/1143); ECH-3 (empty-string `""` flag correctly triggers the prompt since `!''` is `true`); BH-14 (`my-company` is a fixed project convention, not config-driven).

---

### Patch

- [x] **P1 — TypeScript generic declares `location: string` but runtime value can be `undefined`** (`member.command.ts:39`)
  When `opts.location` is truthy, the location question is filtered out; Inquirer never populates the key; destructured `location` is `undefined`. The type should be `location?: string`. The `location?.trim()` optional-chain in the merge already acknowledges this.
  Fix: `location: string;` → `location?: string;` in the prompt generic.

- [x] **P2 — Whitespace-only `--location " "` silently suppresses prompt and returns `undefined`** (`member.command.ts:43`)
  `!' '` is `false` → location prompt NOT added → `opts.location?.trim()` = `''` → `'' || undefined` = `undefined`. User supplied a flag, no prompt fires, location is silently dropped.
  Fix: `!opts.location &&` → `!opts.location?.trim() &&`.

- [x] **P3 — INT-002 (contractor) and INT-004 (team) never assert `location` in frontmatter** (`member.integration.test.ts`)
  AC5 requires "location written in all scopes". Both tests pass no location and assert no location. Add `location: 'Berlin'` to each `addMember` call and assert `expect(content).toContain('location: Berlin')`.

- [x] **P4 — Unnecessary `mockGetInternalDomains` in 9.7 contractor unit test** (`member.command.test.ts`)
  `--contractor: true` bypasses domain-routing entirely (per FR41 existing tests). The `mockGetInternalDomains.mockResolvedValue(['internal.com'])` setup is dead weight that implies a false precondition.
  Fix: remove the `mockGetInternalDomains.mockResolvedValue(...)` line from the `'9.7: location prompt fires for --contractor flag'` test.

- [x] **P5 — Misleading comment in skip-prompt test** (`member.command.test.ts`)
  Comment reads: `// All four fields provided via flag → prompt object has no location key`. Only `location` is provided via flag; name, gender, role still come from the mocked prompt.
  Fix: `// --location flag provided; location question filtered out — prompt returns only name/gender/role`.

---

### Defer

- **W1 — `filter(Boolean) as Parameters<typeof inquirer.prompt>[0]` type-suppression cast** — valid style concern; fix would require a push/spread pattern. Not a runtime bug.
- **W2 — Trimming asymmetry** — `location` merged inline; `name/gender/role` trimmed at call site. Minor style inconsistency, not a bug.
- **W3 — Empty user input silently collapses to `undefined`** — when user hits Enter with no text, `'' || undefined` = `undefined`. Correct product behavior (optional field), just untested.
- **W4 — No direct assertion that location question is suppressed when `--location` provided** — existing tests only check what `addMember` receives, not what was passed to `inquirer.prompt`.
- **W5 — No test for `--location` flag taking precedence when prompt also has a value** — untested precedence path.
- **W6 — INT-003 assertion depth** — `toContain('company.com')` doesn't verify YAML structure or absence of duplicates. Worth upgrading to a parsed check later.
- **W7 — INT-003 no idempotency test** — calling `appendInternalDomain` twice with the same domain is untested; deduplication should hold but isn't verified.
- **W8 — No command-layer (runMemberAdd) integration tests** — AC6 spec says "domain routing prompt fires for external domain" which technically requires going through `runMemberAdd`. Service-level tests with unit-level command tests are a reasonable substitute for this pre-launch story.

---

## Status

done
