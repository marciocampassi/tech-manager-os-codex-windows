# Story 8.3: Implement domain check and contractor routing in tmr member add

Status: done

## Story

As an engineering manager adding external collaborators via `tmr member add <email>`,
I want the system to detect that the email domain is not in my organization's internal domain list and prompt me to route the person as a contractor or a company member,
so that contractor profiles are placed in the correct directory (`my-company/contractors/`) automatically without me having to remember to pass `--contractor`.

## Acceptance Criteria

1. **MEM-INT-006 (domain prompt):** When `tmr member add external@agency.com` is run and `agency.com` is NOT in `config/organization.yaml internal_domains`, the user is prompted to route to contractors (default) or company members.
2. **MEM-INT-007 (contractor profile):** When the user selects contractors at the prompt (or passes `--contractor`), the profile is written to `my-company/contractors/<email>/<email>.md` with `relationship: contractor` and `company: <value>` in frontmatter.
3. **MEM-UNIT-012 (flag bypass):** When `--contractor` is passed, no domain-check prompt is shown — the profile routes directly to the contractor path.
4. **Internal domain fallthrough:** When `tmr member add alice@gmail.com` is run and `gmail.com` IS in `config/organization.yaml internal_domains`, no prompt is shown and routing is unchanged (existing FR18 behavior).
5. **Missing org.yaml fallthrough:** When `config/organization.yaml` does not exist, no prompt is shown and routing is unchanged (existing FR18 behavior preserved — no breaking change).
6. No existing passing tests are broken.

## Tasks / Subtasks

- [x] Task 1 — Add `company?: string` to `IAddMemberOptions` and update `addMember()` frontmatter (AC: #2)
  - [x] Add `company?: string` field to `IAddMemberOptions` in `src/types/member.types.ts`
  - [x] In `MemberService.addMember()`, include `company: opts.company` in frontmatter when `opts.contractor` is true and `opts.company` is provided
- [x] Task 2 — Add `getInternalDomains()` to `MemberService` (AC: #1, #4, #5)
  - [x] Add `async getInternalDomains(workspaceRoot: string): Promise<string[]>` public method
  - [x] Reads `config/organization.yaml` with `this._fs.readFile()`; returns `[]` if file does not exist
  - [x] Parses the `internal_domains:` YAML list with simple line-by-line parsing (no new dep: see Dev Notes)
- [x] Task 3 — Add domain-check + prompt to `runMemberAdd` in `member.command.ts` (AC: #1, #3, #4, #5)
  - [x] After resolving email in email-creation mode, if `opts.contractor` is NOT already set: call `svc.getInternalDomains(ws)`, extract domain from email, check membership
  - [x] If domain is external (not in list) AND list is non-empty: prompt using inquirer `list` for routing choice (contractors default) then prompt for company name
  - [x] If routing choice is contractors: set `contractor: true`, pass company name to `addMember`
  - [x] If routing choice is company member: proceed without `contractor: true`
  - [x] `--contractor` flag: skip domain check entirely, prompt only for company name
- [x] Task 4 — Add unit tests to `tests/services/member.service.test.ts` (AC: #2, #3, #5)
  - [x] Test `getInternalDomains` returns `[]` when org.yaml does not exist
  - [x] Test `getInternalDomains` parses and returns domain list when org.yaml exists
  - [x] Test MEM-UNIT-012: `addMember` with `{ contractor: true }` routes to contractor path (already implicitly covered by existing code, but add explicit test with `company` field)
  - [x] Test contractor profile frontmatter includes `company` field when `opts.company` is provided
- [x] Task 5 — Add command-layer tests to `tests/commands/member.command.test.ts` (AC: #1, #3, #4)
  - [x] Test: external domain + no `--contractor` → prompt is shown, routes to contractor when user picks contractor
  - [x] Test: external domain + no `--contractor` → routes to company member when user picks member
  - [x] Test: `--contractor` flag → no domain-check prompt, routes directly
  - [x] Test: internal domain (mocked `getInternalDomains` returns domain) → no prompt
- [x] Task 6 — Run tests and confirm no regressions (AC: #6)
  - [x] Run `npm test -- --testPathPattern="member"` to confirm all member tests pass
  - [x] Run `npm test` to confirm no regressions across the full suite

### Review Findings (AI)

- [x] [Review][Patch] Case-sensitive domain comparison — `internalDomains.includes(domain)` is case-sensitive; RFC 5321 says the domain part is case-insensitive; user could type `USER@INTERNAL.COM` and bypass the check [`src/services/member.service.ts`, `src/commands/member.command.ts`] — fixed: `toLowerCase()` in `getInternalDomains` push; added RFC 5321 unit test
- [x] [Review][Patch] Uncaught I/O error from `getInternalDomains` crashes the command — the call sits outside the try/catch block; a permissions failure on `config/organization.yaml` propagates as an unhandled rejection [`src/commands/member.command.ts`] — fixed: wrapped in try/catch with graceful skip; added command test for EACCES scenario
- [x] [Review][Patch] Duplicate test label `MEM-UNIT-012` — two distinct tests share the same ID, breaking traceability in CI and test reports [`tests/services/member.service.test.ts`] — fixed: second test renamed to MEM-UNIT-013
- [x] [Review][Patch] `--contractor` bypass test never asserts routing prompt was *not* called — the test verifies `addMember` was called correctly but a missing `expect(mockPrompt).toHaveBeenCalledTimes(2)` means the routing prompt could fire and the test would still pass [`tests/commands/member.command.test.ts`] — fixed: assertion added
- [x] [Review][Patch] Company field assertion too broad — `expect(written).toContain('Agency Corp')` passes if the name appears anywhere in the file; should assert `toContain('company: Agency Corp')` to verify the key-value pair [`tests/services/member.service.test.ts`] — fixed
- [x] [Review][Defer] YAML flow-sequence format `[gmail.com, corp.com]` silently yields `[]` [`src/services/member.service.ts`] — deferred, hand-rolled parser is scoped to the format written by `InitService`; inline array is not generated by the tool
- [x] [Review][Defer] Inline YAML comments folded into domain value (e.g. `- gmail.com # note`) [`src/services/member.service.ts`] — deferred, same format constraint as above
- [x] [Review][Defer] No `--company` CLI flag for non-interactive scripting — deferred, no AC requires it; out of story scope
- [x] [Review][Defer] `--team` + domain-routed contractor writes unexpected `manager:` field in frontmatter [`src/commands/member.command.ts`] — deferred, pre-existing design gap requiring a UX decision; out of scope
- [x] [Review][Defer] Routing prompt label hardcodes `my-company/members/` even when `--team` is active [`src/commands/member.command.ts`] — deferred, minor UX gap not covered by any AC

## Dev Notes

### YAML parsing for organization.yaml — no new dependencies

`config/organization.yaml` is written by `InitService.writeOrgConfig()` as:
```yaml
internal_domains:
  - gmail.com
```

Do NOT add `js-yaml` or `yaml` as a new dependency. Parse with simple line-by-line logic:

```typescript
async getInternalDomains(workspaceRoot: string): Promise<string[]> {
  const orgPath = path.join(workspaceRoot, 'config', 'organization.yaml');
  if (!(await this._fs.exists(orgPath))) return [];
  const content = await this._fs.readFile(orgPath);
  const lines = content.split('\n');
  let inDomains = false;
  const domains: string[] = [];
  for (const line of lines) {
    if (line.trim() === 'internal_domains:' || line.trim().startsWith('internal_domains:')) {
      inDomains = true;
      continue;
    }
    if (inDomains) {
      const match = line.match(/^\s+-\s+(.+)$/);
      if (match?.[1]) {
        domains.push(match[1].trim());
      } else if (line.trim() && !line.startsWith(' ') && !line.startsWith('\t')) {
        inDomains = false;
      }
    }
  }
  return domains;
}
```

This is robust for the fixed format. Place this after `addMember()` in the `// ── Public API ──` section.

### Contractor path — DO NOT change

The existing contractor path is `my-company/contractors/<email>/<email>.md` (nested). This is what `addMember()` already writes and `findMemberGlobally()` already searches. **Do NOT change it** even though `epics.md` Story 3.2 line 738 and the sprint change proposal mention `my-company/contractors/members/`. Story 3.2 is `done` with the nested path; existing tests pass with this path. Keep the nested path.

Path from `addMember()` (current — DO NOT modify this path):
```typescript
path.join(workspaceRoot, 'my-company', 'contractors', normalizedEmail, `${normalizedEmail}.md`)
```

### addMember() frontmatter change (minimal)

Only add the `company` field. Current contractor frontmatter block:
```typescript
...(opts.contractor ? { relationship: 'contractor' } : {}),
```

Target (add `company` conditionally):
```typescript
...(opts.contractor
  ? { relationship: 'contractor', ...(opts.company ? { company: opts.company } : {}) }
  : {}),
```

### Domain-check flow in runMemberAdd (email-creation mode only)

The domain check applies ONLY in the email-creation branch of `runMemberAdd` (the `if (isEmail(typeArg))` block). It must NOT affect the type-first mode (1on1/feedback/assessment/performance-review).

Exact placement — after inquirer collects name/gender/role and BEFORE calling `svc.addMember()`:

```typescript
// ── Domain check (only when --contractor not already set) ────────────────
if (!opts.contractor) {
  const domain = email.split('@')[1] ?? '';
  const internalDomains = await svc.getInternalDomains(ws);
  if (internalDomains.length > 0 && domain && !internalDomains.includes(domain)) {
    const { routing } = await inquirer.prompt<{ routing: 'contractor' | 'member' }>([{
      type: 'list',
      name: 'routing',
      message: `${email} looks external (${domain}). Route to:`,
      choices: [
        { name: 'Contractors  (my-company/contractors/)', value: 'contractor' },
        { name: 'Company members  (my-company/members/)', value: 'member' },
      ],
      default: 'contractor',
    }]);
    if (routing === 'contractor') {
      opts = { ...opts, contractor: true };
    }
  }
}

// ── If routing to contractor, collect company name ────────────────────────
let company: string | undefined;
if (opts.contractor) {
  const { companyName } = await inquirer.prompt<{ companyName: string }>([{
    type: 'input',
    name: 'companyName',
    message: 'Company name (optional):',
  }]);
  company = companyName.trim() || undefined;
}
```

Then pass `company` to `svc.addMember()`:
```typescript
result = await svc.addMember(email, { ...existingOpts, company }, ws);
```

Note: `opts` in the existing code is typed as `{ date?: string; team?: string; location?: string; contractor?: boolean }`. We're reading `opts.contractor` and `opts.team` etc. from the commander-parsed object, then building the `addMember` call. The `company` is added on top.

### Prompt for company name when --contractor passed directly

When `--contractor` is set (no domain check needed), still prompt for company name. This ensures contractor profiles always get the `company` field when `--contractor` is used explicitly. The company name prompt applies in BOTH cases:
- User is routed to contractor via domain check prompt
- User passed `--contractor` flag directly

### Current runMemberAdd structure (current lines 29-78 in member.command.ts)

```typescript
export async function runMemberAdd(
  svc: MemberService,
  typeArg: string,
  emailArg: string | undefined,
  opts: { date?: string; team?: string; location?: string; contractor?: boolean },
): Promise<void> {
  if (isEmail(typeArg)) {
    const email = typeArg.trim().toLowerCase();
    const { name, gender, role } = await inquirer.prompt<...>([...]);
    const ws = svc.getWorkspaceRoot();
    let result;
    try {
      result = await svc.addMember(email, { team, location, contractor, name, gender, role }, ws);
    } catch (err) { ... }
    ...
  }
}
```

The domain check block goes AFTER name/gender/role prompts and BEFORE `svc.addMember()` call.

### Unit test pattern for getInternalDomains (in member.service.test.ts)

```typescript
describe('getInternalDomains', () => {
  it('returns [] when organization.yaml does not exist', async () => {
    mockFS.exists.mockResolvedValue(false);
    const result = await svc.getInternalDomains(WS);
    expect(result).toEqual([]);
  });

  it('parses internal_domains list from organization.yaml', async () => {
    mockFS.exists.mockResolvedValue(true);
    mockFS.readFile.mockResolvedValue(
      'internal_domains:\n  - gmail.com\n  - techcorp.com\n'
    );
    const result = await svc.getInternalDomains(WS);
    expect(result).toEqual(['gmail.com', 'techcorp.com']);
  });
});
```

### Unit test pattern for contractor frontmatter with company (in member.service.test.ts)

```typescript
it('MEM-UNIT-012: contractor profile includes relationship: contractor and company field', async () => {
  await svc.addMember('ext@agency.com', { contractor: true, company: 'Agency Corp' }, WS);

  const written = (mockFS.writeFile.mock.calls[0] as [string, string])[1];
  expect(written).toContain('relationship: contractor');
  expect(written).toContain('company: Agency Corp');
  expect(mockFS.writeFile).toHaveBeenCalledWith(
    expect.stringContaining('my-company/contractors/ext@agency.com/ext@agency.com.md'),
    expect.any(String),
  );
});
```

### Command test pattern (in member.command.test.ts)

The existing test file already mocks `inquirer` via `mockPrompt`. The mock needs to handle multiple `prompt` calls:

```typescript
it('shows routing prompt and routes to contractor when external domain detected', async () => {
  // Mock: getInternalDomains returns ['internal.com'], email is external@agency.com
  const mockGetInternalDomains = jest.fn().mockResolvedValue(['internal.com']);
  mockMemberServiceInstance.getInternalDomains = mockGetInternalDomains;

  // Prompt calls: 1) name/gender/role, 2) routing, 3) company name
  mockPrompt
    .mockResolvedValueOnce({ name: '', gender: '', role: '' })  // name/gender/role
    .mockResolvedValueOnce({ routing: 'contractor' })           // routing
    .mockResolvedValueOnce({ companyName: 'Agency Corp' });     // company name

  await runMemberAdd(mockMemberServiceInstance as any, 'external@agency.com', undefined, {});

  expect(mockAddMember).toHaveBeenCalledWith(
    'external@agency.com',
    expect.objectContaining({ contractor: true, company: 'Agency Corp' }),
    '/fake/ws',
  );
});
```

Note: `mockMemberServiceInstance` in the existing test file does NOT have `getInternalDomains`. Add it to the mock at the top of the test file or in each test that needs it.

### Architecture Compliance

- `getInternalDomains()` uses `this._fs.exists()` and `this._fs.readFile()` — both already in `FileSystemService` and mocked in tests
- No new imports in `member.service.ts` (`path` already imported)
- All inquirer interaction stays in `member.command.ts` — service layer remains pure
- Follow the `// ── Section Name ──` comment divider convention
- No `console.log` — all output via `printSuccess`/`printError` or `process.stdout.write`
- ESM: no changes to import list needed in service; `member.command.ts` already imports `inquirer`

### Previous Story Intelligence (Story 8.2)

- Mock FS `readFile` is already in `MockFS` type and `createMockFS()` — use it directly for `getInternalDomains` tests
- Story 8.2 established that `path.join` inline calls are fine without named helpers for simple cases
- Integration tests use real filesystem via `fs.mkdtempSync` — create org.yaml manually in integration tests

### References

- [Source: `src/services/member.service.ts` lines 156–203] — `addMember()` to modify
- [Source: `src/types/member.types.ts` lines 53–61] — `IAddMemberOptions` to extend
- [Source: `src/commands/member.command.ts` lines 29–78] — `runMemberAdd()` to modify
- [Source: `tests/services/member.service.test.ts` lines 273–380] — existing `addMember` tests
- [Source: `tests/commands/member.command.test.ts` lines 1–60] — mock setup pattern
- [Source: `_bmad-output/planning-artifacts/epics.md` Story 3.2 lines 732–762] — FR41, FR42 spec
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-19-uat-bug-fixes.md` Story 8.3]
- [Source: `_bmad-output/implementation-artifacts/uat-bug-report.md` BUG-001]

## Dev Agent Record

### Agent Model Used

Sonnet 4.6

### Debug Log References

- Mock ordering issue discovered: Jest `clearAllMocks()` does NOT clear `mockResolvedValueOnce` queue (`specificReturnValues`); incorrect prompt mock order caused queue leakage into subsequent tests. Fixed by aligning all `mockResolvedValueOnce` sequences to match actual prompt order: (1) name/gender/role, (2) routing, (3) company.

### Completion Notes List

- Added `company?: string` to `IAddMemberOptions` in `src/types/member.types.ts`.
- Updated `MemberService.addMember()` frontmatter spread to include `company` field when `opts.contractor && opts.company`.
- Added `MemberService.getInternalDomains(workspaceRoot)` using line-by-line YAML parsing — no new dependency. Stops parsing at next top-level key to avoid reading unrelated sections.
- Updated `runMemberAdd` in `member.command.ts`: domain check fires in email-first mode only; when domain is external and list is non-empty, inquirer `list` prompt defaults to contractor; company name prompt fires whenever `isContractor` is true (either via flag or routing choice).
- 9 new unit tests in `member.service.test.ts` (getInternalDomains: 5 tests; contractor path/frontmatter: 4 tests).
- 6 new command-layer tests in `member.command.test.ts` covering FR41/FR42 domain-check scenarios.
- Full regression: 68 suites, 1092 tests — all green.

### File List

- `src/types/member.types.ts` — MODIFY (added `company?: string` to `IAddMemberOptions`)
- `src/services/member.service.ts` — MODIFY (added `getInternalDomains()`, updated `addMember()` frontmatter)
- `src/commands/member.command.ts` — MODIFY (added domain-check + routing prompt in `runMemberAdd`)
- `tests/services/member.service.test.ts` — MODIFY (added `getInternalDomains` tests + contractor company field tests)
- `tests/commands/member.command.test.ts` — MODIFY (added `mockGetInternalDomains`, domain-check routing tests)

### Change Log

- Implemented Story 8.3: domain check and contractor routing for `tmr member add` (FR41, FR42). Date: 2026-05-19
