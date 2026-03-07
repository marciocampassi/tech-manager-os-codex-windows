# Epic 6: Project Management Agent System

**Expanded Goal:** Implement project-focused agent commands for status reporting, risk assessment, and stakeholder communication. All agent commands leverage Epic 2 CLI for project structure management and team composition updates. This epic extends beyond people management to cover the operational aspects of project delivery.

## Story 6.1: Project Lifecycle Commands

**As a** manager,  
**I want** to view project information and status,  
**so that** I can track my project portfolio.

**Note:** Project creation commands are in Epic 2, Story 2.5. This story focuses on viewing and display commands.

**Acceptance Criteria:**

1. `tmr project list` displays table (implemented in Epic 2)
2. `tmr project show <name>` displays full project context
3. `tmr show <project>` displays context (implemented in Epic 2)
4. Unit tests for display commands

## Story 6.2: tmr-project Agent - Status Reports

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

## Story 6.3: tmr-project Agent - Risk Assessment

**As a** manager,  
**I want** AI to assess project risks,  
**so that** I can proactively mitigate issues.

**Acceptance Criteria:**

1. Agent command: `*risk-assessment <project>`
2. Analyzes recent context and identifies risks
3. Generates assessment: risk list, severity, mitigation strategies
4. Outputs to: `projects/active/{project}/risk-assessments/{date}.md`
5. Integration test validates risk identification

## Story 6.4: Hiring Workflow

**As a** manager,  
**I want** to manage hiring pipelines,  
**so that** I can track candidates systematically.

**Acceptance Criteria:**

1. `tmr hiring open <role-and-seniority>` creates job description (auto-generated based on role/seniority)
2. Interview transcripts auto-categorized by process agent to candidate folders
3. `tmr hiring list` displays open positions
4. Process agent creates candidate folders automatically
5. Unit tests for all commands

## Story 6.5: tmr-hiring Agent - Candidate Reviews

**As a** manager,  
**I want** AI to help review candidates,  
**so that** I make informed hiring decisions.

**Acceptance Criteria:**

1. Agent command: `*candidate-review <candidate> --approved=true|false`
2. Reads: interview transcripts, job description, culture values
3. Generates review: technical assessment, culture fit, recommendation
4. Outputs to: `operations/hiring/{role}/candidates/{name}/candidate-review.md`
5. Integration test validates review quality

## Story 6.6: Operations and Knowledge Base

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
