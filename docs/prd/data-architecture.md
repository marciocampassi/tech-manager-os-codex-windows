# Data Architecture

## Complete Folder Structure

```
tech-leadership-workspace/              # ← This folder IS the Obsidian vault root
├── .obsidian/                          # Obsidian vault config (auto-created by Obsidian)
│   └── plugins/
│       ├── obsidian-granola-plugin/    # Granola Sync plugin — meeting note ingestion (user-installed)
│       └── terminal/                  # Obsidian Terminal — run tmr CLI commands inside Obsidian (user-installed)
├── .tm-core/                           # Core agent system (BMAD Builder module)
│   ├── agents/                         # Agent definitions
│   │   ├── cycle-agent.md
│   │   ├── tmr-people.md
│   │   ├── tmr-project.md
│   │   ├── tmr-career.md
│   │   ├── tmr-hiring.md
│   │   └── tmr-master.md
│   ├── skills/                         # Workflow definitions
│   │   ├── cycle-workflow.md
│   │   ├── collect-profile.md
│   │   ├── onboarding-manager.md
│   │   └── archive-workflow.md
│   ├── tasks/                          # Task definitions
│   │   ├── prepare-1on1.md
│   │   ├── generate-feedback.md
│   │   ├── create-pip.md
│   │   ├── generate-pdi.md
│   │   ├── project-status-report.md
│   │   ├── project-risk-assessment.md
│   │   ├── candidate-review.md
│   │   ├── update-tasks-context.md
│   │   └── categorize-note.md
│   ├── templates/                      # Output templates
│   │   ├── leader-profile-tmpl.yaml
│   │   ├── leader-pdp-tmpl.yaml
│   │   ├── pdp-output-format.yaml      # Separate PDP output format
│   │   ├── brag-document-structure.yaml
│   │   ├── leadership-profile-tmpl.yaml
│   │   ├── member-profile-tmpl.yaml
│   │   ├── member-pdp-tmpl.yaml
│   │   ├── project-brief-tmpl.yaml
│   │   ├── job-description-tmpl.yaml
│   │   ├── candidate-review-tmpl.yaml
│   │   ├── interview-notes-tmpl.yaml
│   │   ├── 1on1-session-tmpl.yaml
│   │   ├── feedback-tmpl.yaml
│   │   ├── pip-tmpl.yaml
│   │   ├── status-report-tmpl.yaml
│   │   └── risk-assessment-tmpl.yaml
│   ├── packs/
│   │   └── base-pack.yaml              # Core methodology pack
│   └── core-config.yaml                # System configuration
├── .cursor/                            # Cursor IDE integration
│   └── rules/
│       └── tmr/
│           ├── tmr-people.mdc
│           ├── tmr-project.mdc
│           ├── tmr-career.mdc
│           ├── tmr-hiring.mdc
│           └── cycle-agent.mdc
├── .claude/                            # Claude Code integration
│   └── agents/
│       ├── tmr-people.md
│       ├── tmr-project.md
│       ├── tmr-career.md
│       ├── tmr-hiring.md
│       └── cycle-agent.md
├── .gemini/                            # Gemini CLI integration
│   └── agents/
│       ├── tmr-people.md
│       ├── tmr-project.md
│       ├── tmr-career.md
│       ├── tmr-hiring.md
│       └── cycle-agent.md
├── .github/                            # GitHub Copilot integration
│   └── copilot/
│       └── skills/
│           ├── tmr-people.md
│           ├── tmr-project.md
│           ├── tmr-career.md
│           └── tmr-hiring.md
├── .system/                            # Runtime system
│   ├── config.json                     # Encrypted configuration
│   └── watch.pid                       # Watch process tracking
├── inbox/                              # Universal drop zone (fed by Granola Sync plugin)
│   └── {date}-{title}.md              # Granola-synced meeting notes (filename: {date}-{title})
├── my-career/                          # Leader's career
│   ├── profile.md
│   ├── pdp.md
│   └── brag-document.md                # Manual updates
├── my-leadership/                      # Leader's managers (multiple)
│   └── {leader-email}/
│       ├── {leader-email}.md           # ← REQUIRED identity file (Obsidian link anchor)
│       ├── profile.md
│       ├── alignments/
│       │   └── [1on1 transcripts]
│       ├── challenges/
│       │   └── [harsh feedback conversations]
│       └── pip.md (if needed)
├── my-teams/                           # Team members (multi-team support)
│   ├── {team-name}/
│   │   ├── meetings/                   # Team-level meetings
│   │   └── {member-email}/
│   │       ├── {member-email}.md       # ← REQUIRED identity file (Obsidian link anchor)
│   │       ├── profile.md
│   │       ├── context.md              # AI-maintained
│   │       ├── pdp.md
│   │       ├── 1on1s/
│   │       ├── feedback/
│   │       ├── pip.md (if needed)
│   │       └── reviews/
│   └── archived/
│       └── {year}/
│           └── {team-name}/
│               └── {member-email}/
├── my-projects/                        # Projects
│   ├── {project-name}/
│   │   ├── brief.md
│   │   ├── context.md                  # AI-maintained
│   │   ├── status-reports/
│   │   ├── risk-assessments/
│   │   ├── meetings/                   # Project-level meetings
│   │   └── incidents/                  # Project-specific incidents
│   └── archived/
│       └── {year}/
│           └── {project-name}/
├── my-company/                         # Company-wide interactions
│   ├── meetings/                       # All-hands, townhalls, strategy
│   └── relationships/
│       └── {email}/                    # Non-team/project relationships
│           ├── {email}.md              # ← REQUIRED identity file (Obsidian link anchor)
│           └── [interaction notes]
├── operations/                         # Operational areas
│   ├── hiring/
│   │   └── {role-and-seniority}/
│   │       ├── job-description.md      # Auto-generated
│   │       └── candidates/
│   │           └── {candidate-name}/
│   │               ├── interview-{date}.md
│   │               ├── candidate-review.md
│   │               └── notes/
│   └── finance/
│       └── budget-notes.md
├── knowledge-base/                     # Organizational knowledge
│   ├── people/
│   │   ├── culture.md
│   │   ├── values.md
│   │   └── onboarding.md
│   ├── process/
│   │   ├── performance-review-process.md
│   │   ├── promotion-process.md
│   │   └── incident-response.md
│   ├── company/
│   │   ├── strategy.md
│   │   ├── org-chart.md
│   │   └── departments.md
│   ├── files/                          # Binary files (PDF, PPTX, XLS)
│   │   └── [manually placed or moved by process]
│   └── methodology.md
├── my-tasks/                           # Task tracking (AI-maintained)
│   ├── today.md
│   ├── this-week.md
│   ├── this-month.md
│   └── this-quarter.md
├── utils/                              # Copy/paste utilities
│   ├── team-member-profile-prompt.md
│   └── leader-profile-prompt.md
└── archive/
    └── {year}/
        └── {month}/
            └── inbox/
                └── {date}-{title}.md   # Processed originals (frontmatter: processed: true, routed_to: [...])
```

> **Folder Philosophy — People vs. Work:**
> `my-teams/{team}/{member}/` is a *people and career folder*: it stores 1:1s, PDPs, feedback, and reviews. Meeting notes from project or cross-functional meetings are never stored in a member's personal folder — they live under `my-projects/` or `my-company/`. The member is referenced via `[[@email]]` in those notes, and their `context.md` receives an appended excerpt linking back to the primary meeting file. This separation keeps people context focused on growth and relationships, and project/company context focused on work. The processing summary always communicates this routing decision explicitly.

## Frontmatter Schema Examples

**Member Profile:**
```yaml
---
email: sarah.chen@company.com
name: Sarah Chen
role: Senior Frontend Engineer
seniority: Senior
team: platform
hire_date: 2023-06-15
status: active
current_projects:
  - "[[mobile-redesign]]" (lead)
  - "[[api-performance]]" (contributor)
skills: [React, TypeScript, System Design]
aspirations: Staff Engineer or Technical Lead
last_1on1: 2026-02-08
next_1on1: 2026-02-15
---
```

**Project Brief:**
```yaml
---
project: Mobile App Redesign
status: active  # planning|active|paused|completed
priority: high  # low|medium|high|critical
team:
  lead: sarah-chen
  members: [mike-johnson, ana-rodriguez]
timeline:
  start: 2026-01-15
  target: 2026-03-31
  actual: null
health: yellow  # green|yellow|red
risks: 2
last_status: 2026-02-08
---
```

**Leader Profile:**
```yaml
---
name: Marlon Vidal
email: marlon.vidal@company.com
role: Engineering Manager
experience_years: 8
leadership_style: Servant leadership, data-driven
teams:
  - platform (5 members)
  - infrastructure (3 members)
reports_to:
  - "[[joao.silva@company.com]]"
  - "[[ana.costa@company.com]]" (matrix reporting)
strengths: [Technical depth, Empathy, Strategic thinking]
development_areas: [Executive communication, Scaling teams]
---
```

---
