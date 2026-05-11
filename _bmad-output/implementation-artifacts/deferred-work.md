# Deferred Work

## Deferred from: Epic 1 readiness review (2026-05-09)

- `normalizeSlug` does not strip leading or trailing hyphens from the result — e.g. `normalizeSlug('-team-')` returns `'-team-'`. The `-+` collapse regex fires only on runs of multiple hyphens, not on boundary positions. Could produce file paths with a leading hyphen. Add a `.replace(/^-+|-+$/g, '')` step, or validate at the command layer before this is called from Epic 2/3 interactive flows.
- `formatWikiLink` does not sanitize `displayName` against `|` or `]]` characters — a displayName containing `|` (e.g. `user|name@example.com`, technically valid per RFC5321 local-part rules) produces `[[path.md|user|name@example.com]]` which Obsidian parses incorrectly. Sanitize displayName by replacing `|` → `-` and `]]` → `]` before embedding, or add a guard that rejects such display names.
- `validateEmail()` is absent from `TeamService.addMember`, `TeamService.archiveMember`, `TeamService.fireMember`, and `TeamService._removeWikiLink` — pre-existing gap (these methods predated the utility). Emails reach file-system path construction via `email.toLowerCase()` only. Integrate `validateEmail()` at the top of each TeamService method that accepts an email parameter as part of Epic 3 (Story 3.1 / 3.3).
- `safeEmail` YAML-escaping is applied to the Markdown heading in the `_doResolve` shim — `# Relationship — ${safeEmail}` would display `\"user\"@example.com` for RFC5321 quoted-local-part addresses. Use the raw `email` value in the heading and `safeEmail` only within YAML frontmatter string values. Fix when replacing the shim in Story 3.2.

## Deferred from: code review of 1-4-remove-tmr-relationship-command (2026-05-09)

- `as string` type assertion on `split('T')[0]` masks a potential `string | undefined` type — `new Date().toISOString().split('T')[0] as string` in `_doResolve`. Pedantic TypeScript; destructuring or null-coalescing would be safer. Clean up in a future refactor pass.
- Spy cleanup in `REL-NEG-002` (and existing CLI tests) is at end-of-body rather than `afterEach`/`finally` — if any assertion throws before `mockRestore()`, `process.exit` and `process.stderr.write` remain monkey-patched. Pre-existing pattern across the test file; address uniformly in a test-hygiene pass.
- TOCTOU race between step-3 `exists()` guard and step-4 `writeFile()` in `_doResolve` — a concurrent process creating the profile between the check and the write would cause a silent overwrite. Pre-existing design concern inherited from the old `RelationshipService.addRelationship` delegation; acceptable for a single-user CLI but worth re-examining when MemberService replaces this shim in Story 3.2.
- Partial-write leaves an orphaned `1on1s/` directory if `writeFile` throws after `createDirectory` succeeds — no cleanup path on failure. Same behavior as the deleted `RelationshipService.addRelationship`. Add retry-safe cleanup or use atomic writes when the shim is replaced in Story 3.2.

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

## Deferred from: code review of 2-2-user-profile-leader-and-team-structure-prompts (2026-05-09)

- Validate closures not exercised by resolved-value mocking — `inquirer.prompt` mocked at the module level bypasses its validate callbacks; `email-error-recovery` and `zero-team-count` fixture scenarios cannot actually trigger validate logic. Validate functions should be extracted and unit-tested as pure functions in a future test-hygiene pass.
- No leader/self-email uniqueness guard — user can supply their own email as the leader email without any warning. Not specified in Story 2.2 AC; candidate for a prompt-level cross-field validation in a future story.
- No deduplication in `InitService.createTeams()` — duplicate team names produce redundant but idempotent `TeamService.createTeam` calls. No functional breakage; consider adding a `[...new Set(teamNames)]` guard as a UX improvement.

## Deferred from: code review of 2-1-vault-scaffold-and-folder-structure (2026-05-09)

- `Promise.all` in `InitService.scaffold()` rejects on first failure but leaves in-flight `createDirectory` calls running — partial vault state, no rollback. Pre-existing pattern from workspace-builder. Consider `Promise.allSettled` + error aggregation if vault atomicity becomes a requirement.
- `configService.setWorkspacePath()` is persisted before `scaffold()` is attempted in `InitCommand.run()`. On scaffold failure, config holds a path to a non-existent or partial vault. Pre-existing ordering issue not introduced by Story 2.1.
- Task-file `Promise.all` writes (lines ~101-108 of `init.command.ts`) have no try-catch. A write failure leaves `scaffoldSpinner` in a running state and propagates an unhandled rejection. Pre-existing code, not in Story 2.1 scope.
- `claudeSpinner` in `InitCommand.run()` has no `.fail()` path if `generateClaudeMd` or the CLAUDE.md `writeFile` throws. Pre-existing code.
- `resolveVaultPath` returns relative paths as-is; if a user provides a relative path at the prompt, it is stored in config and breaks on CWD change. Design intent per spec + pre-existing pattern; address with a "must be absolute" guard or CWD-join in a future story.
- No writability pre-flight check on the resolved vault path — `tmr init` can fail with `EACCES` after already persisting config. Candidate for a Story 2.x UX improvement.
- `resolveVaultPath('~/')` maps to `homedir()` directly (empty segment after `~/`), causing scaffold to run at `$HOME` root and pollute it with `inbox/`, `archive/`, etc. Add a guard for the `homedir()` root case.
- `describe('InitCommand integration (Story 4.1 — minimal onboarding)')` label in `tests/integration/init.integration.test.ts` is stale — tests were updated for Story 2.1 but the describe title still says Story 4.1. Pre-existing.
- If `InitService.scaffold()` successfully creates all 12 directories but the `writeFile` for `CLAUDE.md` fails, the vault is left structurally intact but permanently missing `CLAUDE.md`. Acceptable because `tmr init` is re-runnable and `fileSystemService.createDirectory` is idempotent.
- `InitCommand.run()` returns with exit code 0 on scaffold failure (spec says "return", not `process.exit(1)`). A non-zero exit code on init failure would be cleaner for scripted use; out of scope for Story 2.1.

## Deferred from: code review of 2-3-team-member-collection-loop (2026-05-09)

- Hard `return` on first team member-addition failure abandons remaining teams and all subsequent write-phase steps — consistent with existing pattern throughout `run()`; consider revisiting when designing overall error-recovery strategy.
- `while(true)` prompt loop in the member collection phase has no error boundary — consistent with the rest of the unguarded prompt phase in `run()`; low risk because inquirer propagates errors only on OS-level I/O failures.
- Two team names that collapse to the same `normalizeSlug` output silently merge member lists — pre-existing normalizeSlug behavior not introduced by this story; add duplicate-slug detection in the prompts or `createTeam`.
- Team name containing `{`, `}`, `[`, or `]` survives `normalizeSlug` and produces an unquoted YAML flow indicator in member frontmatter, corrupting `gray-matter` round-trips — pre-existing normalizeSlug gap; add a strip of YAML flow characters.
- Cross-team same email: the second `addMember` call finds an existing profile, appends the new team slug, but writes back the original `name/role/gender/location` — the `promptMemberDetails()` values collected for the second team are permanently discarded with no warning; address when implementing member profile editing.

## Deferred from: code review of 2-4-sample-files-skill-install-readme-and-post-init-summary (2026-05-09)

- `today()` helper returns UTC date — can be off by one day for users in UTC+ timezones; pre-existing pattern used by all templates in `onboarding.templates.ts`.
- Hard-coded plugin list in `printPostInitSummary` (`obsidian-git, granola-sync, terminal, dataview`) can drift from the set actually installed by `obsidianPluginService` — pre-existing design; consider deriving the list from the service config in a future story.
- Command-layer empty `catch {}` for skill spinner step has no logging — any unexpected factory throw is swallowed silently; mitigated by P1 (factory inside try); residual safety-net concern.
- `printSuccess` call in `printPostInitSummary` is not explicitly asserted in unit tests — Dev Notes prescribed test list omits this; a future test hardening story should add the assertion.
- AC5/FR14 Obsidian "enabling" guidance is passive ("plugins are ready") rather than instructional (step users through Community Plugins settings pane) — content follows Dev Notes verbatim; spec ambiguity to be addressed in a UX-copy story.
- Non-atomic `SkillRegistryService.installSkill` — `SKILL.md` written by `writeFileSync` before `writeManifest()`; a crash between the two leaves SKILL.md orphaned while the manifest disagrees; pre-existing design in `skill-registry.service.ts`, not introduced by Story 2.4.

## Deferred from: code review of Epic 2 (2026-05-09)

- `promptTeamCount` validate callback returns a plain string on rejection instead of throwing `ValidationError` (AC 2.2.3). Sibling validators (`promptMinimalOnboarding`, `promptLeaderDetails`) both catch and use `InvalidEmailError` from the same error hierarchy; `promptTeamCount` is inconsistent. Address in a test-hygiene or refactor pass.
- Fixture helper exported as `applyInitPromptFixture(scenario, mockFn)` but spec (TEA-INFRA-001 / AC 2.2.7) names it `initPromptFixture(scenario)` with a single argument. Two-parameter signature is workable but diverges from the agreed contract. Rename in a future test-infra cleanup.
- INIT-INT-002 (CWD default), INIT-INT-004 (team count 0), INIT-INT-005 (invalid profile email), INIT-INT-006 (invalid leader email) are required by AC 2.2.8 to pass as integration tests but only exist as unit-level prompt-closure tests or are absent entirely. Add full `InitCommand` integration-level coverage for these four scenarios in a dedicated test story.
- Per-member `ora` spinner granularity (AC 2.3.7 / NFR4): implementation uses one spinner per team wrapping the entire `addMembersToTeam` batch; spec requires one spinner per individual member write. Design accepted during Story 2.3 review; revisit if UX feedback surfaces it.
- `generateVaultReadme()` lists commands (`tmr process`, `tmr watch`, `tmr update`, `tmr leadership add`) that are not yet implemented. README will be stale until those commands land. Update template as each command ships, or generate the reference dynamically from Commander's command registry.
- `printError` error-handler call sites in `init.command.ts` do not pass the optional `suggestion` parameter; AC 2.4.6 / R-001 requires a "recovery message" alongside the error. Pre-existing pattern — no call site in the project uses the suggestion param; add a recovery hint to each init error handler in a UX-copy pass.

## Deferred from: code review of story 3-2-company-scoped-vs-team-scoped-member-routing (2026-05-10)

- Non-email subdir in `my-career/` (e.g. `.obsidian`, `archive`) is treated as a manager email — `_resolveManagerLink` takes `subdirs[0]` without validating that it is an email-formatted directory name; a spurious wiki-link with a non-email display name is written to the `manager` field.
- Cross-scope profile duplication for same email — `addMember` only checks the target-scope path for existence; the same email can be independently created in both `my-company/members/` and `my-teams/members/` without a warning, returning `{ created: true }` for each scope call.
- `--team` and `--location` are silently accepted but ignored when the CLI is invoked in type-first mode (e.g. `tmr member add 1on1 john@co.com --team backend`) — Commander parses the options but they are not forwarded to `createMemberFile`; user receives no diagnostic.
- TOCTOU race in `addMember` — two concurrent calls for the same email+scope can both pass the `exists()` guard before either `writeFile` completes, producing a silent overwrite and two `{ created: true }` responses.
- Email whitespace not trimmed at service layer — `normalizedEmail = email.toLowerCase()` does not trim; `validateEmail` trims only for the regex test, so a space-padded email would pass validation but generate a filename with embedded spaces; command layer always trims, making this a defensive coding gap at the direct-service-call boundary.

## Deferred from: code review of story 3-1-team-create-and-add-with-normalization-and-email-validation (2026-05-10)

- Prompt email validator downgraded from regex to non-empty check in `team.command.ts` `runAdd` interactive prompt (`src/commands/team.command.ts:89-92`); secondary prompts fire before the invalid email is caught by the service layer — up to 4 fields collected from the user are silently discarded. Intentional per Story 3.1 spec (validation moved to service layer). Future story: add early-exit validation in the command layer before secondary prompts, or re-add the email regex to the prompt validator while keeping service-layer guard as the authoritative check.
- `runCreate` and `runAdd` error handlers `return` after `printError` without setting `process.exitCode` — CLI exits 0 even on failure, breaking script/CI automation. Pre-existing project pattern across all commands; address in a dedicated UX/exit-code hardening story.
- `runCreate` success message simplified from `Team "${teamName}" created at my-teams/teams/${teamName}/"` to `Team "${teamName}" created` — removed the resolved path hint. Deliberate change aligned with `display.ts` helper style; consider restoring a normalized-slug path hint in a UX polish pass.

## Deferred from: code review of 3-3-member-feedback-with-global-email-resolver-and-auto-create (2026-05-10)

## Deferred from: code review of 4-1-tmr-install-skill-registry-integration (2026-05-11)

- Path traversal via skill names (`"../.."` in registry index) can escape `.claude/skills/` tree — registry-supplied `name` is passed directly to `path.join(this.skillsDir, name)` in `installSkill`; applies equally to single-skill install. Needs input validation/allowlist in `installSkill` or before calling it.
- Synchronous fs exceptions from `installSkill` propagate unhandled — `mkdirSync`/`writeFileSync` inside `installSkill` can throw `ENOSPC`, `EACCES`, etc.; neither `runInstall` nor `runInstallAll` wraps the call in try-catch; AC10 gap exists in both paths. Pre-existing; fix with top-level try-catch in both code paths.
- No HTTP body size cap in `fetchUrl` — all `data` chunks are buffered unboundedly; a malicious or broken registry response can cause OOM. Pre-existing in the shared `fetchUrl` helper.
- Skill names not URL-encoded before interpolating into registry URL — `getRegistryUrl` uses template literal; names with `?`, `#`, spaces, or non-ASCII yield malformed URLs. Pre-existing.
- Empty string skill name writes `SKILL.md` at `.claude/skills/` root — `path.join(skillsDir, '')` is `skillsDir`. Pre-existing in `installSkill`.
- json-mode errors go to stdout via `printJson` rather than stderr via `printError` — AC7 technically requires stderr; the existing single-skill install has the same pattern. Fix requires changing both paths consistently.
- Per-skill failures in json mode only appear in the final `printJson` summary; no real-time stderr signal during a multi-skill install. Mirrors single-skill json pattern.
- Empty skill list from registry exits 0 with no user warning — `tmr install` with an empty index prints "Found 0 skill(s)" and exits 0; may mislead users. Design decision.
- `--json` error schema inconsistent: list-fetch failure emits `{status, message}` while batch result emits `{installed, skipped, failed}`. Follows existing codebase pattern where error and success shapes differ; document or unify in a future API-hardening story.

## Deferred from: code review of 3-3-member-feedback-with-global-email-resolver-and-auto-create (2026-05-10)

- TOCTOU race in `createMemberFile` auto-create path — concurrent calls for the same unknown email can both call `addMember`, construct the same `profilePath`, and reach `appendToFile`, duplicating the wiki-link. Pre-existing architectural pattern (same as Story 3.2 deferral). `src/services/member.service.ts:createMemberFile`.
- No email/path-traversal guard in `findMemberGlobally` — callers normalize email before calling, but no re-validation at method entry. Defense-in-depth improvement. Pre-existing caller-validates pattern. `src/services/member.service.ts:findMemberGlobally`.
- Auto-created profile template missing `## 1on1s` and `## Assessments` sections — `addMember({})` body template only includes `## Performance Reviews` and `## Feedbacks`; calling `createMemberFile` with `1on1` or `assessment` type on an auto-created profile may route wiki-links to absent sections. Pre-existing Story 3.2 template scope. `src/services/member.service.ts:addMember body`.
- `findMember` not marked `@deprecated` after `findMemberGlobally` supersedes it for multi-scope lookups. Pre-existing method, minor cleanup. `src/services/member.service.ts:findMember`.
- Magic path strings (`'my-teams'`, `'my-company'`, `'members'`) hardcoded in `findMemberGlobally` without constants. Pre-existing codebase pattern. `src/services/member.service.ts:findMemberGlobally`.

## Launch Readiness Audit — Deferred Findings (2026-05-11)

The following items were surfaced by the pre-launch AC audit (Epics 1–5) and accepted as deferred. None are runtime blockers for v1.

### Epic 2 — tmr init Path Convention Mismatch
- AC-2.2.1/2.2.2/2.3.2: Init writes nested `<email>/<email>.md` paths (`my-career/`, `my-leadership/`, `my-teams/members/`); ACs specified flat `<email>.md`. The implementation is internally consistent and Story 3.3 global resolver supports both. epics.md spec needs updating to match the brownfield convention. `src/services/init.service.ts`, `src/services/team.service.ts`.
- AC-2.2.6: Fixture helper exported as `applyInitPromptFixture`; ACs name it `initPromptFixture`. Trivial alias. `tests/fixtures/init-prompts.ts`.
- AC-2.2.7: Integration tests INIT-INT-002 (CWD default), INIT-INT-004 (team count 0), INIT-INT-005 (invalid user email), INIT-INT-006 (invalid leader email) are missing. Already tracked above. `tests/integration/init.integration.test.ts`.
- AC-2.3.5: Member profile `email:` frontmatter field is a plain string; action-items wiki-link within `team.service.ts` member template not routed through `formatWikiLink`. FR33 entity-reference contract applies to cross-entity links; this is a self-referential field. `src/services/team.service.ts`.
- AC-2.4.6: `printError` in init command error paths does not pass a recovery `suggestion` argument. Low user impact; verbose mode shows full error context. `src/commands/init.command.ts`.
- AC-2.4.7: INIT-INT-001 happy-path fixture uses 2 teams/1 member; AC specifies 1 team/2 members. Behavioral coverage is equivalent. `tests/integration/init.integration.test.ts`.

### Epic 3 — Team & Member Management
- AC-3.1.5: `TEAM-INT-001` is a mocked service test, not a real-filesystem integration test against a temp vault. Add real FS coverage in `tests/integration/team.integration.test.ts`. `tests/commands/team.command.test.ts`.

### Epic 4 — Skill Registry
- AC-4.1.7: In `--json` mode, error output is routed to stdout via `printJson` (machine-readable contract). Intentional design choice; AC wording is ambiguous on `--json` error behavior. `src/commands/install.command.ts`.
- AC-4.1.8: `tests/commands/install.command.test.ts` mocks at the service layer, not `node:https`. Service-level isolation is a valid and sufficient boundary; direct `https` mock adds no additional safety. `tests/commands/install.command.test.ts`.
- AC-4.1.9: Integration Test D (404) asserts exit code but not specific stderr content. Tests I and J do assert specific stderr content. Extend Test D to spy stderr and match error message. `tests/integration/install-update.integration.test.ts`.

## Deferred from: code review of 6-2-tmr-myself-config-update-delta-review-mode (2026-05-11)

- Collaborator who is actually a contractor uses the wrong departure path — when a user answers the Collaborator changes question about someone who is actually a contractor (profile in `my-company/contractors/members/`), the departure write targets `my-company/members/<email>.md` instead. Pre-existing routing ambiguity between collaborator and contractor personas. `skills/tmr-myself-config/SKILL.md` Step U4.
- Project team roster not updated after a direct-report departure — departed reports remain listed in `## Team` sections of `my-company/projects/<slug>/<slug>-project.md`. Pre-existing gap outside scope of departure handling story. `skills/tmr-myself-config/SKILL.md`.
- Same-session addition + departure conflict for the same email — if a new report is added and then mentioned as a departure in the same U4 pass, the departure write targets a file that does not exist yet (created in WRITE, not before CONFIRM). AI discretion handles this but no spec guard exists. `skills/tmr-myself-config/SKILL.md` Step U4.
- U3 context summary does not filter already-departed members (`status: former`) — B3 reads all files without filtering, so former members appear in the U3 TEAM count and list, causing user confusion and spurious re-departure entries. Pre-existing issue in BOOTSTRAP Step B3. `skills/tmr-myself-config/SKILL.md`.
- Person with dual filing in both `my-teams/members/` and `my-company/members/` — a report added as a collaborator ends up with files in both directories; only one departure question will trigger unless user answers both. Pre-existing routing complexity. `skills/tmr-myself-config/SKILL.md`.
