# Story 9.13 — tmr project standup: --date Flag + Project Wikilink

## Metadata

| Field | Value |
|---|---|
| **Epic** | Epic 9 — UAT Pre-Launch Polish |
| **Story ID** | 9.13 |
| **Priority** | Low |
| **Effort** | XS |
| **Risk** | Minimal — additive CLI flag + template change |

---

## Problem Statement

Two gaps in `tmr project standup`:

1. `ProjectService.addStandup()` already accepts `opts.date` but the CLI command does not expose `--date` — the user cannot create a standup for a past or future date.
2. Standup files are created inside the project's `standups/` directory but contain no reference back to the project overview file — navigating from a standup to the project requires manual search.

---

## Acceptance Criteria

- `tmr project standup <name> --date 2026-05-20` creates `standups/2026-05-20-<name>-standup.md`
- `tmr project standup <name>` (no flag) continues to default to today
- Every generated standup file contains a `Project` frontmatter field with a wiki-link to the project overview file
- All tests pass

---

## Files to Change

| File | Change |
|---|---|
| `src/commands/project.command.ts` | Add `--date <date>` option to the `standup` command; pass to `runProjectStandup()` |
| `src/services/template.service.ts` | Update `getStandupTemplate()` to accept `projectOverviewPath` and embed a wiki-link in frontmatter |
| `src/services/project.service.ts` | Pass project overview path to `getStandupTemplate()` in `addStandup()` |
| `tests/services/project.service.test.ts` | Add `--date` test; add wikilink-in-template assertion |

---

## Implementation Detail

### 1 — Expose `--date` on the standup command

In `createProjectCommand()`:

```typescript
cmd
  .command('standup <name>')
  .description('create a standup note for a project')
  .option('--date <date>', 'date for the standup file (YYYY-MM-DD), defaults to today')
  .action(async (name: string, opts: { date?: string }) => {
    await runProjectStandup(svc, name, opts);
  });
```

No changes needed in `ProjectService.addStandup()` — it already reads `opts.date ?? todayIso()`.

### 2 — Project wikilink in standup template

In `addStandup()`, the project overview path is already computable:

```typescript
const overviewPath = path.join(projectBaseDir(ws, normalized), `${normalized}.md`);
// or whichever filename the project overview uses — check projectOverviewPath() helper
```

Pass it to the template:

```typescript
await this._fs.writeFile(
  filePath,
  this._template.getStandupTemplate(date, normalized, overviewPath, filePath),
);
```

In `getStandupTemplate()`, add a `project` frontmatter field:

```typescript
getStandupTemplate(date: string, projectName: string, overviewPath: string, fromPath: string): string {
  const wikiLink = formatWikiLink(overviewPath, fromPath, projectName);
  return matter.stringify(
    `\n## Updates\n\n## Blockers\n\n## Next Steps\n`,
    {
      date,
      project: wikiLink,
    }
  );
}
```

The resulting frontmatter:
```yaml
---
date: 2026-05-22
project: "[[../../project-overview|my-project]]"
---
```

---

## Notes for Developer Agent

- Verify the project overview filename convention in `ProjectService` (it may be `<name>.md` or `<name>-overview.md`) — use whatever `addProject()` writes.
- `formatWikiLink` from `src/utils/wiki-link.ts` computes the relative path correctly.
- Run `npm run validate` before marking done.
