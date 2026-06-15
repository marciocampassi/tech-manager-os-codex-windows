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

---

## Tasks / Subtasks

- [x] Write failing tests: wiki-link in standup frontmatter + `--date` forwarding
- [x] Update `getStandupTemplate()` to accept optional `overviewPath` / `fromPath` and produce wiki-link
- [x] Update `addStandup()` to pass `overviewPath` and `filePath` to the template
- [x] Expose `--date` option on the `standup` CLI command
- [x] Fix integration test: updated old `project: platform-project` assertion to wiki-link form
- [x] `npm run validate` — 1195/1195 tests pass

### Review Findings (AI)

- [x] [Review][Patch] P1 — `--date` input not validated: raw string interpolated into filename and YAML frontmatter; path traversal and YAML injection possible [src/services/project.service.ts:158, src/commands/project.command.ts:319]
- [x] [Review][Patch] P2 — Integration test assertions fragmented: `toContain('[[')` and `toContain('platform-project.md|platform-project')` do not verify the `project:` key or a well-formed closed link [tests/integration/project.integration.test.ts:139-141]
- [x] [Review][Patch] P3 — No direct unit test for `getStandupTemplate` with paths: wiki-link generation tested only via service-level tests; failures surface with noisy signals [tests/services/template.service.test.ts]
- [x] [Review][Defer] D1 — Special characters in project name could corrupt wiki-link/YAML [src/services/template.service.ts] — deferred, normalizeSlug scope predates this diff
- [x] [Review][Defer] D2 — Quoted wiki-link `"[[...]]"` may not render in Obsidian graph/properties panel — deferred, product design decision; spec explicitly shows this form
- [x] [Review][Defer] D3 — Path arithmetic in `TemplateService` crosses concern boundary — deferred, mild design debt
- [x] [Review][Defer] D4 — No guard against silently overwriting existing standup file — deferred, pre-existing
- [x] [Review][Defer] D5 — No CLI-layer Commander argument-parsing test for `--date` registration — deferred, pre-existing test architecture
- [x] [Review][Defer] D6 — Third 9.13 service test (`standup with --date`) is redundant with pre-existing coverage — deferred, minor noise

---

## Dev Agent Record

### Implementation Notes

- `getStandupTemplate()` gained two optional params (`overviewPath?: string`, `fromPath?: string`). When both are provided the `project` frontmatter field becomes `"[[../overview.md|name]]"` via `formatWikiLink`; when called without them (e.g. from the existing `template.service.test.ts`) it falls back to the plain name, preserving backward compatibility.
- `addStandup()` in `ProjectService` already computed `overviewPath` via `projectOverviewPath(ws, name)` for the existence check — we reuse that value and pass it alongside the computed `filePath` to the template.
- The CLI `standup` command action now receives Commander's auto-populated `opts` object instead of a hardcoded `{}`.
- `tests/integration/project.integration.test.ts` contained `expect(content).toContain('project: platform-project')` — updated to assert on the wiki-link form.
- No new dependencies required.

### Completion Notes

All 4 ACs satisfied:
1. `tmr project standup <name> --date <date>` creates file with the specified date in filename ✅
2. No-flag invocation defaults to today ✅ (unchanged — service already uses `opts.date ?? todayIso()`)
3. Every standup file contains `project: "[[../overview.md|name]]"` wiki-link ✅
4. All 1195 tests pass ✅

New tests added: 3 in `project.service.test.ts`, 1 in `project.command.test.ts`.

### File List

- `src/commands/project.command.ts`
- `src/services/template.service.ts`
- `src/services/project.service.ts`
- `tests/services/project.service.test.ts`
- `tests/commands/project.command.test.ts`
- `tests/integration/project.integration.test.ts`

### Change Log

- Added `--date <date>` option to `standup` command in `createProjectCommand()` (2026-05-26)
- Updated `getStandupTemplate()` to accept optional `overviewPath`/`fromPath` and embed wiki-link (2026-05-26)
- Updated `addStandup()` to pass `overviewPath` and `filePath` to template (2026-05-26)
- Updated integration test to assert on wiki-link form (2026-05-26)

---

## Status

done
