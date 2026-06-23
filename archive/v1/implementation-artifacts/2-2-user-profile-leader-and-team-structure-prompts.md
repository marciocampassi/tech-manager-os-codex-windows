# Story 2.2: User Profile, Leader & Team Structure Prompts

Status: done

## Story

As a new `tmr` user in the `tmr init` flow,
I want to provide my own identity, my leader's details, and my team names through guided prompts,
So that my profile, my leader's profile, and team folder entries are created automatically without me running separate commands.

## Acceptance Criteria

1. After scaffold completes, `InitService.writeUserProfile(vaultPath, {email, name, role})` writes `my-career/<email>/<email>.md` with correct frontmatter (email, name, role, date_added). [INIT-UNIT-004]
2. `InitService.writeLeaderProfile(vaultPath, {email, name, role})` delegates to `LeadershipService.addLeadership()` and writes `my-leadership/<email>/<email>.md`. [INIT-UNIT-005]
3. When the user enters `0` as team count, the `promptTeamCount()` validate function rejects it with a descriptive message before any file is written. [INIT-INT-004, FR30]
4. When the user enters a positive integer N for team count, the system prompts N times for team names, then calls `InitService.createTeams()`. [INIT-INT-009]
5. Each team name collected via `promptTeamName()` is normalised via `normalizeSlug()` inside `TeamService.createTeam()` before any path is constructed; `InitService.createTeams()` passes the raw display name and does not double-normalise. [INIT-INT-009]
6. `validateEmail()` is used in the email `validate` function of `promptMinimalOnboarding()` and `promptLeaderDetails()` so invalid emails surface as `InvalidEmailError` message and the prompt re-displays without losing data. [INIT-INT-005, INIT-INT-006]
7. `tests/fixtures/init-prompts.ts` is created with an `applyInitPromptFixture(scenario, mockFn)` helper exporting named scenarios: `'happy-path'` (2 teams), `'email-error-recovery'`, `'zero-team-count'`. [R-005, TEA-INFRA-001]
8. `tests/integration/init.integration.test.ts` is updated to use `applyInitPromptFixture('happy-path', mockPrompt)`, adds assertions for profile + leader + team-file writes, and removes/inverts the old "no old onboarding data" negative assertions. [INIT-INT-002, INIT-INT-004, INIT-INT-005, INIT-INT-006, INIT-INT-009]
9. `ora` spinners wrap the writeUserProfile, writeLeaderProfile, and createTeams async operations. [NFR4]
10. `npm run validate` exits 0 (lint + typecheck + tests + build).

## Tasks / Subtasks

- [x] Create `tests/fixtures/init-prompts.ts` (AC: 7)
  - [x] Export `FIXTURE_DATA` constants: WORKSPACE, USER_NAME, USER_EMAIL, USER_ROLE, USER_COMPANY, LEADER_NAME, LEADER_EMAIL, LEADER_ROLE, TEAM_1, TEAM_2
  - [x] Export `InitPromptScenario` type: `'happy-path' | 'email-error-recovery' | 'zero-team-count'`
  - [x] Implement `applyInitPromptFixture(scenario, mockFn)` for all three scenarios
  - [x] `happy-path`: 6 mock calls — workspace + onboarding + leader + teamCount:2 + teamName1 + teamName2
  - [x] `email-error-recovery`: user email invalid first, valid second (two `promptMinimalOnboarding` calls)
  - [x] `zero-team-count`: teamCount:0 first, teamCount:2 second (two `promptTeamCount` calls)

- [x] Update `src/workflows/onboarding.prompts.ts` (AC: 6)
  - [x] Import `validateEmail` from `'../utils/validation.js'` and `InvalidEmailError` from `'../errors/tmr-error.js'`
  - [x] Update `promptMinimalOnboarding()` email validate: use `try { validateEmail(v.trim()); return true; } catch (e) { return e instanceof InvalidEmailError ? e.message : 'Invalid email'; }`
  - [x] Add `export interface LeaderDetails { name: string; email: string; role: string; }`
  - [x] Add `promptLeaderDetails(): Promise<LeaderDetails>` — prompts name, email (validateEmail), role; single `inquirer.prompt()` call
  - [x] Add `promptTeamCount(): Promise<number>` — prompt `teamCount`, validate `n > 0`; returns parsed number
  - [x] Add `promptTeamName(index: number): Promise<string>` — prompt for team name N, return trimmed string

- [x] Update `src/services/init.service.ts` (AC: 1–5, 9)
  - [x] Add imports: `matter` from `'gray-matter'`, `LeadershipService`/`leadershipService`, `TeamService`/`teamService`
  - [x] Update `InitService` constructor signature: `constructor(private _fs: FileSystemService, private _leadership: LeadershipService, private _team: TeamService)`
  - [x] Add `writeUserProfile(vaultPath: string, opts: { email: string; name: string; role: string }): Promise<void>` — create `my-career/<email>/` dir, write `my-career/<email>/<email>.md` with gray-matter frontmatter `{ email, name, role, date_added: todayIso() }`
  - [x] Add `writeLeaderProfile(vaultPath: string, opts: { email: string; name: string; role: string }): Promise<void>` — call `this._leadership.addLeadership(opts.email, { name: opts.name, role: opts.role }, vaultPath)`
  - [x] Add `createTeams(vaultPath: string, teamNames: string[]): Promise<void>` — iterate teamNames; for each call `this._team.createTeam(name, vaultPath)` (TeamService.createTeam internally normalizes via normalizeSlug already — no double-normalization needed; just pass raw name)
  - [x] Add private `todayIso(): string` helper
  - [x] Update singleton: `export const initService = new InitService(fileSystemService, leadershipService, teamService)`

- [x] Update `src/commands/init.command.ts` (AC: 1, 2, 4, 9)
  - [x] Import `promptLeaderDetails`, `promptTeamCount`, `promptTeamName` from `'../workflows/onboarding.prompts.js'`
  - [x] In `run()`, after all prompts are collected (before scaffold): call `promptLeaderDetails()` + `promptTeamCount()` + loop `promptTeamName()` to collect all user-input data upfront
  - [x] After scaffold succeeds: add user-profile spinner, call `initService.writeUserProfile(workspacePath, {name, email, role})`, succeed spinner
  - [x] After user profile: add leader spinner, call `initService.writeLeaderProfile(workspacePath, leader)`, succeed spinner
  - [x] After leader: add teams spinner, call `initService.createTeams(workspacePath, teamNames)`, succeed spinner

- [x] Update `tests/services/init.service.test.ts` (AC: 1, 2, 5)
  - [x] Add `MockLeadership` type with `addLeadership` mocked function
  - [x] Add `MockTeam` type with `createTeam` mocked function
  - [x] Add `createMockLeadership()` and `createMockTeam()` factory helpers
  - [x] Update `InitService` instantiation in `beforeEach` to `new InitService(mockFS, mockLeadership, mockTeam)`
  - [x] Add `describe('writeUserProfile')` suite — INIT-UNIT-004
  - [x] Add `describe('writeLeaderProfile')` suite — INIT-UNIT-005
  - [x] Add `describe('createTeams')` suite

- [x] Update `tests/integration/init.integration.test.ts` (AC: 8)
  - [x] Import `applyInitPromptFixture` and `FIXTURE_DATA` via dynamic import after mocks
  - [x] Replace manual `mockPrompt.mockResolvedValueOnce(...)` calls in `beforeAll` with `applyInitPromptFixture('happy-path', mockPrompt)`
  - [x] Remove the `'no old onboarding data written'` describe block
  - [x] Add `describe('user profile')` — INIT-UNIT-004
  - [x] Add `describe('leader profile')` — INIT-UNIT-005
  - [x] Add `describe('team files')` — INIT-INT-009
  - [x] Update `'uses exactly N prompt calls'` to 6

- [x] Update `tests/commands/init.command.test.ts` (AC: 1, 2, 4)
  - [x] Update `setupMinimalHappyPath()` to 6 prompt calls
  - [x] Update `'does not collect API keys'` test expectation to 6
  - [x] Update `'scaffold error handling'` describe tests to 6 prompt mocks
  - [x] Add `describe('user profile written')` — INIT-UNIT-004
  - [x] Add `describe('leader profile written')` — INIT-UNIT-005

- [x] Fix `tsconfig.test.json` — update `moduleResolution: "bundler"` and set `jest.config.ts` to use `tsconfig.test.json` so `tests/fixtures/*.ts` files compile without `TS6059 rootDir` errors

- [x] Run `npm run validate` (AC: 10) — 66 test suites, 872 tests passed, build succeeded

### Review Findings

- [x] [Review][Decision] **AC 5 contradiction — normalizeSlug location** — resolved: AC 5 updated to reflect delegation pattern; normalization is owned by `TeamService.createTeam()` internally; no code change required.
- [x] [Review][Patch] No upper bound on team count — added `n > 50` ceiling + digit-only guard to promptTeamCount validator [src/workflows/onboarding.prompts.ts:promptTeamCount]
- [x] [Review][Patch] Float/mixed input passes team-count validation — added `/^\d+$/.test(trimmed)` guard before parseInt [src/workflows/onboarding.prompts.ts:promptTeamCount]
- [x] [Review][Patch] New spinners lack `.fail()` on error — wrapped profileSpinner, leaderSpinner, teamsSpinner in try/catch with printError + .fail() + return [src/commands/init.command.ts]
- [x] [Review][Patch] Email not trimmed before filesystem path — added `.trim()` before `.toLowerCase()` in writeUserProfile [src/services/init.service.ts:writeUserProfile]
- [x] [Review][Patch] Leader name/role returned untrimmed — promptLeaderDetails now returns `{ name: result.name.trim(), email: result.email.trim(), role: result.role.trim() }` [src/workflows/onboarding.prompts.ts:promptLeaderDetails]
- [x] [Review][Patch] Fixture scenarios `email-error-recovery` & `zero-team-count` are incomplete — strengthened JSDoc with explicit DO NOT USE warning for full-flow tests; scenarios intentionally minimal per spec [tests/fixtures/init-prompts.ts]
- [x] [Review][Defer] Validate closures not exercised by resolved-value mocking — architectural test design limitation; validate functions need dedicated pure-function unit tests [tests/fixtures/init-prompts.ts] — deferred, pre-existing
- [x] [Review][Defer] No leader/self-email uniqueness guard — user could set own email as leader email — not in AC, future enhancement [src/workflows/onboarding.prompts.ts] — deferred, pre-existing
- [x] [Review][Defer] No deduplication in createTeams — duplicate team names cause redundant idempotent writes — UX-only improvement [src/services/init.service.ts:createTeams] — deferred, pre-existing

## Dev Notes

### Architecture Context (MUST follow)

**Layered pattern**: `InitCommand` → `InitService` (orchestration) → `LeadershipService` / `TeamService` (business logic) → `FileSystemService` (I/O)

**ARCH-005**: `InitService` MUST delegate to `LeadershipService`, `TeamService`, and (in 2.3) `MemberService`. No inline profile-creation business logic in `InitCommand` or in `InitService` beyond orchestration calls.

**Exception**: `my-career/<email>/<email>.md` is the **user's own career profile** — there is no existing `CareerService`. `InitService` writes it directly via `_fs`, using `gray-matter` to build frontmatter, consistent with the style of `LeadershipService.buildLeadershipProfileMd()`. This is acceptable one-off orchestration.

**ARCH-003 (DI pattern)**: `InitService` constructor now accepts 3 dependencies. All tests must pass the right mock instances. The module-level singleton `initService` is updated accordingly.

### File Paths (absolute)

| Created/Modified | Role |
|---|---|
| `src/services/init.service.ts` | Add writeUserProfile, writeLeaderProfile, createTeams; update ctor |
| `src/workflows/onboarding.prompts.ts` | Add promptLeaderDetails, promptTeamCount, promptTeamName; harden email validate |
| `src/commands/init.command.ts` | Collect extra prompts; call new InitService methods with spinners |
| `tests/fixtures/init-prompts.ts` | NEW — prompt mock fixture helper |
| `tests/services/init.service.test.ts` | Add mock deps + new method tests |
| `tests/integration/init.integration.test.ts` | Use fixture; add profile/team assertions |
| `tests/commands/init.command.test.ts` | Update prompt count; add profile assertions |

### Existing Code — What MUST NOT Break

1. **`InitService.scaffold()`** — no changes; tested by INIT-UNIT-001 / INIT-UNIT-007.
2. **`InitCommand.run()` — existing flow**: scaffold → task files → CLAUDE.md → plugins. All existing unit tests in `init.command.test.ts` still test this. The new steps (profiles, leader, teams) are **inserted between scaffold and CLAUDE.md write**, before `scaffoldSpinner.succeed()`.
3. **`LeadershipService.addLeadership()`** — used as-is. Its signature is `(email, opts: IAddLeadershipOptions, workspaceRoot)`. `IAddLeadershipOptions` includes `name`, `role`, optional `gender`, `areas_of_responsibility`. For init, only `name` and `role` are passed.
4. **`TeamService.createTeam(teamName, workspaceRoot)`** — already calls `normalizeSlug(teamName)` internally. Do NOT call `normalizeSlug` again in `InitService.createTeams()` — pass raw display name; `TeamService` normalizes.

### gray-matter usage for `writeUserProfile`

```typescript
import matter from 'gray-matter';

// Frontmatter for my-career/<email>/<email>.md
const fm = {
  email: opts.email.toLowerCase(),
  name: opts.name,
  role: opts.role,
  date_added: new Date().toISOString().split('T')[0],
};
const content = matter.stringify('\n# Career Profile\n\n## Notes\n\n## Goals\n', fm);
await this._fs.createDirectory(path.join(vaultPath, 'my-career', opts.email.toLowerCase()));
await this._fs.writeFile(
  path.join(vaultPath, 'my-career', opts.email.toLowerCase(), `${opts.email.toLowerCase()}.md`),
  content,
);
```

### promptLeaderDetails — signature & validate pattern

```typescript
export async function promptLeaderDetails(): Promise<LeaderDetails> {
  return inquirer.prompt<LeaderDetails>([
    { type: 'input', name: 'name', message: "Your leader's full name:", validate: (v) => v.trim().length > 0 ? true : 'Name cannot be empty' },
    {
      type: 'input', name: 'email', message: "Your leader's work email:",
      validate: (v): ValidateResult => {
        try { validateEmail(v.trim()); return true; }
        catch (e) { return e instanceof InvalidEmailError ? e.message : 'Invalid email address'; }
      },
    },
    { type: 'input', name: 'role', message: "Your leader's role / title:", validate: (v) => v.trim().length > 0 ? true : 'Role cannot be empty' },
  ]);
}
```

### promptTeamCount — validate must reject 0

```typescript
export async function promptTeamCount(): Promise<number> {
  const { teamCount } = await inquirer.prompt<{ teamCount: string }>([{
    type: 'input', name: 'teamCount', message: 'How many teams do you manage?',
    validate: (v): ValidateResult => {
      const n = parseInt(v, 10);
      if (isNaN(n) || n < 1) return 'Team count must be a positive integer (minimum 1)';
      return true;
    },
  }]);
  return parseInt(teamCount, 10);
}
```

### promptTeamName — per-team iteration

```typescript
export async function promptTeamName(index: number): Promise<string> {
  const { teamName } = await inquirer.prompt<{ teamName: string }>([{
    type: 'input', name: 'teamName', message: `Team ${index} name:`,
    validate: (v): ValidateResult => v.trim().length > 0 ? true : 'Team name cannot be empty',
  }]);
  return teamName.trim();
}
```

### init.command.ts run() structure after Story 2.2

```typescript
async run(): Promise<void> {
  this.displayWelcomeBanner();

  // ── Prompt phase (all user input collected first) ───────────────────────
  const rawPath = await promptWorkspacePath();
  const workspacePath = initService.resolveVaultPath(rawPath);
  const answers = await promptMinimalOnboarding();
  const leader = await promptLeaderDetails();               // NEW (Story 2.2)
  const teamCount = await promptTeamCount();                // NEW (Story 2.2)
  const teamNames: string[] = [];                           // NEW (Story 2.2)
  for (let i = 1; i <= teamCount; i++) {                    // NEW (Story 2.2)
    teamNames.push(await promptTeamName(i));                // NEW (Story 2.2)
  }

  // ── Write phase ─────────────────────────────────────────────────────────
  configService.initialize();
  configService.setWorkspacePath(workspacePath);

  const scaffoldSpinner = startSpinner('Creating workspace', this.plain);
  try {
    await initService.scaffold(workspacePath);
  } catch (err) {
    printError(`Failed to scaffold vault at ${workspacePath}: ${...}`);
    scaffoldSpinner.fail('Workspace scaffolding failed');
    return;
  }

  // Task files
  await Promise.all(allTaskFiles.map(...));
  scaffoldSpinner.succeed('Workspace ready');

  // User profile (NEW — Story 2.2)
  const profileSpinner = startSpinner('Creating your profile', this.plain);
  await initService.writeUserProfile(workspacePath, { name: answers.name, email: answers.email, role: answers.role });
  profileSpinner.succeed('Profile created');

  // Leader profile (NEW — Story 2.2)
  const leaderSpinner = startSpinner('Creating leader profile', this.plain);
  await initService.writeLeaderProfile(workspacePath, leader);
  leaderSpinner.succeed('Leader profile created');

  // Teams (NEW — Story 2.2)
  const teamsSpinner = startSpinner('Creating team structure', this.plain);
  await initService.createTeams(workspacePath, teamNames);
  teamsSpinner.succeed('Teams created');

  // CLAUDE.md (existing)
  const claudeSpinner = startSpinner('Generating CLAUDE.md', this.plain);
  await fileSystemService.writeFile(join(workspacePath, 'CLAUDE.md'), generateClaudeMd(answers));
  claudeSpinner.succeed('CLAUDE.md generated');

  // Plugins + next steps (existing)
  ...
}
```

### Prompt order rationale

All prompts are collected FIRST (before any file writes) so the user sees a progress phase after answering questions. This mirrors standard CLI UX patterns and ensures the spinner phase feels responsive.

### tests/fixtures/init-prompts.ts — structure

```typescript
export const FIXTURE_DATA = {
  WORKSPACE: '/tmp/integration-test-workspace',
  USER_NAME: 'Integration User',
  USER_EMAIL: 'integration@example.com',
  USER_ROLE: 'Senior Engineering Manager',
  USER_COMPANY: 'example.com',
  LEADER_NAME: 'Director Leader',
  LEADER_EMAIL: 'director@example.com',
  LEADER_ROLE: 'Engineering Director',
  TEAM_1: 'Backend Team',
  TEAM_2: 'Frontend Team',
};

export type InitPromptScenario = 'happy-path' | 'email-error-recovery' | 'zero-team-count';

export function applyInitPromptFixture(
  scenario: InitPromptScenario,
  mockFn: jest.MockedFunction<() => Promise<Record<string, unknown>>>,
): void {
  switch (scenario) {
    case 'happy-path':
      mockFn
        .mockResolvedValueOnce({ workspacePath: FIXTURE_DATA.WORKSPACE })
        .mockResolvedValueOnce({ name: USER_NAME, email: USER_EMAIL, role: USER_ROLE, company: USER_COMPANY })
        .mockResolvedValueOnce({ name: LEADER_NAME, email: LEADER_EMAIL, role: LEADER_ROLE })
        .mockResolvedValueOnce({ teamCount: '2' })
        .mockResolvedValueOnce({ teamName: FIXTURE_DATA.TEAM_1 })
        .mockResolvedValueOnce({ teamName: FIXTURE_DATA.TEAM_2 });
      break;
    case 'email-error-recovery':
      // Same as happy-path but used for prompt unit tests, not integration tests
      mockFn.mockResolvedValueOnce({ name: USER_NAME, email: 'not-an-email', role: USER_ROLE, company: USER_COMPANY });
      mockFn.mockResolvedValueOnce({ name: USER_NAME, email: USER_EMAIL, role: USER_ROLE, company: USER_COMPANY });
      break;
    case 'zero-team-count':
      mockFn.mockResolvedValueOnce({ teamCount: '0' });
      mockFn.mockResolvedValueOnce({ teamCount: '2' });
      break;
  }
}
```

### Type gotcha for promptTeamCount return

`inquirer.prompt` returns the object as-is (no type coercion). If `teamCount` is typed as `string` in the generic, `parseInt()` is needed. If typed as `number`, inquirer may return a string anyway depending on type `'input'`. **Always use `'input'` type and `parseInt()`**. Use `{ teamCount: string }` as the generic.

### Integration test — `mockFsExists` returns `false` for all paths

The integration test `mockFsExists.mockResolvedValue(false)` means:
- `LeadershipService.addLeadership()` will proceed (profile doesn't exist) → writes to `writtenFiles`
- `TeamService.createTeam()` will proceed (team context doesn't exist) → writes 2 files per team to `writtenFiles`
- `InitCommand` task file guard `if (!(await fileSystemService.exists(filePath)))` → writes all 5 task files

### init.service.test.ts — important: mock counts change

After adding `writeUserProfile()` and `writeLeaderProfile()` and `createTeams()` to `InitService`:
- `scaffold()` still calls `writeFile` exactly 1 time (CLAUDE.md stub). The test `'calls writeFile exactly once (for CLAUDE.md) on happy path'` remains valid since that test only calls `svc.scaffold()`.
- Do NOT test `writeUserProfile` in the `scaffold` describe block — test it in its own describe block.
- `InitService` constructor signature change means ALL `new InitService(mockFS)` calls become `new InitService(mockFS, mockLeadership, mockTeam)`.

### Previous Story Learnings from 2.1

- **P1 pattern**: Never call `printError` inside services. Services throw; commands catch and call `printError`. Apply this to new methods: `writeUserProfile`, `writeLeaderProfile`, `createTeams` should throw raw errors; `InitCommand` wraps in try/catch if needed (for Story 2.2, spinners handle display).
- **Import ESM pattern**: All imports use `.js` extension. `'gray-matter'` → `import matter from 'gray-matter'` (no `.js` — it's a CJS package).
- **Test fix**: Use `filter(...).slice(-1)[0]` not `findLast()` for TypeScript ES2020 compat.
- **Mock pattern**: `jest.unstable_mockModule(path)` must be called before dynamic `await import(...)`.

### Preventing Regressions

1. `init.command.test.ts` has a test asserting exactly 2 prompt calls → update to 6.
2. `init.integration.test.ts` has "no profile" negative assertions → remove them (profiles ARE written now).
3. `init.service.test.ts` mock count: add mockLeadership and mockTeam to beforeEach.
4. `tests/commands/init.command.test.ts` `scaffold error handling` tests set up their own prompt mocks — these also need the extra calls (otherwise inquirer mock runs dry and may throw "No mock for call N").

## Dev Agent Record

### Implementation Plan

Implemented Story 2.2 in 8 sequential tasks following red-green-refactor TDD cycle. Created fixture first, then prompts, then service, then command, then tests, then validate.

### Debug Log

**Issue 1 — TS6059 rootDir error**: `tests/fixtures/init-prompts.ts` was outside `rootDir: src`, causing TypeScript compile error when imported by the integration test. Fix: updated `jest.config.ts` to use `tsconfig.test.json` (which has `rootDir: "."` + `include: ["src/**/*", "tests/**/*"]`). Also updated `tsconfig.test.json` to use `moduleResolution: "bundler"` (same as main tsconfig) to prevent the `conf` package type errors that appeared when `moduleResolution: "node"` was used.

### Completion Notes

- `tests/fixtures/init-prompts.ts`: New fixture helper with `FIXTURE_DATA` constants and `applyInitPromptFixture(scenario, mockFn)` for 3 scenarios.
- `src/workflows/onboarding.prompts.ts`: Added `promptLeaderDetails()`, `promptTeamCount()`, `promptTeamName()`; hardened email validation in `promptMinimalOnboarding()` using `validateEmail()`.
- `src/services/init.service.ts`: Constructor extended with `_leadership` and `_team` DI; added `writeUserProfile()`, `writeLeaderProfile()`, `createTeams()` methods.
- `src/commands/init.command.ts`: All prompts collected first (prompts-then-writes UX pattern); new spinner phases for profile, leader, and teams.
- `tests/services/init.service.test.ts`: Updated constructor calls, added 3 new describe blocks (16 new tests).
- `tests/integration/init.integration.test.ts`: Uses fixture; 4 new describe blocks replacing the stale "no old onboarding data" block.
- `tests/commands/init.command.test.ts`: Updated `setupMinimalHappyPath` to 6-call sequence; 2 new profile assertion describe blocks.
- `jest.config.ts` + `tsconfig.test.json`: Enables test fixtures under `tests/` to compile cleanly.
- Final: 66 test suites, 872 tests — all green. Build succeeded.

## File List

- `tests/fixtures/init-prompts.ts` (new)
- `src/workflows/onboarding.prompts.ts` (modified)
- `src/services/init.service.ts` (modified)
- `src/commands/init.command.ts` (modified)
- `tests/services/init.service.test.ts` (modified)
- `tests/integration/init.integration.test.ts` (modified)
- `tests/commands/init.command.test.ts` (modified)
- `jest.config.ts` (modified)
- `tsconfig.test.json` (modified)

## Change Log

- Story 2.2: Add user profile, leader profile, and team structure prompts to `tmr init` flow (2026-05-09)
