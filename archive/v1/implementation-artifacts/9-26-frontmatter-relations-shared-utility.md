---
baseline_commit: 315ac077d70465f20921880865ecce91ac3ebd81
---

# Story 9.26: Frontmatter-Relations Shared Utility

Status: done

## Story

As a developer mutating entity profile relationships,
I want a single utility for idempotent frontmatter array operations,
so that no service invents its own append/remove logic and all relationship writes are consistent.

## Acceptance Criteria

**AC1 — Array idempotence:** Given an entity profile exists, When `addRelation(path, 'direct_reports', '[[...|jane@co.com]]', fs)` is called twice, Then the array contains exactly one entry.

**AC2 — Scalar overwrite:** Given a profile with `current_manager: "[[...|old]]"`, When `addRelation(path, 'current_manager', '[[...|new]]', fs)` is called, Then `current_manager` is replaced (not appended).

**AC3 — removeRelation on absent key is silent:** Given `removeRelation` is called on a key that does not exist in frontmatter, Then no error is thrown.

**AC4 — removeRelation filters array:** Given an array contains the value, When `removeRelation` is called, Then the value is filtered out; the key stays present as `[]`.

**AC5 — Test coverage:** Tests in `tests/utils/frontmatter-relations.test.ts` cover all 5 cases above (AC1–AC4 + missing file guard for `addRelation`).

**AC6 — Missing file guard:** Given `addRelation` is called on a path that does not exist, Then it throws an `Error` with a message containing the missing path.

**AC7 — `setScalar` writes value:** Given a profile exists with any frontmatter, When `setScalar(path, 'last_1on1', '2026-06-09', fs)` is called, Then the frontmatter contains `last_1on1: '2026-06-09'` and the body content is unchanged.

**AC8 — `setScalar` on missing file is silent:** Given a path that does not exist, When `setScalar` is called, Then it returns without throwing.

**AC9 — Body preservation:** Given a profile with body prose (paragraphs, headings, section content), When any of the three utility functions runs, Then the body content is identical after the operation.

## Tasks / Subtasks

- [x] Task 1 — Create `src/utils/frontmatter-relations.ts` (AC: 1, 2, 3, 4, 6, 7, 8, 9)
  - [x] Define `RelationKey` type union (all keys below — see Dev Notes for canonical list)
  - [x] Define `SCALAR_KEYS` set with `current_manager`, `tasks`, `today`, `this_week`, `this_month`, `this_quarter`
  - [x] Implement `addRelation(filePath, key, wikiLink, fs)` — reads file, parses with gray-matter, appends to array OR overwrites scalar, writes back via `fs.writeFile`; throws if file does not exist
  - [x] Implement `removeRelation(filePath, key, wikiLink, fs)` — reads, filters array (or clears scalar if matches), writes back; no-op if file missing
  - [x] Implement `setScalar(filePath, key, value, fs)` — reads, sets key, writes back; no-op if file missing

- [x] Task 2 — Create `tests/utils/frontmatter-relations.test.ts` (AC: 1–9)
  - [x] Use real `fs-extra` + `os.tmpdir()` + real `FileSystemService` instance (same pattern as `self-email.test.ts`)
  - [x] `addRelation` — idempotent array test (add same value twice, assert length 1) — AC1
  - [x] `addRelation` — scalar overwrite test (`current_manager` replaced, not appended) — AC2
  - [x] `addRelation` — missing file throws with path in message — AC6
  - [x] `removeRelation` — absent key is silent (no throw) — AC3
  - [x] `removeRelation` — filters value from array; key remains as `[]` — AC4
  - [x] `removeRelation` — missing file is silent (no throw) — AC3 variant
  - [x] `setScalar` — writes value; body unchanged — AC7, AC9
  - [x] `setScalar` — missing file is silent — AC8
  - [x] Body preservation test — add relation to file with prose body, assert body identical — AC9

## Dev Notes

### Critical: Vocabulary Reconciliation

> ⚠ The draft code block inside Section 4 ("Story 9.26") of the sprint change proposal uses `'manager'` in the `RelationKey` union and `SCALAR_KEYS`. **This is wrong.** The final vocabulary was decided in Section 3 (decision #7) and codified in Section 3.5 of the same document. The canonical scalar for the manager relationship is **`current_manager`**, not `manager`. All downstream stories (9.28–9.36) use `current_manager`.
>
> Do not implement the draft code as-is. Use the canonical field names below.

### `RelationKey` — Canonical Union (post-decision-#7)

```typescript
export type RelationKey =
  | 'current_manager'    // scalar — the manager this entity reports to right now
  | 'previous_manager'   // array  — historical managers
  | 'direct_reports'     // array  — people who report to this entity
  | 'leadership'         // array  — upward chain (skip-level, CTO, CEO)
  | 'other_leaderships'  // array  — matrix / dotted-line
  | 'teams'              // array  — teams this entity belongs to
  | 'projects'           // array  — projects this entity is on
  | 'members'            // array  — members of a team (used on team-members file)
  | 'stakeholders'       // array  — stakeholders of a project
  | 'tasks'              // scalar — wiki-link to my-tasks/tasks.md (self profile only)
  | 'today'              // scalar — wiki-link to my-tasks/today.md
  | 'this_week'          // scalar — wiki-link to my-tasks/this-week.md
  | 'this_month'         // scalar — wiki-link to my-tasks/this-month.md
  | 'this_quarter';      // scalar — wiki-link to my-tasks/this-quarter.md

const SCALAR_KEYS: ReadonlySet<RelationKey> = new Set([
  'current_manager',
  'tasks',
  'today',
  'this_week',
  'this_month',
  'this_quarter',
]);
```

### `setScalar` — Key Union

```typescript
export type ScalarKey =
  | 'last_1on1'
  | 'last_feedback'
  | 'last_assessment'
  | 'last_performance_review'
  | 'archived'
  | 'archived_date'
  | 'termination'
  | 'termination_date'
  | 'termination_note'
  | 'current_manager'  // also settable directly (e.g. rotate manager on archive)
  | 'start_date'
  | 'date_added';
```

### Correct Implementation (with revised vocabulary)

```typescript
import matter from 'gray-matter';
import type { FileSystemService } from '../services/file-system.service.js';

export type RelationKey = /* ... full union above ... */;

const SCALAR_KEYS: ReadonlySet<RelationKey> = new Set([
  'current_manager',
  'tasks',
  'today',
  'this_week',
  'this_month',
  'this_quarter',
]);

export async function addRelation(
  filePath: string,
  key: RelationKey,
  wikiLink: string,
  fs: FileSystemService,
): Promise<void> {
  if (!(await fs.exists(filePath))) {
    throw new Error(`Cannot add relation to missing file: ${filePath}`);
  }
  const content = await fs.readFile(filePath);
  const parsed = matter(content);
  const data = parsed.data as Record<string, unknown>;

  if (SCALAR_KEYS.has(key)) {
    data[key] = wikiLink;
  } else {
    const existing = Array.isArray(data[key]) ? (data[key] as string[]) : [];
    if (!existing.includes(wikiLink)) existing.push(wikiLink);
    data[key] = existing;
  }
  await fs.writeFile(filePath, matter.stringify(parsed.content, data));
}

export async function removeRelation(
  filePath: string,
  key: RelationKey,
  wikiLink: string,
  fs: FileSystemService,
): Promise<void> {
  if (!(await fs.exists(filePath))) return;
  const content = await fs.readFile(filePath);
  const parsed = matter(content);
  const data = parsed.data as Record<string, unknown>;

  if (SCALAR_KEYS.has(key)) {
    if (data[key] === wikiLink) delete data[key];
  } else {
    const existing = Array.isArray(data[key]) ? (data[key] as string[]) : [];
    data[key] = existing.filter((v) => v !== wikiLink);
  }
  await fs.writeFile(filePath, matter.stringify(parsed.content, data));
}

export async function setScalar(
  filePath: string,
  key: ScalarKey,
  value: string | boolean,
  fs: FileSystemService,
): Promise<void> {
  if (!(await fs.exists(filePath))) return;
  const content = await fs.readFile(filePath);
  const parsed = matter(content);
  const data = parsed.data as Record<string, unknown>;
  data[key] = value;
  await fs.writeFile(filePath, matter.stringify(parsed.content, data));
}
```

### Key Design Invariants

- **gray-matter is already a project dependency** (`gray-matter: ^4.0.3` in `project-context.md`). No new `package.json` entry needed.
- **`matter.stringify(content, data)`** preserves the body. The `parsed.content` returned by `matter()` is the body without the front-matter block. Passing it back as the first argument to `matter.stringify()` keeps body content intact. Verify this in tests (AC9).
- **`fs.writeFile` is atomic** (temp-file/rename pattern in `FileSystemService`). No partial-write risk.
- **Do NOT** import from `dist/` — import from `src/` only.
- **ESM import extension** — all imports in the new file MUST use `.js` extension: `import matter from 'gray-matter';` (no extension for npm packages, `.js` for local source).
- **TypeScript strict mode** — all function parameters and returns must be fully typed. No `any`. Use `unknown` and narrow.
- **File naming** — `frontmatter-relations.ts` (kebab-case, no role suffix needed for pure utility). Matches the pattern of `wiki-link.ts`, `normalization.ts`.
- **No barrel index** — consumers import directly: `import { addRelation, removeRelation, setScalar } from '../../utils/frontmatter-relations.js'`.

### Testing Strategy

Use a **real filesystem + real `FileSystemService`** (same pattern as `self-email.test.ts` and `workspace.test.ts`). Rationale: the utility is pure file I/O + parsing — a real tmpdir test exercises the full round-trip without complex mocking.

```typescript
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Dynamic imports — ESM-safe
const { FileSystemService } = await import('../../src/services/file-system.service.js');
const { addRelation, removeRelation, setScalar } = await import('../../src/utils/frontmatter-relations.js');

describe('frontmatter-relations', () => {
  let tmpDir: string;
  let fss: InstanceType<typeof FileSystemService>;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tmr-fm-test-'));
    fss = new FileSystemService();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // Helper: write a profile with frontmatter + body
  function writeProfile(fileName: string, frontmatter: Record<string, unknown>, body = '\n# Profile\n\n## Notes\n'): string {
    const filePath = path.join(tmpDir, fileName);
    const matter = require('gray-matter'); // or dynamic import — see note below
    fs.writeFileSync(filePath, matter.stringify(body, frontmatter));
    return filePath;
  }
});
```

> Note: Since the project is ESM, use `const matter = await import('gray-matter')` inside `beforeEach` or inline. Alternatively, write the frontmatter string directly in tests without requiring gray-matter (e.g. use `---\nemail: ...\n---\n# Body\n`). The direct string approach avoids a circular import concern and is simpler for the test helper.

### gray-matter behavior: `matter.stringify` output format

`matter.stringify(content, data)` produces:

```yaml
---
key1: value1
arrays:
  - item1
  - item2
---

# Body content
```

The array items are YAML block-sequence style (one per line with `- `). This is the canonical output. Downstream consumers (`gray-matter.parse(content).data.key`) work regardless of YAML style. Do not add any special serializer.

### `matter.stringify` and trailing newlines

`gray-matter`'s `stringify` adds a trailing newline after the closing `---`. The `parsed.content` from `matter(rawContent)` typically includes a leading newline before the first heading. This is normal — do not strip or add extra newlines.

### What `addRelation` does NOT do (guard against scope creep)

- Does NOT call `formatWikiLink` — the caller passes the fully-formed wiki-link string
- Does NOT validate that the path is a profile (any `.md` file works)
- Does NOT read the entity type from frontmatter `relationship` field
- Does NOT support nested keys (e.g. `data.profile.manager`) — all keys are top-level

### Project Structure Notes

- **New file:** `src/utils/frontmatter-relations.ts`
- **New test file:** `tests/utils/frontmatter-relations.test.ts`
- No changes to any existing file in this story
- `src/types/relations.types.ts` is intentionally deferred to Story 9.27

### Architecture Compliance

- **Layer:** utility — no CLI command, no service, no direct AI calls. Pure file I/O via injected `FileSystemService`.
- **Import chain:** `frontmatter-relations.ts` imports only `gray-matter` (npm) and `FileSystemService` (type-only import acceptable). No circular deps.
- **`type` import:** use `import type { FileSystemService }` for the parameter type to minimize coupling. `fs: FileSystemService` in function signatures binds structurally.
- **Return types:** all exported functions return `Promise<void>` — declare explicitly (ESLint `explicit-function-return-type` is `warn`, treat as error).
- **No `console.log`** — no output in utility functions. Callers handle display.
- **No `process.exit()`** — throw errors for addRelation missing-file case; return silently for the silent cases.

### Downstream Consumers (context only — do NOT implement in this story)

This utility is consumed by Wave 2 stories:
- **9.28**: `addRelation(teamMembersPath, 'members', link, fs)` when `--team` member is added
- **9.29**: `addRelation` for `direct_reports`, `teams` on member profiles; `setScalar` for `current_manager`
- **9.30**: `addRelation` for `direct_reports`, `leadership`; `setScalar` for `current_manager`
- **9.31**: `setScalar` for `last_1on1`, `last_feedback`, `last_assessment`, `last_performance_review`
- **9.32**: `setScalar` for `last_performance_review`
- **9.33**: `addRelation` for `members`, `stakeholders`, `projects`
- **9.34**: `removeRelation` for `members` (team-members file), `direct_reports` (self); `setScalar` for `archived`, `archived_date`, `termination`, `termination_date`, `termination_note`

### References

- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-06-09-frontmatter-relationships.md` § Story 9.26 — Change Proposals & Acceptance Criteria]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-06-09-frontmatter-relationships.md` § Section 3 Decision #7 — Canonical field vocabulary (`current_manager` not `manager`)]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-06-09-frontmatter-relationships.md` § Section 3.5 — Frontmatter Schema Reference (all field types and waves)]
- [Source: `_bmad-output/project-context.md` § Technology Stack — `gray-matter: ^4.0.3`]
- [Source: `_bmad-output/project-context.md` § ESM & TypeScript — `.js` extension rule, `strict: true`, no `any`]
- [Source: `_bmad-output/project-context.md` § File & Folder Naming — `kebab-case`, no barrel `index.ts`]
- [Source: `_bmad-output/project-context.md` § Testing Rules — `tests/utils/` mirror, real tmpdir for FS tests]
- [Source: `src/services/file-system.service.ts` — `exists()`, `readFile()`, `writeFile()` signatures]
- [Source: `src/utils/wiki-link.ts` — `formatWikiLink` pattern (utility consumers call this; utility itself does NOT)]
- [Source: `tests/utils/self-email.test.ts` — real tmpdir + `fs-extra` testing pattern]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

_No blockers._

### Completion Notes List

- Implemented `addRelation`, `removeRelation`, and `setScalar` in `src/utils/frontmatter-relations.ts` using the canonical `RelationKey` and `ScalarKey` type unions from Dev Notes (vocabulary fix: `current_manager` not `manager`).
- Used `matter.stringify(parsed.content, data)` to guarantee body preservation on every write (AC9).
- `SCALAR_KEYS` set drives array-vs-scalar branching in `addRelation` and `removeRelation`.
- All 3 functions accept an injected `FileSystemService` for testability; no direct `fs` calls.
- Tests use real `fs-extra` + `os.tmpdir()` + dynamic `import()` of gray-matter for profile fixture writing (prevents YAML bracket-sequence misparse of `[[...]]` wiki-links).
- 12/12 tests pass (AC1–AC9 fully covered). No regressions introduced.

### File List

- src/utils/frontmatter-relations.ts (new)
- tests/utils/frontmatter-relations.test.ts (new)

### Review Findings

- [x] [Review][Patch] AC1 test should assert parsed array length, not raw-file regex count [tests/utils/frontmatter-relations.test.ts:50]
- [x] [Review][Patch] AC9 tests should compare parsed body identity, not substring presence [tests/utils/frontmatter-relations.test.ts:142]
- [x] [Review][Defer] Corrupt frontmatter type mismatches (scalar in array key) silently coerced [src/utils/frontmatter-relations.ts:69] — deferred, pre-existing vault data handled in 9.36
- [x] [Review][Defer] Concurrent read-modify-write on same file can lose updates [src/utils/frontmatter-relations.ts:53] — deferred, no file-lock pattern in codebase
- [x] [Review][Defer] Malformed YAML frontmatter throws uncaught gray-matter parse error [src/utils/frontmatter-relations.ts:63] — deferred, out of utility scope for v1
- [x] [Review][Defer] File rewritten even when relation data unchanged [src/utils/frontmatter-relations.ts:73] — deferred, optimization not required by spec
