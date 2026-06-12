---
baseline_commit: ec293b6
---

# Story 9.31: Dated Artifact Frontmatter + Body Wiki-Link + last_* Scalar

Status: done

## Story

As an LLM agent reading a dated artifact (1on1, feedback, assessment, performance-review),
I want each dated file's frontmatter to declare its `type`, `date`, `subject`, and `with`/`from` as wiki-links,
so that I can identify the relationship without parsing the filename — while the subject's profile stays compact (a single `last_<type>` frontmatter scalar) and the chronological wiki-link list stays in the profile body section.

## Context & Rationale

This story implements **decision #2 (revised)** from the sprint change proposal: structural relationships live in frontmatter, but **dated chronological artifacts stay in the body** (`## 1on1s`, `## Feedbacks`, `## Assessments`, `## Performance Reviews`). The frontmatter stays compact regardless of how many artifacts accumulate over years, while a `last_<type>` scalar enables recency/sort queries.

It also fixes **bug B5**: `tmr member add feedback <email> --from <reviewer>` currently embeds the reviewer only in the filename and never resolves the reviewer email, so a non-existent reviewer becomes a dangling string reference. This story resolves the reviewer via `EmailResolutionService.resolve()` (auto-creating a stub profile if missing) and writes a `from:` wiki-link into the feedback file's frontmatter.

## Acceptance Criteria

**AC1 — Member 1on1 file frontmatter + body + scalar:** When `tmr member add 1on1 <email>` runs, the created dated file (`.../1on1s/<YYYY-MM-DD>-1on1-<email>.md`) frontmatter contains `type: 1on1`, `date: <YYYY-MM-DD>`, `subject: [[<rel-path-to-member-profile>|<email>]]`, and `with: [[<rel-path-to-self-profile>|<self-email>]]`; AND the member profile's **body** `## 1on1s` section has `- [[1on1s/<file>]]` appended; AND the member profile **frontmatter** has `last_1on1: <YYYY-MM-DD>` set.

**AC2 — Member feedback file (fixes B5):** When `tmr member add feedback <email> --from <reviewer>` runs and the reviewer profile does NOT exist, a company-member stub for `<reviewer>` is auto-created via `EmailResolutionService.resolve()`; AND the feedback file frontmatter contains `type: feedback`, `date: <YYYY-MM>`, `subject: [[...|<email>]]`, and `from: [[<rel-path-to-reviewer-profile>|<reviewer>]]`; AND the member profile **body** `## Feedbacks` section has the wiki-link appended; AND the member profile **frontmatter** has `last_feedback: <YYYY-MM>` set.

**AC3 — Member assessment & performance-review files:** When `tmr member add assessment <email>` (or `performance-review`) runs, the dated file frontmatter contains `type: <assessment|performance-review>`, `date: <YYYY-MM>`, `subject: [[...|<email>]]`, and `with: [[...|<self-email>]]`; the body section (`## Assessments` / `## Performance Reviews`) gets the wiki-link appended; and the profile frontmatter has `last_assessment` / `last_performance_review` set to `<YYYY-MM>`.

**AC4 — Leadership 1on1 file frontmatter + body + scalar:** When `tmr leadership add 1on1 <email>` runs, the dated file frontmatter contains `type: 1on1`, `date: <YYYY-MM-DD>`, `subject: [[<rel-path-to-leader-profile>|<email>]]`, and `with: [[<rel-path-to-self-profile>|<self-email>]]`; AND the leader profile **body** `## 1on1s` section has the wiki-link appended; AND the leader profile **frontmatter** has `last_1on1: <YYYY-MM-DD>` set. (Note: this changes the leadership 1on1 file `type` from the legacy `leadership-1on1` to the unified `1on1` per Schema #11.)

**AC5 — Scalar value matches the filename prefix:** The `last_<type>` scalar value equals `filePrefix(type, date)` — full ISO date (`YYYY-MM-DD`) for `1on1`, year-month (`YYYY-MM`) for `feedback`/`assessment`/`performance-review`.

**AC6 — Single scalar, not an array (compactness invariant):** After N dated files of the same type are created for one subject, the subject profile frontmatter contains exactly ONE `last_<type>` scalar (the most recent write wins) — NOT an N-entry array. The body section accumulates N wiki-link lines.

**AC7 — Graceful when self profile absent:** When `my-career/` has no `.md` profile, the `with` field is omitted from the dated file frontmatter (1on1/assessment/performance-review) and the file is still created with `type`, `date`, `subject`; the body append and `last_<type>` scalar still occur. No error is thrown.

**AC8 — Anti-pattern compliance:** The dated wiki-link list stays in the **body** via `SectionParserService.appendToFile` (correct per decision #2 — these are dated artifacts, NOT structural relations); the `last_<type>` scalar is written via `setScalar` from `src/utils/frontmatter-relations.ts`; NO inline `matter.stringify()` is used for the scalar mutation.

**AC9 — Backward compatibility for `myself.service`:** `MyselfService.addPerformanceReview` (Story 9.32 scope) is NOT modified by this story and continues to pass; its `getTemplate('performance-review', datePrefix, ownEmail)` 3-argument call still produces a valid file (legacy frontmatter retained when the new `links` argument is omitted).

**AC10 — Validation:** `npm run typecheck`, `npm run lint`, and `npm run test` all pass — zero new type/lint errors, no new test regressions. Existing template/member/leadership tests are updated to the new frontmatter shape.

## Tasks / Subtasks

- [x] **Task 1 — Add `IDatedFileLinks` type + `last_<type>` scalar map** (AC: 1–5)
  - [x] In `src/types/member.types.ts`, export `interface IDatedFileLinks { subject: string; with?: string; from?: string }` (pre-computed wiki-link strings)
  - [x] In `src/types/member.types.ts`, export `const LAST_SCALAR_KEY: Readonly<Record<FileType, 'last_1on1' | 'last_feedback' | 'last_assessment' | 'last_performance_review'>>` mapping each `FileType` to its scalar key (CRITICAL: `'performance-review'` → `'last_performance_review'` — hyphen to underscore; do NOT build the key via string interpolation, it would produce the wrong `last_performance-review`)

- [x] **Task 2 — Update `TemplateService` dated templates to emit subject/with/from frontmatter** (AC: 1–4, 9)
  - [x] Add an optional 4th param `links?: IDatedFileLinks` to `getTemplate(type, date, email, links?)`
  - [x] When `links` IS provided: emit frontmatter `type: <type>`, `date: <date>`, `subject: "<links.subject>"`, and either `with: "<links.with>"` (1on1/assessment/performance-review, only if `links.with` is set) or `from: "<links.from>"` (feedback). Drop the legacy `member: <email>` field in this branch.
  - [x] When `links` is omitted: keep the EXISTING legacy frontmatter (`date`, `member`, `type`) unchanged — preserves `myself.service` (Story 9.32 scope)
  - [x] Wiki-link values MUST be wrapped in double quotes in YAML (e.g. `subject: "[[...|x]]"`) because `[[` is a YAML flow-sequence indicator and breaks unquoted (matches `getStandupTemplate`'s quoted `project:` field pattern)
  - [x] Add an optional `links?: { subject: string; with?: string }` param to `getLeadership1on1Template(date, email, links?)`; when provided, emit `type: 1on1` (NOT `leadership-1on1`), `date`, `subject`, and `with` (if set); keep body sections unchanged; when omitted, keep legacy output
  - [x] Keep all body templates (`## Topics`/`## Action Items`/`## Notes`, etc.) unchanged
  - [x] Do NOT touch `getRelationship1on1Template` (dead in production — only referenced by tests) or `getProjectOverviewTemplate`/`getStandupTemplate`

- [x] **Task 3 — Update `MemberService.createMemberFile` for frontmatter + reviewer resolution + scalar** (AC: 1, 2, 3, 5, 6, 7, 8)
  - [x] After computing `filePath` (the dated file path), resolve the reviewer for feedback: if `type === 'feedback'`, call `await this._emailResolver.resolve(options.fromEmail, workspaceRoot)` to ensure the reviewer profile exists (B5 fix) and capture `reviewerResolution.absolutePath`
  - [x] Compute `subjectLink = formatWikiLink(profilePath, filePath, normalizedEmail)`
  - [x] Build the `IDatedFileLinks`:
    - feedback → `{ subject: subjectLink, from: formatWikiLink(reviewerResolution.absolutePath, filePath, options.fromEmail) }`
    - 1on1/assessment/performance-review → `{ subject: subjectLink, with: <selfLink-or-undefined> }` where `selfLink = formatWikiLink(selfPath, filePath, selfEmail)` and `selfPath` comes from `this._getSelfProfilePath(workspaceRoot)` (omit `with` when self profile is absent — AC7)
  - [x] Pass the links to `this._template.getTemplate(type, date, normalizedEmail, links)` and write the file
  - [x] KEEP the existing body append: `await this._sectionParser.appendToFile(profilePath, config.sectionName, wikiLink)` (decision #2 — dated lists stay in body)
  - [x] ADD scalar: `await setScalar(profilePath, LAST_SCALAR_KEY[type], filePrefix(type, date), this._fs)`
  - [x] Import `setScalar` from `'../utils/frontmatter-relations.js'` and `IDatedFileLinks`/`LAST_SCALAR_KEY` from `'../types/member.types.js'`
  - [x] `selfEmail = path.basename(selfPath, '.md')`

- [x] **Task 4 — Update `LeadershipService.add1on1` for frontmatter + scalar** (AC: 4, 5, 6, 7, 8)
  - [x] Compute `subjectLink = formatWikiLink(profilePath, filePath, normalizedEmail)` (leader is the subject)
  - [x] Resolve self via existing `this._getSelfProfilePath(workspaceRoot)`; if present compute `withLink = formatWikiLink(selfPath, filePath, path.basename(selfPath, '.md'))`, else omit `with`
  - [x] Call `this._template.getLeadership1on1Template(date, normalizedEmail, { subject: subjectLink, with: withLink })` and write the file
  - [x] KEEP the existing body append: `await this._sectionParser.appendToFile(profilePath, '1on1s', wikiLink)`
  - [x] ADD scalar: `await setScalar(profilePath, 'last_1on1', date, this._fs)` (`setScalar` is already imported in this file from Story 9.30)

- [x] **Task 5 — Update unit tests** (AC: 1–10)
  - [x] `tests/services/template.service.test.ts`: update assertions for `getTemplate(... , links)` new frontmatter (`subject`/`with`/`from`, `type`); add cases for the legacy no-`links` path (still emits `member:`); update `getLeadership1on1Template` cases for `type: 1on1` + subject/with when links passed, legacy when not
  - [x] `tests/services/member.service.test.ts`: update existing dated-file tests to expect `subject`/`with`/`from` frontmatter instead of `member:`; assert `setScalar` writes `last_<type>` (via the profile `writeFile` containing the scalar); add a feedback test asserting reviewer auto-creation (`resolve` called for `fromEmail`) and `from:` link; add an idempotency/compactness test (two 1on1s → single `last_1on1`, two body lines)
  - [x] `tests/services/leadership.service.test.ts`: update `add1on1` tests to expect `type: 1on1` + `subject`/`with` frontmatter and `last_1on1` scalar on the profile
  - [x] Confirm `tests/services/myself.service.test.ts` still passes UNCHANGED (legacy template path)
  - [x] Update integration tests if they assert on dated-file frontmatter: `tests/integration/member.integration.test.ts`, `tests/integration/leadership.integration.test.ts`, `tests/e2e/epic-9-smoke.test.ts` — adjust any `member:`/`type: leadership-1on1` assertions

- [x] **Task 6 — Validate** (AC: 10)
  - [x] `npm run typecheck` — zero new type errors
  - [x] `npm run lint` — zero new lint errors (src only; tests are not linted)
  - [x] `npm run test` — all suites pass; no new regressions

### Review Findings

_Code review 2026-06-11 — 3 layers (Blind Hunter, Edge Case Hunter, Acceptance Auditor). 0 decision-needed, 3 patch, 7 deferred, 8 dismissed as noise/false-positive/spec-prescribed._

- [x] [Review][Patch] Escape YAML-special chars (`"`, `\`) in `datedFrontmatter` wiki-link values to mirror `email-resolution.service.ts:116` `safeEmail` [src/services/template.service.ts:10-15] — fixed: added `yamlQuote()` helper
- [x] [Review][Patch] Normalize `fromEmail` to lowercase once so the feedback filename, the `from` wiki-link, and the resolved/auto-created reviewer profile all agree (mixed-case `--from` currently diverges) [src/services/member.service.ts:276,319-322] — fixed: `normalizedOptions` in `createMemberFile`
- [x] [Review][Patch] Reformat the single-line `_oneonone` frontmatter ternary to 3 lines to match siblings and the 100-col Prettier width [src/services/template.service.ts:136-137] — fixed
- [x] [Review][Defer] `last_<type>` overwrites on out-of-order dates (no chronological max) [src/services/member.service.ts:292; src/services/leadership.service.ts:168] — deferred, spec chose last-write-wins (AC6)
- [x] [Review][Defer] `setScalar` throws on malformed profile YAML, leaving partial state after earlier writes [src/utils/frontmatter-relations.ts:103-115] — deferred, pre-existing
- [x] [Review][Defer] No rollback across dated-file → section-append → scalar writes; reviewer stub auto-created even if a later write fails [src/services/member.service.ts:287-322] — deferred, pre-existing architecture
- [x] [Review][Defer] `_getSelfProfilePath` returns first/arbitrary `.md` (no email filter / multi-file warning) → bogus `with` link possible [src/services/member.service.ts:361-366; src/services/leadership.service.ts:70-75] — deferred, pre-existing (D-9.3-D2)
- [x] [Review][Defer] Empty-string `date` (not nullish) bypasses the `?? todayIso()` default and propagates into frontmatter/filename/scalar [src/services/member.service.ts:258] — deferred, pre-existing
- [x] [Review][Defer] Repeated same-date invocation appends a duplicate section wiki-link (no dedup in `appendToFile`) [src/services/section-parser.service.ts] — deferred, pre-existing
- [x] [Review][Defer] New 9.31 assertions check `subject:`/`from:` and the email separately (the email also appears in the body heading), so a malformed/empty link could still pass [tests/services, tests/integration] — deferred, minor test-quality

## Dev Notes

### Decision Log (read first)

- **D-9.31-1 — Service computes wiki-link strings; templates only interpolate.** `MemberService`/`LeadershipService` build the `subject`/`with`/`from` wiki-links with `formatWikiLink(targetProfilePath, datedFilePath, displayEmail)` and pass them as ready strings to the template. Templates stay (near-)pure string builders. Rationale: keeps templates testable without filesystem context and avoids growing the "path-arithmetic-in-TemplateService" debt flagged in the 9.13 review (D3). (`getStandupTemplate` is the one exception that does path math; do not extend that pattern.)
- **D-9.31-2 — Dated artifact lists stay in the body.** Per change-proposal decision #2 (revised), `## 1on1s`/`## Feedbacks`/`## Assessments`/`## Performance Reviews` body sections keep receiving wiki-links via `SectionParserService.appendToFile`. These are NOT structural relations, so the frontmatter anti-pattern rule does NOT apply to them. Only the `last_<type>` scalar goes to frontmatter.
- **D-9.31-3 — Leadership 1on1 `type` unifies to `1on1`.** Schema #11 is the single source of truth and lists `type: 1on1` for the file used by both member and leadership 1on1s. This story changes the leadership 1on1 frontmatter `type` from the legacy `leadership-1on1` to `1on1`. No production reader keys off `leadership-1on1` (verified: `listLeadership` derives recency from the filename date, not the frontmatter `type`). Update the template test accordingly.
- **D-9.31-4 — `with` is omitted (not empty) when self profile is absent.** Cleaner frontmatter than an empty string; AC7. The body append and `last_<type>` scalar are independent of the self profile and always run.
- **D-9.31-5 — Reviewer resolution for feedback (B5).** `createMemberFile` resolves `options.fromEmail` via `EmailResolutionService.resolve()` for feedback only. This auto-creates a `my-company/members/<reviewer>/<reviewer>.md` stub when the reviewer is unknown (the existing `_doResolve` step-4 shim), and yields the reviewer profile path for the `from` wiki-link. The command layer already guarantees `fromEmail` is present and validated for feedback (`member.command.ts`), so no new "missing fromEmail" handling is needed here.

### Current State to Understand Before Changing

**`TemplateService.getTemplate` (current, `src/services/template.service.ts:89-178`)** dispatches to private `_oneonone`/`_feedback`/`_assessment`/`_performanceReview`, each emitting frontmatter `date`, `member: <email>`, `type`. There is no `subject`/`with`/`from`. The signature is `(type, date, email)`.

**`TemplateService.getLeadership1on1Template` (current, `:51-68`)** emits `date`, `member: <email>`, `type: leadership-1on1`.

**`MemberService.createMemberFile` (current, `src/services/member.service.ts:249-285`)**:
```typescript
const resolution = await this._emailResolver.resolve(normalizedEmail, workspaceRoot);
const profilePath = resolution.absolutePath;
// ... build subDirPath, prefix, fileName ...
const content = this._template.getTemplate(type, date, normalizedEmail);
await this._fs.writeFile(filePath, content);
const wikiLink = `- [[${config.subDir}/${fileName}]]`;
await this._sectionParser.appendToFile(profilePath, config.sectionName, wikiLink);
return { filePath, profilePath, wikiLink };
```
It resolves the SUBJECT (member) but never resolves `options.fromEmail`, never writes a `last_<type>` scalar, and the template gets no link info. `_getSelfProfilePath` already exists on this service (`:316-321`). `filePrefix(type, isoDate)` already exists (`:31-33`) → ISO for 1on1, year-month otherwise.

**`LeadershipService.add1on1` (current, `src/services/leadership.service.ts:132-160`)** writes the dated file via `getLeadership1on1Template(date, email)` and appends the body link via `appendToFile(profilePath, '1on1s', wikiLink)`. `_getSelfProfilePath` and `setScalar` are already imported/available (Story 9.30). No `last_1on1` scalar today.

**`setScalar` (`src/utils/frontmatter-relations.ts:103-115`)** — `ScalarKey` already includes `last_1on1`, `last_feedback`, `last_assessment`, `last_performance_review`. Silent no-op if the target file is missing. No utility changes needed.

**`formatWikiLink(resolvedPath, fromPath, displayName)` (`src/utils/wiki-link.ts`)** → returns `[[<relative path from dirname(fromPath) to resolvedPath>|displayName]]` with `/`-normalized separators. For a dated file, `fromPath` = the dated `filePath`, `resolvedPath` = the target profile.

### Exact Change — `TemplateService` (new frontmatter branch)

Pattern for each dated template (shown for 1on1; apply the same shape to feedback→`from`, assessment/performance-review→`with`):

```typescript
getTemplate(type: FileType, date: string, email: string, links?: IDatedFileLinks): string {
  switch (type) {
    case '1on1':
      return this._oneonone(date, email, links);
    // ... etc, threading `links` through
  }
}

private _oneonone(date: string, email: string, links?: IDatedFileLinks): string {
  const fm = links
    ? this._datedFm('1on1', date, links)            // type/date/subject/with
    : `date: ${date}\nmember: ${email}\ntype: 1on1`; // legacy (myself / no-links path)
  return `---\n${fm}\n---\n\n# 1:1 with ${email}\n\n## Check-in\n\n## Discussion Topics\n\n## Action Items\n\n## Notes\n`;
}

// helper: builds the new dated frontmatter block (quoted wiki-links)
private _datedFm(type: string, date: string, links: IDatedFileLinks): string {
  const lines = [`type: ${type}`, `date: ${date}`, `subject: "${links.subject}"`];
  if (links.from) lines.push(`from: "${links.from}"`);
  else if (links.with) lines.push(`with: "${links.with}"`);
  return lines.join('\n');
}
```
Feedback uses `links.from`; the other three use `links.with`. Keep YAML wiki-link values **double-quoted**.

> NOTE: prefer building frontmatter via `matter.stringify(body, fmObject)` if you find the hand-rolled string fragile — but the existing templates are hand-rolled string literals, so matching that style is acceptable. If you switch to `matter.stringify`, verify the body/heading output is byte-compatible with what tests expect.

### Exact Change — `MemberService.createMemberFile`

```typescript
const prefix = filePrefix(type, date);
if (type === 'feedback' && !options.fromEmail) {
  throw new Error('fromEmail is required for feedback type');
}
const fileName = type === 'feedback'
  ? `${prefix}-feedback-${options.fromEmail}-${normalizedEmail}.md`
  : `${prefix}-${config.fileSuffix}-${normalizedEmail}.md`;
const filePath = path.join(subDirPath, fileName);

// ── Build dated-file links (D-9.31-1) ─────────────────────────────────────────
const subjectLink = formatWikiLink(profilePath, filePath, normalizedEmail);
let links: IDatedFileLinks;
if (type === 'feedback') {
  // B5 fix: resolve (auto-create) the reviewer, then point `from` at their profile
  const reviewer = await this._emailResolver.resolve(options.fromEmail as string, workspaceRoot);
  links = { subject: subjectLink, from: formatWikiLink(reviewer.absolutePath, filePath, options.fromEmail as string) };
} else {
  const selfPath = await this._getSelfProfilePath(workspaceRoot);
  const withLink = selfPath
    ? formatWikiLink(selfPath, filePath, path.basename(selfPath, '.md'))
    : undefined;
  links = { subject: subjectLink, ...(withLink ? { with: withLink } : {}) };
}

const content = this._template.getTemplate(type, date, normalizedEmail, links);
await this._fs.writeFile(filePath, content);

// Body wiki-link (decision #2 — kept in body)
const wikiLink = `- [[${config.subDir}/${fileName}]]`;
await this._sectionParser.appendToFile(profilePath, config.sectionName, wikiLink);

// Frontmatter recency scalar (new)
await setScalar(profilePath, LAST_SCALAR_KEY[type], prefix, this._fs);

return { filePath, profilePath, wikiLink };
```

### Exact Change — `LeadershipService.add1on1`

```typescript
const content0 = this._template.getLeadership1on1Template(date, normalizedEmail, await this._buildLeader1on1Links(filePath, normalizedEmail, workspaceRoot));
await this._fs.writeFile(filePath, content0);

const wikiLink = `- [[1on1s/${fileName}]]`;
await this._sectionParser.appendToFile(profilePath, '1on1s', wikiLink);
await setScalar(profilePath, 'last_1on1', date, this._fs);
```
…where the links are built inline (or via a tiny private helper):
```typescript
const subject = formatWikiLink(profilePath, filePath, normalizedEmail);
const selfPath = await this._getSelfProfilePath(workspaceRoot);
const links = selfPath
  ? { subject, with: formatWikiLink(selfPath, filePath, path.basename(selfPath, '.md')) }
  : { subject };
```

### Scope Boundary — What This Story Does NOT Change

- **`MyselfService.addPerformanceReview`** — Story 9.32 scope. It calls `getTemplate('performance-review', datePrefix, ownEmail)` with 3 args; the optional `links` param keeps it working with the legacy frontmatter. Do NOT add `subject`/`last_performance_review` to the self path here.
- **`MemberService.addMember`** / profile creation — not touched (Stories 9.28/9.29).
- **`LeadershipService.addLeadership`** reciprocal frontmatter — not touched (Story 9.30).
- **`frontmatter-relations.ts`** — do NOT modify; `setScalar`/`ScalarKey` already cover all four `last_*` keys (Story 9.26).
- **Read paths** (`listLeadership`, `listProjects`, etc.) — out of scope; not reading `last_*` yet.
- **`tmr doctor --fix-frontmatter` backfill** of `last_*` from existing body lists — Story 9.36.
- **`getRelationship1on1Template`** — leave as-is (production-dead; tests only).

### Anti-Patterns & Compliance (from project-context.md)

- ESM imports MUST use `.js` extension. `setScalar` import: `'../utils/frontmatter-relations.js'`.
- Body dated lists via `SectionParserService.appendToFile` are CORRECT here (dated artifacts, not structural relations) — see project-context "Frontmatter-Native Relationship Model → Exception".
- Use `setScalar` (NOT inline `matter.stringify`) for the `last_<type>` write.
- No `console.*` — use `logger` if a warning is ever needed.
- `explicit-function-return-type` (warn) — declare return types on any new private helpers.
- No `any` — use the `IDatedFileLinks` type and `LAST_SCALAR_KEY` map; `options.fromEmail as string` is acceptable only because the feedback guard above narrows it (or refactor with a local `const fromEmail = options.fromEmail; if (!fromEmail) throw ...`).

### Pre-existing Deferred Items (Do NOT fix here)

- **D (9.16/9.13/3.3):** No duplicate-file guard on dated files — running the same command twice in the same period overwrites the dated file and the body append dedupes; the `last_<type>` scalar is naturally idempotent (overwrite). Out of scope.
- **D (9.1):** `feedbacks/` (scaffold) vs `feedback/` (`FILE_TYPE_CONFIG.feedback.subDir`) directory naming — pre-existing; do not change.
- **D (3.3 / 9.1):** TOCTOU race in the `createMemberFile` auto-create path — pre-existing single-user CLI assumption.
- **D (3.2):** `_doResolve` step-4 reviewer stub uses inline string (not `gray-matter`) and hardcodes `relationship: company-member` — pre-existing shim (W2/W3 from 9.5). The B5 fix only requires that the reviewer profile exists and is resolvable; improving the stub is out of scope.
- **D (9.3 D2):** `_getSelfProfilePath` picks `mdFiles[0]` and does not filter dated/non-email `.md` files — pre-existing; do not fix.

### References

- [Source: `sprint-change-proposal-2026-06-09-frontmatter-relationships.md` § Story 9.31 — change proposals & ACs (lines 794–858)]
- [Source: same § Section 3.5 — Schema #11 (1on1), #12 (feedback), #13 (assessment), #14 (performance-review member); decision #2 revised (lines 137, 150)]
- [Source: same § Cross-Cutting Reciprocity Map — rows for `tmr member add 1on1/feedback/assessment/performance-review` and `tmr leadership add 1on1` (lines 431–437)]
- [Source: `project-context.md` § Frontmatter-Native Relationship Model + Anti-Pattern (dated lists → body exception)]
- [Source: `project-context.md` § Dated File Naming Convention — 1on1 uses `YYYY-MM-DD`, others `YYYY-MM`]
- [Source: `src/services/template.service.ts` — current dated templates]
- [Source: `src/services/member.service.ts:249-285` — `createMemberFile`; `:316-321` `_getSelfProfilePath`; `:31-33` `filePrefix`]
- [Source: `src/services/leadership.service.ts:132-160` — `add1on1`; `:70-75` `_getSelfProfilePath`; imports `setScalar`, `formatWikiLink`]
- [Source: `src/utils/frontmatter-relations.ts:22-34,103-115` — `ScalarKey` (has all four `last_*`), `setScalar`]
- [Source: `src/utils/wiki-link.ts` — `formatWikiLink(resolvedPath, fromPath, displayName)`]
- [Source: `src/services/email-resolution.service.ts:43-126` — `resolve()` + step-4 auto-create shim (B5)]
- [Source: `src/commands/member.command.ts:183-234` — `fromEmail` resolution/default at the command layer]
- [Source: `src/services/myself.service.ts:78` — legacy `getTemplate('performance-review', …)` 3-arg call to preserve (9.32 scope)]
- [Source: `_bmad-output/implementation-artifacts/9-30-leadership-add-bidirectional-reciprocal-frontmatter.md` — prior reciprocal/scalar patterns, `_getSelfProfilePath` precedent]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (Cursor)

### Debug Log References

- Full Jest suite must run with `NODE_OPTIONS=--experimental-vm-modules` (per `package.json` `test` script). Running bare `npx jest` fails to load suites that touch `conf` (ESM) or use top-level `await import()` — these are environment/config artifacts, not code defects.
- `gray-matter`/js-yaml serializes a full ISO date string (`2026-03-07`) as a quoted scalar (`'2026-03-07'`), while a year-month (`2026-03`) stays unquoted. Scalar assertions parse frontmatter via `matter(...).data` instead of substring-matching to stay quoting-agnostic.

### Completion Notes List

- **AC1–AC4 (frontmatter):** Dated files now emit `type`/`date`/`subject` + `with` (1on1/assessment/performance-review) or `from` (feedback). Leadership 1on1 `type` unified `leadership-1on1` → `1on1` per Schema #11 (legacy `getLeadership1on1Template` output preserved when no `links` passed).
- **AC5 (scalar value):** `last_<type>` is written with `filePrefix(type, date)` — full ISO for `1on1`, year-month for the rest — via `setScalar` (member) and `setScalar(..., 'last_1on1', date, ...)` (leadership).
- **AC6 (compactness):** `setScalar` overwrites the single scalar; body lists accumulate via `appendToFile`. Verified by unit + integration tests.
- **AC7 (self absent):** `with` omitted (not empty) when `my-career/` has no profile; body append + scalar still run.
- **AC8 (anti-pattern):** dated lists stay in the body via `SectionParserService.appendToFile`; scalar via `setScalar` from `frontmatter-relations.ts` — no inline `matter.stringify` for the mutation.
- **B5 fix:** feedback now resolves `fromEmail` via `EmailResolutionService.resolve()` (auto-creates a reviewer stub) and emits a `from` wiki-link.
- **Services compute links, templates only interpolate** (D-9.31-1): added `datedFrontmatter()` helper in `template.service.ts`; `MemberService._buildDatedFileLinks` centralizes link construction.
- **Backward compatibility:** template `links` params are optional, so `MyselfService` (9.32 scope) keeps using the legacy frontmatter path untouched.
- **AC10 (validation):** `npm run typecheck` ✓, `npm run lint` ✓, full `jest` suite ✓ **76 suites / 1340 tests passing**, `npm run build` ✓.

### File List

- `src/types/member.types.ts` — added `IDatedFileLinks` interface + `LAST_SCALAR_KEY` map
- `src/services/template.service.ts` — `datedFrontmatter()` helper; optional `links` on `getTemplate` + private builders + `getLeadership1on1Template`
- `src/services/member.service.ts` — `createMemberFile` builds links (incl. B5 reviewer resolution), writes `last_<type>` scalar; new `_buildDatedFileLinks` helper; imports `setScalar`/`LAST_SCALAR_KEY`/`IDatedFileLinks`
- `src/services/leadership.service.ts` — `add1on1` builds `subject`/`with` links, writes `last_1on1` scalar
- `tests/services/template.service.test.ts` — added Story 9.31 `links` cases (member + leadership)
- `tests/services/member.service.test.ts` — added Story 9.31 frontmatter/scalar/B5/compactness cases
- `tests/services/leadership.service.test.ts` — updated `add1on1` `type` assertion; added `last_1on1` scalar case
- `tests/integration/member.integration.test.ts` — updated 1on1/feedback assertions (`subject`/`from`, `last_*` scalars, reviewer auto-create); added `gray-matter` import
- `tests/integration/leadership.integration.test.ts` — updated 1on1 assertions (`type: 1on1`, `subject`, `last_1on1`)

### Change Log

- 2026-06-11 — Implemented Story 9.31: dated-artifact frontmatter (`subject`/`with`/`from`) + body wiki-link (unchanged) + `last_<type>` recency scalar; unified leadership 1on1 `type` to `1on1`; fixed B5 (feedback reviewer resolution + `from` link). Status → review.
