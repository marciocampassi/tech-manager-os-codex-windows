# Epic 2: Complete Command-Line Interface Implementation

**Expanded Goal:** Build comprehensive CLI commands that establish the CRUD foundation for the entire system. Implement team management with multi-team structure (Option A: separate _members/ and _teams/ directories), member file operations (1on1s, feedback, assessments, performance reviews), relationship tracking, leadership tracking, and project management. All commands support both parameter-passing and interactive modes, implement hierarchical email resolution (team → leadership → relationships), auto-create structures as needed, generate Obsidian-compatible wiki-links, and include complete unit test coverage. This epic also aligns `tmr init` with the canonical Epic 2 workspace structure (Story 2.8), installs Obsidian plugins automatically during init (Story 2.7), provides time-based task view commands (Story 2.9), and creates an Action Items Tracker per team member with optional Google Docs sync (Story 2.10). This epic enables token-optimized agent implementation where agents invoke CLI commands for file manipulation instead of reading/parsing files directly.

## Story 2.1: Team Management Commands

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

3. **`tmr team add <team-name> <email> [--role=<role>] [--gender=<gender>] [--location=<location>]` Command:**
   - Auto-creates team if doesn't exist
   - If no parameters provided, prompts interactively for: team-name, email, role, location
   - Creates member directory structure (if doesn't exist)
   - Generates `{email}.md` with frontmatter:
     ```yaml
     ---
     email: user@example.com
     name: <collected-name>
     role: <collected-role>
     gender: <collected-gender>
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

## Story 2.2: Member File Management Commands

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

## Story 2.3: Relationship Management Commands

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

## Story 2.4: Leadership Management Commands

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

## Story 2.5: Project Management Commands

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

## Story 2.6: Email Resolution Service

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

## Story 2.7: Obsidian Plugin Setup in `tmr init`

**As a** manager setting up my workspace,
**I want** `tmr init` to automatically install Obsidian plugins into the workspace vault,
**so that** when I open the folder as an Obsidian vault, the plugins are already configured and ready to use without manual installation.

**Acceptance Criteria:**

1. **`.obsidian/plugins/` directory structure created** for three plugins: `obsidian-git`, `obsidian-granola-sync`, `obsidian-terminal`

2. **Plugin files downloaded from GitHub latest releases** using the URL pattern `https://github.com/{owner}/{repo}/releases/latest/download/{file}`:
   - `obsidian-git`: `https://github.com/Vinzent03/obsidian-git`
   - `obsidian-granola-sync`: `https://github.com/tomelliot/obsidian-granola-sync`
   - `obsidian-terminal`: `https://github.com/polyipseity/obsidian-terminal`
   - Files per plugin: `main.js`, `manifest.json`, `styles.css` (skip 404s silently)

3. **`.obsidian/community-plugins.json`** created enabling all three plugins

4. **`.obsidian/app.json`** created with minimal `{}` content

5. **Download behavior:** concurrent, non-fatal on failure, 30s timeout per file, spinner progress

6. **`ObsidianPluginService`** class at `src/services/obsidian-plugin.service.ts` with `installPlugins(workspacePath)` and `downloadPluginFile(pluginDir, url, filename)` methods; full unit test coverage

7. **Integration with `InitCommand`:** called after `buildWorkspaceStructure()`; next steps message updated

## Story 2.8: `tmr init` Workspace Structure Alignment with Epic 2

**As a** manager running `tmr init`,
**I want** the workspace structure and generated files to exactly match the folder/file conventions established by Epic 2 commands,
**so that** all subsequent `tmr team`, `tmr member`, `tmr leadership`, `tmr relationship`, and `tmr project` commands work correctly against the initialized workspace without any structural conflicts.

**Acceptance Criteria:**

1. **Workspace directories** updated to Epic 2 canonical paths:
   - Add: `my-teams/_members/`, `my-teams/_teams/`, `my-teams/_archived/`, `my-company/projects/`
   - Remove: `my-team/` (old path)

2. **Manager career profile** path changed to `my-career/{email}/{email}.md`; frontmatter aligned with Epic 2 schema; body includes `## Current Manager`, `## Previous Managers`, `## Performance Reviews`, `## 1on1s`, `## Assessments`, `## Feedbacks` sections

3. **Manager PDP** path changed to `my-career/{email}/pdp.md`

4. **Leadership profile** path changed to `my-leadership/{managerEmail}/{managerEmail}.md` with `1on1s/` subdirectory; frontmatter aligned with Story 2.4 schema

5. **Team member profiles** path changed to `my-teams/_members/{email}/{email}.md`; subdirectories `1on1s/`, `feedback/`, `assessments/`, `performance-reviews/` created per member; frontmatter aligned with Story 2.1 schema; `gender` field **kept**, `location` field added

6. **Default team** created when members collected: `my-teams/_teams/default/default-context.md` and `my-teams/_teams/default/default-members.md` with wiki-links

7. **Obsidian wiki-link notation** applied to all email references in generated files: `[[email]]` in frontmatter, `[[relative/path/to/file|display]]` in body links

8. **`TeamMember` type** updated: remove `gender`, add `location?: string`

9. **`promptTeamMembers`** updated: remove gender prompt, add optional location prompt

10. **All tests** updated to reflect new paths, new frontmatter, wiki-link assertions, and updated mock data

11. **Architectural debts resolved:** ARCH-1.6-04 (leadership flat path) and QA-1.6R-05 (career profile schema drift)

## Story 2.9: Time-Based Task View Commands

**As a** manager,
**I want** CLI commands to view my tasks organized by time horizon (`tmr today`, `tmr this-week`, `tmr this-month`, `tmr this-quarter`),
**so that** I can quickly see what needs my attention without opening Obsidian.

**Acceptance Criteria:**

1. `tmr today` reads `my-tasks/today.md` and displays content with color-coded header `📅 Today — {date}`; empty state message if file missing or blank; `--plain` and `--json` flags supported
2. `tmr this-week` reads `my-tasks/this-week.md`; header shows week date range
3. `tmr this-month` reads `my-tasks/this-month.md`; header shows month and year
4. `tmr this-quarter` reads `my-tasks/this-quarter.md`; header shows Q{N} {year}
5. `tmr init` creates all four task files with default empty template (`# Tasks — {period}\n\n_Run \`tmr process\` to populate..._`)
6. `TaskViewService` class with `readTaskFile(period, ws)`, `formatHeader(period)`, `renderContent(content, plain)` methods; `TaskPeriod` type union
7. All four commands registered in `src/cli.ts`; unit and integration tests

## Story 2.10: Action Items Tracker with Google Docs Sync

**As a** manager,
**I want** an action items tracker file auto-created for each team member — with an optional linked Google Doc — whenever I add a team member via `tmr init` or `tmr team add`,
**so that** I have a structured follow-up template in Obsidian locally and a shared collaborative document with the team member that stays in sync via Google AppScript.

**Acceptance Criteria:**

1. `action-items-{email}.md` created in `my-teams/_members/{email}/` during `tmr team add` and `tmr init` using the standard Action Items Tracker template; idempotent (skip if exists)
2. `## Action Items` section added to `{email}.md` with wiki-link `[[action-items-{email}|Action Items Tracker]]` after `## Feedbacks`; uses existing `SectionParserService`
3. All Google API calls config-gated (`google_drive_enabled: false` by default); when disabled, only `.md` is created — no network calls
4. During `tmr init`, optional Google Docs setup prompt: collect Drive folder ID, run OAuth2 flow, store token encrypted in config
5. When enabled: Google Doc `action-items-{email}` created in Drive via `GoogleDriveService`; shared with `{email}` as Editor; GDoc URL stored in member profile frontmatter as `action_items_gdoc`
6. `action-items-{email}.gdoc` pointer file (JSON shortcut) created alongside `.md` when integration enabled
7. `utils/sync-action-items.gs` AppScript always generated with actual Drive folder ID; `utils/sync-action-items-setup.md` comprehensive setup guide always generated
8. clasp is the **recommended and default-Yes** deployment path: when `clasp` is detected, prompt defaults to Yes; if not detected, display Option A (install clasp) + Option B (manual web editor) instructions referencing the setup guide; clasp failure falls back gracefully to manual instructions
9. Unit tests: template generation, `GoogleDriveService` (mocked), clasp detection/prompt scenarios, config-gated skip behavior, section update
10. Integration test: `tmr team add` with `google_drive_enabled: false` — `.md` created, profile section updated, no `.gdoc`, no network calls

---
