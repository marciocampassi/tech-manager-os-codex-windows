# Epic 4: Skills-Based Architecture Pivot

> **Note:** This file replaces `epic-4-people-management-agent-system.md`, which was removed as part of the April 2026 course correction. See [`docs/ARCHITECTURE-PIVOT-2026-04.md`](../../ARCHITECTURE-PIVOT-2026-04.md) for full context.

**Expanded Goal:** Re-align the product to its proven architecture. `tmr init` scaffolds the full vault structure per TECH-MANAGER-OS-TEMPLATE and generates a `CLAUDE.md` context file. All CLI routing paths are corrected to match the template and Epic 3 is retested end-to-end. `tmr-inbox` is generalized into a distributable Claude Code skill with no hardcoded user values. A skill install/update mechanism (`tmr install` / `tmr update`) lets users receive new skills over time.

---

## Story 4.1: Pivot `tmr init` — Vault Scaffolding + CLAUDE.md Generation

**As a** new leader,
**I want** `tmr init` to scaffold my full vault and generate a `CLAUDE.md` file,
**so that** I can start using the system with Claude Code immediately without manual setup.

**Acceptance Criteria:**

1. `tmr init` runs a minimal interactive onboarding collecting: name, email, role, company/domain (4 questions only)
2. Scaffolds complete directory structure per TECH-MANAGER-OS-TEMPLATE:
   - `inbox/`, `archive/`, `config/`, `knowledge-base/`
   - `my-career/assessments/`, `my-career/feedbacks/`
   - `my-company/members/`, `my-company/meetings/`, `my-company/projects/`
   - `my-leadership/`
   - `my-tasks/` with `tasks.md`, `today.md`, `this-week.md`, `this-month.md`, `this-quarter.md`
   - `my-teams/members/`, `my-teams/teams/`, `my-teams/feedback-templates/`
   - `.claude/skills/`, `.obsidian/`
   - `knowledge-base/branding-guidelines/`, `knowledge-base/company/`, `knowledge-base/people/`, `knowledge-base/process/`, `knowledge-base/security/`
3. Generates `CLAUDE.md` at vault root containing:
   - Identity block (name, email, role, company) from onboarding responses
   - Folder structure reference section describing each top-level folder's purpose
   - Communication style section with labeled placeholder content (user fills in later)
   - Pointer to `my-company/` for deeper company and team context
4. All created folders and files follow TECH-MANAGER-OS-TEMPLATE naming conventions:
   - Lowercase kebab-case for all folder and file names
   - Email addresses used verbatim as identifiers (not normalized)
   - ISO 8601 dates (`YYYY-MM-DD`) for all time-bound filenames
5. Does NOT collect or prompt for API keys — directs user to `tmr config` if asked
6. Displays a clear "next steps" summary on completion pointing to `tmr config` and `tmr install tmr-inbox`
7. Integration test validates: all directories exist, `CLAUDE.md` contains identity block, no API key prompts

---

## Story 4.2: Folder Structure Alignment + Epic 3 Path Correction & Retest

**As a** developer,
**I want** all CLI commands to use the TECH-MANAGER-OS-TEMPLATE folder paths,
**so that** the CLI and the vault structure are consistent and `tmr process` works correctly.

**Acceptance Criteria:**

1. Audit all CLI commands across Epics 1–3 for references to old PRD paths and replace:

   | Old path | Correct path |
   |---|---|
   | `my-teams/{team}/{email}/` | `my-teams/members/{email}/` |
   | `my-teams/_members/{email}/` | `my-teams/members/{email}/` |
   | `my-teams/_teams/{team}/` | `my-teams/teams/{team}/` |
   | `my-projects/{project}/` | `my-company/projects/{project}/` |
   | `my-company/relationships/{email}/` | `my-company/members/{email}/` |
   | `operations/hiring/` | Removed from routing |
   | `feedback/` (subdirectory) | `feedbacks/` |

2. `tmr process` routing engine updated to write to corrected paths
3. Epic 3 retested end-to-end against a vault scaffolded by the new `tmr init`:
   - Inbox scanner picks up `.md` files
   - AI categorization returns correct destinations using new paths
   - Files move to the right folders
   - Context updates write to correct paths
   - Task extraction appends to `my-tasks/tasks.md`
4. All existing unit tests updated to assert against new paths
5. Integration test runs the full `tmr process` flow on a freshly scaffolded vault

---

## Story 4.3: `tmr config` First-Run Check in `tmr process`

**As a** user running `tmr process` for the first time without an API key,
**I want** a clear message telling me what to do,
**so that** I know exactly how to fix the problem before retrying.

**Acceptance Criteria:**

1. Before executing any AI call, `tmr process` checks whether an API key is stored in config
2. If no key is found, command exits early with a clear, friendly message:
   - States that `tmr process` requires an AI API key
   - Instructs user to run `tmr config` to set it up
   - Does NOT prompt for or collect the key inline
   - Exit code indicates configuration error (not runtime error)
3. If a key is found, proceeds normally
4. `tmr config` remains the sole dedicated command for API key collection — no changes to its implementation
5. Unit test covers: no-key detection, message text, correct exit code

---

## Story 4.4: Generalize `tmr-inbox` Skill

**As a** leader who installs the `tmr-inbox` skill,
**I want** the skill to work from my `CLAUDE.md` without any hardcoded values,
**so that** any leader can install and use it for their own vault out of the box.

**Acceptance Criteria:**

1. All hardcoded user-specific values removed from `SKILL.md`:
   - Vault owner email sourced from `CLAUDE.md` identity block (not hardcoded)
   - Folder paths sourced from `CLAUDE.md` folder structure section
   - Domain inference uses the vault owner's email domain from `CLAUDE.md`
2. `SKILL.md` includes a clear "Prerequisites" section stating:
   - `CLAUDE.md` must be present and populated (via `tmr init`) before running the skill
   - Obsidian Dataview plugin required for task views (run `/tmr-inbox setup` first)
3. Skill authored in this repo at `skills/tmr-inbox/SKILL.md` — no user-specific content anywhere in the file
4. Skill tested against a vault with a freshly generated `CLAUDE.md` from Story 4.1:
   - Classifies inbox files correctly (1:1, project, company, ambiguous)
   - Scaffolds missing profiles under `my-teams/members/`, `my-leadership/`, `my-company/members/`
   - Renames files to canonical pattern using template paths
   - Extracts tasks to `my-tasks/tasks.md`
5. The `/tmr-inbox setup` subcommand creates `my-tasks/tasks.md` and all four Dataview view files if missing

---

## Story 4.5: Skill Install/Update Mechanism

**As a** leader,
**I want** to install and update skills from the CLI,
**so that** I receive new capabilities without manually copying files.

**Acceptance Criteria:**

1. `tmr install <skill-name>` command:
   - Downloads the named skill from the official registry (GitHub releases or npm package assets)
   - Installs it into `.claude/skills/<skill-name>/SKILL.md` in the current vault directory
   - Displays a confirmation with the installed skill name and version
   - Error handling covers: skill not found, network failure, already installed (offers to update instead)
2. `tmr update` command:
   - Scans `.claude/skills/` to detect all installed skills
   - Checks for newer versions in the registry
   - Updates all skills that have newer versions available
   - Reports per skill: updated to vX.Y or already up to date
3. `tmr install tmr-inbox` works as the canonical first-use case
4. Skills are installed without any user-specific values — the skill reads from `CLAUDE.md` at runtime
5. Unit tests cover: install happy path, already-installed detection, update detection, no-skills-installed case

---
