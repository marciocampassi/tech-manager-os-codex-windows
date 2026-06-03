# Story 9.6 — Leadership: Location Prompt + tmr leadership add 1on1 Subcommand

## Metadata

| Field | Value |
|---|---|
| **Epic** | Epic 9 — UAT Pre-Launch Polish |
| **Story ID** | 9.6 |
| **Priority** | Medium |
| **Effort** | S |
| **Risk** | Low — additive prompt + rename of existing command |

---

## Problem Statement

Two gaps in `tmr leadership`:

1. `tmr leadership add` does not prompt for location, so leadership profiles have no `location` frontmatter field — inconsistent with member profiles.
2. `tmr leadership 1on1 <email>` exists as a top-level subcommand but breaks the established pattern. `tmr member add 1on1 <email>` is the template. Leadership should follow the same shape: `tmr leadership add 1on1 <email>`. Additionally the current 1on1 file naming (`YYYY-MM-DD-<email>-1on1.md`) violates the canonical convention (`YYYY-MM-1on1-<email>.md`).

---

## Acceptance Criteria

- `tmr leadership add <email>` prompts for location and writes `location: <value>` to frontmatter
- `tmr leadership add 1on1 <email>` creates a dated 1on1 file named `YYYY-MM-1on1-<email>.md` in `my-leadership/<email>/1on1s/`
- `tmr leadership 1on1 <email>` (old form) is **removed** from the CLI
- The `## 1on1s` section of the leadership profile is updated with a wiki-link to the new file
- `tmr leadership add --date <date> 1on1 <email>` passes the date through correctly
- "Remember domain" offer fires when an external-domain email is added as a leader (per Story 9.4 pattern)
- All tests pass

---

## Files to Change

| File | Change |
|---|---|
| `src/types/leadership.types.ts` | Add `location?: string` to `IAddLeadershipOptions` |
| `src/services/leadership.service.ts` | Add `location` to `buildLeadershipProfileMd()`; fix `add1on1()` filename to `YYYY-MM-1on1-<email>.md` |
| `src/commands/leadership.command.ts` | Add `location` prompt to `runLeadershipAdd()`; restructure `tmr leadership add` to accept type-first form (`1on1 <email>`); remove standalone `tmr leadership 1on1` subcommand; add "remember domain" offer |
| `src/workflows/onboarding.prompts.ts` | Add location prompt to leadership collection during `tmr init` if leadership is collected there |
| `src/services/init.service.ts` | Pass `location` through to `writeLeaderProfile()` → `addLeadership()` |
| `tests/services/leadership.service.test.ts` | Update 1on1 filename assertion; add `location` frontmatter assertion |
| `tests/commands/leadership.command.test.ts` | Update command routing tests; remove `1on1` top-level subcommand test |

---

## Implementation Detail

### 1 — `IAddLeadershipOptions` — add `location`

```typescript
export interface IAddLeadershipOptions {
  name?: string;
  role?: string;
  gender?: string;
  location?: string;
  areas_of_responsibility?: string;
  date?: string;
}
```

### 2 — `buildLeadershipProfileMd()` — add `location` to frontmatter

```typescript
const frontmatter: ILeadershipFrontmatter = {
  email,
  name: opts.name ?? '',
  role: opts.role ?? '',
  location: opts.location ?? '',
  ...(opts.gender ? { gender: opts.gender } : {}),
  areas_of_responsibility: opts.areas_of_responsibility ?? '',
  relationship: 'leadership',   // Story 9.5
  date_added: date,
};
```

### 3 — `add1on1()` — fix filename

**Before:**
```typescript
const fileName = `${date}-${normalizedEmail}-1on1.md`;
```

**After (canonical convention `YYYY-MM-DD-1on1-<email>.md` — full date, 1on1s happen weekly):**
```typescript
const fileName = `${date}-1on1-${normalizedEmail}.md`;
```

Update the wiki-link accordingly:
```typescript
const wikiLink = `- [[1on1s/${fileName}]]`;
```

### 4 — `leadership.command.ts` — restructure `add` to accept type-first form

Mirror the pattern from `member.command.ts`. `tmr leadership add` takes either:
- An email as first arg → create leader profile (existing behaviour + location prompt)
- The keyword `1on1` as first arg + email as second arg → create 1on1 file

```typescript
export async function runLeadershipAdd(
  svc: LeadershipService,
  typeOrEmail: string,
  emailArg: string | undefined,
  opts: IAddLeadershipOptions & { date?: string },
): Promise<void> {
  // Route: 1on1 subcommand
  if (typeOrEmail === '1on1') {
    await runLeadership1on1(svc, emailArg, opts);
    return;
  }

  // Route: create leader profile (typeOrEmail is the email)
  // ... existing logic + location prompt + remember domain offer
}
```

Add `location` to the secondary prompts:
```typescript
!opts.location && { type: 'input', name: 'location', message: 'Location (optional):' },
```

### 5 — Remove `tmr leadership 1on1` top-level subcommand

Delete the standalone `.command('1on1 [email]')` registration from `createLeadershipCommand()`. The `runLeadership1on1` handler is still used internally — do not delete it, just remove its direct Commander registration.

Update the `add` command signature to `add <type-or-email> [email]`:
```typescript
cmd
  .command('add <type-or-email> [email]')
  .description('add a leadership contact, or create a 1on1 note (tmr leadership add 1on1 <email>)')
  .option('--date <date>', 'date for the file (YYYY-MM-DD)')
  .option('--name <name>', 'contact name')
  .option('--role <role>', 'contact role')
  .option('--gender <gender>', 'contact gender')
  .option('--location <location>', 'contact location')
  .option('--areas <areas>', 'areas of responsibility')
  .action(async (typeOrEmail, emailArg, opts) => {
    await runLeadershipAdd(svc, typeOrEmail, emailArg, { ... });
  });
```

### 6 — "Remember domain" offer

After `addLeadership()` returns `{ created: true }`, apply the same domain-check pattern from Story 9.4:

```typescript
const domain = email.split('@')[1] ?? '';
const internalDomains = await memberService.getInternalDomains(ws);
if (domain && !internalDomains.includes(domain)) {
  const { remember } = await inquirer.prompt([{
    type: 'confirm',
    name: 'remember',
    message: `Remember "${domain}" as an internal domain for future members?`,
    default: false,
  }]);
  if (remember) {
    await memberService.appendInternalDomain(domain, ws);
    printInfo(`Domain "${domain}" added to config/organization.yaml`);
  }
}
```

### 7 — `tmr init` leadership location

In `onboarding.prompts.ts`, add a `location` prompt to the leadership collection step. Pass through to `InitService.writeLeaderProfile()` → `addLeadership()`.

---

## Notes for Developer Agent

- `runLeadership1on1` function remains in `leadership.command.ts` but is called internally by `runLeadershipAdd` — it is no longer registered as a direct Commander subcommand.
- The "remember domain" offer in `leadership.command.ts` requires importing `memberService` — this is a cross-service call at the command layer, which is acceptable (commands may coordinate services; services must not call each other).
- `ILeadershipFrontmatter` in `leadership.types.ts` needs a `location` field added alongside the interface update.
- Run `npm run validate` before marking done.

---

## Tasks/Subtasks

- [x] T1: Add `location?: string` to `IAddLeadershipOptions` and `ILeadershipFrontmatter` (`src/types/leadership.types.ts`)
- [x] T2: Add `location` to `buildLeadershipProfileMd()` frontmatter; fix `add1on1()` filename to `YYYY-MM-DD-1on1-<email>.md` (`src/services/leadership.service.ts`)
- [x] T3: Restructure `runLeadershipAdd` for type-first routing (`1on1 <email>`), add `location` prompt, remove standalone `tmr leadership 1on1` subcommand, add `--location` option (`src/commands/leadership.command.ts`)
- [x] T4: Add `location` prompt to `promptLeaderDetails()` (`src/workflows/onboarding.prompts.ts`)
- [x] T5: Pass `location` through `InitService.writeLeaderProfile()` and `init.command.ts`
- [x] T6: Update tests — `leadership.service.test.ts`, `leadership.command.test.ts`, `leadership.integration.test.ts`, `init.command.test.ts`, `init.integration.test.ts`, `init-prompts.ts` fixture
- [x] T7: Run `npm run validate` — 1133 tests pass, lint/typecheck/build clean

---

## File List

- `src/types/leadership.types.ts` — added `location?: string` to `ILeadershipFrontmatter` and `IAddLeadershipOptions`
- `src/services/leadership.service.ts` — added `location` to `buildLeadershipProfileMd()`; fixed `add1on1()` filename to `YYYY-MM-DD-1on1-<email>.md`
- `src/commands/leadership.command.ts` — restructured `runLeadershipAdd` for type-first routing; added `location` prompt; removed standalone `tmr leadership 1on1` subcommand; added `--location` option
- `src/workflows/onboarding.prompts.ts` — added `location` field to `promptLeaderDetails()` and `LeaderDetails` interface
- `src/services/init.service.ts` — added `location?: string` to `writeLeaderProfile()` opts; passes it to `addLeadership()`
- `tests/services/leadership.service.test.ts` — updated 1on1 filename assertions; added `9.6: location` assertion
- `tests/commands/leadership.command.test.ts` — updated mock filename; updated `runLeadershipAdd` call signatures; routing test uses `add 1on1` form; added `--location` flag test
- `tests/integration/leadership.integration.test.ts` — updated all 1on1 filename assertions
- `tests/commands/init.command.test.ts` — added `location: ''` to `promptLeaderDetails` mock calls
- `tests/integration/init.integration.test.ts` — added `location: ''` to INIT-INT-007 leader mock
- `tests/fixtures/init-prompts.ts` — added `location: ''` to `promptLeaderDetails` happy-path mock
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — 9-6 → in-progress

---

## Change Log

- Story 9.6 implementation (2026-05-24): added `location` prompt and frontmatter field to leadership profiles; fixed 1on1 filename convention to `YYYY-MM-DD-1on1-<email>.md`; restructured `tmr leadership add` to accept type-first form (`1on1 <email>`); removed standalone `tmr leadership 1on1` subcommand. "Remember domain" offer was already implemented. 1133 tests pass; lint/typecheck/build clean.

---

## Dev Agent Record

### Completion Notes

- **`ILeadershipFrontmatter`** — `location?: string` added so `buildLeadershipProfileMd()` can include the field. `IAddLeadershipOptions` also gets `location?: string`.
- **`buildLeadershipProfileMd()`** — `location: opts.location ?? ''` added to frontmatter object between `role` and `gender`.
- **`add1on1()` filename** — changed from `${date}-${normalizedEmail}-1on1.md` to `${date}-1on1-${normalizedEmail}.md` to match canonical convention from project-context.md.
- **`runLeadershipAdd()`** — signature changed to `(svc, typeOrEmail, emailArg, opts)`. When `typeOrEmail === '1on1'`, delegates to `runLeadership1on1(svc, emailArg, opts)`. Otherwise, `typeOrEmail` is the email (existing leader profile creation path). Location prompt added to secondary inquirer batch.
- **`createLeadershipCommand()`** — `add` command changed from `add [email]` to `add <type-or-email> [email]`; `--location` and `--date` options added; standalone `1on1 [email]` subcommand removed.
- **`promptLeaderDetails()`** — added `location` field (optional, empty default). Returns include `location` conditionally (only if non-empty).
- **`InitService.writeLeaderProfile()`** — `location?: string` added to opts, passed through to `addLeadership()`.
- **"Remember domain" offer** — already implemented in `leadership.command.ts` before this story; AC6 was already satisfied.
- **Note**: the `location?.trim()` optional chaining in `promptLeaderDetails()` is defensive — Inquirer always returns the field with a default of `''`, but this protects against edge cases in tests where mocks omit the field.

---

## Review Findings

### Summary

Three subagents reviewed 11 files / 457 diff lines (Blind Hunter × 13, Edge Case Hunter × 5, Acceptance Auditor × 5). After deduplication and false-positive removal: **5 patch**, **4 defer**, **~12 dismiss**.

Acceptance Auditor false positives: AA-1 (wiki-link update exists in unchanged `add1on1()` code); AA-2 (location prompt IS in the diff, secondary inquirer batch); AA-3 (directory path visible in service); AA-5 (email is first arg to `addLeadership()`, not in opts — no data loss).

---

### Patch

- [x] **P1 — Case-sensitive `'1on1'` dispatch** (`leadership.command.ts:24`)
  `if (typeOrEmail === '1on1')` fails for `'1ON1'` or `' 1on1 '` (typos, copy-paste).
  Fix: `if (typeOrEmail?.trim().toLowerCase() === '1on1')`.

- [x] **P2 — Empty-string `opts.location` discards prompt answer** (`leadership.command.ts:66`)
  `!opts.location` is `true` when `opts.location = ''` → prompt fires → user enters value → but `'' ?? answer` returns `''` (empty string is not nullish) → answer silently discarded.
  Fix: change `??` to `||` for all four secondary-field merge lines (name, role, gender, location).

- [x] **P3 — `location` always written as `''`; inconsistent with `gender` conditional spread** (`leadership.service.ts:40`)
  `gender` uses `...(opts.gender ? { gender: opts.gender } : {})` — omitted when blank.
  `location: opts.location ?? ''` always writes the key, producing `location: ''` in every leadership YAML when no location is provided. Inconsistent Dataview queries.
  Fix: `...(opts.location ? { location: opts.location } : {})`.

- [x] **P4 — No direct unit test for `runLeadershipAdd` `'1on1'` dispatch branch** (`leadership.command.test.ts`)
  Added two direct tests: `runLeadershipAdd(svc, '1on1', email, {})` and `runLeadershipAdd(svc, '1ON1', email, {})` asserting `mockAdd1on1` called and `mockAddLeadership` not called.

- [x] **P5 — `--date` help text regressed** (`leadership.command.ts:172`)
  Restored "defaults to today" in the option description.

---

### Defer

- **W1 — Interactive no-arg profile-creation path is dead code** — With `add <type-or-email>` required, Commander rejects `tmr leadership add` before the handler runs; `if (!email) { prompt }` is unreachable for the profile path. Intentional per spec (mirrors `member add <email>`). Dead code cleanup is a separate chore.

- **W2 — No migration for renamed 1on1 files** — Pre-existing `${date}-${email}-1on1.md` files will not match the new `${date}-1on1-${email}.md` pattern in `listLeadership()` parsing. Migration is a separate story for existing vaults.

- **W3 — `--date` semantics bleed into contact-add mode** — When user runs `tmr leadership add boss@co.com --date 2026-01-01`, the date sets `date_added` on the profile, not a 1on1 file. Acceptable; `--date` has always been in `IAddLeadershipOptions` and UX confusion is low.

- **W4 — Magic-string routing not visible in `--help`** — `tmr leadership add --help` description partially conveys the `1on1` form but the routing logic is an if-statement, not a Commander subcommand. Matches the `member add 1on1` pattern in the codebase; acceptable for this phase.

---

## Status

done
