# Epic 7: Agent System & BMAD Builder Integration

**Expanded Goal:** Build the complete agent and skill system using the BMAD Builder framework as the foundational engine. Implement all tmr-* agent definitions as BMAD-compliant modules, author the `process-meeting-note` skill for intelligent Granola note routing, create IDE integration files for Cursor/Claude/Gemini/GitHub Copilot, and deliver SKILL.md-based extensibility aligned with the BMAD Method module specification. This epic replaces the previously planned custom Pack Engine with BMAD Builder.

## Story 7.1: BMAD Builder Module Structure Setup

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

## Story 7.2: `process-meeting-note` BMAD Skill

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

## Story 7.3: Template Engine with Variable Injection

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

## Story 7.4: Agent Definitions

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

## Story 7.5: IDE Integration Files

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

## Story 7.6: BMAD Core Module — Base Skills and Tasks

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
