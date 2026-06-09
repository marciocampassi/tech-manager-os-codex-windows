# Story 9.22: Remove Duplicate Company Domain Prompt from `tmr init`

Status: ready-for-dev

## Story

As a user running `tmr init`,  
I want to be asked about my company domain only once,  
So that the setup flow is concise and not confusing.

## Acceptance Criteria

**AC1:** Given the user runs `tmr init` and provides their work email,  
When the prompt sequence runs,  
Then the "Your company / domain" question does NOT appear  
And `company` in the config is set to the domain inferred from the user's email  
And all downstream consumers of `answers.company` (`configService.set('company_domain', ...)` and `generateClaudeMd(answers)`) receive the correct inferred domain.

## Tasks / Subtasks

- [ ] Task 1 — Shrink `RoleAndCompanyAnswers` + `promptRoleAndCompany` (AC: 1)
  - [ ] Remove `company: string` from `RoleAndCompanyAnswers` interface in `src/workflows/onboarding.prompts.ts`
  - [ ] Remove the `company` prompt question from the `inquirer.prompt` array in `promptRoleAndCompany()`
  - [ ] Return type stays `Promise<RoleAndCompanyAnswers>` — just the slimmed interface

- [ ] Task 2 — Derive `company` from `inferredDomain` in `InitCommand.run()` (AC: 1)
  - [ ] In `src/commands/init.command.ts`, update the `answers` construction to add `company: inferredDomain` explicitly
  - [ ] `inferredDomain` is ALREADY computed on the line before (`nameEmail.email.split('@')[1] ?? ''`) — do NOT recompute it

- [ ] Task 3 — Update `init.command.test.ts` mocks (AC: 1)
  - [ ] In `setupMinimalHappyPath()`: change mock call #4 from `{ role: '...', company: '...' }` to `{ role: '...' }` (remove `company` field)
  - [ ] In `setupScaffoldFailure()`: same change to its mock call #4
  - [ ] Update the comment on line 287 to remove "company" from the per-call description if it's listed

- [ ] Task 4 — Add `promptRoleAndCompany` unit tests to `onboarding.prompts.test.ts` (AC: 1)
  - [ ] Import `promptRoleAndCompany` in the dynamic import block
  - [ ] Add a describe block: verifies the function returns `{ role }` only
  - [ ] Add a test: the mock is called once
  - [ ] Add a test: verifies there is no `company` field in the result

## Dev Notes

### Exact Code Changes

**`src/workflows/onboarding.prompts.ts`** — two edits:

```typescript
// OLD interface (lines 283-286):
export interface RoleAndCompanyAnswers {
  role: string;
  company: string;
}

// NEW interface:
export interface RoleAndCompanyAnswers {
  role: string;
}
```

```typescript
// OLD promptRoleAndCompany (lines 323-340):
export async function promptRoleAndCompany(): Promise<RoleAndCompanyAnswers> {
  return inquirer.prompt<RoleAndCompanyAnswers>([
    {
      type: 'input',
      name: 'role',
      message: 'Your current role / title:',
      validate: (v: string): ValidateResult =>
        v.trim().length > 0 ? true : 'Role cannot be empty',
    },
    {
      type: 'input',
      name: 'company',
      message: 'Your company / domain (e.g. acme.com):',
      validate: (v: string): ValidateResult =>
        v.trim().length > 0 ? true : 'Company cannot be empty',
    },
  ]);
}

// NEW promptRoleAndCompany — only role, no company:
export async function promptRoleAndCompany(): Promise<RoleAndCompanyAnswers> {
  return inquirer.prompt<RoleAndCompanyAnswers>([
    {
      type: 'input',
      name: 'role',
      message: 'Your current role / title:',
      validate: (v: string): ValidateResult =>
        v.trim().length > 0 ? true : 'Role cannot be empty',
    },
  ]);
}
```

**`src/commands/init.command.ts`** — one edit (lines 77-81):

```typescript
// OLD:
const roleCompany = await promptRoleAndCompany();
const answers: { name: string; email: string; role: string; company: string } = {
  ...nameEmail,
  ...roleCompany,
};

// NEW — company derived from already-computed inferredDomain (line 75):
const roleCompany = await promptRoleAndCompany();
const answers: { name: string; email: string; role: string; company: string } = {
  ...nameEmail,
  ...roleCompany,
  company: inferredDomain,
};
```

`inferredDomain` is computed two lines earlier on line 75:
```typescript
const inferredDomain = nameEmail.email.split('@')[1] ?? '';
```
Do NOT recompute it. Just reference the existing variable.

### DO NOT touch `promptMinimalOnboarding`

`promptMinimalOnboarding()` (lines 342-379) still has a `company` field — this is a **separate legacy function** used outside the main `InitCommand.run()` path. Do NOT modify it. Only `promptRoleAndCompany` and `RoleAndCompanyAnswers` change.

### Test Mocks — Exact Pattern

`tests/commands/init.command.test.ts` has **two** places that mock `promptRoleAndCompany`:

1. `setupMinimalHappyPath()` — call #4 (line 128):
```typescript
// OLD:
.mockResolvedValueOnce({ role: 'Engineering Manager', company: 'example.com' })
// NEW:
.mockResolvedValueOnce({ role: 'Engineering Manager' })
```

2. `setupScaffoldFailure()` — its call #4 (line 446):
```typescript
// OLD:
.mockResolvedValueOnce({ role: 'Engineering Manager', company: 'example.com' })
// NEW:
.mockResolvedValueOnce({ role: 'Engineering Manager' })
```

**Prompt count stays 12** — `promptRoleAndCompany` is still ONE `inquirer.prompt()` call; it just has fewer questions inside. The test `expect(mockPrompt).toHaveBeenCalledTimes(12)` does NOT need a count change.

**CLAUDE.md company test still passes** — `answers.company` becomes `inferredDomain` = `'example.com'` (inferred from `alice@example.com`). The assertion `expect(claudeCall[1]).toContain('example.com')` remains valid.

### New Tests for `tests/workflows/onboarding.prompts.test.ts`

Add `promptRoleAndCompany` to the dynamic import:
```typescript
const {
  promptWorkspacePath,
  // ... existing imports ...
  promptRoleAndCompany,           // ADD THIS
} = await import('../../src/workflows/onboarding.prompts.js');
```

Add describe block:
```typescript
describe('promptRoleAndCompany', () => {
  it('returns only role field (no company)', async () => {
    mockPrompt.mockResolvedValueOnce({ role: 'Engineering Manager' });
    const result = await promptRoleAndCompany();
    expect(result).toEqual({ role: 'Engineering Manager' });
    expect('company' in result).toBe(false);
  });

  it('calls inquirer.prompt exactly once', async () => {
    mockPrompt.mockResolvedValueOnce({ role: 'Lead' });
    await promptRoleAndCompany();
    expect(mockPrompt).toHaveBeenCalledTimes(1);
  });

  it('prompt message asks for role/title', async () => {
    mockPrompt.mockResolvedValueOnce({ role: 'EM' });
    await promptRoleAndCompany();
    const calls = mockPrompt.mock.calls as unknown[][];
    const questions = calls[0][0] as { name: string; message: string }[];
    expect(questions).toHaveLength(1);
    expect(questions[0].name).toBe('role');
  });
});
```

### Architecture Compliance

- Command → Service pattern preserved: `InitCommand.run()` orchestrates, no business logic added.
- No new imports needed — `inferredDomain` is already in scope in `init.command.ts`.
- `ValidateResult` type alias already in `onboarding.prompts.ts` — no change needed.
- ESM `.js` extensions already correct in all affected files — do NOT add new imports.
- `no-console` rule: both files already use `process.stdout.write` where needed — no change.

### Downstream Consumers of `answers.company` — No Changes Needed

Both downstream consumers already handle whatever string value `answers.company` holds:
- `configService.set('company_domain', answers.company)` — stores inferred domain in config (correct)
- `generateClaudeMd(answers)` — embeds company in CLAUDE.md (receives inferred domain correctly)

No changes needed in `claude-md.generator.ts` or `config.service.ts`.

### Project Structure Notes

- Only files changed: `src/workflows/onboarding.prompts.ts`, `src/commands/init.command.ts`
- Only test files changed: `tests/commands/init.command.test.ts`, `tests/workflows/onboarding.prompts.test.ts`
- No new files, no new dependencies, no new imports.
- This is a surgical fix — 4 lines removed, 1 line added.

### References

- Bug report and change proposal: [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-06-09-post-uat-bugs-3.md` Section 4, Story 9.22]
- Source of truth for `promptRoleAndCompany`: [Source: `src/workflows/onboarding.prompts.ts` lines 283–340]
- Init command flow: [Source: `src/commands/init.command.ts` lines 74–81]
- Test mock sequence: [Source: `tests/commands/init.command.test.ts` `setupMinimalHappyPath` lines 119–150]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-5

### Debug Log References

### Completion Notes List

### File List
