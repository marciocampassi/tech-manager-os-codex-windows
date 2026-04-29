---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories', 'step-04-final-validation']
status: complete
completedAt: '2026-04-27'
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
  - 'docs/architecture.md'
  - '_bmad-output/test-artifacts/test-design/tech-manager-os-handoff.md'
  - '_bmad-output/test-artifacts/test-design/test-design-architecture.md'
  - '_bmad-output/test-artifacts/test-design/test-design-qa.md'
---

# tech-manager-os - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for tech-manager-os, decomposing the requirements from the PRD, Architecture, and TEA Test Design artifacts into implementable stories with embedded quality gates and acceptance criteria.

---

## Requirements Inventory

### Functional Requirements

FR1: User can run `tmr init` to create a new vault through a guided interactive flow
FR2: User can specify vault location during init, with the current working directory as the default
FR3: System creates the standard vault folder structure during init, excluding `/utils` and `/my-teams/feedback-templates`
FR4: User can provide their email, name, and role during init to generate their profile file under `my-career/`
FR5: User can provide their leader's name, role, and email during init to generate a leadership file under `my-leadership/`
FR6: User can specify how many teams they manage during init
FR7: User can provide a team name for each team during init to create the corresponding team entry
FR8: User can add members to each team during init by providing email, name, role, gender, and location per member
FR9: User can finish adding members to a team by submitting an empty email input
FR10: System automatically installs the `tmr-inbox` skill as part of every `tmr init` run
FR11: System copies bundled sample inbox notes into the vault's inbox folder during init
FR12: System generates a `README.md` in the vault root during init containing the most-used commands and a full command reference
FR13: System displays a post-init next-steps summary directing the user to `tmr project add` and `/tmr-inbox`
FR14: System displays post-init guidance to open Obsidian and enable required plugins (nice-to-have: automated plugin enablement)
FR15: User can create a new team by providing a team name
FR16: User can add a member to an existing team by providing a team name and member email
FR17: System normalizes team names to lowercase/kebab-case on all team create and add operations
FR18: User can create a company-scoped member profile by providing only an email, stored under `my-company/members/`
FR19: User can create a team-scoped member profile by providing an email and a team name, stored under `my-teams/members/`
FR20: System links team-scoped members to the current user as their manager, resolved from `my-career/<email>.md`
FR21: User can provide a location when creating any member profile, stored in the profile frontmatter
FR22: User can add feedback for a member identified by email
FR23: System resolves a member's file via a global email resolver that searches both `my-company/members/` and `my-teams/members/`
FR24: System auto-creates a company-scoped member profile when feedback is requested for an email not found in any member location
FR25: User can install all available skills from the official skill registry in a single command
FR26: User can install a specific skill from the official skill registry by name
FR27: System accesses the skill registry through an abstracted service layer that supports future registry evolution
FR35: System automatically installs the `tmr-project-impact` skill as part of every `tmr init` run, enabling dependency tracking across project files
FR36: The `CLAUDE.md` written to the vault root during `tmr init` includes a rule instructing AI agents to run `/tmr-project-impact` whenever a file changes inside `my-company/projects/`, so that dependent documents are automatically checked for staleness
FR37: System creates a stub `deps.yaml` file inside the new project directory when `tmr project add` is run, so that `/tmr-project-impact` can be invoked at any time without a manual file creation step
FR28: System validates all email inputs before any file system operation and rejects invalid formats with a descriptive error
FR29: System re-prompts the user on invalid input during interactive flows without losing progress or crashing
FR30: System validates team count input during init as a positive integer greater than zero
FR31: System normalizes all name and team name inputs to lowercase/kebab-case, confirming the normalized form in output
FR32: System no longer exposes `tmr relationship` as a CLI command or in CLI help output
FR33: System generates Obsidian wiki-link references (`[[email]]`) in all Markdown files that reference other entities — default output behavior across all commands
FR34: Repository includes a `CONTRIBUTING.md` covering development setup, coding conventions, test process, PR guidelines, and skill submission process

---

### NonFunctional Requirements

NFR1: `tmr init` must not leave the vault in a silently partial state on failure — any write error must be surfaced via `printError` to stderr with a clear message and recovery guidance before the process exits
NFR2: No command may exit with an unhandled exception or stack trace visible to the user; all errors are caught and surfaced through `printError`
NFR3: `tmr relationship` removal must produce zero dangling code references, registered commands, or help text entries
NFR4: No prompt in the `tmr init` interactive loop may block for more than 3 seconds without a visible `ora` spinner indicating progress
NFR5: File write operations for profile, member, and leader files must complete within 500ms under normal local I/O conditions
NFR6: `tmr install` must handle skill registry failures (network error, timeout, malformed response) by surfacing a descriptive `printError` message without crashing; exit code must be non-zero on failure
NFR7: The skill registry endpoint must be read from `SkillRegistryService` configuration — no hardcoded URLs in command or service files

---

### Additional Requirements

#### Architecture Technical Requirements

- ARCH-001: `init`, `process`, `watch`, `install`, and `update` commands MUST use dynamic `import()` inside the `.action()` callback in `src/cli.ts` — do NOT add heavy deps (AI SDKs, googleapis, chokidar, inquirer) to static imports
- ARCH-002: A shared `formatWikiLink(email: string): string` utility MUST be created in `src/utils/wiki-link.ts` and used by ALL services that write Markdown referencing entities (satisfies FR33, mitigates R-004)
- ARCH-003: A shared `validateEmail()` utility MUST be used by every command/service that accepts an email argument, throwing `InvalidEmailError` (TMR_E103) before any file system operation
- ARCH-004: A shared `normalizeTeamName()` utility MUST be used by every command/service that accepts a team name argument (satisfies FR17, FR31)
- ARCH-005: `InitService` MUST delegate to `LeadershipService`, `TeamService`, and `MemberService` — no inline business logic in the command or init service beyond orchestration
- ARCH-006: `README.md` generation is a responsibility of `InitService`, generated from a bundled template; the template must be part of the distributed `dist/` output
- ARCH-007: `CONTRIBUTING.md` in repo root must cover: dev setup, `npm run validate`, coding conventions (ESM `.js` imports, `display.ts` helpers, no `console.log`), branching strategy, PR process, skill submission guidelines

#### Architectural Debt to Address

- ARCH-DEBT-001: Remove deprecated `AppConfig.provider` and `AppConfig.apiKey` fields after all callers migrated to `active_provider` and `providers[name].api_key_encrypted`; add negative test asserting new fields are used
- ARCH-DEBT-002 (ARCH-DEBT-003 in codebase): Update `JEST_WORKER_ID` guard in `cli.ts` to check `VITEST` when migrating test runner (carry-forward, not required this release)

#### TEA Test Infrastructure Prerequisites

These items MUST be created as part of the stories that depend on them — they are implementation prerequisites, not separate tickets:

- TEA-INFRA-001: Create `tests/fixtures/init-prompts.ts` — reusable `initPromptFixture(scenario)` helper with pre-wired mock sequences for happy path, email error recovery, and zero-team-count rejection. **Must be created in the init scaffold story, before any init integration tests.**
- TEA-INFRA-002: Create `tests/fixtures/member-profiles.ts` — reusable member data builders with email/team/location variants. **Must be created in the member restructure story.**
- TEA-INFRA-003: Create `src/utils/wiki-link.ts` with `formatWikiLink()` utility and `tests/utils/wiki-link.test.ts`. **Must be created in the shared utilities story, before any service implements FR33.**
- TEA-INFRA-004: Create `tests/utils/validation.test.ts` for `validateEmail()` covering `VAL-UNIT-001` through `VAL-UNIT-003`. **Must be created in the shared utilities story.**
- TEA-INFRA-005: Create `tests/utils/normalization.test.ts` for `normalizeTeamName()` covering `VAL-UNIT-004` through `VAL-UNIT-006`. **Must be created in the shared utilities story.**
- TEA-INFRA-006: Delete `tests/commands/relationship.command.test.ts`, `tests/services/relationship.service.test.ts`, and `tests/integration/relationship.integration.test.ts` as part of the relationship removal story.

#### TEA Quality Gates (P0 Risks — Must Be Mitigated Before Release)

| Risk ID | Category | Description | Quality Gate |
|---------|----------|-------------|--------------|
| R-001 | BUS | `tmr init` partial vault state on write failure | INIT-INT-011 passes: `printError` to stderr, no silent partial output |
| R-002 | BUS | Email validation missing/inconsistent across commands | INIT-INT-005/006/007, TEAM-INT-002, MEM-UNIT-009, VAL-UNIT-001/002/003 all pass |
| R-003 | TECH | `tmr relationship` not fully removed | REL-NEG-001 (`--help` absent) and REL-NEG-002 (unrecognized command) pass |
| R-004 | BUS | Wiki-link format inconsistent across services | VAL-UNIT-007, INIT-INT-013, MEM-UNIT-010/011 all pass |
| R-005 | TECH | Init prompt test sequence brittle | `initPromptFixture` helper created; INIT-INT-001–013 use it |
| R-006 | OPS | `tmr install` fails silently | SKILL-CMD-001 and NFR-EXIT-001 pass |

---

### UX Design Requirements

N/A — `tech-manager-os` is a CLI tool with no graphical interface. No UX design document exists. All interaction patterns are terminal-based and fully specified in the PRD user journeys and functional requirements.

---

### FR Coverage Map

| FR | Epic | Summary |
|---|---|---|
| FR28 | Epic 1 | `validateEmail()` utility — throws `InvalidEmailError` (TMR_E103) before any FS operation |
| FR29 | Epic 1 | Re-prompt contract on invalid input, powered by the validation utility |
| FR31 | Epic 1 | `normalizeTeamName()` utility — converts to lowercase/kebab-case |
| FR32 | Epic 1 | Remove `tmr relationship` command, service, test files, CLI help entry |
| FR33 | Epic 1 | `formatWikiLink()` utility — `[[email]]` format for all entity references |
| FR1 | Epic 2 | `tmr init` guided interactive flow via `inquirer` |
| FR2 | Epic 2 | Vault path defaults to CWD on empty input |
| FR3 | Epic 2 | Standard folder structure (excludes `/utils`, `/my-teams/feedback-templates`) |
| FR4 | Epic 2 | User profile generated under `my-career/` |
| FR5 | Epic 2 | Leader profile generated under `my-leadership/` |
| FR6 | Epic 2 | Team count input during init |
| FR7 | Epic 2 | Team name input and folder creation per team |
| FR8 | Epic 2 | Member add loop per team (email, name, role, gender, location) |
| FR9 | Epic 2 | Empty email submission ends member-add loop for that team |
| FR10 | Epic 2 | Auto-install `tmr-inbox` skill silently during init |
| FR11 | Epic 2 | Copy bundled sample inbox notes to vault `inbox/` folder |
| FR12 | Epic 2 | Generate `README.md` in vault root from bundled template |
| FR13 | Epic 2 | Post-init next-steps summary via `printInfo` |
| FR14 | Epic 2 | Post-init Obsidian plugin guidance |
| FR30 | Epic 2 | Team count validated as integer > 0 during init |
| FR15 | Epic 3 | `tmr team create <name>` command |
| FR16 | Epic 3 | `tmr team add <name> <email>` command |
| FR17 | Epic 3 | Team name normalization on all team operations (uses Epic 1 utility) |
| FR18 | Epic 3 | Company-scoped member → `my-company/members/` |
| FR19 | Epic 3 | Team-scoped member → `my-teams/members/` |
| FR20 | Epic 3 | Manager link resolved from `my-career/<email>.md` |
| FR21 | Epic 3 | `location` field in member profile frontmatter |
| FR22 | Epic 3 | `tmr member add feedback <email>` |
| FR23 | Epic 3 | Global email resolver — searches both member directories |
| FR24 | Epic 3 | Auto-create company-scoped member on unknown feedback email |
| FR25 | Epic 4 | `tmr install` — installs all skills from official registry |
| FR26 | Epic 4 | `tmr install <skill-name>` — installs single skill |
| FR27 | Epic 4 | `SkillRegistryService` abstraction layer (no hardcoded URLs) |
| FR34 | Epic 5 | `CONTRIBUTING.md` in repo root |
| FR35 | Epic 2 | Auto-install `tmr-project-impact` skill during `tmr init` |
| FR36 | Epic 2 | `CLAUDE.md` hook: AI agents run `/tmr-project-impact` on changes in `my-company/projects/` |
| FR37 | Epic 2 | `tmr project add` scaffolds stub `deps.yaml` in new project directory |

**Total: 37/37 FRs covered** ✓ *(FR35, FR36, FR37 added 2026-04-29 via sprint change)*

---

## Epic List

### Epic 1: Shared Input Contracts, Utilities & Relationship Removal
Engineers and downstream epics can rely on consistent, shared building blocks for validation, normalization, and wiki-link generation. The deprecated `tmr relationship` command is fully removed from the CLI, help text, and codebase.

> **Foundation Epic note:** Stories 1.1–1.3 create shared utilities with no direct user-visible output; their value is unlocked by all downstream epics. Story 1.4 is the only user-visible delivery in this epic (FR32). This structure is intentional for a brownfield project — utilities must exist before the features that depend on them.

**FRs covered:** FR28, FR29, FR31, FR32, FR33

**Brownfield note:** `validateEmail()` exists on `EmailResolutionService` as a boolean method — extract and upgrade to throw `InvalidEmailError`. Two wiki-link helpers exist inline in services — supersede with a single exported `formatWikiLink()`. `normalizeTeamName()` does not exist anywhere — net new.

**TEA quality gates:** VAL-UNIT-001/002/003 (email), VAL-UNIT-004/005/006 (normalization), VAL-UNIT-007/008 (wiki-link), REL-NEG-001/002 (relationship absent from help + unrecognized)

---

### Epic 2: Zero-to-Operational Onboarding (`tmr init` Rework)
A new engineering manager runs `tmr init`, answers a single guided session of prompts, and arrives at a fully populated vault — their profile, their leader, their teams and team members, sample inbox notes, two installed skills (`tmr-inbox` and `tmr-project-impact`), and a `CLAUDE.md` with a dependency-tracking hook — without reading docs or running any additional commands. Adding a project via `tmr project add` automatically scaffolds a `deps.yaml` ready for dependency tracking.

**FRs covered:** FR1–FR14, FR30, FR35, FR36, FR37

**TEA quality gates:** INIT-INT-001 (happy path), INIT-INT-002 (CWD default), INIT-INT-004/005/006/007 (validation rejections), INIT-INT-009 (team name normalization), INIT-INT-010 (skill install resilience), INIT-INT-010b (`tmr-project-impact` install resilience), INIT-INT-011 (partial write failure → stderr), INIT-INT-012 (README exists), INIT-INT-013 (wiki-link format), INIT-UNIT-008 (CLAUDE.md contains project impact hook), PROJ-UNIT-001 (deps.yaml scaffolded by `tmr project add`)

**Test infrastructure prerequisite:** `tests/fixtures/init-prompts.ts` (`initPromptFixture` helper) must be created in this epic before integration tests are written.

---

### Epic 3: Flexible Team & Member Management
Engineering managers can add members to the right scope (team or company) automatically, include a location, log feedback with auto-create for unknown emails, and have all file routing happen based on context — not manual directory selection.

**FRs covered:** FR15–FR24

**TEA quality gates:** TEAM-UNIT-001/002/003, TEAM-INT-001/002, MEM-UNIT-001/002/003/004/008/009/010/011, MEM-INT-001/002/003/004/005

**Test infrastructure prerequisite:** `tests/fixtures/member-profiles.ts` (member data builders) must be created in this epic.

---

### Epic 4: Skill Ecosystem Access (`tmr install`)
Engineering managers can install the full official skills library with one command, or install a specific skill by name. Registry failures always surface a clear error and a non-zero exit code — no silent failures.

**FRs covered:** FR25–FR27

**TEA quality gates:** SKILL-CMD-001, SKILL-UNIT-002/003/004/005, SKILL-INT-001, NFR-EXIT-001

---

### Epic 5: Open Source Community Readiness
External contributors can set up the project locally, understand all coding conventions, run the test suite, submit PRs, and contribute skills to the official registry — all guided by a single `CONTRIBUTING.md`.

**FRs covered:** FR34

---

## Epic 1: Shared Input Contracts, Utilities & Relationship Removal

Engineers and downstream epics can rely on consistent, shared building blocks for validation, normalization, and wiki-link generation. The deprecated `tmr relationship` command is fully removed from the CLI, help text, and codebase.

### Story 1.1: Email Validation Utility

As a developer implementing any `tmr` command,
I want a standalone `validateEmail()` utility that throws `InvalidEmailError` before any file system operation,
So that invalid email inputs are consistently rejected across all commands without duplicating validation logic.

**Acceptance Criteria:**

**Given** `src/utils/validation.ts` exports `validateEmail(email: string): void`
**When** called with a valid email such as `"marco@company.com"`
**Then** the function returns without throwing

**Given** `validateEmail` is called with `"marco@"` (missing domain)
**When** the function evaluates the input
**Then** it throws `InvalidEmailError` with error code `TMR_E103`
**And** no file system operation has been attempted

**Given** `validateEmail` is called with `"not-an-email"` (no `@` symbol)
**When** the function evaluates the input
**Then** it throws `InvalidEmailError` with error code `TMR_E103`

**Given** `validateEmail` is called with `""` (empty string)
**When** the function evaluates the input
**Then** it throws `InvalidEmailError` with error code `TMR_E103`

**Given** `EmailResolutionService` needs to validate an email
**When** its `validateEmail` method is called
**Then** it delegates to the utility in `src/utils/validation.ts` rather than containing its own regex

**Given** `tests/utils/validation.test.ts` exists
**When** the test suite runs
**Then** VAL-UNIT-001 (`"marco@"` rejected), VAL-UNIT-002 (`"valid@company.com"` passes), and VAL-UNIT-003 (`"not-an-email"` rejected) all pass

**Given** `AppConfig.provider` and `AppConfig.apiKey` are deprecated fields in the codebase (ARCH-DEBT-001)
**When** this story is implemented
**Then** both deprecated fields are removed from the `AppConfig` type definition
**And** a test in `tests/services/config.service.test.ts` asserts that no source file under `src/` references `AppConfig.provider` or `AppConfig.apiKey`

---

### Story 1.2: Entity Slug Normalization Utility

As a developer implementing commands that accept team names or project names,
I want a standalone `normalizeSlug()` utility that converts any entity name to lowercase/kebab-case,
So that teams, projects, and any other named entities are stored consistently regardless of how the user types them.

**Acceptance Criteria:**

**Given** `src/utils/normalization.ts` exports `normalizeSlug(name: string): string`
**When** called with `"Backend Team"` (mixed case, space-separated)
**Then** it returns `"backend-team"`

**Given** `normalizeSlug` is called with `"FRONTEND"`
**When** the function evaluates the input
**Then** it returns `"frontend"`

**Given** `normalizeSlug` is called with `"my-team"` (already normalized)
**When** the function evaluates the input
**Then** it returns `"my-team"` (idempotent)

**Given** `normalizeSlug` is called with `"Data_Science Team"` (underscore + space)
**When** the function evaluates the input
**Then** it returns `"data-science-team"`

**Given** `tests/utils/normalization.test.ts` exists
**When** the test suite runs
**Then** VAL-UNIT-004 (`"Backend Team"` → `"backend-team"`), VAL-UNIT-005 (`"FRONTEND"` → `"frontend"`), and VAL-UNIT-006 (`"my-team"` idempotent) all pass

**Given** the utility is used in team and project contexts
**When** a team name or project slug is accepted as input
**Then** `normalizeSlug()` is called before any file system path construction or comparison

---

### Story 1.3: File-Anchored Wiki-Link Utility

As a developer implementing any service that writes Markdown referencing people, teams, or leaders,
I want a standalone `formatWikiLink()` utility that produces a properly formed Obsidian wiki-link anchored to a specific file,
So that all entity references across the codebase use one consistent format and the existing duplicated inline implementations are superseded.

**Acceptance Criteria:**

**Given** `src/utils/wiki-link.ts` exports `formatWikiLink(resolvedPath: string, fromPath: string, displayName: string): string`
**When** called with a resolved entity file path, the file being written to, and a display name
**Then** it returns `[[relative/path/to/file.md|displayName]]` with `/` as the path separator on all platforms

**Given** `formatWikiLink` is called where `resolvedPath` and `fromPath` are in the same directory
**When** the relative path is computed
**Then** the result uses the filename only (e.g. `[[email@co.com.md|email@co.com]]`)

**Given** `formatWikiLink` is called with a display name of `"joao@company.com"`
**When** the function produces its output
**Then** the result is `[[relative/path/joao@company.com.md|joao@company.com]]`

**Given** `EmailResolutionService.generateWikiLink()` still exists at this story's completion
**When** a code review is performed
**Then** all new service code written in Epics 2 and 3 uses `formatWikiLink()` from `src/utils/wiki-link.ts`
**And** `EmailResolutionService.generateWikiLink()` is marked `@deprecated` with a JSDoc comment pointing to the new utility

**Given** `tests/utils/wiki-link.test.ts` exists
**When** the test suite runs
**Then** VAL-UNIT-007 (`formatWikiLink` returns correct `[[path|name]]` format) passes

---

### Story 1.4: Remove `tmr relationship` Command

As a `tmr` user,
I want `tmr relationship` to be completely absent from the CLI — no help entry, no registered command, no source files,
So that the command vocabulary is clean and the codebase contains no dead code referencing a removed feature.

**Acceptance Criteria:**

**Given** `src/commands/relationship.command.ts` exists before this story
**When** this story is implemented
**Then** the file is deleted and `src/cli.ts` no longer imports or registers it

**Given** `src/services/relationship.service.ts` exists before this story
**When** this story is implemented
**Then** the file is deleted and no remaining source file imports from it

**Given** `EmailResolutionService._doResolve()` uses `RelationshipService` for its auto-create fallback (step 4)
**When** `RelationshipService` is removed
**Then** the fallback is re-routed to write a company-scoped member profile directly to `my-company/members/<email>/` without depending on the deleted service

**Given** `tmr --help` is run after this story is implemented
**When** the help output is inspected
**Then** the word "relationship" does not appear anywhere in the output (REL-NEG-001)

**Given** `tmr relationship` is invoked directly
**When** Commander.js processes the command
**Then** it produces an "unrecognized command" error (REL-NEG-002)

**Given** the three relationship test files exist before this story
**When** this story is implemented
**Then** `tests/commands/relationship.command.test.ts`, `tests/services/relationship.service.test.ts`, and `tests/integration/relationship.integration.test.ts` are all deleted (REL-NEG-003/004)

**Given** `tests/cli.test.ts` exists
**When** this story is implemented
**Then** a new test asserts `tmr --help` output does not contain the string `"relationship"`

**Given** `TeamService` and `MemberService` are exercised in their existing tests
**When** the test suite runs after relationship removal
**Then** all existing team and member tests continue to pass with no regressions (REL-NEG-005)

**Given** `docs/architecture.md` references `relationship` in the lazy loading table
**When** this story is implemented
**Then** `docs/architecture.md` is updated to remove `relationship` from the static import list

> **Implementation note — auto-create fallback (ISSUE-m1):** The AC above re-routes `EmailResolutionService._doResolve()` auto-create to write directly to `my-company/members/<email>/` without `RelationshipService`. This inline write logic is intentionally temporary — it is a minimal shim to keep the resolver functional until Story 3.2 implements `MemberService.addMember()`. When Story 3.2 is implemented, `_doResolve()` MUST be refactored to call `MemberService.addMember(email)` instead of the inline write. The inline logic must not become permanent.

---

## Epic 2: Zero-to-Operational Onboarding (`tmr init` Rework)

A new engineering manager runs `tmr init`, answers a single guided session of prompts, and arrives at a fully populated vault — their profile, their leader, their teams and team members, sample inbox notes, and an installed skill — without reading docs or running any additional commands.

### Story 2.1: Vault Scaffold & Folder Structure

As a new `tmr` user running `tmr init` for the first time,
I want the CLI to create the complete vault folder structure at my chosen path,
So that all required directories exist and the vault is ready to be populated by subsequent init steps.

**Acceptance Criteria:**

**Given** the user runs `tmr init` and provides a vault path (or accepts the CWD default)
**When** `InitService` executes the scaffold step
**Then** the following directories are created: `inbox/`, `archive/`, `my-tasks/`, `my-teams/members/`, `my-teams/teams/`, `my-company/members/`, `my-company/projects/`, `my-leadership/`, `my-career/`, `knowledge-base/`, `.claude/skills/`, `.cursor/rules/tmr/`

**Given** the user submits an empty vault path input
**When** `InitService` resolves the path
**Then** the current working directory (`process.cwd()`) is used as the vault root (INIT-INT-002)

**Given** `InitService` creates the folder structure
**When** the scaffold completes
**Then** `/utils` and `/my-teams/feedback-templates` are NOT created (INIT-UNIT-001)

**Given** `InitService` creates the folder structure
**When** the scaffold completes
**Then** a `CLAUDE.md` file is written to the vault root (INIT-UNIT-007)

**Given** the `CLAUDE.md` is written to the vault root
**When** its content is inspected
**Then** it includes an instruction to AI agents: "Whenever any file changes inside `my-company/projects/`, run `/tmr-project-impact` to check for dependent document updates. Use `/tmr-project-impact <project-path> deps` to set up a project's dependency manifest for the first time." (FR36, INIT-UNIT-008)

**Given** a file system write error occurs during scaffolding
**When** the error is caught
**Then** `printError` is called with a descriptive message to `process.stderr` and the process does not exit silently (NFR1, INIT-INT-011)

**Given** `tests/services/init.service.test.ts` exercises `InitService`
**When** the unit tests run
**Then** INIT-UNIT-001 (folder structure correct) passes

**Given** any unexpected runtime error occurs during `InitService` execution
**When** the error propagates
**Then** it is caught by the command layer, surfaced via `printError` to `process.stderr`, and no stack trace is visible to the user (NFR2)

---

### Story 2.2: User Profile, Leader & Team Structure Prompts

As a new `tmr` user in the `tmr init` flow,
I want to provide my own identity, my leader's details, and my team names through guided prompts,
So that my profile, my leader's profile, and team folder entries are created automatically without me running separate commands.

**Acceptance Criteria:**

**Given** the vault scaffold from Story 2.1 exists
**When** `InitService` prompts for user email, name, and role
**Then** a profile file is written to `my-career/<email>.md` with correct frontmatter (INIT-UNIT-004)

**Given** `InitService` prompts for leader name, role, and email
**When** the leader details are submitted
**Then** a profile file is written to `my-leadership/<email>.md` with correct frontmatter (INIT-UNIT-005)

**Given** `InitService` prompts for team count
**When** the user enters `0`
**Then** the input is rejected with a descriptive `ValidationError` and re-prompted before any file is written (INIT-INT-004, FR30)

**Given** `InitService` prompts for team count
**When** the user enters a positive integer (e.g. `2`)
**Then** the system iterates that many times to collect team names

**Given** `InitService` collects a team name
**When** the user enters `"Backend Team"` (capitals, space)
**Then** `normalizeSlug()` converts it to `"backend-team"` silently before any file path is constructed (INIT-INT-009)

**Given** an invalid email is entered for the user profile or leader
**When** `validateEmail()` is called
**Then** the input is rejected with `InvalidEmailError` and the prompt re-displays without losing any previously entered data (INIT-INT-005, INIT-INT-006)

**Given** `tests/fixtures/init-prompts.ts` does not yet exist
**When** this story is implemented
**Then** `tests/fixtures/init-prompts.ts` is created with an `initPromptFixture(scenario)` helper that returns pre-wired `inquirer` mock sequences for: happy path, email error recovery, and zero-team-count rejection (R-005 mitigation, TEA-INFRA-001)

**Given** `tests/integration/init.integration.test.ts` exercises the profile + leader + team flow
**When** the integration tests run using `initPromptFixture`
**Then** INIT-INT-002 (CWD default), INIT-INT-004 (team count 0 rejected), INIT-INT-005 (invalid profile email rejected), INIT-INT-006 (invalid leader email rejected), INIT-INT-009 (team name normalized) all pass

**Given** any prompt step in the init flow triggers an async operation (e.g. file write, service call)
**When** the operation begins
**Then** an `ora` spinner is shown within 100ms of the operation starting and dismissed when it resolves (NFR4)

---

### Story 2.3: Team Member Collection Loop

As a new `tmr` user setting up teams during `tmr init`,
I want to add members to each team through a per-member prompt loop that validates email and ends on empty input,
So that all team member files are created with the correct scope, frontmatter, and wiki-link references in one init session.

**Acceptance Criteria:**

**Given** `InitService` has collected team names from Story 2.2
**When** the member collection loop runs for each team
**Then** the user is prompted for: email, name, role, gender, and location for each member

**Given** the user submits a valid member email, name, role, gender, and location
**When** `InitService` writes the member file
**Then** the file is created at `my-teams/members/<email>.md` with all five fields in the frontmatter including `location`

**Given** the user enters an invalid email for a team member
**When** `validateEmail()` is called
**Then** the input is rejected and the email prompt re-displays without losing the team or any previously added members (INIT-INT-007)

**Given** the user submits an empty string as the member email
**When** `InitService` evaluates the input
**Then** the member-add loop for that team ends and the flow moves to the next team (FR9, INIT-INT-008)

**Given** member files are written during the loop
**When** entity references to the manager or team are generated
**Then** all references use `formatWikiLink()` from `src/utils/wiki-link.ts` — no plain email strings in Markdown (FR33, INIT-INT-013)

**Given** `tests/integration/init.integration.test.ts` exercises the member loop
**When** the integration tests run
**Then** INIT-INT-003 (2 teams, members per team → all files created), INIT-INT-007 (invalid member email rejected), INIT-INT-008 (empty email ends loop), INIT-INT-013 (wiki-link format) all pass

**Given** any per-member file write during the member collection loop takes longer than expected
**When** the write begins
**Then** an `ora` spinner is visible to the user during the operation (NFR4)

---

### Story 2.4: Sample Files, Skill Install, README & Post-Init Summary

As a new `tmr` user completing `tmr init`,
I want sample inbox notes copied to my vault, the `tmr-inbox` skill installed silently, a `README.md` generated in the vault root, and a next-steps summary printed to the terminal,
So that my vault is immediately useful and I know exactly what to do next — even if I've never used `tmr` before.

**Acceptance Criteria:**

**Given** `InitService` reaches the post-member-collection phase
**When** sample inbox notes are copied
**Then** bundled sample files are written to the vault's `inbox/` folder (FR11, INIT-UNIT-003)

**Given** `InitService` installs `tmr-inbox` via `SkillRegistryService`
**When** the network call fails (timeout, 404, or any error)
**Then** the error is logged but onboarding continues — a skill install failure does NOT abort `tmr init` (FR10, NFR1, INIT-INT-010)

**Given** `InitService` installs `tmr-project-impact` via `SkillRegistryService` immediately after `tmr-inbox`
**When** the network call succeeds
**Then** the skill files are written to `<workspace>/.claude/skills/tmr-project-impact/` (FR35)

**Given** `InitService` installs `tmr-project-impact` via `SkillRegistryService`
**When** the network call fails (timeout, 404, or any error)
**Then** the error is logged but onboarding continues — failure does NOT abort `tmr init` (FR35, INIT-INT-010b)

**Given** `tests/integration/init.integration.test.ts` mocks both skill installs (one succeeds, one fails)
**When** the integration test runs
**Then** INIT-INT-010b passes: onboarding completes regardless of `tmr-project-impact` install outcome

**Given** `InitService` reaches the README generation step
**When** `InitService` writes the README
**Then** `README.md` exists in the vault root with content covering the most-used commands and a full command reference (FR12, INIT-UNIT-002, INIT-INT-012)

**Given** `InitService` completes all steps
**When** the post-init summary is printed
**Then** `printInfo` outputs a next-steps message directing the user to `tmr project add` and `/tmr-inbox`; and informing them that once projects are added, `/tmr-project-impact <project-path> deps` can be run at any time to set up dependency tracking (FR13, INIT-UNIT-006)

**Given** `InitService` completes all steps
**When** the post-init summary is printed
**Then** guidance to open Obsidian and enable required plugins is included in the output (FR14)

**Given** a `FileSystemService.writeFile` call throws mid-flow (any step after scaffold)
**When** the error is caught
**Then** `printError` is called to `process.stderr` with a recovery message and no partial output files remain silently incomplete (NFR1, R-001, INIT-INT-011)

**Given** `tests/integration/init.integration.test.ts` exercises the full happy-path flow
**When** the integration test runs using `initPromptFixture('happy-path')`
**Then** INIT-INT-001 (full happy path: 1 team + 2 members → all correct files) passes

---

### Story 2.5: `tmr project add` — Scaffold `deps.yaml` for Dependency Tracking

As a `tmr` user who just created a project via `tmr project add`,
I want a stub `deps.yaml` automatically created in the project folder,
So that I can run `/tmr-project-impact <project-path> deps` at any time to set up dependency tracking without any manual file creation.

**Acceptance Criteria:**

**Given** `tmr project add <name>` is run
**When** the project directory is created at `my-company/projects/<name>/`
**Then** a stub `deps.yaml` is written to `my-company/projects/<name>/deps.yaml` with the standard header comment and an empty `sources: {}` block (FR37, PROJ-UNIT-001)

**Given** the stub `deps.yaml` is written
**When** its content is inspected
**Then** it contains the header comment block explaining its purpose and how to populate it (`/tmr-project-impact <project-path> deps`), and a valid empty `sources: {}` block ready for the interactive tool to populate

**Given** `tests/commands/project.command.test.ts` (or equivalent) exercises `tmr project add`
**When** the unit test runs
**Then** PROJ-UNIT-001 passes: `deps.yaml` exists in the scaffolded project folder with the correct header and empty sources block

**Given** any unexpected runtime error occurs during `deps.yaml` creation
**When** the error propagates
**Then** it is caught, surfaced via `printError` to `process.stderr`, and no stack trace is visible to the user (NFR2)

---

## Epic 3: Flexible Team & Member Management

Engineering managers can add members to the right scope (team or company) automatically, include a location, log feedback with auto-create for unknown emails, and have all file routing happen based on context — not manual directory selection.

### Story 3.1: Team Create & Add with Normalization and Email Validation

As an engineering manager using `tmr team` commands,
I want team names automatically normalized to lowercase/kebab-case and email inputs validated before any file is written,
So that team data is stored consistently regardless of how I type the name, and invalid emails never corrupt the workspace.

**Acceptance Criteria:**

**Given** `tmr team create "Backend Team"` is run
**When** `TeamService.createTeam()` processes the name
**Then** `normalizeSlug("Backend Team")` is called and the team is created with slug `"backend-team"` (TEAM-UNIT-001)

**Given** `tmr team create "FRONTEND"` is run
**When** `TeamService.createTeam()` processes the name
**Then** the team is created with slug `"frontend"` (TEAM-UNIT-002)

**Given** `tmr team add my-team "not-an-email"` is run
**When** `TeamService.addMember()` validates the email
**Then** `validateEmail()` throws `InvalidEmailError` (TMR_E103) before any file write (TEAM-UNIT-003)

**Given** `tmr team add my-team "valid@company.com"` is run
**When** `TeamService.addMember()` processes the request
**Then** the member reference is written to the correct team file path (TEAM-UNIT-004)

**Given** `tmr team create "My Team"` is run as an integration test against a temp vault
**When** the command completes
**Then** the team folder and team file exist under the slug `"my-team"` (TEAM-INT-001)

**Given** `tmr team add my-team "bad-email"` is run as an integration test
**When** the command processes the email
**Then** `printError` is called to stderr and no file is written (TEAM-INT-002)

---

### Story 3.2: Company-Scoped vs Team-Scoped Member Routing

As an engineering manager adding people to my workspace,
I want `tmr member add <email>` to route to company scope and `tmr member add <email> --team <name>` to route to team scope with an automatic manager link,
So that the correct file path and frontmatter are produced based solely on context — I never choose a directory manually.

**Acceptance Criteria:**

**Given** `tmr member add joao@company.com` is run (no `--team` flag)
**When** `MemberService.addMember()` processes the request
**Then** the profile is written to `my-company/members/joao@company.com.md` (MEM-UNIT-001, MEM-INT-001)

**Given** `tmr member add joao@company.com --team backend` is run
**When** `MemberService.addMember()` processes the request
**Then** the profile is written to `my-teams/members/joao@company.com.md` (MEM-UNIT-002, MEM-INT-002)

**Given** a team-scoped member file is written
**When** the frontmatter is inspected
**Then** it contains `manager: <formatWikiLink to my-career/<current-user-email>.md>` resolved from the current user's career profile (FR20, MEM-UNIT-003)

**Given** either a company-scoped or team-scoped member is created with a `--location` value
**When** the profile file is written
**Then** the `location` field is present in the frontmatter with the provided value (FR21, MEM-UNIT-004)

**Given** a member is created without providing a location
**When** the profile file is written
**Then** the `location` field is present in the frontmatter as an empty string (MEM-UNIT-005)

**Given** any member profile references a manager or team entity
**When** the Markdown is written
**Then** entity references use `formatWikiLink()` — no plain email strings (FR33, MEM-UNIT-010, MEM-UNIT-011)

**Given** `tmr member add "not-an-email"` is run
**When** `MemberService.addMember()` validates the email
**Then** `validateEmail()` throws `InvalidEmailError` (TMR_E103) before any file write (MEM-UNIT-009)

**Given** a member profile file write is performed during integration tests
**When** the write completes
**Then** the elapsed time is less than 500ms under normal local I/O conditions (NFR5)

**Given** `tests/fixtures/member-profiles.ts` does not yet exist
**When** this story is implemented
**Then** `tests/fixtures/member-profiles.ts` is created with reusable member data builders covering email, team, and location variants (TEA-INFRA-002)

**Given** any unexpected runtime error occurs during `MemberService` execution
**When** the error propagates
**Then** it is caught by the command layer, surfaced via `printError` to `process.stderr`, and no stack trace is visible to the user (NFR2)

---

### Story 3.3: Member Feedback with Global Email Resolver & Auto-Create

> **Implementation order:** This story MUST be implemented after Story 3.2. The auto-create path (FR24) calls `MemberService.addMember(email)` without `--team` to write the company-scoped profile — it must not duplicate that write logic inline. (ISSUE-m2)

As an engineering manager logging feedback for a team member,
I want `tmr member add feedback <email>` to find the correct member file automatically across all scopes and auto-create a company-scoped profile if the email is unknown,
So that feedback is always routed to the right person without me knowing or caring which directory they live in.

**Acceptance Criteria:**

**Given** `tmr member add feedback joao@company.com` is run and the email exists in `my-teams/members/`
**When** the global email resolver runs
**Then** the feedback is appended to the team-scoped member file (MEM-UNIT-006, MEM-INT-003)

**Given** `tmr member add feedback pedro@company.com` is run and the email exists only in `my-company/members/`
**When** the global email resolver runs
**Then** the feedback is appended to the company-scoped member file (MEM-UNIT-007)

**Given** `tmr member add feedback unknown@company.com` is run and no file exists in either directory
**When** the global email resolver finds no match
**Then** a new company-scoped profile is auto-created at `my-company/members/unknown@company.com.md` and the feedback is written to it (FR24, MEM-UNIT-008, MEM-INT-004)

**Given** the global email resolver is looking up `"Joao@Company.com"` (mixed case)
**When** the resolver searches the member directories
**Then** it matches `"joao@company.com"` (case-insensitive lookup) and does not create a duplicate profile (R-008, MEM-INT-005)

**Given** `tests/integration/member.integration.test.ts` exercises the full feedback flow
**When** the integration tests run
**Then** MEM-INT-001 (company routing), MEM-INT-002 (team routing + manager link), MEM-INT-003 (feedback on existing), MEM-INT-004 (feedback auto-create), MEM-INT-005 (case-insensitive lookup) all pass

---

## Epic 4: Skill Ecosystem Access (`tmr install`)

Engineering managers can install the full official skills library with one command, or install a specific skill by name. Registry failures always surface a clear error and a non-zero exit code — no silent failures.

### Story 4.1: `tmr install` — Skill Registry Integration

As an engineering manager who wants to extend `tmr` with skills,
I want `tmr install` to fetch and install all available skills, and `tmr install <skill-name>` to install a specific one, with all failures surfaced clearly,
So that I can access the full skills ecosystem in one command and never wonder why a skill silently failed to install.

**Acceptance Criteria:**

**Given** `tmr install` is run with a healthy registry connection
**When** `SkillRegistryService` fetches the skill list
**Then** each skill's `SKILL.md` is written to `<workspace>/.claude/skills/<name>/SKILL.md` and the manifest at `.claude/skills/skill-manifest.json` is updated (FR25, SKILL-UNIT-005, SKILL-INT-001)

**Given** `tmr install <skill-name>` is run with a valid skill name
**When** `SkillRegistryService.fetchSkillContent(name)` is called
**Then** the HTTPS GET is made to the correct GitHub raw URL and the skill file is written to the correct vault path (FR26, SKILL-UNIT-001)
**And** `printSuccess` confirms the installed skill name (SKILL-CMD-002)

**Given** the registry URL is configured in `SkillRegistryService`
**When** any code references the registry endpoint
**Then** no hardcoded URL string exists in command or service files — the URL is read from `SkillRegistryService` configuration only (FR27, NFR7)

**Given** `SkillRegistryService` makes a network call that times out after 10 seconds
**When** the timeout is reached
**Then** a descriptive error is thrown without the process hanging indefinitely (SKILL-UNIT-002)

**Given** `SkillRegistryService` receives a 404 response for a specific skill name
**When** the error is handled
**Then** the error message includes the skill name that was not found (SKILL-UNIT-003)

**Given** `SkillRegistryService` receives a malformed (non-JSON or truncated) response body
**When** the response is parsed
**Then** a descriptive error is thrown without crashing the process (SKILL-UNIT-004)

**Given** any registry failure occurs during `tmr install`
**When** the `install` command catches the error
**Then** `printError` is called to `process.stderr` and `process.exitCode` is set to a non-zero value (FR, NFR6, SKILL-CMD-001, NFR-EXIT-001)

**Given** `tests/commands/install.command.test.ts` is modified
**When** the test suite runs
**Then** `node:https` is mocked via `jest.unstable_mockModule` — no real network calls are made in any install test (TC-002 mitigation)

**Given** `tests/integration/install-update.integration.test.ts` exercises failure paths
**When** the integration tests run
**Then** timeout, 404, and malformed-JSON scenarios all produce `printError` output and non-zero exit code (NFR-EXIT-001)

**Given** any unexpected runtime error occurs during `SkillRegistryService` or the install command execution
**When** the error propagates
**Then** it is caught by the command layer, surfaced via `printError` to `process.stderr`, and no stack trace is visible to the user (NFR2)

---

## Epic 5: Open Source Community Readiness

External contributors can set up the project locally, understand all coding conventions, run the test suite, submit PRs, and contribute skills to the official registry — all guided by a single `CONTRIBUTING.md`.

### Story 5.1: CONTRIBUTING.md for Open Source Contributors

As an external developer who wants to contribute to `tech-manager-os`,
I want a `CONTRIBUTING.md` in the repository root that covers everything I need to set up, build, test, and submit changes,
So that I can contribute code, documentation, or skills without asking the maintainer for guidance.

**Acceptance Criteria:**

**Given** `CONTRIBUTING.md` does not exist in the repository root
**When** this story is implemented
**Then** `CONTRIBUTING.md` is created at the repository root (FR34)

**Given** a contributor clones the repo and opens `CONTRIBUTING.md`
**When** they follow the development setup section
**Then** they can install dependencies, build the project (`npm run validate`), and run tests without additional guidance

**Given** `CONTRIBUTING.md` covers coding conventions
**When** a contributor reads the conventions section
**Then** it explicitly documents: ESM `.js` import extensions, use of `display.ts` helpers (no `console.log`), `strict: true` TypeScript rules, and the `no-explicit-any` zero-tolerance rule

**Given** `CONTRIBUTING.md` covers the test process
**When** a contributor reads the testing section
**Then** it documents: `NODE_OPTIONS=--experimental-vm-modules jest` requirement, coverage thresholds (78% lines/functions/statements, 60% branches), and `MockProvider` usage for AI calls

**Given** `CONTRIBUTING.md` covers the PR process
**When** a contributor reads the PR section
**Then** it documents the branching strategy, `npm run validate` as a pre-PR gate, and PR description expectations

**Given** `CONTRIBUTING.md` covers skill submission
**When** a contributor reads the skills section
**Then** it documents the official skill registry structure, `SKILL.md` format requirements, and the submission process for community skills
