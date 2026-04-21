# CLAUDE.md

> This file is read by Claude Code skills to understand your identity and vault structure.
> Replace all placeholder values with your own before using this vault with Claude Code.

---

## Identity

- **Name:** Alex Chen
- **Email:** alex.chen@acmecorp.com
- **Role:** Engineering Manager
- **Company:** Acme Corp
- **Timezone:** America/New_York

---

## Vault Structure

This vault uses the `tech-manager-os` folder convention.

| Folder | Purpose |
|--------|---------|
| `inbox/` | Incoming meeting notes from Granola |
| `archive/` | Processed originals (moved by `tmr process`) |
| `my-teams/members/` | One sub-folder per direct report, named by email |
| `my-teams/teams/` | Named team groupings |
| `my-company/members/` | Company contacts outside your direct team |
| `my-company/meetings/` | Company-wide and cross-team meeting notes |
| `my-company/projects/` | Active project files |
| `my-leadership/` | Your manager and skip-levels |
| `my-career/` | Your own profile, assessments, feedback received |
| `my-tasks/` | tasks.md + Dataview view files |
| `knowledge-base/` | Reference docs, rubrics, process guides |
| `config/` | Messaging templates, process references |
| `.claude/skills/` | Installed Claude Code skills |

---

## Team Members

<!-- This section is updated by `tmr team add` -->

| Email | Name | Role | Team |
|-------|------|------|------|
| sam.patel@acmecorp.com | Sam Patel | Senior Engineer | platform |
| jordan.lee@acmecorp.com | Jordan Lee | Engineer | platform |
| riley.kim@acmecorp.com | Riley Kim | Tech Lead | infrastructure |

---

## Leadership

<!-- This section is updated by `tmr leadership add` -->

| Email | Name | Role |
|-------|------|------|
| director@acmecorp.com | Morgan Taylor | Director of Engineering |

---

## Communication Style

- Prefer concise, direct summaries — bullet points over paragraphs
- Always include action items with an owner and due date when present
- When uncertain about routing, ask before moving files
- Use Obsidian wiki-links for people: `[[email@domain.com]]`
