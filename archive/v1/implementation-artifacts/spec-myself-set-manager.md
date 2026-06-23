---
title: 'tmr myself set-manager <email> — change the vault owner''s current manager'
type: 'feature'
created: '2026-06-15'
status: 'done'
baseline_commit: 2c4dd6c
context: []
---

## Changelog

- 2026-06-15: Implemented `MyselfService.setManager` + `tmr myself set-manager <email>` command.
  Reciprocal writes on self + both leader profiles; rejects when the new manager profile is
  absent (decision: reject, suggest `tmr leadership add`); removes self from the old manager's
  `direct_reports[]` (decision: clean both ends). 7 service tests + 4 command tests added.
  Full suite green: tsc clean, eslint clean (src), 1453/1453 jest. All ACs met.
  - Note: discovered (and worked around in the test helper) that gray-matter's global parse
    cache returns stale data when `addRelation`/`removeRelation` mutate the cached object —
    production is unaffected (each op reads fresh file content from disk).

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** There is no command to change the vault owner's `current_manager`. Today it is only auto-set when empty (`tmr init` / `tmr leadership add`) or moved to `previous_manager[]` on `tmr team archive`/`fire`. Adding a leader while `current_manager` is already set correctly routes the new leader into `leadership[]` (by design), so a genuine manager change requires hand-editing frontmatter on three files.

**Approach:** Add `tmr myself set-manager <email>` → `MyselfService.setManager(email, ws)` that performs the change atomically and reciprocally on the self profile and both leader profiles:
1. Move the existing `current_manager` (if any, and different) into `previous_manager[]` (dedup).
2. Remove the new manager from `leadership[]` if present (promotion).
3. Set `current_manager` to the new leader's wiki-link.
4. Reciprocal: add self to the NEW manager's `direct_reports[]`; **remove** self from the OLD manager's `direct_reports[]` (human decision: clean both ends).

**Human decisions:** (1) old-manager reciprocal → **remove** self from old manager's `direct_reports[]`. (2) new manager profile missing in `my-leadership/` → **reject** (suggest `tmr leadership add <email>` first), consistent with the member-add team guard.

## Boundaries & Constraints

**Always:**
- Require an existing self profile in `my-career/` (else `ConfigurationError`, run `tmr init`).
- Require the new manager profile at `my-leadership/<email>/<email>.md` (else `ValidationError` suggesting `tmr leadership add`).
- No-op (changed: false) when the email is already the current manager (idempotent).
- Use `setScalar`/`addRelation`/`removeRelation` (canonical frontmatter helpers) — no inline `matter.stringify` for relations.
- Normalize the email (trim + lowercase) and `validateEmail` it.

**Ask First:**
- Resolving a manager outside `my-leadership/` (e.g. a team member promoted to manager). Out of scope.

**Never:**
- Do not auto-create the new manager profile.
- Do not touch dated artifacts or other relation arrays beyond `current_manager`, `previous_manager`, `leadership`, and the two managers' `direct_reports`.
- Do not change `tmr leadership add` behavior.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Happy path | current=marlon; new=chef exists; chef in leadership[] | previous_manager += marlon; chef removed from leadership[]; current_manager=chef; self added to chef.direct_reports; self removed from marlon.direct_reports | — |
| Empty current | current=''; new=chef exists | current_manager=chef; self added to chef.direct_reports; no previous move | — |
| Already current | current=chef; new=chef | No-op (`changed: false`) | — |
| New manager missing | `my-leadership/chef/chef.md` absent | Throws `ValidationError` (suggest `tmr leadership add chef@…`); nothing written | Graceful |
| No self profile | `my-career/` empty | Throws `ConfigurationError` (run `tmr init`) | Graceful |
| Old manager file gone | current points to a deleted profile | previous_manager still recorded; old-manager `direct_reports` removal no-ops (file missing) | Safe |
| Invalid email | `set-manager not-an-email` | Throws `InvalidEmailError` | Graceful |

## Code Map

| File | Change |
|------|--------|
| `src/services/myself.service.ts` | ADD `setManager(email, ws)` + a small wiki-link-target parser for the old-manager link; import `addRelation`/`removeRelation`/`validateEmail`/`matter` |
| `src/commands/myself.command.ts` | ADD `runMyselfSetManager` handler + `myself set-manager <email>` subcommand |
| `tests/services/myself.service.test.ts` | ADD setManager unit tests (happy path, empty current, already-current, missing manager, no self profile, reciprocal removal) |
| `tests/commands/myself.command.test.ts` | ADD command tests (success output, missing-manager error + exit 1) |

## Tasks

1. Service: `setManager` with reciprocal writes + guards.
2. Command: `set-manager` subcommand + handler.
3. Tests (service + command).
4. Validate: tsc, eslint, jest.

## Acceptance Criteria

- AC1: `setManager` moves old `current_manager` → `previous_manager[]`, sets the new `current_manager`, removes the new manager from `leadership[]` if present, adds self to new manager's `direct_reports[]`, and removes self from old manager's `direct_reports[]`.
- AC2: Rejects with `ValidationError` when the new manager profile is absent; `ConfigurationError` when no self profile; `InvalidEmailError` for bad email — writing nothing.
- AC3: No-op (`changed: false`) when the email is already the current manager.
- AC4: Command prints a clear summary and sets `exitCode = 1` on error.
- AC5: tsc + eslint + full jest pass.

</frozen-after-approval>
