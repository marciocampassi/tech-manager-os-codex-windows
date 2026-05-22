# Story 9.8 — Shared Email Similarity Warning (All Email-Accepting Commands)

## Metadata

| Field | Value |
|---|---|
| **Epic** | Epic 9 — UAT Pre-Launch Polish |
| **Story ID** | 9.8 |
| **Priority** | Medium |
| **Depends on** | 9.1 (nested paths — similarity scan relies on the canonical folder structure) |
| **Effort** | S |
| **Risk** | Low — warn-only, never blocks the user |

---

## Problem Statement

A user who types `usr1@company.com` instead of `user1@company.com` silently creates a duplicate entity. There is no friction to catch the typo before the file is written. The check must be universal — every command that accepts an email and may create or link an entity should warn if a very similar email already exists in the vault.

The check is warn-only: the user always has the final say. No blanket confirmation on every email input (that would be frustrating) — only when a suspiciously close match exists.

---

## Acceptance Criteria

- A new utility `src/utils/email-similarity.ts` exports `findSimilarEmail(email, workspaceRoot)` returning the closest existing email (string) or `null`
- Similarity is defined as: same domain AND Levenshtein distance ≤ 2 on the local part (before `@`)
- The utility scans all canonical entity paths in the vault (see scope below)
- When a similar email is found, the command prints a warning and prompts: `"⚠ Similar email already exists: user1@company.com — did you mean that? [Y to abort / N to continue with usr1@company.com]:"` — default N (continue)
- If the user chooses Y (abort), the command exits cleanly with exit code 0 (not an error)
- The check fires in: `tmr member add`, `tmr leadership add`, `tmr team add`, `tmr project link-member`, `tmr project link-stakeholder`, `tmr project link-members` (per email), `tmr project link-stakeholders` (per email)
- The check does NOT fire for read-only or lookup operations
- No external dependency added — Levenshtein implemented inline
- All tests pass

---

## Files to Change

| File | Change |
|---|---|
| `src/utils/email-similarity.ts` | New file — `levenshtein()`, `findSimilarEmail()` |
| `src/commands/member.command.ts` | Call `findSimilarEmail` before every write path in `runMemberAdd()` |
| `src/commands/leadership.command.ts` | Call `findSimilarEmail` before write in `runLeadershipAdd()` |
| `src/commands/team.command.ts` | Call `findSimilarEmail` before write in the add-member handler |
| `src/commands/project.command.ts` | Call `findSimilarEmail` before each email in `link-member`, `link-members`, `link-stakeholder`, `link-stakeholders` handlers |
| `tests/utils/email-similarity.test.ts` | New test file |

---

## Implementation Detail

### 1 — `src/utils/email-similarity.ts`

```typescript
import path from 'node:path';
import * as fs from 'node:fs';

/**
 * Computes the Levenshtein edit distance between two strings.
 * Inline implementation — no external dependency.
 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? (dp[i - 1]?.[j - 1] ?? 0)
        : 1 + Math.min(dp[i - 1]?.[j] ?? 0, dp[i]?.[j - 1] ?? 0, dp[i - 1]?.[j - 1] ?? 0);
    }
  }
  return dp[m]?.[n] ?? 0;
}

/**
 * Scans canonical vault entity directories for existing email addresses.
 * Returns the closest match if it shares the same domain and has a local-part
 * edit distance ≤ 2 from `email`. Returns null otherwise.
 *
 * Scanned paths (post-Story-9.1 nested structure):
 *   my-teams/members/<email>/
 *   my-company/members/<email>/
 *   my-company/contractors/<email>/
 *   my-leadership/<email>/
 *   my-career/<email>.md  (flat)
 */
export function findSimilarEmail(email: string, workspaceRoot: string): string | null {
  const normalized = email.toLowerCase();
  const [localPart, domain] = normalized.split('@') as [string, string];
  if (!localPart || !domain) return null;

  const SCAN_DIRS = [
    path.join(workspaceRoot, 'my-teams', 'members'),
    path.join(workspaceRoot, 'my-company', 'members'),
    path.join(workspaceRoot, 'my-company', 'contractors'),
    path.join(workspaceRoot, 'my-leadership'),
  ];

  const candidates: string[] = [];

  for (const dir of SCAN_DIRS) {
    if (!fs.existsSync(dir)) continue;
    try {
      const entries = fs.readdirSync(dir);
      for (const entry of entries) {
        if (entry.includes('@')) candidates.push(entry.toLowerCase());
      }
    } catch {
      // unreadable directory — skip
    }
  }

  // my-career flat files
  const careerDir = path.join(workspaceRoot, 'my-career');
  if (fs.existsSync(careerDir)) {
    try {
      const entries = fs.readdirSync(careerDir);
      for (const entry of entries) {
        if (entry.endsWith('.md') && entry.includes('@')) {
          candidates.push(entry.replace(/\.md$/, '').toLowerCase());
        }
      }
    } catch {
      // skip
    }
  }

  let bestMatch: string | null = null;
  let bestDistance = Infinity;

  for (const candidate of candidates) {
    if (candidate === normalized) return null; // exact match — no warning needed
    const [candLocal, candDomain] = candidate.split('@') as [string, string];
    if (!candLocal || !candDomain) continue;
    if (candDomain !== domain) continue; // different domain — not a typo candidate
    const dist = levenshtein(localPart, candLocal);
    if (dist <= 2 && dist < bestDistance) {
      bestDistance = dist;
      bestMatch = candidate;
    }
  }

  return bestMatch;
}
```

### 2 — Usage pattern in commands

Shared helper to keep command code DRY — add to each command file or extract to a shared command utility:

```typescript
async function warnIfSimilarEmail(
  email: string,
  workspaceRoot: string,
): Promise<boolean> {
  const similar = findSimilarEmail(email, workspaceRoot);
  if (!similar) return true; // no similar found — proceed

  printWarning(`Similar email already exists: ${similar}`);
  const { proceed } = await inquirer.prompt<{ proceed: boolean }>([{
    type: 'confirm',
    name: 'proceed',
    message: `Did you mean "${similar}"? (N = continue adding "${email}")`,
    default: false,
  }]);

  return !proceed; // true = continue with original email; false = user aborted
}
```

Callers:
```typescript
const shouldContinue = await warnIfSimilarEmail(email, ws);
if (!shouldContinue) return; // user chose to abort — exit cleanly
```

Call this **after** `validateEmail()` and **before** any file system write.

For `link-members` / `link-stakeholders` (comma-separated lists), call once per email in the loop:
```typescript
for (const email of emails) {
  const shouldContinue = await warnIfSimilarEmail(email, ws);
  if (!shouldContinue) continue; // skip this email, proceed with the rest
  // ... link logic
}
```

### 3 — `findSimilarEmail` is synchronous

Uses `fs.existsSync` / `fs.readdirSync` — synchronous, no async needed. The scan is cheap (directory listing only, no file reads). Acceptable for a pre-write guard.

---

## Test Coverage (`tests/utils/email-similarity.test.ts`)

| Case | Input | Existing | Expected |
|---|---|---|---|
| Exact match | `user1@co.com` | `user1@co.com` | `null` (no warning) |
| Typo (dist=1) | `usr1@co.com` | `user1@co.com` | `user1@co.com` |
| Typo (dist=2) | `usr@co.com` | `user1@co.com` | `user1@co.com` |
| Too far (dist=3) | `abc@co.com` | `user1@co.com` | `null` |
| Different domain | `user1@other.com` | `user1@co.com` | `null` |
| No existing entities | `user1@co.com` | *(empty vault)* | `null` |
| New email (no close match) | `user2@co.com` | `user1@co.com` | `null` (dist=1 but this should warn) → actually `user1@co.com` |

---

## Notes for Developer Agent

- `findSimilarEmail` uses `fs` (Node built-in) synchronously — consistent with `getWorkspaceRoot()` pattern. Do not use `FileSystemService` here.
- The warning uses `printWarning` (yellow) from `display.ts` — never `console.warn`.
- Default answer is `false` (N = continue with original email). The user must explicitly choose Y to abort.
- If the user aborts (Y), exit with code 0 — this is not an error condition.
- Run `npm run validate` before marking done.
