# Epic Details

## Epic 1: Foundation & CLI Infrastructure

**Expanded Goal:** Establish a professional TypeScript/Node.js project with Commander.js CLI framework, implement secure configuration management using the `conf` library for encrypted API key storage, build the interactive onboarding workflow that collects leader profile and creates multi-team workspace structure, and deliver AI provider adapters for OpenAI, Claude, and Gemini. This epic ensures all subsequent development has a solid foundation.

### Story 1.1: Project Scaffolding and TypeScript Configuration

**As a** developer,  
**I want** a properly configured TypeScript Node.js project with all development tooling,  
**so that** I can build the CLI with type safety, linting, and automated testing.

**Acceptance Criteria:**

1. Project initialized with `package.json`:
   - Name: `@marlonvidal/tech-manager-os`
   - Version: `1.0.0`
   - Binary: `"bin": { "tm": "./dist/cli.js" }`
   - Scripts: `build`, `dev`, `test`, `lint`, `format`
2. TypeScript configured with strict mode, ES2022 target, ESNext modules
3. ESLint + Prettier configured
4. Jest configured for testing with TypeScript support
5. Husky + lint-staged for pre-commit hooks
6. Project structure: `/src`, `/tests`, `/dist`
7. README.md with project description
8. `.gitignore` properly configured

### Story 1.2: CLI Framework with Commander.js

**As a** user,  
**I want** a CLI that displays help and handles commands properly,  
**so that** I can discover available commands and understand usage.

**Acceptance Criteria:**

1. Commander.js integrated in `cli.ts`
2. `tmr --help` displays tool description, version, command list
3. `tmr --version` displays current version
4. `tmr` with no args shows help
5. Unknown commands show error with suggestion
6. Global flags work: `--verbose`, `--plain`, `--json`
7. Error handling with user-friendly messages

### Story 1.3: Configuration Service with Encrypted Storage

**As a** user,  
**I want** my API keys stored securely and encrypted,  
**so that** my credentials are protected.

**Acceptance Criteria:**

1. `ConfigService` class with methods: `initialize`, `set`, `get`, `has`, `delete`
2. Uses `conf` library with encryption in OS-specific locations
3. Config schema defined with TypeScript interface
4. API keys never logged (redaction in place)
5. Environment variable support: `TM_PROVIDER`, `TM_API_KEY`
6. Unit tests cover storage/retrieval, environment precedence

### Story 1.4: AI Provider Interface and Adapters

**As a** developer,  
**I want** a provider-agnostic AI interface,  
**so that** adding new providers doesn't require changing business logic.

**Acceptance Criteria:**

1. `AIProvider` interface defined: `name`, `testConnection()`, `generateText()`, `streamText()`
2. `AIProviderFactory` with `create()` method
3. `BaseAIProvider` with common functionality: retry logic, rate limiting
4. `OpenAIProvider` implementation using `openai` SDK
5. `AnthropicProvider` implementation using `@anthropic-ai/sdk`
6. `GeminiProvider` implementation using `@google/generative-ai`
7. Mock provider for testing
8. Unit tests with mocked SDK calls

### Story 1.5: File System Service

**As a** developer,  
**I want** a centralized service for file operations,  
**so that** operations are safe, testable, and handle errors gracefully.

**Acceptance Criteria:**

1. `FileSystemService` class with methods: `createDirectory`, `writeFile`, `readFile`, `moveFile`, `exists`
2. Uses `fs-extra` for all operations
3. Atomic write operations (temp + rename)
4. Comprehensive error handling
5. Unit tests cover happy path and error scenarios
6. Service is mockable for testing

### Story 1.6: Interactive Onboarding Workflow (`tmr init`)

**As a** new user,  
**I want** an interactive setup wizard that guides me through configuration,  
**so that** I can start using the system immediately.

**Acceptance Criteria:**

1. Displays branded welcome message
2. Interactive AI provider selection (inquirer)
3. API key input (password-style, hidden)
4. Connection validation with spinner
5. Collects manager profile:
   - Name, role, experience
   - Management style
   - Strengths and development areas
6. Collects career goals
7. Collects leadership context (manager's name, expectations)
8. Creates complete directory structure
9. Generates initial files: `my-career/profile.md`, `my-career/pdp.md`, `my-leadership/profile.md`
10. Creates IDE integration files (`.cursor/`, `.claude/`, `.gemini/`)
11. Displays next steps
12. Integration test validates full workflow

---

## Epic 2: Complete Command-Line Interface Implementation

**Expanded Goal:** Build comprehensive CLI commands that establish the CRUD foundation for the entire system. Implement team management with multi-team structure (Option A: separate _members/ and _teams/ directories), member file operations (1on1s, feedback, assessments, performance reviews), relationship tracking, leadership tracking, and project management. All commands support both parameter-passing and interactive modes, implement hierarchical email resolution (team → leadership → relationships), auto-create structures as needed, generate Obsidian-compatible wiki-links, and include complete unit test coverage. This epic enables token-optimized agent implementation where agents invoke CLI commands for file manipulation instead of reading/parsing files directly.

### Story 2.1: Team Management Commands

**As a** manager,  
**I want** CLI commands to manage teams and team members,  
**so that** I can organize my direct reports across multiple teams with a single source of truth per person.

**Acceptance Criteria:**

1. **Directory Structure Created:**
   - `/my-teams/members/{email}/` — Single member profile location
   - `/my-teams/members/{email}/{email}.md` — Profile file
   - `/my-teams/members/{email}/1on1s/` — Directory for 1on1 files
   - `/my-teams/members/{email}/feedbacks/` — Directory for feedback files
   - `/my-teams/members/{email}/assessments/` — Directory for assessment files
   - `/my-teams/members/{email}/performance-reviews/` — Directory for review files
   - `/my-teams/teams/{team-name}/{team-name}-context.md` — Team-level context
   - `/my-teams/teams/{team-name}/{team-name}-members.md` — Team member links

2. **`tmr team create <team-name>` Command:**
   - Creates team directory structure
   - Generates `{team-name}-context.md` with frontmatter template
   - Generates `{team-name}-members.md` with "# Team Members" header
   - If no team-name provided, prompts interactively
   - Returns success message with created paths

3. **`tmr team add <team-name> <email> [--role=<role>] [--location=<location>]` Command:**
   - Auto-creates team if doesn't exist
   - If no parameters provided, prompts interactively for: team-name, email, role, location
   - Creates member directory structure under `my-teams/members/{email}/` (if doesn't exist)
   - Generates `{email}.md` with frontmatter:
     ```yaml
     ---
     email: user@example.com
     role: <collected-role>
     location: <collected-location>
     teams: [<team-name>]
     date_added: <current-date>
     ---
     ```
   - If member already exists in another team, appends team-name to `teams` array
   - Appends wiki-link to team's `{team-name}-members.md`: `- [[../../members/{email}/{email}.md|{email}]]`
   - Unit tests cover: new member, existing member, interactive mode, auto-team-creation

4. **`tmr team list [team-name]` Command:**
   - Without team-name: displays table of all teams with member counts
   - With team-name: displays table of team members with: email, role, location, date_added
   - Reads from `teams/*/members.md` and `members/*/frontmatter`
   - Formats output with aligned columns
   - Unit tests cover: all teams, specific team, empty team

5. **`tmr team archive <team-name> <email> [--from <date>] [--to <date>]` Command:**
   - If no parameters, prompts interactively
   - Moves member directory: `/my-teams/members/{email}/` → `/archive/my-teams/members/{email}/`
   - Adds `archived: true` and `archived_date: <date>` to frontmatter
   - Optional date filters move only files in date range
   - Removes member wiki-link from team's `{team-name}-members.md`
   - Unit tests cover: full archive, partial archive, date filtering

6. **`tmr team fire <team-name> <email>` Command:**
   - Executes archive command
   - Additionally adds `termination: true` to frontmatter
   - Adds `termination_date: <date>` to frontmatter
   - Unit tests cover: termination marking

7. **`tmr show <email>` Command:**
   - Searches for email in: `my-teams/members/`, `my-leadership/`, `my-company/members/`, `archive/`
   - Displays profile content with formatted output
   - Shows: teams, role, location, section summaries (counts of 1on1s, feedback, etc.)
   - Error handling: email not found
   - Unit tests cover: active member, archived member, not found

### Story 2.2: Member File Management Commands

**As a** manager,  
**I want** CLI commands to create member-related files and auto-update profile sections,  
**so that** Obsidian wiki-links stay current without manual editing.

**Acceptance Criteria:**

1. **`tmr member <email> add 1on1` Command:**
   - Finds member in `/my-teams/members/{email}/`
   - Creates file: `1on1s/YYYY-MM-DD-1on1-{email}.md` with template:
     ```yaml
     ---
     date: <date>
     member: <email>
     type: 1on1
     ---
     
     # 1:1 with {email}
     
     ## Check-in
     
     ## Discussion Topics
     
     ## Action Items
     
     ## Notes
     ```
   - Parses `{email}.md`, finds "## 1on1s" section
   - Appends: `- [[1on1s/{date}-{email}-1on1.md]]`
   - Opens created file in editor (optional `--no-edit` flag)
   - Error handling: member not found
   - Unit tests cover: creation, section update, file already exists

2. **`tmr member <email> add feedback` Command:**
   - Creates file: `feedback/{date}-{email}-feedback.md` with template
   - Appends to "## Feedbacks" section
   - Template includes: Situation, Behavior, Impact sections
   - Unit tests cover: creation, section update

3. **`tmr member <email> add assessment` Command:**
   - Creates file: `assessments/{date}-{email}-assessment.md` with template
   - Appends to "## Assessments" section
   - Template includes: skills assessment structure
   - Unit tests cover: creation, section update

4. **`tmr member <email> add performance-review` Command:**
   - Creates file: `performance-reviews/{date}-{email}-review.md` with template
   - Appends to "## Performance Reviews" section
   - Template includes: review structure with accomplishments, growth areas, goals
   - Unit tests cover: creation, section update

5. **Section Parser Service:**
   - `SectionParserService` class with methods: `findSection(file, sectionName)`, `appendToSection(file, sectionName, content)`
   - Handles missing sections (creates them)
   - Preserves existing content
   - Atomic file operations
   - Unit tests cover: section finding, appending, missing sections

6. **Template Service:**
   - `TemplateService` class with method: `getTemplate(type)` where type = 1on1|feedback|assessment|performance-review
   - Returns template with placeholders replaced (date, email, etc.)
   - Unit tests cover all template types

### Story 2.3: Relationship Management Commands

**As a** manager,  
**I want** CLI commands to track company relationships outside my direct reports,  
**so that** I maintain context on cross-functional collaborators and stakeholders.

**Acceptance Criteria:**

1. **`tmr relationship add <email>` Command:**
   - Creates structure:
     ```
     /my-company/members/{email}/
       {email}.md              (profile with frontmatter)
       1on1s/                  (directory)
     ```
   - Profile template includes: name, role, department, relationship_type
   - If email already exists in `my-company/members/`, returns "already exists" message
   - If no email provided, prompts interactively
   - Unit tests cover: creation, already exists, interactive mode

2. **`tmr relationship add <email-list>` Batch Command:**
   - Accepts comma-separated email list: `user1@example.com,user2@example.com,user3@example.com`
   - Executes `relationship add` for each email
   - Displays progress indicator for multiple emails
   - Summary output: X created, Y already existed
   - Unit tests cover: batch creation, partial success

3. **`tmr relationship <email> add 1on1` Command:**
   - Creates file: `/my-company/members/{email}/1on1s/YYYY-MM-DD-1on1-{email}.md`
   - Template similar to team member 1on1
   - Appends to relationship profile "## 1on1s" section
   - Error handling: relationship not found (suggests creating first)
   - Unit tests cover: creation, not found error

4. **`tmr relationship list` Command:**
   - Displays table: email, name, department, relationship_type, last 1on1
   - Sorted by last interaction
   - Unit tests cover: listing, empty list

### Story 2.4: Leadership Management Commands

**As a** manager,  
**I want** CLI commands to track my leadership relationships,  
**so that** I maintain context on my manager and skip-level leaders.

**Acceptance Criteria:**

1. **`tmr leadership add <email>` Command:**
   - Creates structure:
     ```
     /my-leadership/{email}/
       {email}.md              (profile with frontmatter)
       1on1s/                  (directory)
     ```
   - Profile template includes: name, role, areas_of_responsibility
   - If no email provided, prompts interactively
   - Unit tests cover: creation, already exists

2. **`tmr leadership <email> add 1on1` Command:**
   - Creates file: `/my-leadership/{email}/1on1s/{date}-{email}-1on1.md`
   - Template includes: alignment topics, support needed, feedback requested
   - Appends to leadership profile "## 1on1s" section
   - Unit tests cover: creation, section update

3. **`tmr leadership list` Command:**
   - Displays table: email, name, role, last 1on1
   - Unit tests cover: listing

### Story 2.5: Project Management Commands

**As a** manager,  
**I want** CLI commands to manage project structures and team composition,  
**so that** I track project context and stakeholder relationships.

**Acceptance Criteria:**

1. **`tmr project add <project-name>` Command:**
   - Creates structure:
     ```
     /my-company/projects/{project-name}/
       {project-name}-project.md    (project overview, goals, timeline)
       meetings/                    (directory)
     ```
   - All paths follow TECH-MANAGER-OS-TEMPLATE naming (kebab-case, `-project` suffix)
   - If no project-name, prompts interactively
   - Unit tests cover: creation, already exists

2. **`tmr project <project-name> add meeting` Command:**
   - Creates file: `/my-company/projects/{project-name}/meetings/YYYY-MM-DD-{topic}-{project-name}-project.md`
   - Template includes: attendees, decisions, action items
   - Unit tests cover: creation

3. **`tmr project <project-name> link-member <email>` Command:**
   - Uses hierarchical email resolution (see Story 2.6)
   - If email not found anywhere, creates via `tmr relationship add <email>`
   - Appends wiki-link to project file "# Team Members" section
   - Determines correct wiki-link path based on email location (`my-teams/members/`, `my-leadership/`, `my-company/members/`)
   - Unit tests cover: existing team member, existing relationship, new email

4. **`tmr project <project-name> link-members <email-list>` Batch Command:**
   - Executes `link-member` for each email in comma-separated list
   - Progress indicator for batch operations
   - Summary: X linked, Y created
   - Unit tests cover: batch linking

5. **`tmr project list` Command:**
   - Displays table: project-name, team member count, stakeholder count
   - Unit tests cover: listing

### Story 2.6: Email Resolution Service

**As a** developer,  
**I want** a centralized service for hierarchical email resolution,  
**so that** all commands consistently locate or create email profiles.

**Acceptance Criteria:**

1. **`EmailResolutionService` Class:**
   - Method: `resolve(email: string): EntityLocation`
   - Returns: `{ type: 'team' | 'leadership' | 'relationship', path: string }`
   - Hierarchy order:
     1. Check `/my-teams/members/{email}/` (team member)
     2. Check `/my-leadership/{email}/` (leadership)
     3. Check `/my-company/members/{email}/` (company member)
     4. If not found, execute `tmr relationship add <email>` and return company member path

2. **Email Validation:**
   - Validates email format before resolution
   - Handles edge cases: empty, malformed, special characters
   - Unit tests cover: valid emails, invalid formats

3. **Path Generator:**
   - Method: `generateWikiLink(email: string, fromPath: string): string`
   - Generates correct Obsidian wiki-link with relative path
   - Example: From `/my-company/projects/platform/platform-project.md` to `/my-teams/members/user@example.com/user@example.com.md` → `[[../../../my-teams/members/user@example.com/user@example.com.md|user@example.com]]`
   - Unit tests cover: various path combinations

4. **Integration with All Commands:**
   - All `link-*` commands use EmailResolutionService
   - Consistent resolution logic across project, team, relationship commands
   - Integration tests validate resolution from each command

5. **Performance Optimization:**
   - Caches email locations during command execution
   - Avoids repeated filesystem checks
   - Unit tests cover: caching behavior

---

## Epic 3: Process Intelligence Engine

**Expanded Goal:** Build the AI-powered process agent that powers the `tmr process` command to process inbox files, categorizes them by type and entity, updates context summaries using CLI commands for token-optimized injection, extracts actionable tasks with urgency classification, and moves files to appropriate destinations. This epic delivers the core "transcript-to-context" value proposition and depends on Epic 2's complete CLI foundation.

### Story 3.1: Inbox Scanner and File Parser

**As a** developer,  
**I want** to scan and parse inbox files efficiently,  
**so that** the process command can handle them.

**Acceptance Criteria:**

1. `InboxService` class with methods: `scanInbox()`, `parseFile()`
2. Supports file types: `.txt`, `.md`, `.json`
3. Returns array of `InboxFile` objects with: filepath, content, timestamp
4. Handles edge cases: empty inbox, large files, malformed files
5. Sorted by timestamp (oldest first)
6. Unit tests cover various file types and scenarios

### Story 3.2: AI-Powered Categorization Logic

**As a** manager,  
**I want** notes automatically categorized and filed,  
**so that** I don't have to manually organize everything.

**Acceptance Criteria:**

1. `CategorizationService` class with method: `categorize(file, context)`
2. AI prompt analyzes file and returns structured JSON:
   - Type: `1on1_session`, `feedback_positive`, `feedback_constructive`, `pip_concern`, `project_status`, `project_risk`, `team_meeting`, `leadership_meeting`, `candidate_interview`, `general_note`
   - Members: Array of member names mentioned
   - Projects: Array of project names mentioned
   - Insights: Key points for each entity
   - Destinations: Array of file paths
   - Suggested actions: Follow-up items
3. Handles ambiguous cases (low confidence triggers review)
4. Unit tests with mocked AI responses
5. Integration test with real file samples

### Story 3.3: Context Summary Updates via CLI Injection

**As a** manager,  
**I want** context summaries intelligently updated using CLI commands,  
**so that** I have current, accurate context without token-heavy file reading operations.

**Acceptance Criteria:**

1. `ContextService` class with method: `updateContext(email, insights)`
2. Instead of reading full context files, executes CLI commands:
   - For team members: Uses Epic 2 CLI to append insights
   - For projects: Updates project context via CLI
   - For relationships/leadership: Updates via CLI
3. AI generates insights from new notes
4. CLI handles section parsing and atomic updates
5. Token optimization: AI only generates insights, doesn't manipulate files
6. Unit tests with mocked CLI execution
7. Integration tests validate context updates

### Story 3.4: Task Extraction and Timeline Classification

**As a** manager,  
**I want** actionable tasks extracted and classified by urgency,  
**so that** I know what needs attention today vs. this week vs. later.

**Acceptance Criteria:**

1. `TaskService` class with method: `extractTasks(files, existingTasks)`
2. AI identifies tasks and classifies:
   - TODAY: Urgent, "ASAP", explicit today deadline
   - THIS WEEK: "This week", "by Friday", week deadlines
   - THIS MONTH: Monthly goals, month deadlines
   - THIS QUARTER: Quarterly objectives
3. Each task includes: description, owner, urgency reason, status
4. Updates existing task files (merges with current tasks)
5. Marks completed tasks based on mentions
6. Unit tests with task extraction scenarios

### Story 3.5: File Organization and Movement

**As a** developer,  
**I want** files moved to correct destinations after categorization,  
**so that** the workspace stays organized.

**Acceptance Criteria:**

1. `FileOrganizationService` with method: `organizeFile(file, destinations)`
2. Moves files from inbox to destination(s)
3. Creates destination directories if needed
4. Handles multi-destination cases (copy to multiple locations)
5. Archives unprocessable files to `archive/`
6. Atomic operations (no data loss)
7. Unit tests cover various organization scenarios

### Story 3.6: `tmr process` Command Implementation

**As a** leader,  
**I want** one command to process all inbox files,  
**so that** my workspace stays current with minimal effort.

**Acceptance Criteria:**

1. `tmr process` orchestrates: Scan → Categorize → Update Contexts → Extract Tasks → Organize Files
2. Progress indicators for each phase
3. Summary output:
   - Files processed
   - Contexts updated (people, projects)
   - Tasks extracted
   - Suggested actions
4. Handles errors gracefully (partial progress saved)
5. Optional flags: `--dry-run`, `--verbose`
6. Integration test validates full process workflow

### Story 3.7: `tmr watch` Command for Auto-Processing

**As a** leader,  
**I want** inbox to be processed automatically when files are added,  
**so that** I don't have to remember to run process.

**Acceptance Criteria:**

1. `tmr watch` monitors `inbox/` directory
2. Uses `chokidar` for file watching
3. Debounces multiple file additions (waits 5 seconds)
4. Runs `tmr process` automatically
5. Displays activity log
6. Can be stopped with Ctrl+C
7. Stores PID in `.system/watch.pid`
8. Integration test validates file watching

---

## Epic 4: Skills-Based Architecture Pivot

**Expanded Goal:** Re-align the product to its proven architecture. `tmr init` scaffolds the full vault structure per TECH-MANAGER-OS-TEMPLATE and generates a `CLAUDE.md` context file. All CLI routing paths are corrected to match the template and Epic 3 is retested end-to-end. `tmr-inbox` is generalized into a distributable Claude Code skill. A skill install/update mechanism lets users receive new skills over time.

### Story 4.1: Pivot `tmr init` — Vault Scaffolding + CLAUDE.md Generation

**As a** new leader,
**I want** `tmr init` to scaffold my full vault and generate a `CLAUDE.md` file,
**so that** I can start using the system with Claude Code immediately without manual setup.

**Acceptance Criteria:**

1. `tmr init` runs a minimal interactive onboarding collecting: name, email, role, company/domain
2. Scaffolds complete directory structure per TECH-MANAGER-OS-TEMPLATE:
   - `inbox/`, `archive/`, `config/`, `knowledge-base/`, `my-career/`, `my-company/`, `my-leadership/`, `my-tasks/`, `my-teams/`, `.claude/skills/`, `.obsidian/`
   - `my-teams/members/`, `my-teams/teams/`, `my-teams/feedback-templates/`
   - `my-company/members/`, `my-company/meetings/`, `my-company/projects/`
   - `knowledge-base/branding-guidelines/`, `knowledge-base/company/`, `knowledge-base/people/`, `knowledge-base/process/`, `knowledge-base/security/`
   - `my-career/assessments/`, `my-career/feedbacks/`
   - `my-tasks/` with `tasks.md`, `today.md`, `this-week.md`, `this-month.md`, `this-quarter.md`
3. Generates `CLAUDE.md` at vault root containing:
   - Identity block (name, email, role, company) from onboarding responses
   - Folder structure reference section describing each top-level folder's purpose
   - Communication style section with labeled placeholder content
   - Pointer to `my-company/` for deeper company and team context
4. All created folders and files follow TECH-MANAGER-OS-TEMPLATE naming (lowercase kebab-case, ISO 8601 dates, email-as-identity)
5. Does NOT collect or prompt for API keys — directs user to `tmr config` if asked
6. Displays a clear "next steps" summary on completion
7. Integration test validates full scaffold and `CLAUDE.md` contents

### Story 4.2: Folder Structure Alignment + Epic 3 Path Correction & Retest

**As a** developer,
**I want** all CLI commands to use the TECH-MANAGER-OS-TEMPLATE folder paths,
**so that** the CLI and the vault structure are consistent and `tmr process` works correctly.

**Acceptance Criteria:**

1. Audit all CLI commands (Epics 1–3) for any reference to old PRD paths and replace:
   - `my-teams/{team}/{email}/` → `my-teams/members/{email}/`
   - `my-projects/{project}/` → `my-company/projects/{project}/`
   - `my-company/relationships/{email}/` → `my-company/members/{email}/`
   - `operations/hiring/` → removed from routing
2. `tmr process` routing engine updated to write to corrected paths
3. Epic 3 retested end-to-end with the corrected paths:
   - Inbox scanner picks up files
   - AI categorization returns correct destinations
   - Files move to the right folders under the new structure
   - Context updates write to correct paths
   - Task extraction appends to `my-tasks/tasks.md`
4. All existing unit tests updated to reflect new paths
5. Integration test runs the full `tmr process` flow against a vault scaffolded by the new `tmr init`

### Story 4.3: `tmr config` First-Run Check in `tmr process`

**As a** user running `tmr process` for the first time,
**I want** a clear message if no API key is configured,
**so that** I know exactly what to do before retrying.

**Acceptance Criteria:**

1. Before executing any AI call, `tmr process` checks whether an API key is stored in config
2. If no key is found, command exits early with a clear, friendly message:
   - Explains that `tmr process` requires an AI API key
   - Instructs user to run `tmr config` to set it up
   - Does NOT prompt for or collect the key inline
3. If a key is found, proceeds normally
4. `tmr config` remains the dedicated command for API key collection (no change to its implementation)
5. Unit test covers the no-key detection and message output

### Story 4.4: Generalize `tmr-inbox` Skill

**As a** leader who installed the tmr-inbox skill,
**I want** the skill to work from my `CLAUDE.md` without hardcoded values,
**so that** any leader can install and use it for their own vault.

**Acceptance Criteria:**

1. All hardcoded user-specific values removed from `SKILL.md`:
   - Vault owner email sourced from `CLAUDE.md` identity block
   - Folder paths sourced from `CLAUDE.md` folder structure section
   - Domain inference uses the vault owner's email domain from `CLAUDE.md`
2. `SKILL.md` includes a clear "Prerequisites" section stating that `CLAUDE.md` must be populated before use
3. Skill is authored in the repo under `skills/tmr-inbox/SKILL.md` (no user-specific content)
4. Skill tested against a vault with a freshly generated `CLAUDE.md` (from Story 4.1)
5. The `tmr-inbox setup` subcommand creates `my-tasks/tasks.md` and view files if missing

### Story 4.5: Skill Install/Update Mechanism

**As a** leader,
**I want** to install and update skills via the CLI,
**so that** I can receive new capabilities without manually copying files.

**Acceptance Criteria:**

1. `tmr install <skill-name>` command:
   - Downloads the named skill from the official registry (GitHub releases or npm package)
   - Installs it into `.claude/skills/<skill-name>/SKILL.md` in the current vault
   - Displays a confirmation with the installed version
   - Error handling: skill not found, network failure, already installed (offer to update)
2. `tmr update` command:
   - Detects all installed skills by scanning `.claude/skills/`
   - Checks for newer versions
   - Updates all skills that have newer versions available
   - Reports: X updated, Y already up to date
3. `tmr install tmr-inbox` works out of the box as the canonical first skill
4. Unit tests cover install, already-installed, and update scenarios

---

## Epic 5: Polish, Testing & Distribution

**As a** manager,  
**I want** an easy way to collect structured profile information from team members,  
**so that** I have rich context about their background and goals.

**Acceptance Criteria:**

1. `utils/team-member-profile-prompt.md` contains shareable prompt file
2. Prompt includes questions about:
   - Background and experience
   - Skills and expertise
   - Communication preferences
   - Career goals
   - Support needs
3. Generated file is AI-friendly (can be used in ChatGPT/Claude)
4. Manager can also run interactive session in IDE
5. Output is structured markdown with frontmatter
6. Integration test validates workflow

### Story 4.2: tmr-people Agent - 1:1 Preparation

**As a** manager,  
**I want** an easy way to collect structured profile information from team members,  
**so that** I have rich context about their background and goals.

**Acceptance Criteria:**

1. `utils/team-member-profile-prompt.md` contains shareable prompt file
2. Prompt includes questions about:
   - Background and experience
   - Skills and expertise
   - Communication preferences
   - Career goals
   - Support needs
3. Generated file is AI-friendly (can be used in ChatGPT/Claude)
4. Manager can also run interactive session in IDE
5. Output is structured markdown with frontmatter
6. Integration test validates workflow

### Story 4.3: tmr-people Agent - Feedback Generation

**As a** manager,  
**I want** AI to generate 1:1 agendas based on context,  
**so that** my meetings are productive and well-prepared.

**Acceptance Criteria:**

1. Agent command: `*1on1-prepare <member>`
2. Reads: context.md, pdp.md, recent 1on1s, recent feedback, tasks/today.md, related project contexts
3. Generates agenda content
4. **Uses CLI for file creation:** Executes `tmr member <email> add 1on1`
5. **Opens created file and populates with generated agenda**
6. Agenda includes sections:
   - Check-in
   - Follow-ups from last session
   - Current challenges/support needed
   - PDP progress
   - New discussion topics
   - Action items
7. Integration test with sample context

### Story 4.3: tmr-people Agent - Feedback Generation

**As a** manager,  
**I want** AI to draft feedback based on context,  
**so that** I can deliver timely, specific feedback.

**Acceptance Criteria:**

1. Agent command: `*feedback <member> --tone=positive|constructive`
2. Reads: context.md, recent notes mentioning member
3. Generates feedback draft:
   - Specific examples from context
   - Clear, actionable language
   - Professional tone
   - SBI model for constructive (Situation-Behavior-Impact)
4. **Uses CLI for file creation:** Executes `tmr member <email> add feedback`
5. **Populates created file with generated feedback**
6. Manager reviews before delivery
7. Integration test validates generation

### Story 4.4: tmr-people Agent - PDP Management

**As a** manager,  
**I want** AI to help create and maintain PDIs,  
**so that** career development is data-driven.

**Acceptance Criteria:**

1. Agent command: `*pdi-generate <member>`
2. Reads: profile.md, context.md
3. Generates structured PDI:
   - Current role and aspirations
   - 3-5 development goals with success criteria
   - Action plans
   - Support needed
   - Timeline
4. Agent command: `*pdi-update <member>` suggests updates based on progress
5. Outputs to: `people/active/{member}/pdi.md`
6. Uses template: `member-pdi-tmpl.yaml`
7. Integration test validates PDI structure

### Story 4.5: tmr-people Agent - PIP and Performance Reviews

**As a** manager,  
**I want** AI assistance with PIPs and performance reviews,  
**so that** these critical documents are thorough and fair.

**Acceptance Criteria:**

1. Agent command: `*pip-create <member>`
2. Generates PIP with: issues, improvement plan, timeline, consequences
3. **Uses CLI for file creation**
4. Agent command: `*review-generate <member> --period=<quarter>`
5. Generates review with: summary, accomplishments, growth areas, PDP progress, goals
6. **Uses CLI:** Executes `tmr member <email> add performance-review`
7. Both use comprehensive context analysis
8. Manager reviews/edits before finalizing
9. Integration test validates document quality

---

## Epic 5: Polish, Testing & Distribution

**Expanded Goal:** Comprehensive testing across all layers, complete documentation with user guide and examples, performance optimization, and npm packaging for distribution. This epic ensures the system is production-ready.

### Story 5.1: Comprehensive Test Suite

**As a** developer,  
**I want** thorough test coverage,  
**so that** the system is reliable.

**Acceptance Criteria:**

1. Unit tests: 80%+ coverage
2. Integration tests for all workflows (including Epic 2 CLI commands)
3. Mock AI responses for deterministic testing
4. Sample transcripts for process testing
5. All tests passing
6. CI/CD pipeline configured (GitHub Actions)

### Story 5.2: Documentation

**As a** new user,  
**I want** comprehensive documentation,  
**so that** I can learn and use the system effectively.

**Acceptance Criteria:**

1. README.md with: quick start, command reference, architecture overview
2. User guide with workflow examples
3. Agent development guide (BMAD Builder module authoring)
4. Skill development guide (SKILL.md format, process-meeting-note as reference example)
5. SECURITY.md with API key best practices
6. CHANGELOG.md
7. Examples directory with sample workflows
8. `docs/setup/obsidian-setup.md` — Obsidian vault setup, Granola Sync plugin installation, and Obsidian Terminal plugin installation and configuration guide (FR41)

### Story 5.3: Performance Optimization

**As a** user,  
**I want** fast response times,  
**so that** the tool doesn't slow me down.

**Acceptance Criteria:**

1. CLI commands <100ms (excluding AI)
2. Process command handles 20+ files efficiently
3. Progress indicators for operations >500ms
4. File operations are atomic
5. Retry logic with exponential backoff
6. Performance benchmarks documented

### Story 5.4: Error Handling and UX Polish

**As a** user,  
**I want** clear error messages and polished UI,  
**so that** I can recover from issues easily.

**Acceptance Criteria:**

1. All errors have clear messages with recovery suggestions
2. Consistent color scheme (green/yellow/blue/red)
3. Progress spinners with elapsed time
4. Branded welcome message
5. Help text comprehensive
6. Accessibility flags work (--plain, --json)

### Story 5.5: npm Packaging and Distribution

**As a** developer,  
**I want** the package ready for npm,  
**so that** users can install easily.

**Acceptance Criteria:**

1. Package.json finalized
2. Build produces clean dist/
3. Binary executable works: `npx @marlonvidal/tech-manager-os init`
4. .npmignore configured
5. npm package tested locally
6. Ready for publishing

---
