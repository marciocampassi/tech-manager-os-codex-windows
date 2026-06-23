# Story 3.1: Team Create & Add with Normalization and Email Validation

Status: done

## Story

As an engineering manager using `tmr team` commands,
I want team names automatically normalized to lowercase/kebab-case and email inputs validated before any file is written,
So that team data is stored consistently regardless of how I type the name, and invalid emails never corrupt the workspace.

## Acceptance Criteria

1. `TeamService.createTeam("Backend Team", ws)` calls `normalizeSlug("Backend Team")` internally and creates all files under the slug `"backend-team"`. [TEAM-UNIT-001]
2. `TeamService.createTeam("FRONTEND", ws)` creates all files under the slug `"frontend"`. [TEAM-UNIT-002]
3. `TeamService.addMember("my-team", "not-an-email", opts, ws)` throws `InvalidEmailError` (TMR_E103) **before** any file write or directory creation. [TEAM-UNIT-003]
4. `TeamService.addMember("my-team", "valid@company.com", opts, ws)` writes the member profile to the correct path `my-teams/members/valid@company.com/valid@company.com.md`. [TEAM-UNIT-004]
5. `tmr team create "My Team"` (integration) — `createTeam` is called with `"My Team"` and the correct workspace root; combined with AC1 this confirms the file ends up under `"my-team"`. [TEAM-INT-001]
6. `tmr team add my-team "bad-email"` (integration) — `printError` is called to `process.stderr` and `addMember` throws before any file write. [TEAM-INT-002]
7. `npm run validate` exits 0.

## Tasks / Subtasks

- [x] Update `src/services/team.service.ts` (AC: 3, 4)
  - [x] Add `import { validateEmail } from '../utils/validation.js'`
  - [x] In `addMember()`: call `validateEmail(email)` as the **very first line** — before `normalizeSlug`, before `getManagerEmail`, before any FS call. Throws `InvalidEmailError` (TMR_E103) on invalid input.

- [x] Update `src/commands/team.command.ts` (AC: 5, 6)
  - [x] Add imports: `import { printError, printSuccess } from '../utils/display.js'` and `import { InvalidEmailError } from '../errors/tmr-error.js'`
  - [x] In `runAdd()`:
    - Remove the inline regex from the interactive email prompt's `validate` callback (line ~88); replace with `v.trim().length > 0 || 'Required'` — real validation happens at the service level
    - Wrap the entire `await svc.addMember(...)` call in try/catch; catch `InvalidEmailError` and call `printError(\`Invalid email: \${err.message}\`)` to stderr; re-throw or return to abort the operation
  - [x] In `runCreate()`:
    - Wrap `await svc.createTeam(...)` in try/catch; on error call `printError(...)` to stderr
    - Replace `process.stdout.write(\`${chalk.green('✔')} Team ...\`)` with `printSuccess(\`Team "${teamName}" created\`)`
  - [x] In `runAdd()` success path:
    - Replace `process.stdout.write(\`${chalk.green('✔')} Member ...\`)` with `printSuccess(\`Member "${email}" added to team "${teamName}"\`)`

- [x] Update `tests/services/team.service.test.ts` (AC: 1–4)
  - [x] Add `import { InvalidEmailError } from '../../src/errors/tmr-error.js'`
  - [x] In `describe('createTeam')`, add:
    - TEAM-UNIT-001: `createTeam("Backend Team", WS)` → `writeFile` called with path containing `teams/backend-team/backend-team-context.md`
    - TEAM-UNIT-002: `createTeam("FRONTEND", WS)` → `writeFile` called with path containing `teams/frontend/frontend-context.md`
  - [x] In `describe('addMember')`, add:
    - TEAM-UNIT-003: `addMember('alpha', 'not-an-email', {}, WS)` → rejects with `InvalidEmailError`; `writeFile` not called; `createDirectory` not called
    - TEAM-UNIT-004: `addMember('alpha', 'valid@company.com', {}, WS)` → `writeFile` called with path `my-teams/members/valid@company.com/valid@company.com.md`

- [x] Update `tests/commands/team.command.test.ts` (AC: 5, 6)
  - [x] Add `import { InvalidEmailError } from '../../src/errors/tmr-error.js'` (after dynamic import block)
  - [x] Add stderr spy via `jest.spyOn(process.stderr, 'write')` in `beforeEach`/`afterEach`
  - [x] In `describe('team create')`, add:
    - TEAM-INT-001: `parseAsync(['create', 'My Team'])` → `mockCreateTeam` called with `('My Team', '/fake/ws')`
  - [x] In `describe('team add')`, add:
    - TEAM-INT-002: mock `mockAddMember` to throw `new InvalidEmailError('bad-email')`; run `parseAsync(['add', 'my-team', 'bad-email'])`; assert `process.stderr.write` called with string containing `'bad-email'`; assert command resolves without throw

---

## Dev Notes

### Critical: where `validateEmail()` goes

**Service layer — not command layer.** Per project-context architecture rules, validation before file writes belongs in the service. The command layer catches the resulting `InvalidEmailError` and surfaces it via `printError`. This mirrors the pattern used in `InitService.addMembersToTeam()` (command catches, service validates).

```typescript
// src/services/team.service.ts — addMember(), first line:
validateEmail(email); // throws InvalidEmailError (TMR_E103) before any fs call
const slug = normalizeSlug(teamName);
const normalizedEmail = email.toLowerCase();
// ... rest of method unchanged
```

### `createTeam` normalization is already wired

`TeamService.createTeam()` already calls `normalizeSlug(teamName)` at line 159. Stories 2.1–2.4 relied on this. TEAM-UNIT-001 and TEAM-UNIT-002 are **new tests** that document this guarantee; no code change is needed in `createTeam()`.

### Command error handling pattern

Current `runCreate` and `runAdd` are bare `async` functions with no try/catch — any service error propagates to Commander's unhandled rejection handler. Story 3.1 requires wrapping at minimum `addMember` for `InvalidEmailError`. Follow this pattern established in `init.command.ts`:

```typescript
// runAdd — after collecting teamName + email + secondary answers:
try {
  await svc.addMember(teamName, email, { name, role, gender, location }, ws);
} catch (err) {
  if (err instanceof InvalidEmailError) {
    printError(`Invalid email address: ${email}`);
    return;
  }
  throw err; // unexpected errors still propagate
}
printSuccess(`Member "${email}" added to team "${teamName}"`);
```

For `runCreate`, minimal change is enough (no email involved, no new validation):

```typescript
try {
  await svc.createTeam(teamName, ws);
} catch (err) {
  printError(`Failed to create team "${teamName}": ${err instanceof Error ? err.message : String(err)}`);
  return;
}
printSuccess(`Team "${teamName}" created`);
```

### Display import required

`team.command.ts` currently uses `chalk` directly. After this story it must import from `display.ts`:

```typescript
import { printError, printSuccess } from '../utils/display.js';
```

`chalk` can remain imported for the table output functions (`printTeamsTable`, `printMembersTable`) which use `chalk.bold` — those are display helpers, not action results.

### TEAM-INT-002 test approach

Since `TeamService` is mocked in `team.command.test.ts`, TEAM-INT-002 must:
1. Configure `mockAddMember` to throw `new InvalidEmailError('bad-email')`
2. Spy on `process.stderr.write` (same pattern as `init.command.test.ts` stdout spy but for stderr)
3. Call `cmd.parseAsync(['add', 'my-team', 'bad-email', ...])`
4. Assert stderr received the error message; assert the command did NOT re-throw (i.e., `parseAsync` resolved without exception)

The mock for `chalk` in `team.command.test.ts` (line 46) only has `bold`, `green`, `dim`. After adding `display.js` imports, `display.ts` internally uses `chalk.red` and `chalk.blue`. If `display.ts` is **not** mocked (it uses `chalk` which IS mocked), then `chalk.red` will be `undefined`. You must either:
- **Option A (preferred)**: Add `red`, `blue`, `yellow` to the existing chalk mock
- **Option B**: Mock `../../src/utils/display.js` directly as a module mock

Option A is simpler — extend the existing chalk mock:
```typescript
jest.unstable_mockModule('chalk', () => ({
  default: {
    bold: (s: string) => s,
    green: (s: string) => s,
    dim: (s: string) => s,
    red: (s: string) => s,   // ← add
    blue: (s: string) => s,  // ← add
    yellow: (s: string) => s, // ← add
  },
}));
```

### `validateEmail` import path

```typescript
// In team.service.ts:
import { validateEmail } from '../utils/validation.js';
```

The function is in `src/utils/validation.ts` (already used by `onboarding.prompts.ts`). It throws `InvalidEmailError` (TMR_E103) — no other changes to the utility needed.

### deferred-work.md gap to be aware of

From Epic 1 review: "`validateEmail()` is absent from `TeamService.addMember`, `TeamService.archiveMember`, `TeamService.fireMember`". This story closes the `addMember` gap. `archiveMember` and `fireMember` remain deferred — do not add validation to those methods in this story.

### Existing test collision risk

`team.service.test.ts` line 93 calls `svc.addMember('alpha', 'John@Co.Com', ...)`. `John@Co.Com` is a valid email, so adding `validateEmail()` will not break this test. However:
- Tests using `svc.addMember('alpha', 'john@co.com', ...)` (lowercase, valid) — unaffected ✓
- Tests passing empty email or clearly invalid strings would now throw `InvalidEmailError` — scan existing tests before adding the guard to make sure no test passes invalid email to `addMember` unexpectedly.

A quick grep shows the only non-email-shaped values used in existing `addMember` tests are valid email-format strings, so no regression expected.

### No new files

This story only modifies existing files. No new service, command, or test file is created.

---

## Agent Model Used

Claude Sonnet 4.6

## Debug Log References

No debug issues encountered. All tests passed on first run.

## Completion Notes List

- Added `validateEmail(email)` as the first line of `TeamService.addMember()` — throws `InvalidEmailError` (TMR_E103) before any slug normalization, directory creation, or file write.
- `TeamService.createTeam()` already called `normalizeSlug(teamName)` — TEAM-UNIT-001 and TEAM-UNIT-002 document this existing guarantee with new tests, no code change was needed.
- `team.command.ts`: imported `printError`, `printSuccess` from `display.ts` and `InvalidEmailError` from `tmr-error.ts`. Replaced bare chalk output in `runCreate` and `runAdd` with proper display helpers. Added try/catch in both handlers.
- `team.command.ts` `runAdd`: removed inline email regex from the inquirer prompt `validate` callback — validation now lives exclusively in the service layer.
- chalk mock extended with `red`, `blue`, `yellow` to support `display.ts` calls from within the command test suite.
- stderr spy added to `team.command.test.ts` `beforeEach`/`afterEach` pattern to enable assertion on `printError` output.
- All 940 tests pass, `npm run validate` exits 0.

### Review Findings

- [x] [Review][Patch] `answers.email` not trimmed — space-padded prompt input corrupts filesystem paths [`src/commands/team.command.ts:97`] — fixed: `answers.email.trim()`

- [x] [Review][Defer] Prompt email validator downgraded from regex to non-empty; secondary prompts fire before invalid email is rejected [`src/commands/team.command.ts:89-92`] — deferred, intentional per story spec; UX improvement is future work
- [x] [Review][Defer] Error handlers call `return` without setting exit code — `tmr team create/add` always exits 0 even on failure [`src/commands/team.command.ts:64,125`] — deferred, pre-existing project pattern across all commands
- [x] [Review][Defer] Success message dropped path detail (`created at my-teams/teams/${teamName}/`) [`src/commands/team.command.ts:68`] — deferred, deliberate simplification aligned with display.ts helper style

## File List

**Modified:**
- `src/services/team.service.ts`
- `src/commands/team.command.ts`
- `tests/services/team.service.test.ts`
- `tests/commands/team.command.test.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
