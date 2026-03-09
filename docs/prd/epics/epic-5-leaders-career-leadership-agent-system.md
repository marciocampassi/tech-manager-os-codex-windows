# Epic 5: Leader's Career & Leadership Agent System

**Expanded Goal:** Enable managers to track their own career development with agent-assisted PDP management, brag document summarization, self-review generation, and leadership alignment tracking. All agent commands use Epic 2 CLI for file operations, ensuring consistent token-optimized operations. This epic ensures managers don't neglect their own growth.

## Story 5.1: Manager Career Commands

**As a** manager,  
**I want** to manage my own career development,  
**so that** I'm intentional about my growth.

**Acceptance Criteria:**

1. `tmr my profile` opens profile in editor
2. `tmr my pdp` opens PDP in editor
3. Brag document managed manually (no commands)
4. Files created during `tmr init` with suggested brag structure
5. Unit tests for profile/pdp commands

## Story 5.2: tmr-career Agent - PDP Management

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

## Story 5.3: tmr-career Agent - Brag Document and Self-Review

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

## Story 5.4: Leadership Alignment Tracking

**As a** manager,  
**I want** my 1:1s with my leader tracked,  
**so that** I maintain alignment.

**Acceptance Criteria:**

1. Process agent recognizes transcripts with leader (based on my-leadership/profile.md)
2. **Uses CLI:** Executes `tmr leadership <email> add 1on1`
3. Updates manager's context with alignment notes
4. Flags misalignment with PDP
5. Integration test validates categorization

---
