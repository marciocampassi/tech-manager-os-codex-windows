---
title: 'Warn when `tmr member add feedback --from <email>` auto-creates a reviewer profile'
type: 'feature'
created: '2026-06-15'
status: 'done'
baseline_commit: 15c6c95
context: []
---

## Changelog

- 2026-06-15: Implemented warn-only notice for `--from` reviewer auto-create.
  `ICreateFileResult` gained optional `createdReviewer`; `_buildDatedFileLinks` now returns
  `{ links, createdReviewer? }` and threads `reviewer.created` up to `createMemberFile`; the
  command prints `ℹ Reviewer <email> didn't exist — created a new profile: <path>` only when a
  profile was actually created. 3 service tests + 2 command tests added. Full suite green:
  tsc clean, eslint clean (src), 1458/1458 jest. All ACs met.

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `tmr member add feedback <member> --from <reviewer>` silently auto-creates a
company-scoped stub profile for the reviewer (`my-company/members/<reviewer>/...`) when the
reviewer doesn't already exist (the B5 fix — needed so the `from` wiki-link isn't dangling).
A typo in `--from` therefore creates a "ghost" profile with no visible feedback, surprising
the user.

**Approach:** Surface the auto-create as an informational line in the command output (warn-only,
non-blocking — chosen over a confirmation prompt to keep the command non-interactive and
scriptable). The `EmailResolutionService` already returns `created: boolean`; thread that flag
up through `MemberService.createMemberFile` and print a notice when a reviewer profile was newly
created.

**Human decision:** warn-only (no confirmation prompt).

## Boundaries & Constraints

**Always:**
- Only emit the notice when a reviewer profile was actually created during this run
  (`reviewer.created === true`) — never on resolution of an existing reviewer.
- Keep behavior identical otherwise; this is additive output + a return-field, no flow change.

**Never:**
- Do not block, prompt, or change exit code for the auto-create case.
- Do not change where/how the reviewer profile is created (resolution logic untouched).
- Do not emit the notice for non-feedback types (`with`/self link path).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior |
|----------|--------------|---------------------------|
| New reviewer | `--from novo@co.com` (not found anywhere) | File + profile created as today; PLUS notice: `ℹ Created reviewer profile: <path>` |
| Existing reviewer | `--from jane@co.com` (already a team member) | No notice; output unchanged |
| Self as reviewer | `--from` defaults to self / self exists | No notice (self profile already exists) |
| Non-feedback type | `1on1` / `assessment` / `performance-review` | No notice (no `from`) |

## Code Map

| File | Change |
|------|--------|
| `src/types/member.types.ts` | ADD optional `createdReviewer?: { email: string; path: string }` to `ICreateFileResult` |
| `src/services/member.service.ts` | `_buildDatedFileLinks` returns `{ links, createdReviewer? }`; `createMemberFile` threads it into the result |
| `src/commands/member.command.ts` | Print `ℹ Created reviewer profile: <path>` when `result.createdReviewer` is set |
| `tests/services/member.service.test.ts` | Assert `createdReviewer` populated on auto-create, absent on existing reviewer |
| `tests/commands/member.command.test.ts` | Assert notice printed on auto-create, absent otherwise |

## Tasks

1. Type: add `createdReviewer` to `ICreateFileResult`.
2. Service: surface `reviewer.created` via `_buildDatedFileLinks` → `createMemberFile`.
3. Command: print the notice.
4. Tests (service + command).
5. Validate: tsc, eslint, jest.

## Acceptance Criteria

- AC1: When `--from` resolves to a newly-created reviewer profile, `createMemberFile` returns
  `createdReviewer: { email, path }` and the command prints an informational notice with the path.
- AC2: When the reviewer already exists, `createdReviewer` is undefined and no notice is printed.
- AC3: Non-feedback types never set `createdReviewer`.
- AC4: No change to exit code, prompts, or file-creation behavior.
- AC5: tsc + eslint + full jest pass.

</frozen-after-approval>
