# Story 3.2: Company-Scoped vs Team-Scoped Member Routing

Status: done

## Story

As an engineering manager adding people to my workspace,
I want `tmr member add <email>` to route to company scope and `tmr member add <email> --team <name>` to route to team scope with an automatic manager link,
So that the correct file path and frontmatter are produced based solely on context — I never choose a directory manually.

## Acceptance Criteria

1. `MemberService.addMember('joao@company.com', {}, ws)` writes profile to `my-company/members/joao@company.com.md` (MEM-UNIT-001, MEM-INT-001).
2. `MemberService.addMember('joao@company.com', { team: 'backend' }, ws)` writes profile to `my-teams/members/joao@company.com.md` (MEM-UNIT-002, MEM-INT-002).
3. When team-scoped, the written frontmatter contains `manager:` set to `formatWikiLink(managerCareerPath, memberPath, managerEmail)` resolved from `my-career/` (MEM-UNIT-003, FR20).
4. When `--location <value>` is provided, the `location` field in frontmatter equals the provided value (MEM-UNIT-004, FR21).
5. When no `--location` is provided, the `location` field in frontmatter is an empty string `''` (MEM-UNIT-005).
6. `MemberService.addMember('not-an-email', {}, ws)` throws `InvalidEmailError` (TMR_E103) before any file write (MEM-UNIT-009).
7. The `manager` frontmatter value in team-scoped profiles uses `formatWikiLink()` — no plain email strings in entity reference fields (MEM-UNIT-010, MEM-UNIT-011, FR33).
8. Any unexpected runtime error from `MemberService` is caught by the command layer, surfaced via `printError` to `process.stderr`, no stack trace visible (NFR2).
9. `tests/fixtures/member-profiles.ts` is created with reusable member data builders covering email, team, and location variants (TEA-INFRA-002).
10. `npm run validate` exits 0.

## Tasks / Subtasks

- [x] Add `IAddMemberOptions` to `src/types/member.types.ts` (AC: 1–7)
  - [x] Add interface with `team?: string`, `location?: string`, `name?: string`, `role?: string`, `gender?: string`

- [x] Add `addMember()` to `src/services/member.service.ts` (AC: 1–7)
  - [x] Add imports: `validateEmail` from `'../utils/validation.js'`, `formatWikiLink` from `'../utils/wiki-link.js'`
  - [x] Add `import type { IAddMemberOptions }` from `'../types/member.types.js'`
  - [x] Add private `_resolveManagerLink(memberPath, workspaceRoot)` helper — reads `my-career/` via `listDirectories`, returns `formatWikiLink(...)` or `''` if no career profile found
  - [x] Add `async addMember(email, opts, ws)` method: call `validateEmail` first → compute flat profile path (company vs team scope) → if already exists return `{ created: false }` → build frontmatter with `location`, optional `manager` → `createDirectory(dirname(path))` → `writeFile` → return `{ created: true }`

- [x] Update `src/commands/member.command.ts` (AC: 1, 2, 6, 8)
  - [x] Add `import { printSuccess } from '../utils/display.js'` (already imports `printError`)
  - [x] Add `import { InvalidEmailError } from '../errors/tmr-error.js'`
  - [x] Update `runMemberAdd` opts type to include `team?: string` and `location?: string`
  - [x] In email-routing branch: replace `svc.createMember(...)` call with `svc.addMember(email, { team, location, name, role, gender }, ws)`; wrap in try/catch; catch `InvalidEmailError` → `printError` + return; re-throw unknown errors
  - [x] Replace `process.stdout.write(chalk.green(...))` with `printSuccess(...)` in email-routing branch
  - [x] Add `--team <name>` and `--location <loc>` options to the `add` subcommand and pass them through to `runMemberAdd`

- [x] Create `tests/fixtures/member-profiles.ts` (AC: 9)
  - [x] Export `MEMBER_WS`, `COMPANY_EMAIL`, `TEAM_EMAIL` constants
  - [x] Export `memberProfilePath(ws, email, scope)` builder returning the expected flat path
  - [x] Export `baseOpts`, `teamOpts(team?)`, `withLocation(location)` option builders

- [x] Add `describe('addMember')` to `tests/services/member.service.test.ts` (AC: 1–7)
  - [x] MEM-UNIT-001: `addMember('joao@company.com', {}, WS)` → `writeFile` called with path containing `my-company/members/joao@company.com.md`
  - [x] MEM-UNIT-002: `addMember('joao@company.com', { team: 'backend' }, WS)` → `writeFile` called with path containing `my-teams/members/joao@company.com.md`
  - [x] MEM-UNIT-003: with team + mocked `my-career/` dir → `writeFile` content contains `manager:` with `[[` (wiki-link syntax)
  - [x] MEM-UNIT-004: `addMember('j@c.com', { location: 'Lisbon' }, WS)` → `writeFile` content contains `location: Lisbon`
  - [x] MEM-UNIT-005: `addMember('j@c.com', {}, WS)` → `writeFile` content contains `location: ''`
  - [x] MEM-UNIT-009: `addMember('not-an-email', {}, WS)` → rejects with `InvalidEmailError`; `writeFile` not called
  - [x] MEM-UNIT-010: team-scoped `manager:` value starts with `[[` and contains `|` (valid wiki-link, not a plain email)
  - [x] MEM-UNIT-011: when no `my-career/` dir, `manager:` is empty string `''`

- [x] Update `tests/commands/member.command.test.ts` (MEM-INT-001, MEM-INT-002)
  - [x] Add `mockAddMember` mock function returning `Promise<{ created: boolean }>`
  - [x] Add `addMember: mockAddMember` to `mockMemberServiceInstance`
  - [x] Update existing `'calls createMember when first arg is a valid email'` test to expect `mockAddMember` (not `mockCreateMember`)
  - [x] MEM-INT-001: `cmd.parseAsync(['add', 'joao@company.com'])` → `mockAddMember` called with `('joao@company.com', expect.not.objectContaining({ team: expect.anything() }), '/fake/ws')` (no team)
  - [x] MEM-INT-002: `cmd.parseAsync(['add', 'joao@company.com', '--team', 'backend'])` → `mockAddMember` called with `('joao@company.com', expect.objectContaining({ team: 'backend' }), '/fake/ws')`

### Review Findings

- [x] [Review][Patch] Non-deterministic manager with multiple `my-career/` subdirs — add JSDoc note that the method assumes a single career profile, and emit a `logger.warn` when `subdirs.length > 1` so the user is informed; pick `subdirs[0]` as before [src/services/member.service.ts:_resolveManagerLink]
- [x] [Review][Patch] `opts.team` gate mismatch: `opts.team ?` vs `opts.team !== undefined` — passing `--team ""` selects company scope (falsy) but still spreads `manager: ''` into frontmatter (identity check), creating a company-scoped profile with a spurious manager field [src/services/member.service.ts:~130-142]
- [x] [Review][Patch] AC8/NFR2 violation: non-InvalidEmailError exceptions are re-thrown with full stack trace — `throw err` in the catch block exposes stack traces to CLI users; should surface via `printError` + return [src/commands/member.command.ts:~57-75]
- [x] [Review][Defer] Non-email subdir in `my-career/` (e.g. `.obsidian`, `archive`) used as manager email — pre-existing architectural assumption that `my-career/` contains only email-named dirs [src/services/member.service.ts:_resolveManagerLink] — deferred, pre-existing
- [x] [Review][Defer] Cross-scope profile duplication for same email — same email can coexist in both `my-company/members/` and `my-teams/members/` with no cross-scope check; `{ created: true }` returned for each scope separately [src/services/member.service.ts:addMember] — deferred, pre-existing
- [x] [Review][Defer] `--team`/`--location` silently accepted but ignored in type-first routing branch — pre-existing pattern for option passthrough; not in scope for Story 3.2 [src/commands/member.command.ts:type-first branch] — deferred, pre-existing
- [x] [Review][Defer] TOCTOU race in `exists()` → `writeFile()` — two concurrent `addMember()` calls for same email+scope can both pass the existence check; theoretical for single-user CLI [src/services/member.service.ts:addMember] — deferred, pre-existing
- [x] [Review][Defer] Email not trimmed at service layer — `normalizedEmail = email.toLowerCase()` does not trim; command always trims before calling `addMember`, but service is not defensively coded [src/services/member.service.ts:116] — deferred, pre-existing

---

## Dev Notes

### Architecture Reference
- **Workspace:** `/Users/2566dtidigital/tech-manager-os`
- **Language:** TypeScript strict, ESM (`"type": "module"`), `.js` import extensions for `.ts` source files
- **Test runner:** Jest with `jest.unstable_mockModule`
- **Path conventions:** All imports end in `.js` even when the source file is `.ts`

### New File Paths (FLAT — not nested directories)
```
my-company/members/<email>.md      ← company scope (AC1, MEM-UNIT-001)
my-teams/members/<email>.md        ← team scope (AC2, MEM-UNIT-002)
```
**These are FLAT files.** Do NOT confuse with `TeamService.addMember()` which creates:
```
my-teams/members/<email>/<email>.md   ← TeamService's nested structure (DIFFERENT)
```
Both coexist. `MemberService.addMember()` writes lightweight flat profiles; `TeamService.addMember()` creates the full directory tree with `1on1s/`, `feedbacks/`, etc.

### `IAddMemberOptions` — new interface in `src/types/member.types.ts`
```typescript
export interface IAddMemberOptions {
  team?: string;
  location?: string;
  name?: string;
  role?: string;
  gender?: string;
}
```

### `_resolveManagerLink` helper pattern (mirror of `TeamService.getManagerEmail`)
```typescript
private async _resolveManagerLink(
  memberPath: string,
  workspaceRoot: string,
): Promise<string> {
  const careerRoot = path.join(workspaceRoot, 'my-career');
  if (!(await this._fs.exists(careerRoot))) return '';
  const subdirs = await this._fs.listDirectories(careerRoot);
  if (subdirs.length === 0) return '';
  const managerEmail = subdirs[0] as string;
  const managerProfilePath = path.join(careerRoot, managerEmail, `${managerEmail}.md`);
  if (!(await this._fs.exists(managerProfilePath))) return '';
  return formatWikiLink(managerProfilePath, memberPath, managerEmail);
}
```

### `addMember` frontmatter structure
**Company-scoped (no `team` opt):**
```yaml
email: joao@company.com
name: ''
role: ''
gender: ''
location: ''
date_added: 2026-05-10
```
**Team-scoped (`team` opt provided):**
```yaml
email: joao@company.com
name: ''
role: ''
gender: ''
location: ''
manager: '[[../../my-career/boss@co.com/boss@co.com.md|boss@co.com]]'
date_added: 2026-05-10
```
Body (both): `\n## Performance Reviews\n\n## Feedbacks\n`

### `createDirectory` for parent dir
Always call `this._fs.createDirectory(path.dirname(profilePath))` before `writeFile`. Both `my-company/members/` and `my-teams/members/` may not exist yet.

### `member.command.ts` routing — MUST change `createMember` → `addMember`
The `runMemberAdd` email-routing branch currently calls `svc.createMember(...)`. This MUST be replaced with `svc.addMember(email, { team, location, name, role, gender }, ws)`.

The prompts stay the same (name, gender, role). `team` and `location` come from CLI options only — no interactive prompts for them.

Error handling pattern (match Story 3.1):
```typescript
try {
  const result = await svc.addMember(email, opts, ws);
  if (result.created) {
    printSuccess(`Member profile created for "${email}"`);
  } else {
    process.stdout.write(`${chalk.dim('ℹ')} Member profile for "${email}" already exists\n`);
  }
} catch (err) {
  if (err instanceof InvalidEmailError) {
    printError(`Invalid email address: ${email}`);
    return;
  }
  throw err;
}
```

### Existing tests that WILL BREAK and MUST be updated
In `tests/commands/member.command.test.ts`, the test `'calls createMember when first arg is a valid email'` asserts `mockCreateMember` is called. After this story, `addMember` is called instead. You MUST:
1. Add `mockAddMember` to the mock service before dynamic imports
2. Add `addMember: mockAddMember` to `mockMemberServiceInstance`
3. Reset `mockAddMember` in `beforeEach`
4. Update the test to check `mockAddMember` is called and `mockCreateMember` is NOT called

### `tests/fixtures/member-profiles.ts` — TEA-INFRA-002
```typescript
export const MEMBER_WS = '/fake/workspace';
export const COMPANY_EMAIL = 'joao@company.com';
export const TEAM_EMAIL = 'ana@company.com';

export function memberProfilePath(ws: string, email: string, scope: 'company' | 'team'): string {
  return scope === 'company'
    ? `${ws}/my-company/members/${email}.md`
    : `${ws}/my-teams/members/${email}.md`;
}

export const baseOpts = { name: 'Joao Silva', role: 'Engineer', gender: 'M', location: '' };

export function teamOpts(team = 'backend') {
  return { ...baseOpts, team };
}

export function withLocation(location: string) {
  return { ...baseOpts, location };
}
```

### Previous Story (3.1) Learnings
- `validateEmail(email)` from `src/utils/validation.js` throws `InvalidEmailError` (TMR_E103) — call it FIRST in `addMember`, before any other logic
- `printError` / `printSuccess` from `src/utils/display.js` — use these in command layer (NOT `process.stdout.write` + chalk for success messages)
- `Object.setPrototypeOf(this, SubClass.prototype)` — already done in `InvalidEmailError`, no action needed
- `jest.unstable_mockModule` must come before any `await import(...)` — mock declarations at top of test file
- `jest.spyOn(process.stderr, 'write')` in `beforeEach`/`afterEach` for asserting `printError` output in command tests
- Wrap `process.stdout.write` calls in chalk in `afterEach` restore — already in test setup

### `formatWikiLink` signature
```typescript
// resolvedPath = target file absolute path
// fromPath = file being written (source) absolute path
// displayName = text inside the link
formatWikiLink(resolvedPath: string, fromPath: string, displayName: string): string
// Returns: '[[relative/path/to/file.md|displayName]]'
```

### Testing the `_resolveManagerLink` in unit tests
To test MEM-UNIT-003, mock these FS calls in order:
1. `mockFS.exists.mockResolvedValueOnce(false)` — for the `profilePath` check (not exists yet)
2. `mockFS.exists.mockResolvedValueOnce(true)` — for `careerRoot` exists check
3. `mockFS.listDirectories.mockResolvedValueOnce(['boss@co.com'])` — career subdirs
4. `mockFS.exists.mockResolvedValueOnce(true)` — for manager profile exists check
Then check `writeFile` was called with content containing `[[` (wiki-link format).

---

## Dev Agent Record

### Agent Model Used
Claude Sonnet 4.6 (Cursor)

### Debug Log References
- Commander silently kills Jest worker when `--team` option is parsed before it's registered on the command — implementation of the command changes MUST precede test execution of `--team` tests. Fixed by updating `member.command.ts` before adding MEM-INT-002 to test suite.

### Completion Notes List
- `IAddMemberOptions` interface added to `src/types/member.types.ts` with `team`, `location`, `name`, `role`, `gender` fields.
- `MemberService.addMember()` added: validates email first (throws `InvalidEmailError`), routes to `my-company/members/<email>.md` (company scope) or `my-teams/members/<email>.md` (team scope), builds flat profile with `location` and optional `manager` wiki-link, idempotent (returns `{ created: false }` if file exists).
- `MemberService._resolveManagerLink()` private helper: reads `my-career/` directory, finds manager email, returns `formatWikiLink()` result or empty string.
- `member.command.ts` updated: email-routing branch now calls `addMember()` instead of `createMember()`, `InvalidEmailError` caught and surfaced via `printError`, `printSuccess` used for success messages, `--team` and `--location` options registered on `add` subcommand.
- `tests/fixtures/member-profiles.ts` created with `MEMBER_WS`, `COMPANY_EMAIL`, `TEAM_EMAIL`, `memberProfilePath()`, `baseOpts`, `teamOpts()`, `withLocation()` builders.
- 10 new service tests (MEM-UNIT-001 through MEM-UNIT-011 + idempotency + normalize) + 2 new command tests (MEM-INT-001, MEM-INT-002) + updated email-routing test.
- `npm run validate` exits 0 — 952 tests pass (66 suites), build succeeds, no linter errors.

## File List

- `src/types/member.types.ts` (modified)
- `src/services/member.service.ts` (modified)
- `src/commands/member.command.ts` (modified)
- `tests/services/member.service.test.ts` (modified)
- `tests/commands/member.command.test.ts` (modified)
- `tests/fixtures/member-profiles.ts` (created)

## Change Log

- 2026-05-10: Story 3.2 implemented — company-scoped vs team-scoped member routing via `MemberService.addMember()`, `--team` and `--location` CLI options, `InvalidEmailError` handling, `printSuccess` output, fixture builders, 12 new tests.
