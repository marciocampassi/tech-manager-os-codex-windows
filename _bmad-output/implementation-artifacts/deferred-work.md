# Deferred Work

## Deferred from: code review of 1-3-file-anchored-wiki-link-utility (2026-05-09)

- Empty `resolvedPath` silently resolves to `process.cwd()` — `path.relative(dir, '')` uses cwd as fallback, producing a surprising relative path. Pre-existing behavior mirrored from `generateWikiLink`. Callers always pass valid absolute paths in practice; add a guard or input validation before broadening the utility's callers.
- Path-separator normalization test trivially passes on macOS/Linux — `.split(path.sep).join('/')` is a no-op when `path.sep === '/'`. The test assertion `not.toContain('\\')` proves nothing on the current CI platform. Add a test that mocks `path.sep = '\\'` when cross-platform CI testing infrastructure is in place.
- `fromPath` as a bare directory path shifts relative path by one level — `path.dirname('/a/b/')` returns `/a/b`, not `/a`. No caller passes a directory; pre-existing in `generateWikiLink`. Add a guard or note in JSDoc if the function's scope broadens.

## Deferred from: code review of 1-2-entity-slug-normalization-utility (2026-04-27)

- Path traversal characters (`/`, `..`) pass through `normalizeSlug` unchanged — pre-existing issue; `createTeam("../../x")` was already unsafe before this story. A validation or sanitization layer at the command/service entry point (or rejecting non-alphanumeric slug chars) should be added before GA.
- Data migration gap — pre-existing on-disk team/project directories written with unnormalized names (spaces, mixed case) will silently fail `exists()` checks after normalization is enforced, causing `listTeamMembers`, `archiveMember` etc. to return empty or no-op. A one-time migration script or a read-path fallback that tries both the slug and the original name is needed before GA.
- `normalizeProjectName('project')` → `'project-project'` — identical to old behavior; edge case where the base name equals `'project'` produces a doubly-suffixed directory. Acceptable as-is but worth documenting in the project API.
- Normalization site style inconsistency — some methods declare `const slug = normalizeSlug(teamName)` at entry, others use inline call. No functional impact; clean up in a future refactor pass.

## Deferred from: code review of 1-1-email-validation-utility — round 2 (2026-04-27)

- Provider key migration: existing user configs written with `provider` key silently get `undefined` from `getActiveProvider()` after the fallback removal. Removal is per spec; a migration step (read old key + rewrite on startup, or a migration guide) should be added before GA.
- `TM_PROVIDER` env var: the old variable name no longer maps to anything. Users or CI environments using `TM_PROVIDER` must switch to `TMR_PROVIDER`. Needs migration documentation.
- ARCH-DEBT-001 guard scope: the guard catches `AppConfig.provider` / `AppConfig.apiKey` as string literals but misses `service.get('provider')` style usage. TypeScript covers the method-call path; acceptable for this story but worth a broader search before GA.
- ARCH-DEBT-001 guard uses `process.cwd()` rather than a path relative to the test file — fragile in non-standard CI `cwd` configurations.
- Dead `typeof email !== 'string'` check in `src/utils/validation.ts` — redundant given TypeScript enforces the `string` type at call sites, but harmless; remove in a cleanup pass.
- `EmailResolutionService.validateEmail()` is now orphaned — `resolve()` bypasses it directly. The method is still public; deprecate or remove in a future refactor story.

## Deferred from: code review of 1-1-email-validation-utility (2026-04-27)

- `resolve()` error message now uses normalized email (`e`) instead of the original caller input — minor UX regression; caller's raw value is lost in the `InvalidEmailError`. Acceptable per spec intent but worth revisiting if error surfacing becomes a priority.
- ARCH-DEBT-001 structural guard catches only literal `AppConfig.property` string references, not computed-key (`config['provider']`) or aliased access patterns — acceptable scope for story 1.1 but guard has known blind spots.
- `validateEmailUtil` embeds the un-trimmed email in the error message despite the regex testing the trimmed form — cosmetically inconsistent (e.g., `" @bad "` error vs. `"@bad"` tested form) but has no practical impact on validation correctness.
