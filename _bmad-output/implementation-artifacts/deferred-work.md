# Deferred Work

## Deferred from: code review of 9-28-member-add-team-updates-team-members-frontmatter (2026-06-10)

- Concurrent read-modify-write on team-members file can lose updates — no file-lock pattern in codebase; single-user CLI assumption holds (see 9-26 deferred work).
- `createTeam` early-return skips members file recreation when context exists but members file deleted — `addRelation` throws if members file missing; repair belongs in doctor/migration scope (Story 9.36).
- Corrupt YAML in team-members file throws uncaught `matter()` parse error — acceptable for v1 per 9-26 deferred work; Story 9.36 doctor may add validation.
- Duplicated team-members file path construction in MemberService vs TeamService — story spec explicitly inlined path; centralize in a future refactor.
- MemberService has no symmetric `removeRelation` when member profile is deleted — lifecycle cleanup is Story 9.34 scope, not 9.28.

## Deferred from: code review of 9-27-relation-types-and-project-context-rule (2026-06-10)

- Hard cutover read paths without migration fallback — `project-context.md` mandates frontmatter-only reads and points to `tmr doctor --fix-frontmatter` (Story 9.36). No fallback read path in this story; pre-migration vaults may show empty relationships until doctor runs.
- `last_*` scalar desync from body artifact lists — Dated lists stay in body while `last_1on1`/`last_feedback`/etc. live in frontmatter. Keeping them in sync is Story 9.31 scope, not this types/docs story.
- RelationKey vs interface dual maintenance — `relations.types.ts` profile shapes complement `RelationKey`/`ScalarKey` in `frontmatter-relations.ts` per Dev Notes. Key drift risk acknowledged; shared codegen or exported unions deferred to Wave 2 integration.
- Read-path YAML type coercion at cast sites — Interfaces are cast targets only; gray-matter may yield scalars where arrays expected, string booleans, or YAML null. Normalization guards belong in Wave 2 read/write stories (9.28–9.34), not this interface file.

## Deferred from: code review of 9-26-frontmatter-relations-shared-utility (2026-06-10)

- Corrupt frontmatter type mismatches (scalar in array key) silently coerced to `[]` on add — `addRelation`/`removeRelation` use `Array.isArray(data[key]) ? ... : []` without error. Acceptable for v1 utility; Story 9.36 doctor migration should detect and repair malformed relation fields.
- Concurrent read-modify-write on same file can lose updates — no file-lock pattern exists in the codebase; single-user CLI assumption holds for now. Re-examine if parallel command execution is introduced.
- Malformed YAML frontmatter throws uncaught gray-matter parse error — utility does not wrap `matter()` in try/catch. Callers receive the raw exception; acceptable for v1; doctor story may add validation.
- File rewritten even when relation data unchanged — duplicate `addRelation`, no-op `removeRelation`, and matching scalar overwrites still call `writeFile`. Optimization not required by spec; reduces git noise in a future pass.

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

## Deferred from: code review of 7-1-bootstrap-install-scripts (2026-05-11)

- `Read-Host` blocks in CI/non-interactive PS1 execution — out of spec scope; script is an end-user interactive installer, not designed for CI pipelines. `scripts/install.ps1` `Prompt-YN` function.
- `sudo npm install -g` anti-pattern on Linux — using sudo for global npm installs can cause permission issues (files owned by root); better pattern is user-scoped npm prefix. Spec-defined behavior; dev notes acknowledge. `scripts/install.sh` Linux step 2.
- "All done!" banner fires even when some optional installs failed — technically misleading UX, but acceptable under AC10 error-resilience design (single failures don't abort). `scripts/install.sh:214-219`.
- Granola cask name (`brew install --cask granola`) and winget ID (`Granola.Granola`) are unverified — must be checked against Homebrew and winget registries before scripts go live. Pre-deployment verification noted in story dev notes. `scripts/install.sh` + `scripts/install.ps1`.
- `iwr -useb <url> | iex` supply-chain concern — piping remote scripts directly to a shell/interpreter is a known supply-chain risk pattern; mitigated by hosting on a controlled domain with HTTPS. Spec-defined delivery method (FR52/AC11). `scripts/install.ps1` header comment.

## Deferred from: code review of init-vault-config-corrections (2026-05-13)

- `copySampleInboxFiles()` unconditionally overwrites existing inbox sample files on re-init — if a user edits those files and re-runs `tmr init`, their edits are silently lost. Pattern: mirror the `my-tasks/` existence check at `init.command.ts:124`. `src/services/init.service.ts:copySampleInboxFiles`.

## Deferred from: code review of 7-2-tmr-doctor-environment-health-check (2026-05-11)

- `Promise.all` atomic rejection in `DoctorService.runChecks()` — if any single async check (`checkObsidian`, `checkGranola`, `checkGoogleDrive`) throws unexpectedly, `Promise.all` rejects and all results are discarded; the command-level catch shows a generic error rather than partial results with the failing check flagged. The outer try/catch in `runDoctor` handles this per AC8; per-check resilience is a UX improvement beyond spec scope. `src/services/doctor.service.ts:runChecks`.
- ~~`checkTmr()` unguarded synchronous `require('../../package.json')`~~ — **RESOLVED 2026-05-11**: version now injected via `DoctorService` constructor; `require` removed from service layer entirely. `createDoctorCommand(pkg.version)` in `src/cli.ts` supplies the version using `cli.ts`'s already-correct `'../package.json'` resolution path.

## Deferred from: code review of 8-1-wire-jest-md-transformer (2026-05-19)

- Build vs test content can drift without failing tests — Jest transformer loads live `.md` files from `examples/inbox-samples/` at test time while `tsup` inlines them at build time. Tests assert only partial content (not byte-for-byte equality); a divergence between disk and `dist/` output would not be caught automatically. [`src/templates/onboarding.templates.ts`:3–4]
- Wildcard `*.md` ambient declaration does not prove sample files exist — `src/types/md.d.ts` declares `declare module '*.md'`; `tsc` can pass while the actual `.md` files are absent or moved; failure only surfaces at Jest resolve/transform time, not at type-check time. [`src/types/md.d.ts`]

## Deferred from: code review of 8-3-domain-check-contractor-routing (2026-05-19)

- D1 — YAML flow-sequence format (`[gmail.com, corp.com]`) silently yields `[]` — hand-rolled parser is scoped to the format generated by `InitService.writeOrgConfig()`; inline array format is not generated by the tool, and the story dev notes explicitly constrain to the fixed format. [`src/services/member.service.ts:getInternalDomains`]
- D2 — Inline YAML comments folded into domain value (e.g. `- gmail.com # note` → stored as `gmail.com # note`) — same format constraint as D1; file is always generated by the tool without comments. [`src/services/member.service.ts:getInternalDomains`]
- D3 — No `--company` CLI flag for non-interactive scripting — story scope is interactive routing only; no AC requires a `--company` flag. Out of scope for Story 8.3. [`src/commands/member.command.ts`]
- D4 — `--team` + domain-routed contractor writes unexpected `manager:` field in contractor frontmatter — pre-existing design gap: `--team` and `--contractor` interaction was never specified as mutually exclusive. Requires a UX decision (warn user, strip `--team` silently, or error). [`src/commands/member.command.ts`]
- D5 — Routing prompt label hardcodes `my-company/members/` even when `--team` is active — minor UX gap; actual destination path changes based on `--team` but the prompt copy does not. [`src/commands/member.command.ts`]

## Deferred from: code review of 9-1-unify-entity-resolution-and-folder-structure (2026-05-24)

- Legacy flat profiles invisible to resolution — workspaces with pre-9.1 flat paths (`my-company/members/<email>.md`, `my-teams/members/<email>.md`) are missed by `_doResolve()`; step 4 auto-creates a second nested profile, orphaning the original. `src/services/email-resolution.service.ts:_doResolve()`.
- Legacy flat team profile auto-creates as company relationship — if only a flat team profile exists, steps 1–3.5 all miss and step 4 creates `my-company/members/<email>/<email>.md` with `type: 'relationship'`, routing feedback/1on1 files to the wrong scope. `src/services/email-resolution.service.ts:_doResolve() step 4`.
- `feedbacks/` scaffold vs `feedback/` write path mismatch — `addMember()` creates `feedbacks/` per story spec; `FILE_TYPE_CONFIG.feedback.subDir` writes to `feedback/`. Explicit design decision during Story 9.1: both directories serve different vault purposes. Revisit if UX feedback surfaces user confusion. `src/services/member.service.ts:addMember()`.
- Stale resolution cache after filesystem changes — `resolve()` caches `IEntityLocation` with no invalidation when profiles are added/moved/deleted between calls. Pre-existing design; acceptable for single-user CLI. `src/services/email-resolution.service.ts:resolve()/_cache`.
- Relationship profile shadows contractor at same email — if both `my-company/members/<email>/<email>.md` and `my-company/contractors/<email>/<email>.md` exist (migration mistake), step 3 returns `type: 'relationship'` before step 3.5 can fire. Data-error edge case; resolution priority order is by design. `src/services/email-resolution.service.ts:_doResolve() steps 3/3.5`.
- Concurrent `resolve()` auto-create races — two parallel calls for the same unknown email can both miss cache and both execute step 4 `writeFile()`, with the last writer winning. Pre-existing TOCTOU pattern. `src/services/email-resolution.service.ts:_doResolve() step 4`.
- `memberSubDirFromProfile` flat-path branch unreachable — `createMemberFile()` now always obtains paths from `_doResolve()`, which never returns flat paths; the flat-path branch in `memberSubDirFromProfile()` is dead code. Not harmful; clean up in a future refactor pass. `src/services/member.service.ts:memberSubDirFromProfile()`.
- `findMember` team-only scope silently misses company/contractor members — method hardcodes `my-teams/members/` path; unchanged behavior from pre-9.1 but more conspicuous now that contractor is a first-class type. `src/services/member.service.ts:findMember()`.
- `findMember` constructs path without input validation — no `validateEmail()` call at method entry, unlike `addMember()`. Pre-existing caller-validates pattern; email format precludes traversal in practice. `src/services/member.service.ts:findMember()`.
- MEM-INT-004 does not assert subdir creation — integration test asserts only the profile `.md` file and the feedback file; zero subdir existence checks. Add `fs.existsSync` assertions for all four common subdirs in a test-hardening pass. `tests/integration/member.integration.test.ts:284–309`.

## Deferred from: code review of 8-2-scaffold-deps-yaml-on-project-add (2026-05-19)

- D1 — Idempotency is structurally tied to the overview-file existence guard, not a `deps.yaml`-specific guard — if `addProject` gains a `--force` or partial-repair path, `deps.yaml` will be silently overwritten without an independent guard. Spec-chosen design; real future evolution risk. [`src/services/project.service.ts:136`]
- D2 — Stub comment `# Do not edit manually unless you understand the schema.` references a schema that does not exist anywhere in the repository — unactionable guidance. Product copy decision; address in a documentation story. [`src/services/project.service.ts:54`]
- D3 — No commented-out example of a populated `sources` entry in the stub — reduces self-service value for users who bypass `/tmr-project-impact`. Product design decision; spec defines exact stub content. [`src/services/project.service.ts:54`]
- D4 — No test or rollback for partial-creation failure: if `writeFile` for `deps.yaml` throws after directories are already created, `addProject` leaves the project in a half-initialized state. Pre-existing service design gap (same pattern as scaffolding dirs with no rollback). [`src/services/project.service.ts:136`]

## Deferred from: code review of 8-4-publish-tmr-project-impact-to-registry (2026-05-19)

- D1 — `tmr-inbox` and `tmr-myself-config` have no `<!-- version: -->` comment in their `skills/` registry copies. `parseVersion()` returns `'0.0.0'` for both. Once a user's manifest advances past `0.0.0` (e.g. after a manual bump), `isNewerVersion` will never fire for those skills and content updates will be silently skipped. Pre-existing; address in a separate registry-hygiene story. [`skills/tmr-inbox/SKILL.md`, `skills/tmr-myself-config/SKILL.md`]
- D2 — `docs/skills/` may be excluded from the npm publish artifact (`.npmignore` lists `docs/` as excluded; `package.json` `"files"` only includes `dist/`). If so, `InitService._readBundledSkill()` would always fail for new npm installs and bundled skill installation would silently degrade to warns. Pre-existing; validate npm publish layout and add an artifact-layout test or move bundled skills into `dist/`. [`src/services/init.service.ts:271`, `.npmignore`]
- D3 — Content-only changes to a skill's `SKILL.md` without bumping the `<!-- version: -->` comment are silently ignored by `tmr update` after first install, because `isNewerVersion` uses strict `>`. Users cannot receive prose-only improvements without a version bump. Pre-existing `update.command.ts` design; document the convention in `CONTRIBUTING.md`. [`src/commands/update.command.ts:8`]
- D4 — `SKILL-PKG-004` asserts the version string is identical between registry and bundled copies but does not compare file body content. Registry and bundled copies can diverge in skill logic while both carry the same version comment and all tests pass. Enhancement; add a content-hash or normalized-body comparison if body parity becomes critical. [`tests/packaging/skill-registry.test.ts:SKILL-PKG-004`]
- D5 — `SKILL-INT-006` only covers the "updated" path. When the registry returns a file with no version comment (`parseVersion` returns `'0.0.0'`) and the installed version is also `0.0.0`, `isNewerVersion` is false and the skill is silently left at the old bundled content. No test covers this silent no-op. Low risk while version comments are consistently added. [`tests/integration/install-update.integration.test.ts:SKILL-INT-006`]
- D6 — `semverAtLeast()` in the packaging test and production `isNewerVersion()` both use `split('.').map(Number)` with no validation. Non-semver captures (e.g. `'1.0.0-beta'`, `'v1.0.0'`) produce `NaN` in comparisons that silently evaluate to `false`. Risk is low because version strings are controlled by maintainers, but a malformed comment would cause the packaging test to falsely pass if `semverAtLeast` is fed a NaN-producing string. [`tests/packaging/skill-registry.test.ts:semverAtLeast`, `src/services/skill-registry.service.ts:parseVersion`]

## Deferred from: code review of ci.yml npm publish job (2026-05-19)

- D1 — Published `dist` is rebuilt inside the `publish` job independently from the `test` job. If the build is non-deterministic (timestamp injection, non-locked transitive deps), the published artifact differs from what was tested. Fix by uploading the `dist` artifact in `test` and downloading it in `publish`. [`.github/workflows/ci.yml:publish`]
- D2 — No git tag is created after a successful publish. Release history in git is lost; `git describe`, changelogs, and `git log --tags` will be inaccurate. Requires `permissions: contents: write` and additional git push steps. [`.github/workflows/ci.yml:publish`]
- D3 — No `npm publish --dry-run` preflight step. Malformed `package.json` fields, missing `files` entries, or `.npmignore` misconfigurations are only discovered at live publish time. [`.github/workflows/ci.yml:publish`]
- D4 — `refs/heads/main` is hardcoded in the `if` condition. If the default branch is renamed, publish silently stops triggering with no error. Use `github.event.repository.default_branch` for resilience. [`.github/workflows/ci.yml:42`]

## Deferred from: code review of 9-3-my-career-flat-structure (2026-05-24)

- D1 (High) — `TeamService.getManagerEmail()` + `buildMemberProfileMd()` still use the old nested `my-career/<email>/<email>.md` layout. After 9.3, `listDirectories('my-career')` returns empty (no subdirs exist), so `tmr init` team members get `manager: ''` and team profile wiki-links point to non-existent paths. Requires a dedicated fix story targeting `src/services/team.service.ts` and `src/templates/onboarding.templates.ts`.
- D2 (Med) — `_resolveManagerLink` picks up any `.md` file in `my-career/` without filtering for email-shaped names. Files like `README.md`, dot-prefixed backups, or (post-9.16) dated performance-review files will sort before the profile and produce a wrong manager link. Harden before Story 9.16 lands. [`src/services/member.service.ts:_resolveManagerLink`]
- D3 (Med) — `onboarding.templates.ts` still emits `my-career/${managerEmail}/${managerEmail}.md` nested path in `generateTeamMemberProfile()`. Part of the TeamService fix (D1 above). [`src/templates/onboarding.templates.ts`]
- D4 (Med) — `EmailResolutionService._doResolve()` step 2.5 returns `type: 'self'` for any email whose flat file exists in `my-career/`, not just the vault owner. A stray `bob@co.com.md` would resolve as self for Bob. Pre-existing design limitation — vault owner identity not stored in config for cross-checking. [`src/services/email-resolution.service.ts:_doResolve`]
- D5 (Low) — `_resolveManagerLink` JSDoc says "first alphabetically" but `listFiles` uses `readdir` order (inode-based on POSIX). Pre-existing inaccuracy shared by `listDirectories` throughout the codebase. [`src/services/member.service.ts`]
- D6 (Low) — Symlinked `my-career/<email>.md` files are invisible to `listFiles` because `Dirent.isFile()` returns false for symlinks. Pre-existing `FileSystemService.listFiles()` design constraint. [`src/services/file-system.service.ts:listFiles`]
- D7 (Low) — Removal of the explicit `exists(managerProfilePath)` guard in `_resolveManagerLink` is correct (listFiles guarantees existence) but undocumented — future readers may re-add it unnecessarily. Low risk. [`src/services/member.service.ts:_resolveManagerLink`]

## Deferred from: code review of 9-4-organization-yaml-domain-inference-and-obsidian-config (2026-05-24)

- D1 (Med) — `appendInternalDomain` appends at end-of-file — if `organization.yaml` ever has keys after `internal_domains:`, the new domain is placed outside the block, producing invalid YAML. Current template only writes one key so this doesn't trigger in practice. Proper fix would insert under the last list entry of `internal_domains:`. [`src/services/member.service.ts:appendInternalDomain`]
- D2 (Low) — `isValidDomain` checks `!trimmed.includes(' ')` but does not guard against tab or other whitespace characters — `"exam\tple.com"` passes validation. Replace space check with a broader `!/\s/.test(trimmed)`. Extremely unlikely in real usage. [`src/utils/validation.ts:isValidDomain`]
- D3 (Low) — Concurrent `appendInternalDomain` calls share a read-modify-write pattern with no locking — second write overwrites first, silently losing a domain. Inherent file-system architecture constraint; CLI commands are not typically concurrent. [`src/services/member.service.ts:appendInternalDomain`]
- D4 (Low) — `team.command.ts` remember-domain prompt fires unconditionally after a successful `addMember` call, even if the member already existed (no `result.created` guard) — pre-existing command-layer behavior; `printSuccess` also fires unconditionally. [`src/commands/team.command.ts:runAdd`]

## Deferred from: code review of 9-5-relationship-frontmatter-all-profiles (2026-05-24)

- W1 (Low) — `department: ""` orphan field in `EmailResolutionService` auto-create shim — pre-existing, no other profile type writes `department`; Dataview queries may pick it up as meaningful structure. [`src/services/email-resolution.service.ts:123`]
- W2 (Low) — Auto-create shim hardcodes `relationship: "company-member"` for all auto-created profiles regardless of caller context — pre-existing design limitation; any contractor or leadership email resolved through this path gets the wrong relationship type. [`src/services/email-resolution.service.ts:126`]
- W3 (Low) — Auto-create shim uses raw inline string instead of `gray-matter` — pre-existing technical debt already tracked by TODO(Story 3.2). [`src/services/email-resolution.service.ts`]
- W4 (Low) — Quoting inconsistency: shim writes `relationship: "company-member"` (YAML-quoted) while `matter.stringify` profiles write unquoted values — harmless (both are valid YAML), depends on W3 shim refactor. [`src/services/email-resolution.service.ts:126`]
- W5 (Low) — No typed frontmatter interface for member `relationship` field — `MemberService` builds frontmatter as `Record<string, unknown>` with no compile-time enforcement; a mis-spelled value reaches the vault silently. [`src/services/member.service.ts:111`]

## Deferred from: code review of 9-8-email-similarity-warning (2026-05-25)

- D1 (Medium) — SCAN_DIRS skips legacy `.md` files at dir root: entries like `user@co.com.md` get domain `co.com.md` after split, never matching the input domain. Affects pre-9.1 vaults that haven't fully migrated. [`src/utils/email-similarity.ts:findSimilarEmail`]
- D2 (Low) — Archived members never scanned: `my-teams/archived/<year>/<email>/` is not in SCAN_DIRS, so typo warnings won't fire against archived profiles. Spec defines scan paths explicitly; extending requires intentional scope decision.
- D3 (Low) — Workspace root fallback may point to wrong dir: if no `.tmr` sentinel exists, `getWorkspaceRoot()` falls back to `process.cwd()`; similarity scan hits wrong tree silently. Pre-existing issue with workspace detection.
- D4 (Low) — Levenshtein missing length-delta early-exit: when `|a.length - b.length| > 2`, the result is guaranteed > 2; short-circuiting here would skip the full DP computation. Performance nit only — no correctness impact.
- D5 (Low) — No test coverage for SCAN_DIRS `.md` suffix gap (follows D1).
- D6 (Low) — `team add` email prompt validates length only (not format): `inquirer` validate checks `v.trim().length > 0`, not a full email regex. `findSimilarEmail` correctly returns null for non-emails; `addMember` throws `InvalidEmailError` after secondary prompts. Pre-existing.
- D7 (Low) — `leadership add` CLI arg not validated before similarity guard: passing `notanemail` as CLI arg skips the prompt regex; the guard runs with a malformed email, returns null, and `addLeadership` may fail. Pre-existing validation gap.
- D8 (Low) — Bulk link partial writes on mid-batch error: if `linkMember`/`linkStakeholder` throws after some emails are processed, earlier writes are not rolled back. Pre-existing service-layer atomicity issue.
- D9 (Low) — Bulk link duplicate emails not deduped before similarity loop: `a@x.com,a@x.com` passes through the filter twice. Service-level dedup concern.
- D10 (Low) — Bulk link per-email skip is silent: when user aborts for some emails in a batch, no per-email message is printed. Only "All emails were skipped" fires when none remain. Story has no spec for partial-skip feedback.
- D12 (Low) — Non-interactive stdin may crash `inquirer.prompt` in `warnIfSimilarEmail`: CI/piped contexts can cause unhandled rejection. Pre-existing pattern across entire codebase.

## Deferred from: code review of 9-11-member-add-1on1-subcommand (2026-05-26)

- W1 — Fix `as unknown as Record<string, string>` cast to `{ proceed: boolean }` actual type in command test. Stylistic; works correctly at runtime.
- W2 — Tighten `expect.any(Object)` in continue-path to also validate the `date` field. Deliberate loose choice; defer to avoid over-specification.
- W3 — Add service test for 1on1 with no `date` option to exercise default date handling. Pre-existing coverage gap.
- W4 — Guard for `EmailResolutionService.resolve()` returning `created: true` with a null `absolutePath`. Pre-existing service-layer edge case.

## Deferred from: code review of 9-10-member-assessment-and-performance-review (2026-05-26)

- W1 — Vault data backward compatibility: existing vault files named `YYYY-MM-review-<email>.md` now have broken wiki-links after the `fileSuffix` rename; no migration note or release changelog entry was included. Pre-existing data concern out of scope for this story.
- W2 — Wrap 9.10 tests in a dedicated `describe` block: new tests are behind a comment banner but not an enforceable describe scope; other story tests use `describe('Story X.Y — ...')` for selective execution. Stylistic.
- W3 — Standardize test dates across assessment/performance-review tests: existing tests use `2026-03-07`, new tests use `2026-05-22`; produces two expected year-month prefixes for the same behavior. Low priority.
- W4 — Add flat profile branch test for auto-create: the auto-create test uses a nested profile only; the flat profile layout of `memberSubDirFromProfile` is never exercised in any auto-create test. Pre-existing coverage gap.

## Deferred from: code review of 9-12-team-shared-folder-and-direct-report-frontmatter (2026-05-26)

- W1 — Orphaned subdirs on write failure: if `createDirectory` succeeds for all 5 dirs but `writeFile` throws, the member folder exists with no profile; pre-existing pattern across all subdirs, not introduced by this story.
- W2 — Duplicate test setup in 9.12 block: three new tests repeat identical `mockFS` boilerplate; could share a `beforeEach`; style only, no correctness impact.
- W3 — Existing-member backfill gap: `<email>-shared/` and `relationship: direct-report` are never added to pre-9.12 profiles when `team add` is re-run for a second team; needs a separate migration story.
- W4 — Flat `my-career/` manager resolution (Story 9.3 scope): `getManagerEmail()` uses `listDirectories()` on a now-flat folder and returns `null` on fresh vaults; TODO comments in the code are the explicit contract for Story 9.3 to fix.
- W5 — `archiveMember` partial archive omits `<email>-shared/`: the date-range branch `subDirs` list has 4 entries and excludes `<email>-shared/`; low impact since shared-folder files are typically not date-prefixed; full archive is unaffected.

## Deferred from: code review of 9-13-project-standup-date-flag-and-wikilink (2026-05-26)

- D1 — Special characters in project name (e.g. `"`, `|`, `]]`) could corrupt YAML quoted scalar or wiki-link boundary; normalizeSlug scope predates this diff.
- D2 — Quoted wiki-link `project: "[[...]]"` may not render in Obsidian graph or properties panel; product design decision — spec explicitly showed this form; document intended consumer (Obsidian vs Dataview) if it causes user confusion.
- D3 — Path arithmetic (`formatWikiLink` call) now lives in `TemplateService` which is documented as pure template generation; mild separation-of-concerns debt; consider moving link computation to `ProjectService` in a future refactor.
- D4 — No guard against silently overwriting an existing standup file; `addStandup` calls `writeFile` unconditionally; consider existence check + error or `--force` flag in a future story.
- D5 — No CLI-layer Commander argument-parsing test for `--date` registration; all command tests bypass Commander and invoke handlers directly; pre-existing test architecture decision.
- D6 — Third 9.13 service test (`9.13: standup with --date option uses specified date in filename and template`) partially redundant with pre-existing coverage; minor test noise, no correctness impact.

## Deferred from: code review of 9-14-project-bidirectional-member-stakeholder-links (2026-05-26)

- D1 — `_writeProjectBackLink` calls `_emailResolution.resolve()` twice per link-member/link-stakeholder invocation; first resolve already performed by the caller; redundant I/O, safe but wasteful.
- D2 — CRLF mutation: `split('\n')` + `join('\n')` strips Windows carriage returns from any file it touches; pre-existing pattern across the codebase; low priority unless Windows vault users report line-ending corruption.
- D3 — Service test `readFile` mock returns project overview content for all paths, including the member profile path used by `appendToSection`; inaccurate fixture but tests remain functional; idempotency and section-scoped behavior covered by `appendToSection` unit tests.
- D4 — No service-level idempotency test: no test asserts that calling `linkMember` or `linkStakeholder` twice writes the back-link only once; covered implicitly by `appendToSection` unit tests.
- D5 — No guard against falsy `resolved.absolutePath` from `EmailResolutionService.resolve()`; service contract guarantees a non-empty value but it is not validated defensively in `_writeProjectBackLink`.
- D6 — `writeFile(overviewPath)` is not rolled back if `_writeProjectBackLink` rejects; project file receives forward link but member profile receives no back-link; pre-existing pattern — no atomic writes in codebase.
- D7 — `appendToSection` accepts an unconstrained `entry` string; embedded newlines silently inject extra lines into the file; not realistic in current call sites.
- D8 — "appends entry among existing entries in section" unit test does not verify section membership or insertion ordering; only checks `toContain`; weak signal for regression detection.

## Deferred from: code review of 9-14-project-bidirectional-member-stakeholder-links (2026-05-27)

- D1 — Race condition in `appendToSection`: read-modify-write on the same profile file is not atomic; concurrent calls (e.g., linking same email to two projects simultaneously) will silently overwrite each other; pre-existing pattern across codebase.
- D2 — `linkMembers`/`linkStakeholders` batch commands do not invoke `writeProjectBackLink`; batch linking leaves member/stakeholder profiles without `## Projects` back-links while single-email commands work correctly; future story scope.
- D3 — Multi-line `entry` argument to `appendToSection` bypasses the idempotency guard (`Array.includes` never matches a multi-line element) and corrupts the file on `splice`; unrealistic in current usage since wiki-links are single-line.

## Deferred from: code review of 9-14-project-bidirectional-member-stakeholder-links Round 3 (2026-05-27)

- D1 — Trailing whitespace on a heading line causes exact-match miss in `appendToSection`; the section is treated as absent and a duplicate `## Projects` is appended at EOF. Per-spec exact-match behavior; trailing whitespace on headings is uncommon in Obsidian. [`src/utils/markdown-section.ts:19`]
- D2 — `#` (h1) headings are not recognized as a section boundary in the `insertAt` scan; only lines starting with `## ` stop the loop. Level-1 headings don't appear between `##` sections in Obsidian profiles in practice. [`src/utils/markdown-section.ts:24`]
- D3 — Character-exact idempotency guard misses URL-encoded or whitespace variants of the same wiki-link. `formatWikiLink` output is deterministic so no variant arises in current usage. [`src/utils/markdown-section.ts:30`]
- D4 — Back-link write failure in `writeProjectBackLink` propagates as a hard error after the primary overview write has already committed, leaving the caller with an error even though the project link succeeded. Consistent with the codebase's error-propagation pattern; no try/catch wraps write calls elsewhere. [`src/services/project.service.ts`]
- D5 — `trimEnd()` in the section-absent branch silently strips intentional trailing whitespace from the entire file without documenting the side effect. Minor reformatting; profiles don't rely on trailing whitespace in practice. [`src/utils/markdown-section.ts:34`]
- D6 — Blank-line formatting differs between the section-exists path (raw `splice`, no separator before new entry) and the section-absent path (`\n\n{entry}` with a blank line). Minor cosmetic inconsistency; list items don't require blank-line separators in Markdown. [`src/utils/markdown-section.ts:31,34`]
- D7 — Integration test regex `/## Projects[\s\S]*\[\[/` does not verify exact wiki-link content or that `formatWikiLink` was used; any `[[` after `## Projects` satisfies the assertion. Behavioral testing is appropriate; `formatWikiLink` usage is verified by code review. [`tests/services/project.service.test.ts`]
- D8 — Two divergent markdown-section insertion implementations coexist: `appendToHashSection` (private method, `#` headings, operates on a string) and `appendToSection` (free function, `##` headings, file I/O included), with no documented rationale for the divergence. Design concern; not actionable within 9.14 scope. [`src/services/project.service.ts`, `src/utils/markdown-section.ts`]
- D9 — `appendToSection` takes `fs: FileSystemService` as a positional trailing parameter rather than via constructor injection, inconsistent with the rest of the service layer. Deliberate design choice for a utility function; the inconsistency grows as call sites multiply. [`src/utils/markdown-section.ts:12`]
- D10 — When `content` is an empty string, `content.trimEnd() + '\n## ...'` produces a file starting with `\n` (a leading blank line). Harmless; profile files are never empty in the current workflow. [`src/utils/markdown-section.ts:34`]
- D11 — If a profile has two `## Projects` sections, `findIndex` returns only the first; an entry already in the second section is invisible to the idempotency guard and a duplicate is appended to the first section. Malformed-file edge case; spec assumes well-formed input. [`src/utils/markdown-section.ts:20`]

## Deferred from: code review of 9-15-show-self-profile-lookup-fix (2026-05-27)

- D1 — Auto-create side effect: `resolve()` at step 5 ghost-creates `my-company/members/<email>/` directories and a profile for truly unknown emails before returning null. Tied to the D_NEEDED-1 ordering decision; this is pre-existing behavior of `EmailResolutionService.resolve()`. [`src/services/team.service.ts:452`]
- D2 — TOCTOU: self/contractor file deleted between `resolve()` exists-check and `readFile()` causes raw ENOENT to propagate. Pre-existing codebase pattern (all exists + readFile combos share this risk). [`src/services/team.service.ts:457`]
- D3 — TOCTOU race: a relationship profile created concurrently between `showProfile` step 4 check and step 5 `resolve()` call is invisible; `showProfile` returns null despite the file being on disk. Pre-existing architectural pattern. [`src/services/team.service.ts:448`]
- D4 — No test for self-priority scenario (user email registered as both a team member and self); outcome depends on the D_NEEDED-1 ordering decision. [`tests/services/team.service.test.ts`]

## Deferred from: code review of 9-16-myself-add-performance-review (2026-05-27)

- D1 — No duplicate-file guard; running the command twice in the same month silently overwrites the existing review and appends a second wiki-link. Pre-existing pattern across all dated-file commands (member, leadership). [`src/services/myself.service.ts:53`]
- D2 — `path.basename('.md', '.md')` returns empty string if a file named literally `.md` exists in `my-career/`. Unrealistic vault-corruption edge case. [`src/services/myself.service.ts:41`]
- D3 — `writeFile` succeeds then `appendToFile` throws → review file created but wiki-link never appended; vault in inconsistent state. Pre-existing pattern across all service-layer write pairs. [`src/services/myself.service.ts:53-56`]
- D4 — `todayIso()` calls `new Date()` directly with no injection point; default-date test asserts only `expect.any(String)`. Pre-existing pattern (identical in `member.service.ts`). [`src/services/myself.service.ts:8`]
- D5 — Command error handler drops `TmrError.code` silently. Pre-existing pattern across all command error handlers. [`src/commands/myself.command.ts:15`]
- D6 — `jest.unstable_mockModule` used without documenting its instability. Pre-existing pattern in every command test file.

## Deferred from: code review of 9-20-workspace-anchoring-config-fallback-guard (2026-06-04)

- Symlink CWD not resolved — if CWD is a symlinked path (e.g., `/link/to/vault/sub → /configured/workspace`), the `startsWith` guard fails even though the user is physically inside the vault. Fix requires `fs.realpathSync()` on both CWD and configured path before comparison; same gap exists in the step-1 sentinel walk-up. `src/utils/workspace.ts`.
- Case-insensitive filesystem on macOS — `startsWith` is a case-sensitive string comparison; on APFS (case-insensitive mode), path-case mismatches between stored config and CWD would cause false negatives. Pre-existing pattern across codebase. `src/utils/workspace.ts`.
- No integration test for "tmr command from outside vault exits 1, no files created" (spec Coverage #4 / AC4) — unit tests cover the `getWorkspaceRoot()` logic but command-level abort behaviour (that no content is created in the CWD) is not verified end-to-end. `tests/integration/`.

## Deferred from: code review of 9-19-obsidian-plugin-install-accuracy (2026-06-04)

- `REQUIRED_PLUGIN_IDS` vs `OBSIDIAN_PLUGINS` count drift — spinner shows N/`REQUIRED_PLUGIN_IDS.length` but `successfulIds` is derived from `OBSIDIAN_PLUGINS`; adding a plugin to one list without the other silently misreports the ratio. Already tracked as D3 below (9-17). `src/services/obsidian-plugin.service.ts`.
- Hardcoded plugin IDs in test mocks (`['obsidian-git','granola-sync','terminal','dataview']`) duplicated across three test files; ESM module-mocking constraint prevents re-using the real constant. Already tracked as D1 below (9-17). `tests/commands/init.command.test.ts`, `tests/integration/init.integration.test.ts`, `tests/services/doctor.service.test.ts`.
- Post-init summary always says "plugins are ready" regardless of actual install count — `printPostInitSummary()` hardcodes all four plugin names; contradicts partial-install warnings printed above it. Pre-existing; already tracked in 2-4 deferred. `src/services/init.service.ts`.
- Granola `data.json` written when `granola-sync` download fails — `writeGranolaConfig()` runs unconditionally; if `granola-sync` is in `fullyFailedPlugins`, its config file still lands on disk while its ID is absent from `community-plugins.json`, creating a mismatch that confuses `tmr doctor`. `src/services/obsidian-plugin.service.ts`.
- Orphan plugin files after partial download — if one required file (`main.js` or `manifest.json`) writes before the other fails, the partial files remain in `.obsidian/plugins/<id>/`; Obsidian won't load the plugin (correct) but leftover files are not cleaned up and can confuse manual repair. `src/services/obsidian-plugin.service.ts`.

## Deferred from: code review of 9-21-vault-not-found-abort-on-missing-vault (2026-06-04)

- D1 — Prompts appear before vault guard in arg-less command paths (`tmr team create`, `tmr team add`, `tmr leadership add 1on1`, `tmr project add` without email arg). Vault check IS first for argument-passing invocations; restructuring arg-less flows requires touching multiple command handlers — out of 9.21 scope. [`src/commands/team.command.ts`, `leadership.command.ts`, `project.command.ts`]
- D2 — `myself.command.ts` has a local catch block that intercepts `VaultNotFoundError` before the CLI global handler, printing only `err.message` without `err.hint` and without the `plain` flag. Pre-existing catch pattern. [`src/commands/myself.command.ts`]
- D3 — `--json` flag not respected in `cli.ts` global catch block; vault errors always print via `printError` even when `--json` is set on the root command. Pre-existing gap. [`src/cli.ts`]
- D4 — Subcommand-level `--plain` (e.g. `tmr today --plain`, `tmr this-week --plain`) does not reach the global vault error handler — root `program.opts().plain` returns `false`. Pre-existing architectural gap in `task-view` commands. [`src/commands/task-view.command.ts`]
- D5 — Missing integration/E2E test for full CLI abort: run command from outside vault, assert no prompts and exit code 1. Workspace + CLI unit tests provide sufficient coverage for now.
- D6 — `myself.command.ts` success output uses raw chalk without `plain` flag (unrelated to vault errors). Pre-existing. [`src/commands/myself.command.ts`]

## Deferred from: code review of 9-17-doctor-granola-plugins-check (2026-05-27)

- D1 — Hardcoded `REQUIRED_PLUGIN_IDS` in test mock (`jest.unstable_mockModule`) decouples test data from production constant. ESM architectural constraint; ideal fix would extract the constant to a lightweight file (no `fileSystemService` dependency) so the mock factory can import directly. [`tests/services/doctor.service.test.ts`]
- D2 — `OBSIDIAN_PLUGINS` array elements no longer deeply readonly after explicit type annotation was added (`as const` removed). Internal private constant with zero public API exposure; practical risk is nil. [`src/services/obsidian-plugin.service.ts`]
- D3 — One-directional compile-time drift: adding to `REQUIRED_PLUGIN_IDS` without updating `OBSIDIAN_PLUGINS` is not caught at compile time (the reverse direction IS caught via `RequiredPluginId` type constraint). [`src/services/obsidian-plugin.service.ts`]
- D4 — No test for vault-configured-but-directory-absent branch of `checkCommunityPlugins`. Consistent gap with `checkGranolaSync` test pattern — neither service has this branch explicitly tested. [`tests/services/doctor.service.test.ts`]

## Deferred from: code review of 9-22-remove-duplicate-company-domain-prompt (2026-06-09)

- Stale `{ role, company }` mocks in `tests/fixtures/init-prompts.ts` and `init.integration.test.ts` — outside 4-file story scope; behavior still works because `company: inferredDomain` overrides spread.
- Working tree mixes 9-23/9-24 changes unrelated to this story — branch hygiene, not a 9-22 code defect.
- `promptRoleAndCompany` role field not trimmed on return (whitespace padding) — pre-existing; inconsistent with other prompts but not introduced by this story.

## Deferred from: code review of 9-29-relationship-frontmatter-vocabulary-on-all-entity-profiles (2026-06-10)

- `team add` writes `current_manager: ''` on a flat `my-career/` because `getManagerEmail` uses `listDirectories` (nested layout) → returns null; diverges from `member add --team` which resolves a real link. Pre-existing D1, explicitly out of 9.29 scope. [`src/services/team.service.ts:134-148`]
- `_getSelfProfilePath` / `_resolveManagerLink` select `mdFiles[0]` from `my-career/`; non-deterministic if more than one top-level `.md` exists (filesystem `readdir` order). Mitigated by the flat self-profile design; mirrors deferred `_resolveManagerLink` behavior (D2). [`src/services/member.service.ts:308-318`, `src/services/team.service.ts:470-475`]
- Existing member profiles are not backfilled with the new frontmatter vocabulary (relationship/teams/current_manager) when re-added; only `direct_reports`/team-members are synced. Migration is Story 9.36 (`tmr doctor --fix-frontmatter`) scope. [`src/services/member.service.ts:115-119`]
- `_resolveTeamContextLink` generates a wiki-link to `<slug>-context.md` without verifying the team context file exists; `member add --team` against an uncreated team yields a dangling link. Intentional per Dev Notes (path generation, no FS read). [`src/services/member.service.ts:323-335`]
- `_getSelfProfilePath` is duplicated in `member.service.ts` and `team.service.ts`; DRY nit — spec only "considered" extracting a shared helper. Risk of future divergence. [`src/services/team.service.ts:470-475`]
- Pre-existing profiles keep old body sections, and on a legacy nested `my-career/` the `direct_reports` reciprocal is silently skipped (`_getSelfProfilePath` returns null). Covered by the 9.36 migration story. [`src/services/team.service.ts:226-235`]

## Deferred from: code review of 9-24-email-similarity-shared-utility-and-fix (2026-06-09)

- Dead `filteredEmails.length === 0` guard in `runProjectLinkMembers` / `runProjectLinkStakeholders` — unreachable after 9.24 because `resolveEmailWithSimilarCheck` always returns a string; story dev notes explicitly leave it harmless. [`src/commands/project.command.ts:140,230`]
- No dedicated unit test for `email-guard.ts` inquirer Y/N branches — command tests mock the guard at module boundary per AC8/story spec; integration coverage deferred to a future test-hardening pass. [`src/utils/email-guard.ts`]
- `inquirer.prompt` throws in non-TTY / SIGINT contexts propagate unhandled from guard call sites — pre-existing CLI pattern across all interactive commands (9-8 deferred D12). [`src/utils/email-guard.ts`, all command call sites]
- Batch link commands (`runProjectLinkMembers`, `runProjectLinkStakeholders`) prompt sequentially per email with no dedup — pre-existing 9-8 behavior; not introduced by 9.24. [`src/commands/project.command.ts`]
- Leadership decline-path test uses default mock passthrough rather than explicit N simulation — acceptable given mock design; does not block story acceptance. [`tests/commands/leadership.command.test.ts:248`]

## Deferred from: code review of 9-23-my-career-performance-review-subfolder (2026-06-09)

- No migration for pre-9.23 flat performance-review files in `my-career/` — story intentionally supersedes 9.16 flat layout; old files remain flat with old wiki-link format; new reviews go to `performance-reviews/` subfolder. Out of story scope.
- `resolveSelfEmail` / `_resolveManagerLink` lack dated-file filter when flat review files exist in `my-career/` — pre-existing from 9.16; 9.23 improves forward path by writing new reviews to subfolder (invisible to flat `readdir`). Already tracked as D2 in 9-3 deferred work; harden in a dedicated follow-up story.
