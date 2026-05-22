# Story 9.16 — tmr myself add performance-review

## Metadata

| Field | Value |
|---|---|
| **Epic** | Epic 9 — UAT Pre-Launch Polish |
| **Story ID** | 9.16 |
| **Priority** | Medium |
| **Effort** | S |
| **Risk** | Low — net new command, no changes to existing paths |

---

## Problem Statement

There is no way to create a performance-review file for the user's own career profile. `tmr member add performance-review <email>` only works for team members (direct reports, company members). The self-profile at `my-career/<email>.md` has no subdirectories — dated self-review files must be written directly into `my-career/`, not inside a subdirectory.

---

## Acceptance Criteria

- `tmr myself add performance-review` creates `my-career/YYYY-MM-performance-review-<own-email>.md`
- `tmr myself add performance-review --date 2026-03` creates the file with `date: 2026-03` in frontmatter
- The command reads the current user's email from the self-profile discovered via `EmailResolutionService.resolve()`; if no self-profile exists, the command errors with a clear message
- The generated file uses the same performance-review template as `tmr member add performance-review`
- A wiki-link to the created file is appended to the `## Performance Reviews` section of the self profile (`my-career/<own-email>.md`), creating the section if absent
- All tests pass

---

## Files to Change

| File | Change |
|---|---|
| `src/commands/myself.command.ts` | New file — `myself` command group with `add performance-review` subcommand |
| `src/cli.ts` | Register `createMyselfCommand()` as a static import (lightweight — no heavy deps) |
| `src/services/myself.service.ts` | New file — `MyselfService.addPerformanceReview(opts, ws)` |
| `tests/services/myself.service.test.ts` | Unit tests for `addPerformanceReview` |
| `tests/commands/myself.command.test.ts` | Command tests for `tmr myself add performance-review` |

---

## Implementation Detail

### 1 — `MyselfService.addPerformanceReview()`

```typescript
// src/services/myself.service.ts

export class MyselfService {
  constructor(
    private readonly _fs: FileSystemService,
    private readonly _emailResolution: EmailResolutionService,
    private readonly _template: TemplateService,
    private readonly _sectionParser: SectionParserService,
  ) {}

  async addPerformanceReview(
    opts: { date?: string },
    workspaceRoot: string,
  ): Promise<{ filePath: string; profilePath: string }> {
    // Discover self-profile email from my-career/
    const careerRoot = path.join(workspaceRoot, 'my-career');
    const files = await this._fs.listFiles(careerRoot);
    const mdFile = files.find((f) => f.endsWith('.md'));
    if (!mdFile) {
      throw new TmrError(
        'No self-profile found in my-career/. Run tmr init first.',
        'TMR_E001',
      );
    }

    const ownEmail = path.basename(mdFile, '.md');
    const profilePath = path.join(careerRoot, mdFile);

    // Date: year-month format (YYYY-MM)
    const rawDate = opts.date ?? todayIso();
    const datePrefix = rawDate.slice(0, 7); // "YYYY-MM"

    const fileName = `${datePrefix}-performance-review-${ownEmail}.md`;
    const filePath = path.join(careerRoot, fileName);

    const content = this._template.getTemplate('performance-review', rawDate, ownEmail);
    await this._fs.writeFile(filePath, content);

    // Back-link in self profile
    const wikiLink = `- [[${fileName}]]`;
    await this._sectionParser.appendToFile(profilePath, 'Performance Reviews', wikiLink);

    return { filePath, profilePath };
  }
}

export const myselfService = new MyselfService(
  fileSystemService,
  emailResolutionService,
  templateService,
  sectionParserService,
);
```

### 2 — `myself.command.ts`

```typescript
// src/commands/myself.command.ts

import { Command } from 'commander';
import { myselfService, MyselfService } from '../services/myself.service.js';
import { printError } from '../utils/display.js';
import chalk from 'chalk';

export async function runMyselfAddPerformanceReview(
  svc: MyselfService,
  opts: { date?: string },
): Promise<void> {
  const ws = svc.getWorkspaceRoot();
  let result;
  try {
    result = await svc.addPerformanceReview(opts, ws);
  } catch (err) {
    printError(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`${chalk.green('✔')} Created: ${result.filePath}\n`);
  process.stdout.write(`${chalk.dim('  Profile updated:')} ${result.profilePath}\n`);
}

export function createMyselfCommand(): Command {
  const svc = myselfService;
  const cmd = new Command('myself').description('manage your own career profile and documents');

  const addCmd = new Command('add').description('add a document to your career profile');

  addCmd
    .command('performance-review')
    .description('create a performance review for your own profile')
    .option('--date <date>', 'year-month for the file (YYYY-MM), defaults to current month')
    .action(async (opts: { date?: string }) => {
      await runMyselfAddPerformanceReview(svc, opts);
    });

  cmd.addCommand(addCmd);
  return cmd;
}
```

### 3 — Register in `cli.ts`

Add a static import alongside the other lightweight commands:

```typescript
import { createMyselfCommand } from './commands/myself.command.js';
```

And register after `createMemberCommand()`:

```typescript
p.addCommand(createMyselfCommand());
```

### 4 — File naming

- Profile: `my-career/<own-email>.md`
- Review file: `my-career/YYYY-MM-performance-review-<own-email>.md`

The `my-career/` directory is flat — no subdirectory is created. Both the profile and its dated files live at the same level.

---

## Notes for Developer Agent

- `MyselfService` needs a `getWorkspaceRoot()` method — follow the same pattern as `MemberService` (reads from `ConfigService`).
- `listFiles(dir)` must return file names (not full paths) for the `path.basename()` call to work correctly — verify `FileSystemService` contract.
- The `--date` flag accepts `YYYY-MM` or full `YYYY-MM-DD`; always use `rawDate.slice(0, 7)` as the filename prefix. The full value is passed to `getTemplate()` for the frontmatter `date:` field.
- `myself` is a static import (lightweight — no heavy deps) — do NOT lazy-load it in `cli.ts`.
- Run `npm run validate` before marking done.
