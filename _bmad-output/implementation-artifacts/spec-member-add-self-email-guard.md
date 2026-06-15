---
title: 'Reject member add for the vault owner''s own (self) email'
type: 'bugfix'
created: '2026-06-14'
status: 'done'
baseline_commit: 16ee20f
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `tmr member add <self-email>` is not rejected. When the email matches the vault owner's own `my-career/` profile, it creates a duplicate/colliding member profile and writes a self-referential `direct_reports` link on the self-profile. During UAT this left a dangling `direct_reports` entry pointing at a member profile that was never finalized.

**Approach:** Guard against the self-email in two layers — a command-layer pre-check (before any interactive prompts, for good UX) and an authoritative service-layer guard in `MemberService.addMember` (defense-in-depth for direct callers). The check applies to every member scope (team, company, contractor). When the self-email cannot be determined (no self profile), behavior is unchanged.

## Boundaries & Constraints

**Always:**
- Reject `member add` when the resolved/normalized email equals the vault owner's self-email (case-insensitive, trimmed), across all scopes (`--team`, company, `--contractor`).
- The command-layer check fires BEFORE the name/gender/role prompts so the user is not asked to fill fields for a rejected add.
- Error message is actionable (point the user to `tmr myself` for their own profile).
- No member profile is created and no reciprocal `direct_reports` write happens on rejection.

**Ask First:**
- Extending the same guard to `tmr leadership add` and `tmr team add` (own-email-as-leader/member) — known related gaps already in `deferred-work.md`. Out of scope here unless the human asks.

**Never:**
- Do not change `resolveSelfEmail` behavior or `_getSelfProfilePath` semantics.
- Do not touch the non-atomic-write / rollback concern (split off to deferred-work).
- Do not alter the dated-file (`1on1`/`feedback`/etc.) sub-command paths — only the member-creation (email-first) path and `addMember`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Self-email, command path | `tmr member add <self-email>`; `my-career/<self>.md` exists | Error printed before prompts; `process.exitCode = 1`; `addMember` NOT called | Actionable error, no files written |
| Self-email, direct service call | `addMember(<self-email>, …)`; self profile exists | Throws `ValidationError`; no profile/reciprocal write | Caller surfaces message |
| Different email | `tmr member add other@co.com` | Created as today (unchanged) | N/A |
| No self profile | `my-career/` empty/absent; any email | Guard inert; member created as today | N/A |
| Self-email after typo-correction | similar-email guard rewrites input to the self-email | Still rejected (check runs on the resolved email) | Actionable error |

</frozen-after-approval>

## Code Map

- `src/commands/member.command.ts` -- `runMemberAdd` email-first branch; already imports `resolveSelfEmail`. Add pre-check after `resolveEmailWithSimilarCheck`, before the inquirer prompts.
- `src/services/member.service.ts` -- `addMember`; authoritative guard using `_getSelfProfilePath` and matching on BOTH the filename basename AND the frontmatter `email` (read via injected `_fs`), so it keys on the same identity as the command layer; throw `ValidationError`.
- `src/errors/tmr-error.ts` -- reuse `ValidationError` (TMR_E004). No new error class.
- `src/utils/self-email.ts` -- `resolveSelfEmail(ws)` reused as-is (returns trimmed/lowercased email or null).
- `tests/commands/member.command.test.ts` -- existing `resolveSelfEmail` mock pattern; add rejection test.
- `tests/services/member.service.test.ts` -- existing `_fs` mock pattern; add `ValidationError` test.

## Tasks & Acceptance

**Execution:**
- [x] `src/commands/member.command.ts` -- in the `isEmail(typeArg)` branch, after `email = await resolveEmailWithSimilarCheck(...)`, resolve `resolveSelfEmail(ws)`; if non-null and equal to `email`, `printError(...)` with an actionable hint, set `process.exitCode = 1`, and `return` before the prompts.
- [x] `src/services/member.service.ts` -- at the start of `addMember` (after `normalizedEmail`), if `_getSelfProfilePath(workspaceRoot)` resolves and `basename(path, '.md').toLowerCase() === normalizedEmail`, throw `ValidationError`. Import `ValidationError`.
- [x] `tests/commands/member.command.test.ts` -- add test: self-email input prints an error, sets exit code 1, and does NOT call `svc.addMember`.
- [x] `tests/services/member.service.test.ts` -- add test: `addMember(selfEmail, …)` throws `ValidationError` and writes nothing; plus a test that a non-self email is unaffected. (Also migrated 3 pre-existing positional `mockResolvedValueOnce` tests to order-independent path-based mocks, since the guard adds a leading `my-career/` read.)

**Acceptance Criteria:**
- Given a vault with `my-career/<self>.md`, when `tmr member add <self>` runs, then no member profile is created, the self-profile `direct_reports` is unchanged, an actionable error is shown, and exit code is 1.
- Given a direct `addMember(<self>, …)` call, when it executes, then it throws `ValidationError` and performs no writes.
- Given any non-self email, when `member add` runs, then behavior is identical to before this change.
- Given no resolvable self profile, when `member add <any>` runs, then the member is created as before.

## Spec Change Log

- 2026-06-14 (review patches, no loopback): (1) service guard now matches both filename basename AND frontmatter `email` (read via injected `_fs`) so both layers key on the same self identity — closes the "filename ≠ email" bypass; (2) command `catch` now sets `process.exitCode = 1` for service-thrown `ValidationError` (AC exit-code compliance); (3) command compares `email.toLowerCase()` for robustness after similar-email rewrite; (4) added tests for the typo-correction path, contractor scope, and frontmatter-email-vs-filename mismatch. Pre-existing `my-career/` selection ambiguity (multiple/non-profile `.md`) and the service-layer trim gap remain deferred (already tracked in deferred-work.md).

## Verification

**Commands:**
- `npm run typecheck` -- expected: zero new errors
- `npm run lint` -- expected: zero new errors
- `npm test -- member.command member.service` -- expected: new tests pass, no regressions
- Manual: in a scratch vault, `tmr init` (self = me@co.com), then `tmr member add me@co.com` -- expected: actionable rejection, no `my-teams/members/me@co.com/`, self `direct_reports` untouched.

## Suggested Review Order

**Self-detection guard (authoritative)**

- Service guard runs before any path/exists work; resolves the self profile once.
  [`member.service.ts:100`](../../src/services/member.service.ts#L100)

- Matches BOTH filename basename and frontmatter `email` so it can't be bypassed by `filename ≠ email`.
  [`member.service.ts:112`](../../src/services/member.service.ts#L112)

**Command-layer guard (UX)**

- Pre-check fires after typo-correction, before prompts; rejects with actionable hint.
  [`member.command.ts:45`](../../src/commands/member.command.ts#L45)

- `catch` now sets exit code 1 so a service-thrown rejection isn't reported as success.
  [`member.command.ts:125`](../../src/commands/member.command.ts#L125)

**Tests**

- Service: ValidationError on self (basename, frontmatter-email, contractor); non-self unaffected.
  [`member.service.test.ts:843`](../../tests/services/member.service.test.ts#L843)

- Command: rejection before prompts + after similar-email rewrite.
  [`member.command.test.ts:233`](../../tests/commands/member.command.test.ts#L233)
