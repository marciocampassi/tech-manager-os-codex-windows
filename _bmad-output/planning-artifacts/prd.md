---
stepsCompleted: ['step-01-init', 'step-02-discovery', 'step-02b-vision', 'step-02c-executive-summary', 'step-03-success', 'step-04-journeys', 'step-05-domain', 'step-06-innovation', 'step-07-project-type', 'step-08-scoping', 'step-09-functional', 'step-10-nonfunctional', 'step-11-polish', 'step-12-complete']
status: complete
completedAt: '2026-04-27'
releaseMode: single-release
classification:
  projectType: cli_tool
  domain: developer_productivity
  complexity: medium
  projectContext: brownfield
inputDocuments: []
workflowType: 'prd'
projectDocsCount: 5
---

# Product Requirements Document - tech-manager-os

**Author:** Marlon
**Date:** 2026-04-27

## Executive Summary

`tech-manager-os` (`tmr`) is a local-first CLI operating system for engineering managers. It scaffolds a structured Obsidian vault, processes meeting notes through an AI pipeline, and manages team/member/project metadata as plain Markdown files — no cloud backend, no database, no vendor lock-in.

This PRD addresses a critical gap identified through real-world usage: `tmr init` scaffolds folders but leaves the vault empty and non-functional until the user discovers and manually runs 5–10 additional commands. As `tmr` moves from personal tool to distributable product, first-contact experience becomes a first-class requirement.

The scope covers four areas: a complete rework of `tmr init` onboarding, removal of the `tmr relationship` command, normalization and validation improvements to `tmr team`, and semantic restructuring of `tmr member` to absorb the company-member concept formerly held by relationships.

### What Makes This Special

`tmr`'s core differentiator is the zero-to-operational promise: one `tmr init` run bootstraps a fully populated, immediately useful vault. The onboarding flow collapses setup into a single guided session — collecting the manager's identity, leader, teams, and team members at the moment of highest intent, rather than relying on users to discover and remember individual commands after the fact.

The conceptual simplification of `tmr member` is equally important: a member is either company-scoped or team-scoped. Eliminating `tmr relationship` removes an ambiguous term and reduces the command vocabulary users must internalize.

## Project Classification

| Dimension | Value |
|---|---|
| **Project Type** | CLI Tool |
| **Domain** | Developer Productivity / Engineering Management |
| **Complexity** | Medium |
| **Project Context** | Brownfield — targeted enhancement to existing v1.0.0 |

## Success Criteria

### User Success

- A new user runs `tmr init`, answers all prompts, and arrives at a fully populated vault — their own profile, their leader, their teams, and team members — without reading documentation or running additional commands.
- `tmr init` concludes with a next-steps summary pointing to `tmr project add` and the `/tmr-inbox` skill.
- A `README.md` is generated in the vault root on every `tmr init` run, containing the most-used commands and a full command reference.
- All commands that accept email addresses reject invalid formats with a clear error — no silent failures, no file system corruption from malformed input.
- All commands that accept names or team names normalize input to lowercase/kebab-case automatically.

### Business Success

- `tmr` ships publicly within one month.
- At least one colleague completes `tmr init` end-to-end without requesting help — the qualitative bar for "onboarding is self-sufficient."

### Technical Success

- No command crashes on invalid input (bad emails, empty strings, invalid numbers).
- `tmr relationship` is fully removed from codebase and CLI help with no regressions in member or team functionality.

### Measurable Outcomes

- `tmr init` completes in a single session with zero required follow-up commands to reach a usable vault state.
- `README.md` exists in vault root after every `tmr init` run.
- `tmr member add <email>` without `--team` writes to `my-company/members/`; with `--team` writes to `my-teams/members/` with correct frontmatter.
- All email inputs across all commands are validated before any file system operation is attempted.

## Product Scope

### This Release — Full Feature Set

**Core User Journeys Supported:** All four journeys (first-time happy path, first-time edge cases, day-to-day team changes, colleague onboarding without prior context).

**Must-Have Capabilities:**

- `tmr init` full rework: current-dir default, user profile creation, leader creation, team + member setup loop, automatic `tmr-inbox`, `tmr-project-impact`, and `tmr-myself-config` skill install, sample inbox files copied to vault, vault `README.md` generation, `CLAUDE.md` with AI dependency-tracking hook and `## Manager Context` placeholder, `config/organization.yaml` with internal email domains, `my-company/contractors/members/` folder, folder cleanup (remove `/utils` and `/my-teams/feedback-templates`), post-init next-steps summary
- `tmr relationship` command removed from codebase and CLI help
- `tmr team create` / `tmr team add`: lowercase/kebab-case normalization, email validation
- `tmr member add <email>`: company-scoped routing to `my-company/members/`, contractor routing to `my-company/contractors/members/` for external email domains (with confirmation prompt), `--contractor` flag as explicit override, location field
- `tmr member add <email> --team <name>`: team-scoped routing to `my-teams/members/`, manager link from `my-career/<email>.md`, location field
- `tmr member add feedback <email>`: auto-create in `my-company/members/` if email not found via global email resolver
- `tmr install`: installs all skills from official registry
- `tmr install <skill-name>`: installs a specific skill from official registry
- Obsidian wiki-link references (`[[email]]`) as default output behavior in all Markdown files that reference entities
- `CONTRIBUTING.md` in repo root for open-source contributors

**Nice-to-Have (does not block release):**

- Obsidian plugin auto-enable post-install (technically complex, platform-dependent)

### Vision (Future)

- `tmr init --update`: re-run onboarding and sync new team members without wiping existing data
- Interactive vault health check: detect and flag missing profiles or broken references

## User Journeys

### Journey 1 — First-Time Setup: Happy Path

**Persona:** Marco, an engineering manager at a mid-size tech company managing two teams of eight people. Just installed `tmr` after a colleague mentioned it.

**Opening Scene:** Marco runs `tmr init`. He half-expects a wall of config instructions. Instead, the CLI asks where he wants to create his vault and suggests the current directory. He presses Enter.

**Rising Action:** Folders appear instantly. Prompts continue — his email, name, role. A file lands in `my-career/`. The CLI asks for his leader's name, role, and email. Another file appears in `my-leadership/`. It asks how many teams he manages. He types `2`. For each team he enters a name, then walks through members one by one — email, name, role, gender, location — until he submits an empty line to signal he's done. Sample inbox notes are copied to his vault's inbox folder.

**Climax:** `tmr-inbox` installs silently. The CLI prints a next-steps summary: run `tmr project add` to register projects, then call `/tmr-inbox` in Claude Code to process notes. A `README.md` lands in the vault root.

**Resolution:** Marco opens Obsidian. His vault is already populated — his profile, his leader, his teams, his people, and sample notes ready to process. Operational in under five minutes, no additional commands required.

---

### Journey 2 — First-Time Setup: Edge Cases

**Persona:** Same Marco, rushing and making mistakes.

**Opening Scene:** Marco types his email wrong — `marco@` with nothing after the domain. The CLI catches it: *"Invalid email format. Please try again."* He fixes it.

**Rising Action:** He types `0` for team count. The CLI rejects it: *"Please enter a number greater than 0."* He types `2`. He types `"Backend Team"` with capitals and a space — the CLI normalizes it silently to `backend-team` and confirms. He pastes `not-an-email` as a member email — rejected, asked again. He hits Enter on a blank email prompt — accepted as "done adding members for this team."

**Climax:** Four correction moments. The flow never crashed, never lost his progress. Each error had a clear message and a clear recovery path.

**Resolution:** Vault fully set up. Extra time spent fixing typos, not fighting the tool.

---

### Journey 3 — Day-to-Day Team Changes

**Persona:** Ana, an engineering manager who initialized `tmr` two weeks ago. She just hired a new backend engineer and needs to add them and log onboarding feedback.

**Opening Scene:** Ana runs `tmr member add joao@company.com --team backend-team`. The CLI prompts for name, role, gender, location. The file lands in `my-teams/members/` with her own email as manager in the frontmatter.

**Rising Action:** A week later she runs `tmr member add feedback joao@company.com`. His file exists in `my-teams/members/` — the CLI finds it and routes the feedback correctly. She also adds a colleague from another team for context: `tmr member add pedro@company.com` without `--team`. His file lands in `my-company/members/`.

**Resolution:** Ana's vault reflects the real complexity of her world: direct reports under teams, company contacts in company scope, feedback on the right people. She never decided which folder to use — the commands did it from context.

---

### Journey 4 — Colleague Onboarding Without Prior Context

**Persona:** Rita, technically capable but CLI-averse. She received one Slack message: *"Try `npm install -g @marlonvidal/tech-manager-os`, then run `tmr init`."* No other instructions.

**Opening Scene:** Rita installs `tmr` and runs `tmr init`. She doesn't know what an Obsidian vault is. The prompts ask things she knows — her email, her leader's name, her team names. She answers them.

**Rising Action:** At the end she sees a next-steps summary in the terminal. She opens the vault folder, finds `README.md`, skims it. She learns she can run `tmr project add` to register her projects. She does.

**Climax:** Rita never asked Marlon for help. The tool provided the information she needed at every step — prompts during setup, README and terminal summary after.

**Resolution:** Rita is operational. She tells Marlon it was surprisingly easy. That's the bar met.

---

### Journey Requirements Summary

| Journey | Capabilities Revealed |
|---|---|
| Happy path | Guided init flow, profile/leader/team/member creation (with location), sample inbox files, skill install, next-steps summary, README generation |
| Edge cases | Email validation everywhere, team count validation (> 0), name normalization (lowercase/kebab), graceful empty-input handling |
| Day-to-day changes | `tmr member add` with/without `--team`, location field, manager linking, company vs team scope routing, feedback auto-create |
| Colleague onboarding | Self-contained prompts, vault README, terminal next-steps summary post-init |

## Technical Requirements

### Architecture

`tmr` follows the Commander.js layered architecture: Command → Service → Provider. All new commands must conform to this pattern — no business logic in command files, no cross-service calls outside dependency injection.

### Command Reference

| Command | Mode | Description |
|---|---|---|
| `tmr init` | Interactive | Guided onboarding — scaffold + profile + leader + teams + members + skill install |
| `tmr team create <name>` | Non-interactive | Creates team; normalizes name to lowercase/kebab-case |
| `tmr team add <name> <email>` | Non-interactive | Adds member to team; validates email, normalizes team name |
| `tmr member add <email>` | Interactive | Creates company-scoped member under `my-company/members/` |
| `tmr member add <email> --team <name>` | Interactive | Creates team-scoped member under `my-teams/members/` with manager link |
| `tmr member add feedback <email>` | Interactive | Adds feedback; auto-creates member in `my-company/members/` if not found |
| `tmr install` | Non-interactive | Installs all skills from official registry |
| `tmr install <skill-name>` | Non-interactive | Installs a specific skill from official registry |
| `tmr member add <email> --contractor` | Interactive | Creates contractor profile under `my-company/contractors/members/`, bypassing domain check |

### Output Contract

All commands follow the established display contract:
- `printSuccess` (green) — confirmations
- `printError` (red) to stderr — validation failures and errors
- `printInfo` (blue) — status and progress messages
- `--plain` flag propagated from global opts into every service call
- `--json` flag — suppress all non-JSON output, emit structured result only

### Skill Registry Contract

- `tmr install` fetches and installs all available skills from the official GitHub-hosted registry
- `tmr install <skill-name>` fetches and installs a single named skill
- Registry URL and protocol are abstracted behind `SkillRegistryService` to support future evolution (paid skills, community submissions, API-backed registry)
- `tmr init` installs `tmr-inbox`, `tmr-project-impact`, and `tmr-myself-config` as default skills silently during onboarding; skill install failures are logged but do not abort onboarding

### Implementation Notes

- `tmr init` uses `inquirer` for all interactive prompts; delegates to `LeadershipService`, `TeamService`, and `MemberService` — no business logic inline in the command
- `tmr relationship` removal: delete command file, remove from `cli.ts` registration, update help text, verify no service dependencies remain
- `README.md` generation is a new responsibility of `InitService` — generate from a bundled template
- `CONTRIBUTING.md` in repo root covers: dev setup, `npm run validate`, coding conventions (ESM `.js` imports, `display.ts` helpers, no `console.log`), branching strategy, PR process, skill submission guidelines

## Functional Requirements

### Vault Initialization & Onboarding

- **FR1**: User can run `tmr init` to create a new vault through a guided interactive flow
- **FR2**: User can specify vault location during init, with the current working directory as the default
- **FR3**: System creates the standard vault folder structure during init, excluding `/utils` and `/my-teams/feedback-templates`
- **FR4**: User can provide their email, name, and role during init to generate their profile file under `my-career/`
- **FR5**: User can provide their leader's name, role, and email during init to generate a leadership file under `my-leadership/`
- **FR6**: User can specify how many teams they manage during init
- **FR7**: User can provide a team name for each team during init to create the corresponding team entry
- **FR8**: User can add members to each team during init by providing email, name, role, gender, and location per member
- **FR9**: User can finish adding members to a team by submitting an empty email input
- **FR10**: System automatically installs the `tmr-inbox` skill as part of every `tmr init` run
- **FR35**: System automatically installs the `tmr-project-impact` skill as part of every `tmr init` run, enabling dependency tracking across project files
- **FR36**: The `CLAUDE.md` written to the vault root during `tmr init` includes: (a) a rule instructing AI agents to run `/tmr-project-impact` whenever a file changes inside `my-company/projects/`; and (b) a `## Manager Context` placeholder section with a CTA to run `/tmr-myself-config` in Claude Code
- **FR11**: System copies bundled sample inbox notes into the vault's inbox folder during init
- **FR12**: System generates a `README.md` in the vault root during init containing the most-used commands and a full command reference
- **FR13**: System displays a post-init next-steps summary with: Step 1 — run `/tmr-myself-config` in Claude Code to personalize AI responses; Step 2 — run `tmr project add` to register projects; Step 3 — run `/tmr-inbox` to process meeting notes; and informing the user that once projects are added, `/tmr-project-impact <project-path> deps` can be run at any time to set up dependency tracking
- **FR14**: System displays post-init guidance to open Obsidian and enable required plugins *(nice-to-have: automated plugin enablement)*

### Team Management

- **FR15**: User can create a new team by providing a team name
- **FR16**: User can add a member to an existing team by providing a team name and member email
- **FR17**: System normalizes team names to lowercase/kebab-case on all team create and add operations

### Member Management

- **FR18**: User can create a company-scoped member profile by providing only an email, stored under `my-company/members/`
- **FR19**: User can create a team-scoped member profile by providing an email and a team name, stored under `my-teams/members/`
- **FR20**: System links team-scoped members to the current user as their manager, resolved from `my-career/<email>.md`
- **FR21**: User can provide a location when creating any member profile, stored in the profile frontmatter
- **FR22**: User can add feedback for a member identified by email
- **FR23**: System resolves a member's file via a global email resolver that searches both `my-company/members/` and `my-teams/members/`
- **FR24**: System auto-creates a company-scoped member profile when feedback is requested for an email not found in any member location

### Skill Management

- **FR25**: User can install all available skills from the official skill registry in a single command
- **FR26**: User can install a specific skill from the official skill registry by name
- **FR27**: System accesses the skill registry through an abstracted service layer that supports future registry evolution (paid skills, community submissions, API-backed registry)

### Input Validation & Normalization

- **FR28**: System validates all email inputs before any file system operation and rejects invalid formats with a descriptive error
- **FR29**: System re-prompts the user on invalid input during interactive flows without losing progress or crashing
- **FR30**: System validates team count input during init as a positive integer greater than zero
- **FR31**: System normalizes all name and team name inputs to lowercase/kebab-case, confirming the normalized form in output

### Command Lifecycle

- **FR32**: System no longer exposes `tmr relationship` as a CLI command or in CLI help output

### Obsidian Integration

- **FR33**: System generates Obsidian wiki-link references (`[[email]]`) in all Markdown files that reference other entities (people, teams, leaders) — this is a default output behavior across all commands

### Project Management

- **FR37**: System creates a stub `deps.yaml` file inside the new project directory when `tmr project add` is run, so that `/tmr-project-impact` can be invoked at any time without a manual file creation step

### Contractor Management

- **FR38**: Vault scaffold includes `my-company/contractors/members/` directory, created during `tmr init` alongside all standard folders
- **FR39**: `tmr init` writes `<vault>/config/organization.yaml` with the user's email domain as the initial internal domain entry after collecting the user profile
- **FR40**: `tmr init` optionally prompts for additional trusted internal email domains; each entered domain is appended to `config/organization.yaml`; pressing Enter skips the step
- **FR41**: `tmr member add <email>` checks the email domain against `config/organization.yaml`; external domains prompt the user to route to contractors or company members (default: contractors); `--contractor` flag bypasses domain detection and routes directly to `my-company/contractors/members/`
- **FR42**: Contractor profiles are stored in `my-company/contractors/members/<email>.md` using the standard member template with two additional frontmatter fields: `contractor: true` and `company: <their organization>`

### Self Profile & AI Context Personalization

- **FR43**: `tmr init` auto-installs the `tmr-myself-config` skill during onboarding via `SkillRegistryService`, alongside `tmr-inbox` and `tmr-project-impact`; install failure is logged but does not abort onboarding
- **FR44**: The default `CLAUDE.md` template written during `tmr init` includes a `## Manager Context` placeholder section with a CTA to run `/tmr-myself-config` in Claude Code
- **FR45**: `tmr init` post-init next-steps summary recommends `/tmr-myself-config` in Claude Code as Step 1 for AI personalization
- **FR46**: `/tmr-myself-config` (setup mode) conducts a full adaptive questionnaire: reads existing vault context, detects manager archetype (product/people/hybrid), collects base context, product or people branch questions, contractor classification, and writes enriched `my-career/<email>.md`, `CLAUDE.md ## Manager Context`, scaffolded project files, and member/contractor profiles with wiki-links
- **FR47**: `/tmr-myself-config update` (update mode) reads current enriched state, presents a summary of known context, asks delta questions covering changed priorities, team (joins/leaves), project status changes, and contractor changes, and merges only changed sections

### Project Documentation & Open Source

- **FR34**: Repository includes a `CONTRIBUTING.md` covering development setup, coding conventions, test process, PR guidelines, and skill submission process for the official registry

## Non-Functional Requirements

### Reliability

- The `tmr init` flow must not leave the vault in a silently partial state on failure — any write error must be surfaced via `printError` to stderr with a clear message and recovery guidance before the process exits
- No command may exit with an unhandled exception or stack trace visible to the user; all errors are caught and surfaced through `printError`
- `tmr relationship` removal must produce zero dangling code references, registered commands, or help text entries

### Performance

- No prompt in the `tmr init` interactive loop may block for more than 3 seconds without a visible `ora` spinner indicating progress
- File write operations for profile, member, and leader files must complete within 500ms under normal local I/O conditions

### Integration

- `tmr install` must handle skill registry failures (network error, timeout, malformed response) by surfacing a descriptive `printError` message without crashing; exit code must be non-zero on failure
- The skill registry endpoint must be read from `SkillRegistryService` configuration — no hardcoded URLs in command or service files
