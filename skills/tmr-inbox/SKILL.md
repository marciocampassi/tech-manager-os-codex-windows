# tmr-inbox

> A Claude Code skill for processing your inbox vault folder.
> Reads all context from `CLAUDE.md` — no hardcoded values.

---

## Prerequisites

Before using this skill, ensure the following:

1. **`CLAUDE.md` must be present and populated.** Run `tmr init` to generate it. The skill reads your identity and vault structure exclusively from this file. Without it, the skill cannot operate correctly.

2. **Obsidian Dataview plugin must be installed.** The task view files (`today.md`, `this-week.md`, etc.) use Dataview queries. Install via the Obsidian community plugin browser or by running `tmr install` (which includes Dataview via `tmr init`).

3. **Run `/tmr-inbox setup` before first use.** This creates `my-tasks/tasks.md` and the four Dataview view files if they don't already exist.

---

## Reading Context from CLAUDE.md

At the start of every `/tmr-inbox` command, read `CLAUDE.md` from the vault root and extract the following variables. All subsequent operations use these — never hardcode any value.

### Identity Variables

Parse the `## Identity` section of `CLAUDE.md`:

```
- **Name:** {OWNER_NAME}
- **Email:** {OWNER_EMAIL}
- **Role:** {OWNER_ROLE}
- **Company:** {COMPANY}
```

Derive:
- `OWNER_DOMAIN` = everything after `@` in `OWNER_EMAIL`

### Vault Path Variables

Parse the `## Vault Structure` table of `CLAUDE.md` to confirm folder names. Use these canonical paths for all file operations:

| Variable | Path |
|----------|------|
| `INBOX` | `inbox/` |
| `ARCHIVE` | `archive/` |
| `TASKS_FILE` | `my-tasks/tasks.md` |
| `TASKS_TODAY` | `my-tasks/today.md` |
| `TASKS_WEEK` | `my-tasks/this-week.md` |
| `TASKS_MONTH` | `my-tasks/this-month.md` |
| `TASKS_QUARTER` | `my-tasks/this-quarter.md` |
| `TEAM_MEMBERS` | `my-teams/members/` |
| `COMPANY_MEMBERS` | `my-company/members/` |
| `COMPANY_PROJECTS` | `my-company/projects/` |
| `LEADERSHIP` | `my-leadership/` |

---

## Commands

### /tmr-inbox setup

Creates all required files for the skill to function if they are not already present. Run this once after installation.

**Steps:**

1. Read `CLAUDE.md` and extract vault path variables (see above).
2. Create `{TASKS_FILE}` (`my-tasks/tasks.md`) if it does not exist:
   ```markdown
   # Tasks

   <!-- Tasks are appended here by tmr-inbox process -->
   ```
3. Create `{TASKS_TODAY}` (`my-tasks/today.md`) if it does not exist:
   ````markdown
   # Today's Tasks

   ```dataview
   TASK
   FROM "my-tasks/tasks.md"
   WHERE !completed AND contains(text, "(today)")
   ```
   ````
4. Create `{TASKS_WEEK}` (`my-tasks/this-week.md`) if it does not exist:
   ````markdown
   # This Week's Tasks

   ```dataview
   TASK
   FROM "my-tasks/tasks.md"
   WHERE !completed AND contains(text, "(this-week)")
   ```
   ````
5. Create `{TASKS_MONTH}` (`my-tasks/this-month.md`) if it does not exist:
   ````markdown
   # This Month's Tasks

   ```dataview
   TASK
   FROM "my-tasks/tasks.md"
   WHERE !completed AND contains(text, "(this-month)")
   ```
   ````
6. Create `{TASKS_QUARTER}` (`my-tasks/this-quarter.md`) if it does not exist:
   ````markdown
   # This Quarter's Tasks

   ```dataview
   TASK
   FROM "my-tasks/tasks.md"
   WHERE !completed AND contains(text, "(this-quarter)")
   ```
   ````
7. Report which files were created and which already existed.

---

### /tmr-inbox process

Processes all Markdown files found in `{INBOX}`. For each file:

1. Read `CLAUDE.md` and extract all variables (see above).
2. Scan `{INBOX}` for `.md` files.
3. For each file, classify it (see **Classification** below).
4. Scaffold any missing profiles (see **Profile Scaffolding** below).
5. Extract tasks and append to `{TASKS_FILE}` (see **Task Extraction** below).
6. Rename and move the file to `{ARCHIVE}` using the canonical pattern (see **File Renaming** below).
7. Report a summary: files processed, profiles created, tasks extracted, files that need review.

---

## Classification

Classify each inbox file into one of four categories. Use the file title, frontmatter, and content body as signals.

| Category | Signals | Destination |
|----------|---------|-------------|
| **1:1** | Title contains a person's name or email; content is a meeting note between the vault owner and one other person; frontmatter has `type: 1:1` or `attendees` with exactly two entries | `{TEAM_MEMBERS}{person-email}.md` |
| **Project** | Title or content references a named project; frontmatter has `type: project` or `project:` field; contains project-specific keywords (roadmap, milestone, sprint, delivery) | `{COMPANY_PROJECTS}{project-name}/` |
| **Company** | References company-wide topics, org changes, announcements, or multiple people without a single owner; frontmatter has `type: company` or `audience: all` | `{COMPANY_MEMBERS}{email}.md` |
| **Ambiguous** | Cannot confidently determine category from content | Leave in `{INBOX}` with `needs-review: true` added to frontmatter |

### Domain Inference

When a person appears in file content without an explicit email address:
- Infer their email as `{first-name-lowercase}@{OWNER_DOMAIN}`
- For the vault owner themselves, always use `{OWNER_EMAIL}` exactly as read from `CLAUDE.md`
- Do not guess surnames; use only the first name with the inferred domain

### 1:1 Routing Detail

For files classified as 1:1:
- Identify the other person (not `OWNER_EMAIL`) from the attendees or content
- Route the note to `{TEAM_MEMBERS}{person-email}.md` — append the meeting summary as a new dated section
- If that profile file does not exist, scaffold it first (see **Profile Scaffolding**)

---

## Profile Scaffolding

Before routing a file to a profile that does not yet exist, create the profile with minimal frontmatter. Do not fill in fields you cannot infer from the inbox file.

### Team Member Profile: `{TEAM_MEMBERS}{email}.md`

Create if missing:

```markdown
---
name: {Inferred or stated full name, or email prefix if unknown}
email: {email}
role: ""
team: ""
startDate: ""
---

# {name}

<!-- Profile created by tmr-inbox on {YYYY-MM-DD} -->
```

### Company Member Profile: `{COMPANY_MEMBERS}{email}.md`

Create if missing:

```markdown
---
name: {Inferred or stated full name, or email prefix if unknown}
email: {email}
department: ""
---

# {name}

<!-- Profile created by tmr-inbox on {YYYY-MM-DD} -->
```

### Leadership Note: `{LEADERSHIP}{slug}.md`

Create only when a leadership framework, principle, or decision note is identified:

```markdown
---
title: {title}
date: {YYYY-MM-DD}
---

# {title}

<!-- Leadership note created by tmr-inbox on {YYYY-MM-DD} -->
```

---

## Task Extraction

After classifying each file, scan the content for action items and extract tasks.

**Signals for tasks:**
- Checkbox items (`- [ ] ...`)
- Lines beginning with "Action:", "TODO:", "Follow-up:", "Next step:"
- Content in sections titled "Actions", "Next Steps", "Follow-ups"

**Period classification:**
- `today` — explicitly marked urgent, or "by end of day", "ASAP"
- `this-week` — "this week", "by Friday", or no explicit deadline but clearly near-term
- `this-month` — "this month", "by end of month", or medium-term
- `this-quarter` — "this quarter", "Q{n}", or longer-term

**Append to `{TASKS_FILE}`:**

For each period with tasks from this file, append a block:

```markdown
## {YYYY-MM-DD} — {source-file-title}

- [ ] {task description} — owner: {owner-name-or-email} ({period})
```

Do not duplicate tasks already present in `{TASKS_FILE}`. Check for matching description before appending.

---

## File Renaming and Archiving

After processing, move each file from `{INBOX}` to `{ARCHIVE}` using the canonical naming pattern.

**Pattern:** `{ARCHIVE}{category}/{YYYY-MM-DD}-{slug}.md`

Where:
- `{category}` — one of: `1on1`, `project`, `company` (ambiguous files are NOT moved)
- `{YYYY-MM-DD}` — from the file's frontmatter `date` field; if absent, use the file's last-modified date; if still unknown, use today's date
- `{slug}` — lowercase kebab-case of the file title, with special characters stripped

**Example transformations:**
- `inbox/Alice Sync 2026-04-21.md` → `archive/1on1/2026-04-21-alice-sync.md`
- `inbox/Project Orion Kickoff.md` → `archive/project/2026-04-21-project-orion-kickoff.md`
- `inbox/All-Hands Notes.md` → `archive/company/2026-04-21-all-hands-notes.md`

Ambiguous files remain in `{INBOX}` with `needs-review: true` added to frontmatter. Report them in the summary.

---

## Summary Report

After processing all inbox files, output a summary:

```
tmr-inbox process complete
───────────────────────────
Files scanned:      {n}
Files processed:    {n}
Files needing review: {n} (left in inbox/)
Profiles created:   {n}
Tasks extracted:    {n}
───────────────────────────
Needs review:
  - {filename} (reason: {ambiguity reason})
```
