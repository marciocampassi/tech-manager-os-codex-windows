# Epic 3: People Management System

**Expanded Goal:** Implement complete people management lifecycle including member addition/archival, profile collection workflows, and all agent commands for 1:1 preparation, feedback generation, PDI creation/updates, PIP management, and performance reviews. This epic enables managers to effectively support their team's growth.

## Story 3.1: Team Member Lifecycle Commands

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

## Story 3.2: Profile Collection Workflow

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

## Story 3.3: tmr-people Agent - 1:1 Preparation

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

## Story 3.4: tmr-people Agent - Feedback Generation

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

## Story 3.5: tmr-people Agent - PDP Management

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

## Story 3.6: tmr-people Agent - PIP and Performance Reviews

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
