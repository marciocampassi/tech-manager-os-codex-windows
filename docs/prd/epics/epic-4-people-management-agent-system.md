# Epic 4: People Management Agent System

**Expanded Goal:** Implement people-focused agent commands for 1:1 preparation, feedback generation, PDP creation/updates, PIP management, and performance reviews. All agent commands leverage Epic 2 CLI for file manipulation, enabling token-optimized context operations where agents generate content and invoke CLI commands rather than directly reading/parsing files. This epic delivers intelligent assistance for the complete people management lifecycle.

## Story 4.1: Profile Collection Workflow

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

## Story 4.2: tmr-people Agent - 1:1 Preparation

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

## Story 4.3: tmr-people Agent - Feedback Generation

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

## Story 4.4: tmr-people Agent - PDP Management

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

## Story 4.5: tmr-people Agent - PIP and Performance Reviews

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
