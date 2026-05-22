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
