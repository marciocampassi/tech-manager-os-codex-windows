# Tech Manager OS Product Requirements Document (PRD)

## Goals and Background Context

### Goals

- Create a **local-first workspace system** that serves as an "Operating System" for Engineering Managers
- Solve **"Management Entropy"** (lost context, scattered notes, recency bias) by treating management artifacts as organized, AI-enhanced context
- Implement **"Agent-as-Intelligence"** where AI agents provide management assistance through specialized personas, not hardcoded features
- Enable **"Transcript-to-Context"** workflow where meeting transcripts are automatically categorized and filed into the appropriate contexts
- Provide **zero-latency insight** through CLI + IDE integration with structured local file system
- Support **"Agnostic Intelligence (BYOK)"** where users bring their own API Keys (OpenAI, Claude, or Gemini)
- Deliver an MVP focused on **People Management + Project Management + Manager's Career**
- Build an **extensible system** with methodology packs allowing community-driven management styles
- Enable **managers to manage themselves** with equal attention to their own career development

### Background Context

Engineering managers face chronic problems across multiple dimensions:

1. **Team Context Loss:** Critical information about team members gets scattered across notes, Slack, emails. When it's time for 1:1s or reviews, managers scramble to remember what happened weeks ago.

2. **Project Status Amnesia:** Weekly status meetings require reconstructing what happened from fragmented notes, leading to inaccurate reporting and missed risks.

3. **Manager's Own Career Neglect:** While tracking team development religiously, managers often neglect their own PDPs, brag documents, and career conversations with their leaders.

4. **Transcript Overload:** Meeting recordings generate transcripts that sit unused because there's no system to extract value and file them appropriately.

5. **Operational Context Sprawl:** Hiring pipelines, leadership meeting notes, company announcements, and incident post-mortems all live in different tools with no unified context.

Tech Manager OS solves this by:
- **Inbox-First Capture:** Drop any transcript or note into `inbox/`, run `tm cycle`, and AI categorizes everything
- **Context Maintenance:** AI maintains running summaries for each person, project, and operational area
- **Agent-Driven Intelligence:** Specialized agents (People Manager, Project Manager, Career Coach, Hiring Manager) provide domain expertise
- **Local-First Privacy:** All data stays local, no vendor lock-in, full ownership
- **IDE-Native Workflow:** Agents work naturally in Cursor, Claude Code, Gemini CLI

### Change Log

| Date | Version | Description | Author |
|------|---------|-------------|---------|
| 2026-02-08 | 3.0 | Complete architecture redesign: Agent-based system, expanded to manager's career + operations | Mary (Analyst) + John (PM) |
| 2026-01-29 | 2.0 | Initial PRD draft for "Methodology-as-Code" edition | John (PM) |

---

## Requirements

### Functional Requirements

#### Core System (FR1-FR8)

**FR1:** The system shall provide a `tm init` command that:
- Runs an interactive onboarding workflow to collect manager's profile, career goals, and leadership context
- Creates complete directory structure (`inbox/`, `people/`, `projects/`, `my-career/`, `my-leadership/`, `operations/`, `knowledge-base/`, `tasks/`, `archive/`)
- Generates IDE integration files (`.cursor/rules/tm/`, `.claude/agents/`, `.gemini/agents/`)
- Creates initial profile and PDP templates for the manager

**FR2:** The system shall support interactive AI provider selection during `tm init`, allowing users to choose between OpenAI, Anthropic (Claude), and Google Gemini as their AI provider.

**FR3:** The system shall securely store API keys for the selected AI provider using encrypted configuration management in OS-specific directories.

**FR4:** The system shall provide a `tm cycle` command that:
- Scans `inbox/` for all text files (.txt, .md, .json)
- Uses AI to categorize each file by type (1:1, feedback, project status, meeting notes, hiring, etc.)
- Identifies which people and/or projects each file relates to
- Updates context summaries for affected entities
- Moves files to appropriate destination folders
- Extracts actionable tasks and updates `tasks/today.md`, `tasks/this-week.md`, `tasks/this-month.md`, `tasks/this-quarter.md`
- Provides summary of changes and suggested actions

**FR5:** The system shall provide a `tm watch` command that monitors the `inbox/` directory and automatically runs `tm cycle` when new files are detected.

**FR6:** The system shall maintain AI-enhanced context summaries:
- `people/active/{member}/context.md` - Running summary of all interactions with team member
- `projects/active/{project}/context.md` - Running summary of all project activity
- `my-career/profile.md` - Manager's own profile and development areas
- `my-leadership/profile.md` - Manager's leader's expectations and style

**FR7:** The system shall provide time-based task views:
- `tm today` - Display urgent tasks, scheduled 1:1s, and attention items for today
- `tm this-week` - Display weekly priorities, people check-ins, and project milestones
- `tm this-month` - Display monthly objectives and key deadlines
- `tm this-quarter` - Display quarterly goals and strategic initiatives

**FR8:** The system shall implement an Agent System with specialized personas:
- **cycle-agent**: Inbox processing and intelligent categorization
- **pm-people**: People management (1:1s, feedback, PDI, PIP, reviews)
- **pm-project**: Project management (status reports, risk assessments, health checks)
- **pm-career**: Manager's own career development (PDP, brag document, self-reviews)
- **pm-hiring**: Recruitment support (candidate reviews, job descriptions, interview guides)
- **tm-master**: All-in-one agent for web platform usage

#### People Management (FR9-FR16)

**FR9:** The system shall provide `tm people add <name>` to create team member structure including:
- `profile.md` with frontmatter template (role, skills, current projects)
- `context.md` for AI-maintained interaction summary
- `pdi.md` for Personal Development & Improvement plan
- Subdirectories: `1on1s/`, `feedback/`, `reviews/`

**FR10:** The system shall provide `tm people collect-profile <name>` to generate an interactive profile collection prompt that can be shared with team members to gather structured information about their background, skills, work style, and career goals.

**FR11:** The system shall provide `tm people archive <name>` to move a team member to `people/archived/{year}/` when they leave the company, preserving all historical context.

**FR12:** The system shall provide `tm people fire <name>` as a distinct operation from archive, marking the departure reason and handling PIP documentation.

**FR13:** The system shall provide agent commands for people management:
- `*1on1-prepare <member>` - Generate 1:1 agenda from context, PDI, recent feedback, and tasks
- `*feedback <member> --tone=positive|constructive` - Generate feedback draft based on context
- `*pdi-generate <member>` - Create structured Personal Development & Improvement plan
- `*pdi-update <member>` - Update PDI with progress and new goals
- `*pip-create <member>` - Create Performance Improvement Plan
- `*review-generate <member> --period=<quarter>` - Generate performance review draft

**FR14:** The system shall support a structured PDI format including:
- Current role and aspirations
- 3-5 development goals with success criteria
- Action plans for each goal
- Progress tracking
- Support needed from manager and team
- Timeline and check-in schedule

**FR15:** The system shall track member-project relationships through frontmatter in both `people/active/{member}/profile.md` and `projects/active/{project}/brief.md`.

**FR16:** The system shall provide `tm show <member>` to display current context summary, recent 1:1s, active PDI goals, and upcoming check-ins for a team member.

#### Project Management (FR17-FR22)

**FR17:** The system shall provide `tm project add <name>` to create project structure including:
- `brief.md` with frontmatter template (team, timeline, status, priority)
- `context.md` for AI-maintained project summary
- Subdirectories: `status-reports/`, `risk-assessments/`, `meetings/`

**FR18:** The system shall provide `tm project archive <name>` to move completed projects to `projects/archived/{year}/`.

**FR19:** The system shall provide agent commands for project management:
- `*status-report <project>` - Generate weekly status report from context and meetings
- `*risk-assessment <project>` - Assess current project risks and mitigation strategies
- `*health-check <project>` - Comprehensive project health analysis

**FR20:** The system shall provide `tm show <project>` to display current context, recent status reports, risk assessments, and team allocation.

**FR21:** Status reports shall include: progress this week, risks and blockers, team capacity, next week's plan, budget status (if applicable).

**FR22:** Risk assessments shall include: identified risks with severity scoring, impact analysis, mitigation strategies, owner assignment.

#### Manager's Career (FR23-FR27)

**FR23:** The system shall create `my-career/` directory during initialization containing:
- `profile.md` - Manager's own background, management style, strengths, development areas
- `pdp.md` - Personal Development Plan aligned with manager's leader expectations
- `brag-document.md` - Running log of achievements, wins, and impact for performance reviews

**FR24:** The system shall provide agent commands for career management:
- `*pdp-generate` - Create Personal Development Plan for the manager
- `*pdp-update` - Update PDP with progress
- `*brag-summarize` - Summarize achievements from brag document
- `*self-review <period>` - Draft self-performance review

**FR25:** The system shall provide CLI commands for brag document:
- `tm my brag add <achievement>` - Quick log achievement
- `tm my brag view` - Display brag document

**FR26:** The system shall create `my-leadership/` directory containing:
- `profile.md` - Manager's leader's expectations, communication style, priorities
- `alignments/` - Transcripts and notes from 1:1s with manager

**FR27:** The cycle agent shall recognize and categorize 1:1 transcripts with manager's leader, filing them in `my-leadership/alignments/` and updating both manager's context and PDP alignment.

#### Operations (FR28-FR34)

**FR28:** The system shall provide `tm hiring open <role-and-seniority>` to create hiring pipeline structure:
- `operations/hiring/{role}/job-description.md`
- `operations/hiring/{role}/candidates/` directory

**FR29:** The system shall provide `tm hiring candidate add <role> <name>` to create candidate folder structure for tracking interviews and communications.

**FR30:** The system shall provide agent command `*candidate-review <candidate> --approved=true|false` to generate comprehensive candidate assessment including technical evaluation, culture fit, recommendation, and onboarding notes.

**FR31:** The system shall create `operations/rituals/` with subdirectories:
- `leadership/` - Company leadership meetings, strategy sessions
- `company/` - All-hands, townhalls, company-wide announcements

**FR32:** The cycle agent shall categorize meeting transcripts into appropriate ritual folders based on content and participants.

**FR33:** The system shall provide `operations/incidents/post-mortems/` for incident documentation and learnings.

**FR34:** The system shall provide `operations/finance/` for budget-related notes and tracking.

#### Knowledge Base (FR35-FR37)

**FR35:** The system shall create `knowledge-base/` structure:
- `people/` - Company culture, values, onboarding processes
- `process/` - Performance review process, promotion criteria, incident response
- `company/` - Strategy, org chart, department information
- `methodology.md` - Manager's personal management philosophy and style

**FR36:** The system shall provide `tm kb add <category> <title>` to create new knowledge base entries.

**FR37:** The cycle agent may reference knowledge base entries when generating outputs (e.g., culture fit in candidate reviews, process adherence in performance reviews).

#### Pack System & Extensibility (FR38-FR40)

**FR38:** The system shall implement a Prompt Pack Engine that parses YAML files defining:
- Agent commands with descriptions
- Input variable definitions and sources
- AI prompts (system, user, temperature, max_tokens)
- Output specifications (file paths, formats, templates)

**FR39:** The system shall validate all Prompt Pack YAML files against a defined schema using Zod, checking:
- Schema compliance
- Variable references match declared inputs
- Output paths are valid
- No command name conflicts

**FR40:** The system shall generate `base-pack.yaml` during initialization providing core management methodology commands.

### Non-Functional Requirements

**NFR1:** The system shall run as a local-first application without requiring external cloud services except for user-provided AI API endpoints.

**NFR2:** The system shall be cross-platform compatible, supporting Mac, Linux, and Windows operating systems.

**NFR3:** The system shall implement the Adapter Pattern for AI providers, ensuring loose coupling and enabling addition of new providers without modifying core logic.

**NFR4:** The system shall use safe file operations to ensure atomic writes and prevent data loss during state transitions.

**NFR5:** The system shall provide clear terminal UI feedback using spinners (ora), colored output (chalk), and progress indicators for enhanced user experience.

**NFR6:** The system shall store all management data as plain Markdown files with YAML frontmatter in a human-readable, version-control-friendly format.

**NFR7:** The system shall maintain zero external dependencies for data storage, ensuring users retain full ownership and portability of their data.

**NFR8:** The system shall complete the `tm cycle` command processing within reasonable time bounds, scaling to handle up to 20 inbox files without performance degradation.

**NFR9:** The system shall implement graceful error handling for AI API failures, providing clear error messages with recovery suggestions.

**NFR10:** The system shall validate Prompt Pack YAML structure using Zod schema validation before execution to prevent runtime errors.

**NFR11:** The system shall be distributed as `@marlonvidal/tech-manager-os` on npm with the binary command `tm`.

**NFR12:** The system shall support IDE integration for Cursor (.cursor/rules/), Claude Code (.claude/agents/), and Gemini CLI (.gemini/agents/).

**NFR13:** CLI commands should respond in <100ms (excluding AI calls). AI operations should show progress indicators after 500ms.

**NFR14:** The system shall use AES-256 encryption for API keys stored in OS-specific config directories.

**NFR15:** The system shall support environment variable overrides (`TM_PROVIDER`, `TM_API_KEY`) for configuration.

---

## User Interface Design Goals

### Overall UX Vision

Tech Manager OS embraces a **hybrid workflow**: lightweight CLI for data capture and organization, powerful IDE agents for intelligence and document generation. The philosophy is **"Capture anywhere, think everywhere"** - drop transcripts in inbox, run cycle, then leverage agents in your IDE when you need AI assistance.

The system should feel like a **natural extension of how managers already work**: meetings generate transcripts, transcripts go into a folder, the system organizes everything and makes it retrievable when needed.

### Key Interaction Paradigms

**CLI Commands (Data Operations):**
- **Instant capture**: No friction between thought and storage
- **Clear organization**: Predictable file structure, easy to navigate
- **Informative feedback**: Show what happened, what changed, what needs attention
- **Time-based views**: `today`, `this-week`, `this-month`, `this-quarter` for temporal context

**IDE Agents (Intelligence Operations):**
- **Natural language**: Invoke agents like talking to a colleague (`@pm-people *1on1-prepare sarah`)
- **Context-aware**: Agents automatically load relevant files
- **Draft generation**: AI produces human-quality drafts for manager to review/edit
- **Iterative refinement**: Agents can refine outputs based on feedback

### Core Workflows

#### Workflow 1: Manager Onboarding (First Run)

```bash
tm init

# Interactive wizard:
# - Welcome & AI provider setup
# - Collect manager's profile (name, role, experience, management style)
# - Define career goals and development areas
# - Capture leadership context (who's your manager, their expectations)
# - Create workspace structure
# - Generate IDE integration files
# - Display next steps
```

**Output:**
- Complete folder structure created
- Manager's profile and initial PDP drafted
- Leader profile template created
- All IDE integration files generated (`.cursor/`, `.claude/`, `.gemini/`)
- Configuration saved and encrypted

#### Workflow 2: Daily Routine - Inbox Processing

```bash
# User drops files in inbox/ throughout day/week:
# - Meeting transcripts (txt, md, json)
# - Quick notes
# - Email copies
# - Interview recordings (transcribed)

tm cycle

# AI processes each file:
# - Categorizes by type (1:1, project meeting, leadership sync, hiring, etc.)
# - Identifies people and projects mentioned
# - Updates context summaries
# - Extracts actionable tasks
# - Moves files to appropriate folders
# - Suggests follow-up actions
```

**Output:**
- Summary of files processed and where they went
- List of contexts updated (people, projects)
- Urgent actions flagged
- Task lists updated (today/week/month/quarter)

#### Workflow 3: Preparing for 1:1 (IDE)

```bash
# In Cursor/Claude/Gemini
@pm-people *1on1-prepare sarah-chen

# Agent automatically reads:
# - people/active/sarah-chen/context.md
# - people/active/sarah-chen/pdi.md
# - people/active/sarah-chen/1on1s/*.md (recent sessions)
# - people/active/sarah-chen/feedback/*.md
# - tasks/today.md and tasks/this-week.md
# - Related project contexts

# Generates comprehensive agenda:
# - Check-in topics
# - Follow-ups from last session
# - Current challenges/support needs
# - PDI progress review
# - New discussion points
# - Suggested action items
```

**Output:**
- `people/active/sarah-chen/1on1s/2026-02-08.md` created
- Structured agenda ready for meeting
- Manager reviews/edits before meeting

#### Workflow 4: Weekly Project Status (IDE)

```bash
@pm-project *status-report mobile-redesign

# Agent reads:
# - projects/active/mobile-redesign/context.md
# - projects/active/mobile-redesign/meetings/*.md
# - people/active/sarah-chen/context.md (project lead)
# - tasks/this-week.md
# - Previous status reports for comparison

# Generates status report with:
# - Progress this week
# - Risks and blockers
# - Team capacity
# - Next week's plan
```

**Output:**
- `projects/active/mobile-redesign/status-reports/2026-w06.md` created
- Manager reviews/edits before sharing with stakeholders

#### Workflow 5: Hiring - Candidate Review (IDE)

```bash
# Interview transcript dropped in inbox
# Cycle automatically categorizes to:
# operations/hiring/senior-frontend/candidates/john-doe/

@pm-hiring *candidate-review john-doe --approved=true

# Agent reads:
# - Job description
# - All interview transcripts
# - Company culture/values (knowledge-base)

# Generates comprehensive review:
# - Technical assessment
# - Culture fit analysis
# - Recommendation (STRONG HIRE/HIRE/NO HIRE)
# - Suggested compensation
# - Onboarding notes
```

**Output:**
- `operations/hiring/senior-frontend/candidates/john-doe/candidate-review.md`
- Manager reviews before making hiring decision

### CLI Terminal UX

**Visual Design:**
- Clean, scannable output with semantic colors (green=success, yellow=warning, blue=info, red=error)
- Progress spinners for AI operations (ora)
- Box drawing for structure and emphasis
- Tables for list views (cli-table3)
- Emoji support (optional, can disable with `TM_NO_EMOJI` env var)

**Branding:**
```
┌─────────────────────────────────────────────┐
│                                             │
│  ████████╗███╗   ███╗                       │
│  ╚══██╔══╝████╗ ████║                       │
│     ██║   ██╔████╔██║  Tech Manager OS      │
│     ██║   ██║╚██╔╝██║  by Marlon Vidal     │
│     ██║   ██║ ╚═╝ ██║                       │
│     ╚═╝   ╚═╝     ╚═╝  Comunidade Tech     │
│                        Manager de Resultados│
│                                             │
└─────────────────────────────────────────────┘
```

Shown during `tm init` and with `tm --version`.

### IDE Integration

**Cursor Integration:**
- Agents defined as `.cursor/rules/tm/*.mdc` files
- Rules include agent definition and command reference
- Agents auto-load relevant context files
- Usage: `@pm-people *1on1-prepare sarah`

**Claude Code Integration:**
- Agents defined in `.claude/agents/*.md` files
- Natural agent invocation
- Usage: Similar to Cursor

**Gemini CLI Integration:**
- Agents defined in `.gemini/agents/*.md` files
- CLI-based agent interaction
- Usage: Similar to Cursor/Claude

### Accessibility

- Plain text output mode (`--plain` flag) that strips ANSI colors
- JSON output mode (`--json` flag) for programmatic consumption
- Screen reader friendly with descriptive messages
- Keyboard-only navigation for interactive prompts

### Target Platforms

**CLI:**
- macOS: Terminal.app, iTerm2, Warp
- Windows: PowerShell, Windows Terminal, WSL
- Linux: gnome-terminal, Konsole, Alacritty

**IDE:**
- Cursor (primary)
- Claude Code (primary)
- Gemini CLI (primary)
- Future: Windsurf, other AI-powered IDEs

---

## Technical Assumptions

### Repository Structure

**Decision:** Monorepo with CLI + Agent System

**Rationale:**
- Single package deployment
- Unified versioning
- Clear separation: CLI (data) vs Agents (intelligence)
- Agent files are data/configuration, not separate services

### Architecture

**Hybrid Architecture: Lean CLI + Agent Ecosystem**

**Components:**

1. **CLI Layer (TypeScript/Node.js)**
   - Command parsing (Commander.js)
   - File system operations (fs-extra)
   - Configuration management (conf)
   - Inbox monitoring (chokidar)
   - Agent invocation bridge

2. **Agent System (YAML Packs + Markdown)**
   - Agent definitions (personas, commands, dependencies)
   - Task definitions (workflows)
   - Template definitions (output formats)
   - Pack system (YAML configuration)

3. **AI Adapter Layer**
   - Provider interface (OpenAI, Claude, Gemini)
   - Retry logic and rate limiting
   - Error normalization
   - Response streaming

4. **Template Engine**
   - Handlebars for variable injection
   - Frontmatter parsing (gray-matter)
   - File path resolution
   - Context aggregation

**Key Architectural Decisions:**

- **No database**: File system IS the database
- **Agent-as-configuration**: Agents are data, not code
- **Local-first**: No cloud dependencies except AI APIs
- **IDE-agnostic**: Agent system works across IDEs
- **Pack-based extensibility**: Community can create packs

### Testing Requirements

**Testing Strategy:**

1. **Unit Tests (Jest)**
   - File system service
   - Configuration service
   - AI adapters (mocked)
   - Template engine
   - Pack validation
   - Target: 80%+ coverage

2. **Integration Tests**
   - `tm cycle` end-to-end
   - Agent command execution
   - Pack loading and validation
   - File organization workflows

3. **Manual Testing Helpers**
   - Sample transcripts for cycle testing
   - Mock AI responses (no API key needed)
   - Test workspace generator

### Technology Stack

**Language & Runtime:**
- **TypeScript 5.x** with strict mode
- **Node.js 18+** (LTS)
- **ES Modules** (ESM)

**Key Libraries:**

**CLI:**
- `commander` - Command parsing
- `inquirer` - Interactive prompts
- `chalk` - Terminal colors
- `ora` - Spinners
- `cli-table3` - Tables
- `boxen` - Boxes for branding

**File System:**
- `fs-extra` - Safe file operations
- `chokidar` - File watching
- `gray-matter` - Frontmatter parsing
- `glob` - File pattern matching

**Configuration:**
- `conf` - Encrypted config storage
- `dotenv` - Environment variables

**Templating:**
- `handlebars` - Template rendering
- `yaml` - YAML parsing
- `zod` - Schema validation

**AI SDKs:**
- `openai` - OpenAI API
- `@anthropic-ai/sdk` - Claude API
- `@google/generative-ai` - Gemini API

**Build & Distribution:**
- `tsup` - Fast TypeScript bundling
- Package manager: npm
- Binary: `tm` via package.json bin field
- Versioning: SemVer

### Security & Configuration

- API keys stored encrypted in OS-specific directories:
  - macOS: `~/Library/Application Support/@marlonvidal-tech-manager-os/`
  - Linux: `~/.config/@marlonvidal-tech-manager-os/`
  - Windows: `%APPDATA%\@marlonvidal-tech-manager-os\`
- AES-256 encryption using `conf` library
- Environment variable overrides: `TM_PROVIDER`, `TM_API_KEY`
- No telemetry or data collection
- All user data stays local

### Performance Constraints

- CLI commands: <100ms response time (excluding AI)
- AI operations: Show progress after 500ms
- File operations: Atomic writes (no partial writes)
- Cycle processing: Handle 20+ inbox files efficiently
- Retry logic: Exponential backoff for AI rate limits

---

## Data Architecture

### Complete Folder Structure

```
tech-manager-workspace/
├── .tm-core/                           # Core agent system
│   ├── agents/                         # Agent definitions
│   │   ├── cycle-agent.md
│   │   ├── pm-people.md
│   │   ├── pm-project.md
│   │   ├── pm-career.md
│   │   ├── pm-hiring.md
│   │   └── tm-master.md
│   ├── skills/                         # Workflow definitions
│   │   ├── cycle-workflow.md
│   │   ├── collect-profile.md
│   │   ├── onboarding-manager.md
│   │   └── archive-workflow.md
│   ├── tasks/                          # Task definitions
│   │   ├── prepare-1on1.md
│   │   ├── generate-feedback.md
│   │   ├── create-pip.md
│   │   ├── generate-pdi.md
│   │   ├── project-status-report.md
│   │   ├── project-risk-assessment.md
│   │   ├── candidate-review.md
│   │   ├── update-tasks-context.md
│   │   └── categorize-note.md
│   ├── templates/                      # Output templates
│   │   ├── manager-profile-tmpl.yaml
│   │   ├── manager-pdp-tmpl.yaml
│   │   ├── brag-entry-tmpl.yaml
│   │   ├── leader-profile-tmpl.yaml
│   │   ├── member-profile-tmpl.yaml
│   │   ├── member-pdi-tmpl.yaml
│   │   ├── project-brief-tmpl.yaml
│   │   ├── job-description-tmpl.yaml
│   │   ├── candidate-review-tmpl.yaml
│   │   ├── 1on1-session-tmpl.yaml
│   │   ├── feedback-tmpl.yaml
│   │   ├── pip-tmpl.yaml
│   │   ├── status-report-tmpl.yaml
│   │   └── risk-assessment-tmpl.yaml
│   ├── packs/
│   │   └── base-pack.yaml              # Core methodology pack
│   └── core-config.yaml                # System configuration
├── .cursor/                            # Cursor IDE integration
│   └── rules/
│       └── tm/
│           ├── pm-people.mdc
│           ├── pm-project.mdc
│           ├── pm-career.mdc
│           ├── pm-hiring.mdc
│           └── cycle-agent.mdc
├── .claude/                            # Claude Code integration
│   └── agents/
│       ├── pm-people.md
│       ├── pm-project.md
│       ├── pm-career.md
│       ├── pm-hiring.md
│       └── cycle-agent.md
├── .gemini/                            # Gemini CLI integration
│   └── agents/
│       ├── pm-people.md
│       ├── pm-project.md
│       ├── pm-career.md
│       ├── pm-hiring.md
│       └── cycle-agent.md
├── .system/                            # Runtime system
│   ├── config.json                     # Encrypted configuration
│   └── watch.pid                       # Watch process tracking
├── inbox/                              # Universal drop zone
│   └── [transcripts and notes]
├── my-career/                          # Manager's career
│   ├── profile.md
│   ├── pdp.md
│   └── brag-document.md
├── my-leadership/                      # Manager's leader
│   ├── profile.md
│   └── alignments/
│       └── [1on1 transcripts with manager]
├── people/                             # Team members
│   ├── active/
│   │   └── {member-name}/
│   │       ├── profile.md
│   │       ├── context.md              # AI-maintained
│   │       ├── pdi.md
│   │       ├── 1on1s/
│   │       ├── feedback/
│   │       ├── pip.md (if needed)
│   │       └── reviews/
│   └── archived/
│       └── {year}/
│           └── {member-name}/
├── projects/                           # Projects
│   ├── active/
│   │   └── {project-name}/
│   │       ├── brief.md
│   │       ├── context.md              # AI-maintained
│   │       ├── status-reports/
│   │       ├── risk-assessments/
│   │       └── meetings/
│   └── archived/
│       └── {year}/
│           └── {project-name}/
├── operations/                         # Operational areas
│   ├── hiring/
│   │   └── {role-and-seniority}/
│   │       ├── job-description.md
│   │       └── candidates/
│   │           └── {candidate-name}/
│   │               ├── interview-{date}.md
│   │               ├── candidate-review.md
│   │               └── emails/
│   ├── finance/
│   │   └── budget-notes.md
│   ├── rituals/
│   │   ├── leadership/
│   │   │   └── [leadership meeting notes]
│   │   └── company/
│   │       └── [all-hands, townhalls]
│   └── incidents/
│       └── post-mortems/
│           └── [incident documentation]
├── knowledge-base/                     # Organizational knowledge
│   ├── people/
│   │   ├── culture.md
│   │   ├── values.md
│   │   └── onboarding.md
│   ├── process/
│   │   ├── performance-review-process.md
│   │   ├── promotion-process.md
│   │   └── incident-response.md
│   ├── company/
│   │   ├── strategy.md
│   │   ├── org-chart.md
│   │   └── departments.md
│   └── methodology.md
├── tasks/                              # Task tracking (AI-maintained)
│   ├── today.md
│   ├── this-week.md
│   ├── this-month.md
│   └── this-quarter.md
└── archive/
    └── {year}/
        └── {quarter}/
            └── [unprocessed notes]
```

### Frontmatter Schema Examples

**Member Profile:**
```yaml
---
name: Sarah Chen
role: Senior Frontend Engineer
seniority: Senior
team: Platform
hire_date: 2023-06-15
status: active
current_projects:
  - mobile-redesign (lead)
  - api-performance (contributor)
skills: [React, TypeScript, System Design]
aspirations: Staff Engineer or Technical Lead
last_1on1: 2026-02-08
next_1on1: 2026-02-15
---
```

**Project Brief:**
```yaml
---
project: Mobile App Redesign
status: active  # planning|active|paused|completed
priority: high  # low|medium|high|critical
team:
  lead: sarah-chen
  members: [mike-johnson, ana-rodriguez]
timeline:
  start: 2026-01-15
  target: 2026-03-31
  actual: null
health: yellow  # green|yellow|red
risks: 2
last_status: 2026-02-08
---
```

**Manager Profile:**
```yaml
---
name: Marlon Vidal
role: Engineering Manager
experience_years: 8
management_style: Servant leadership, data-driven
team_size: 5
reports_to: João Silva
strengths: [Technical depth, Empathy, Strategic thinking]
development_areas: [Executive communication, Scaling teams]
---
```

---

## Epic List

### Epic 1: Foundation & CLI Infrastructure
**Goal:** Establish TypeScript/Node.js foundation, build core CLI with Commander.js, implement configuration management with encrypted API key storage, and deliver `tm init` with interactive manager onboarding workflow.

### Epic 2: Cycle Intelligence Engine
**Goal:** Build the AI-powered inbox processing system that scans, categorizes, and files transcripts/notes into appropriate folders, updates context summaries, extracts tasks, and provides actionable insights.

### Epic 3: People Management System
**Goal:** Implement team member lifecycle management, profile collection workflows, and deliver all people-focused agent commands (1:1 prep, feedback, PDI, PIP, reviews).

### Epic 4: Manager's Career & Leadership Tracking
**Goal:** Enable managers to track their own career development with PDP management, brag document logging, and leadership alignment tracking.

### Epic 5: Project Management & Operations
**Goal:** Implement project lifecycle management, status reporting, risk assessment, and operational workflows for hiring, rituals, and knowledge base.

### Epic 6: Agent System & Pack Engine
**Goal:** Build the YAML-based pack system, implement all agent definitions, create IDE integration files, and deliver base-pack.yaml with core methodology.

### Epic 7: Polish, Testing & Distribution
**Goal:** Comprehensive testing, documentation, IDE integration validation, and npm packaging for distribution.

---

## Epic Details

### Epic 1: Foundation & CLI Infrastructure

**Expanded Goal:** Establish a professional TypeScript/Node.js project with Commander.js CLI framework, implement secure configuration management using the `conf` library for encrypted API key storage, build the interactive onboarding workflow that collects manager profile and creates workspace structure, and deliver AI provider adapters for OpenAI, Claude, and Gemini. This epic ensures all subsequent development has a solid foundation.

#### Story 1.1: Project Scaffolding and TypeScript Configuration

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

#### Story 1.2: CLI Framework with Commander.js

**As a** user,  
**I want** a CLI that displays help and handles commands properly,  
**so that** I can discover available commands and understand usage.

**Acceptance Criteria:**

1. Commander.js integrated in `cli.ts`
2. `tm --help` displays tool description, version, command list
3. `tm --version` displays current version
4. `tm` with no args shows help
5. Unknown commands show error with suggestion
6. Global flags work: `--verbose`, `--plain`, `--json`
7. Error handling with user-friendly messages

#### Story 1.3: Configuration Service with Encrypted Storage

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

#### Story 1.4: AI Provider Interface and Adapters

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

#### Story 1.5: File System Service

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

#### Story 1.6: Interactive Onboarding Workflow (`tm init`)

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

### Epic 2: Cycle Intelligence Engine

**Expanded Goal:** Build the AI-powered cycle agent that processes inbox files, categorizes them by type and entity, updates context summaries using intelligent merging, extracts actionable tasks with urgency classification, and moves files to appropriate destinations. This epic delivers the core "transcript-to-context" value proposition.

#### Story 2.1: Inbox Scanner and File Parser

**As a** developer,  
**I want** to scan and parse inbox files efficiently,  
**so that** the cycle engine can process them.

**Acceptance Criteria:**

1. `InboxService` class with methods: `scanInbox()`, `parseFile()`
2. Supports file types: `.txt`, `.md`, `.json`
3. Returns array of `InboxFile` objects with: filepath, content, timestamp
4. Handles edge cases: empty inbox, large files, malformed files
5. Sorted by timestamp (oldest first)
6. Unit tests cover various file types and scenarios

#### Story 2.2: AI-Powered Categorization Logic

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

#### Story 2.3: Context Summary Merging

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

#### Story 2.4: Task Extraction and Timeline Classification

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

#### Story 2.5: File Organization and Movement

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

#### Story 2.6: `tm cycle` Command Implementation

**As a** manager,  
**I want** one command to process all inbox files,  
**so that** my workspace stays current with minimal effort.

**Acceptance Criteria:**

1. `tm cycle` orchestrates: Scan → Categorize → Update Contexts → Extract Tasks → Organize Files
2. Progress indicators for each phase
3. Summary output:
   - Files processed
   - Contexts updated (people, projects)
   - Tasks extracted
   - Suggested actions
4. Handles errors gracefully (partial progress saved)
5. Optional flags: `--dry-run`, `--verbose`
6. Integration test validates full cycle

#### Story 2.7: `tm watch` Command for Auto-Processing

**As a** manager,  
**I want** inbox to be processed automatically when files are added,  
**so that** I don't have to remember to run cycle.

**Acceptance Criteria:**

1. `tm watch` monitors `inbox/` directory
2. Uses `chokidar` for file watching
3. Debounces multiple file additions (waits 5 seconds)
4. Runs `tm cycle` automatically
5. Displays activity log
6. Can be stopped with Ctrl+C
7. Stores PID in `.system/watch.pid`
8. Integration test validates file watching

---

### Epic 3: People Management System

**Expanded Goal:** Implement complete people management lifecycle including member addition/archival, profile collection workflows, and all agent commands for 1:1 preparation, feedback generation, PDI creation/updates, PIP management, and performance reviews. This epic enables managers to effectively support their team's growth.

#### Story 3.1: Team Member Lifecycle Commands

**As a** manager,  
**I want** to manage my team member roster,  
**so that** I can track active and past team members.

**Acceptance Criteria:**

1. `tm people add <name>` creates structure:
   - `people/active/{name}/profile.md` (with frontmatter template)
   - `people/active/{name}/context.md` (empty, will be AI-maintained)
   - `people/active/{name}/pdi.md` (template)
   - Subdirectories: `1on1s/`, `feedback/`, `reviews/`
2. `tm people list` displays table with: name, role, last 1:1, status
3. `tm people archive <name>` moves to `people/archived/{year}/`
4. `tm people fire <name>` archives with termination marker
5. `tm show <name>` displays context summary
6. Unit tests for all commands

#### Story 3.2: Profile Collection Workflow

**As a** manager,  
**I want** an easy way to collect structured profile information from team members,  
**so that** I have rich context about their background and goals.

**Acceptance Criteria:**

1. `tm people collect-profile <name>` generates shareable prompt file
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

#### Story 3.3: pm-people Agent - 1:1 Preparation

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

#### Story 3.4: pm-people Agent - Feedback Generation

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

#### Story 3.5: pm-people Agent - PDI Management

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

#### Story 3.6: pm-people Agent - PIP and Performance Reviews

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

### Epic 4: Manager's Career & Leadership Tracking

**Expanded Goal:** Enable managers to track their own career development with equal rigor as team management. Implement PDP creation/updates, brag document logging, self-review generation, and leadership alignment tracking. This epic ensures managers don't neglect their own growth.

#### Story 4.1: Manager Career Commands

**As a** manager,  
**I want** to manage my own career development,  
**so that** I'm intentional about my growth.

**Acceptance Criteria:**

1. `tm my profile` opens profile in editor
2. `tm my pdp` opens PDP in editor
3. `tm my brag add <achievement>` logs achievement with timestamp
4. `tm my brag view` displays brag document
5. Files created during `tm init`
6. Unit tests for all commands

#### Story 4.2: pm-career Agent - PDP Management

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

#### Story 4.3: pm-career Agent - Brag Document and Self-Review

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

#### Story 4.4: Leadership Alignment Tracking

**As a** manager,  
**I want** my 1:1s with my leader tracked,  
**so that** I maintain alignment.

**Acceptance Criteria:**

1. Cycle agent recognizes transcripts with leader (based on my-leadership/profile.md)
2. Files them in: `my-leadership/alignments/{date}.md`
3. Updates manager's context with alignment notes
4. Flags misalignment with PDP
5. Integration test validates categorization

---

### Epic 5: Project Management & Operations

**Expanded Goal:** Implement project lifecycle management, status reporting, risk assessment, and operational workflows for hiring, rituals, and knowledge base management. This epic extends beyond people management to cover the full scope of a manager's responsibilities.

#### Story 5.1: Project Lifecycle Commands

**As a** manager,  
**I want** to manage my project portfolio,  
**so that** I can track active and completed projects.

**Acceptance Criteria:**

1. `tm project add <name>` creates structure with brief.md template
2. `tm project list` displays table
3. `tm project archive <name>` moves to archived
4. `tm show <project>` displays context
5. Unit tests for all commands

#### Story 5.2: pm-project Agent - Status Reports

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

#### Story 5.3: pm-project Agent - Risk Assessment

**As a** manager,  
**I want** AI to assess project risks,  
**so that** I can proactively mitigate issues.

**Acceptance Criteria:**

1. Agent command: `*risk-assessment <project>`
2. Analyzes recent context and identifies risks
3. Generates assessment: risk list, severity, mitigation strategies
4. Outputs to: `projects/active/{project}/risk-assessments/{date}.md`
5. Integration test validates risk identification

#### Story 5.4: Hiring Workflow

**As a** manager,  
**I want** to manage hiring pipelines,  
**so that** I can track candidates systematically.

**Acceptance Criteria:**

1. `tm hiring open <role>` creates job description template
2. `tm hiring candidate add <role> <name>` creates candidate folder
3. `tm hiring list` displays open positions
4. Cycle agent categorizes interview transcripts
5. Unit tests for all commands

#### Story 5.5: pm-hiring Agent - Candidate Reviews

**As a** manager,  
**I want** AI to help review candidates,  
**so that** I make informed hiring decisions.

**Acceptance Criteria:**

1. Agent command: `*candidate-review <candidate> --approved=true|false`
2. Reads: interview transcripts, job description, culture values
3. Generates review: technical assessment, culture fit, recommendation
4. Outputs to: `operations/hiring/{role}/candidates/{name}/candidate-review.md`
5. Integration test validates review quality

#### Story 5.6: Operations and Knowledge Base

**As a** manager,  
**I want** structured places for operational information,  
**so that** everything has a home.

**Acceptance Criteria:**

1. Cycle agent categorizes: leadership meetings, company meetings, post-mortems
2. `tm kb add <category> <title>` creates knowledge base entry
3. `tm kb list` displays entries
4. Knowledge base consulted by agents when relevant
5. Integration test validates categorization

---

### Epic 6: Agent System & Pack Engine

**Expanded Goal:** Build the complete agent system with YAML-based pack configuration, implement all agent definitions with proper persona and command structures, create IDE integration files for Cursor/Claude/Gemini, and deliver base-pack.yaml containing all core management methodology commands. This epic enables extensibility and community contributions.

#### Story 6.1: Pack Schema and Validation

**As a** developer,  
**I want** strict schema validation for packs,  
**so that** invalid configurations are caught early.

**Acceptance Criteria:**

1. Zod schema defined for pack structure
2. `PackValidationService` with `validate()` method
3. Validates: schema compliance, variable references, output paths, command conflicts
4. Clear error messages with line numbers
5. Unit tests cover valid and invalid scenarios

#### Story 6.2: Pack Loader and Command Resolution

**As a** developer,  
**I want** packs loaded efficiently,  
**so that** agents have access to commands.

**Acceptance Criteria:**

1. `PackLoaderService` with methods: `loadPack()`, `loadExtensions()`, `resolveCommand()`
2. Loads base-pack.yaml during initialization
3. Supports extension packs (community packs)
4. Command override logic (extensions override base)
5. Caching for performance
6. Unit tests cover loading and resolution

#### Story 6.3: Template Engine with Variable Injection

**As a** developer,  
**I want** to inject variables into prompts,  
**so that** commands are context-aware.

**Acceptance Criteria:**

1. `TemplateService` with method: `render(template, variables)`
2. Uses Handlebars for templating
3. Variable sources: file paths, keywords, computed values
4. Handles missing variables gracefully
5. Security: sandboxed execution
6. Unit tests cover injection scenarios

#### Story 6.4: Agent Definitions

**As a** manager using an IDE,  
**I want** to invoke specialized agents,  
**so that** I get domain-specific assistance.

**Acceptance Criteria:**

1. All agents defined in `.tm-core/agents/`:
   - cycle-agent.md
   - pm-people.md
   - pm-project.md
   - pm-career.md
   - pm-hiring.md
   - tm-master.md
2. Each agent has: persona, commands, dependencies
3. Documentation includes usage examples
4. Agent files created during `tm init`

#### Story 6.5: IDE Integration Files

**As a** manager,  
**I want** agents available in my IDE,  
**so that** I can use them naturally in my workflow.

**Acceptance Criteria:**

1. `.cursor/rules/tm/*.mdc` files generated
2. `.claude/agents/*.md` files generated
3. `.gemini/agents/*.md` files generated
4. Files include agent definition and command reference
5. Files created during `tm init`
6. Integration test validates file structure

#### Story 6.6: base-pack.yaml Design and Implementation

**As a** product manager,  
**I want** a comprehensive base pack,  
**so that** users get immediate value.

**Acceptance Criteria:**

1. `base-pack.yaml` created with all commands:
   - Cycle commands (categorize, process-inbox, update-tasks)
   - People commands (1on1-prepare, feedback, pdi-generate, pdi-update, pip-create, review-generate)
   - Project commands (status-report, risk-assessment, health-check)
   - Career commands (pdp-generate, pdp-update, brag-summarize, self-review)
   - Hiring commands (candidate-review, job-description)
2. Each command has: well-crafted prompts, appropriate temperature, clear outputs
3. Validation passes
4. Generated during `tm init`

---

### Epic 7: Polish, Testing & Distribution

**Expanded Goal:** Comprehensive testing across all layers, complete documentation with user guide and examples, IDE integration validation, performance optimization, and npm packaging for distribution. This epic ensures the system is production-ready.

#### Story 7.1: Comprehensive Test Suite

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

#### Story 7.2: Documentation

**As a** new user,  
**I want** comprehensive documentation,  
**so that** I can learn and use the system effectively.

**Acceptance Criteria:**

1. README.md with: quick start, command reference, architecture overview
2. User guide with workflow examples
3. Agent development guide
4. Pack development guide
5. SECURITY.md with API key best practices
6. CHANGELOG.md
7. Examples directory with sample workflows

#### Story 7.3: Performance Optimization

**As a** user,  
**I want** fast response times,  
**so that** the tool doesn't slow me down.

**Acceptance Criteria:**

1. CLI commands <100ms (excluding AI)
2. Cycle processes 20+ files efficiently
3. Progress indicators for operations >500ms
4. File operations are atomic
5. Retry logic with exponential backoff
6. Performance benchmarks documented

#### Story 7.4: Error Handling and UX Polish

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

#### Story 7.5: npm Packaging and Distribution

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

## Implementation Strategy

### Development Phases

**Phase 1: Foundation (Weeks 1-2)**
- Epic 1 complete
- `tm init` working with manager onboarding
- Configuration and AI providers functional
- Basic file operations tested

**Phase 2: Cycle Intelligence (Weeks 3-4)**
- Epic 2 complete
- `tm cycle` and `tm watch` working
- Categorization logic validated with sample transcripts
- Context updates and task extraction functional

**Phase 3: People Management (Weeks 5-6)**
- Epic 3 complete
- All people commands working
- pm-people agent functional with all commands
- Profile collection workflow tested

**Phase 4: Career & Leadership (Week 7)**
- Epic 4 complete
- Manager's career tracking functional
- pm-career agent working
- Leadership alignment tracking tested

**Phase 5: Projects & Operations (Week 8)**
- Epic 5 Stories 5.1-5.3 complete
- Project management functional
- pm-project agent working
- Status and risk reporting tested

**Phase 6: Hiring & Operations (Week 9)**
- Epic 5 Stories 5.4-5.6 complete
- Hiring workflow functional
- pm-hiring agent working
- Operations and knowledge base tested

**Phase 7: Agent System (Week 10)**
- Epic 6 complete
- Pack engine functional
- All agents defined
- IDE integration files generated
- base-pack.yaml validated

**Phase 8: Polish & Ship (Week 11-12)**
- Epic 7 complete
- Testing comprehensive
- Documentation complete
- Performance optimized
- npm package ready
- Beta testing with community

### Success Metrics

**MVP Success Criteria:**

1. **Functional Completeness:**
   - All FR1-FR40 implemented and tested
   - All agents functional in at least one IDE (Cursor)
   - Cycle processes 10+ different transcript types accurately

2. **User Adoption:**
   - 5 beta testers using system for 2+ weeks
   - Positive feedback on core workflows (cycle, 1:1 prep, status reports)
   - At least 100 transcripts processed across beta testers

3. **Quality:**
   - 80%+ test coverage
   - Zero critical bugs
   - AI categorization >85% accuracy on beta tester data

4. **Performance:**
   - CLI commands <100ms
   - Cycle processes 20 files in <60 seconds
   - No data loss incidents

5. **Documentation:**
   - Complete user guide
   - 5+ example workflows documented
   - Video walkthrough created

### Risk Mitigation

**Technical Risks:**

1. **AI Categorization Accuracy:** Mitigate with extensive prompt engineering, sample transcript testing, and fallback to manual categorization for low-confidence cases
2. **Context Summary Growth:** Implement summarization strategy to prevent unbounded growth, test with large context datasets
3. **Cross-Platform Issues:** Test on Mac, Linux, Windows throughout development, use path.join() consistently
4. **API Rate Limits:** Implement exponential backoff, batch operations where possible, provide clear error messages

**Product Risks:**

1. **Complexity Overload:** Start with core workflows, defer advanced features to v1.1
2. **Learning Curve:** Invest in documentation and examples, create video walkthroughs
3. **IDE Fragmentation:** Focus on Cursor first, add Claude/Gemini support after core is stable

---

## Open Questions & Design Decisions

### Questions Requiring User Input

**Q1: Time-Based Task View Details**

What exactly should each time view show?

- **`tm today`:**
  - Urgent tasks only? Or all tasks due today?
  - Should it show scheduled 1:1s automatically by reading calendar files?
  - Should it show "suggested actions" from last cycle?
  - Format: Categorized list or priority-sorted?

- **`tm this-week`:**
  - Weekly objectives or daily task rollup?
  - Should it predict capacity (days × hours)?
  - Should it show project milestones due this week?

- **`tm this-month` and `tm this-quarter`:**
  - More strategic (goals/objectives) or tactical (task list)?
  - Should these be manually curated or AI-generated?

**Q2: PIP vs Feedback Escalation**

When should the system suggest PIP initiation?

- After N constructive feedback items (what's N: 2, 3, 5)?
- Based on severity analysis by AI (flag "critical" issues)?
- Never suggest automatically (always manager decision)?
- Should there be a "concern" escalation level before PIP?

**Q3: Context Summary Growth Management**

How do we prevent context files from growing unbounded?

- Maximum context size (tokens/characters)?
- Summarization strategy: periodic compression, sliding window, hierarchical summaries?
- Should we keep separate "recent" (detailed) and "historical" (summarized) sections?
- Archival: Move old detailed context to archive after N months?

**Q4: Profile Collection - Team Member Engagement**

How do we encourage team members to complete profile collection?

- Should managers be able to schedule "profile interview" in the agent?
- Should the system send reminders (requires email integration)?
- Should profiles be mandatory or optional?
- What's the fallback if someone doesn't complete it?

**Q5: IDE Integration Priority**

Which IDE should we perfect first?

- **Cursor** (most popular in community)
- **Claude Code** (most natural for AI-native workflow)
- **Gemini CLI** (unique CLI-based approach)
- Or all three in parallel (slower but broader reach)?

**Q6: Transcript Format Specifics**

What transcript formats are most common for users?

- Plain text with speaker labels: "Manager: ... Member: ..."
- Markdown with headers: "## Manager\n...\n## Member\n..."
- JSON from tools like Otter.ai, Fireflies.ai: `{"speaker": "Manager", "text": "..."}`
- Should we support custom parsers per transcript source?

**Q7: Community Pack System (Post-MVP)**

For v1.1+ pack distribution:

- Host packs on GitHub (user installs via URL)?
- Create central registry/marketplace?
- How do users discover packs?
- Versioning strategy for packs?
- Security: how to validate community packs aren't malicious?

---

## Design Decisions Checklist

### Items Requiring Detailed Specification (Future Sessions)

Use this checklist to track what needs to be defined before implementation. Each item should have its own design session/document.

#### 🎯 **CRITICAL PATH** (Required for MVP)

- [ ] **base-pack.yaml Complete Specification**
  - [ ] All command definitions with full prompts
  - [ ] System prompts for each agent persona
  - [ ] User prompt templates with variable placeholders
  - [ ] Temperature and max_tokens for each command
  - [ ] Input source specifications (file paths, keywords)
  - [ ] Output path specifications and templates
  - [ ] Estimated: 8-10 hours of prompt engineering

- [ ] **Cycle Agent Categorization Logic**
  - [ ] Detailed categorization decision tree
  - [ ] Confidence scoring algorithm
  - [ ] Multi-entity handling (note mentions 3 people + 2 projects)
  - [ ] Ambiguity resolution strategies
  - [ ] Low-confidence fallback workflow
  - [ ] Sample transcript test suite (20+ examples)

- [ ] **Context Summary Merging Algorithm**
  - [ ] Prompt template for merging new insights with existing context
  - [ ] Summarization strategy for long contexts
  - [ ] What to preserve vs. what to compress
  - [ ] Handling conflicting information (new data contradicts old)
  - [ ] Chronological markers and time-awareness

- [ ] **Task Extraction Prompt Design**
  - [ ] Urgency classification rules
  - [ ] Task format specification
  - [ ] Owner assignment logic (member/project/manager)
  - [ ] Status tracking (new/in-progress/blocked/done)
  - [ ] Task deduplication strategy

- [ ] **Template YAML Specifications**
  - [ ] All 15+ templates fully defined with structure
  - [ ] Frontmatter schemas for each entity type
  - [ ] Section headers and content guidelines
  - [ ] Variable injection points
  - [ ] Examples for each template

- [ ] **Agent Persona Definitions**
  - [ ] pm-people: Personality, communication style, expertise areas
  - [ ] pm-project: Personality, communication style, expertise areas
  - [ ] pm-career: Personality, communication style, expertise areas
  - [ ] pm-hiring: Personality, communication style, expertise areas
  - [ ] cycle-agent: Analytical approach, decision-making style
  - [ ] Each agent needs: backstory, expertise, limitations, tone

- [ ] **IDE Integration Specifications**
  - [ ] Cursor: .mdc file format and structure (with examples)
  - [ ] Claude Code: Agent file format and invocation patterns
  - [ ] Gemini CLI: Agent file format and invocation patterns
  - [ ] Agent loading mechanism for each IDE
  - [ ] Context file auto-loading rules

#### 📋 **HIGH PRIORITY** (Needed early in implementation)

- [ ] **File System Service Error Handling**
  - [ ] Error types and recovery strategies
  - [ ] Permission errors (directory not writable)
  - [ ] Disk space errors
  - [ ] File locking conflicts
  - [ ] Atomic operation failure recovery

- [ ] **AI Provider Adapter Error Handling**
  - [ ] Rate limit handling (429) with exponential backoff
  - [ ] Token limit errors (how to handle, chunking strategy)
  - [ ] Invalid API key (user-friendly message + recovery)
  - [ ] Network errors (retry logic, timeout values)
  - [ ] Provider-specific error codes

- [ ] **Onboarding Workflow UX Flow**
  - [ ] Question sequence and branching logic
  - [ ] Skip options for optional questions
  - [ ] Validation rules for inputs
  - [ ] Progress indicators
  - [ ] Error handling (API key validation fails, etc.)
  - [ ] Success screen with next steps

- [ ] **CLI Terminal Output Formatting**
  - [ ] Color palette (exact hex/ANSI codes)
  - [ ] Spinner styles and messages
  - [ ] Table column widths and truncation rules
  - [ ] Progress bar formats
  - [ ] Error message structure
  - [ ] Success message structure
  - [ ] Box drawing patterns

- [ ] **Frontmatter Validation Rules**
  - [ ] Required fields per entity type
  - [ ] Data type validation (dates, arrays, strings)
  - [ ] Enum values (status, priority, etc.)
  - [ ] Default values
  - [ ] Migration strategy when schema changes

#### 🔧 **MEDIUM PRIORITY** (Can be refined during development)

- [ ] **Time-Based Task View Algorithms**
  - [ ] Today: What qualifies as "urgent"?
  - [ ] This week: How to prioritize weekly tasks
  - [ ] This month: Milestone vs task distinction
  - [ ] This quarter: Strategic objective identification
  - [ ] Task rollup logic (daily → weekly → monthly)

- [ ] **Profile Collection Workflow Details**
  - [ ] Question set design (what to ask)
  - [ ] Interactive mode flow (if run in IDE)
  - [ ] Shareable prompt format
  - [ ] Output parsing (if team member fills externally)
  - [ ] Partial completion handling

- [ ] **Archive Strategy and Timing**
  - [ ] Member archival: What gets moved, what stays
  - [ ] Project archival: What gets moved, what stays
  - [ ] Archive folder organization (by year, quarter, type?)
  - [ ] Retrieval mechanism (how to search archived data)
  - [ ] Archival triggering (manual only or auto-suggest?)

- [ ] **Knowledge Base Integration**
  - [ ] When do agents consult knowledge base?
  - [ ] How is KB content injected into prompts?
  - [ ] KB search mechanism (semantic, keyword, both?)
  - [ ] KB update workflow (how do entries get created/updated?)

- [ ] **Multi-Entity Handling in Cycle**
  - [ ] If note mentions 3 people, do we copy to all 3 contexts?
  - [ ] If note mentions person + project, update both?
  - [ ] Handling general notes (no clear entity match)
  - [ ] Priority when destinations conflict

- [ ] **Confidence Scoring and Manual Review**
  - [ ] What confidence threshold triggers manual review?
  - [ ] Manual review UI/UX (interactive prompt in terminal?)
  - [ ] Can user teach the system (improve future categorization)?
  - [ ] Feedback loop for improving categorization

#### 🎨 **NICE TO HAVE** (Can defer to later iterations)

- [ ] **Pack Extension System Design**
  - [ ] How do extension packs override base pack?
  - [ ] Conflict resolution (two packs define same command)
  - [ ] Pack dependency management
  - [ ] Pack installation workflow from URLs
  - [ ] Pack validation and security scanning

- [ ] **Watch Command Advanced Features**
  - [ ] Debounce timing (how long to wait for multiple files?)
  - [ ] Batch processing size limits
  - [ ] Notification system (desktop notifications on completion?)
  - [ ] Log file for watch activity

- [ ] **Status Report Customization**
  - [ ] Should reports support custom sections?
  - [ ] Template override mechanism
  - [ ] Stakeholder-specific formats (technical vs executive)

- [ ] **Feedback Delivery Tracking**
  - [ ] Should system track when feedback was delivered?
  - [ ] "Draft" vs "Delivered" status?
  - [ ] Recipient acknowledgment tracking?

- [ ] **Career Ladder Integration**
  - [ ] Should system understand company's career levels?
  - [ ] Promotion readiness assessment?
  - [ ] Gap analysis for next level?

- [ ] **Team Capacity Planning**
  - [ ] Calculate team capacity (people × availability)
  - [ ] Project allocation optimization
  - [ ] Overallocation warnings

- [ ] **Calendar Integration** (v2.0)
  - [ ] Import 1:1 schedules from Google/Outlook
  - [ ] Auto-trigger 1:1 preparation day before
  - [ ] Meeting conflict detection

- [ ] **Email Integration** (v2.0)
  - [ ] Forward transcripts via email to inbox
  - [ ] Send generated documents via email
  - [ ] Reminder emails for pending actions

---

## Detailed Specifications Needed Before Implementation

### Specification 1: base-pack.yaml (Critical)

**Owner:** Product Manager + Prompt Engineer  
**Estimated Effort:** 8-10 hours  
**Deliverable:** Complete base-pack.yaml file with all command definitions

**Contents:**
- Meta section (name, version, author)
- 20+ command definitions including:
  - cycle-agent: categorize, process-inbox, update-tasks
  - pm-people: 1on1-prepare, feedback, pdi-generate, pdi-update, pip-create, review-generate
  - pm-project: status-report, risk-assessment, health-check
  - pm-career: pdp-generate, pdp-update, brag-summarize, self-review
  - pm-hiring: candidate-review, job-description, interview-guide

**Each Command Requires:**
- Description (what it does)
- Inputs (variables, sources, required/optional)
- Prompt (system message, user template, temperature, max_tokens)
- Output (type, path, template reference)

**Prompt Engineering Focus:**
- System prompts that establish agent persona
- User prompts with clear instructions and examples
- Variable injection points using Handlebars syntax
- Appropriate temperature settings (0.3 for categorization, 0.7 for generation)

### Specification 2: Cycle Categorization Algorithm (Critical)

**Owner:** AI Engineer + Product Manager  
**Estimated Effort:** 6-8 hours  
**Deliverable:** Categorization prompt + decision logic + test suite

**Algorithm Components:**

1. **Type Classification:**
   - Categories: 1on1_session, feedback_positive, feedback_constructive, pip_concern, project_status, project_risk, team_meeting, leadership_meeting, candidate_interview, general_note
   - Classification prompt with clear examples
   - Confidence scoring (0.0-1.0)

2. **Entity Extraction:**
   - People mentioned (fuzzy matching against active members)
   - Projects mentioned (fuzzy matching against active projects)
   - Handling nicknames and informal references

3. **Insight Extraction:**
   - Key points per entity
   - Action items
   - Sentiment analysis (positive/concern/neutral)

4. **Destination Mapping:**
   - File path determination based on type and entities
   - Multi-destination handling
   - Archive path for unmatched notes

5. **Test Suite:**
   - 20+ sample transcripts covering all types
   - Expected categorization for each
   - Edge cases (ambiguous, multi-entity, unclear type)

### Specification 3: Template Definitions (Critical)

**Owner:** Product Manager + UX  
**Estimated Effort:** 4-6 hours  
**Deliverable:** 15+ YAML template files

**Templates Needed:**
- manager-profile-tmpl.yaml
- manager-pdp-tmpl.yaml
- brag-entry-tmpl.yaml
- leader-profile-tmpl.yaml
- member-profile-tmpl.yaml
- member-pdi-tmpl.yaml
- project-brief-tmpl.yaml
- job-description-tmpl.yaml
- candidate-review-tmpl.yaml
- 1on1-session-tmpl.yaml
- feedback-tmpl.yaml
- pip-tmpl.yaml
- status-report-tmpl.yaml
- risk-assessment-tmpl.yaml
- post-mortem-tmpl.yaml

**Each Template Includes:**
- Frontmatter schema (YAML)
- Section structure (Markdown headers)
- Content guidelines (what goes in each section)
- Variable injection points
- Example filled template

### Specification 4: Agent Persona Definitions (High Priority)

**Owner:** Product Manager  
**Estimated Effort:** 4 hours  
**Deliverable:** Persona documents for 5 agents

**For Each Agent:**
- **Name and Role:** (e.g., "Alex - People Manager")
- **Personality:** (e.g., "Empathetic, insightful, development-focused")
- **Expertise:** (e.g., "Career development, feedback delivery, 1:1 facilitation")
- **Communication Style:** (e.g., "Warm but professional, asks probing questions")
- **Limitations:** (e.g., "Not a therapist, focuses on professional development")
- **Sample Interactions:** (examples of agent responses)

**Agents:**
1. cycle-agent: Analytical, thorough, organized
2. pm-people: Empathetic coach and development partner
3. pm-project: Strategic project leader
4. pm-career: Career counselor for the manager
5. pm-hiring: Talent assessment specialist

### Specification 5: IDE Integration Files (High Priority)

**Owner:** Developer  
**Estimated Effort:** 4 hours  
**Deliverable:** Example integration files for each IDE + generation logic

**Cursor (.cursor/rules/tm/*.mdc):**
- File format specification
- How to include agent definitions
- Command reference format
- Context loading rules

**Claude Code (.claude/agents/*.md):**
- Agent file format
- Invocation patterns
- Context loading

**Gemini CLI (.gemini/agents/*.md):**
- Agent file format
- CLI invocation patterns

---

## Next Steps

### Immediate Actions (Before Development)

1. **Schedule Design Sessions:**
   - Session 1: base-pack.yaml prompt engineering (8 hours)
   - Session 2: Cycle categorization algorithm (6 hours)
   - Session 3: Template definitions (6 hours)
   - Session 4: Agent persona definitions (4 hours)
   - Session 5: IDE integration specs (4 hours)

2. **Validate Architecture:**
   - Review this PRD with development team
   - Identify technical risks and unknowns
   - Confirm feasibility of 12-week timeline

3. **Set Up Development Environment:**
   - Create GitHub repository
   - Set up TypeScript project structure
   - Configure CI/CD pipeline
   - Set up testing framework

4. **Recruit Beta Testers:**
   - Identify 5 engineering managers willing to test
   - Set expectations for beta program
   - Prepare onboarding materials

### Development Kickoff Checklist

Before starting Epic 1 implementation:

- [ ] All Critical Path specifications complete
- [ ] Development environment ready
- [ ] Team aligned on architecture
- [ ] Beta tester pool identified
- [ ] Success metrics defined and measurable
- [ ] Risk mitigation strategies in place

---

## Conclusion

### Product Vision

Tech Manager OS represents a fundamental shift in how engineering managers work: from scattered notes and manual organization to an AI-enhanced, context-preserving workspace. By treating management artifacts as organized, machine-readable context and providing specialized AI agents for common workflows, we enable managers to:

- **Never lose context** about their team, projects, or career
- **Reduce cognitive load** of remembering everything across quarters
- **Deliver better 1:1s** with AI-prepared agendas based on full history
- **Make data-driven decisions** with complete context at their fingertips
- **Invest in their own growth** with equal rigor as team development

The agent-based architecture ensures extensibility and community growth, while the local-first approach respects privacy and data ownership.

### MVP Scope Validation

This PRD defines a complete MVP covering:

✅ **People Management:** Full lifecycle from onboarding to reviews  
✅ **Project Management:** Status reporting and risk assessment  
✅ **Manager's Career:** Self-development and leadership alignment  
✅ **Operations:** Hiring, rituals, knowledge base  
✅ **Core System:** Cycle intelligence, task tracking, IDE integration  
✅ **Extensibility:** Pack system for methodology customization  

The 12-week timeline is aggressive but achievable with focused execution and clear priorities.

### Success Criteria

The MVP will be considered successful if:

1. **Functional:** All 40 functional requirements implemented and tested
2. **Usable:** 5 beta testers successfully onboard and use daily for 2+ weeks
3. **Reliable:** 80%+ test coverage, zero data loss, >85% categorization accuracy
4. **Performant:** CLI <100ms, cycle processes 20 files in <60 seconds
5. **Documented:** Complete user guide, video walkthrough, 5+ example workflows

### Post-MVP Roadmap (v1.1+)

**Deferred to Future Versions:**

- Calendar integration (auto-schedule 1:1 prep)
- Email integration (forward transcripts, send drafts)
- Team capacity planning and optimization
- Career ladder integration with promotion assessments
- Pack marketplace and community distribution
- Multi-manager collaboration (shared team members)
- Mobile companion app (quick voice note capture)
- Slack/Teams integration (capture channel context)
- Analytics dashboard (team health trends, manager effectiveness metrics)

### Final Recommendations

**Before proceeding to architecture phase:**

1. Complete the 5 critical design specifications (base-pack, cycle logic, templates, personas, IDE integration)
2. Validate AI categorization accuracy with 20+ sample transcripts
3. Conduct user research with 3-5 target managers (validate workflows and pain points)
4. Review security model with security expert (API key encryption, data privacy)

**Development approach:**

- Start with Epic 1 (foundation) immediately after specs are complete
- Run weekly demos with stakeholders to validate direction
- Engage beta testers starting in Phase 3 (People Management functional)
- Maintain strict scope discipline (defer v1.1 features aggressively)

---

## Appendix: Design Session Planning

### Session Schedule (28 hours total)

**Week 1:**
- Session 1: base-pack.yaml (8h) - Prompt engineering intensive
- Session 2: Cycle categorization (6h) - Algorithm design + test suite

**Week 2:**
- Session 3: Template definitions (6h) - All 15+ templates
- Session 4: Agent personas (4h) - Character development
- Session 5: IDE integration (4h) - Technical specs

**Participants:**
- Product Manager (all sessions)
- Prompt Engineer (Sessions 1, 2)
- UX Designer (Sessions 3, 4)
- Developer (Sessions 2, 5)

**Deliverables:**
- base-pack.yaml (complete, validated)
- categorization-algorithm.md (with test suite)
- templates/ directory (15+ YAML files)
- agent-personas.md (5 detailed personas)
- ide-integration-spec.md (3 IDE formats)

---

**PRD Status:** ✅ COMPLETE - Ready for design specifications phase  
**Next Milestone:** Complete 5 critical design specifications  
**Development Start:** After design specs approved (estimated 2 weeks)  
**Target MVP Delivery:** 12 weeks from development start

---

*This PRD represents the complete product vision for Tech Manager OS v1.0. All subsequent work should reference this document as the source of truth for MVP scope and requirements.*

