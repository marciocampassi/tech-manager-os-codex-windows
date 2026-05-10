# Story 2.3: Team Member Collection Loop

Status: done

## Story

As a new `tmr` user setting up teams during `tmr init`,
I want to add members to each team through a per-member prompt loop that validates email and ends on empty input,
So that all team member files are created with the correct scope, frontmatter, and wiki-link references in one init session.

## Acceptance Criteria

1. After teams are created, the init flow prompts for members per team. For each team, the user is prompted for: email, name, role, gender, and location for each member. [INIT-INT-003]
2. When the user submits a valid member email, name, role, gender, and location, the file is created at `my-teams/members/<email>/<email>.md` with all five fields in the frontmatter including `location`. [INIT-INT-003]
3. When the user enters an invalid email for a team member, `validateEmail()` rejects it and the email prompt re-displays without losing the team or any previously added members. [INIT-INT-007]
4. When the user submits an empty string as the member email, the member-add loop for that team ends and the flow moves to the next team. [FR9, INIT-INT-008]
5. All entity references in written member files use `formatWikiLink()` from `src/utils/wiki-link.ts` — no plain absolute wiki-link strings for manager or team references. [FR33, INIT-INT-013]
6. `tests/fixtures/init-prompts.ts` `FIXTURE_DATA` is extended with `MEMBER_1_EMAIL`, `MEMBER_1_NAME`, `MEMBER_1_ROLE`, `MEMBER_1_GENDER`, `MEMBER_1_LOCATION` constants, and the `happy-path` scenario is extended to 10 prompt calls (adds member collection for 2 teams: 1 member on Team 1, 0 on Team 2). [R-005, TEA-INFRA-001]
7. `tests/integration/init.integration.test.ts` is updated with new `describe` blocks asserting member file creation, correct frontmatter, and correct wiki-link format, plus a new `describe('member files')` suite. [INIT-INT-003, INIT-INT-008]
8. `ora` spinners wrap each per-team member-collection write phase. [NFR4]
9. `npm run validate` exits 0 (lint + typecheck + tests + build).

## Tasks / Subtasks

- [x] Update `src/workflows/onboarding.prompts.ts` (AC: 3, 4)
  - [x] Add `export interface MemberDetails { name: string; role: string; gender: string; location: string; }`
  - [x] Add `promptMemberEmail(teamName: string): Promise<string>` — allows empty (returns `''` to signal loop end); validates email if non-empty using `validateEmail(v.trim())`; trims on return
  - [x] Add `promptMemberDetails(): Promise<MemberDetails>` — prompts name (required), role (required), gender (optional), location (optional); trims all fields on return

- [x] Update `src/services/team.service.ts` (AC: 5)
  - [x] Import `formatWikiLink` from `'../utils/wiki-link.js'`
  - [x] Update `buildWikiLink(email, workspaceRoot, teamSlug)` — add `workspaceRoot` and `teamSlug` parameters; replace hardcoded string with `formatWikiLink(memberAbsPath, membersFileAbsPath, email)`
  - [x] Update `buildMemberProfileMd(email, options, teams, managerEmail, workspaceRoot)` — add `workspaceRoot` parameter; replace absolute manager link string with `formatWikiLink(managerAbsPath, memberAbsPath, managerEmail)` when `managerEmail` is non-null
  - [x] Update `addMember()` to pass `workspaceRoot` to both `buildWikiLink` and `buildMemberProfileMd`
  - [x] Update `team.service.test.ts` — confirmed `[[../../members/...]]` format unchanged; added AC-5 wiki-link format + manager link tests

- [x] Add `InitService.addMembersToTeam()` to `src/services/init.service.ts` (AC: 1, 2)
  - [x] Add method: `addMembersToTeam(vaultPath: string, teamName: string, members: Array<{ email: string; name: string; role: string; gender: string; location: string }>): Promise<void>`
  - [x] Iterate members; for each call `this._team.addMember(teamName, member.email, { name, role, gender, location }, vaultPath)`
  - [x] Used local inline type `MemberEntry` inside `run()` — service layer does not import from workflows

- [x] Update `src/commands/init.command.ts` (AC: 1, 4, 8)
  - [x] Import `promptMemberEmail`, `promptMemberDetails` from `'../workflows/onboarding.prompts.js'`
  - [x] In the prompt phase (after team names loop): add per-team member collection loop using `while(true)` + empty sentinel
  - [x] In the write phase (after `teamsSpinner.succeed()`): add per-team `addMembersToTeam` calls wrapped in spinner + try/catch

- [x] Update `tests/fixtures/init-prompts.ts` (AC: 6)
  - [x] Add to `FIXTURE_DATA`: `MEMBER_1_EMAIL: 'backend-member@example.com'`, `MEMBER_1_NAME: 'Backend Engineer'`, `MEMBER_1_ROLE: 'Software Engineer'`, `MEMBER_1_GENDER: 'non-binary'`, `MEMBER_1_LOCATION: 'Remote'`
  - [x] Extend `happy-path` scenario from 6 to 10 calls (calls 7–10 added)
  - [x] Updated fixture header comment: "Story 2.3: 10 calls total"
  - [x] Added `InitPromptScenario` variant `'member-email-error'`

- [x] Update `tests/services/init.service.test.ts` (AC: 1, 2)
  - [x] Added `describe('addMembersToTeam')` suite with 6 tests
  - [x] Added `addMember: jest.fn()` to `MockTeam` type and `createMockTeam()` factory

- [x] Update `tests/integration/init.integration.test.ts` (AC: 7)
  - [x] Added `mockAppendFile`, `mockReadFile`, `mockListDirectories` mocks
  - [x] Added `MEMBER_1_EMAIL`, `MEMBER_1_NAME`, `MEMBER_1_ROLE`, `MEMBER_1_LOCATION` aliases
  - [x] Updated prompt count assertion to `10`
  - [x] Added `describe('member files (AC: 1, 2 — INIT-INT-003)')` with 6 tests incl. wiki-link format

- [x] Update `tests/commands/init.command.test.ts` (AC: 1, 4)
  - [x] Updated `setupMinimalHappyPath()` from 6 to 10 mock calls
  - [x] Updated `'does not collect API keys'` test expectation to `10`
  - [x] Updated `setupScaffoldFailure()` to include 8-call sequence (no members)
  - [x] Added `describe('member files written (AC: 1)')` with 1 test

- [x] Run `npm run validate` (AC: 9)

### Review Findings

- [x] [Review][Patch] PATH_UNSAFE_RE path-traversal guard missing from `promptMemberEmail` — `validateEmail` allows `/` and `..` in the local part; old `promptTeamMembers` had an explicit guard; must be restored [src/workflows/onboarding.prompts.ts:362-379]
- [x] [Review][Patch] No intra-team duplicate-email dedup in the `while(true)` member collection loop — old `promptTeamMembers` had `seenEmails: Set<string>`; entering same email twice silently discards the second details set [src/commands/init.command.ts:101-107]
- [x] [Review][Patch] No direct test for `promptMemberEmail` validate closure; `member-email-error` fixture scenario defined but never consumed by any test (AC3/INIT-INT-007) [tests/workflows/onboarding.prompts.test.ts, tests/fixtures/init-prompts.ts]
- [x] [Review][Patch] Integration test `describe('member files')` missing `gender` frontmatter assertion — AC2 requires all five fields including `gender` (AC2/INIT-INT-003) [tests/integration/init.integration.test.ts]
- [x] [Review][Patch] No dedicated integration test for empty-sentinel loop termination (INIT-INT-008/AC4) — prompt count alone is insufficient [tests/integration/init.integration.test.ts]
- [x] [Review][Patch] `afterAll` omits `.mockClear()` for `mockAppendFile`, `mockReadFile`, `mockListDirectories` — stale call histories leak if test order changes (TEA-INFRA-001) [tests/integration/init.integration.test.ts]
- [x] [Review][Defer] Hard `return` on first team member-addition failure abandons remaining teams — consistent with existing pattern throughout `run()`; architectural concern out of scope [src/commands/init.command.ts:185-196] — deferred, pre-existing
- [x] [Review][Defer] `while(true)` prompt loop has no error boundary — consistent with the rest of the prompt phase in `run()`; out of scope [src/commands/init.command.ts:101-107] — deferred, pre-existing
- [x] [Review][Defer] Two team names that collapse to the same slug silently merge member lists — pre-existing normalizeSlug behavior, not introduced by this story [src/commands/init.command.ts:92-94] — deferred, pre-existing
- [x] [Review][Defer] Team slug starting with `{` or `[` produces malformed YAML in member frontmatter — pre-existing normalizeSlug gap, not introduced here [src/services/team.service.ts:87] — deferred, pre-existing
- [x] [Review][Defer] Cross-team same email: second `promptMemberDetails()` output silently discarded — pre-existing `addMember` behavior when member already belongs to another team [src/commands/init.command.ts:185-198] — deferred, pre-existing

## Dev Notes

### Architecture Context (MUST follow)

**Layered pattern** (unchanged): `InitCommand` → `InitService` → `TeamService` → `FileSystemService`

**ARCH-005**: `InitService.addMembersToTeam()` MUST delegate to `TeamService.addMember()` — no inline member-profile-writing logic in `InitService` or `InitCommand`.

**Prompt phase before write phase**: ALL prompts (including member collection per team) are collected before the write phase begins. This is the established pattern from Stories 2.1 and 2.2. Collect all member data per team in the prompt phase, then call `addMembersToTeam` in the write phase.

**ARCH-003 (DI)**: `InitService` constructor is unchanged — still `(fs, leadership, team)`. No new dependencies needed.

### Files Changed

| File | Role |
|---|---|
| `src/workflows/onboarding.prompts.ts` | NEW: `MemberDetails`, `promptMemberEmail`, `promptMemberDetails` |
| `src/services/team.service.ts` | UPDATE: `buildWikiLink` + `buildMemberProfileMd` → use `formatWikiLink` |
| `src/services/init.service.ts` | NEW: `addMembersToTeam()` |
| `src/commands/init.command.ts` | UPDATE: member collection loop in prompt phase + write phase |
| `tests/fixtures/init-prompts.ts` | UPDATE: FIXTURE_DATA + happy-path 6→10 + new scenario |
| `tests/services/init.service.test.ts` | UPDATE: add `MockTeam.addMember`, new `addMembersToTeam` describe |
| `tests/integration/init.integration.test.ts` | UPDATE: more mocks, 6→10 prompt count, member file assertions |
| `tests/commands/init.command.test.ts` | UPDATE: 6→10 mock setup, member assertion |
| `tests/services/team.service.test.ts` | UPDATE: wiki-link dedup test if format changes (see note below) |

### New Prompt Functions

```typescript
// In src/workflows/onboarding.prompts.ts

export interface MemberDetails {
  name: string;
  role: string;
  gender: string;
  location: string;
}

/**
 * Prompts for a team member's email.
 * Returns '' (empty string) when user presses Enter without input → signals loop end.
 * Validates non-empty input with validateEmail().
 */
export async function promptMemberEmail(teamName: string): Promise<string> {
  const { memberEmail } = await inquirer.prompt<{ memberEmail: string }>([
    {
      type: 'input',
      name: 'memberEmail',
      message: `Email for next ${teamName} member (leave empty to finish):`,
      validate: (v: string): ValidateResult => {
        const trimmed = v.trim();
        if (!trimmed) return true; // empty = loop sentinel, allowed
        try {
          validateEmail(trimmed);
          return true;
        } catch (e) {
          return e instanceof InvalidEmailError ? e.message : 'Invalid email address';
        }
      },
    },
  ]);
  return memberEmail.trim();
}

/**
 * Prompts for a team member's profile details (called only after a valid email).
 * Name and role are required; gender and location are optional.
 * All fields are trimmed on return.
 */
export async function promptMemberDetails(): Promise<MemberDetails> {
  const result = await inquirer.prompt<MemberDetails>([
    {
      type: 'input',
      name: 'name',
      message: "Member's full name:",
      validate: (v: string): ValidateResult =>
        v.trim().length > 0 ? true : 'Name cannot be empty',
    },
    {
      type: 'input',
      name: 'role',
      message: "Member's role / title:",
      validate: (v: string): ValidateResult =>
        v.trim().length > 0 ? true : 'Role cannot be empty',
    },
    {
      type: 'input',
      name: 'gender',
      message: "Member's gender (optional, press Enter to skip):",
    },
    {
      type: 'input',
      name: 'location',
      message: "Member's location (optional, press Enter to skip):",
    },
  ]);
  return {
    name: result.name.trim(),
    role: result.role.trim(),
    gender: result.gender.trim(),
    location: result.location.trim(),
  };
}
```

### TeamService buildWikiLink + buildMemberProfileMd Update

**Why**: AC 5 requires `formatWikiLink()` for all entity references. `buildMemberProfileMd` currently uses an absolute wiki-link string for the manager reference; `buildWikiLink` uses a hardcoded relative string. Both must use `formatWikiLink`.

**`buildWikiLink` path analysis** (no functional change, same output):
- From: `<ws>/my-teams/teams/<slug>/<slug>-members.md`
- To: `<ws>/my-teams/members/<email>/<email>.md`
- Relative: `../../members/<email>/<email>.md`
- Current hardcoded: `[[../../members/${email}/${email}.md|${email}]]` ← same output ✅
- The existing test at `team.service.test.ts:140` (`const wikiLink = '- [[../../members/john@co.com/john@co.com.md|john@co.com]]'`) will still pass.

**`buildMemberProfileMd` manager link change** (format does change):
- Current: `[[my-career/${managerEmail}/${managerEmail}|${managerEmail}]]` (absolute)
- New (formatWikiLink): from `<ws>/my-teams/members/<email>/<email>.md` → `<ws>/my-career/<mgr>/<mgr>.md`
- Relative: `../../../my-career/<mgr>/<mgr>.md`
- New output: `[[../../../my-career/<mgr>/<mgr>.md|<mgr>]]`
- No existing test asserts this specific format — safe to change ✅

```typescript
// Add to imports at top of team.service.ts:
import { formatWikiLink } from '../utils/wiki-link.js';

// Updated private helpers:
function buildWikiLink(email: string, workspaceRoot: string, teamSlug: string): string {
  const memberPath = path.join(workspaceRoot, 'my-teams', 'members', email, `${email}.md`);
  const membersFilePath = path.join(workspaceRoot, 'my-teams', 'teams', teamSlug, `${teamSlug}-members.md`);
  return `- ${formatWikiLink(memberPath, membersFilePath, email)}`;
}

function buildMemberProfileMd(
  email: string,
  options: { name?: string; role?: string; gender?: string; location?: string },
  teams: string[],
  managerEmail: string | null,
  workspaceRoot: string, // NEW parameter
): string {
  const teamsYaml = teams.map((t) => `  - ${t}`).join('\n');
  let managerLink = '';
  if (managerEmail) {
    const memberPath = path.join(workspaceRoot, 'my-teams', 'members', email, `${email}.md`);
    const managerPath = path.join(workspaceRoot, 'my-career', managerEmail, `${managerEmail}.md`);
    managerLink = formatWikiLink(managerPath, memberPath, managerEmail);
  }

  return `---
email: "${email}"
name: ${options.name ?? ''}
role: ${options.role ?? ''}
gender: ${options.gender ?? ''}
location: ${options.location ?? ''}
teams:
${teamsYaml}
action_items_gdoc: ''
date_added: ${todayIso()}
---

## Current Manager

${managerLink}

## Previous Managers
...
`; // keep rest of template unchanged
}
```

**Update `addMember()` to pass `workspaceRoot`** to both helpers (it already receives `workspaceRoot`):
```typescript
// In addMember():
const profileMd = buildMemberProfileMd(normalizedEmail, options, [slug], managerEmail, workspaceRoot);
...
const wikiLink = buildWikiLink(normalizedEmail, workspaceRoot, slug);
```

### InitService.addMembersToTeam

```typescript
// Type for member data collected in init flow (local to init.service.ts — NOT imported from workflows)
interface InitMemberEntry {
  email: string;
  name: string;
  role: string;
  gender: string;
  location: string;
}

/**
 * Adds members to an existing team.
 * Delegates to TeamService.addMember() for each entry.
 * Teams are created sequentially to avoid race conditions.
 * Throws on any file system failure.
 */
async addMembersToTeam(
  vaultPath: string,
  teamName: string,
  members: InitMemberEntry[],
): Promise<void> {
  for (const member of members) {
    await this._team.addMember(
      teamName,
      member.email,
      { name: member.name, role: member.role, gender: member.gender, location: member.location },
      vaultPath,
    );
  }
}
```

### init.command.ts run() structure after Story 2.3

```typescript
// ── Prompt phase ──────────────────────────────────────────────────────────────
const rawPath = await promptWorkspacePath();
const workspacePath = initService.resolveVaultPath(rawPath);
const answers = await promptMinimalOnboarding();
const leader = await promptLeaderDetails();
const teamCount = await promptTeamCount();
const teamNames: string[] = [];
for (let i = 1; i <= teamCount; i++) {
  teamNames.push(await promptTeamName(i));
}

// Collect member data per team (NEW — Story 2.3)
interface MemberEntry { email: string; name: string; role: string; gender: string; location: string; }
const membersByTeam: Array<{ teamName: string; members: MemberEntry[] }> = [];
for (const teamName of teamNames) {
  const members: MemberEntry[] = [];
  while (true) {
    const email = await promptMemberEmail(teamName);
    if (!email) break;
    const details = await promptMemberDetails();
    members.push({ email, ...details });
  }
  membersByTeam.push({ teamName, members });
}

// ── Write phase ───────────────────────────────────────────────────────────────
// ... (scaffold, task files, user profile, leader, teams — unchanged from Story 2.2)

// After teamsSpinner.succeed('Teams created') — NEW (Story 2.3):
for (const { teamName, members } of membersByTeam) {
  if (members.length === 0) continue;
  const membersSpinner = startSpinner(`Adding members to ${teamName}`, this.plain);
  try {
    await initService.addMembersToTeam(workspacePath, teamName, members);
  } catch (err) {
    printError(
      `Failed to add members to ${teamName}: ${err instanceof Error ? err.message : String(err)}`,
    );
    membersSpinner.fail(`Failed to add members to ${teamName}`);
    return;
  }
  membersSpinner.succeed(`${members.length} member(s) added to ${teamName}`);
}
// ... (claudeSpinner, pluginSpinner, displayNextSteps — unchanged)
```

**Important**: Do NOT define `MemberEntry` as a top-level interface in `init.command.ts` (TypeScript `strict` mode + `isolatedModules`). Use a local type alias inside `run()` OR use `Parameters<typeof initService.addMembersToTeam>[2][number]` as the element type — but simpler to just inline the object literal type.

### tests/fixtures/init-prompts.ts Update

```typescript
export const FIXTURE_DATA = {
  // ... existing fields ...
  MEMBER_1_EMAIL: 'backend-member@example.com',
  MEMBER_1_NAME: 'Backend Engineer',
  MEMBER_1_ROLE: 'Software Engineer',
  MEMBER_1_GENDER: 'non-binary',
  MEMBER_1_LOCATION: 'Remote',
} as const;

// happy-path extends to 10 calls:
case 'happy-path':
  mockFn
    .mockResolvedValueOnce({ workspacePath: WORKSPACE })           // 1. promptWorkspacePath
    .mockResolvedValueOnce({ name: USER_NAME, email: USER_EMAIL, role: USER_ROLE, company: USER_COMPANY }) // 2. promptMinimalOnboarding
    .mockResolvedValueOnce({ name: LEADER_NAME, email: LEADER_EMAIL, role: LEADER_ROLE }) // 3. promptLeaderDetails
    .mockResolvedValueOnce({ teamCount: '2' })                     // 4. promptTeamCount
    .mockResolvedValueOnce({ teamName: TEAM_1 })                   // 5. promptTeamName(1)
    .mockResolvedValueOnce({ teamName: TEAM_2 })                   // 6. promptTeamName(2)
    .mockResolvedValueOnce({ memberEmail: MEMBER_1_EMAIL })        // 7. promptMemberEmail(TEAM_1)
    .mockResolvedValueOnce({ name: MEMBER_1_NAME, role: MEMBER_1_ROLE, gender: MEMBER_1_GENDER, location: MEMBER_1_LOCATION }) // 8. promptMemberDetails()
    .mockResolvedValueOnce({ memberEmail: '' })                    // 9. promptMemberEmail(TEAM_1) — end loop
    .mockResolvedValueOnce({ memberEmail: '' });                   // 10. promptMemberEmail(TEAM_2) — end loop immediately
  break;

// New partial scenario (for prompt unit tests only):
case 'member-email-error':
  // Two back-to-back promptMemberEmail calls; first is invalid, second valid.
  // For prompt unit tests only — DO NOT use in full InitCommand.run() tests.
  mockFn
    .mockResolvedValueOnce({ memberEmail: 'bad-email' })
    .mockResolvedValueOnce({ memberEmail: FIXTURE_DATA.MEMBER_1_EMAIL });
  break;
```

Update `InitPromptScenario` type: `'happy-path' | 'email-error-recovery' | 'zero-team-count' | 'member-email-error'`

### init.integration.test.ts — New Mocks Required

`TeamService.addMember()` calls `_fs.readFile` (to read members file before appending), `_fs.appendFile` (to append wiki-link), and `_fs.listDirectories` (for `getManagerEmail`). These are NOT currently in the integration test mock. Add them:

```typescript
const mockAppendFile = jest.fn<(path: string, content: string) => Promise<void>>().mockResolvedValue(undefined);
const mockReadFile = jest.fn<(path: string) => Promise<string>>().mockResolvedValue('# Team Members\n');
const mockListDirectories = jest.fn<(path: string) => Promise<string[]>>().mockResolvedValue([]);

// In the fileSystemService mock object:
jest.unstable_mockModule('../../src/services/file-system.service.js', () => ({
  fileSystemService: {
    createDirectory: mockCreateDirectory,
    writeFile: mockWriteFile,
    exists: mockFsExists,
    appendFile: mockAppendFile,       // NEW
    readFile: mockReadFile,           // NEW
    listDirectories: mockListDirectories, // NEW
  },
}));
```

Also add to `afterAll`: `mockAppendFile.mockClear(); mockReadFile.mockClear(); mockListDirectories.mockClear();`

**Note on `mockFsExists` and member writes**: `mockFsExists.mockResolvedValue(false)` means:
- `TeamService.addMember()` sees no existing profile → creates full member directory + profile ✅
- `TeamService.addMember()` idempotency check (`exists(contextPath)`) → `false` → always runs (which is fine for new teams in init)
- `TeamService.addMember()` action items idempotency (`exists(actionItemsPath)`) → `false` → creates action items file

So the integration test will see `writeFile` calls for:
- `my-teams/members/backend-member@example.com/backend-member@example.com.md` (member profile)
- `my-teams/members/backend-member@example.com/action-items-backend-member@example.com.md`
- `appendFile` called for team members file

### init.service.test.ts — MockTeam Type Update

The `MockTeam` type currently only has `createTeam`. Add `addMember`:

```typescript
type MockTeam = {
  createTeam: jest.MockedFunction<TeamService['createTeam']>;
  addMember: jest.MockedFunction<TeamService['addMember']>;
};

function createMockTeam(): MockTeam {
  return {
    createTeam: jest.fn<TeamService['createTeam']>().mockResolvedValue(undefined),
    addMember: jest.fn<TeamService['addMember']>().mockResolvedValue(undefined),
  };
}
```

### Existing Code — What MUST NOT Break

1. **`TeamService.createTeam()`** — no changes; existing tests must still pass.
2. **`TeamService.addMember()`** — `buildWikiLink` output is identical; `buildMemberProfileMd` manager link format changes but no existing test asserts that specific format.
3. **`InitService.scaffold()`, `.writeUserProfile()`, `.writeLeaderProfile()`, `.createTeams()`** — no changes; all existing tests must pass.
4. **`InitCommand.run()` — existing flow**: the prompt-then-write pattern is extended, not broken. All existing `init.command.test.ts` tests must still pass after updating prompt counts to 10.
5. **`team.service.test.ts` dedup test** (line 140): `const wikiLink = '- [[../../members/john@co.com/john@co.com.md|john@co.com]]'` — formatWikiLink produces same output; test still passes.

### Learnings from Story 2.2

- **Spinner error pattern**: wrap each async spinner block in `try/catch`; call `spinner.fail(msg)` + `return` in catch. Do NOT re-throw from the command layer.
- **Trim pattern**: all prompt returns should have `.trim()` applied — already done for `promptLeaderDetails`; apply same for `promptMemberDetails`.
- **ESM imports**: use `.js` extension for local imports. `formatWikiLink` import → `'../utils/wiki-link.js'`.
- **Mock pattern**: `jest.unstable_mockModule(path)` must be called before `await import(...)`.
- **Prompt count**: every existing test that asserts `mockPrompt.toHaveBeenCalledTimes(N)` must be updated to `10`.
- **Integration test mock gaps**: the team.addMember path requires `readFile`, `appendFile`, `listDirectories` mocked in the integration test — these were not needed before Story 2.3.
- **`filter().slice(-1)[0]` not `findLast()`** for TypeScript ES2020 compat.
- **Type annotation for inline interfaces**: define `MemberEntry` type inline inside `run()` to avoid module-level interface pollution.

### Test IDs

| ID | Description |
|---|---|
| INIT-UNIT-006 | `addMembersToTeam` calls `_team.addMember` once per member |
| INIT-UNIT-007 | `addMembersToTeam` passes correct args |
| INIT-INT-003 | Member files written correctly during init |
| INIT-INT-007 | Invalid member email rejected, loop continues |
| INIT-INT-008 | Empty member email ends loop, moves to next team |
| INIT-INT-013 | Member profile references use `formatWikiLink` format |

## Dev Agent Record

### Implementation Notes

**Story 2.3 implementation complete (2026-05-09).**

All 9 tasks completed following TDD red-green-refactor cycle.

Key implementation decisions:
- `buildWikiLink` was refactored to use `formatWikiLink()` with workspaceRoot + teamSlug params. Path analysis confirmed the output is identical (`[[../../members/<email>/<email>.md|<email>]]`), so all dedup tests pass unchanged.
- `buildMemberProfileMd` manager link now uses `formatWikiLink()` producing a proper relative path (`[[../../../my-career/<mgr>/<mgr>.md|<mgr>]]`) instead of the previous vault-relative string.
- `MemberEntry` inline type defined in `InitCommand.run()` — service layer remains clean with no workflow imports.
- `setupScaffoldFailure()` uses 8 calls (not 10) since scaffold fails before member write phase; prompt phase still collects all prompts (including 2 empty member emails).
- `appendedContent` Map added to integration test to capture `appendFile` calls for wiki-link assertions.

### Completion Notes

- All 9 tasks checked [x]
- 895 tests passing (66 suites), 0 regressions
- lint + typecheck + build all pass
- AC 1–9 fully satisfied

## File List

- `src/workflows/onboarding.prompts.ts` (modified)
- `src/services/team.service.ts` (modified)
- `src/services/init.service.ts` (modified)
- `src/commands/init.command.ts` (modified)
- `tests/fixtures/init-prompts.ts` (modified)
- `tests/services/init.service.test.ts` (modified)
- `tests/integration/init.integration.test.ts` (modified)
- `tests/commands/init.command.test.ts` (modified)
- `tests/services/team.service.test.ts` (modified — wiki-link dedup test verification)

## Change Log

- Story 2.3: Team member collection loop created (2026-05-09)
- Story 2.3: Implementation complete — member collection loop, formatWikiLink refactor, 895 tests green (2026-05-09)
