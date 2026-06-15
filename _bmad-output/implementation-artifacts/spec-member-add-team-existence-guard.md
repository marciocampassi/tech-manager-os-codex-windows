---
title: 'Reject `tmr member add --team <team>` when the team does not exist'
type: 'bugfix'
created: '2026-06-14'
status: 'done'
baseline_commit: 84f0887
context: []
---

## Spec Change Log

- 2026-06-14 (implemented): Added two-layer team-existence guard for `tmr member add --team`. Service: public `MemberService.teamExists(team, ws)` (keyed on `<slug>-context.md`) + guard in `addMember` (gate `opts.team && !opts.contractor`) throwing `ValidationError`. Command: pre-check after the self-email guard, before prompts, calling `svc.teamExists`. Honors the human decision to **reject** (not auto-create); `tmr team add` keeps its auto-create behavior. Test impact: the new precondition required updating ~16 team-scoped `member.service` unit tests (default `beforeEach` now makes `-context.md` exist; overriding mocks add a `-context.md` clause) and seeding the team before three real-FS `addMember(--team)` calls in `member.integration` + one in `epic-9-smoke`. Validation: `tsc` ✓, `eslint src` ✓, full jest 1442/1442 ✓ (+7 new).

## Suggested Review Order

1. `src/services/member.service.ts` — `teamExists` (near `_resolveTeamContextLink`) + the guard in `addMember` (after the self-email guard)
2. `src/commands/member.command.ts` — pre-check after the self-email guard, before prompts
3. `tests/services/member.service.test.ts` — team-guard tests + `beforeEach` default + overriding-mock updates
4. `tests/commands/member.command.test.ts` — `mockTeamExists` + the three team-guard command tests
5. `tests/integration/member.integration.test.ts` + `tests/e2e/epic-9-smoke.test.ts` — team seeded before `--team` adds

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `tmr member add <email> --team <team>` creates the member and writes `teams: [[...<slug>-context.md|<slug>]]` into its frontmatter **without verifying the team exists** (`MemberService._resolveTeamContextLink` is documented as "generates path without verifying existence"). When the team doesn't exist this leaves a **dangling `teams` link** pointing at a missing context file, and the reciprocal roster write is silently skipped (`_syncTeamMembersFrontmatter` only writes when `<slug>-members.md` already exists) — so the member references a team that has no record of them. Found in UAT running `tmr member add jane@co.com --team backend` against a vault with no `backend` team.

**Approach:** Reject the operation (do NOT auto-create). When `--team` is given (team scope, non-contractor) and the team does not exist, fail with an actionable error telling the user to create the team first (`tmr team create <team>`). Guard in two layers: a command-layer pre-check (before the name/role/gender prompts, for good UX) and an authoritative service-layer guard in `MemberService.addMember` (defense-in-depth for direct callers). "Team exists" = its context file `my-teams/teams/<slug>/<slug>-context.md` exists (the exact target the `teams` link points at).

> Decision (human): `tmr member add --team` requires a pre-existing team. This intentionally diverges from `tmr team add <team> <email>`, which auto-creates the team — that command keeps its current behavior.

## Boundaries & Constraints

**Always:**
- Reject `member add` when `team` is set, scope is non-contractor, and the team's context file does not exist — across the command path and direct `addMember` calls.
- The command-layer check fires BEFORE the name/gender/role prompts.
- Error message names the missing team and suggests `tmr team create <team>`.
- No member profile is created, no `teams` link is written, and no reciprocal write happens on rejection.
- `team` matching uses `normalizeSlug` (same slug logic the write path uses).

**Ask First:**
- Auto-creating the team from `member add` (explicitly rejected by the human for this command).
- Changing `tmr team add`'s auto-create behavior (out of scope).

**Never:**
- Do not change `_resolveTeamContextLink` / `_syncTeamMembersFrontmatter` semantics beyond adding the guard.
- Do not affect company-member (no `--team`) or contractor scope.
- Do not touch the dated-file (`1on1`/`feedback`/etc.) sub-command paths.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Team missing, command path | `tmr member add x@co.com --team backend`; no `backend` team | Error before prompts; `exitCode = 1`; `addMember` NOT called | Actionable error, nothing written |
| Team missing, direct service call | `addMember(x, { team: 'backend' }, ws)`; no team | Throws `ValidationError`; nothing written | Caller surfaces message |
| Team exists | team context file present | Member created + linked as today | N/A |
| Company member (no `--team`) | `tmr member add x@co.com` | Unchanged | N/A |
| Contractor scope | `--contractor` (team ignored) | Unchanged; no team guard | N/A |
| External-domain routed to contractor | `--team` given but routed to contractor | No team guard (final scope is contractor) | N/A |
| Existing member re-run with bad team | member exists, team missing | Rejected (guard runs before idempotent sync) | `ValidationError` |

## Code Map

| File | Change |
|------|--------|
| `src/services/member.service.ts` | ADD public `teamExists(teamName, ws)`; ADD guard in `addMember` (team scope, non-contractor) throwing `ValidationError` |
| `src/commands/member.command.ts` | ADD pre-check after the self-email guard, before prompts: if `opts.team && !opts.contractor && !(await svc.teamExists(...))` → `printError` + `exitCode = 1` |
| `tests/services/member.service.test.ts` | ADD: throws when team missing (nothing written); allows when team exists |
| `tests/commands/member.command.test.ts` | ADD: rejects before prompts / `addMember` not called; proceeds when team exists |

## Tasks

1. Service: `teamExists` + guard in `addMember`.
2. Command: pre-check before prompts.
3. Tests (service + command).
4. Validate: tsc, eslint, jest.

## Acceptance Criteria

- AC1: `addMember` throws `ValidationError` when `team` is set (non-contractor) and the team context file is absent; writes nothing.
- AC2: Command rejects before prompts, does not call `addMember`, sets `exitCode = 1`, prints an actionable message naming the team + `tmr team create`.
- AC3: Team-exists, company-member, and contractor paths are unaffected.
- AC4: tsc + eslint + full jest suite pass.

</frozen-after-approval>
