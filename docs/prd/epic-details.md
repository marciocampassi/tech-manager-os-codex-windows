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

## Epic 2: Process Intelligence Engine

**Expanded Goal:** Build the AI-powered cycle agent that powers the `tmr process` command to process inbox files, categorizes them by type and entity, updates context summaries using intelligent merging, extracts actionable tasks with urgency classification, and moves files to appropriate destinations. This epic delivers the core "transcript-to-context" value proposition.

### Story 2.1: Inbox Scanner and File Parser

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

### Story 2.2: AI-Powered Categorization Logic

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

### Story 2.3: Context Summary Merging

**As a** manager,  
**I want** context summaries intelligently updated with new information,  
**so that** I have current, accurate context for each person/project.

**Acceptance Criteria:**

1. `ContextService` class with method: `updateContext(entityPath, existingContext, newInsights)`
2. AI prompt merges new insights with existing context:
   - Preserves important historical information
   - Updates with new information
   - Maintains chronological awareness
   - Highlights changes in behavior/status
3. Handles first-time context creation
4. Prevents context from growing unbounded (summarization strategy)
5. Unit tests with various merge scenarios

### Story 2.4: Task Extraction and Timeline Classification

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

### Story 2.5: File Organization and Movement

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

### Story 2.6: `tmr process` Command Implementation

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

### Story 2.7: `tmr watch` Command for Auto-Processing

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

## Epic 3: People Management System

**Expanded Goal:** Implement complete people management lifecycle including member addition/archival, profile collection workflows, and all agent commands for 1:1 preparation, feedback generation, PDI creation/updates, PIP management, and performance reviews. This epic enables managers to effectively support their team's growth.

### Story 3.1: Team Member Lifecycle Commands

**As a** manager,  
**I want** to manage my team member roster,  
**so that** I can track active and past team members.

**Acceptance Criteria:**

1. `tmr team add <team-name> <member-email>` creates structure:
   - `my-teams/{team-name}/{member-email}/profile.md` (with frontmatter template)
   - `my-teams/{team-name}/{member-email}/context.md` (empty, will be AI-maintained)
   - `my-teams/{team-name}/{member-email}/pdp.md` (template)
   - Subdirectories: `1on1s/`, `feedback/`, `reviews/`
2. `tmr team list` displays table with: name, email, role, last 1:1, status
3. `tmr team archive <team-name> <member-email> [--from --to]` moves to `my-teams/archived/{year}/`
4. `tmr team fire <team-name> <member-email>` archives with termination marker
5. `tmr show <member-email>` displays context summary
6. Unit tests for all commands

### Story 3.2: Profile Collection Workflow

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

### Story 3.3: tmr-people Agent - 1:1 Preparation

**As a** manager,  
**I want** AI to generate 1:1 agendas based on context,  
**so that** my meetings are productive and well-prepared.

**Acceptance Criteria:**

1. Agent command: `*1on1-prepare <member>`
2. Reads: context.md, pdi.md, recent 1on1s, recent feedback, tasks/today.md, related project contexts
3. Generates agenda with sections:
   - Check-in
   - Follow-ups from last session
   - Current challenges/support needed
   - PDI progress
   - New discussion topics
   - Action items
4. Outputs to: `people/active/{member}/1on1s/{date}.md`
5. Uses template: `1on1-session-tmpl.yaml`
6. Integration test with sample context

### Story 3.4: tmr-people Agent - Feedback Generation

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
4. Outputs to: `people/active/{member}/feedback/{date}-{tone}.md`
5. Manager reviews before delivery
6. Integration test validates generation

### Story 3.5: tmr-people Agent - PDP Management

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

### Story 3.6: tmr-people Agent - PIP and Performance Reviews

**As a** manager,  
**I want** AI assistance with PIPs and performance reviews,  
**so that** these critical documents are thorough and fair.

**Acceptance Criteria:**

1. Agent command: `*pip-create <member>`
2. Generates PIP with: issues, improvement plan, timeline, consequences
3. Agent command: `*review-generate <member> --period=<quarter>`
4. Generates review with: summary, accomplishments, growth areas, PDI progress, goals
5. Both use comprehensive context analysis
6. Manager reviews/edits before finalizing
7. Integration test validates document quality

---

## Epic 4: Manager's Career & Leadership Tracking

**Expanded Goal:** Enable managers to track their own career development with equal rigor as team management. Implement PDP creation/updates, brag document logging, self-review generation, and leadership alignment tracking. This epic ensures managers don't neglect their own growth.

### Story 4.1: Manager Career Commands

**As a** manager,  
**I want** to manage my own career development,  
**so that** I'm intentional about my growth.

**Acceptance Criteria:**

1. `tmr my profile` opens profile in editor
2. `tmr my pdp` opens PDP in editor
3. Brag document managed manually (no commands)
4. Files created during `tmr init` with suggested brag structure
5. Unit tests for profile/pdp commands

### Story 4.2: tmr-career Agent - PDP Management

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

### Story 4.3: tmr-career Agent - Brag Document and Self-Review

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

### Story 4.4: Leadership Alignment Tracking

**As a** manager,  
**I want** my 1:1s with my leader tracked,  
**so that** I maintain alignment.

**Acceptance Criteria:**

1. Process agent recognizes transcripts with leader (based on my-leadership/profile.md)
2. Files them in: `my-leadership/alignments/{date}.md`
3. Updates manager's context with alignment notes
4. Flags misalignment with PDP
5. Integration test validates categorization

---

## Epic 5: Project Management & Operations

**Expanded Goal:** Implement project lifecycle management, status reporting, risk assessment, and operational workflows for hiring, rituals, and knowledge base management. This epic extends beyond people management to cover the full scope of a manager's responsibilities.

### Story 5.1: Project Lifecycle Commands

**As a** manager,  
**I want** to manage my project portfolio,  
**so that** I can track active and completed projects.

**Acceptance Criteria:**

1. `tmr project add <name>` creates structure with brief.md template in `my-projects/`
2. `tmr project list` displays table
3. `tmr project archive <name> [--from --to]` moves to archived with optional date filters
4. `tmr show <project>` displays context
5. Unit tests for all commands

### Story 5.2: tmr-project Agent - Status Reports

**As a** manager,  
**I want** AI to generate weekly status reports,  
**so that** I can quickly communicate project health.

**Acceptance Criteria:**

1. Agent command: `*status-report <project>`
2. Reads: context.md, meetings, related member contexts
3. Generates report: progress, risks, team capacity, next steps
4. Outputs to: `projects/active/{project}/status-reports/{date}.md`
5. Uses template: `status-report-tmpl.yaml`
6. Integration test validates report quality

### Story 5.3: tmr-project Agent - Risk Assessment

**As a** manager,  
**I want** AI to assess project risks,  
**so that** I can proactively mitigate issues.

**Acceptance Criteria:**

1. Agent command: `*risk-assessment <project>`
2. Analyzes recent context and identifies risks
3. Generates assessment: risk list, severity, mitigation strategies
4. Outputs to: `projects/active/{project}/risk-assessments/{date}.md`
5. Integration test validates risk identification

### Story 5.4: Hiring Workflow

**As a** manager,  
**I want** to manage hiring pipelines,  
**so that** I can track candidates systematically.

**Acceptance Criteria:**

1. `tmr hiring open <role-and-seniority>` creates job description (auto-generated based on role/seniority)
2. Interview transcripts auto-categorized by process agent to candidate folders
3. `tmr hiring list` displays open positions
4. Process agent creates candidate folders automatically
5. Unit tests for all commands

### Story 5.5: tmr-hiring Agent - Candidate Reviews

**As a** manager,  
**I want** AI to help review candidates,  
**so that** I make informed hiring decisions.

**Acceptance Criteria:**

1. Agent command: `*candidate-review <candidate> --approved=true|false`
2. Reads: interview transcripts, job description, culture values
3. Generates review: technical assessment, culture fit, recommendation
4. Outputs to: `operations/hiring/{role}/candidates/{name}/candidate-review.md`
5. Integration test validates review quality

### Story 5.6: Operations and Knowledge Base

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

## Epic 6: Agent System & BMAD Builder Integration

**Expanded Goal:** Build the complete agent and skill system using the BMAD Builder framework as the foundational engine. Implement all tmr-* agent definitions as BMAD-compliant modules, author the `process-meeting-note` skill for intelligent Granola note routing, create IDE integration files for Cursor/Claude/Gemini/GitHub Copilot, and deliver SKILL.md-based extensibility aligned with the BMAD Method module specification. This epic replaces the previously planned custom Pack Engine with BMAD Builder.

### Story 6.1: BMAD Builder Module Structure Setup

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

### Story 6.2: `process-meeting-note` BMAD Skill

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

### Story 6.3: Template Engine with Variable Injection

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

### Story 6.4: Agent Definitions

**As a** manager using an IDE,  
**I want** to invoke specialized agents,  
**so that** I get domain-specific assistance.

**Acceptance Criteria:**

1. All agents defined in `.tm-core/agents/`:
   - cycle-agent.md
   - tmr-people.md
   - tmr-project.md
   - tmr-career.md
   - tmr-hiring.md
   - tmr-master.md
2. Each agent has: persona, commands, dependencies
3. Documentation includes usage examples
4. Agent files created during `tmr init`

### Story 6.5: IDE Integration Files

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

### Story 6.6: BMAD Core Module — Base Skills and Tasks

**As a** product manager,  
**I want** a comprehensive set of base BMAD skills and tasks,  
**so that** users get immediate value out of the box.

**Acceptance Criteria:**

1. All core skills created in `.tm-core/skills/`:
   - `process-meeting-note.md` — Granola note routing (see Story 6.2)
   - `cycle-workflow.md` — Full inbox processing workflow
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

## Epic 7: Polish, Testing & Distribution

**Expanded Goal:** Comprehensive testing across all layers, complete documentation with user guide and examples, IDE integration validation, performance optimization, and npm packaging for distribution. This epic ensures the system is production-ready.

### Story 7.1: Comprehensive Test Suite

**As a** developer,  
**I want** thorough test coverage,  
**so that** the system is reliable.

**Acceptance Criteria:**

1. Unit tests: 80%+ coverage
2. Integration tests for all workflows
3. Mock AI responses for deterministic testing
4. Sample transcripts for cycle testing
5. All tests passing
6. CI/CD pipeline configured (GitHub Actions)

### Story 7.2: Documentation

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

### Story 7.3: Performance Optimization

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

### Story 7.4: Error Handling and UX Polish

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

### Story 7.5: npm Packaging and Distribution

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
