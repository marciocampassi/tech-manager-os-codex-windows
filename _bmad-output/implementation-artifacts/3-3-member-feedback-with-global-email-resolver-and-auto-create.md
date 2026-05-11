# Story 3.3: Member Feedback with Global Email Resolver & Auto-Create

Status: done

## Story

As an engineering manager logging feedback for a team member,
I want `tmr member add feedback <email>` to find the correct member file automatically across all scopes and auto-create a company-scoped profile if the email is unknown,
So that feedback is always routed to the right person without me knowing or caring which directory they live in.

## Acceptance Criteria

1. `createMemberFile('joao@company.com', 'feedback', ...)` when email exists in `my-teams/members/joao@company.com.md` (flat team-scoped) → feedback file written relative to that profile (MEM-UNIT-006, MEM-INT-003).
2. `createMemberFile('pedro@company.com', 'feedback', ...)` when email exists only in `my-company/members/pedro@company.com.md` (flat company-scoped) → feedback file written relative to that profile (MEM-UNIT-007).
3. `createMemberFile('unknown@company.com', 'feedback', ...)` when no profile exists in any scope → auto-creates `my-company/members/unknown@company.com.md` via `MemberService.addMember(email, {}, ws)` and writes feedback to it (FR24, MEM-UNIT-008, MEM-INT-004).
4. `createMemberFile('"Joao@Company.com"', 'feedback', ...)` (mixed-case) resolves to the existing lowercase profile without creating a duplicate (R-008, MEM-INT-005).
5. `tests/integration/member.integration.test.ts` exercises all five flows: MEM-INT-001 (company routing via `addMember`), MEM-INT-002 (team routing + manager link via `addMember`), MEM-INT-003 (feedback on existing flat member), MEM-INT-004 (feedback auto-create for unknown email), MEM-INT-005 (case-insensitive lookup).
6. `npm run validate` exits 0.

## Tasks / Subtasks

- [x] Add `findMemberGlobally()` to `src/services/member.service.ts` (AC: 1–4)
  - [x] Add `async findMemberGlobally(email: string, workspaceRoot: string): Promise<string | null>` public method
  - [x] Search in order: `my-teams/members/<email>.md` → `my-company/members/<email>.md` → `my-teams/members/<email>/<email>.md` (legacy nested)
  - [x] Normalize email to lowercase before checking all three paths
  - [x] Return first matching path or `null` if none found

- [x] Add `memberSubDirFromProfile()` module-level helper in `src/services/member.service.ts` (AC: 1–3)
  - [x] Signature: `function memberSubDirFromProfile(profilePath: string, email: string): string`
  - [x] If `path.basename(path.dirname(profilePath)) === email` → nested profile → return `path.dirname(profilePath)` (the member dir IS the parent)
  - [x] Otherwise → flat profile → return `path.join(path.dirname(profilePath), email)` (create a sibling directory named after the email)

- [x] Update `createMemberFile()` in `src/services/member.service.ts` (AC: 1–4)
  - [x] Replace hardcoded `profilePath = memberProfilePath(workspaceRoot, normalizedEmail)` with `profilePath = await this.findMemberGlobally(normalizedEmail, workspaceRoot)`
  - [x] If `findMemberGlobally` returns `null`: call `await this.addMember(normalizedEmail, {}, workspaceRoot)` then set `profilePath = path.join(workspaceRoot, 'my-company', 'members', \`${normalizedEmail}.md\`)`
  - [x] Remove the old `if (!memberExists) throw new Error(...)` block entirely
  - [x] Replace `const subDirPath = path.join(memberDir(workspaceRoot, normalizedEmail), config.subDir)` with `const subDirPath = path.join(memberSubDirFromProfile(profilePath, normalizedEmail), config.subDir)`
  - [x] Keep all other logic (template, writeFile, wikiLink, appendToFile) unchanged

- [x] Add `describe('createMemberFile — global email resolver')` to `tests/services/member.service.test.ts` (AC: 1–4)
  - [x] MEM-UNIT-006: `exists()` returns `true` for first candidate (team-flat) → `writeFile` path contains `my-teams/members`; `appendToFile` called with the team-flat profile path
  - [x] MEM-UNIT-007: `exists()` returns `false` then `true` (company-flat) → `appendToFile` called with the company-flat profile path
  - [x] MEM-UNIT-008: `exists()` returns `false` × 4 (3 candidates + addMember idempotency check) → `writeFile` called twice (addMember creates profile + createMemberFile writes dated file); `appendToFile` called with auto-created company profile path
  - [x] Update existing `'throws descriptive error when member does not exist'` test → now expects success (auto-create), not a throw — renamed to `'auto-creates company-scoped profile when member does not exist'` and asserts `writeFile` called with `my-company/members` path

- [x] Add MEM-INT-001 through MEM-INT-005 to `tests/integration/member.integration.test.ts` (AC: 5)
  - [x] Add `describe('Global Email Resolver & Auto-create (Story 3.3)')` block — uses real FS in temp workspace
  - [x] MEM-INT-001: `memberSvc.addMember('joao@company.com', {}, ws)` → `fs.existsSync(ws/my-company/members/joao@company.com.md)` is `true`
  - [x] MEM-INT-002: seed `my-career/manager@co.com/manager@co.com.md`, then `memberSvc.addMember('joao@company.com', { team: 'backend' }, ws)` → file exists at `my-teams/members/joao@company.com.md` AND frontmatter contains `manager:` with `[[`
  - [x] MEM-INT-003: seed `memberSvc.addMember('joao@company.com', {}, ws)` then `memberSvc.createMemberFile('joao@company.com', 'feedback', { date: '2026-01-15' }, ws)` → feedback file exists, `my-company/members/joao@company.com.md` contains `[[feedback/`
  - [x] MEM-INT-004: `memberSvc.createMemberFile('unknown@company.com', 'feedback', { date: '2026-01-15' }, ws)` with no prior profile → `my-company/members/unknown@company.com.md` created AND feedback wiki-link appended to it
  - [x] MEM-INT-005: seed `memberSvc.addMember('joao@company.com', {}, ws)`, then `memberSvc.createMemberFile('JOAO@COMPANY.COM', 'feedback', { date: '2026-01-15' }, ws)` → no duplicate profile created; feedback appended to existing `joao@company.com.md` (assertion uses `readdirSync` to handle macOS case-insensitive FS)
  - [x] Update existing `'AC5: throws descriptive error when member does not exist'` test → renamed to `'AC5: auto-creates company profile and creates file for unknown member (Story 3.3)'`

### Review Findings

- [x] [Review][Patch] Duplicate JSDoc block on `createMemberFile` — old comment at ~line 204 was left intact when the new extended JSDoc was appended; the method now has two consecutive JSDoc blocks [src/services/member.service.ts:204-214]
- [x] [Review][Patch] MEM-INT-002 manager-link assertion too weak — `content.toMatch(/\[\[/)` only confirms wiki-link syntax exists; should also assert the actual manager email (`boss@co.com`) appears in the content [tests/integration/member.integration.test.ts:MEM-INT-002]
- [x] [Review][Patch] `memberSubDirFromProfile` nested-branch has no dedicated unit test — the nested-profile `path.dirname` branch (`path.basename(parentDir) === email`) is never directly verified; only exercised implicitly via createMemberFile's `beforeEach` mock chain [tests/services/member.service.test.ts]
- [x] [Review][Patch] AC1 has no integration test for team-flat `createMemberFile` routing — MEM-INT-003 seeds via `addMember(email, {})` (company-flat), so the team-flat createMemberFile path is validated only by MEM-UNIT-006; AC1 spec maps to MEM-INT-003 but the test covers company-flat scope [tests/integration/member.integration.test.ts]
- [x] [Review][Patch] No standalone unit tests for `findMemberGlobally` — new public method is indirectly exercised through createMemberFile tests but has no `describe('findMemberGlobally')` block directly verifying the 3-candidate search order and null-return path [tests/services/member.service.test.ts]
- [x] [Review][Patch] `createMemberFile` `beforeEach` mock chain fragility — existing tests now silently exercise the nested-legacy profile path (false/false/true) without any assertion or comment documenting this intent; a future change to `findMemberGlobally`'s search order would silently invalidate the setup [tests/services/member.service.test.ts:beforeEach]
- [x] [Review][Defer] TOCTOU race — concurrent `createMemberFile` calls for same unknown email can both find no profile, both call `addMember`, both construct the same `profilePath`, and both reach `appendToFile`, duplicating the wiki-link [src/services/member.service.ts:createMemberFile] — deferred, pre-existing architectural pattern (same as Story 3.2 deferral)
- [x] [Review][Defer] No email/path-traversal guard in `findMemberGlobally` — email is normalized by callers but not re-validated; defense-in-depth would add `validateEmail()` at entry — deferred, pre-existing caller-validates pattern
- [x] [Review][Defer] Auto-created profile template (`addMember` body) missing `## 1on1s` and `## Assessments` sections — calling `createMemberFile` with `1on1` or `assessment` type on an auto-created profile may route wiki-links to absent sections [src/services/member.service.ts:addMember body template] — deferred, pre-existing Story 3.2 template scope
- [x] [Review][Defer] `findMember` not marked `@deprecated` after `findMemberGlobally` supersedes it for multi-scope lookups [src/services/member.service.ts:findMember] — deferred, pre-existing method, minor cleanup
- [x] [Review][Defer] Magic path strings in `findMemberGlobally` — `'my-teams'`, `'my-company'`, `'members'` hardcoded without constants — deferred, pre-existing codebase pattern

---

## Dev Notes

### Architecture Reference
- **Language:** TypeScript strict, ESM (`"type": "module"`), `.js` import extensions for `.ts` source files
- **Test runner:** Jest with `jest.unstable_mockModule`, `NODE_OPTIONS=--experimental-vm-modules`
- **Run tests:** `npm test -- --testPathPattern="member"` (not `npx jest` directly)
- **Validate:** `npm run validate` (lint + typecheck + tests + build)

### Critical Context: Two Member Directory Structures Coexist

Story 3.2 introduced **flat profiles**. Story 2.x created **nested profiles** via `TeamService`. Both exist simultaneously.

```
my-teams/members/<email>/<email>.md    ← TeamService nested (created via `tmr team add`)
my-teams/members/<email>.md            ← MemberService flat (created via `tmr member add <email> --team`)
my-company/members/<email>.md          ← MemberService flat (created via `tmr member add <email>`)
```

`createMemberFile` must route feedback to whichever profile exists, regardless of structure.

### `findMemberGlobally` — New Public Method

Search order matters. Team-scoped flat is checked first (more specific scope), then company-scoped flat, then nested legacy last.

```typescript
async findMemberGlobally(email: string, workspaceRoot: string): Promise<string | null> {
  const normalizedEmail = email.toLowerCase();
  const candidates = [
    path.join(workspaceRoot, 'my-teams', 'members', `${normalizedEmail}.md`),    // flat team-scoped
    path.join(workspaceRoot, 'my-company', 'members', `${normalizedEmail}.md`),  // flat company-scoped
    memberProfilePath(workspaceRoot, normalizedEmail),                            // nested legacy
  ];
  for (const p of candidates) {
    if (await this._fs.exists(p)) return p;
  }
  return null;
}
```

`memberProfilePath` is the existing module-level function (line ~29): `path.join(ws, 'my-teams', 'members', email, `${email}.md`)`.

### `memberSubDirFromProfile` — New Module-Level Helper

Determines the directory where dated files (feedback, 1on1s, etc.) live, given the profile path.

```typescript
function memberSubDirFromProfile(profilePath: string, email: string): string {
  const parentDir = path.dirname(profilePath);
  // Nested profile: .../members/<email>/<email>.md → parent IS the member dir
  if (path.basename(parentDir) === email) return parentDir;
  // Flat profile: .../members/<email>.md → parent is members/, so create sibling dir
  return path.join(parentDir, email);
}
```

**Examples:**
| Profile path | Returns |
|---|---|
| `my-teams/members/john@co.com/john@co.com.md` | `my-teams/members/john@co.com/` |
| `my-teams/members/joao@co.com.md` | `my-teams/members/joao@co.com/` |
| `my-company/members/pedro@co.com.md` | `my-company/members/pedro@co.com/` |

The flat profile `joao@co.com.md` and sibling directory `joao@co.com/` coexist fine on disk.

### Updated `createMemberFile` — Full Replacement Block

Replace the current body of `createMemberFile` (lines ~178–203) with:

```typescript
async createMemberFile(
  email: string,
  type: FileType,
  options: ICreateFileOptions,
  workspaceRoot: string,
): Promise<ICreateFileResult> {
  const normalizedEmail = email.toLowerCase();
  const date = options.date ?? todayIso();
  const config = FILE_TYPE_CONFIG[type];

  // Global lookup — search all three scopes (FR24 auto-create if not found)
  let profilePath = await this.findMemberGlobally(normalizedEmail, workspaceRoot);
  if (!profilePath) {
    await this.addMember(normalizedEmail, {}, workspaceRoot);
    profilePath = path.join(workspaceRoot, 'my-company', 'members', `${normalizedEmail}.md`);
  }

  const subDirPath = path.join(memberSubDirFromProfile(profilePath, normalizedEmail), config.subDir);
  await this._fs.createDirectory(subDirPath);

  const fileName = `${date}-${normalizedEmail}-${config.fileSuffix}.md`;
  const filePath = path.join(subDirPath, fileName);

  const content = this._template.getTemplate(type, date, normalizedEmail);
  await this._fs.writeFile(filePath, content);

  const wikiLink = `- [[${config.subDir}/${fileName}]]`;
  await this._sectionParser.appendToFile(profilePath, config.sectionName, wikiLink);

  return { filePath, profilePath, wikiLink };
}
```

**Key removals:** Delete `const memberExists = await this._fs.exists(profilePath)` and the `if (!memberExists) throw new Error(...)` block that follows.

### exists() Call Sequence for MEM-UNIT-008 (auto-create path)

In unit tests, `exists()` is called in this exact order for the auto-create case:
1. `findMemberGlobally`: team-flat → `false`
2. `findMemberGlobally`: company-flat → `false`
3. `findMemberGlobally`: nested legacy → `false`
4. `addMember` idempotency check → `false` (profile not created yet → proceeds to create)

So `mockFS.exists.mockResolvedValueOnce(false).mockResolvedValueOnce(false).mockResolvedValueOnce(false).mockResolvedValueOnce(false)` covers the full sequence.

`addMember` does NOT call `_resolveManagerLink` when `opts.team` is falsy — so no additional `exists()` calls from manager resolution.

### Existing Unit Test to Update

In `tests/services/member.service.test.ts`, the test that previously asserted a `throw` for unknown members must be changed:

```typescript
// BEFORE (Story 3.2 era — remove this)
it('throws descriptive error when member does not exist', async () => {
  mockFS.exists.mockResolvedValue(false);
  await expect(svc.createMemberFile('ghost@co.com', '1on1', {}, WS)).rejects.toThrow(/not found/);
});

// AFTER (Story 3.3 — auto-create path)
it('auto-creates company-scoped profile when member does not exist', async () => {
  mockFS.exists.mockResolvedValue(false); // all 4 exists() calls return false
  await svc.createMemberFile('ghost@co.com', 'feedback', { date: '2026-01-15' }, WS);
  // addMember's writeFile (profile creation) + createMemberFile's writeFile (dated file) = 2 calls
  expect(mockFS.writeFile).toHaveBeenCalledTimes(2);
  // First write creates the auto-generated company profile
  expect(mockFS.writeFile.mock.calls[0]![0]).toContain('my-company/members/ghost@co.com.md');
});
```

### Existing Integration Test to Update

In `tests/integration/member.integration.test.ts`, the test `'AC5: throws descriptive error when member does not exist'` (line ~139) currently tests that `ghost@co.com` throws. After Story 3.3, it auto-creates instead of throwing.

**Update it to:**

```typescript
it('AC5: auto-creates company profile and creates file for unknown member (Story 3.3)', async () => {
  const result = await memberSvc.createMemberFile(
    'ghost@co.com',
    'feedback',
    { date: '2026-01-15', noEdit: true },
    workspace,
  );

  // Profile auto-created
  expect(fs.existsSync(path.join(workspace, 'my-company', 'members', 'ghost@co.com.md'))).toBe(true);
  // Feedback file created
  expect(fs.existsSync(result.filePath)).toBe(true);
  // Wiki-link appended to the auto-created profile
  const profileContent = fs.readFileSync(result.profilePath, 'utf8');
  expect(profileContent).toContain('[[feedback/');
});
```

### Integration Test: MEM-INT-002 Manager Link Setup

MEM-INT-002 verifies the `manager:` field. To get a non-empty manager link in the integration test, seed a career profile before calling `addMember`:

```typescript
// Seed: create a career profile so _resolveManagerLink resolves
const careerDir = path.join(workspace, 'my-career', 'boss@co.com');
fs.mkdirSync(careerDir, { recursive: true });
fs.writeFileSync(path.join(careerDir, 'boss@co.com.md'), '---\nemail: boss@co.com\n---\n');

await memberSvc.addMember('joao@company.com', { team: 'backend' }, workspace);

const profilePath = path.join(workspace, 'my-teams', 'members', 'joao@company.com.md');
expect(fs.existsSync(profilePath)).toBe(true);
const content = fs.readFileSync(profilePath, 'utf8');
expect(content).toContain('manager:');
expect(content).toMatch(/\[\[/);  // wiki-link syntax present
```

### Integration Test: MEM-INT-003 Feedback on Existing Flat Profile

The `createMemberFile` feedback wiki-link goes in the `## Feedbacks` section of the flat profile. The flat profile body is `'\n## Performance Reviews\n\n## Feedbacks\n'`, so `appendToFile` will find this section. Verify:

```typescript
const profileContent = fs.readFileSync(result.profilePath, 'utf8');
expect(profileContent).toContain('## Feedbacks');
expect(profileContent).toContain('[[feedback/');
```

### Existing Tests That MUST NOT Break

All existing tests in `tests/integration/member.integration.test.ts` (AC1–AC4, AC9, uppercase normalization) use `teamSvc.addMember()` which creates nested profiles at `my-teams/members/<email>/<email>.md`. After Story 3.3:

- `findMemberGlobally` checks team-flat first → `false`, then company-flat → `false`, then nested → **`true`** ✓
- `memberSubDirFromProfile` for nested profile: `path.basename(path.dirname(profilePath)) === email` → returns `path.dirname(profilePath)` (the old memberDir) ✓

All existing integration tests remain green without modification (except the AC5 "throws" test which must be updated as described above).

### `tests/fixtures/member-profiles.ts` — Reuse for New Unit Tests

The fixture builders from Story 3.2 should be imported in new unit tests:

```typescript
import {
  MEMBER_WS as WS,   // '/fake/workspace'
  COMPANY_EMAIL,      // 'joao@company.com'
  TEAM_EMAIL,         // 'ana@company.com'
  memberProfilePath,  // (ws, email, 'company'|'team') → expected flat path
} from '../../tests/fixtures/member-profiles.js';
```

Expected paths for MEM-UNIT-006/007:
- Team-flat: `memberProfilePath(WS, 'joao@company.com', 'team')` = `<WS>/my-teams/members/joao@company.com.md`
- Company-flat: `memberProfilePath(WS, 'pedro@company.com', 'company')` = `<WS>/my-company/members/pedro@company.com.md`

### No Changes to `member.command.ts`

The command already routes `feedback` (and all other types) through `createMemberFile` in the type-first branch. The global resolver is entirely a service-layer change — no command updates needed.

### `ICreateFileResult` Unchanged

The return type `{ filePath, profilePath, wikiLink }` is unchanged. `profilePath` now reflects the actual resolved scope rather than always being the nested path — callers that display `profilePath` to the user benefit automatically.

---

## Dev Agent Record

### Agent Model Used
Claude Sonnet 4.5 (Cursor)

### Debug Log References
- MEM-INT-005 initially failed because `fs.existsSync('JOAO@COMPANY.COM.md')` on macOS returns `true` (case-insensitive HFS+/APFS). Fixed by replacing `existsSync` assertion with `readdirSync`-based check on exact filenames.

### Completion Notes List
- Added `findMemberGlobally()` public method: searches team-flat → company-flat → nested-legacy, returns first match or null.
- Added `memberSubDirFromProfile()` module-level helper: detects flat vs nested profile structure and returns the correct dated-files parent directory.
- Replaced `createMemberFile` hardcoded path + throw-on-missing with global resolver + FR24 auto-create path.
- Updated `createMemberFile` describe `beforeEach` in unit tests to prime `exists()` with 3-call sequence for nested profile (false/false/true), keeping all pre-existing test assertions intact.
- All 960 tests pass, `npm run validate` exits 0.

## File List

- `src/services/member.service.ts` (modified)
- `tests/services/member.service.test.ts` (modified)
- `tests/integration/member.integration.test.ts` (modified)

## Change Log

- 2026-05-10: Story 3.3 created — global email resolver, auto-create on unknown email, MEM-INT-001 through MEM-INT-005 integration tests
- 2026-05-10: Implementation complete — `findMemberGlobally`, `memberSubDirFromProfile`, updated `createMemberFile`; 960/960 tests passing; status → review
