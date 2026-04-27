# Design Decisions Checklist

## Items Requiring Detailed Specification (Future Sessions)

Use this checklist to track what needs to be defined before implementation. Each item should have its own design session/document.

### 🎯 **CRITICAL PATH** (Required for MVP)

- [ ] **base-pack.yaml Complete Specification**
  - [ ] All command definitions with full prompts
  - [ ] System prompts for each agent persona
  - [ ] User prompt templates with variable placeholders
  - [ ] Temperature and max_tokens for each command
  - [ ] Input source specifications (file paths, keywords)
  - [ ] Output path specifications and templates
  - [ ] Estimated: 8-10 hours of prompt engineering

- [ ] **Process Agent Categorization Logic**
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
  - [ ] tmr-people: Personality, communication style, expertise areas
  - [ ] tmr-project: Personality, communication style, expertise areas
  - [ ] tmr-career: Personality, communication style, expertise areas
  - [ ] tmr-hiring: Personality, communication style, expertise areas
  - [ ] cycle-agent: Analytical approach, decision-making style
  - [ ] Each agent needs: backstory, expertise, limitations, tone

- [ ] **IDE Integration Specifications**
  - [ ] Cursor: .mdc file format and structure (with examples)
  - [ ] Claude Code: Agent file format and invocation patterns
  - [ ] Gemini CLI: Agent file format and invocation patterns
  - [ ] Agent loading mechanism for each IDE
  - [ ] Context file auto-loading rules

### 📋 **HIGH PRIORITY** (Needed early in implementation)

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

### 🔧 **MEDIUM PRIORITY** (Can be refined during development)

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

- [ ] **Multi-Entity Handling in Process**
  - [ ] If note mentions 3 people, do we copy to all 3 contexts?
  - [ ] If note mentions person + project, update both?
  - [ ] Handling general notes (no clear entity match)
  - [ ] Priority when destinations conflict

- [ ] **Confidence Scoring and Manual Review**
  - [ ] What confidence threshold triggers manual review?
  - [ ] Manual review UI/UX (interactive prompt in terminal?)
  - [ ] Can user teach the system (improve future categorization)?
  - [ ] Feedback loop for improving categorization

### 🎨 **NICE TO HAVE** (Can defer to later iterations)

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
