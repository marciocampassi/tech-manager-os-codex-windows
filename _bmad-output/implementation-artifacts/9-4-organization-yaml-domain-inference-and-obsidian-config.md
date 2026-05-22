# Story 9.4 — organization.yaml Domain Inference, Inline Remember, & Obsidian showUnsupportedFiles

## Metadata

| Field | Value |
|---|---|
| **Epic** | Epic 9 — UAT Pre-Launch Polish |
| **Story ID** | 9.4 |
| **Priority** | Medium |
| **Effort** | S |
| **Risk** | Low — additive changes only |

---

## Problem Statement

Three related gaps:

1. The `tmr init` additional-domains prompt is confusingly worded — users don't know what "trusted internal email domains" means until they've already been burned by the contractor routing prompt later.
2. There is no in-context way to update `organization.yaml` after init — a user who routes an external-domain email to "Company member" has no way to persist that domain as internal without editing YAML manually.
3. `config/organization.yaml` and other non-`.md` vault files are invisible in Obsidian because `app.json` is written as `{}` — the `showUnsupportedFiles` setting is never set.

---

## Acceptance Criteria

- `tmr init` shows a rewritten domain prompt immediately after collecting the user's email, pre-filled with their inferred domain, allowing zero or more comma-separated additional domains
- Each additional domain entered is validated as a well-formed domain (no `@`, contains a `.`, no whitespace); invalid entries are rejected with a clear error and the prompt is re-shown
- `config/organization.yaml` is written with the inferred domain plus any valid additional domains collected at init
- When any member-related command encounters an email whose domain is not in `organization.yaml` and the user routes it to company scope (not contractor), a follow-up prompt asks: `"Remember domain1.com as an internal domain for future members? [y/N]:"` — if yes, appends the domain to `organization.yaml`
- The "remember domain" prompt fires for all member-related commands: `tmr member add`, `tmr team add`, `tmr leadership add`
- `.obsidian/app.json` is written with `{ "showUnsupportedFiles": true }` during `tmr init` (replaces the current `{}`)
- All tests pass

---

## Files to Change

| File | Change |
|---|---|
| `src/workflows/onboarding.prompts.ts` | Rewrite the additional-domains prompt; add comma-split + per-domain validation logic |
| `src/services/init.service.ts` | Update `organization.yaml` write to include inferred domain + validated additional domains |
| `src/services/obsidian-plugin.service.ts` | Write `{ "showUnsupportedFiles": true }` to `app.json` instead of `{}` |
| `src/services/member.service.ts` | Add `appendInternalDomain(domain, workspaceRoot)` method |
| `src/commands/member.command.ts` | After company-scope routing, offer "remember domain" prompt; call `appendInternalDomain` if confirmed |
| `src/commands/team.command.ts` | Same "remember domain" offer when an external-domain email is added to a team |
| `src/commands/leadership.command.ts` | Same "remember domain" offer when an external-domain email is added as a leader |
| `tests/services/init.service.test.ts` | Add multi-domain write test |
| `tests/services/member.service.test.ts` | Add `appendInternalDomain` test |

---

## Implementation Detail

### 1 — Rewritten `tmr init` domain prompt

Shown immediately after the user's email is collected. The inferred domain is displayed for clarity.

```
Your company email domain is: company.com
Does your company use other internal email domains?
Enter them as a comma-separated list, or press Enter to skip:
> company-eu.com, subsidiary.com
```

Split on `,`, trim each entry, validate each with `isValidDomain()`. Invalid entries cause a re-prompt:

```
✖ Invalid domain: "not a domain" — domains must contain a dot and no spaces.
Please re-enter:
```

All valid domains plus the inferred domain are written to `config/organization.yaml`:

```yaml
internal_domains:
  - company.com
  - company-eu.com
  - subsidiary.com
```

### 2 — Domain validation utility

Add `isValidDomain(value: string): boolean` to `src/utils/validation.ts`:

```typescript
export function isValidDomain(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 &&
    !trimmed.includes('@') &&
    !trimmed.includes(' ') &&
    trimmed.includes('.');
}
```

### 3 — "Remember domain" offer in member-related commands

After any email routing decision that results in **company scope** (not contractor) for a domain not currently in `organization.yaml`, show:

```typescript
const domain = email.split('@')[1] ?? '';
const internalDomains = await svc.getInternalDomains(ws);
if (domain && !internalDomains.includes(domain) && !isContractor) {
  const { remember } = await inquirer.prompt<{ remember: boolean }>([
    {
      type: 'confirm',
      name: 'remember',
      message: `Remember "${domain}" as an internal domain for future members?`,
      default: false,
    },
  ]);
  if (remember) {
    await svc.appendInternalDomain(domain, ws);
    printInfo(`Domain "${domain}" added to config/organization.yaml`);
  }
}
```

Apply this block in:
- `src/commands/member.command.ts` — after company-scope routing decision
- `src/commands/team.command.ts` — after adding a member to a team (external domain detected)
- `src/commands/leadership.command.ts` — after adding a leader (external domain detected)

### 4 — `MemberService.appendInternalDomain(domain, workspaceRoot)`

Reads `config/organization.yaml`, appends the new domain under `internal_domains:` if not already present, writes back. Uses the same line-by-line format as `getInternalDomains()` for consistency (no external YAML library).

```typescript
async appendInternalDomain(domain: string, workspaceRoot: string): Promise<void> {
  const orgPath = path.join(workspaceRoot, 'config', 'organization.yaml');
  const existing = await this.getInternalDomains(workspaceRoot);
  if (existing.includes(domain.toLowerCase())) return; // already present

  // Append line to file; create file if it doesn't exist
  const line = `  - ${domain.toLowerCase()}\n`;
  if (!(await this._fs.exists(orgPath))) {
    await this._fs.writeFile(orgPath, `internal_domains:\n${line}`);
    return;
  }
  const content = await this._fs.readFile(orgPath);
  // If internal_domains key exists, append after last domain entry
  // Otherwise append the key + entry at end of file
  if (content.includes('internal_domains:')) {
    await this._fs.writeFile(orgPath, content.trimEnd() + '\n' + line);
  } else {
    await this._fs.writeFile(orgPath, content.trimEnd() + '\ninternal_domains:\n' + line);
  }
}
```

### 5 — `app.json` — `showUnsupportedFiles`

In `ObsidianPluginService.installPlugins()`, replace:

```typescript
if (!(await fileSystemService.exists(appJsonPath))) {
  await fileSystemService.writeFile(appJsonPath, '{}');
}
```

With:

```typescript
let appConfig: Record<string, unknown> = {};
if (await fileSystemService.exists(appJsonPath)) {
  try {
    appConfig = JSON.parse(await fileSystemService.readFile(appJsonPath)) as Record<string, unknown>;
  } catch {
    // malformed app.json — start fresh
  }
}
appConfig['showUnsupportedFiles'] = true;
await fileSystemService.writeFile(appJsonPath, JSON.stringify(appConfig, null, 2));
```

This merges the flag into any existing `app.json` rather than overwriting it.

---

## Notes for Developer Agent

- `isValidDomain()` lives in `src/utils/validation.ts` alongside `validateEmail()` — keep validators co-located.
- The "remember domain" prompt only fires when the domain is **not already internal** — do not prompt for domains already in `organization.yaml`.
- The prompt default is `false` (N) — opt-in, not opt-out.
- `appendInternalDomain` is idempotent — calling it twice with the same domain is a no-op.
- `showUnsupportedFiles` is set in `installPlugins()` which is called during full init (not `--scaffold-only`). If the flag is wanted in scaffold-only mode too, move the `app.json` write to `InitService.scaffold()` instead. Discuss with Marlon if this matters.
- Run `npm run validate` before marking done.
