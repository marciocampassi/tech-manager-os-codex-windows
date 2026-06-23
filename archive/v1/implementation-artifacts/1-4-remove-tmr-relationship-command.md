# Story 1.4: Remove `tmr relationship` Command

Status: done

## Story

As a `tmr` user,
I want `tmr relationship` to be completely absent from the CLI — no help entry, no registered command, no source files,
so that the command vocabulary is clean and the codebase contains no dead code referencing a removed feature.

## Acceptance Criteria

1. `src/commands/relationship.command.ts` is deleted and `src/cli.ts` no longer imports or registers it.
2. `src/services/relationship.service.ts` is deleted and no remaining source file under `src/` imports from it.
3. `EmailResolutionService._doResolve()` step 4 (auto-create fallback) is re-routed to write a company-scoped member profile directly to `my-company/members/<email>/<email>.md` using the injected `FileSystemService` — `RelationshipService` is no longer a constructor dependency of `EmailResolutionService`.
4. `tmr --help` output does not contain the word "relationship" anywhere (REL-NEG-001).
5. `tmr relationship` invocation produces an "unrecognized command" / "Unknown command" error (REL-NEG-002).
6. `tests/commands/relationship.command.test.ts`, `tests/services/relationship.service.test.ts`, and `tests/integration/relationship.integration.test.ts` are all deleted (REL-NEG-003/004).
7. `tests/cli.test.ts` contains a new test asserting `tmr --help` output does not contain "relationship" (REL-NEG-001 guard).
8. All existing team and member tests continue to pass — no regressions (REL-NEG-005).
9. `npm run validate` exits 0.

## Tasks / Subtasks

- [x] Delete the three relationship test files (AC: 6)
  - [x] Delete `tests/commands/relationship.command.test.ts`
  - [x] Delete `tests/services/relationship.service.test.ts`
  - [x] Delete `tests/integration/relationship.integration.test.ts`

- [x] Reroute `EmailResolutionService` auto-create fallback and remove `RelationshipService` dependency (AC: 3)
  - [x] Remove `import { RelationshipService, relationshipService } from './relationship.service.js'` from `src/services/email-resolution.service.ts`
  - [x] Remove `private readonly _relationship: RelationshipService` from the constructor signature
  - [x] Replace step 4 in `_doResolve()` with the inline shim (see Dev Notes for exact code)
  - [x] Change `emailResolutionService` singleton instantiation to `new EmailResolutionService(fileSystemService)` (remove `relationshipService` argument)

- [x] Update `tests/services/email-resolution.service.test.ts` to remove `RelationshipService` mock (AC: 3, 8)
  - [x] Remove `import type { RelationshipService }` line
  - [x] Remove `MockRelationship` type alias and `createMockRelationship()` helper
  - [x] Remove `mockRel` variable declaration and its `createMockRelationship()` init in `beforeEach`
  - [x] Change `new EmailResolutionService(mockFS..., mockRel...)` → `new EmailResolutionService(mockFS...)`
  - [x] Update "auto-creates relationship" test: assert `mockFS.createDirectory` and `mockFS.writeFile` called (not `mockRel.addRelationship`)

- [x] Delete source and type files (AC: 1, 2)
  - [x] Delete `src/commands/relationship.command.ts`
  - [x] Delete `src/services/relationship.service.ts`
  - [x] Delete `src/types/relationship.types.ts` (orphaned — only imported by the two deleted files)

- [x] Update `src/cli.ts` (AC: 1, 4)
  - [x] Remove static import: `import { createRelationshipCommand } from './commands/relationship.command.js';`
  - [x] Remove: `p.addCommand(createRelationshipCommand());`
  - [x] Update `show <email>` description: remove ", relationships" → `'display profile for an email address (searches teams, leadership)'`

- [x] Fix dangling `tmr relationship add` reference in `src/commands/team.command.ts` (AC: 4 / NFR3)
  - [x] Line 220: change `"Use 'tmr team add' or 'tmr relationship add' to create one."` → `"Use 'tmr team add' to create a profile."`

- [x] Add REL-NEG-001 and REL-NEG-002 tests to `tests/cli.test.ts` (AC: 7)
  - [x] Add `describe('CLI — relationship command removed')` block with REL-NEG-001 (help output check) and REL-NEG-002 (unrecognized command check)

- [x] Run `npm run validate` — all four steps must pass (AC: 9)

### Review Findings

- [x] [Review][Patch] YAML injection via unescaped email in inline frontmatter template [src/services/email-resolution.service.ts:113]
- [x] [Review][Patch] Missing `result.absolutePath` assertion in auto-create unit test [tests/services/email-resolution.service.test.ts:140-154]
- [x] [Review][Patch] REL-NEG-002 test missing `exitSpy.toHaveBeenCalledWith(1)` assertion [tests/cli.test.ts:136]
- [x] [Review][Defer] `as string` type assertion masks potential undefined on `split()[0]` [src/services/email-resolution.service.ts:108] — deferred, pre-existing pattern
- [x] [Review][Defer] Spy cleanup not in `finally`/`afterEach` — test spy leak on assertion failure [tests/cli.test.ts] — deferred, pre-existing pattern
- [x] [Review][Defer] TOCTOU race between step-3 `exists()` guard and step-4 `writeFile()` [src/services/email-resolution.service.ts:103-115] — deferred, pre-existing design concern
- [x] [Review][Defer] Partial-write leaves orphaned `1on1s/` dir if `writeFile` throws after `createDirectory` succeeds [src/services/email-resolution.service.ts:110-114] — deferred, same behavior as deleted code

## Dev Notes

### Auto-Create Fallback Shim (CRITICAL — read the implementation note)

Replace the current step 4 in `EmailResolutionService._doResolve()`:

**BEFORE (current code):**
```ts
// 4. Not found — auto-create as relationship
await this._relationship.addRelationship(email, {}, ws);
return { type: 'relationship', absolutePath: relProfile, created: true };
```

**AFTER (inline shim):**
```ts
// 4. Not found — auto-create as company-scoped member profile (ISSUE-m1 shim).
// TODO(Story 3.2): replace with MemberService.addMember(email) — do NOT make this inline logic permanent.
const today = new Date().toISOString().split('T')[0] as string;
await this._fs.createDirectory(path.join(ws, 'my-company', 'members', email, '1on1s'));
await this._fs.writeFile(
  relProfile,
  `---\nemail: "${email}"\nname: ""\nrole: ""\ndepartment: ""\nrelationship_type: ""\ndate_added: "${today}"\n---\n\n# Relationship — ${email}\n\n## Notes\n\n## 1on1s\n`,
);
return { type: 'relationship', absolutePath: relProfile, created: true };
```

**Why `relProfile` already exists:** It is defined in step 3 of `_doResolve()`:
```ts
const relProfile = path.join(ws, 'my-company', 'members', email, `${email}.md`);
```
No new path variable needed. `path.join(ws, 'my-company', 'members', email, '1on1s')` is just `path.dirname(relProfile)` + `'/1on1s'`.

**Why this shim:** The auto-create fallback previously delegated to `RelationshipService.addRelationship()` which wrote to `my-company/members/<email>/<email>.md`. The inline shim replicates exactly that behavior without the service dependency. This is explicitly temporary — Story 3.2 will replace it with `MemberService.addMember(email)`.

**Do NOT import gray-matter** for the shim. The inline template string is intentional — minimal and explicit.

### `EmailResolutionService` Constructor — Before and After

**BEFORE:**
```ts
import { RelationshipService, relationshipService } from './relationship.service.js';
// ...
export class EmailResolutionService {
  constructor(
    private readonly _fs: FileSystemService,
    private readonly _relationship: RelationshipService,
  ) {}
}
export const emailResolutionService = new EmailResolutionService(
  fileSystemService,
  relationshipService,
);
```

**AFTER:**
```ts
// relationship.service import REMOVED entirely
// ...
export class EmailResolutionService {
  constructor(private readonly _fs: FileSystemService) {}
}
export const emailResolutionService = new EmailResolutionService(fileSystemService);
```

### `tests/services/email-resolution.service.test.ts` — Mock Wiring Changes

The test file currently creates `EmailResolutionService` with two mocks:
```ts
svc = new EmailResolutionService(
  mockFS as unknown as FileSystemService,
  mockRel as unknown as RelationshipService,  // REMOVE
);
```

**Remove completely:**
- `import type { RelationshipService } from '../../src/services/relationship.service.js';`
- `type MockRelationship = { addRelationship: ... };`
- `function createMockRelationship(): MockRelationship { ... }`
- `let mockRel: MockRelationship;` declaration
- `mockRel = createMockRelationship();` in `beforeEach`
- Second argument to `new EmailResolutionService(...)`

**Update the auto-create test** (currently at line ~160):
```ts
it('auto-creates relationship and returns created: true when email not found anywhere', async () => {
  // All exists() calls return false by default (mock setup)
  const result = await svc.resolve('new@co.com', WS);
  expect(result.type).toBe('relationship');
  expect(result.created).toBe(true);
  // NEW assertions — verify inline shim was called:
  expect(mockFS.createDirectory).toHaveBeenCalledWith(
    expect.stringContaining(path.join('my-company', 'members', 'new@co.com', '1on1s')),
  );
  expect(mockFS.writeFile).toHaveBeenCalledWith(
    expect.stringContaining(path.join('my-company', 'members', 'new@co.com', 'new@co.com.md')),
    expect.stringContaining('email: "new@co.com"'),
  );
});
```

The "resolves to relationship when relationship exists" test (line ~145) does NOT call `addRelationship` — it just returns the found path. No changes needed for that test beyond removing the mock wiring.

### Files to Delete — Complete List

| File | Why |
|---|---|
| `src/commands/relationship.command.ts` | Entire command removed per FR32 |
| `src/services/relationship.service.ts` | Service removed; no remaining callers |
| `src/types/relationship.types.ts` | Orphaned — only imported by the two deleted files above |
| `tests/commands/relationship.command.test.ts` | REL-NEG-003 |
| `tests/services/relationship.service.test.ts` | REL-NEG-004 |
| `tests/integration/relationship.integration.test.ts` | REL-NEG-004 |

### Files NOT in scope for this story

- `src/commands/project.command.ts` — lines 106, 146, 182, 222 reference "Auto-created relationship profile" in user output strings. These are completion messages, not help text or registered commands. Leave untouched; Epic 3 will update them when `MemberService` is finalized.
- `src/services/template.service.ts` — contains `getRelationship1on1Template()` which becomes unreachable after `RelationshipService` is deleted. Leave the method — removing dead template methods is a cleanup for a future refactor pass, not required by this story's AC.
- `src/types/project.types.ts` — `type: '...' | 'relationship'` literal union; `IEntityLocation` in `email-resolution.types.ts` still uses `type: 'relationship'` for company-scoped members. Leave untouched.

### `src/cli.ts` — Exact Lines to Change

```ts
// LINE 8 — REMOVE this entire line:
import { createRelationshipCommand } from './commands/relationship.command.js';

// LINE 51 — REMOVE this line:
p.addCommand(createRelationshipCommand());

// LINE 60 — UPDATE description:
// BEFORE: 'display profile for an email address (searches teams, leadership, relationships)'
// AFTER:  'display profile for an email address (searches teams, leadership)'
```

### `tests/cli.test.ts` — New Tests to Add

Add at the end of the file, after the `'CLI — stub commands'` describe block:

```ts
describe('CLI — relationship command removed (REL-NEG)', () => {
  it('REL-NEG-001: --help output does not contain "relationship"', () => {
    const chunks: string[] = [];
    const stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      chunks.push(String(chunk));
      return true;
    });
    program.outputHelp();
    stdoutSpy.mockRestore();
    expect(chunks.join('')).not.toMatch(/relationship/i);
  });

  it('REL-NEG-002: "tmr relationship" produces unrecognized command error', () => {
    const stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const exitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation((_code?: string | number | null | undefined) => {
        throw new Error('process.exit called');
      });

    expect(() => {
      program.parse(['node', 'tmr', 'relationship']);
    }).toThrow('process.exit called');

    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown command'));

    stderrSpy.mockRestore();
    exitSpy.mockRestore();
  });
});
```

### `docs/architecture.md` — Already Clean

The static import table at line 211 already reads:
```
| config, team, member, leadership, project, task-view | init, process, watch, install, update |
```
`relationship` is not listed. The AC that references updating this doc is already satisfied — no change needed.

### Scope Boundary

**This story does NOT:**
- Remove the `location: 'relationship'` string literal type from `src/types/project.types.ts` (still used by `EmailResolutionService._doResolve` return value)
- Remove `type: 'self' | 'team' | 'leadership' | 'relationship'` from `IEntityLocation` — type still reflects what `_doResolve` returns
- Touch `project.service.ts` callers of `emailResolutionService.generateWikiLink()` (that's Epic 3)
- Replace the ISSUE-m1 shim in `_doResolve` with `MemberService.addMember()` (that's Story 3.2 — explicitly noted with TODO comment)

### Regression Safety Checklist

Before marking done, verify:
1. `tmr relationship` → "Unknown command" (test covered by REL-NEG-002)
2. `tmr --help` → no "relationship" in output (test covered by REL-NEG-001)
3. `tests/services/email-resolution.service.test.ts` — all tests pass with the new constructor signature
4. `tests/integration/email-resolution.integration.test.ts` — check if this file also references `RelationshipService` and needs updates
5. `tests/integration/project.integration.test.ts` — auto-create path exercises `_doResolve` step 4; ensure the shim produces a valid file structure that the integration test accepts

### ESM Import Rules

```ts
// When updating imports, remember the .js extension rule:
import { FileSystemService, fileSystemService } from './file-system.service.js';  // ✓
// NOT: './file-system.service' or './file-system.service.ts'
```

### Project Structure Notes

| Action | Path |
|--------|------|
| DELETE | `src/commands/relationship.command.ts` |
| DELETE | `src/services/relationship.service.ts` |
| DELETE | `src/types/relationship.types.ts` |
| DELETE | `tests/commands/relationship.command.test.ts` |
| DELETE | `tests/services/relationship.service.test.ts` |
| DELETE | `tests/integration/relationship.integration.test.ts` |
| UPDATE | `src/cli.ts` |
| UPDATE | `src/services/email-resolution.service.ts` |
| UPDATE | `tests/services/email-resolution.service.test.ts` |
| UPDATE | `src/commands/team.command.ts` |
| UPDATE | `tests/cli.test.ts` |

### References

- Epic 1, Story 1.4 AC + implementation note (ISSUE-m1): `_bmad-output/planning-artifacts/epics.md` lines 326–371
- NFR3 (zero dangling references): `_bmad-output/planning-artifacts/epics.md` line 67
- Quality gates REL-NEG-001/002: `_bmad-output/planning-artifacts/epics.md` line 103
- `RelationshipService.addRelationship()` being replicated: `src/services/relationship.service.ts` lines 74–93
- `EmailResolutionService._doResolve()` being patched: `src/services/email-resolution.service.ts` lines 82–110
- Constructor mock wiring to strip: `tests/services/email-resolution.service.test.ts` lines 27–57
- ESM import rule: `_bmad-output/project-context.md` §Language-Specific Rules
- Story 1.2 delete-then-update pattern (for reference): `_bmad-output/implementation-artifacts/1-2-entity-slug-normalization-utility.md`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None — implementation proceeded cleanly with one fix required: the `leadership` command description contained the word "relationships" which caused REL-NEG-001 to fail. Fixed by updating the description from "manage leadership relationships" to "manage leadership profiles".

### Completion Notes List

- Deleted all 6 relationship files (3 source, 3 test) as specified.
- Replaced `RelationshipService.addRelationship()` delegation in `_doResolve()` step 4 with the inline ISSUE-m1 shim that writes directly to `my-company/members/<email>/<email>.md` via `FileSystemService`. Marked with TODO(Story 3.2) per spec.
- `EmailResolutionService` constructor now takes only `FileSystemService`; singleton instantiation updated accordingly.
- Updated unit test (`email-resolution.service.test.ts`) to remove `MockRelationship` wiring and assert the inline shim calls `createDirectory` + `writeFile`.
- Updated integration tests (`email-resolution.integration.test.ts`, `project.integration.test.ts`) to remove `RelationshipService` construction.
- `src/cli.ts`: removed `createRelationshipCommand` import and `p.addCommand()` call; updated `show <email>` description.
- `src/commands/team.command.ts`: removed dangling "tmr relationship add" reference in `runShow` not-found message.
- `src/commands/leadership.command.ts`: changed description from "manage leadership relationships" to "manage leadership profiles" to satisfy REL-NEG-001 regex check.
- Added `describe('CLI — relationship command removed (REL-NEG)')` block to `tests/cli.test.ts` with REL-NEG-001 and REL-NEG-002.
- All 831 tests pass; lint, typecheck, and build all green.

### File List

**Deleted:**
- `src/commands/relationship.command.ts`
- `src/services/relationship.service.ts`
- `src/types/relationship.types.ts`
- `tests/commands/relationship.command.test.ts`
- `tests/services/relationship.service.test.ts`
- `tests/integration/relationship.integration.test.ts`

**Modified:**
- `src/services/email-resolution.service.ts`
- `src/cli.ts`
- `src/commands/team.command.ts`
- `src/commands/leadership.command.ts`
- `tests/services/email-resolution.service.test.ts`
- `tests/integration/email-resolution.integration.test.ts`
- `tests/integration/project.integration.test.ts`
- `tests/cli.test.ts`

## Change Log

- 2026-05-09: Story 1.4 implemented — removed `tmr relationship` command, rerouted `EmailResolutionService` auto-create fallback to inline ISSUE-m1 shim, cleaned all dead relationship code and tests. All 831 tests pass, `npm run validate` exits 0.
