---
name: tmr-inbox
description: Process Granola meeting notes from inbox/ — route to correct folder, rename with consistent naming, scaffold missing person profiles, extract tasks to my-tasks/tasks.md
---

# tmr-inbox

Processes all `.md` files in `inbox/` using a two-pass batch approach.

## Usage

- **`/tmr-inbox`** — run the full inbox triage
- **`/tmr-inbox setup`** — one-time Dataview install + task view configuration (run once before first use)

When invoked, check if the user passed the argument `setup`. If so, follow the SETUP section. Otherwise follow the TRIAGE section.

Vault owner: `marlon.ferreira@example.com` — exclude this email when counting attendees.

---

## SETUP

### Step S1: Install Dataview Plugin

Run from the vault root:

```bash
mkdir -p ".obsidian/plugins/dataview"
curl -sL "https://github.com/blacksmithgu/obsidian-dataview/releases/latest/download/main.js" \
  -o ".obsidian/plugins/dataview/main.js"
curl -sL "https://github.com/blacksmithgu/obsidian-dataview/releases/latest/download/manifest.json" \
  -o ".obsidian/plugins/dataview/manifest.json"
curl -sL "https://github.com/blacksmithgu/obsidian-dataview/releases/latest/download/styles.css" \
  -o ".obsidian/plugins/dataview/styles.css"
```

### Step S2: Enable Dataview in Obsidian

Read `.obsidian/community-plugins.json`. It is a JSON array of enabled plugin IDs.
If `"dataview"` is not in the array, add it and write the file back.

Example before: `["obsidian-git", "calendar"]`
Example after:  `["obsidian-git", "calendar", "dataview"]`

### Step S3: Create tasks.md if missing

Check if `my-tasks/tasks.md` exists. If not, write it:

```markdown
---
objective: Canonical task list — source of truth for all action items
---

# Tasks

```

### Step S4: Rewrite my-tasks view files

Write these four files exactly (overwrite existing content):

**my-tasks/today.md:**
```markdown
---
objective: Tasks that need to be accomplished today
---

# Today

```dataview
TASK
FROM "my-tasks/tasks.md"
WHERE !completed AND contains(text, "#today")
SORT file.mday DESC
```
```

**my-tasks/this-week.md:**
```markdown
---
objective: Tasks that need to be accomplished this week
---

# This Week

```dataview
TASK
FROM "my-tasks/tasks.md"
WHERE !completed AND contains(text, "#this-week")
SORT file.mday DESC
```
```

**my-tasks/this-month.md:**
```markdown
---
objective: Tasks that need to be accomplished this month
---

# This Month

```dataview
TASK
FROM "my-tasks/tasks.md"
WHERE !completed AND contains(text, "#this-month")
SORT file.mday DESC
```
```

**my-tasks/this-quarter.md:**
```markdown
---
objective: Tasks that need to be accomplished this quarter
---

# This Quarter

```dataview
TASK
FROM "my-tasks/tasks.md"
WHERE !completed AND contains(text, "#this-quarter")
SORT file.mday DESC
```
```

### Step S5: Print completion message

Print exactly:

```
tmr-inbox setup complete.

Installed:
  .obsidian/plugins/dataview/ — Dataview plugin files
  my-tasks/tasks.md           — canonical task list
  my-tasks/today.md           — live Dataview view
  my-tasks/this-week.md       — live Dataview view
  my-tasks/this-month.md      — live Dataview view
  my-tasks/this-quarter.md    — live Dataview view

ACTION REQUIRED: Restart Obsidian to activate the Dataview plugin.
After restart, open any file in my-tasks/ to see live task queries.

Run /tmr-inbox to process your inbox.
```

---

## TRIAGE

### Pass 1: Scan and Classify (partial reads)

#### T1. Check for empty inbox

Use Glob to find all `.md` files in `inbox/`. If none found, print:
```
Inbox is empty — nothing to process.
```
Stop.

#### T2. Classify all files in one batch

For each inbox file, read only the frontmatter and first 60 lines (do NOT read the full transcript in this pass — conserve tokens for execution).

Extract from each file:
- `attendees` array from YAML frontmatter
- `title` string from YAML frontmatter
- `created` timestamp from YAML frontmatter (extract YYYY-MM-DD prefix as the meeting date)
- First heading and first 5-10 bullet points from content

**Marlon's email is `marlon.ferreira@example.com`. Exclude him from attendee counts.**

Classify each file using these rules in order:

**Rule 1 — 1:1 check:**
After removing Marlon from attendees, is exactly 1 person left?
- Yes → determine their folder:
  - Check `my-teams/members/[email]/` exists → type: `1on1-team`
  - Else check `my-leadership/[email]/` exists → type: `1on1-leadership`
  - Else check `my-company/contractors/[email]/` exists → type: `1on1-contractor`
  - Else → type: `1on1-member`
- Destination: `my-teams/members/[email]/1on1s/`, `my-leadership/[email]/1on1s/`, `my-company/contractors/[email]/1on1s/`, or `my-company/members/[email]/1on1s/`

**Rule 2 — Project meeting check:**
2+ other attendees remain. Does the title or content strongly suggest an existing project?
- Use Glob to list all folder names under `my-company/projects/`
- Normalize: lowercase the title, strip accents, replace spaces with hyphens
- If the normalized title contains a project folder name (or vice versa) → type: `project`, destination: `my-company/projects/[matched-project]/meetings/`
- If no folder match but content clearly names a recognizable project → type: `project`, use the inferred project name

**Rule 3 — Company/general meeting:**
3+ other attendees, no clear project match → type: `company`, destination: `my-company/meetings/`

Note: a meeting with exactly 2 other attendees and no project match does NOT satisfy Rule 3. It falls to Rule 4 (ambiguous) and will be presented to the user for routing.

**Rule 4 — Ambiguous:**
Cannot determine type with confidence (e.g., 2 attendees but both are unknown, title is vague, project match is weak) → type: `ambiguous`

Build two lists:
- `confident`: [{file, type, destination, person_email or project_name, date}]
- `ambiguous`: [{file, title, attendees, reason}]

#### T3. Resolve ambiguity (if any)

If the `ambiguous` list is non-empty, process each one interactively before executing anything.

For each ambiguous file, display:
```
--- Ambiguous file ---
File:      [original filename]
Title:     [title from frontmatter]
Attendees: [list, Marlon excluded]
Reason:    [why it was flagged — e.g., "2 attendees but neither found in vault", "title unclear"]

How should this be routed?
  a) 1:1 with [first attendee email] → my-company/members/[email]/1on1s/
  b) Project meeting — enter project name: ___
  c) Company/general meeting → my-company/meetings/
  d) Skip this file
  e) Contractor 1:1 with [first attendee email] → my-company/contractors/[email]/1on1s/
```

Wait for the user's response. Apply:
- `a` → add to confident as type `1on1-member` with that email
- `b` → add to confident as type `project` with the entered project name
- `c` → add to confident as type `company`
- `d` → remove from all queues (file stays in inbox); add to `skipped` list with reason 'user deferred'
- `e` → add to confident as type `1on1-contractor` with that email

After all ambiguous files are resolved, proceed to Pass 2.

### Pass 2: Execute (full reads)

For each file in the `confident` list, perform steps 2a through 2h in sequence.

#### Step 2a: Resolve attendee emails

Build a `resolved_attendees` map for all entries in the `attendees` frontmatter array (excluding Marlon).

For each attendee entry:

**If it already contains `@`** (it is an email address) → add to map as-is, `inferred: false`.

**If it is a full name only** → infer the email:

1. **Determine the dominant domain**: collect all email-format attendees in this same meeting. Count unique domains. Use the most frequent domain. If there are no email-format attendees, default to `@example.com`.

2. **Check for an existing profile that matches the name**: scan folder names in `my-teams/members/`, `my-leadership/`, `my-company/contractors/`, and `my-company/members/`. For each folder whose name looks like `firstname.lastname@domain`, check if the `firstname` and `lastname` match the person's first given name and last surname (strip accents, lowercase, compare). Also check the `name` field in the profile's frontmatter if present. If a matching folder is found → use that email, `inferred: false` (it's a confirmed match).

3. **If no existing profile matches** → construct the inferred email:
   - Strip Portuguese accents from the full name: ã→a, á→a, à→a, â→a, é→e, ê→e, í→i, ó→o, ô→o, õ→o, ú→u, ç→c, ñ→n
   - Take the **first word** (first given name) and the **last word** (last surname)
   - Lowercase both, combine as `firstname.lastname@dominant-domain`
   - Add to map with `inferred: true`

Examples:
- "John Gran Doe" → `john.doe@example.com` (inferred)
- "Mark Schward" → `mark.schward@example.com` (inferred)
- "James Dough" → `james.dough@example.com` (inferred)
- "user.name@example.com" → kept as-is (inferred: false)

Use this `resolved_attendees` map for all subsequent steps.

#### Step 2b: Scaffold missing person profiles

**For 1:1 types** (`1on1-team`, `1on1-leadership`, `1on1-contractor`, `1on1-member`):

Check if the person's folder exists:

**If type is `1on1-team`:** check `my-teams/members/[email]/`
**If type is `1on1-leadership`:** check `my-leadership/[email]/`
**If type is `1on1-contractor`:** check `my-company/contractors/[email]/`
**If type is `1on1-member`:** check `my-company/members/[email]/`

If the folder does NOT exist, create it:

For `my-teams/members/[email]/`:
```bash
mkdir -p "my-teams/members/[email]/1on1s"
mkdir -p "my-teams/members/[email]/assessments"
mkdir -p "my-teams/members/[email]/feedbacks"
mkdir -p "my-teams/members/[email]/performance-reviews"
```

For `my-leadership/[email]/`:
```bash
mkdir -p "my-leadership/[email]/1on1s"
```

For `my-company/contractors/[email]/`:
```bash
mkdir -p "my-company/contractors/[email]/1on1s"
```

For `my-company/members/[email]/`:
```bash
mkdir -p "my-company/members/[email]/1on1s"
```

**For `project` type:**

First, check if `my-company/projects/[project-name]/` exists. If it does NOT, create the project scaffold:
```bash
mkdir -p "my-company/projects/[project-name]/meetings"
```
Then create `my-company/projects/[project-name]/[project-name]-project.md`:
```markdown
---
name: [project-name]
status: active
start_date: <YYYY-MM-DD>
owner: unknown
---

# [project-name]

First meeting: [[new-filename-without-extension]]
```

Where `start_date` = the meeting date extracted from the `created` field (same date used in step 2c). `owner: unknown` is an explicit signal that the skill did not have manager profile context at creation time — `tmr-myself-config` will overwrite this when run.
Where `new-filename-without-extension` is the filename that will be computed in step 2c (without `.md`). Track any newly created projects in a `scaffolded_projects` list for the final summary.

**For `project` and `company` types:**

For each resolved attendee (from the map built in step 2a), excluding Marlon:
1. Check if a folder already exists in any of: `my-teams/members/[email]/`, `my-leadership/[email]/`, `my-company/members/[email]/`
2. If no folder found → create:
```bash
mkdir -p "my-company/members/[email]/1on1s"
```

#### Step 2c: Determine new filename

Apply the naming pattern for the file's type.

**For 1:1 types** (`1on1-team`, `1on1-leadership`, `1on1-member`):
```
YYYY-MM-DD-1on1-[email].md
```
- `YYYY-MM-DD` = meeting date extracted from the `created` frontmatter field
- `[email]` = the other person's email (lowercase, as-is)
- Example: `2026-04-10-1on1-team.member@example.com.md`

**For `project` type:**
```
YYYY-MM-DD-[kebab-topic]-[project-name]-project.md
```
- `[kebab-topic]` = title lowercased, Portuguese accents stripped (ã→a, ç→c, é→e, etc.), spaces→hyphens, non-alphanumeric/hyphen chars removed; take the first 5 words from the original title before normalization, then apply the transformations
- `[project-name]` = matched or user-provided project folder name (already kebab-case)
- Literal suffix: `-project`
- Example: `2026-04-10-communication-plan-ai-enablement-project.md`

**For `company` type:**
```
YYYY-MM-DD-[kebab-topic].md
```
- `[kebab-topic]` = same normalization as above (take the first 5 words from the original title before normalization, then apply the transformations)
- Example: `2026-04-10-all-hands-q2-review.md`

**Collision check:** if the computed destination path already exists, append `-2`, then `-3`, etc. until the path is unique.

After computing the new filename, for each resolved attendee: if the profile file `[their-folder]/[email].md` does NOT exist yet, create it now.

For attendees whose email was **not inferred** (confirmed email):
```markdown
---
name: [Full Name or email if no display name available]
email: [email]
relationship: <derived from routing context>
---

First seen: [[new-filename-without-extension]]
```

Derive `relationship` from the routing context:
- `1on1-team` → `direct-report`
- `1on1-leadership` → `leadership`
- `1on1-contractor` → `contractor`
- `1on1-member`, `project`, or `company` attendee with domain in `INTERNAL_DOMAINS` → `company`
- `1on1-member`, `project`, or `company` attendee with domain **not** in `INTERNAL_DOMAINS` → `unknown`

For attendees whose email was **inferred** from their name:
```markdown
---
name: [Full Name as it appears in attendees]
email: [inferred-email]
email_inferred: true
relationship: unknown
---

First seen: [[new-filename-without-extension]]
```

Inferred-email profiles are always `relationship: unknown` — their identity and relationship to the manager are unverified.

Where `new-filename-without-extension` is the filename just computed above, without `.md`.

#### Step 2d: Read full file content

Read the complete inbox file. You now have the full transcript and action signals.

#### Step 2e: Enrich frontmatter and inject backlinks

**Part 1 — Enrich the YAML frontmatter block.**

Before writing the file to its destination, add the following fields into the existing YAML frontmatter (between the opening `---` and closing `---`). Append them at the end of the existing frontmatter fields — do not remove or alter any existing fields (`title`, `attendees`, `created`, etc.):

```yaml
tmr_type: <type>          # one of: 1on1 | project | company
date: <YYYY-MM-DD>        # extracted from the `created` field (date portion only)
participants:             # resolved emails only, Marlon excluded
  - <email1>
  - <email2>
project: <slug>           # only present for tmr_type: project; omit for all others
```

Use `tmr_type` (not `type`) to avoid collision with any Obsidian or Granola reserved field.

Example result for a project meeting:
```yaml
---
title: AI Enablement — Communication Plan
attendees:
  - team.member@example.com
  - John Gran Doe
created: 2026-04-10T14:00:00
tmr_type: project
date: 2026-04-10
participants:
  - team.member@example.com
  - john.doe@example.com
project: ai-enablement
---
```

Example result for a 1:1:
```yaml
---
title: 1:1 with Alice
attendees:
  - alice.smith@example.com
created: 2026-04-10T09:00:00
tmr_type: 1on1
date: 2026-04-10
participants:
  - alice.smith@example.com
---
```

**Part 2 — Inject wiki-link backlinks.**

After the closing `---`, immediately insert the backlink block (no blank line between `---` and `People:`):

For all types:
```markdown
People: [[attendee1@email.com]] [[attendee2@email.com]]
```
Include all attendees except Marlon. Use the **resolved emails** from the `resolved_attendees` map built in step 2a (not the raw frontmatter values — name-only entries must appear as their resolved `[[email]]` links).

For `project` type, add a second line:
```markdown
Project: [[project-name]]
```

Add one blank line after the backlink block (before the first heading). Do not alter any existing content below it.

Resulting structure:
```markdown
---
[existing Granola frontmatter]
tmr_type: 1on1
date: 2026-04-10
participants:
  - alice.smith@example.com
---
People: [[alice.smith@example.com]]

### [existing heading]
...
```

Or with project:
```markdown
---
[existing Granola frontmatter]
tmr_type: project
date: 2026-04-10
participants:
  - team.member@example.com
  - john.doe@example.com
project: ai-enablement
---
People: [[team.member@example.com]] [[john.doe@example.com]]
Project: [[ai-enablement]]

### [existing heading]
...
```

#### Step 2f: Extract action items and append to tasks.md

Scan the full content for action items. Identify text that matches any of:
- Lines already formatted as `- [ ] ...`
- Lines containing: "follow up", "follow-up", "send", "schedule", "review", "prepare", "check", "define", "align"
- Portuguese equivalents: "acompanhar", "enviar", "agendar", "revisar", "preparar", "verificar", "definir", "alinhar", "vou", "preciso"
- Lines with a verb + future intent: "I'll", "we'll", "we need to", "we should", "needs to"
- Explicit "action:" or "next step:" labels

For each extracted action item:

**Determine time horizon** using these signals in the text:

| Signal | Tag |
|---|---|
| "today", "hoje", "EOD", "end of day", "amanhã", "tomorrow" | `#today` |
| "this week", "essa semana", "by friday", "next sync", "sprint", "semana" | `#this-week` |
| "this month", "end of month", "próximo mês", "monthly" | `#this-month` |
| "Q1", "Q2", "Q3", "Q4", "quarterly", "next quarter", "trimestre" | `#this-quarter` |
| No clear signal | Ask: `No timing signal found for: "[task text]". Assign to: (1) today (2) this-week (3) this-month (4) this-quarter [press Enter for this-week]:` |

Format each task as:
```
- [ ] [action item text, cleaned up] #[horizon] [[new-filename-without-extension]]
```

The `[[new-filename-without-extension]]` is the new filename computed in step 2c, with `.md` removed. This backlinks the task to the source meeting in Obsidian's graph.

Example:
```
- [ ] Send AI workshop invite to all team leads #this-week [[2026-04-10-ai-enablement-communication-plan]]
- [ ] Review Q2 objectives before next meeting #today [[2026-04-10-1on1-team.member@example.com]]
```

**Append to `my-tasks/tasks.md`:**

If `my-tasks/tasks.md` does not exist, create it first with this content:
```markdown
---
objective: Canonical task list — source of truth for all action items
---

# Tasks

```
Then append the new tasks section.

Read the current content of `my-tasks/tasks.md`. Append at the end:

```markdown

### YYYY-MM-DD — [meeting title from frontmatter]

- [ ] [task 1] #[horizon] [[new-filename-without-extension]]
- [ ] [task 2] #[horizon] [[new-filename-without-extension]]
```

If no action items were found in the meeting, skip this file — do not append an empty section.

#### Step 2g: Write updated file to destination and remove from inbox

Write the complete updated meeting note (frontmatter + injected backlinks + original content) to the destination path using the new filename computed in step 2c.

Then delete the original file from `inbox/`:
```bash
rm "inbox/[original-filename]"
```

#### Step 2h: Update person profile with meeting backlink

This step applies to all types (1:1, project, company).

For each attendee in the `People:` line (except Marlon):
1. Find their profile file: `[their-folder]/[email].md`
   To resolve `[their-folder]`, search in this order:
     1. `my-teams/members/[email]/` — if folder exists, use it
     2. `my-leadership/[email]/` — if folder exists, use it
     3. `my-company/contractors/[email]/` — if folder exists, use it
     4. `my-company/members/[email]/` — if folder exists, use it
2. Check if a `## Meetings` section exists at the end
3. If it does NOT exist, append it:
   ```markdown
   
   ## Meetings
   
   - [[new-filename-without-extension]]
   ```
4. If it DOES exist, append a new line inside it:
   ```markdown
   - [[new-filename-without-extension]]
   ```

For `project` type meetings, also update the project index file if it exists:
- Find `my-company/projects/[project-name]/[project-name]-project.md`
- If it exists, append to a `## Meetings` section the same way

---

### Summary

After processing all files, print this summary:

```
tmr-inbox complete.

Files processed: N
  [original-name] → [new-name]
       destination: [path]
  ...

Profiles created: N
  [email] in [folder]
  ...

Projects scaffolded: N
  [project-name] → my-company/projects/[project-name]/
  ...

Emails inferred: N
  [Full Name] → [inferred-email] (verify)
  ...

Tasks extracted: N total
  #today:        X
  #this-week:    Y
  #this-month:   Z
  #this-quarter: W

All tasks appended to my-tasks/tasks.md
Skipped: [list files the user deferred (option d) and any files skipped for other reasons, or "none"]
```
