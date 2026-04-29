# Sprint Change Proposal — Frontmatter Standardization Across Skills & CLI

**Project:** tech-manager-os
**Date:** 2026-04-29
**Sprint Status at Change:** Epic 1 in-progress (Story 1.1 done; Stories 1.2–1.4 backlog). Epics 2–6 fully backlog.
**Change Scope:** Minor — skill document updates and AC additions to backlog stories; zero rework of completed work
**Routed To:** Developer agent (Story 2.3, 2.5, 3.2 AC additions); Skill author (TMR-INBOX-SKILL.md, TMR-MYSELF-CONFIG-SKILL.md updates)

---

## Section 1: Issue Summary

### Problem Statement

As the number of skills grows, each skill needs to make fast routing and context decisions. Currently, three types of files in the vault — meeting notes, person profiles, and project files — carry insufficient or inconsistent frontmatter. Skills must infer context from folder paths and filename patterns rather than reading structured fields.

**Gap 1 — Meeting notes don't carry their own classification.**
Granola produces `title`, `attendees`, and `created`. After `tmr-inbox` processes a note, the output file retains only the original Granola frontmatter. The routing decision (1:1 vs project vs company meeting), resolved participants, and normalized date are not written back into the YAML block. Any future skill reading a processed note must re-derive everything from the filename and folder.

**Gap 2 — Person profiles have no `relationship` field.**
Profiles are created by three paths: `tmr-inbox` (auto-scaffold from meeting attendees), `tmr-myself-config` (explicit setup conversation), and CLI commands. None write a `relationship` field. A skill reading any person profile cannot tell from frontmatter whether that person is a direct report, collaborator, contractor, or an auto-created unknown attendee — it must check the folder path. This is fragile and will break if profiles are moved.

**Gap 3 — Project files are inconsistent across creation paths.**
`tmr-inbox` scaffolds project files with only `name`. `tmr-myself-config` creates two variants — rich (with `status`, `tech`, `owner`) and minimal (with only `name` and `status`). Neither path writes `start_date`. A skill reading a project file has no reliable minimum schema to depend on.

### Context

Identified by Marlon during a frontmatter audit triggered by the growing skill library (`tmr-inbox`, `tmr-project-impact`, `tmr-myself-config`). As more skills are added, the cost of under-specified frontmatter compounds — each new skill must independently implement the same folder-path inference logic that a single well-defined `relationship` or `tmr_type` field would eliminate.

The Granola integration makes Gap 1 especially acute: Granola provides clean structured input, but we discard the value by not enriching the output.

### Discovery

Identified 2026-04-29 during planning for the skill ecosystem expansion.

---

## Section 2: Impact Analysis

### Epic Impact

| Epic | Impact |
|------|--------|
| Epic 1 (Shared Utilities & Relationship Removal) | None |
| Epic 2 (tmr init Rework) | **AC addition** to Story 2.3 (member loop writes `relationship: direct-report`) and Story 2.5 (`tmr project add` writes standard project frontmatter) — both backlog, zero rework |
| Epic 3 (Team & Member Management) | **AC addition** to Story 3.2 — `tmr member add` writes `relationship` from routing context — backlog, zero rework |
| Epics 4–5 | None |
| Epic 6 (tmr-myself-config) | **Skill doc updates** to Stories 6.1/6.2 — BOOTSTRAP reads `relationship` and project `status` from frontmatter |

### Story Impact

| Story | Change Type | Detail |
|-------|-------------|--------|
| 2.3 Team Member Collection Loop | AC addition | `InitService` writes `relationship: direct-report` in member frontmatter |
| 2.5 `tmr project add` scaffold | AC addition | Project file frontmatter includes `name`, `status`, `start_date`, `owner` |
| 3.2 Company-Scoped vs Team-Scoped Member Routing | AC addition | `MemberService.addMember()` writes `relationship` based on routing context |
| 6.1 `tmr-myself-config` Setup Flow | Skill doc update | BOOTSTRAP reads `relationship` field; greeting summary includes contractors + project status |
| 6.2 `tmr-myself-config update` | Skill doc update | UPDATE summary shows contractor company + project status from frontmatter |

### Artifact Conflicts

| Artifact | Change |
|----------|--------|
| `docs/TMR-INBOX-SKILL.md` | Step 2e: add frontmatter enrichment pass; Step 2c: add `relationship` to profile templates; Step 2b: add `status`, `start_date`, `owner` to project scaffold |
| `docs/TMR-MYSELF-CONFIG-SKILL.md` | Step B2/B3/B4: BOOTSTRAP reads `relationship` + project status; Step W2: add `start_date` to all project templates; Step W3: add `relationship` to all profile templates; Step U3: richer UPDATE summary |
| `_bmad-output/planning-artifacts/epics.md` | AC additions to Stories 2.3, 2.5, 3.2 |

### Technical Impact

**Skill-side (no TypeScript):**
- `tmr-inbox`: two additional steps within the existing Pass 2 execution — (a) enrich YAML frontmatter before writing, (b) derive `relationship` when scaffolding person profiles
- `tmr-myself-config`: BOOTSTRAP reads two additional field groups; WRITE templates gain one field each

**CLI-side (TypeScript — backlog stories):**
- `MemberService.addMember()`: write `relationship` field derived from routing context (no logic change, one extra frontmatter field)
- `InitService` member loop: write `relationship: direct-report` for all init-created team members
- `ProjectService` (`tmr project add`): write `status`, `start_date`, `owner` alongside existing `name` field

---

## Section 3: Recommended Approach

**Option selected: Direct Adjustment**

All affected stories are backlog — no implementation has started. Changes are entirely additive: new fields written, new steps in skill docs. No rollback required.

| Dimension | Assessment |
|-----------|------------|
| Effort | Low — skill doc updates are prose edits; CLI changes add one frontmatter field per command |
| Risk | Very low — additive-only; existing field reads are unaffected |
| Timeline impact | None — no new stories added; AC additions are small |
| Maintainability | High — standardized schema reduces per-skill inference code |

---

## Section 4: Detailed Change Proposals

### Proposal 1 — tmr-inbox: Enrich processed meeting note YAML frontmatter

**File:** `docs/TMR-INBOX-SKILL.md` — Step 2e

Add a Part 1 to Step 2e that enriches the YAML frontmatter block before writing the processed note to its destination. Fields added inside the YAML block:

```yaml
tmr_type: 1on1 | project | company
date: YYYY-MM-DD          # normalized from Granola's `created` field
participants:             # resolved emails, Marlon excluded
  - <email1>
  - <email2>
project: <slug>           # only for tmr_type: project
```

Use `tmr_type` (not `type`) to avoid collision with Obsidian/Granola reserved fields. The existing `People:` / `Project:` wiki-link backlink injection (Part 2) is unchanged.

**Example output (project meeting):**
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
People: [[team.member@example.com]] [[john.doe@example.com]]
Project: [[ai-enablement]]

### [existing heading]
```

---

### Proposal 2 — Person profiles: `relationship` field across all creation paths

**Proposed `relationship` values:**

| Value | Path | Meaning |
|---|---|---|
| `direct-report` | CLI `--team`, `tmr init` member loop, tmr-myself-config team | Person you manage |
| `collaborator` | tmr-myself-config collaborators branch | Known working relationship |
| `contractor` | CLI `--contractor`, tmr-myself-config | External/contracted person |
| `leadership` | tmr-inbox 1on1-leadership routing | Person above you |
| `company` | CLI no `--team`, tmr-inbox company/project attendees (internal domain) | Company-scoped contact |
| `unknown` | tmr-inbox only — unrecognized attendee or inferred email | Auto-created, unverified |

**tmr-inbox (Step 2c) — confirmed email profile:**
```yaml
---
name: [Full Name or email]
email: [email]
relationship: <derived: direct-report | leadership | company | unknown>
---
```

**tmr-inbox (Step 2c) — inferred email profile:**
```yaml
---
name: [Full Name as it appears in attendees]
email: [inferred-email]
email_inferred: true
relationship: unknown
---
```

**tmr-myself-config (Step W3) templates:**
- Direct report → `relationship: direct-report`
- Internal collaborator → `relationship: collaborator`
- Contractor → `relationship: contractor`

**CLI Story 3.2 ACs:**
```
Given tmr member add <email> (no --team)      → relationship: company
Given tmr member add <email> --team <name>    → relationship: direct-report
Given tmr member add <email> --contractor     → relationship: contractor
```

**CLI Story 2.3 AC:**
```
Given InitService writes a team member during the member collection loop
Then the frontmatter includes relationship: direct-report
```

---

### Proposal 3 — Project files: standardize frontmatter across all creation paths

**Guaranteed minimum schema for all project files:**

| Field | tmr-inbox scaffold | tmr-myself-config minimal | tmr-myself-config full | tmr project add |
|---|---|---|---|---|
| `name` | ✓ | ✓ | ✓ | ✓ |
| `status` | `active` | `active` | collected | `active` |
| `start_date` | meeting date | config run date | config run date | today |
| `owner` | `unknown` | wiki-link | wiki-link | wiki-link or `unknown` |

**tmr-inbox (Step 2b) project scaffold:**
```yaml
---
name: [project-name]
status: active
start_date: <YYYY-MM-DD>   # meeting date from Step 2c
owner: unknown
---
```

**tmr-myself-config (Step W2) minimal template:**
```yaml
---
name: <slug>
status: active
start_date: <YYYY-MM-DD>   # config run date
owner: [[path/to/my-career/<email>.md|<manager name>]]
---
```

**tmr-myself-config (Step W2) full template:**
```yaml
---
name: <slug>
status: <status>
start_date: <YYYY-MM-DD>
tech: [<tech list>]
owner: [[path/to/my-career/<email>.md|<manager name>]]
---
```

**Story 2.5 AC addition:**
```
Given tmr project add <name> is run
When the project file is written
Then frontmatter contains: name, status (default: active),
start_date (today's date), owner (wiki-link from my-career/ or "unknown")
```

---

### Proposal 4 — tmr-myself-config BOOTSTRAP: leverage new frontmatter

**Step B2:** Read `relationship` when loading direct reports. Treat absent `relationship` as `direct-report` (backward compat).

**Step B3:** Extend vault context read to include:
- `EXISTING_CONTRACTORS` — from `my-company/contractors/members/` with `name`, `role`, `company`
- `EXISTING_COLLABORATORS` — from `my-company/members/` where `relationship: collaborator` (excludes `unknown` auto-profiles)
- `EXISTING_PROJECTS` — now includes `status` from project file frontmatter

**Step B4 greeting:**
```
I found:
  Profile: <name> — <role>
  Leader: <name> (<email>) [or: none found]
  Direct reports: <n> (<names>)
  Contractors: <n> (<names>)
  Collaborators: <n> (known collaborators only; auto-profiles excluded)
  Projects: <n> (<name: status> per project)
```

**UPDATE Step U3:** Contractor summary shows `name (company) — role`; project summary shows `slug — status` (both read from frontmatter directly).

---

## Section 5: Implementation Handoff

**Scope classification: Minor**

| Work item | Handler | Action |
|-----------|---------|--------|
| `docs/TMR-INBOX-SKILL.md` updates | Skill author | Apply Proposals 1, 2A, 3A |
| `docs/TMR-MYSELF-CONFIG-SKILL.md` updates | Skill author | Apply Proposals 2B, 3B/C, 4 |
| Story 2.3 AC addition | Developer agent | Write `relationship: direct-report` in `InitService` member loop |
| Story 2.5 AC addition | Developer agent | Write full standard frontmatter in `ProjectService` |
| Story 3.2 AC addition | Developer agent | Write `relationship` in `MemberService.addMember()` |

**Success criteria:**
- All processed meeting notes in `inbox/` written with `tmr_type`, `date`, `participants` in YAML block
- All person profiles written by any path include a `relationship` field
- All project files written by any path include `name`, `status`, `start_date`, `owner`
- `tmr-myself-config` BOOTSTRAP greeting shows contractor count and project statuses
- `npm run validate` passes for all CLI changes

---

*Generated by: Correct Course workflow — 2026-04-29*
