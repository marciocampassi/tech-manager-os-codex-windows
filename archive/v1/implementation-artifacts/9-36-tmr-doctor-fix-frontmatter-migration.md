---
baseline_commit: 38a1c8c
---

# Story 9.36: `tmr doctor --fix-frontmatter` migration command

Status: done

## Story

**As a** user with an existing vault built on the old body-link pattern,
**I want** a one-shot `tmr doctor --fix-frontmatter` command that lifts structural body wiki-links into frontmatter (and renames legacy keys),
**So that** I can adopt the new frontmatter-native relationship model without hand-editing every profile — and so `tmr doctor` (no flag) warns me when my vault still needs migrating.

This is the **capstone (Wave 3) story** of the frontmatter-relationships epic (9.26–9.36). Stories 9.26–9.35 made every *write* path frontmatter-native and made every *read* path frontmatter-only (hard cutover). The remaining gap: **pre-migration vaults** still have their relationships in body sections, so after upgrading, `tmr team list` / `tmr project list` / etc. show empty results. This story delivers the migration that closes that gap, plus a detection warning so users know they need to run it.

## Context Summary

Source of truth for this story:
- `_bmad-output/planning-artifacts/sprint-change-proposal-2026-06-09-frontmatter-relationships.md` — **Story 9.36 section (lines 1018–1071)**, the canonical migration map (line 1038), the schema single-source-of-truth (lines 148–449), and the decisions list (line 1121).
- `_bmad-output/project-context.md` — "Frontmatter-Native Relationship Model" + "Anti-Pattern (Critical — Body Link Regression)" (lines 361–388) and the vault structure table (lines 270–328).

### ⚠ Critical spec correction (read first — D-9.36-1)

The proposal's **Acceptance Criteria line 1061** says: _"the wiki-links appear in frontmatter `one_on_ones:` array and are removed from body."_ **This is an error and MUST NOT be implemented.** It directly contradicts:
- The **canonical migration map (line 1038)**: _"Body wiki-links under `## 1on1s`, `## Feedbacks`, `## Assessments`, `## Performance Reviews` → **untouched** (kept in body per decision #2). BUT: detect the latest date in each section and set `last_<type>:` frontmatter scalar."_
- **Decision #2 (line 1121)**: _"dated artifacts stay in body + `last_<type>` scalar in frontmatter — structural relationships only in frontmatter."_
- **project-context.md lines 369–372 & 386–388**: dated artifact lists (`## 1on1s`, `## Feedbacks`, `## Assessments`, `## Performance Reviews`) stay in body; only `last_<type>` scalars live in frontmatter. There is no `one_on_ones` frontmatter array anywhere in the codebase (`RelationKey` in `src/utils/frontmatter-relations.ts` has no such key).

**Resolution:** dated sections are NEVER lifted to frontmatter arrays. For each dated section present, compute the most-recent date and set the matching `last_<type>` scalar. The corrected AC1 below reflects this.

## Acceptance Criteria

1. **Dated sections → `last_<type>` scalar only (NOT lifted to arrays).** Given a profile with body wiki-links under `## 1on1s` (and/or `## Feedbacks`, `## Assessments`, `## Performance Reviews`), when `tmr doctor --fix-frontmatter` runs, then the body wiki-links are left **in place** and a `last_1on1` (resp. `last_feedback` / `last_assessment` / `last_performance_review`) frontmatter scalar is set to the most-recent date found in that section. (Per D-9.36-1.)

2. **Structural body sections → frontmatter.** Given a profile with the canonical structural body sections, when migration runs, then each is lifted to its frontmatter field per the canonical map:
   - `## Current Manager` (single `- [[...]]`) → `current_manager` scalar
   - `## Previous Managers` (multiple lines) → `previous_manager` array
   - `## Leadership` (multiple lines) → `leadership` array
   - `## Other Leaderships` (multiple lines) → `other_leaderships` array
   - `## Projects` (multiple lines) → `projects` array
   - `## Direct Reports` (multiple lines) → `direct_reports` array
   The migrated `- [[...]]` lines are stripped from the body, but the **empty `##` header is retained** (for human notes, per proposal line 1040).

3. **Legacy frontmatter key rename + deprecated strip.** Given a profile whose frontmatter has `manager:`, when migration runs, then it is renamed to `current_manager:` (value preserved). Given frontmatter has `action_items_gdoc:`, then that key is stripped. Given a body `## Action Items` line `- [[action-items-<email>|...]]`, then that line is stripped (deprecated).

4. **Team-members and project files.** Given a `my-teams/teams/<slug>/<slug>-members.md` file with body `- [[...]]` member links, then they are lifted to a frontmatter `members:` array (deduped) and stripped from body. Given a project overview `my-company/projects/<name>/<name>.md` with body `# Team Members` / `# Stakeholders` link lists, then they are lifted to frontmatter `members:` / `stakeholders:` arrays and stripped from body.

5. **Idempotent.** Given the same command runs twice, then the second run reports `0 migrated` (a profile is only counted `migrated` when migration actually changes its content).

6. **Already-migrated profiles counted but not migrated.** Given a profile that already uses frontmatter (no legacy body links / keys), then it is reported in `scanned` but not in `migrated`.

7. **Partial migration merge.** Given a profile that has BOTH body links and a frontmatter array for the same relation (partial prior migration), then the body links are merged into the frontmatter array (deduplicated) and the body lines are stripped.

8. **Detection warning (no flag).** Given a vault with legacy structural body links, when `tmr doctor` runs **without** `--fix-frontmatter`, then a prominent warning is printed (count of affected profiles + instruction to run `tmr doctor --fix-frontmatter`), via the `--plain`-aware display helpers. Given a fully-migrated vault, then no such warning is printed.

9. **Summary output.** Given `tmr doctor --fix-frontmatter` completes, then a summary is printed, e.g. `Scanned 42 profiles, migrated 18 (24 already up to date). Renamed 'manager'→'current_manager' on 12 profiles.` — respecting `--plain` and `--json`.

10. **Documentation.** README documents the migration command for users upgrading from prior versions; the post-init summary mentions it briefly.

11. **Validation.** `npx tsc --noEmit`, `npx eslint src/`, and the full Jest suite pass.

## Tasks / Subtasks

- [x] **Task 1 — Add migration profile discovery to `DoctorService`** (AC: 2, 4)
  - [x] Inject a `FileSystemService` into `DoctorService` for the async migration methods. Change the constructor to `constructor(private readonly tmrVersion = '0.0.0', private readonly _fs: FileSystemService = fileSystemService)` and import `{ FileSystemService, fileSystemService }` from `./file-system.service.js`. (See D-9.36-2 — this requires a one-line mock addition to the existing doctor test; the existing **sync** health checks stay on `node:fs` untouched.)
  - [x] Add a private async helper `_collectEntityProfiles(ws): Promise<string[]>` returning absolute paths of every entity profile to scan, guarding each root with `exists` before `listDirectories`/`listFiles`:
    - Self: top-level `*.md` in `my-career/` (flat) — exclude the `performance-reviews/` subdir.
    - Direct reports: `my-teams/members/<email>/<email>.md`
    - Archived: `my-teams/archived/<year>/<email>/<email>.md` (iterate year dirs, then email dirs)
    - Leadership: `my-leadership/<email>/<email>.md`
    - Company members: `my-company/members/<email>/<email>.md`
    - Contractors: `my-company/contractors/<email>/<email>.md`
  - [x] Add a private async helper `_collectTeamMembersFiles(ws)` → `my-teams/teams/<slug>/<slug>-members.md` and `_collectProjectOverviews(ws)` → `my-company/projects/<name>/<name>.md`.
  - [x] Use the existing path conventions exactly (see Dev Notes "Vault layout"). Do NOT hardcode separators in comparisons — use `node:path`.

- [x] **Task 2 — Implement `migrateFrontmatter(workspaceRoot)`** (AC: 1, 2, 3, 4, 5, 6, 7, 9)
  - [x] Signature: `async migrateFrontmatter(workspaceRoot: string): Promise<{ scanned: number; migrated: number; renamed: number }>`.
  - [x] For each entity profile: single read → `matter()` parse → apply the canonical migration (below) to a mutable `data` (frontmatter) + `body` string → if anything changed, write once via `this._fs.writeFile(path, matter.stringify(newBody, data))` and increment `migrated`; always increment `scanned`. Increment `renamed` whenever a `manager:`→`current_manager:` rename occurs.
  - [x] **Structural sections (lift + strip lines, keep empty header):** parse `- [[...]]` lines under each canonical structural `##` section. `current_manager` = first link (scalar); `previous_manager`/`leadership`/`other_leaderships`/`projects`/`direct_reports` = arrays. Merge into any existing frontmatter array (dedupe — AC7). Strip the consumed `- [[...]]` lines but keep the `## Header` line.
  - [x] **Dated sections (scalar only, body untouched — AC1/D-9.36-1):** for each of `## 1on1s`, `## Feedbacks`, `## Assessments`, `## Performance Reviews` present, find the max `YYYY-MM[-DD]` date among its body wiki-links/lines and set `last_1on1`/`last_feedback`/`last_assessment`/`last_performance_review` accordingly. Use `LAST_SCALAR_KEY` from `src/types/member.types.ts` for the mapping. Do NOT remove or move any body line.
  - [x] **Key rename / deprecated strip:** if `data.manager` exists, set `data.current_manager = data.manager` (only if `current_manager` not already set/non-empty) and `delete data.manager`; count a rename. Delete `data.action_items_gdoc` if present. Strip any body `- [[action-items-...|...]]` line.
  - [x] **Team-members files (AC4):** lift body `- [[...]]` lines → `members` array (dedupe), strip lines.
  - [x] **Project overviews (AC4):** lift body `# Team Members` / `# Stakeholders` link lists → `members` / `stakeholders` arrays (dedupe), strip lines. (Note: project sections use `#` H1 headers per the proposal — confirm against any existing project body format; treat `##` variants defensively.)
  - [x] **Idempotency (AC5/AC6):** only count `migrated` when the serialized output differs from the input. Setting a `last_<type>` scalar to a value it already holds is NOT a change. Re-running yields `{migrated: 0}`.
  - [x] Preserve wiki-link strings **verbatim** when moving them (do not re-anchor paths). Migration is a lift, not a re-link.

- [x] **Task 3 — Implement `detectLegacyBodyLinks(workspaceRoot)`** (AC: 8)
  - [x] Signature: `async detectLegacyBodyLinks(workspaceRoot: string): Promise<number>` — returns the count of profiles (and team/project files) that still contain body `- [[...]]` lines under the **structural** canonical section names, or a body `## Action Items` link line, or legacy `manager:`/`action_items_gdoc:` frontmatter keys, or body member/stakeholder link lists in team/project files.
  - [x] Dated sections (`## 1on1s` etc.) do NOT count as legacy — they are intentionally body-resident.
  - [x] Read-only: never writes. Reuse the discovery helpers from Task 1.

- [x] **Task 4 — Wire `--fix-frontmatter` flag into `doctor.command.ts`** (AC: 8, 9)
  - [x] Add `.option('--fix-frontmatter', '...')` to the doctor command. Read the flag in the action and pass it into `runDoctor`.
  - [x] When `--fix-frontmatter` is set: resolve the vault path via `configService.getWorkspacePath()`; if absent, print a warning and exit. Otherwise call `migrateFrontmatter`, then print the summary (AC9) via `printInfo`/`printSuccess` (honor `--plain`); when `--json`, emit `printJson({ scanned, migrated, renamed })` exclusively. Do NOT also run the environment health checks in this mode.
  - [x] When the flag is NOT set: run the existing `runChecks()` flow unchanged, then call `detectLegacyBodyLinks`; if `> 0`, print the prominent warning block (AC8) after the checks (suppress when `--json`).
  - [x] Keep all output through `src/utils/display.ts` helpers — no direct `console`/`chalk`.

- [x] **Task 5 — Tests** (AC: all)
  - [x] `tests/services/doctor.service.test.ts` — add a `jest.unstable_mockModule('../../src/services/file-system.service.js', ...)` mock (mirroring the team/leadership test mock shape: `exists`, `readFile`, `writeFile`, `listFiles`, `listDirectories`) so the new methods are unit-testable AND the existing sync `node:fs` checks keep working. Inject the mocked `FileSystemService` into `new DoctorService(version, mockFs)`.
  - [x] `migrateFrontmatter` unit tests: structural lift (each relation), `manager`→`current_manager` rename + count, `action_items_gdoc` + `## Action Items` strip, dated-section `last_<type>` scalar from latest date (and that body is untouched), partial-merge dedupe (AC7), team-members + project file lift (AC4), idempotency (second run → `migrated: 0`, AC5), already-migrated profile counted-not-migrated (AC6).
  - [x] `detectLegacyBodyLinks` unit tests: counts structural body links and legacy keys; does NOT count dated sections; returns 0 for a clean vault.
  - [x] `tests/commands/doctor.command.test.ts` — `--fix-frontmatter` runs migration + prints summary (plain + json); no-flag run prints the legacy warning when `detectLegacyBodyLinks > 0` and omits it when 0; `--json` suppresses the warning.
  - [x] Optional integration coverage if a doctor integration test exists; otherwise unit coverage is sufficient.

- [x] **Task 6 — Documentation** (AC: 10)
  - [x] README.md — add a short "Upgrading / Migrating an existing vault" note describing `tmr doctor --fix-frontmatter` (idempotent, lifts structural body links to frontmatter; dated lists stay in body).
  - [x] Post-init summary — add a one-line mention that existing-vault users can run `tmr doctor --fix-frontmatter` (locate the post-init summary writer in `src/services/init.service.ts` / `src/commands/init.command.ts`; keep it brief and `--plain`-safe). Keep this change minimal and low-risk.

- [x] **Task 7 — Validate** (AC: 11)
  - [x] `npx tsc --noEmit` — zero type errors
  - [x] `npx eslint src/` — zero lint errors (note: `eslint tests/` is not configured in this repo)
  - [x] `NODE_OPTIONS=--experimental-vm-modules npx jest --no-coverage` — full suite green

## Dev Notes

### Decision Log (read first)

- **D-9.36-1 — Dated sections are NOT lifted to frontmatter arrays.** The proposal AC line 1061 (`one_on_ones:` array) is a spec error; the canonical migration map (line 1038), decision #2, and project-context all agree dated lists stay in body and only `last_<type>` scalars go to frontmatter. There is no `one_on_ones` `RelationKey`. **Follow the canonical map.**
- **D-9.36-2 — Inject `FileSystemService` into `DoctorService`.** The existing health checks use synchronous `node:fs` (`existsSync`/`readFileSync`/`readdirSync`) and the test mocks `node:fs` partially. The migration needs recursive async walking + atomic writes, which the async `FileSystemService` provides (and matches every other service in the codebase). Add it as a constructor param defaulting to the singleton. **Consequence:** importing `file-system.service.js` pulls `fs-extra`, which would break the existing test's partial `node:fs` mock — so the existing `doctor.service.test.ts` MUST add a `file-system.service.js` module mock (Task 5). This mirrors why that test already mocks `obsidian-plugin.service.js` (see its lines 26–32).
- **D-9.36-3 — Bulk single-pass read-parse-write per file (documented exception to the `frontmatter-relations` rule).** The project-context anti-pattern rule says structural mutations must go through `addRelation`/`setScalar`. Those helpers do one read-write per key; a migration touching ~6 relations + 4 scalars per file would be 10 read-writes per profile and hard to make atomically idempotent. For this **migration only**, do a single `matter()` parse → mutate `data` + `body` → single `writeFile`. This is consistent with how `team.service.archiveMember` already batches multiple frontmatter changes in one read-parse-write. Keep the SCALAR-vs-array semantics identical to `frontmatter-relations.ts` (`current_manager` and the `tasks`/period keys are scalars; everything else is an array).
- **D-9.36-4 — `migrated` counts content changes only.** Compute the new serialized string and compare to the original; increment `migrated` only if different. This guarantees AC5 (idempotent re-run → 0) and AC6 (already-migrated → scanned-not-migrated).
- **D-9.36-5 — `--fix-frontmatter` runs migration ONLY (not the health checks).** Per proposal line 1053. The no-flag path runs checks + appends the legacy warning.
- **D-9.36-6 — Wiki-links moved verbatim.** Migration lifts existing body link strings into frontmatter unchanged; it does not recompute relative paths. Readers already accept whatever `formatWikiLink` produced originally.
- **D-9.36-7 — Keep empty `##` structural headers after stripping links** (proposal line 1040) so any human prose under them survives.

### Vault layout (authoritative — from `init.service.ts` VAULT_DIRS + path helpers)

| Entity | Profile path |
|---|---|
| Self | `my-career/<email>.md` (flat; dated PRs in `my-career/performance-reviews/`) |
| Direct report | `my-teams/members/<email>/<email>.md` |
| Archived member | `my-teams/archived/<year>/<email>/<email>.md` |
| Leadership | `my-leadership/<email>/<email>.md` |
| Company member | `my-company/members/<email>/<email>.md` |
| Contractor | `my-company/contractors/<email>/<email>.md` |
| Team roster | `my-teams/teams/<slug>/<slug>-members.md` |
| Project overview | `my-company/projects/<name>/<name>.md` (name normalized with `-project` suffix) |

`FileSystemService` surface available (`src/services/file-system.service.ts`): `exists`, `readFile`, `writeFile` (atomic temp+rename), `listFiles(dir, ext?)` (non-recursive, returns absolute paths), `listDirectories(dir)` (returns names). Guard every directory walk with `exists` first — `listFiles`/`listDirectories` throw `FileSystemError` on a missing dir.

### Relevant existing code

- **`src/services/doctor.service.ts`** — current `DoctorService` (sync health checks). Constructor `constructor(private readonly tmrVersion = '0.0.0')`. Singleton `doctorService` exported at bottom. Add migration methods + the injected `_fs`. Keep all existing `private check*` methods and `runChecks()` exactly as-is.
- **`src/commands/doctor.command.ts`** — `runDoctor({plain, json, tmrVersion})` and `createDoctorCommand(tmrVersion)`. Global `--plain`/`--json` are read from `command.parent?.opts()`. Add `--fix-frontmatter` as a command-level option (read via the action's first arg or `command.opts()`).
- **`src/utils/frontmatter-relations.ts`** — `RelationKey` union (the authoritative list of frontmatter relation keys; note NO `one_on_ones`), `SCALAR_KEYS` set, and `LAST_SCALAR_KEY` lives in `src/types/member.types.ts`. Use these for correct scalar-vs-array handling and last-scalar naming. You may reuse `setScalar`/`addRelation` in tests for fixtures, but the migration itself uses a single-pass write (D-9.36-3).
- **`src/services/section-parser.service.ts`** — `findSection(content, name)` and `appendToSection`. Useful for locating `## Section` boundaries, but you will need a small parser to extract the `- [[...]]` lines within a section (slice from `## Name` to the next `## ` or EOF, filter lines matching `/^- \[\[.+\]\]/`).
- **`src/services/team.service.ts`** `archiveMember` (lines ~336–366) — the canonical example of a single batched read-parse-write of frontmatter via `matter()` + `matter.stringify()`. Mirror this style.
- **`src/services/project.service.ts`** `listProjects` (lines ~221–255) — shows the `needsMigration` detection idea (frontmatter `members`/`stakeholders` absent). `detectLegacyBodyLinks` is the body-side complement.

### Date extraction for `last_<type>` scalars

Dated body wiki-links reference files named `YYYY-MM-DD-1on1-...` (1on1s use full date) or `YYYY-MM-<type>-...` (feedback/assessment/performance-review use year-month, per project-context lines 308–325). To compute the latest date for a section: extract the leading `YYYY-MM(-DD)?` token from each line in the section, sort lexicographically (ISO dates sort correctly as strings), take the max. Store the scalar as the raw token found (full date for 1on1, year-month for the others) — matching what `member.service`/`leadership.service` write today (`LAST_SCALAR_KEY` + the `prefix`/`date` value). If a section has no parseable dated entries, do not set the scalar.

### Testing patterns

- Unit-test `DoctorService` with an injected mock `FileSystemService`. Provide `readFile` returning fixture markdown (frontmatter + body sections), `writeFile` capturing output into a Map, `exists` returning true for the dirs you want walked, `listDirectories`/`listFiles` returning your fixture tree. Assert the captured written content via `matter()` parse (frontmatter keys/arrays) and string checks (body lines stripped / headers retained / dated lines preserved).
- Idempotency test: feed the OUTPUT of a first migration back as the `readFile` result and assert `migrated === 0` and no `writeFile` for that profile.
- Command tests: mock `DoctorService` (or its singleton) at the command layer per the project-context mocking rule; assert summary/warning text and `--plain`/`--json` behavior. Do NOT test command + service together in unit tests.
- Remember: ESLint only lints `src/` — test files are not linted, but they must still typecheck under `tsc`.

### Anti-patterns to avoid

- Do NOT implement the `one_on_ones:` frontmatter array from the erroneous AC line 1061 (D-9.36-1).
- Do NOT re-anchor/recompute wiki-link paths during migration — move strings verbatim (D-9.36-6).
- Do NOT convert `DoctorService`'s existing sync health checks to async or change their behavior — scope is additive.
- Do NOT use `console`/`chalk` directly — use `display.ts` helpers; honor `--plain` and `--json`.
- Do NOT count a no-op `last_<type>` set as a migration (breaks AC5/AC6).
- Do NOT migrate dated section body links into arrays or strip them (they stay in body).

### Open Questions (non-blocking — defaults chosen)

1. **Project body header level** — the proposal says project files use `# Team Members` / `# Stakeholders` (H1). Confirm against any real project overview body format during dev; the migration should match whatever the generator wrote. Default: handle `#`/`##` defensively so either renders correctly.
2. **Post-init summary mention (Task 6)** — kept intentionally minimal (one line). If the post-init summary has no natural spot, a README-only mention satisfies AC10's intent; flag if you drop the summary line.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (Cursor)

### Debug Log References

- Initial Jest run via bare `npx jest` failed with TS1378 (top-level await) and a `conf` ESM `SyntaxError` — root cause was missing `NODE_OPTIONS=--experimental-vm-modules` and not mocking `config.service.js`. Fixed by mocking `config.service.js` in the new migration test and using the repo's standard `NODE_OPTIONS` invocation.
- New migration test needed `let service: InstanceType<typeof DoctorService>` (dynamic-import makes `DoctorService` a value, not a type).

### Completion Notes List

- Implemented pure, IO-free transforms `migrateProfileContent` / `migrateRosterContent` / `migrateProjectContent` (exported for direct unit testing) plus `DoctorService.migrateFrontmatter` / `detectLegacyBodyLinks` orchestration over an injected `FileSystemService`.
- Distinguished two flags per transform: `changed` (any migration incl. dated `last_<type>` scalar → write + count migrated) vs `legacy` (structural/key/deprecated body link present → counts toward the warning). Dated-only changes deliberately do NOT count as legacy (D-9.36-1), so a vault that only needs a `last_<type>` scalar is migrated but never warned about as "legacy body links."
- Idempotency achieved via explicit change-tracking rather than string diffing: structural lifts strip body lines first run (none remain second run), dated scalars only mark `changed` when the value differs. Verified by both pure-function and orchestration idempotency tests.
- `--fix-frontmatter` runs migration ONLY (D-9.36-5); no-flag path appends the legacy warning after health checks, suppressed in `--json`. Both paths guard on `configService.getWorkspacePath()`.
- Existing `doctor.service.test.ts` gained a `file-system.service.js` module mock (D-9.36-2) so fs-extra no longer breaks its partial `node:fs` mock; command test gained the two new mocked methods + a `config.service.js` mock.
- All 7 tasks complete. Validation: `tsc --noEmit` clean, `eslint src/` clean, full Jest suite 1399/1399 green (23 new tests added).

### File List

- `src/services/doctor.service.ts`
- `src/commands/doctor.command.ts`
- `src/services/init.service.ts`
- `tests/services/doctor.service.test.ts`
- `tests/services/doctor.frontmatter.service.test.ts` (new)
- `tests/commands/doctor.command.test.ts`
- `README.md`

### Change Log

- 2026-06-14 — Story created (ready-for-dev). Capstone migration story for the frontmatter-relationships epic. Resolved the proposal's `one_on_ones` AC contradiction (D-9.36-1: dated sections stay in body, only `last_<type>` scalars migrate).
- 2026-06-14 — Implemented `tmr doctor --fix-frontmatter` migration (DoctorService pure transforms + orchestration, command wiring, legacy-link warning), README "Upgrading an existing vault" section + post-init mention, and 23 new tests. tsc/eslint clean; full suite 1399/1399. Status → review.
- 2026-06-14 — Code review: applied all 7 patch findings — per-file error isolation + `skipped` summary field, roster section scoping, manager non-string preservation, mergeArray scalar coercion, idempotent/no-downgrade dated scalar (`dateToken` normalization), `maxDateOnLine` date extraction, JSON-safe no-vault path. Added 9 regression tests. tsc/eslint clean; full suite 1408/1408. 6 findings deferred (date-ISO reformat is pre-existing project-wide), 8 dismissed. Status → done.

## Review Findings (Code Review — 2026-06-14)

Adversarial review (Blind Hunter + Edge Case Hunter + Acceptance Auditor). All AC/Decision-Log items verified functionally satisfied; section headings confirmed matching the live templates (migration fires). 0 decision-needed, 7 patch, 6 defer, 8 dismissed.

### Patch (unchecked — to fix)

- [x] [Review][Patch] Malformed/unparseable YAML in any vault file throws uncaught — crashes plain `tmr doctor` (detect runs every run) and aborts `--fix-frontmatter` mid-run after partial writes [src/services/doctor.service.ts: migrateFrontmatter/detectLegacyBodyLinks] — FIXED: per-file try/catch; skip + `skipped` count in summary; detect swallows per-file errors.
- [x] [Review][Patch] `migrateRosterContent` strips EVERY `- [[...]]` bullet regardless of section → non-member links absorbed into `members` [src/services/doctor.service.ts: migrateRosterContent] — FIXED: scoped to the `# Team Members` section.
- [x] [Review][Patch] `manager`→`current_manager` rename deletes a non-string value (e.g. unquoted `manager: [[x]]` parses as a nested array) without migrating it → relationship lost [src/services/doctor.service.ts: migrateProfileContent rename block] — FIXED: only delete+rename for a usable non-empty string; otherwise preserve the key.
- [x] [Review][Patch] `mergeArray` discards an existing non-array (scalar string) value at an array key instead of preserving it [src/services/doctor.service.ts: mergeArray] — FIXED: coerce existing scalar into `[existing]` before merge.
- [x] [Review][Patch] Dated `last_<type>` scalar: non-idempotent + can downgrade — existing unquoted date scalar round-trips to a JS `Date`, so `Date !== "YYYY-MM-DD"` is always true → file rewritten every run; also clobbers a newer existing value with an older body-derived max [src/services/doctor.service.ts: dated-section loop] — FIXED: `dateToken()` normalizes Date→`YYYY-MM-DD`; set only when body max is strictly greater (fill-or-upgrade, never downgrade).
- [x] [Review][Patch] Date extraction takes the FIRST `YYYY-MM[-DD]` token in the link, which may be a path/folder date rather than the entry date [src/services/doctor.service.ts: dated branch, DATE_TOKEN] — FIXED: `maxDateOnLine()` collects all tokens on the line and takes the max.
- [x] [Review][Patch] `tmr --json doctor --fix-frontmatter` with no vault emits a human-readable warning instead of JSON [src/commands/doctor.command.ts: fix-frontmatter no-vault path] — FIXED: emits a JSON error object in `--json` mode.

### Deferred (pre-existing or out-of-scope)

- [x] [Review][Defer] Unquoted date fields (`date_added`/`updated`/`created`) reformatted to ISO timestamps by gray-matter on every migrated profile [src/services/doctor.service.ts via gray-matter] — deferred, pre-existing: identical `matter()/matter.stringify()` pattern in `src/utils/frontmatter-relations.ts` (used by team/member/leadership services) already does this; not data loss (ISO is valid). Recommend a shared yaml-engine wrapper (`js-yaml` JSON_SCHEMA) applied project-wide.
- [x] [Review][Defer] `## Previous Leaderships` body links not migrated [src/templates/onboarding.templates.ts:125; STRUCTURAL_SECTIONS] — deferred: no canonical `previous_leaderships` frontmatter key exists (not in RelationKey / canonical map); the template section is empty by default.
- [x] [Review][Defer] Legacy self-profile `reports_to:` frontmatter key not renamed to `current_manager` [src/templates/onboarding.templates.ts:21] — deferred: `generateCareerProfile` has no callers in `src/` (dead post-9.35); body `## Current Manager` already populates `current_manager`. Verify against a real legacy vault before adding a rename.
- [x] [Review][Defer] `WIKILINK_BULLET` only matches `-` bullets at column 0 (no `*`/`+`/indented) [src/services/doctor.service.ts] — deferred: live templates always emit `- [[...]]` at column 0; low real risk.
- [x] [Review][Defer] `detectLegacyBodyLinks` parses the full vault on every plain `tmr doctor` [src/commands/doctor.command.ts] — deferred: doctor is not a hot path; acceptable for now.
- [x] [Review][Defer] `LAST_SCALAR_KEY` (src/types/member.types.ts) not reused — a parallel `DATED_SECTIONS` map was introduced [src/services/doctor.service.ts] — deferred: behaviorally equivalent (same scalar names); reuse later to prevent drift.

### Dismissed (noise / by-design)

- Structural sections only match level-2 `##` headings — by design; live templates use `##` (profiles) and `#` (roster/project), both handled.
- Migration leaves empty `##` structural headers — intended per D-9.36-7 (preserve human prose).
- Doctor reports "no legacy" yet `--fix-frontmatter` migrates dated-only profiles — intended per D-9.36-1 (dated sections are body-resident, not legacy).
- `renamed` counter overstatement — folded into the manager-rename patch.
- Self flat-scan includes other `my-career/*.md` (e.g. `pdp.md`) — harmless: no structural sections → unchanged → not written.
- CRLF inputs yield mixed line endings — cosmetic; vault files are LF.
- `SCALAR_KEYS` not reused — localized `scalar` flags are equivalent.
- `migrated` uses explicit change-flags instead of D-9.36-4's serialized-diff — deviation is an improvement (serialized-diff would false-positive on date reserialization).
