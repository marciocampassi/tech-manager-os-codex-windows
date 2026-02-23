# Detailed Specifications Needed Before Implementation

## Specification 1: base-pack.yaml (Critical)

**Owner:** Product Manager + Prompt Engineer  
**Estimated Effort:** 8-10 hours  
**Deliverable:** Complete base-pack.yaml file with all command definitions

**Contents:**
- Meta section (name, version, author)
- 20+ command definitions including:
  - cycle-agent: categorize, process-inbox, update-tasks
  - tmr-people: 1on1-prepare, feedback, pdp-generate, pip-create, review-generate
  - tmr-project: status-report, risk-assessment, health-check
  - tmr-career: pdp-generate, brag-summarize, self-review
  - tmr-hiring: candidate-review, job-description, interview-guide

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

## Specification 2: Process Categorization Algorithm (Critical)

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

## Specification 3: Template Definitions (Critical)

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

## Specification 4: Agent Persona Definitions (High Priority)

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
2. tmr-people: Empathetic coach and development partner
3. tmr-project: Strategic project leader
4. tmr-career: Career counselor for the leader
5. tmr-hiring: Talent assessment specialist

## Specification 5: IDE Integration Files (High Priority)

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
