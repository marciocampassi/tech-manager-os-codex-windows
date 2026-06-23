---
baseline_commit: 05002d39ef9faf92261037241dd03bc213141289
---

# Story 9.27: Relation Types and Project-Context Rule

Status: done

## Story

As an AI agent implementing entity-related code,
I want a typed vocabulary of relationship keys and an enforced anti-pattern rule,
so that body wiki-link regressions are prevented and frontmatter is the single source of truth.

## Acceptance Criteria

**AC1 — Types file exported:** `src/types/relations.types.ts` exports `IEntityRelations`, `ITeamRelations`, `IProjectRelations`, and `ISelfRelations` interfaces with the canonical vocabulary from decision #7 (`current_manager`, not `manager`; `previous_manager[]`; `other_leaderships[]`; self gets `today/this_week/this_month/this_quarter` not `goals`).

**AC2 — No dated artifact arrays in types:** `IEntityRelations` does NOT contain `one_on_ones`, `feedbacks`, `assessments`, or `performance_reviews` arrays (dated artifacts stay in body per decision #2; only `last_<type>` scalars appear).

**AC3 — project-context.md section added:** `_bmad-output/project-context.md` contains a "Frontmatter-Native Relationship Model" section inserted between "Shared Utilities" and "Usage Guidelines".

**AC4 — Anti-pattern rule documented:** The new section explicitly forbids `SectionParserService.appendToFile(profilePath, sectionName, wikiLink)` and `appendToHashSection(content, sectionName, '- [[...]]')` for structural relationships; names the correct replacement (`addRelation` from `frontmatter-relations.ts`).

**AC5 — Exception documented:** The rule correctly carves out the dated-artifact exception — `## 1on1s`, `## Feedbacks`, `## Assessments`, `## Performance Reviews` body appends remain valid for their chronological wiki-link lists (decision #2 revised).

**AC6 — No tests needed:** Pure type definitions + documentation. TypeScript compiler validates the types; no runtime test file required.

## Tasks / Subtasks

- [x] Task 1 — Create `src/types/relations.types.ts` (AC: 1, 2)
  - [x] Export `IEntityRelations` with canonical vocabulary (see Dev Notes for exact fields)
  - [x] Export `ITeamRelations` with `members?: string[]`
  - [x] Export `IProjectRelations` with `members?: string[]` and `stakeholders?: string[]`
  - [x] Export `ISelfRelations extends IEntityRelations` with `tasks/today/this_week/this_month/this_quarter` scalar links
  - [x] Verify file compiles without errors (`npm run typecheck` or `tsc --noEmit`)

- [x] Task 2 — Update `_bmad-output/project-context.md` (AC: 3, 4, 5)
  - [x] Insert new section "Frontmatter-Native Relationship Model" between "Shared Utilities — Brownfield State & Rules" and "Usage Guidelines"
  - [x] Document the structural→frontmatter rule with `addRelation` as the canonical write path
  - [x] Document the dated-artifact exception (body appenders still correct for 1on1s/feedbacks/assessments/reviews)
  - [x] Document the anti-pattern (no `appendToFile`/`appendToHashSection` for structural relationships)

- [x] Task 3 — Validate (AC: 6)
  - [x] Run `npm run typecheck` — zero new type errors
  - [x] Run `npm run lint` — zero new lint errors (no executable code to lint in the types file itself, but verify no issues)

## Dev Notes

### Critical Vocabulary Correction

> ⚠ The draft code block in Section 4 ("Story 9.27") of the sprint change proposal uses `manager` in `IEntityRelations` and `goals` in `ISelfRelations`. **These are outdated.** Decision #7 (Section 3) finalized:
> - `current_manager` (singular scalar, not `manager`)
> - `previous_manager[]` (array — historical)
> - `other_leaderships[]` (matrix / dotted-line)
> - Self profile `tasks/today/this_week/this_month/this_quarter` scalars (not `goals`)
>
> Do NOT implement the draft verbatim. Use the canonical vocabulary below.

### Canonical `IEntityRelations` Interface

```typescript
export interface IEntityRelations {
  current_manager?: string;          // scalar wiki-link — who this entity reports to now
  previous_manager?: string[];       // array — historical managers (append-only)
  direct_reports?: string[];         // array — people reporting to this entity
  leadership?: string[];             // array — upward chain (skip-level, CTO, CEO)
  other_leaderships?: string[];      // array — matrix / co-managers / dotted-line
  teams?: string[];                  // array — teams this entity belongs to
  projects?: string[];               // array — projects this entity is involved with
  start_date?: string;               // YYYY-MM-DD — when they started in role (user-fillable)
  date_added?: string;               // YYYY-MM-DD — profile creation date (auto-set)
  last_1on1?: string;                // scalar YYYY-MM-DD — updated by member/leadership add 1on1
  last_feedback?: string;            // scalar YYYY-MM — updated by member add feedback
  last_assessment?: string;          // scalar YYYY-MM — updated by member add assessment
  last_performance_review?: string;  // scalar YYYY-MM — updated by member/myself add performance-review
  archived?: boolean;                // set on tmr team archive/fire
  archived_date?: string;            // YYYY-MM-DD — set on archive/fire
  termination?: boolean;             // set on tmr team fire only
  termination_date?: string;         // YYYY-MM-DD
  termination_note?: string;         // human note
}
```

**DO NOT add** `one_on_ones`, `feedbacks`, `assessments`, or `performance_reviews` arrays. Decision #2 (revised) keeps those wiki-link lists in body `##` sections only. Only the `last_<type>` scalars live in frontmatter.

### Canonical `ITeamRelations` Interface

```typescript
export interface ITeamRelations {
  members?: string[];   // wiki-links to member profiles — used on <team>-members.md
}
```

### Canonical `IProjectRelations` Interface

```typescript
export interface IProjectRelations {
  members?: string[];       // wiki-links to entity profiles linked as members
  stakeholders?: string[];  // wiki-links to entity profiles linked as stakeholders
}
```

### Canonical `ISelfRelations` Interface

```typescript
export interface ISelfRelations extends IEntityRelations {
  tasks?: string;        // scalar wiki-link → my-tasks/tasks.md
  today?: string;        // scalar wiki-link → my-tasks/today.md
  this_week?: string;    // scalar wiki-link → my-tasks/this-week.md
  this_month?: string;   // scalar wiki-link → my-tasks/this-month.md
  this_quarter?: string; // scalar wiki-link → my-tasks/this-quarter.md
}
```

**No `goals` field.** Decision #7 expanded goals into the five individual task-shell scalars above.

### project-context.md Section Content

Insert verbatim between the "Relationship Service (Removed — Epic 1 Complete)" block and the `---` separator before "Usage Guidelines":

```markdown
### Frontmatter-Native Relationship Model

- **ALL structural entity-to-entity wiki-links MUST be written to frontmatter fields, not body sections.**
  Canonical types are defined in `src/types/relations.types.ts` (`IEntityRelations`, `ITeamRelations`,
  `IProjectRelations`, `ISelfRelations`).
- All structural relationship mutations MUST use `src/utils/frontmatter-relations.ts`
  (`addRelation`, `removeRelation`, `setScalar`) — never inline `matter.stringify()` for
  relationship changes.
- **Exception — dated artifact lists stay in body** (decision #2): `## 1on1s`, `## Feedbacks`,
  `## Assessments`, `## Performance Reviews` body sections are retained for their unbounded
  wiki-link lists. Only the `last_<type>` scalars (`last_1on1`, `last_feedback`,
  `last_assessment`, `last_performance_review`) live in frontmatter.
- Read paths use frontmatter only (hard cutover). Users with pre-migration vaults must run
  `tmr doctor --fix-frontmatter` (Story 9.36).

### Anti-Pattern (Critical — Body Link Regression)

**DO NOT** call `SectionParserService.appendToFile(profilePath, sectionName, wikiLink)` or
`appendToHashSection(content, sectionName, '- [[...]]')` for any **structural** relationship.
Use `addRelation()` from `src/utils/frontmatter-relations.ts` instead.

**Structural relationships (→ frontmatter):** `current_manager`, `previous_manager`,
`direct_reports`, `leadership`, `other_leaderships`, `teams`, `projects`, `members`, `stakeholders`.

**Dated artifact lists (→ body via `SectionParserService.appendToFile`, correct as-is):**
`## 1on1s`, `## Feedbacks`, `## Assessments`, `## Performance Reviews`.
```

### File Naming and Location

- `src/types/relations.types.ts` — follows the `kebab-case` + `.types.ts` suffix convention used by every other file in `src/types/`.
- No barrel `index.ts` — consumers import directly: `import type { IEntityRelations } from '../types/relations.types.js'`.
- **ESM extension**: All imports of this file elsewhere in `src/` MUST use `.js` extension: `import type { ... } from '../types/relations.types.js'`.
- `_bmad-output/project-context.md` — already exists; this story only appends a subsection.

### TypeScript Strict Mode Rules

- All fields `optional` (`?:`) because profiles may exist without every relationship populated.
- No `any` — all types are concrete (`string`, `string[]`, `boolean`).
- No default values — this is a pure interface file; no runtime code.
- The file MUST NOT import anything — zero dependencies.

### How These Types Are Consumed (Downstream Context)

These interfaces are used as **annotation/cast targets** by Wave 2 stories (9.28–9.34) when reading or writing frontmatter:

```typescript
const fm = matter(content).data as IEntityRelations;
const manager = fm.current_manager; // string | undefined
```

They are NOT used with `matter.stringify` directly — mutations always go through `frontmatter-relations.ts` functions. The types serve as documentation contracts and compile-time guards only.

### Relationship Between This Story and 9.26

Story 9.26 (`frontmatter-relations.ts`) already exists and is done. It defines:
- `RelationKey` type union — the keys accepted by `addRelation`/`removeRelation`
- `ScalarKey` type union — the keys accepted by `setScalar`

Story 9.27's `IEntityRelations` etc. are the **profile-shape interfaces** — what a parsed profile's frontmatter looks like as a TypeScript object. They complement `RelationKey`/`ScalarKey` (which are mutation keys) rather than replacing them. Both files should coexist in `src/types/` and `src/utils/` respectively.

### ESLint and Type File Rules

- `src/**/*.ts` is linted. The new types file is in `src/types/` — ESLint WILL run on it.
- `@typescript-eslint/no-explicit-any` is `error` — do not use `any` anywhere.
- `@typescript-eslint/explicit-function-return-type` is `warn` — irrelevant here (no functions).
- `no-console` is `warn` — irrelevant here (no runtime code).

### Architecture Compliance

- **Layer:** type definitions — no CLI, no service, no provider, no file I/O.
- **Import chain:** zero imports. Pure interface declarations.
- **No barrel index:** direct file imports only.

### Project Structure Notes

- **New file:** `src/types/relations.types.ts`
- **Modified file:** `_bmad-output/project-context.md`
- No changes to `src/utils/frontmatter-relations.ts` — that file is done and should not be modified.
- No new test files needed — interface-only TypeScript compiles to zero JavaScript output; no runtime behavior to test.
- `npm run validate` (lint + typecheck + test + build) should pass without any new failures.

### References

- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-06-09-frontmatter-relationships.md` § Section 3 Decision #7 — Canonical vocabulary (`current_manager`, `previous_manager`, `other_leaderships`, self: `today/this_week/this_month/this_quarter`)]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-06-09-frontmatter-relationships.md` § Section 3 Decision #2 (revised) — Dated artifacts stay in body; only `last_<type>` scalars in frontmatter]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-06-09-frontmatter-relationships.md` § Section 3.5 — Frontmatter Schema Reference (authoritative field table per entity type)]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-06-09-frontmatter-relationships.md` § Section 4 — Story 9.27 Acceptance Criteria and draft code (vocabulary is superseded by Section 3 decisions)]
- [Source: `_bmad-output/implementation-artifacts/9-26-frontmatter-relations-shared-utility.md` — Dev Notes §§ `RelationKey`, `ScalarKey` (complement not replace)]
- [Source: `src/utils/frontmatter-relations.ts` — existing `RelationKey` and `ScalarKey` unions]
- [Source: `_bmad-output/project-context.md` § ESM & TypeScript — `.js` extension rule, `strict: true`, no `any`]
- [Source: `_bmad-output/project-context.md` § File & Folder Naming — `kebab-case`, `.types.ts` suffix, no barrel `index.ts`]
- [Source: `src/types/member.types.ts` — example of types file structure in this project]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-5 (Cursor)

### Debug Log References

No blockers encountered. Pure interface file — zero imports, no runtime code.

### Completion Notes List

- Created `src/types/relations.types.ts` with four canonical interfaces: `IEntityRelations`, `ITeamRelations`, `IProjectRelations`, `ISelfRelations`. Used correct vocabulary per Decision #7 (`current_manager`, `previous_manager`, `other_leaderships`; self uses `today/this_week/this_month/this_quarter`, no `goals`).
- No dated-artifact arrays (`one_on_ones`, `feedbacks`, `assessments`, `performance_reviews`) in `IEntityRelations` per Decision #2 — only `last_<type>` scalars included.
- `ISelfRelations` extends `IEntityRelations` with five task-shell scalar links.
- Inserted "Frontmatter-Native Relationship Model" section in `_bmad-output/project-context.md` between the "Relationship Service (Removed)" block and the "Usage Guidelines" separator, verbatim per story Dev Notes.
- Anti-pattern rule documented: forbids `appendToFile`/`appendToHashSection` for structural relationships; names `addRelation` from `frontmatter-relations.ts` as the correct replacement.
- Dated-artifact exception correctly carved out: `## 1on1s`, `## Feedbacks`, `## Assessments`, `## Performance Reviews` body appends remain valid.
- `npm run typecheck` — exit 0, zero errors.
- `npm run lint` — exit 0, zero errors.

### File List

- src/types/relations.types.ts (new)
- _bmad-output/project-context.md (modified)

### Change Log

- 2026-06-10: Created `src/types/relations.types.ts` (IEntityRelations, ITeamRelations, IProjectRelations, ISelfRelations). Added "Frontmatter-Native Relationship Model" + Anti-Pattern sections to project-context.md. All tasks complete; typecheck and lint pass clean.
- 2026-06-10: Code review — added self task-shell scalars (`tasks`, `today`, `this_week`, `this_month`, `this_quarter`) to structural relationships list in project-context.md anti-pattern section.

### Review Findings

- [x] [Review][Decision] Self task-shell scalars omitted from structural relationships list — Resolved: added `tasks`, `today`, `this_week`, `this_month`, `this_quarter` to structural relationships list in `project-context.md`.

- [x] [Review][Defer] Hard cutover read paths without migration fallback [_bmad-output/project-context.md:373] — deferred, pre-existing
- [x] [Review][Defer] last_* scalar desync from body artifact lists [_bmad-output/project-context.md:369] — deferred, pre-existing
- [x] [Review][Defer] RelationKey vs interface dual maintenance [src/types/relations.types.ts:6] — deferred, pre-existing
- [x] [Review][Defer] Read-path YAML type coercion at cast sites [src/types/relations.types.ts:15] — deferred, pre-existing
