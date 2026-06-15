---
baseline_commit: fbc6a9d70ad6090bfdd8e29003853aec03783300
---

# Story 9.32: `tmr myself add performance-review` — body wiki-link + frontmatter scalar

Status: done

## Story

As a vault owner,
I want my self-profile's `## Performance Reviews` body section updated with each new review and a `last_performance_review` scalar in frontmatter — AND the dated file itself to carry structured frontmatter (`type`, `date`, `subject`),
so that my profile stays compact over time while the performance-review file is machine-readable and graph-navigable.

## Acceptance Criteria

**AC1 — Dated file frontmatter (Schema #15):** When `tmr myself add performance-review` runs, the created file (`my-career/performance-reviews/YYYY-MM-performance-review-<email>.md`) has frontmatter `type: performance-review`, `date: YYYY-MM`, and `subject: "[[<relative-path-to-self-profile>|<own-email>]]"`. No `with:` or `from:` field — self-review has no other participant.

**AC2 — Body wiki-link preserved (existing, decision #2):** The self-profile `## Performance Reviews` body section gets `- [[performance-reviews/<file>]]` appended via `SectionParserService.appendToFile` — this is the existing correct behavior and MUST NOT be removed.

**AC3 — `last_performance_review` frontmatter scalar (new):** After the command runs, the self-profile at `my-career/<email>.md` has a `last_performance_review: YYYY-MM` scalar in its frontmatter (set via `setScalar`). Value equals `datePrefix` — the year-month slice (e.g. `2026-05`).

**AC4 — Scalar overwrite (compactness):** Running the command twice with different dates yields exactly one `last_performance_review` scalar — the most recent write wins. No array accumulates.

**AC5 — `subject` wiki-link path correctness:** `subject` is a relative path from the dated file's directory (`my-career/performance-reviews/`) to the self-profile (`my-career/<email>.md`). Using the real vault paths this resolves to `[[../me@co.com.md|me@co.com]]` (one level up, then the flat self-profile).

**AC6 — Backward-compat for missing self-profile:** If `my-career/` is empty, the existing `ConfigurationError` is thrown before any frontmatter/scalar work — no change to error behavior.

**AC7 — Validation:** `npm run typecheck`, `npm run lint`, and `npm run test` all pass — zero new type/lint errors, no regressions.

## Tasks / Subtasks

- [x] **Task 1 — Update `MyselfService.addPerformanceReview`** (AC: 1, 3, 5)
  - [x] Add imports: `setScalar` from `'../utils/frontmatter-relations.js'`, `formatWikiLink` from `'../utils/wiki-link.js'`, `type IDatedFileLinks` from `'../types/member.types.js'`
  - [x] After computing `filePath`, build `subjectLink = formatWikiLink(profilePath, filePath, ownEmail)`
  - [x] Build `links: IDatedFileLinks = { subject: subjectLink }` (no `with`, no `from` — self-review)
  - [x] Change `this._template.getTemplate('performance-review', datePrefix, ownEmail)` → `this._template.getTemplate('performance-review', datePrefix, ownEmail, links)` (adds 4th arg)
  - [x] After `this._sectionParser.appendToFile(...)`, add: `await setScalar(profilePath, 'last_performance_review', datePrefix, this._fs)`
  - [x] Keep ALL other logic unchanged (profile discovery, error handling, body append, return value)

- [x] **Task 2 — Update `tests/services/myself.service.test.ts`** (AC: 1–7)
  - [x] Add `gray-matter` import: `import matter from 'gray-matter'`
  - [x] Add `IDatedFileLinks` import from `'../../src/types/member.types.js'`
  - [x] Update 3 existing `getTemplate` call assertions to include the 4th `links` argument (use `expect.objectContaining({ subject: expect.stringContaining(OWN_EMAIL) })`)
  - [x] Add test: `'9.32: passes links with subject wiki-link containing own email'` — assert 4th arg has `subject` containing `OWN_EMAIL`
  - [x] Add test: `'9.32: links has no with or from field (self-review)'` — assert `call[3].with` is `undefined` and `call[3].from` is `undefined`
  - [x] Add test: `'9.32: sets last_performance_review scalar on self profile'` — mock `exists` to return `true`, assert `writeFile` was called for `PROFILE_PATH`, parse frontmatter and assert `matter(content).data['last_performance_review']` equals the date prefix

### Review Findings

_Code review 2026-06-12 — 3 layers (Blind Hunter, Edge Case Hunter, Acceptance Auditor). 0 decision-needed, 2 patch, 5 deferred, 5 dismissed as noise/false-positive/spec-prescribed._

- [x] [Review][Patch] AC5 subject assertion is substring-only — strengthen to assert the exact wiki-link `[[../<email>.md|<email>]]` [tests/services/myself.service.test.ts] — fixed: now asserts `links.subject === '[[../<email>.md|<email>]]'`
- [x] [Review][Patch] AC4 (scalar overwrite) has no dedicated test — add a twice-call test asserting a single latest `last_performance_review` [tests/services/myself.service.test.ts] — fixed: added overwrite test feeding profile writes back through readFile
- [x] [Review][Defer] No atomicity/rollback across writeFile → appendToFile → setScalar; a late failure leaves the dated file written but the profile body/scalar stale [src/services/myself.service.ts:86-91] — deferred, pre-existing (same non-transactional pattern as 9.30/9.31)
- [x] [Review][Defer] `setScalar` runs `matter(content)` which throws on corrupt profile YAML, after the body append already succeeded [src/utils/frontmatter-relations.ts:110-114] — deferred, pre-existing (deferred in 9.31)
- [x] [Review][Defer] `profilePath` from `EmailResolutionService.resolve()` may point at a non-self entity if the same email exists in a higher-priority scope (team/leadership) [src/services/myself.service.ts:65-66] — deferred, pre-existing resolution behavior (profilePath was already the appendToFile target before 9.32)
- [x] [Review][Defer] Multiple non-dated `.md` files in `my-career/` are picked arbitrarily (`nonDatedFiles[0]`, unsorted) → subject/profile could target the wrong file [src/services/myself.service.ts:53-62] — deferred, pre-existing (D-9.3-D2 family)
- [x] [Review][Defer] AC1 dated-file frontmatter (`type`/`date`/`subject`) is not asserted at the service layer because `TemplateService` is mocked; covered indirectly by `template.service.test.ts` [tests/services/myself.service.test.ts] — deferred, spec prescribed the mock approach

## Dev Notes

### Decision Log (read first)

- **D-9.32-1 — No `with` field for self-reviews.** Schema #15 explicitly states "No `with:` — self-review by default." The `links` object passed to `getTemplate` is `{ subject: subjectLink }` — no `with`, no `from`. The `datedFrontmatter()` helper in `TemplateService` (added in 9.31) handles this correctly: it only emits `with:` when `links.with` is present and `from:` when `links.from` is present.
- **D-9.32-2 — Dated artifact lists stay in the body (decision #2).** `SectionParserService.appendToFile(profilePath, 'Performance Reviews', wikiLink)` is CORRECT and MUST be kept. This story adds the `last_performance_review` scalar ALONGSIDE the existing body append — not replacing it.
- **D-9.32-3 — Services compute wiki-link strings; templates only interpolate (D-9.31-1).** `MyselfService` computes the `subject` string via `formatWikiLink()` and passes it in. `TemplateService` only interpolates — no path arithmetic inside the template.
- **D-9.32-4 — Self-profile is flat, not nested.** `my-career/<email>.md` sits directly in `my-career/` (not `my-career/<email>/`). The dated performance review is one directory deeper at `my-career/performance-reviews/<file>.md`. So `formatWikiLink(profilePath, filePath, ownEmail)` produces `[[../me@co.com.md|me@co.com]]` — one `../` up from `performance-reviews/`.
- **D-9.32-5 — `setScalar` is a no-op when profile is missing.** The `setScalar` implementation in `frontmatter-relations.ts` silently returns if `fs.exists(filePath)` is false. In the unit test setup `exists` defaults to `false`, making `setScalar` a no-op in tests that don't explicitly mock it — which keeps ALL existing tests passing without modification (the scalar write is invisible to them).

### Current State of `myself.service.ts` (what you MUST understand before editing)

```typescript
// Current (pre-9.32) — 3-arg getTemplate call, no setScalar, no formatWikiLink:

const content = this._template.getTemplate('performance-review', datePrefix, ownEmail);
await this._fs.writeFile(filePath, content);

const wikiLink = `- [[performance-reviews/${fileName}]]`;
await this._sectionParser.appendToFile(profilePath, 'Performance Reviews', wikiLink);

return { filePath, profilePath };
```

### Exact Change — `myself.service.ts`

**Add to imports section** (after existing imports, before the `// ── Helpers ──` divider):

```typescript
import { setScalar } from '../utils/frontmatter-relations.js';
import { formatWikiLink } from '../utils/wiki-link.js';
import type { IDatedFileLinks } from '../types/member.types.js';
```

**Replace the template call and add the scalar write:**

```typescript
// ── Build dated-file links (D-9.32-1, D-9.32-3) ────────────────────────────
const subjectLink = formatWikiLink(profilePath, filePath, ownEmail);
const links: IDatedFileLinks = { subject: subjectLink };

const content = this._template.getTemplate('performance-review', datePrefix, ownEmail, links);
await this._fs.writeFile(filePath, content);

const wikiLink = `- [[performance-reviews/${fileName}]]`;
await this._sectionParser.appendToFile(profilePath, 'Performance Reviews', wikiLink); // keep

await setScalar(profilePath, 'last_performance_review', datePrefix, this._fs); // NEW

return { filePath, profilePath };
```

### What TemplateService already produces (no change needed)

`TemplateService.getTemplate('performance-review', '2026-05', 'me@co.com', { subject: '[[../me@co.com.md|me@co.com]]' })` now produces (9.31 implemented the `links` optional branch):

```markdown
---
type: performance-review
date: 2026-05
subject: "[[../me@co.com.md|me@co.com]]"
---

# Performance Review for me@co.com

## Self Assessment

## Goals Review

## Achievements

## Areas for Improvement

## Next Period Goals
```

No `with:` because `links.with` is absent. No `from:` because `links.from` is absent. This is correct for Schema #15.

The legacy (3-arg) path still exists in `TemplateService` for backward compatibility — but after 9.32, `MyselfService` will use the 4-arg path. Verify no other caller passes 3 args to `getTemplate` for `performance-review` after this change (check `grep -r "getTemplate.*performance-review"` in `src/`).

### Exact Change — `myself.service.test.ts`

**Add imports at top of file:**

```typescript
import matter from 'gray-matter';
import type { IDatedFileLinks } from '../../src/types/member.types.js';
```

**Update 3 existing `getTemplate` assertions** (add 4th arg matcher):

```typescript
// Before:
expect(mockTemplate.getTemplate).toHaveBeenCalledWith(
  'performance-review',
  '2026-03',
  OWN_EMAIL,
);
// After:
expect(mockTemplate.getTemplate).toHaveBeenCalledWith(
  'performance-review',
  '2026-03',
  OWN_EMAIL,
  expect.objectContaining({ subject: expect.stringContaining(OWN_EMAIL) }),
);
```

Apply to all three `getTemplate` call sites in the test. Note: the first test uses `expect.stringMatching(/^\d{4}-\d{2}$/)` for the date — keep that; only the 4th arg is new.

**Add new test cases in the `addPerformanceReview` describe block:**

```typescript
it('passes links with subject wiki-link containing own email to getTemplate', async () => {
  await svc.addPerformanceReview({ date: '2026-05' }, WORKSPACE);

  const calls = mockTemplate.getTemplate.mock.calls as [string, string, string, IDatedFileLinks][];
  const [, , , links] = calls[0] as [string, string, string, IDatedFileLinks];
  expect(links).toBeDefined();
  expect(links.subject).toContain(OWN_EMAIL);
});

it('links has no with or from field (self-review has no other participant)', async () => {
  await svc.addPerformanceReview({ date: '2026-05' }, WORKSPACE);

  const calls = mockTemplate.getTemplate.mock.calls as [string, string, string, IDatedFileLinks][];
  const [, , , links] = calls[0] as [string, string, string, IDatedFileLinks];
  expect(links.with).toBeUndefined();
  expect(links.from).toBeUndefined();
});

it('sets last_performance_review scalar on self profile', async () => {
  mockFS.exists.mockResolvedValue(true);
  // readFile default returns '' — matter('') gives { data: {}, content: '' } which is valid

  await svc.addPerformanceReview({ date: '2026-05' }, WORKSPACE);

  // writeFile is called twice: (1) the dated file, (2) the profile scalar update
  const profileWrite = (mockFS.writeFile.mock.calls as [string, string][]).find(
    ([p]) => p === PROFILE_PATH,
  );
  expect(profileWrite).toBeDefined();
  const writtenContent = (profileWrite as [string, string])[1];
  expect(matter(writtenContent).data['last_performance_review']).toBe('2026-05');
});
```

### `formatWikiLink` path arithmetic for self-profile scenario

```
profilePath  = {WORKSPACE}/my-career/me@company.com.md
filePath     = {WORKSPACE}/my-career/performance-reviews/2026-05-performance-review-me@company.com.md

path.dirname(filePath)  = {WORKSPACE}/my-career/performance-reviews
path.relative(dirname, profilePath) = '../me@company.com.md'

result: [[../me@company.com.md|me@company.com]]
subject YAML field: subject: "[[../me@company.com.md|me@company.com]]"
```

### `setScalar` behavior reference (from `frontmatter-relations.ts`)

```typescript
export async function setScalar(
  filePath: string,
  key: ScalarKey,          // 'last_performance_review' is a valid ScalarKey
  value: string | boolean,
  fs: FileSystemService,
): Promise<void> {
  if (!(await fs.exists(filePath))) return; // no-op if profile missing
  const content = await fs.readFile(filePath);
  const parsed = matter(content);
  const data = parsed.data as Record<string, unknown>;
  data[key] = value;
  await fs.writeFile(filePath, matter.stringify(parsed.content, data));
}
```

`'last_performance_review'` is already declared in `ScalarKey` union in `frontmatter-relations.ts` — no type changes needed there.

### Scope Boundary — What This Story Does NOT Change

- **`TemplateService`** — already updated in 9.31 to accept optional `links`. No changes needed.
- **`member.types.ts`** — `IDatedFileLinks` and `LAST_SCALAR_KEY` already exist (Story 9.31). Import-only.
- **`frontmatter-relations.ts`** — `setScalar` and `ScalarKey` already cover `last_performance_review`. No changes needed.
- **`wiki-link.ts`** — `formatWikiLink` already exists. Import-only.
- **`myself.command.ts`** — no changes needed; the command layer only calls `svc.addPerformanceReview(opts, ws)`.
- **`MemberService`** / `LeadershipService` — not touched.
- **`tmr doctor --fix-frontmatter` backfill** — Story 9.36.
- **e2e smoke test (T-24)** — only asserts on path/existence (not frontmatter); no update needed.
- **`getRelationship1on1Template`** / `getProjectOverviewTemplate` / `getStandupTemplate` — not touched.

### Anti-Patterns & Compliance

- ESM imports MUST use `.js` extension even for `.ts` source files.
- `no-console` — NEVER use `console.log`; if a log is needed use `logger`.
- `no-explicit-any` — use `IDatedFileLinks` type; never `any`.
- `explicit-function-return-type` — return type on any new helper.
- Body append via `SectionParserService.appendToFile` is CORRECT for dated artifacts (decision #2 exception in project-context.md). Do NOT remove it or replace it with `addRelation`.
- Use `setScalar` from `frontmatter-relations.ts` — never inline `matter.stringify()` for the scalar mutation.
- No `process.exit()` — already compliant (uses `process.exitCode`).

### Pre-existing Deferred Items (Do NOT fix here)

From deferred-work.md:
- `_getSelfProfilePath` / profile discovery uses first `.md` without email-format check — pre-existing D2, out of scope.
- No dedup on `appendToFile` — pre-existing; spec's "deduplicated" AC is aspirational. Running same command twice WILL add a duplicate body line but keeps one scalar.
- Non-transactional dated-file → section-append → scalar write sequence — pre-existing architecture constraint.
- Empty-string `date` (not nullish) bypasses `?? todayIso()` — pre-existing; command layer validates.

### Previous Story Intelligence (9.31 learnings)

- **`gray-matter` YAML date quoting:** `gray-matter` serializes a full `YYYY-MM-DD` ISO date as a quoted string (`'2026-03-09'`), while `YYYY-MM` stays unquoted. Use `matter(content).data['last_performance_review']` in assertions (not `.toContain()`), to be quoting-agnostic. For this story, `datePrefix` is always `YYYY-MM`, so quoting is not an issue.
- **Test `exists` mock defaults to `false`:** `setScalar` no-ops when `exists` returns false. Existing tests require no changes — they implicitly test the case where the profile file is "absent" from the mock's perspective (no-op scalar). The new scalar assertion test must explicitly mock `exists` to `true`.
- **Jest must run with `NODE_OPTIONS=--experimental-vm-modules`:** Use `npm run test` (which includes this flag), not bare `npx jest`.
- **`mockResolvedValueOnce` for sequential mocks:** If a test needs `exists` to return different values for different calls (unlikely here), use `mockResolvedValueOnce` chains.
- **`matter('')` is valid:** `gray-matter` on an empty string returns `{ content: '', data: {} }` — safe to use as the default `readFile` mock return value for scalar write tests.

### References

- [Source: `sprint-change-proposal-2026-06-09-frontmatter-relationships.md` § Story 9.32 — Change Proposals & ACs]
- [Source: same § Schema #15 — Performance-review file (myself)]
- [Source: same § Cross-Cutting Reciprocity Map — row for `tmr myself add performance-review`]
- [Source: same § Decision #2 revised — dated artifacts stay in body + `last_<type>` scalar in frontmatter]
- [Source: `src/services/myself.service.ts` — full current implementation (pre-9.32)]
- [Source: `src/services/template.service.ts` — `getTemplate` 4th optional `links` param (added 9.31)]
- [Source: `src/utils/frontmatter-relations.ts:103-115` — `setScalar`; `ScalarKey` includes `last_performance_review`]
- [Source: `src/utils/wiki-link.ts` — `formatWikiLink(resolvedPath, fromPath, displayName)`]
- [Source: `src/types/member.types.ts` — `IDatedFileLinks` interface + `LAST_SCALAR_KEY` map (added 9.31)]
- [Source: `tests/services/myself.service.test.ts` — full current test suite (pre-9.32)]
- [Source: `tests/e2e/epic-9-smoke.test.ts:373-385` — T-24 (path/existence only, no frontmatter assertions)]
- [Source: `project-context.md` § Frontmatter-Native Relationship Model + Anti-Pattern exception for dated artifacts]
- [Source: `project-context.md` § Dated File Naming Convention — performance-review uses `YYYY-MM`]
- [Source: `_bmad-output/implementation-artifacts/9-31-dated-artifact-frontmatter-plus-body-wikilink-plus-last-scalar.md` — D-9.31-1 (services compute links), D-9.31-2 (body stays), AC9 (myself backward compat), gray-matter quoting debug note]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Cursor)

### Debug Log References

- `setScalar` is a no-op when `fs.exists` returns false. Default `MockFS.exists` is `false` → all existing tests remain unchanged (scalar write is invisible). New scalar assertion test explicitly mocks `exists → true`.
- `matter('')` (empty string from default `readFile` mock) is valid — produces `{ content: '', data: {} }`. `setScalar` writes `last_performance_review: 2026-05` into it cleanly.
- Full suite: 76 test suites / 1343 tests (3 new for Story 9.32). Zero regressions.

### Completion Notes List

- **AC1 (frontmatter):** `getTemplate` now receives `links = { subject: '[[../me@co.com.md|me@co.com]]' }`, which causes `TemplateService._datedFm` to emit `type: performance-review`, `date: YYYY-MM`, `subject: "[[...]]"` in the dated file's frontmatter. No `with` or `from` — self-review (Schema #15).
- **AC2 (body wiki-link preserved):** `SectionParserService.appendToFile(profilePath, 'Performance Reviews', wikiLink)` unchanged — body append is untouched.
- **AC3 (`last_performance_review` scalar):** `setScalar(profilePath, 'last_performance_review', datePrefix, this._fs)` added after the body append. Reads, mutates, rewrites the profile frontmatter.
- **AC4 (scalar overwrite):** `setScalar` always overwrites — one scalar regardless of how many reviews are created.
- **AC5 (`subject` path correctness):** `formatWikiLink(profilePath, filePath, ownEmail)` computes the correct relative path (`../me@co.com.md`) from the dated file's directory up to the flat self-profile.
- **AC6 (error behavior):** `ConfigurationError` is thrown before any links/scalar work when `my-career/` is empty — existing error test unchanged.
- **AC7 (validation):** `npm run typecheck` ✓, `npm run lint` ✓, `npm run test` ✓ 76 suites / 1343 tests.

### File List

- `src/services/myself.service.ts`
- `tests/services/myself.service.test.ts`

### Change Log

- 2026-06-12 — Implemented Story 9.32: `addPerformanceReview` now passes `links = { subject }` to `getTemplate` (Schema #15 frontmatter), and calls `setScalar(profilePath, 'last_performance_review', datePrefix)` after the body append. Added 3 new unit tests; updated 3 existing `getTemplate` call assertions to include the 4th `links` arg. Status → review.
- 2026-06-12 — Addressed code review findings — 2 patches applied (AC5 exact subject wiki-link assertion; AC4 scalar-overwrite test). 5 items deferred (pre-existing), 5 dismissed. myself.service suite: 15/15. Status → done.
