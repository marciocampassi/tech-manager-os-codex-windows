# Requirements

## Functional Requirements

### Core System (FR1-FR8)

**FR1:** The system shall provide a `tmr init` command that:
- Runs an interactive onboarding workflow to collect leader's profile, career goals, and leadership context
- Creates complete directory structure (`inbox/`, `my-teams/`, `my-projects/`, `my-tasks/`, `my-career/`, `my-leadership/`, `my-company/`, `operations/`, `knowledge-base/`, `archive/`)
- Generates IDE integration files (`.cursor/rules/tmr/`, `.claude/agents/`, `.gemini/agents/`, `.github/copilot/skills/`)
- Creates initial profile and PDP templates for the leader

**FR2:** The system shall support interactive AI provider selection during `tmr init`, allowing users to choose between OpenAI, Anthropic (Claude), and Google Gemini as their AI provider.

**FR3:** The system shall securely store API keys for the selected AI provider using encrypted configuration management in OS-specific directories.

**FR4:** The system shall provide a `tmr process` command that:
- Scans `inbox/` for all text files (.txt, .md, .json)
- Uses AI to categorize each file by type (1:1, feedback, project status, meeting notes, hiring, company interactions, etc.)
- Identifies which teams, people, projects, and/or leaders each file relates to
- Updates context summaries for affected entities automatically
- Moves files to appropriate destination folders (multi-level: team, project, or company)
- Extracts actionable tasks and updates `my-tasks/today.md`, `my-tasks/this-week.md`, `my-tasks/this-month.md`, `my-tasks/this-quarter.md`
- Handles binary files (PDF, PPTX, XLS) by moving to `knowledge-base/files/` without processing
- Provides summary of changes and suggested actions
- Encourages use of `[[ ]]` notation for relationship tracking (Obsidian compatibility)
- Parses Granola-synced frontmatter (`granola_id`, `title`, `date`, `attendees`, `type`) as primary routing signals when processing files from `inbox/`
- Converts all detected email addresses in file content and frontmatter to `[[@email@domain.com]]` Obsidian wiki-link notation before filing
- Delegates complex meeting note routing to the `process-meeting-note` BMAD skill (see FR42)
- **Confidence-gated routing:** When routing confidence falls below threshold, pauses processing for that file, presents the proposed destination with a rationale, and awaits user confirmation before writing any files. High-confidence decisions proceed automatically and are shown in the processing summary with their rationale so the user can build trust in the logic over time
- **Single-pass AI execution:** For each transcript, performs one AI call that ingests only the transcript and lightweight identity context (frontmatter-only from matching profile files — never full context files). The AI produces a structured change manifest (primary file + appends + task extracts) which the CLI then applies atomically. This keeps token cost O(1) per transcript regardless of how large context files have grown
- **Append-only context updates:** Secondary context files (e.g., `context.md`) are updated by appending a dated, self-contained excerpt block at the end of the file. The AI never needs to read existing context content to generate an append entry. Users decide when to clean up old entries; the system does not auto-summarize or truncate context files
- **Archive after processing:** Once a transcript is fully processed, the original file is moved from `inbox/` to `archive/{year}/{month}/inbox/{original-filename}.md` with `processed: true` and `routed_to: [...]` appended to its frontmatter. This preserves the original for user auditing and enables future re-processing by moving the file back to `inbox/`
- **Optional process log:** When the `process_log` config flag is enabled (default: `false`), each `tmr process` run appends a structured entry to `my-tasks/process-log.md` recording every file processed, its routing destination, confidence level, and whether user approval was required

**FR5:** The system shall provide a `tmr watch` command that monitors the `inbox/` directory and automatically runs `tmr process` when new files are detected.

**FR6:** The system shall maintain AI-enhanced context summaries:
- `my-teams/{team}/{member-email}/context.md` - Running summary of all interactions with team member
- `my-projects/{project}/context.md` - Running summary of all project activity
- `my-career/profile.md` - Leader's own profile and development areas
- `my-leadership/{leader-email}/profile.md` - Each leader's expectations and style
- `my-company/relationships/{email}/context.md` - Running summary of company-wide relationships
- Context updates triggered automatically by `tmr process` command after inbox processing
- **Email-as-identity convention (critical):** Every `{email}/` folder in the system must also contain a root file named exactly `{email}.md` (e.g., `john.doe@company.com.md`). This file is the identity anchor that enables Obsidian graph view link resolution — all `[[@email]]` wiki-links resolve to this file. This applies consistently to `my-teams/`, `my-leadership/`, `my-company/relationships/`, and `operations/hiring/candidates/` wherever email-based folders exist.

**FR7:** The system shall provide time-based task views:
- `tmr today` - Display urgent tasks, scheduled 1:1s, and attention items for today
- `tmr this-week` - Display weekly priorities, people check-ins, and project milestones
- `tmr this-month` - Display monthly objectives and key deadlines
- `tmr this-quarter` - Display quarterly goals and strategic initiatives

**FR8:** The system shall implement an Agent System with specialized personas:
- **cycle-agent**: Inbox processing and intelligent categorization
- **tmr-people**: People management (1:1s, feedback, PDP, PIP, reviews)
- **tmr-project**: Project management (status reports, risk assessments, health checks)
- **tmr-career**: Leader's own career development (PDP, brag document, self-reviews)
- **tmr-hiring**: Recruitment support (candidate reviews, job descriptions, interview guides)
- **tmr-master**: All-in-one agent for web platform usage
- All agent and skill definitions shall be authored as **BMAD Builder-compliant** modules following the BMAD Method specification (https://github.com/bmad-code-org/bmad-builder). The `.tm-core/` system structure follows BMAD module conventions, enabling community extensibility through standardized BMAD-compliant packaging.

### People Management (FR9-FR16)

**FR9:** The system shall provide `tmr team add <team-name> <member-email>` to create team member structure including:
- `my-teams/{team-name}/{member-email}/profile.md` with frontmatter template (role, skills, current projects, status)
- `my-teams/{team-name}/{member-email}/context.md` for AI-maintained interaction summary (auto-updated by `tmr process`)
- `my-teams/{team-name}/{member-email}/pdp.md` for Personal Development Plan
- Subdirectories: `1on1s/`, `feedback/`, `reviews/`
- Status field in profile.md (active/inactive) set during creation

**FR10:** The system shall provide a `utils/` folder containing copy/paste prompts for profile collection that can be shared with team members to gather structured information about their background, skills, work style, and career goals. No command needed - leaders copy the prompt and share it directly with team members.

**FR11:** The system shall provide `tmr team archive <team-name> <member-email> [--from DATE --to DATE]` to move a team member to `my-teams/archived/{year}/{team-name}/{member-email}/` when they leave the company, preserving all historical context. Optional date filters allow partial archive of specific time periods.

**FR12:** The system shall provide `tmr team fire <team-name> <member-email>` as a distinct operation from archive that:
- Moves member to `my-teams/archived/{year}/{team-name}/{member-email}/`
- Adds frontmatter field: `departure_reason: terminated` and `departure_date: {date}`
- Auto-finalizes any active PIP documentation
- Preserves all historical context for legal/HR purposes
- Marks as distinct from voluntary departures in archive metadata

**FR13:** The system shall provide agent commands for people management:
- `*1on1-prepare <member>` - Generate 1:1 agenda from context, PDP, recent feedback, and tasks
- `*feedback <member> --tone=positive|constructive` - Generate feedback draft based on context
- `*pdp-generate <member>` - Create structured Personal Development Plan using SKILL.md with role-specific references (PDP updates are manual)
- `*pip-create <member>` - Create Performance Improvement Plan
- `*review-generate <member> --period=<month|quarter|semester|year>` - Generate performance review draft for specified period

**FR14:** The system shall support a structured PDP (Personal Development Plan) format including:
- Current role and aspirations
- 3-5 development goals with success criteria
- Action plans for each goal
- Progress tracking (updated manually by leader)
- Support needed from manager and team
- Timeline and check-in schedule
- PDP output format stored in separate template file for extensibility

**FR15:** The system shall track member-project relationships through:
- Frontmatter in both `my-teams/{team}/{member-email}/profile.md` and `my-projects/{project}/brief.md`
- `[[ ]]` notation for Obsidian compatibility in all relationship references
- Bidirectional linking support for visualizing relationships in Obsidian

**FR16:** The system shall provide `tmr show <member>` to display current context summary, recent 1:1s, active PDP goals, and upcoming check-ins for a team member.

### Project Management (FR17-FR22)

**FR17:** The system shall provide `tmr project add <name>` to create project structure including:
- `my-projects/{name}/brief.md` with frontmatter template (team, timeline, status, priority)
- `my-projects/{name}/context.md` for AI-maintained project summary
- Subdirectories: `status-reports/`, `risk-assessments/`, `meetings/`, `incidents/`

**FR18:** The system shall provide `tmr project archive <name> [--from DATE --to DATE]` to move completed projects to `my-projects/archived/{year}/`. Optional date filters allow partial archive of specific time periods.

**FR19:** The system shall provide agent commands for project management:
- `*status-report <project>` - Generate weekly status report from context and meetings
- `*risk-assessment <project>` - Assess current project risks and mitigation strategies
- `*health-check <project>` - Comprehensive project health analysis

**FR20:** The system shall provide `tmr show <project>` to display current context, recent status reports, risk assessments, and team allocation.

**FR21:** Status reports shall include: progress this week, risks and blockers, team capacity, next week's plan, budget status (if applicable).

**FR22:** Risk assessments shall include: identified risks with severity scoring, impact analysis, mitigation strategies, owner assignment.

### Manager's Career (FR23-FR27)

**FR23:** The system shall create `my-career/` directory during initialization containing:
- `profile.md` - Leader's own background, management style, strengths, development areas (collection uses utils folder approach)
- `pdp.md` - Personal Development Plan aligned with leader's expectations
- `brag-document.md` - Running log of achievements, wins, and impact for performance reviews (manual updates, suggested structure provided)

**FR24:** The system shall provide agent commands for career management:
- `*pdp-generate` - Create Personal Development Plan for the leader using SKILL.md with role-specific references (PDP updates are manual)
- `*brag-summarize` - Summarize achievements from brag document
- `*self-review <period>` - Draft self-performance review

**FR25:** *(Removed - brag document managed manually. System provides suggested default structure during initialization.)*

**FR26:** The system shall support multiple leadership relationships through `my-leadership/` directory with per-leader structure:
- `my-leadership/{leader-email}/profile.md` - Each leader's expectations, communication style, priorities
- `my-leadership/{leader-email}/alignments/` - Transcripts and notes from 1:1s with that leader
- `my-leadership/{leader-email}/challenges/` - Harsh feedback or difficult conversations with that leader
- `my-leadership/{leader-email}/pip.md` - Performance Improvement Plan if applicable
- Command: `tmr leadership add <leader-email>` to create new leadership relationship structure

**FR27:** The process agent shall recognize and categorize 1:1 transcripts with leader's managers, filing them in appropriate `my-leadership/{leader-email}/alignments/` or `my-leadership/{leader-email}/challenges/` folders based on content, and updating both leader's context and PDP alignment.

### Operations (FR28-FR34)

**FR28:** The system shall provide `tmr hiring open <role-and-seniority>` to create hiring pipeline structure:
- `operations/hiring/{role}/job-description.md` (auto-generated based on role and seniority, customizable by leader)
- `operations/hiring/{role}/candidates/` directory
- Job description template selected based on role/seniority pattern

**FR29:** *(Removed - not necessary. Candidate folders created automatically by process agent when interview transcripts are categorized.)*

**FR30:** The system shall support interview tracking through:
- `operations/hiring/{role}/candidates/{candidate-name}/` folder structure
- Interview transcripts auto-categorized by process agent
- Interview notes stored as `.md` files representing each meeting
- Agent command `*candidate-review <candidate> --approved=true|false` to generate comprehensive candidate assessment including technical evaluation, culture fit, recommendation, and onboarding notes

**FR31:** The system shall organize meetings at multiple levels:
- `my-projects/{project}/meetings/` - Project-specific meetings
- `my-teams/{team}/meetings/` - Team-specific meetings  
- `my-company/meetings/` - Company-wide meetings (all-hands, townhalls, strategy sessions)
- `my-company/relationships/{email}/` - Interactions with company members not in direct team or project contexts
- Process agent categorizes meeting transcripts to appropriate level based on participants and content

**FR32:** The process agent shall categorize meeting transcripts into appropriate folders (project/team/company level) based on content and participants, using email-based identification for company relationships.

**FR33:** The system shall provide `my-projects/{project}/incidents/` for project-specific incident documentation and post-mortems, tying incidents directly to the projects they affect.

**FR34:** The system shall provide `operations/finance/` for budget-related notes and tracking.

### Knowledge Base (FR35-FR37)

**FR35:** The system shall create `knowledge-base/` structure:
- `people/` - Company culture, values, onboarding processes
- `process/` - Performance review process, promotion criteria, incident response
- `company/` - Strategy, org chart, department information
- `methodology.md` - Manager's personal management philosophy and style

**FR36:** The system shall support knowledge base management through manual file placement:
- Leaders place files directly in `knowledge-base/` subdirectories (people/, process/, company/)
- Binary files (PDF, PPTX, XLS) placed in `knowledge-base/files/` subdirectory
- Process agent moves binary files from inbox to `knowledge-base/files/` without processing
- Process command optimized for .md, .txt, .json files
- No command needed - simple file system operations

**FR37:** The agents may reference knowledge base entries when generating outputs (e.g., culture fit in candidate reviews, process adherence in performance reviews, company values in feedback).

### Agent System & Extensibility (FR38-FR42)

**FR38 (Revised): BMAD Builder Integration**
The system's agent and skill extensibility layer shall be built on the BMAD Builder framework (https://github.com/bmad-code-org/bmad-builder). Agent definitions, skill workflows, and task templates shall follow the BMAD Method module specification. Community extensibility is achieved through BMAD-compliant module packaging rather than a custom YAML pack engine. The custom Prompt Pack Engine (previously FR38-FR40) is superseded by BMAD Builder.

**FR39:** *(Superseded — custom pack validation replaced by BMAD Builder framework)*

**FR40:** *(Superseded — base-pack.yaml replaced by BMAD Builder module structure)*

**FR41: Obsidian Vault & Plugin Setup**
The system shall provide a setup guide (`docs/setup/obsidian-setup.md`) covering:
1. Installing Obsidian and opening the workspace folder as the Obsidian vault
2. Manually installing the `obsidian-granola-plugin` ([philfreo/obsidian-granola-plugin](https://github.com/philfreo/obsidian-granola-plugin)) for meeting note ingestion
3. Configuring Granola plugin settings: Base Folder → Custom Folder → `inbox`; Filename Pattern → `{date}-{title}`; Sync Notes → enabled
4. Expected Granola note format (frontmatter fields) and how it integrates with `tmr process`
5. Installing the **Obsidian Terminal** plugin ([polyipseity/obsidian-terminal](https://github.com/polyipseity/obsidian-terminal)) to enable running `tmr` CLI commands directly from within Obsidian — eliminating the need to switch to an external IDE or terminal for data operations
6. Configuring Obsidian Terminal: setting the default shell profile, opening a terminal panel via the ribbon or command palette, and running `tmr process`, `tmr today`, etc. from inside Obsidian
7. Verification steps to confirm: Granola notes landing in `inbox/`, terminal plugin running `tmr` commands successfully
8. Recommended Obsidian panel layout: vault file tree on the left, active note in the center, terminal panel at the bottom — enabling a complete "capture → process → review" workflow without leaving Obsidian

**FR42: Dedicated Meeting Note Processing Skill**
The system shall provide a `process-meeting-note` BMAD skill that handles the complex routing of Granola-synced notes from `inbox/`. The skill shall:
- Parse Granola frontmatter metadata (`granola_id`, `attendees`, `date`, `title`, `type`) as primary routing signals
- Identify all email addresses in the attendees list and file content
- Generate `[[@email@domain.com]]` Obsidian wiki-links for all identified persons, ensuring Obsidian graph view links resolve to the `{email}.md` identity file in the corresponding `{email}/` folder
- Determine the correct destination category based on attendees and content analysis, following this priority order: (1) Granola `type` field if set, (2) attendee pattern matching, (3) content keyword analysis
- Extract key insights per attendee and distribute content updates to all relevant context files
- Handle multi-attendee meetings by routing insights to all affected entity folders
- Create or update the `{email}.md` identity file for any new email address encountered

**Routing Decision Table (attendee pattern → primary destination):**

| Meeting Type | Attendee Pattern | Primary Destination | Secondary Appends |
|---|---|---|---|
| 1:1 with direct report | Leader + 1 team member | `my-teams/{team}/{email}/1on1s/{date}.md` | `{email}/context.md` |
| Team meeting | Leader + 2+ same-team members | `my-teams/{team}/meetings/{date}-{title}.md` | Each member's `context.md` |
| Leadership sync | Leader + their manager | `my-leadership/{manager-email}/alignments/{date}.md` | `my-career/` note |
| Project meeting | Leader + mixed project stakeholders | `my-projects/{project}/meetings/{date}-{title}.md` | `{project}/context.md`, each attendee's `context.md` |
| Hiring interview | Leader + candidate (+ interviewers) | `operations/hiring/{role}/candidates/{name}/interview-{date}.md` | Candidate notes |
| All-hands / company-wide | 10+ attendees or no team/project match | `my-company/meetings/{date}-{title}.md` | Mentioned projects/people |
| Cross-functional / stakeholder | Mixed teams + external | `my-projects/{project}/meetings/` if project identified, else `my-company/meetings/` | Multiple contexts |
| Skip-level | Leader + manager's manager | `my-leadership/{email}/alignments/{date}.md` | `my-career/` |
| Incident review | Leader + team + others, incident keywords | `my-projects/{project}/incidents/{date}-{title}.md` | `{project}/context.md` |
| Unknown person (no match) | Person not in vault | Auto-create `my-company/relationships/{email}/` | Identity file + first context entry |

**Sharding principle — One Primary, Many References:**
Every transcript has exactly one canonical primary file. All secondary updates are append-only excerpts that link back to the primary via `[[]]` notation. The primary note links outward to all attendees and related entities. This creates a bi-directional Obsidian graph without duplicating content.

**Standard file header for generated meeting notes:**
Every primary meeting note file shall open with a frontmatter block and a `> Connections:` callout line:
```markdown
---
granola_id: {id}
title: {title}
date: {date}
type: {resolved-type}
project: "[[{project}]]"           # if applicable
attendees:
  - "[[@email@domain.com]]"
source: "[[archive/{year}/{month}/inbox/{original-filename}]]"
processed: true
---

# {title}

> **Connections:** [[{project}]] · [[@attendee1]] · [[@attendee2]]
> **Source transcript:** [[archive/{year}/{month}/inbox/{original-filename}]]
```

**Standard append entry for secondary context files:**
```markdown
# {date} — {meeting-title}

*Source: [[{primary-file-path}]]*

{per-person excerpt with key decisions, action items, and observations}
**Action items:** [[my-tasks/this-week]] (if any)
```

**Folder philosophy (critical for routing decisions):**
`my-teams/{team}/{member}/` is a *people and career folder* — it stores 1:1s, PDPs, feedback, and reviews. When a team member attends a project meeting or cross-functional meeting, the meeting note lives under `my-projects/` or `my-company/`, and the team member is referenced via `[[@email]]`. Their `context.md` receives an appended excerpt linking back to the primary note. The processing summary shall explicitly communicate this categorization logic to the user so the routing rationale is transparent.

## Non-Functional Requirements

**NFR1:** The system shall run as a local-first application without requiring external cloud services except for user-provided AI API endpoints.

**NFR2:** The system shall be cross-platform compatible, supporting Mac, Linux, and Windows operating systems.

**NFR3:** The system shall implement the Adapter Pattern for AI providers, ensuring loose coupling and enabling addition of new providers without modifying core logic.

**NFR4:** The system shall use safe file operations to ensure atomic writes and prevent data loss during state transitions.

**NFR5:** The system shall provide clear terminal UI feedback using spinners (ora), colored output (chalk), and progress indicators for enhanced user experience.

**NFR6:** The system shall store all management data as plain Markdown files with YAML frontmatter in a human-readable, version-control-friendly format.

**NFR7:** The system shall maintain zero external dependencies for data storage, ensuring users retain full ownership and portability of their data.

**NFR8:** The system shall complete the `tmr process` command processing within reasonable time bounds, scaling to handle up to 20 inbox files without performance degradation.

**NFR9:** The system shall implement graceful error handling for AI API failures, providing clear error messages with recovery suggestions.

**NFR10:** The system shall validate Prompt Pack YAML structure using Zod schema validation before execution to prevent runtime errors.

**NFR11:** The system shall be distributed as `@marlonvidal/tech-leadership-os` on npm with the binary command `tmr`.

**NFR12:** The system shall support IDE integration for Cursor (.cursor/rules/tmr/), Claude Code (.claude/agents/), Gemini CLI (.gemini/agents/), and GitHub Copilot (.github/copilot/skills/).

**NFR13:** CLI commands should respond in <100ms (excluding AI calls). AI operations should show progress indicators after 500ms. Binary file moves complete quickly without processing overhead.

**NFR14:** The system shall use AES-256 encryption for API keys stored in OS-specific config directories.

**NFR15:** The system shall support environment variable overrides (`TM_PROVIDER`, `TM_API_KEY`) for configuration.

---
