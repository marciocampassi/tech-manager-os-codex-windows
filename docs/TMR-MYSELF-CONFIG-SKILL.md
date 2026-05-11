---
name: tmr-myself-config
description: Adaptive setup conversation that enriches your manager profile, personalizes AI context in CLAUDE.md, scaffolds projects, and maps your team and collaborators across the vault. Run once after init, then /tmr-myself-config update whenever your context changes.
---

# tmr-myself-config

Conducts an adaptive conversation to build a complete picture of who you are as a manager — your working style, products, team, and collaborators — then writes that context across your vault so every AI skill becomes more assertive and personalized.

## Usage

- **`/tmr-myself-config`** — full setup (first run or re-run; always merges, never overwrites)
- **`/tmr-myself-config update`** — delta review: checks current context against your vault, asks only what changed

---

## EXECUTION

When invoked, check if the user passed the argument `update`. If so, follow the UPDATE section. Otherwise follow BOOTSTRAP → ARCHETYPE → BASE-CONTEXT → PRODUCT-BRANCH (if applicable) → PEOPLE-BRANCH (if applicable) → CONTRACTOR-CHECK → CONFIRM → WRITE in order.

---

## BOOTSTRAP

### Step B1: Locate the vault root

Run:
```bash
git rev-parse --show-toplevel
```
Store as `VAULT_ROOT`. All paths below are relative to `VAULT_ROOT`.

### Step B2: Find the manager's profile

List all `.md` files in `my-career/` (non-recursive). The file matching `<email>.md` (containing an `@`) is the manager's profile.

If none found: print *"No profile found in my-career/. Run `tmr init` first."* and exit.
If multiple found: print the list and ask *"Which is your profile?"* Wait for the user's selection.

Store as `PROFILE_PATH` and `MANAGER_EMAIL`.

Read the profile frontmatter. Extract any already-known fields:
- `name`, `role`, `company`, `manager_type`, `working_style`, `ai_communication_style`

Store as `KNOWN` map. Fields present in `KNOWN` will not be re-asked unless the user requests it.

When loading direct reports in Step B3, read the `relationship` field from each profile. If `relationship` is absent (profile predates this schema), treat it as `direct-report` — the folder location is the authoritative fallback.

### Step B3: Read existing vault context

Read and store (silently — no output to user yet):

1. **Leadership**: list files in `my-leadership/`. For each `<email>.md`, extract `name`, `role`.
2. **Direct reports**: list all `<email>.md` files in `my-teams/members/`. For each, extract `name`, `role`, `relationship`. If `relationship` is absent, default to `direct-report`.
3. **Contractors**: list all `<email>.md` files in `my-company/contractors/members/`. For each, extract `name`, `role`, `company`, `relationship`. If `relationship` is absent, default to `contractor`.
4. **Collaborators**: list all `<email>.md` files in `my-company/members/`. For each, extract `name`, `role`, `relationship`. Exclude entries where `relationship: unknown` — those are auto-created attendee profiles, not known collaborators.
5. **Projects**: list all subdirectory names in `my-company/projects/`. For each, read `<slug>/<slug>-project.md` frontmatter and extract `name`, `status`, `owner`. If no project file exists for a subdirectory, record `status: unknown`.
6. **Org config**: if `config/organization.yaml` exists, read `internal_domains` list. If it does not exist, `INTERNAL_DOMAINS` = [domain portion of `MANAGER_EMAIL`].

Store as `EXISTING_REPORTS`, `EXISTING_CONTRACTORS`, `EXISTING_COLLABORATORS`, `EXISTING_PROJECTS` (with status per project), `INTERNAL_DOMAINS`.

### Step B4: Greet with context summary

Print a brief summary of what was found:

```
I found:
  Profile: <name> — <role>
  Leader: <name> (<email>) [or: none found]
  Direct reports: <n> (<comma-separated names or "none">)
  Contractors: <n> (<comma-separated names or "none">)
  Collaborators: <n> (known collaborators only; auto-created attendee profiles excluded)
  Projects: <n> (<name: status> per project, e.g. "ai-enablement: active, onboarding: planning")

I'll focus on what's missing or outdated. This takes about 5–10 minutes.
```

---

## ARCHETYPE

### Step A1: Determine manager type

If `manager_type` is already in `KNOWN`, skip this step.

Ask:

```
How would you describe your role?

  a) Product/Technical owner — I'm accountable for specific products, services,
     or technical areas
  b) People manager — I develop people who work on client projects or areas I
     don't directly own
  c) Both — I have product ownership and also manage people across different areas
```

Wait for response. Map to: `product` | `people` | `hybrid`. Store as `ARCHETYPE`.

---

## BASE-CONTEXT

Ask the following questions in sequence. Skip any where the value is already in `KNOWN`.

**Company name** (if `company` not in KNOWN):
> *"What company or organization do you work for?"*

**Working style** (if `working_style` not in KNOWN):
> *"How do you prefer to work?*
> *a) Async-first — bias toward written communication, fewer live meetings*
> *b) Sync-heavy — frequent live collaboration*
> *c) Mixed — context-dependent"*

Map to: `async-first` | `sync-heavy` | `mixed`.

**Technical background**:
> *"Briefly describe your technical background (1–2 sentences)."*

Even if previously set, ask unless the profile already has a `## Professional Background` section — the user may want to update it.

**Current priorities**:
> *"What are your top 1–3 priorities right now? (OKRs, key projects, or focus areas)"*

Always ask — priorities change frequently.

**AI communication format** (if `ai_communication_style` not in KNOWN):
> *"When working with AI, what format do you prefer for updates and recommendations?*
> *a) Bullet points*
> *b) Narrative prose*
> *c) Action items only*
> *d) Terse — minimal words, maximum signal"*

Map to: `bullets` | `narrative` | `action-items` | `terse`.

---

## PRODUCT-BRANCH

Execute this section if `ARCHETYPE` is `product` or `hybrid`.

### Step P1: Collect owned products/areas

Ask:
> *"What products, services, or technical areas are you directly responsible for? List them one per line, then press Enter on a blank line when done."*

For each entered product, collect:

1. **Slug**: derive from the name using lowercase-kebab-case (e.g., "Checkout Flow" → `checkout-flow`). Show the derived slug and confirm: *"I'll use `checkout-flow` as the folder name — OK?"*
2. **Description**: *"One-line description of [product]?"*
3. **Status**: *"Current status? [a]ctive / [p]lanning / [m]aintenance"* → `active` | `planning` | `maintenance`
4. **Tech stack** (optional): *"Key technologies? (comma-separated, or press Enter to skip)"*

Skip any product whose slug already exists in `EXISTING_PROJECTS` — announce: *"[product] is already scaffolded, I'll update its team roster."*

### Step P2: Collect team members per product

For each product (new and existing):

> *"Who works on [product] with you? Give me their email and role. Press Enter on a blank line when done."*

For each person entered:
- Validate email format. If invalid: *"That doesn't look like a valid email — try again."*
- Check if already in `EXISTING_REPORTS` → tag as `direct_report`
- Check if already in `my-company/members/` → tag as `collaborator`
- Otherwise → tag as `unknown` (will be classified in CONTRACTOR-CHECK)

Store all collected people as `PRODUCT_PEOPLE[product_slug]`.

---

## PEOPLE-BRANCH

Execute this section if `ARCHETYPE` is `people` or `hybrid`.

### Step PR1: Confirm and extend direct reports

If `EXISTING_REPORTS` is not empty, show:

> *"I found these direct reports in your vault:*
> *[list with name + role]*
> *Anyone to add?"*

If `EXISTING_REPORTS` is empty:

> *"Who are your direct reports? Email, name, and role for each. Press Enter on a blank line when done."*

For each new direct report:
- Validate email
- Collect name and role
- Add to `NEW_REPORTS` list

### Step PR2: Project assignment per report

For each direct report (existing and new):

> *"What project or client engagement is [name] primarily working on right now?"*

Accept free-text project name. Derive slug (lowercase-kebab-case). If not in `EXISTING_PROJECTS`, this project will be scaffolded.

Store as `REPORT_PROJECT[email]`.

### Step PR3: Additional collaborators

> *"Any other regular collaborators or stakeholders I should know about — people you work with frequently but who aren't direct reports?"*

> *"Email, name, role, and context (e.g., 'product manager, payments team' or 'client lead at Acme'). Press Enter on blank line when done."*

For each:
- Validate email
- Store as `COLLABORATORS` list with `{email, name, role, context}`

---

## CONTRACTOR-CHECK

For every email collected across all branches (`PRODUCT_PEOPLE`, `NEW_REPORTS`, `COLLABORATORS`), check the domain against `INTERNAL_DOMAINS`.

For each email where domain is **not** in `INTERNAL_DOMAINS`:

Ask:
> *"[email] is from [domain] — is this a contractor or external collaborator, or someone at a different internal domain?"*
> *a) Contractor/external → route to my-company/contractors/members/*
> *b) Internal (different domain) → route to my-company/members/ and add [domain] to org config*

If `a`: mark as `contractor`. Collect: *"What company or agency is [name] from?"* Store as `contractor_company`.
If `b`: add domain to `INTERNAL_DOMAINS` and mark as `internal`.

Update routing classification for each person:
- Direct report → `my-teams/members/`
- Internal collaborator → `my-company/members/`
- Contractor → `my-company/contractors/members/`

---

## CONFIRM

Before writing any file, present a complete summary:

```
Here's what I'm about to create or update:

PROFILE UPDATE
  my-career/<email>.md — adding: working_style, priorities, background, [etc.]

CLAUDE.md
  Replacing ## Manager Context section with enriched context

PROJECTS (new)
  my-company/projects/<slug>/<slug>-project.md + deps.yaml
  [list one per line, or "none"]

DIRECT REPORTS (new)
  my-teams/members/<email>.md
  [list one per line, or "none"]

COLLABORATORS (new)
  my-company/members/<email>.md
  [list one per line, or "none"]

CONTRACTORS (new)
  my-company/contractors/members/<email>.md
  [list one per line, or "none"]

ORG CONFIG UPDATE
  config/organization.yaml — adding domains: [list, or "no changes"]

Proceed? [yes / edit / cancel]
```

If `edit`: ask which section to revisit and return to the appropriate step.
If `cancel`: print *"No changes written."* and exit.
If `yes`: proceed to WRITE.

---

## WRITE

Execute all writes in this order. Use merge/append strategies — never overwrite entire files.

### Step W1: Write enriched manager profile

Read `PROFILE_PATH`. Parse existing frontmatter (gray-matter compatible).

Merge new frontmatter fields — add or update, never remove existing fields:
```yaml
company: <company>
manager_type: <archetype>
working_style: <working_style>
ai_communication_style: <format>
```

For each prose section below, check if the section heading already exists in the file:
- If exists: replace the section content
- If not: append the section at the end of the file

**Section: `## Professional Background`**
```markdown
## Professional Background

<technical background text>
```

**Section: `## Current Priorities`**
```markdown
## Current Priorities

<numbered list of priorities>
```

**Section: `## Products I Own`** (product/hybrid only)
```markdown
## Products I Own

<wiki-linked list of products with status>
```

**Section: `## My Team`**
```markdown
## My Team

<wiki-linked list of direct reports with role and project>
```

**Section: `## Key Collaborators`**
```markdown
## Key Collaborators

<wiki-linked list of collaborators with role and context>
```

Wiki-link format for people: `[[relative/path/to/<email>.md|Name]]`
Wiki-link format for projects: `[[relative/path/to/<slug>-project.md|Product Name]]`

### Step W2: Scaffold new project folders

For each new project (not in `EXISTING_PROJECTS`):

1. Create directory: `my-company/projects/<slug>/`
2. Write `my-company/projects/<slug>/deps.yaml`:
```yaml
# Dependency manifest for /tmr-project-impact
# Run: /tmr-project-impact my-company/projects/<slug> deps
# to set up source-dependent relationships interactively.

sources: {}
```

3. Write `my-company/projects/<slug>/<slug>-project.md`:
```markdown
---
name: <slug>
status: <status>
start_date: <YYYY-MM-DD>
tech: [<comma-separated tech list, or empty>]
owner: [[relative/path/to/my-career/<email>.md|<manager name>]]
---

# <Product Name>

<description>

## Team

- [[relative/path/to/my-career/<email>.md|<manager name>]] — Engineering Manager
<one line per team member: - [[path|Name]] — Role>
```

Where `start_date` = today's date (the date this config run executes).

For projects discovered via PEOPLE-BRANCH (no tech/description collected), write a minimal file:
```markdown
---
name: <slug>
status: active
start_date: <YYYY-MM-DD>
owner: [[relative/path/to/my-career/<email>.md|<manager name>]]
---

# <Project Name>

<!-- Populated via /tmr-myself-config -->
```

### Step W3: Write new member profiles

For each person in `NEW_REPORTS`:

Write `my-teams/members/<email>.md`:
```markdown
---
name: <name>
email: <email>
role: <role>
relationship: direct-report
manager: [[relative/path/to/my-career/<manager-email>.md|<manager name>]]
---

# <Name>
```

For each person in `COLLABORATORS` tagged as `internal`:

Write `my-company/members/<email>.md`:
```markdown
---
name: <name>
email: <email>
role: <role>
relationship: collaborator
context: <context>
---

# <Name>
```

For each person tagged as `contractor`:

Write `my-company/contractors/members/<email>.md`:
```markdown
---
name: <name>
email: <email>
role: <role>
relationship: contractor
company: <contractor_company>
contractor: true
---

# <Name>
```

### Step W4: Update org config

If `INTERNAL_DOMAINS` has changed (new domains added during CONTRACTOR-CHECK):

Read `config/organization.yaml`. Append any new domains to the `internal_domains` list. Write the file.

If `config/organization.yaml` does not exist, create it:
```yaml
internal_domains:
  - <domain1>
  - <domain2>
```

### Step W5: Update CLAUDE.md Manager Context

Read `CLAUDE.md`. Locate the `## Manager Context` section.

- If found: replace the entire section content (from `## Manager Context` to the next `##` heading or end of file) with the new content below.
- If not found: append the section at the end of the file.

Write the following as the `## Manager Context` section:

```markdown
## Manager Context

**Name:** <name> | **Role:** <role> | **Company:** <company>
**Manager type:** <archetype label> | **Working style:** <working_style> | **AI output format:** <ai_communication_style>

### Technical Background
<background text>

### Current Priorities
<numbered list>

### Products Owned
<table: Product | Status | Tech — or "N/A" if people-manager archetype>

### Direct Reports
| Name | Email | Role | Project |
|------|-------|------|---------|
<one row per direct report>

### Contractors
| Name | Email | Company | Role |
|------|-------|---------|------|
<one row per contractor, or omit table if none>

### Key Collaborators
| Name | Email | Context |
|------|-------|---------|
<one row per collaborator, or omit table if none>

_Last updated by /tmr-myself-config: <YYYY-MM-DD>_
```

### Step W6: Completion message

Print:
```
Done. Here's what was written:

  Profile enriched:   my-career/<email>.md
  CLAUDE.md updated:  ## Manager Context section
  Projects created:   <n> (<slug list or "none">)
  Members created:    <n direct reports>, <n collaborators>, <n contractors>
  Org config updated: config/organization.yaml

Your AI context is now active. Every skill in this vault will use it automatically.

Next steps:
  - Run /tmr-inbox to process any meeting notes in your inbox/
  - Run /tmr-project-impact <project-path> deps to set up dependency tracking
  - Run /tmr-myself-config update whenever your priorities, team, or projects change
```

---

## UPDATE

The `update` mode reviews your current context, asks what changed, and merges only the updated sections.

### Step U1: Bootstrap (same as BOOTSTRAP)

Run BOOTSTRAP steps B1–B3. No greeting — proceed directly to the review.

### Step U2: Read enriched state

Read `my-career/<email>.md` fully. Look for:
- `## Current Priorities` section content
- `## My Team` section content
- `## Products I Own` section content
- `## Key Collaborators` section content

Read `CLAUDE.md`. Look for `## Manager Context` section. Check `_Last updated by /tmr-myself-config:` timestamp.

### Step U3: Present current context

Print a structured summary. Read all values directly from frontmatter fields — do not re-derive from folder paths:

```
Your current context (last updated: <date or "never">):

PRIORITIES
  <current priorities list, or "not set">

TEAM (<n> direct reports)
  <name — role>

PROJECTS (<n>)
  <slug — status>   ← status from project file frontmatter

CONTRACTORS (<n>)
  <name (company) — role>   ← all fields from profile frontmatter

COLLABORATORS (<n>)
  <name — role>
```

### Step U4: Run delta questions

Ask each question. If the user answers "no" or presses Enter, skip to the next.

**Priorities:**
> *"Any changes to your priorities? (press Enter to keep current)"*

If changed: collect new priorities list (replaces current).

**Team changes:**
> *"Anyone joined or left your direct reports since your last update?"*

If yes:
- **Additions**: collect email, name, role, and project assignment for each new report. Add to `NEW_REPORTS` list.
- **Departures**: for each departed report (name or email), apply the following steps in sequence:
  1. **Resolve to email** — if only a name was given, search `my-teams/members/*.md` by `name:` frontmatter field. If one unique match: use its email. If multiple: list them and ask *"Which one? (enter email)"*. If none: warn *"No profile found for '[name]' — skipping."* and continue to the next departure.
  2. **Check file exists** — if `my-teams/members/<email>.md` is not found, warn *"No profile found for <email> — skipping departure."* and continue.
  3. **Ask departure date** — *"When did [name] leave? (press Enter for today: <YYYY-MM-DD>)"* — if Enter is pressed, use today's date.
  4. **Guard existing record** — if the profile already has a `departure_date` field, do not overwrite it. Inform: *"[name] is already marked as former since <existing date> — skipping date update."* Still ensure `status: former` is set if absent.
  5. **Write** — update `my-teams/members/<email>.md` frontmatter: set `status: former` and set `departure_date: <YYYY-MM-DD>` (from step 3, only if not already present).
  6. Add to `DEPARTED_REPORTS` list for CONFIRM and WRITE.

**Project changes:**
> *"Any projects wrapped up, paused, or newly started?"*

If yes: for each changed project: new status (`active` / `maintenance` / `archived`) or new project name/description.

**Contractor changes:**
> *"Any changes to your contractors? (new engagements started, or people who wrapped up)"*

If yes:
- **Additions**: collect email, name, role, and company. Add to `COLLABORATORS` list with `relationship: contractor` tag.
- **Departures**: for each departed contractor (name or email), apply the same resolution, file-check, date-prompt, and overwrite-guard steps as direct-report departures (searching `my-company/contractors/members/*.md` instead). Write to `my-company/contractors/members/<email>.md` frontmatter: set `status: former` and `departure_date: <YYYY-MM-DD>`. Add to `DEPARTED_CONTRACTORS` list.

**Collaborator changes:**
> *"Any new regular collaborators, or people who are no longer relevant?"*

If yes:
- **Additions**: collect email, name, role, and context. Add to `COLLABORATORS` list.
- **Departures**: for each departed collaborator (name or email), apply the same resolution, file-check, date-prompt, and overwrite-guard steps as direct-report departures (searching `my-company/members/*.md` instead). Write to `my-company/members/<email>.md` frontmatter: set `status: former` and `departure_date: <YYYY-MM-DD>`. Add to `DEPARTED_COLLABORATORS` list.

### Step U5: CONFIRM and WRITE

If no changes were collected across all sections: print *"Nothing to update — your context is current."* and exit.

Otherwise: run CONFIRM for only the changed sections. When departures are present, include them in the confirm summary before any file is written:

```
DEPARTURES (direct reports)
  my-teams/members/<email>.md — status: former, departure_date: <YYYY-MM-DD>
  [list one per line, or omit section if none]

DEPARTURES (collaborators)
  my-company/members/<email>.md — status: former, departure_date: <YYYY-MM-DD>
  [list one per line, or omit section if none]

DEPARTURES (contractors)
  my-company/contractors/members/<email>.md — status: former, departure_date: <YYYY-MM-DD>
  [list one per line, or omit section if none]
```

If any departures were recorded, WRITE will also re-write the `## My Team` and `## Key Collaborators` sections in `my-career/<email>.md` and the `### Direct Reports`, `### Contractors`, and `### Key Collaborators` tables in `CLAUDE.md ## Manager Context`, removing departed entries — keeping AI context accurate.

To remove a mistakenly entered departure before confirming, say *"edit departures"* and the skill will return to U4 for corrections.

Then WRITE for only the changed sections. Use the same merge strategy as setup.
