# Data Models

## Core Data Models Overview

The system manages structured markdown files with YAML frontmatter as the primary data storage mechanism. All entities are represented as files and folders in the Obsidian vault, with `[[wikilink]]` notation for relationships.

**Design Principles:**
- **Email-as-identity:** All person entities use email as primary identifier with `{email}.md` files for Obsidian graph linking
- **Append-only context:** Context files grow by appending dated entries, never requiring full read for AI updates
- **Pre-filled examples:** Boilerplate commands (`tmr team add`, `tmr project add`) create files with example attributes to demonstrate structure and guide users
- **Obsidian-first:** All data structures optimized for human readability and Obsidian compatibility

## Model: Team Member

**Purpose:** Represents an individual contributor or team member being managed, including their profile, development plans, and interaction history.

**Key Attributes:**
- `email`: string (primary identifier) - Team member's email address
- `name`: string - Full name
- `role`: string - Current job title (e.g., "Senior Software Engineer")
- `team`: string - Team name (e.g., "alpha", "platform-team")
- `status`: enum["active", "inactive"] - Employment status
- `hire_date`: date - When they joined the team
- `skills`: string[] - Technical and soft skills
- `current_projects`: string[] - Active project assignments (references to Project entities)
- `manager_notes`: string - Private observations and context

**Relationships:**
- Belongs to one **Team**
- Has many **Context Entries** (1:1s, feedback, observations)
- Has one **PDP** (Personal Development Plan)
- Associated with multiple **Projects**
- Has many **Tasks** (assigned or delegated)

**File Structure:**
```
my-teams/{team}/{email}/
├── {email}.md              # Identity anchor for Obsidian linking
├── profile.md              # Contains all attributes above in frontmatter
├── context.md              # Append-only context entries
├── pdp.md                  # Personal Development Plan
├── 1on1s/                  # Meeting transcripts
├── feedback/               # Feedback sessions
└── reviews/                # Performance reviews
```

## Model: Project

**Purpose:** Represents a work initiative, feature, or program being tracked, including status, team allocation, risks, and context.

**Key Attributes:**
- `name`: string (primary identifier) - Project slug (e.g., "api-redesign")
- `display_name`: string - Human-readable name (e.g., "API Redesign Initiative")
- `team`: string - Owning team name
- `status`: enum["planning", "active", "at-risk", "completed", "paused"] - Project health
- `priority`: enum["P0", "P1", "P2", "P3"] - Priority level
- `start_date`: date - Project kickoff
- `target_date`: date - Expected completion
- `assigned_members`: string[] - Team member emails working on this project
- `stakeholders`: string[] - Emails of key stakeholders
- `description`: string - Brief project summary

**Relationships:**
- Belongs to one **Team**
- Has many **Context Entries** (status updates, risk assessments)
- Has many **Team Members** (assigned)
- Has many **Tasks** (project-related todos)
- Has many **Transcripts** (project meetings)

**File Structure:**
```
my-projects/{name}/
├── brief.md                # Contains all attributes above in frontmatter
├── context.md              # Append-only context entries
├── status-reports/         # Weekly status updates
├── risk-assessments/       # Risk analysis documents
├── meetings/               # Project-specific meeting notes
└── incidents/              # Post-mortems and incidents
```

## Model: Task

**Purpose:** Represents actionable items extracted from transcripts or manually created, organized by time horizon (today, this week, this month, this quarter).

**Key Attributes:**
- `id`: string - Unique identifier (generated)
- `title`: string - Task description
- `status`: enum["todo", "in-progress", "blocked", "done"] - Completion state
- `priority`: enum["urgent", "high", "medium", "low"] - Importance level
- `due_date`: date - Target completion date
- `source_file`: string - Path to transcript/file where task was extracted
- `assigned_to`: string - Email of person responsible (can be leader or team member)
- `related_project`: string - Associated project name (optional)
- `related_person`: string - Associated team member email (optional)
- `context`: string - Additional notes about the task

**Relationships:**
- Optionally linked to **Team Member**
- Optionally linked to **Project**
- Originated from **Transcript** (source file)

**File Structure:**
```
my-tasks/
├── today.md                # Urgent tasks (due today or overdue)
├── this-week.md            # Tasks due this week
├── this-month.md           # Tasks due this month
├── this-quarter.md         # Longer-term objectives
└── completed/              # Archive of completed tasks (optional)
```

**Example Task Format:**
```markdown
- [ ] **Review [[@john.doe@company.com]]'s PR** (P0) - Due: 2026-02-20
  - Source: [[my-teams/alpha/john.doe@company.com/1on1s/2026-02-19.md]]
  - Context: Needs urgent feedback before deployment
```

**Note on Pre-filled Examples:** Commands that create boilerplate structures (`tmr team add`, `tmr project add`) will generate files with example attributes pre-filled to serve as templates and guide users on proper usage.

## Model: Context Entry

**Purpose:** Individual append-only log entries that build up context files for people and projects. Never edited once written, only appended.

**Key Attributes:**
- `date`: date - When this entry was created
- `source_file`: string - Path to source transcript
- `summary`: string - AI-generated summary of interaction/event
- `topics`: string[] - Key topics covered (e.g., ["performance", "project-x-status"])
- `sentiment`: enum["positive", "neutral", "constructive", "concern"] - Tone of interaction
- `action_items`: string[] - Tasks extracted from this entry
- `notable_points`: string[] - Key takeaways or quotes

**Relationships:**
- Belongs to **Team Member** or **Project** (parent entity)
- References source **Transcript**

**Example Context Entry Format:**
```markdown
## 2026-02-20 | 1:1 Meeting
**Source:** [[my-teams/alpha/john.doe@company.com/1on1s/2026-02-19.md]]  
**Topics:** Career growth, API redesign progress  
**Sentiment:** Positive

Summary of the interaction goes here...

**Action Items:**
- [ ] Follow-up task 1
- [ ] Follow-up task 2
```

## Model: Leader

**Purpose:** Represents the manager's own leaders (skip-level, direct manager, VPs, C-suite), including their expectations, communication style, and alignment meetings.

**Key Attributes:**
- `email`: string (primary identifier) - Leader's email address
- `name`: string - Full name
- `role`: string - Leadership position (e.g., "VP of Engineering")
- `reporting_relationship`: enum["direct-manager", "skip-level", "dotted-line"] - Relationship type
- `communication_style`: string - How they prefer to communicate
- `priorities`: string[] - Their key focus areas
- `expectations`: string - What they expect from the manager

**Relationships:**
- Has many **Context Entries** (1:1s, alignment meetings)
- Has many **Transcripts** (leadership meetings)

**File Structure:**
```
my-leadership/{email}/
├── {email}.md              # Identity anchor for Obsidian linking
├── profile.md              # Contains all attributes above
├── alignments/             # 1:1 meeting notes
└── challenges/             # Difficult conversations or feedback received
```

## Model: Hiring Candidate

**Purpose:** Represents candidates in the recruitment pipeline.

**Key Attributes:**
- `email`: string (primary identifier) - Candidate's email
- `name`: string - Full name
- `role_applied`: string - Position applied for
- `stage`: enum["screening", "phone-screen", "onsite", "offer", "rejected", "accepted"] - Pipeline stage
- `resume_link`: string - Path to resume file

**Relationships:**
- Has many **Transcripts** (interview notes)

**File Structure:**
```
operations/hiring/candidates/{email}/
├── {email}.md              # Identity anchor
├── profile.md              # Candidate information
└── interviews/             # Interview transcripts
```

---
