# Story 9.9 — tmr member add feedback: Folder Name, File Format, --from Flag

## Metadata

| Field | Value |
|---|---|
| **Epic** | Epic 9 — UAT Pre-Launch Polish |
| **Story ID** | 9.9 |
| **Priority** | Medium |
| **Depends on** | 9.1 (nested member paths), 9.3 (flat my-career for self-email resolution) |
| **Effort** | S |
| **Risk** | Low — isolated to feedback file type config and command options |

---

## Problem Statement

Three gaps in `tmr member add feedback`:

1. **Wrong folder name** — `FILE_TYPE_CONFIG['feedback'].subDir` is `'feedback'`; the scaffolded vault structure uses `feedbacks/` (plural). Files land in the wrong folder.
2. **Wrong filename format** — current output: `${date}-${email}-feedback.md` (full ISO date, wrong field order). Required: `YYYY-MM-feedback-<reviewer-email>-<member-email>.md` where `YYYY-MM` is year+month extracted from the date.
3. **No `--from` flag** — the reviewer email is never recorded. When omitted, defaults to the application user's own email (from `my-career/<email>.md`). The `--from` flag allows recording feedback provided by a third party (e.g. peer feedback on behalf of someone else).

---

## Acceptance Criteria

- `tmr member add feedback user@co.com` creates `feedbacks/2026-05-feedback-manager@co.com-user@co.com.md` inside the member's directory (using current year-month)
- `tmr member add feedback user@co.com --from peer@co.com` creates `feedbacks/2026-05-feedback-peer@co.com-user@co.com.md`
- `tmr member add feedback user@co.com --date 2026-03-15` creates `feedbacks/2026-03-feedback-manager@co.com-user@co.com.md` (year-month from the provided date)
- When `--from` is omitted, reviewer email is resolved from `my-career/<email>.md` frontmatter; if unresolvable, a prompt asks for it
- The `## Feedbacks` section of the member profile is updated with a wiki-link to the new file
- No file is written to a `feedback/` (singular) folder
- All tests pass

---

## Files to Change

| File | Change |
|---|---|
| `src/types/member.types.ts` | Fix `FILE_TYPE_CONFIG['feedback'].subDir` from `'feedback'` to `'feedbacks'`; update `fileSuffix` logic (see below) |
| `src/services/member.service.ts` | Update `createMemberFile()` to accept optional `fromEmail` parameter; compute `YYYY-MM` prefix; build filename with reviewer email |
| `src/commands/member.command.ts` | Add `--from <email>` option to `tmr member add`; resolve self-email from `my-career/`; pass to `createMemberFile()` |
| `tests/services/member.service.test.ts` | Update feedback filename and subdir assertions |
| `tests/commands/member.command.test.ts` | Add `--from` flag test; add default-reviewer resolution test |

---

## Implementation Detail

### 1 — `FILE_TYPE_CONFIG` fix

**Before:**
```typescript
feedback: {
  subDir: 'feedback',
  fileSuffix: 'feedback',
  sectionName: 'Feedbacks',
},
```

**After:**
```typescript
feedback: {
  subDir: 'feedbacks',
  fileSuffix: 'feedback', // kept for backward compat — filename builder overrides this for feedback type
  sectionName: 'Feedbacks',
},
```

The `fileSuffix` field is not used for feedback filename construction after this story — the builder constructs the name directly. Keep it for structural consistency.

### 2 — `ICreateFileOptions` — add `fromEmail`

```typescript
export interface ICreateFileOptions {
  date?: string;
  noEdit?: boolean;
  fromEmail?: string; // reviewer email; feedback type only
}
```

### 3 — `createMemberFile()` — year-month prefix + reviewer email

Extract year-month helper (add to `member.service.ts`):

```typescript
function yearMonth(isoDate: string): string {
  return isoDate.slice(0, 7); // "2026-05-22" → "2026-05"
}
```

Update filename construction for all file types to use year-month prefix:

**Before:**
```typescript
const fileName = `${date}-${normalizedEmail}-${config.fileSuffix}.md`;
```

**After — 1on1 uses full date; all others use year-month:**
```typescript
function filePrefix(type: FileType, isoDate: string): string {
  return type === '1on1' ? isoDate : isoDate.slice(0, 7);
}
```

```typescript
const prefix = filePrefix(type, date);

const fileName = type === 'feedback'
  ? `${prefix}-feedback-${options.fromEmail ?? 'unknown'}-${normalizedEmail}.md`
  : `${prefix}-${config.fileSuffix}-${normalizedEmail}.md`;
```

- `1on1`: `2026-05-22-1on1-user@co.com.md` (full date — happens weekly)
- `feedback`, `assessment`, `performance-review`: `2026-05-<type>-user@co.com.md` (year-month — happens monthly at most)

### 4 — Self-email resolution in `member.command.ts`

Add a helper to resolve the application user's own email from `my-career/`:

```typescript
async function resolveSelfEmail(workspaceRoot: string): Promise<string | null> {
  const careerDir = path.join(workspaceRoot, 'my-career');
  if (!fs.existsSync(careerDir)) return null;
  const files = fs.readdirSync(careerDir).filter((f) => f.endsWith('.md'));
  if (files.length === 0) return null;
  const content = await fs.promises.readFile(path.join(careerDir, files[0] as string), 'utf8');
  const { data } = matter(content);
  return typeof data['email'] === 'string' ? data['email'].toLowerCase() : null;
}
```

In `runMemberAdd()`, when routing to `createMemberFile('feedback', ...)`:

```typescript
let fromEmail = opts.from?.trim().toLowerCase();
if (!fromEmail) {
  fromEmail = await resolveSelfEmail(ws) ?? undefined;
}
if (!fromEmail) {
  const { resolved } = await inquirer.prompt<{ resolved: string }>([{
    type: 'input',
    name: 'resolved',
    message: 'Reviewer email (--from):',
    validate: (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) || 'Valid email required',
  }]);
  fromEmail = resolved.trim().toLowerCase();
}
```

### 5 — `tmr member add` command — add `--from` option

```typescript
cmd
  .command('add <type-or-email> [email]')
  // ...existing options...
  .option('--from <email>', 'reviewer email for feedback files (defaults to your own email)')
```

---

## Notes for Developer Agent

- The year-month filename change (`YYYY-MM-<type>-<email>`) affects ALL four file types (1on1, feedback, assessment, performance-review), not just feedback. Update the general filename builder and all test assertions accordingly.
- `resolveSelfEmail()` uses `fs` synchronously for the directory read and `fs.promises` for the file read — or use `FileSystemService` methods if available. Keep it async-compatible with the command handler.
- `--from` flag validation: if a value is provided, validate it with `validateEmail()` before passing it to `createMemberFile()`. Surface `InvalidEmailError` via `printError` and return.
- The `feedbacks/` subdir is already scaffolded by `addMember()` after Story 9.1 lands — no additional directory creation needed in `createMemberFile()`.
- Run `npm run validate` before marking done.
