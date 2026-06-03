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

---

## Tasks/Subtasks

### Review Findings

- [x] [Review][Patch] Split `promptMinimalOnboarding` — domain prompt must fire immediately after email, not after the full 4-field batch. Split into (name+email) then (domain prompt) then (role+company). [Decision resolved: split the batch] **Applied 2026-05-24**
- [x] [Review][Dismiss] `internalDomains.length > 0` guard — dismissed; init always seeds org.yaml with at least one domain, so guard is correct pragmatic behavior. [Decision resolved: keep the guard]
- [x] [Review][Patch] `writeOrgConfig` writes inferred domain with original case (not lowercased) — `getInternalDomains` returns stored values as-is, but command-layer lowercases the email domain before the `includes()` check, causing false "external domain" detections for any uppercase email domain. [`src/services/init.service.ts`] **Applied 2026-05-24**
- [x] [Review][Patch] `app.json` parse result not validated as plain object — if file contains `null`, `[]`, or a primitive, `JSON.parse` succeeds but subsequent `appConfig['showUnsupportedFiles'] = true` throws `TypeError` or silently loses the flag. [`src/services/obsidian-plugin.service.ts`] **Applied 2026-05-24**
- [x] [Review][Patch] `promptAdditionalDomains` silently returns `[]` when user enters only commas/spaces (e.g. `", ,"`) — `entries` is empty after split+filter, `invalid` is empty, loop exits with no re-prompt and no feedback. [`src/workflows/onboarding.prompts.ts`] **Applied 2026-05-24**
- [x] [Review][Patch] `writeOrgConfig` does not deduplicate `additionalDomains` — user entering `"partner.io, partner.io"` produces two identical entries in `organization.yaml`. [`src/services/init.service.ts`] **Applied 2026-05-24**
- [x] [Review][Defer] `appendInternalDomain` appends at end-of-file — if `organization.yaml` has keys after `internal_domains:`, the new domain is inserted outside the `internal_domains` block, producing invalid YAML. [`src/services/member.service.ts`] — deferred, current template only writes one key
- [x] [Review][Defer] `isValidDomain` only checks for space character, not tab or other whitespace — `"exam\tple.com"` passes validation. [`src/utils/validation.ts`] — deferred, extremely unlikely in practice
- [x] [Review][Defer] Concurrent `appendInternalDomain` calls create a read-modify-write race — second write overwrites first, silently losing a domain. [`src/services/member.service.ts`] — deferred, file-system architecture constraint
- [x] [Review][Defer] `team.command.ts` remember-domain prompt fires unconditionally after successful `addMember` call, even for pre-existing members — pre-existing command-layer behavior (printSuccess also fires unconditionally). [`src/commands/team.command.ts`] — deferred, pre-existing

---

## File List

- `src/utils/validation.ts` — added `isValidDomain()`
- `src/workflows/onboarding.prompts.ts` — added `promptAdditionalDomains()`
- `src/services/init.service.ts` — updated `writeOrgConfig()` to accept `additionalDomains[]`
- `src/commands/init.command.ts` — call `promptAdditionalDomains`, pass domains to `writeOrgConfig`
- `src/services/obsidian-plugin.service.ts` — write `showUnsupportedFiles: true` into `app.json`
- `src/services/member.service.ts` — added `appendInternalDomain()`
- `src/commands/member.command.ts` — "remember domain" prompt after company-scope routing
- `src/commands/team.command.ts` — "remember domain" prompt after `team add`
- `src/commands/leadership.command.ts` — "remember domain" prompt after `leadership add`
- `tests/utils/validation.test.ts` — `isValidDomain` unit tests
- `tests/services/init.service.test.ts` — `writeOrgConfig` multi-domain tests
- `tests/services/member.service.test.ts` — `appendInternalDomain` tests
- `tests/services/obsidian-plugin.service.test.ts` — updated `app.json` tests + `readFile` mock
- `src/workflows/onboarding.prompts.ts` — added `promptNameAndEmail()`, `promptRoleAndCompany()` (Patch 1); commas-only re-prompt guard (Patch 4)
- `src/commands/init.command.ts` — replaced `promptMinimalOnboarding` with split calls (Patch 1)
- `tests/commands/init.command.test.ts` — updated mock sequences (12 calls)
- `tests/integration/init.integration.test.ts` — updated mock sequences (12 calls)
- `tests/fixtures/init-prompts.ts` — updated happy-path fixture (12 calls)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — 9-4 → in-progress → review → done

---

## Change Log

- Story 9.4 implementation (2026-05-24): domain inference at init, `isValidDomain`, `promptAdditionalDomains`, multi-domain `writeOrgConfig`, `showUnsupportedFiles` in `app.json`, `appendInternalDomain`, "remember domain" prompt in member/team/leadership add commands. 1128 tests pass.
- Story 9.4 code review patches applied (2026-05-24): split `promptMinimalOnboarding` → `promptNameAndEmail` + `promptRoleAndCompany` (domain prompt fires immediately after email); `writeOrgConfig` lowercases all domains + Set-based dedup; `app.json` object type guard; commas-only re-prompt in `promptAdditionalDomains`. 1128 tests pass.

---

## Dev Agent Record

### Completion Notes

- **`isValidDomain()`** added to `src/utils/validation.ts` alongside `validateEmail()`. Rules: non-empty, contains `.`, no `@`, no spaces.
- **`promptAdditionalDomains(inferredDomain)`** added to `onboarding.prompts.ts`. Shows inferred domain, re-prompts on invalid entries with per-domain error messages, returns validated extras.
- **`writeOrgConfig(vaultPath, email, additionalDomains?)`** updated to write all domains (inferred + extras, deduped).
- **`InitCommand.run()`** updated to call `promptAdditionalDomains` right after `promptMinimalOnboarding`, before `promptLeaderDetails`. Additional domains passed to `writeOrgConfig`.
- **`ObsidianPluginService.installPlugins()`** updated: reads existing `app.json` (if any), sets `showUnsupportedFiles: true`, writes back. Malformed JSON handled with try/catch fallback to `{}`.
- **`MemberService.appendInternalDomain(domain, workspaceRoot)`** added. Idempotent (no-op if domain already present). Creates file if absent; appends to existing.
- **"Remember domain" prompt** added to `member.command.ts` (after company-scope routing), `team.command.ts` (after `team add`), and `leadership.command.ts` (after `leadership add`). Fires only when `internalDomains.length > 0 && domain not in internalDomains`. Default = N.
- All 1128 tests pass (0 failures). Updated 7 test/fixture files to account for new prompt in the init flow sequence.
- Code review complete (2026-05-24): 5 patches applied, 2 deferred findings logged in `deferred-work.md`, 1 dismissed (internalDomains guard). Prompt sequence updated to 12 calls. All 1128 tests pass post-patch.

---

## Status

done
