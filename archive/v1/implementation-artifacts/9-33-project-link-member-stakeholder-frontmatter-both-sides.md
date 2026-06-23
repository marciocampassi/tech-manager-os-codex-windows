---
baseline_commit: eeff6e6
---

# Story 9.33: `tmr project link-member` / `link-stakeholder` — frontmatter both sides

Status: done

## Story

As a project owner,
I want project ↔ entity links stored in **frontmatter** on both files (project gets `members:` / `stakeholders:`, the linked entity gets `projects:`),
so that the project graph is visible in Obsidian's graph view and queryable by Dataview without parsing body sections.

## Context & Rationale

This story is part of the **frontmatter-native relationship** migration (decision #1/#2/#7 of the sprint change proposal). Structural relationships — `members`, `stakeholders`, `projects` — must live in frontmatter arrays, NOT body `#`/`##` sections.

Today `ProjectService.linkMember`/`linkStakeholder` write the entity wiki-link into the project file's body `# Team Members` / `# Stakeholders` sections (via `appendToHashSection`) and write the reciprocal back-link into the entity's body `## Projects` section (via `appendToSection`). `listProjects` counts body lines (`countHashSection`). This story performs a **hard cutover**: project-side links move to frontmatter `members:`/`stakeholders:` arrays, the reciprocal moves to the entity's frontmatter `projects:` array, the overview template scaffolds the empty arrays, and `listProjects` reads frontmatter arrays only (no body fallback).

The reciprocal `projects:` entry is **identical** for `link-member` and `link-stakeholder` — the member-vs-stakeholder role distinction lives only on the project side (Schema #9).

## Acceptance Criteria

**AC1 — Project-side frontmatter (`link-member`):** When `tmr project link-member <name> <email>` runs against an existing project, the project overview file's FRONTMATTER `members:` array contains `[[<rel-path-to-entity-profile>|<email>]]`. The body `# Team Members` section is NOT written.

**AC2 — Project-side frontmatter (`link-stakeholder`):** When `tmr project link-stakeholder <name> <email>` runs, the overview file's FRONTMATTER `stakeholders:` array contains `[[...|<email>]]`. The body `# Stakeholders` section is NOT written.

**AC3 — Reciprocal entity-side frontmatter (both commands):** After either `link-member` or `link-stakeholder`, the linked entity's profile FRONTMATTER `projects:` array contains `[[<rel-path-to-project-overview>|<project-name>]]`. Both commands write the SAME reciprocal `projects:` entry (role distinction is project-side only).

**AC4 — Idempotency (both sides):** Running the same `link-member`/`link-stakeholder` twice yields exactly ONE entry in the project `members:`/`stakeholders:` array AND exactly ONE entry in the entity `projects:` array (`addRelation` dedupes).

**AC5 — Batch parity:** `tmr project link-members` / `link-stakeholders` (plural) write the same frontmatter on both sides for every email — project array gets each entity, and each entity's `projects:` array gets the project. (Today the batch methods write the project side only and skip the reciprocal; this story brings them to parity with the single commands.)

**AC6 — Template scaffolds empty arrays:** `getProjectOverviewTemplate` emits frontmatter `members: []` and `stakeholders: []`. The auto-populated body `# Team Members` / `# Stakeholders` sections are removed (the `## Overview` / `## Goals` / `## Timeline` / `## Notes` human-prose sections stay).

**AC7 — `listProjects` reads frontmatter (hard cutover):** `listProjects` derives `memberCount` from `frontmatter.members.length` and `stakeholderCount` from `frontmatter.stakeholders.length`. No body counting. A migrated/new project with empty arrays reports zero; a populated project reports the array lengths.

**AC8 — Unmigrated-vault warning:** When `listProjects` encounters a project overview whose frontmatter has NEITHER a `members` nor a `stakeholders` key (a pre-9.33 body-only file), it flags that project as needing migration; `tmr project list` prints a warning instructing the user to run `tmr doctor --fix-frontmatter`. Counts for such projects are zero.

**AC9 — Anti-pattern compliance:** All project/entity structural link mutations go through `addRelation` from `src/utils/frontmatter-relations.ts`. No `appendToHashSection`, no `appendToSection`, no inline `matter.stringify()` for these relationships. (Per project-context.md "Frontmatter-Native Relationship Model" — `members`/`stakeholders`/`projects` are structural relations, NOT dated artifacts.)

**AC10 — Validation:** `npm run typecheck`, `npm run lint`, and `npm run test` all pass — zero new type/lint errors. Existing project unit/integration/e2e tests updated to the frontmatter shape.

## Tasks / Subtasks

- [x] **Task 1 — `TemplateService.getProjectOverviewTemplate`: scaffold empty arrays, drop body sections** (AC: 6)
  - [x] Add `members: []` and `stakeholders: []` to the frontmatter block (after `date_created`)
  - [x] Remove the body `# Team Members` and `# Stakeholders` sections (keep `## Overview`, `## Goals`, `## Timeline`, `## Notes`)
  - [x] Do NOT touch `getStandupTemplate`, `getTemplate`, `getLeadership1on1Template`, `datedFrontmatter`, `yamlQuote`

- [x] **Task 2 — `ProjectService`: migrate link writes to frontmatter on both sides** (AC: 1–5, 9)
  - [x] Import `addRelation` from `'../utils/frontmatter-relations.js'`
  - [x] Add a private helper `_linkEntity(name, normalizedEmail, role: 'members' | 'stakeholders', ws): Promise<ILinkResult>` that:
    - resolves the project `overviewPath` and throws the existing "Project '<name>' not found" error if it does not exist
    - resolves the entity via `this._emailResolution.resolve(normalizedEmail, ws)`
    - computes the project-side bare wiki-link `entityLink = formatWikiLink(resolved.absolutePath, overviewPath, normalizedEmail)` (NO leading `- `)
    - `await addRelation(overviewPath, role, entityLink, this._fs)` (project side)
    - computes `projectLink = formatWikiLink(overviewPath, resolved.absolutePath, normalizeProjectName(name))`
    - `await addRelation(resolved.absolutePath, 'projects', projectLink, this._fs)` (reciprocal)
    - returns `{ wikiLink: entityLink, created: resolved.created }`
  - [x] Rewrite `linkMember` to `return this._linkEntity(name, email.toLowerCase(), 'members', ws)`
  - [x] Rewrite `linkStakeholder` to `return this._linkEntity(name, email.toLowerCase(), 'stakeholders', ws)`
  - [x] Rewrite `linkMembers` to loop `for (const email of emails)` (trim+lowercase, skip empty) calling `await this._linkEntity(name, normalizedEmail, 'members', ws)` and accumulate `{ linked, created }` (extracted into shared `_linkBatch` helper used by both batch methods)
  - [x] Rewrite `linkStakeholders` the same way with role `'stakeholders'`
  - [x] DELETE the now-dead `writeProjectBackLink`, `appendToHashSection`, and `countHashSection` private methods
  - [x] Remove the now-unused `appendToSection` import (from `'../utils/markdown-section.js'`)

- [x] **Task 3 — `ProjectService.listProjects`: read frontmatter arrays + migration flag** (AC: 7, 8)
  - [x] Import `matter` from `'gray-matter'`
  - [x] For each project, read the overview file, parse with `matter(content)`, cast `data` to `Partial<IProjectRelations>` (from `'../types/relations.types.js'`)
  - [x] `memberCount` from `data.members` length, `stakeholderCount` from `data.stakeholders` length (guarded by `Array.isArray`)
  - [x] Set `needsMigration` when NEITHER `members` nor `stakeholders` is an array (pre-9.33 body-only file)
  - [x] Keep the existing missing-overview-file branch returning zero counts (now also flags `needsMigration: true`)
  - [x] Return `IProjectSummary` including the new `needsMigration` field

- [x] **Task 4 — `IProjectSummary.needsMigration` type** (AC: 8)
  - [x] In `src/types/project.types.ts`, add `needsMigration?: boolean` to `IProjectSummary` (optional, with a one-line comment)

- [x] **Task 5 — `runProjectList` command: print migration warning** (AC: 8)
  - [x] In `src/commands/project.command.ts`, after rendering the table, if `rows.some((r) => r.needsMigration)`, print a `printWarning(...)` line instructing the user to run `tmr doctor --fix-frontmatter`
  - [x] Import `printWarning` from `'../utils/display.js'` (alongside existing `printError`)
  - [x] Do NOT use `console.*` or `chalk` directly for the warning — use `printWarning`

- [x] **Task 6 — Update unit tests** (AC: 1–10)
  - [x] `tests/services/project.service.test.ts`: frontmatter-array helpers (`frontmatterOverview`/`legacyOverview`/`entityProfile`), `lastWriteFor` helper; addProject/link/list assertions migrated to parse `matter(...).data`; reciprocal `projects` assertions; `needsMigration` true/false coverage
  - [x] `tests/integration/project.integration.test.ts`: AC1/AC5/AC7 assert `members`/`stakeholders`/`projects` frontmatter arrays on both sides
  - [x] `tests/e2e/epic-9-smoke.test.ts`: T-20/T-21 assert frontmatter `projects` array (single entry on idempotency)
  - [x] `tests/commands/project.command.test.ts`: warning-present / warning-absent tests for `runProjectList`
  - [x] `tests/services/template.service.test.ts`: assert `members: []`/`stakeholders: []` scaffolded, no body sections

- [x] **Task 7 — Validate** (AC: 10)
  - [x] `npx tsc --noEmit` — zero type errors
  - [x] `npx eslint` (changed src) — zero lint errors
  - [x] full `jest` run — 76 suites / 1349 tests pass; no regressions

### Review Findings

- [x] [Review][Patch] Missing overview file incorrectly returns `needsMigration: true`, triggering wrong `--fix-frontmatter` warning [src/services/project.service.ts:238]
- [x] [Review][Patch] `matter(content)` in `listProjects` has no try/catch — malformed YAML in any project file crashes the entire `tmr project list` command [src/services/project.service.ts:150]
- [x] [Review][Patch] `IProjectFrontmatter` interface stale — missing `members: string[]` and `stakeholders: string[]` fields; JSDoc still references "Team Members + Stakeholders sections" [src/types/project.types.ts:12-16]
- [x] [Review][Patch] AC4 project-side idempotency untested — T-21 checks entity `projects[]` length but never reads the project overview to verify `members[]` has exactly one entry after two `linkMember` calls [tests/e2e/epic-9-smoke.test.ts]
- [x] [Review][Patch] AC5 batch integration test verifies linked count only — never reads entity profiles to confirm `projects[]` reciprocal was written by `linkMembers` [tests/integration/project.integration.test.ts]
- [x] [Review][Patch] `linkStakeholders` (plural batch) has zero integration or e2e test coverage — AC5 parity with `linkMembers` is unverified at the real-filesystem level [tests/integration/project.integration.test.ts]
- [x] [Review][Defer] `_linkBatch` rechecks project existence on every iteration — N identical stat calls for same path [src/services/project.service.ts] — deferred, minor perf, not a correctness bug
- [x] [Review][Defer] `_linkBatch` not atomic — partial batch failure leaves some entities linked and others not, no partial result returned [src/services/project.service.ts] — deferred, pre-existing behavior, out of scope
- [x] [Review][Defer] `needsMigration` typed as optional (`?`) in `IProjectSummary` but always set by service — causes unnecessary defensive handling in consumers [src/types/project.types.ts] — deferred, pragmatic choice, no runtime impact
- [x] [Review][Defer] Null/falsy elements in YAML `members`/`stakeholders` arrays inflate counts — `data.members!.length` does not filter nulls [src/services/project.service.ts:155] — deferred, theoretical with hand-edited YAML

## Dev Notes

### Decision Log (read first)

- **D-9.33-1 — `members`/`stakeholders`/`projects` are STRUCTURAL relations → frontmatter via `addRelation`.** Per project-context.md "Frontmatter-Native Relationship Model" and the change proposal's decision #2, these are finite org-graph edges, not dated artifacts. They MUST use `addRelation` (idempotent array append). This is the opposite of the 9.31/9.32 dated-artifact pattern (which keeps body lists + a `last_<type>` scalar).
- **D-9.33-2 — Reciprocal `projects:` is role-agnostic.** Both `link-member` and `link-stakeholder` append the SAME `[[project|name]]` to the entity's `projects:` array (Schema #9: "Both `link-member` and `link-stakeholder` produce the same reciprocal `projects:` entry on the entity side — the role distinction lives only on the project side"). Do NOT create separate `member_projects`/`stakeholder_projects` fields.
- **D-9.33-3 — Bare wiki-links for `addRelation` (no `- ` prefix).** `addRelation` manages YAML array items; pass the bare `[[path|label]]` string. The old body code prefixed `- ` because it wrote Markdown list lines — that prefix is gone. `ILinkResult.wikiLink` now returns the bare link (the command prints `Linked: ${result.wikiLink}` — still fine).
- **D-9.33-4 — YAML quoting is automatic via `addRelation`.** `addRelation` writes through `matter.stringify` (js-yaml dump), which auto-quotes any string starting with `[` (a YAML flow-sequence indicator). So `[[...]]` array items are safely quoted WITHOUT the hand-rolled `yamlQuote` helper. This is why structural links use `addRelation` and NOT the template's hand-rolled frontmatter strings. Verified pattern: Stories 9.28/9.29/9.30 store wiki-links in frontmatter arrays this way.
- **D-9.33-5 — Hard cutover for reads (decision #5).** `listProjects` reads frontmatter only. A pre-9.33 (body-only) project has no `members`/`stakeholders` frontmatter keys → counts zero. The migration path is `tmr doctor --fix-frontmatter` (Story 9.36). This story surfaces a warning (AC8) so users aren't silently shown zero counts.
- **D-9.33-6 — Batch reaches parity with single (deliberate scope).** The current `linkMembers`/`linkStakeholders` write only the project side and skip the reciprocal back-link (an existing inconsistency). To satisfy the bidirectional contract and keep the graph correct, the batch methods now reuse `_linkEntity`, so they write both sides. This is a behavior addition justified by "the system must work end-to-end" — a member batch-linked to a project MUST show up in that member's `projects:` array.
- **D-9.33-7 — Command/types in scope (beyond the proposal's "Files Modified").** The proposal lists only `project.service.ts`, `template.service.ts`, and the service test. But AC8 (the unmigrated-vault warning) cannot be satisfied in the service layer (no-console rule), so the warning is surfaced in `runProjectList` via `printWarning`, which requires `IProjectSummary.needsMigration` (types) and a command change. This is the minimal correct way to meet AC8.

### Current State to Understand Before Changing

**`ProjectService` (`src/services/project.service.ts`)**:
- `linkMember` (`:195-213`) / `linkStakeholder` (`:218-236`): resolve email → build `- ` + `formatWikiLink(resolved.absolutePath, overviewPath, normalizedEmail)` → `appendToHashSection(content, 'Team Members'|'Stakeholders', wikiLink)` → write → `writeProjectBackLink(...)`.
- `writeProjectBackLink` (`:84-97`): resolves entity, builds `formatWikiLink(ovPath, resolved.absolutePath, normalizeProjectName)`, appends `- <link>` to body `## Projects` via `appendToSection`.
- `linkMembers`/`linkStakeholders` (`:241-292`): loop, `appendToHashSection` project side ONLY (no reciprocal).
- `appendToHashSection` (`:104-119`) / `countHashSection` (`:124-133`): body `# Section` helpers — become dead after this story.
- `listProjects` (`:297-319`): reads overview, `countHashSection(content, 'Team Members'|'Stakeholders')`.

**`addRelation(filePath, key, wikiLink, fs)` (`src/utils/frontmatter-relations.ts`)**:
- Throws `Cannot add relation to missing file: <path>` if the file does not exist (project overview and resolved entity both exist by the time we call it — overview is existence-checked, entity is auto-created by `resolve()`).
- For array keys (`members`, `stakeholders`, `projects` are all array `RelationKey`s — confirmed in the `RelationKey` union and NOT in `SCALAR_KEYS`): reads, parses, pushes the wiki-link only if not already present (idempotent), writes via `matter.stringify`.

**`formatWikiLink(resolvedPath, fromPath, displayName)` (`src/utils/wiki-link.ts`)**: returns `[[<relative path from dirname(fromPath) to resolvedPath>|displayName]]`, `/`-normalized. For the project side, `fromPath` = `overviewPath`, `resolvedPath` = entity profile. For the reciprocal, `fromPath` = entity profile, `resolvedPath` = `overviewPath`.

**`IProjectRelations` (`src/types/relations.types.ts:46-49`)**: `{ members?: string[]; stakeholders?: string[] }` — cast target for the overview frontmatter. `IEntityRelations.projects?: string[]` (`:22`) — the reciprocal field.

### Exact Change — `getProjectOverviewTemplate`

```typescript
getProjectOverviewTemplate(name: string, date: string): string {
  return `---
name: ${name}
type: project
date_created: ${date}
members: []
stakeholders: []
---

# ${name}

## Overview

## Goals

## Timeline

## Notes
`;
}
```

(Body `# Team Members` / `# Stakeholders` removed.)

### Exact Change — `_linkEntity` + public methods

```typescript
private async _linkEntity(
  name: string,
  normalizedEmail: string,
  role: 'members' | 'stakeholders',
  ws: string,
): Promise<ILinkResult> {
  const overviewPath = projectOverviewPath(ws, name);
  if (!(await this._fs.exists(overviewPath))) {
    throw new Error(`Project '${name}' not found. Run 'tmr project add ${name}' first.`);
  }
  const resolved = await this._emailResolution.resolve(normalizedEmail, ws);

  const entityLink = formatWikiLink(resolved.absolutePath, overviewPath, normalizedEmail);
  await addRelation(overviewPath, role, entityLink, this._fs);

  const projectLink = formatWikiLink(overviewPath, resolved.absolutePath, normalizeProjectName(name));
  await addRelation(resolved.absolutePath, 'projects', projectLink, this._fs);

  return { wikiLink: entityLink, created: resolved.created };
}

async linkMember(name: string, email: string, ws: string): Promise<ILinkResult> {
  return this._linkEntity(name, email.toLowerCase(), 'members', ws);
}

async linkStakeholder(name: string, email: string, ws: string): Promise<ILinkResult> {
  return this._linkEntity(name, email.toLowerCase(), 'stakeholders', ws);
}

async linkMembers(name: string, emails: string[], ws: string): Promise<IBatchLinkResult> {
  let linked = 0;
  let created = 0;
  for (const email of emails) {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) continue;
    const r = await this._linkEntity(name, normalizedEmail, 'members', ws);
    linked++;
    if (r.created) created++;
  }
  return { linked, created };
}
// linkStakeholders: identical with role 'stakeholders'
```

> NOTE: the batch methods previously re-checked existence per email implicitly via `projectOverviewPath`; `_linkEntity` now does the existence check on every call. For a non-existent project the first iteration throws — same net behavior as the single command (fail fast). Acceptable.

### Exact Change — `listProjects`

```typescript
const content = await this._fs.readFile(overviewPath);
const data = matter(content).data as IProjectRelations;
return {
  name,
  memberCount: data.members?.length ?? 0,
  stakeholderCount: data.stakeholders?.length ?? 0,
  needsMigration: data.members === undefined && data.stakeholders === undefined,
};
```

### Exact Change — `runProjectList` warning

```typescript
// after the table render loop:
if (rows.some((r) => r.needsMigration)) {
  printWarning(
    'Some projects store links in the old body format and show zero counts. ' +
      'Run `tmr doctor --fix-frontmatter` to migrate them to frontmatter.',
  );
}
```

### Scope Boundary — What This Story Does NOT Change

- **`addProject`** structure (dirs, deps.yaml) — only the template frontmatter/body changes.
- **`getStandupTemplate`** and all dated-artifact templates — untouched.
- **`addRelation`/`frontmatter-relations.ts`** — do NOT modify; `members`/`stakeholders`/`projects` are already array `RelationKey`s.
- **`tmr doctor --fix-frontmatter`** body→frontmatter migration — Story 9.36 (this story only emits the warning pointing at it).
- **Team / leadership / member services** — untouched (Stories 9.28–9.30 handled those).
- **`markdown-section.ts` (`appendToSection`)** — leave the utility in place (other code may use it); just stop importing it here.

### Anti-Patterns & Compliance (from project-context.md)

- ESM imports MUST use `.js` extension (`'../utils/frontmatter-relations.js'`, `'../types/relations.types.js'`).
- Structural relations via `addRelation` — NEVER `appendToHashSection`/`appendToSection`/inline `matter.stringify` (project-context "Anti-Pattern (Critical — Body Link Regression)": `projects`, `members`, `stakeholders` are explicitly listed as structural → frontmatter).
- `no-console` — the migration warning MUST go through `printWarning` from `display.ts` (yellow), never `console.*` or direct `chalk`.
- `no-explicit-any` — cast frontmatter to `IProjectRelations`/`IEntityRelations`, not `any`.
- `explicit-function-return-type` — annotate the new `_linkEntity` helper return type.
- Tests are NOT linted by ESLint (only `src/**`), but keep them typed.

### Previous Story Intelligence (9.28–9.32 learnings)

- **`addRelation` idempotency + auto-quoting** (9.28/9.29/9.30): array wiki-links round-trip safely through `matter.stringify`; assertions should parse with `matter(content).data[...]` rather than substring-matching raw YAML (js-yaml may quote with single quotes).
- **Parse frontmatter in tests** (9.31/9.32): use `import matter from 'gray-matter'` and assert against `matter(written).data` — robust to YAML quoting/serialization. The project integration test already imports `gray-matter`.
- **Feed writes back through the `readFile` mock for idempotency tests** (9.32 AC4 pattern): to test "twice → one entry", make `mockFS.readFile` return the most recently written content for that path so the second `addRelation` sees the first entry.
- **`NODE_OPTIONS=--experimental-vm-modules`**: run via `npm run test` (handles the flag), not bare `npx jest`.
- **e2e smoke `T-20`/`T-21`** assert the OLD body `## Projects` shape — they MUST be updated to the frontmatter `projects:` array, or they will fail under the hard cutover.

### Test Surface Summary (files that WILL break without updates)

| File | Why it breaks | Fix |
|---|---|---|
| `tests/services/project.service.test.ts` | `overviewContent()` builds body sections; 9.14 tests assert `## Projects` body; addProject asserts body headers | Switch to frontmatter arrays; parse with `matter` |
| `tests/integration/project.integration.test.ts` | AC1/AC5/AC7/full-workflow assert body `# Team Members`/`# Stakeholders` ordering | Assert `matter(...).data.members/stakeholders/projects` arrays |
| `tests/e2e/epic-9-smoke.test.ts` | T-20/T-21 assert `## Projects` body section | Assert frontmatter `projects` array (single entry for T-21) |
| `tests/commands/project.command.test.ts` | new behavior (warning) | Add warning-present / warning-absent tests |

### References

- [Source: `sprint-change-proposal-2026-06-09-frontmatter-relationships.md` § Story 9.33 (lines 888–913) — change proposals & ACs]
- [Source: same § Schema #9 — Project overview file (lines 306–317), incl. reciprocal `projects:` rule]
- [Source: same § Cross-Cutting Reciprocity Map (lines 438–440) — `project add` / `link-member` / `link-stakeholder` rows]
- [Source: same § field vocabulary decision #7 (line 142); `IProjectRelations` (lines 588–591); `IEntityRelations.projects` (line 573)]
- [Source: `project-context.md` § Frontmatter-Native Relationship Model + Anti-Pattern — `members`/`stakeholders`/`projects` listed as structural → frontmatter via `addRelation`]
- [Source: `src/services/project.service.ts` — current `linkMember`/`linkStakeholder`/`linkMembers`/`linkStakeholders`/`writeProjectBackLink`/`appendToHashSection`/`countHashSection`/`listProjects`]
- [Source: `src/services/template.service.ts:31-52` — current `getProjectOverviewTemplate`]
- [Source: `src/utils/frontmatter-relations.ts` — `addRelation` (array append, idempotent, throws on missing file); `RelationKey` includes `members`/`stakeholders`/`projects`]
- [Source: `src/utils/wiki-link.ts` — `formatWikiLink(resolvedPath, fromPath, displayName)`]
- [Source: `src/types/relations.types.ts:46-49,22` — `IProjectRelations`, `IEntityRelations.projects`]
- [Source: `src/types/project.types.ts:25-30` — `IProjectSummary`]
- [Source: `src/commands/project.command.ts:254-272` — `runProjectList`]
- [Source: `tests/services/project.service.test.ts`, `tests/integration/project.integration.test.ts`, `tests/e2e/epic-9-smoke.test.ts:330-348` — existing assertions to migrate]
- [Source: `_bmad-output/implementation-artifacts/9-32-...md` and `9-30-...md` — prior frontmatter/`addRelation`/reciprocal patterns]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (Cursor)

### Debug Log References

- `npx tsc --noEmit` → exit 0
- `npx eslint src/services/project.service.ts src/services/template.service.ts src/commands/project.command.ts src/types/project.types.ts` → exit 0
- `NODE_OPTIONS=--experimental-vm-modules npx jest` → 76 suites / 1349 tests pass

### Completion Notes List

- Hard cutover implemented: project↔entity structural links now live exclusively in frontmatter arrays (`members`/`stakeholders` on the project, `projects` on the entity), all mutated via `addRelation` (idempotent, auto-quoted).
- Introduced `_linkEntity` (single source of truth for both-sides writes) and `_linkBatch` (shared by `linkMembers`/`linkStakeholders`), bringing batch commands to bidirectional parity with the single commands (D-9.33-6).
- Deleted dead body-section helpers `writeProjectBackLink`, `appendToHashSection`, `countHashSection`; removed the `appendToSection` import (utility itself left intact for other consumers).
- `listProjects` now parses frontmatter and reports `needsMigration` when a pre-9.33 overview has neither `members` nor `stakeholders` arrays. Minor deviation from the spec snippet: used `Array.isArray(...)` guards instead of `=== undefined` — equivalent for the documented cases and more defensive against malformed scalar values. The missing-overview-file branch now also flags `needsMigration: true`.
- AC8 warning surfaced in `runProjectList` via `printWarning` (no-console compliant), driven by the new `IProjectSummary.needsMigration` flag.
- `tests/services/template.service.test.ts` added to scope (assertions for the new template frontmatter); not in the original Files Modified list.

### File List

- `src/services/template.service.ts`
- `src/services/project.service.ts`
- `src/types/project.types.ts`
- `src/commands/project.command.ts`
- `tests/services/project.service.test.ts`
- `tests/services/template.service.test.ts`
- `tests/integration/project.integration.test.ts`
- `tests/e2e/epic-9-smoke.test.ts`
- `tests/commands/project.command.test.ts`

## Change Log

| Date       | Change                                                                                                  |
| ---------- | ----------------------------------------------------------------------------------------------------- |
| 2026-06-13 | Implemented Story 9.33 — project↔entity links moved to frontmatter arrays on both sides; `listProjects` reads frontmatter + `needsMigration` warning; tests migrated. Status → review. |
