# Database Schema

Tech Leadership OS uses the **file system as the database** with structured markdown files and YAML frontmatter. This section defines the "schema" through file structure and frontmatter specifications.

## Team Member Schema

**File:** `my-teams/{team}/{email}/profile.md`

```yaml
---
email: john.doe@company.com
name: John Doe
role: Senior Software Engineer
team: alpha
status: active
hire_date: 2024-03-15
skills:
  - TypeScript
  - React
  - System Design
current_projects:
  - "[[api-redesign]]"
  - "[[mobile-app]]"
manager_notes: Strong technical skills, interested in tech lead role
---

# John Doe - Profile

# Background
[Additional details...]
```

**Identity Anchor:** `my-teams/{team}/{email}/{email}.md` (enables Obsidian `[[@email]]` linking)

---

## Project Schema

**File:** `my-projects/{project}/brief.md`

```yaml
---
name: api-redesign
display_name: API Redesign Initiative
team: alpha
status: active
priority: P0
start_date: 2026-01-15
target_date: 2026-04-30
assigned_members:
  - "[[@john.doe@company.com]]"
  - "[[@jane.smith@company.com]]"
stakeholders:
  - "[[@cto@company.com]]"
description: Complete overhaul of REST API to GraphQL
---

# API Redesign Initiative

# Overview
[Project details...]
```

---

## Context Entry Schema

**File:** `my-teams/{team}/{email}/context.md` or `my-projects/{project}/context.md`

```markdown
---
last_updated: 2026-02-20
total_entries: 47
---

# Context Entries

## 2026-02-20 | 1:1 Meeting
**Source:** [[my-teams/alpha/john.doe@company.com/1on1s/2026-02-19.md]]  
**Topics:** Career growth, API redesign progress, team dynamics  
**Sentiment:** Positive

John expressed interest in taking on tech lead responsibilities. Discussed readiness signals: mentoring junior developers, driving architectural decisions, and improving communication skills. Agreed to shadow Sarah on next architecture review.

**Action Items:**
- [ ] John to lead next sprint planning
- [ ] Schedule shadowing session with Sarah

**Notable:** "I feel ready to step up, but want to make sure I'm not leaving gaps in my current work."

---
```

---

## Task Schema

**File:** `my-tasks/this-week.md`, `my-tasks/today.md`, etc.

```markdown
---
view: task-list
last_updated: 2026-02-20
---

# This Week's Tasks

- [ ] **Review [[@john.doe@company.com]]'s PR** (P0) - Due: 2026-02-22
  - Source: [[my-teams/alpha/john.doe@company.com/1on1s/2026-02-19.md]]
  - Context: Needs feedback before deployment
  - Related: [[api-redesign]]

- [ ] **Prepare Q1 status report** (P1) - Due: 2026-02-25
  - Source: [[my-leadership/vp@company.com/alignments/2026-02-18.md]]
  - Context: Quarterly business review preparation

- [x] **Complete John's PDP review** (P2) - Due: 2026-02-20
  - Source: [[my-teams/alpha/john.doe@company.com/1on1s/2026-02-13.md]]
  - Completed: 2026-02-20
```

---

## Leader Schema

**File:** `my-leadership/{email}/profile.md`

```yaml
---
email: vp.engineering@company.com
name: Sarah Johnson
role: VP of Engineering
reporting_relationship: direct-manager
communication_style: Direct, data-driven, appreciates written updates
priorities:
  - Team growth and retention
  - Technical excellence
  - Delivery predictability
expectations: Weekly status updates, proactive escalation, team development focus
---

# Sarah Johnson - VP of Engineering

# Communication Preferences
- Prefers async updates via written docs
- Weekly 1:1s on Mondays at 2pm
- Appreciates data-backed decisions

# Key Focus Areas
[Additional context...]
```

---

## Configuration Schema

**File:** `~/.config/tmr/config.json`

```json
{
  "version": "1.0.0",
  "workspace_path": "/Users/marlon/tmr-workspace",
  "active_provider": "claude",
  "confidence_threshold": 0.75,
  "process_log_enabled": false,
  "providers": {
    "openai": {
      "model": "gpt-5-mini",
      "api_key_encrypted": "U2FsdGVkX1...",
      "configured_date": "2026-02-20"
    },
    "claude": {
      "model": "claude-sonnet-4-5-20250929",
      "api_key_encrypted": "U2FsdGVkX1...",
      "configured_date": "2026-02-20"
    },
    "gemini": {
      "model": "gemini-2.5-flash",
      "api_key_encrypted": "U2FsdGVkX1...",
      "configured_date": "2026-02-20"
    }
  }
}
```

---

## Archive Metadata Schema

**File:** `archive/{year}/{month}/inbox/{filename}.md`

Original file with appended frontmatter:

```yaml
---
# Original Granola frontmatter
granola_id: abc123
title: "1:1 with John Doe"
date: 2026-02-19
attendees:
  - john.doe@company.com
  - marlon@company.com

# Added by tmr process
processed: true
processed_date: 2026-02-20T14:30:00Z
routed_to:
  - my-teams/alpha/john.doe@company.com/1on1s/2026-02-19.md
confidence: 0.94
processor_version: 1.0.0
---
```

---
