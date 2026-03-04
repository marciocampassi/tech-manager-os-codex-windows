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
   - `/my-teams/_members/{email}/` — Single member profile location
   - `/my-teams/_members/{email}/{email}.md` — Profile file
   - `/my-teams/_members/{email}/1on1s/` — Directory for 1on1 files
   - `/my-teams/_members/{email}/feedback/` — Directory for feedback files
   - `/my-teams/_members/{email}/assessments/` — Directory for assessment files
   - `/my-teams/_members/{email}/performance-reviews/` — Directory for review files
   - `/my-teams/_teams/{team-name}/{team-name}-context.md` — Team-level context
   - `/my-teams/_teams/{team-name}/{team-name}-members.md` — Team member links

2. **`tmr team create <team-name>` Command:**
   - Creates team directory structure
   - Generates `{team-name}-context.md` with frontmatter template
   - Generates `{team-name}-members.md` with "# Team Members" header
   - If no team-name provided, prompts interactively
   - Returns success message with created paths

3. **`tmr team add <team-name> <email> [--role=<role>] [--location=<location>]` Command:**
   - Auto-creates team if doesn't exist
   - If no parameters provided, prompts interactively for: team-name, email, role, location
   - Creates member directory structure (if doesn't exist)
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
   - Adds sections: Current Manager, Previous Managers, Other Leaderships, Previous Leaderships, Performance Reviews, 1on1s, Assessments, Feedbacks
   - Populates "Current Manager" with `[[my-career/{logged-user-email}.md]]`
   - If member already exists in another team, appends team-name to `teams` array
   - Appends wiki-link to team's `{team-name}-members.md`: `- [[../../_members/{email}/{email}.md|{email}]]`
   - Unit tests cover: new member, existing member, interactive mode, auto-team-creation

4. **`tmr team list [team-name]` Command:**
   - Without team-name: displays table of all teams with member counts
   - With team-name: displays table of team members with: email, role, location, date_added
   - Reads from `_teams/*/members.md` and `_members/*/frontmatter`
   - Formats output with aligned columns
   - Unit tests cover: all teams, specific team, empty team

5. **`tmr team archive <team-name> <email> [--from <date>] [--to <date>]` Command:**
   - If no parameters, prompts interactively
   - Moves member directory: `/my-teams/_members/{email}/` → `/my-teams/_archived/{year}/{email}/`
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
   - Searches for email in: `_members/`, `_archived/`, `my-leadership/`, `my-company/relationships/`
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
   - Finds member in `/my-teams/_members/{email}/`
   - Creates file: `1on1s/{date}-{email}-1on1.md` with template:
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
     /my-company/relationships/{email}/
       {email}.md              (profile with frontmatter)
       1on1s/                  (directory)
     ```
   - Profile template includes: name, role, department, relationship_type
   - If email already exists in relationships, returns "already exists" message
   - If no email provided, prompts interactively
   - Unit tests cover: creation, already exists, interactive mode

2. **`tmr relationship add <email-list>` Batch Command:**
   - Accepts comma-separated email list: `user1@example.com,user2@example.com,user3@example.com`
   - Executes `relationship add` for each email
   - Displays progress indicator for multiple emails
   - Summary output: X created, Y already existed
   - Unit tests cover: batch creation, partial success

3. **`tmr relationship <email> add 1on1` Command:**
   - Creates file: `/my-company/relationships/{email}/1on1s/{date}-{email}-1on1.md`
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
     /my-company/projects/{project-name}-project.md
     /my-projects/{project-name}/
       {project-name}-composition.md
       standup/                (directory)
       discussion/             (directory)
       presentation/           (directory)
     ```
   - `{project-name}-project.md` template: project overview, goals, timeline
   - `{project-name}-composition.md` template with sections:
     ```markdown
     # Team Members
     
     # Stakeholders
     ```
   - If no project-name, prompts interactively
   - Unit tests cover: creation, already exists

2. **`tmr project <project-name> add standup` Command:**
   - Creates file: `/my-projects/{project-name}/standup/{date}-{project-name}-standup.md`
   - Template includes: yesterday, today, blockers
   - Unit tests cover: creation

3. **`tmr project <project-name> add discussion` Command:**
   - Creates file: `/my-projects/{project-name}/discussion/{date}-{project-name}-discussion.md`
   - Template includes: topic, attendees, decisions, action items
   - Unit tests cover: creation

4. **`tmr project <project-name> add presentation --topic=<topic>` Command:**
   - Creates file: `/my-projects/{project-name}/presentation/{date}-{project-name}-presentation-{topic}.md`
   - Template includes: slides outline, talking points, Q&A
   - If no topic, prompts interactively
   - Unit tests cover: creation, interactive mode

5. **`tmr project <project-name> link-member <email>` Command:**
   - Uses hierarchical email resolution (see Story 2.6)
   - If email not found anywhere, creates via `tmr relationship add <email>`
   - Appends to composition.md "# Team Members" section: `- [[path-to-email-profile|{email}]]`
   - Determines correct wiki-link path based on email location (team/leadership/relationships)
   - Unit tests cover: existing team member, existing relationship, new email

6. **`tmr project <project-name> link-members <email-list>` Batch Command:**
   - Executes `link-member` for each email in comma-separated list
   - Progress indicator for batch operations
   - Summary: X linked, Y created
   - Unit tests cover: batch linking

7. **`tmr project <project-name> link-stakeholder <email>` Command:**
   - Same logic as link-member
   - Appends to composition.md "# Stakeholders" section
   - Unit tests cover: linking, new email

8. **`tmr project <project-name> link-stakeholders <email-list>` Batch Command:**
   - Batch version of link-stakeholder
   - Unit tests cover: batch linking

9. **`tmr project list` Command:**
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
     1. Check `/my-teams/_members/{email}/` (team member)
     2. Check `/my-leadership/{email}/` (leadership)
     3. Check `/my-company/relationships/{email}/` (relationship)
     4. If not found, execute `tmr relationship add <email>` and return relationship path

2. **Email Validation:**
   - Validates email format before resolution
   - Handles edge cases: empty, malformed, special characters
   - Unit tests cover: valid emails, invalid formats

3. **Path Generator:**
   - Method: `generateWikiLink(email: string, fromPath: string): string`
   - Generates correct Obsidian wiki-link with relative path
   - Example: From `/my-projects/platform/composition.md` to `/my-teams/_members/user@example.com/user@example.com.md` → `[[../../my-teams/_members/user@example.com/user@example.com.md|user@example.com]]`
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

## Epic 4: People Management Agent System

**Expanded Goal:** Implement people-focused agent commands for 1:1 preparation, feedback generation, PDP creation/updates, PIP management, and performance reviews. All agent commands leverage Epic 2 CLI for file manipulation, enabling token-optimized context operations where agents generate content and invoke CLI commands rather than directly reading/parsing files. This epic delivers intelligent assistance for the complete people management lifecycle.

### Story 4.1: Profile Collection Workflow

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

## Epic 5: Leader's Career & Leadership Agent System

**Expanded Goal:** Enable managers to track their own career development with agent-assisted PDP management, brag document summarization, self-review generation, and leadership alignment tracking. All agent commands use Epic 2 CLI for file operations, ensuring consistent token-optimized operations. This epic ensures managers don't neglect their own growth.

### Story 5.1: Manager Career Commands

**As a** manager,  
**I want** to manage my own career development,  
**so that** I'm intentional about my growth.

**Acceptance Criteria:**

1. `tmr my profile` opens profile in editor
2. `tmr my pdp` opens PDP in editor
3. Brag document managed manually (no commands)
4. Files created during `tmr init` with suggested brag structure
5. Unit tests for profile/pdp commands

### Story 5.2: tmr-career Agent - PDP Management

**As a** manager,  
**I want** AI to help with my own PDP,  
**so that** I have a clear development plan.

**Acceptance Criteria:**

1. Agent command: `*pdp-generate`
2. Reads: my-career/profile.md, my-leadership/profile.md
3. Generates PDP aligned with leader's expectations
4. Agent command: `*pdp-update` suggests updates
5. Outputs to: `my-career/pdp.md`
6. Uses template: `manager-pdp-tmpl.yaml`
7. Integration test validates alignment

### Story 5.3: tmr-career Agent - Brag Document and Self-Review

**As a** manager,  
**I want** AI to help summarize my achievements,  
**so that** I'm prepared for performance reviews.

**Acceptance Criteria:**

1. Agent command: `*brag-summarize`
2. Analyzes brag document entries
3. Generates summary by category: impact, leadership, technical
4. Agent command: `*self-review <period>`
5. Generates self-review draft from brag document and PDP
6. Integration test validates quality

### Story 5.4: Leadership Alignment Tracking

**As a** manager,  
**I want** my 1:1s with my leader tracked,  
**so that** I maintain alignment.

**Acceptance Criteria:**

1. Process agent recognizes transcripts with leader (based on my-leadership/profile.md)
2. **Uses CLI:** Executes `tmr leadership <email> add 1on1`
3. Updates manager's context with alignment notes
4. Flags misalignment with PDP
5. Integration test validates categorization

---

## Epic 6: Project Management Agent System

**Expanded Goal:** Implement project-focused agent commands for status reporting, risk assessment, and stakeholder communication. All agent commands leverage Epic 2 CLI for project structure management and team composition updates. This epic extends beyond people management to cover the operational aspects of project delivery.

### Story 6.1: Project Lifecycle Commands

**As a** manager,  
**I want** to view project information and status,  
**so that** I can track my project portfolio.

**Note:** Project creation commands are in Epic 2, Story 2.5. This story focuses on viewing and display commands.

**Acceptance Criteria:**

1. `tmr project list` displays table (implemented in Epic 2)
2. `tmr project show <name>` displays full project context
3. `tmr show <project>` displays context (implemented in Epic 2)
4. Unit tests for display commands

### Story 6.2: tmr-project Agent - Status Reports

**As a** manager,  
**I want** AI to generate weekly status reports,  
**so that** I can quickly communicate project health.

**Acceptance Criteria:**

1. Agent command: `*status-report <project>`
2. Reads: context.md, meetings, related member contexts
3. Generates report: progress, risks, team capacity, next steps
4. **Uses CLI:** Executes `tmr project <project-name> add standup` or creates custom report file
5. Uses template: `status-report-tmpl.yaml`
6. Integration test validates report quality

### Story 6.3: tmr-project Agent - Risk Assessment

**As a** manager,  
**I want** AI to assess project risks,  
**so that** I can proactively mitigate issues.

**Acceptance Criteria:**

1. Agent command: `*risk-assessment <project>`
2. Analyzes recent context and identifies risks
3. Generates assessment: risk list, severity, mitigation strategies
4. Outputs to: `projects/active/{project}/risk-assessments/{date}.md`
5. Integration test validates risk identification

### Story 6.4: Hiring Workflow

**As a** manager,  
**I want** to manage hiring pipelines,  
**so that** I can track candidates systematically.

**Acceptance Criteria:**

1. `tmr hiring open <role-and-seniority>` creates job description (auto-generated based on role/seniority)
2. Interview transcripts auto-categorized by process agent to candidate folders
3. `tmr hiring list` displays open positions
4. Process agent creates candidate folders automatically
5. Unit tests for all commands

### Story 6.5: tmr-hiring Agent - Candidate Reviews

**As a** manager,  
**I want** AI to help review candidates,  
**so that** I make informed hiring decisions.

**Acceptance Criteria:**

1. Agent command: `*candidate-review <candidate> --approved=true|false`
2. Reads: interview transcripts, job description, culture values
3. Generates review: technical assessment, culture fit, recommendation
4. Outputs to: `operations/hiring/{role}/candidates/{name}/candidate-review.md`
5. Integration test validates review quality

### Story 6.6: Operations and Knowledge Base

**As a** manager,  
**I want** structured places for operational information,  
**so that** everything has a home.

**Acceptance Criteria:**

1. Process agent categorizes: leadership meetings, company meetings, post-mortems to multi-level locations
2. Knowledge base entries placed manually by user
3. Binary files moved to `knowledge-base/files/` by process agent
4. Knowledge base consulted by agents when relevant
5. Integration test validates categorization

---

## Epic 7: Agent System & BMAD Builder Integration

**Expanded Goal:** Build the complete agent and skill system using the BMAD Builder framework as the foundational engine. Implement all tmr-* agent definitions as BMAD-compliant modules, author the `process-meeting-note` skill for intelligent Granola note routing, create IDE integration files for Cursor/Claude/Gemini/GitHub Copilot, and deliver SKILL.md-based extensibility aligned with the BMAD Method module specification. This epic replaces the previously planned custom Pack Engine with BMAD Builder.

### Story 7.1: BMAD Builder Module Structure Setup

**As a** developer,  
**I want** the `.tm-core/` system structured as a BMAD Builder-compliant module,  
**so that** all agents and skills follow a standardized, extensible format.

**Acceptance Criteria:**

1. `.tm-core/` directory organized per BMAD module specification:
   - `agents/` — BMAD agent definition files
   - `skills/` — BMAD SKILL.md workflow files
   - `tasks/` — Task definition files
   - `templates/` — Output templates
   - `core-config.yaml` — Module configuration
2. Module structure validated against BMAD Builder spec
3. `tmr init` generates this structure in the workspace
4. Unit tests verify directory creation and file presence

### Story 7.2: `process-meeting-note` BMAD Skill

**As a** manager,  
**I want** Granola-synced meeting notes intelligently routed to the correct folders,  
**so that** my workspace organizes itself from my meeting transcripts.

**Acceptance Criteria:**

1. `process-meeting-note.md` SKILL.md file created in `.tm-core/skills/`
2. Skill parses Granola frontmatter: `granola_id`, `attendees`, `date`, `title`, `type`
3. Identifies all email addresses in attendees and content
4. Generates `[[@email@domain.com]]` wiki-links for all identified persons
5. Determines destination category using priority order: Granola `type` field → attendee pattern → content keywords (see FR42 Routing Decision Table)
6. **Confidence-gated routing:** When confidence is below threshold, presents proposed destination + rationale to user and awaits confirmation before any file is written; high-confidence decisions are applied automatically and shown in the processing summary with rationale
7. **Single-pass manifest:** Produces one AI call per transcript yielding a structured change manifest `{ primary, appends[], task_extracts }` — only the transcript and profile frontmatter (not full context files) are loaded as AI input; the CLI code applies all writes atomically after the AI call completes
8. **Append-only context updates:** Secondary `context.md` files receive a dated excerpt block appended at the end of the file; the AI does not read existing context file content; users manage cleanup manually
9. Distributes content updates across all affected entity context files using the standard append entry format (see FR42)
10. Creates or updates `{email}.md` identity file for any new email encountered; unknown persons with no team/project match are auto-created in `my-company/relationships/{email}/`
11. Generated primary meeting note files include standard frontmatter + `> Connections:` callout (see FR42 header format)
12. **Archive original:** After processing, moves the inbox file to `archive/{year}/{month}/inbox/{original-filename}.md` with `processed: true` and `routed_to: [...]` added to frontmatter
13. **Folder philosophy communicated:** Processing summary explicitly states when a team member's meeting note is filed under `my-projects/` or `my-company/` (not their personal folder), so routing rationale is transparent to the user
14. **Optional process log:** When `process_log: true` is set in config, appends a structured run entry to `my-tasks/process-log.md`; default is `false`
15. Integration tests with sample Granola-format notes covering: simple 1:1, team meeting, project meeting with external attendees, and unknown-person scenario

### Story 7.3: Template Engine with Variable Injection

**As a** developer,  
**I want** to inject variables into agent prompts and templates,  
**so that** commands are context-aware.

**Acceptance Criteria:**

1. `TemplateService` with method: `render(template, variables)`
2. Uses Handlebars for templating
3. Variable sources: file paths, keywords, computed values
4. Handles missing variables gracefully
5. Security: sandboxed execution
6. Unit tests cover injection scenarios

### Story 7.4: Agent Definitions

**As a** manager using an IDE,  
**I want** to invoke specialized agents,  
**so that** I get domain-specific assistance.

**Acceptance Criteria:**

1. All agents defined in `.tm-core/agents/`:
   - process-agent.md (renamed from cycle-agent)
   - tmr-people.md
   - tmr-project.md
   - tmr-career.md
   - tmr-hiring.md
   - tmr-master.md
2. Each agent has: persona, commands, dependencies
3. Documentation includes usage examples
4. Agent files created during `tmr init`

### Story 7.5: IDE Integration Files

**As a** manager,  
**I want** agents available in my IDE,  
**so that** I can use them naturally in my workflow.

**Acceptance Criteria:**

1. `.cursor/rules/tm/*.mdc` files generated
2. `.claude/agents/*.md` files generated
3. `.gemini/agents/*.md` files generated
4. `.github/copilot/skills/*.md` files generated
5. Files include agent definition and command reference
6. Files created during `tmr init`
7. Integration test validates file structure

### Story 7.6: BMAD Core Module — Base Skills and Tasks

**As a** product manager,  
**I want** a comprehensive set of base BMAD skills and tasks,  
**so that** users get immediate value out of the box.

**Acceptance Criteria:**

1. All core skills created in `.tm-core/skills/`:
   - `process-meeting-note.md` — Granola note routing (see Story 7.2)
   - `process-workflow.md` — Full inbox processing workflow (renamed from cycle-workflow)
   - `collect-profile.md` — Team member profile collection
   - `onboarding-manager.md` — Leader onboarding workflow
   - `archive-workflow.md` — Archive/fire member workflow
2. All core tasks created in `.tm-core/tasks/`:
   - `prepare-1on1.md`, `generate-feedback.md`, `create-pip.md`, `generate-pdp.md`
   - `project-status-report.md`, `project-risk-assessment.md`
   - `candidate-review.md`, `update-tasks-context.md`, `categorize-note.md`
3. All skills/tasks follow BMAD module specification format
4. Generated during `tmr init`
5. Integration test validates all skill/task files are present and parseable

---

## Epic 8: Polish, Testing & Distribution

**Expanded Goal:** Comprehensive testing across all layers, complete documentation with user guide and examples, IDE integration validation, performance optimization, and npm packaging for distribution. This epic ensures the system is production-ready.

### Story 8.1: Comprehensive Test Suite

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

### Story 8.2: Documentation

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

### Story 8.3: Performance Optimization

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

### Story 8.4: Error Handling and UX Polish

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

### Story 8.5: npm Packaging and Distribution

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
